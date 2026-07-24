import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import "./App.css";
import { CodeMirrorEditor } from "./components/CodeMirrorEditor";
import {
  createText,
  listDocuments,
  normalizeDocumentError,
  readText,
  renameDocument,
  saveText,
  trashDocument,
  type DocumentCommandError,
  type DocumentEntry,
  type TextDocument,
} from "./contracts/document";
import {
  normalizeWorkspaceError,
  openWorkspace,
  type WorkspaceInfo,
} from "./contracts/workspace";
import {
  blocksDocumentExit,
  canApplyReconcileResult,
  captureReconcileRequest,
  editorKey,
  editorReducer,
  makeSaveSnapshot,
  matchesEditorKey,
  shouldAutosave,
  type EditorAction,
  type EditorKey,
  type EditorSession,
} from "./features/editor/documentState";

interface WorkspaceDocumentsChanged {
  workspaceId: string;
  revision: number;
}

interface WorkspaceWatchError {
  workspaceId: string;
  code?: string;
}

type SaveReason = "auto" | "manual" | "flush";

const AUTOSAVE_DELAY_MS = 800;
const MISSING_ERROR_CODES = new Set([
  "document_unavailable",
  "path_unavailable",
]);

function isMissingError(error: DocumentCommandError): boolean {
  return (
    MISSING_ERROR_CODES.has(error.code) ||
    error.code.endsWith("_not_found") ||
    error.code.endsWith("_missing")
  );
}

function formatDocumentError(error: unknown): string {
  const commandError = normalizeDocumentError(error);
  return `${commandError.message}（${commandError.code}）`;
}

function editorKeyToken(key: EditorKey): string {
  return `${key.workspaceId}\u0000${key.path}\u0000${key.generation}`;
}

function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

function phaseLabel(session: EditorSession): string {
  switch (session.phase) {
    case "clean":
      return "已保存";
    case "dirty":
      return "等待自动保存";
    case "saving":
      return "正在保存";
    case "error":
      return "保存失败";
    case "conflict":
      return "外部冲突";
    case "missing":
      return "原文件缺失";
  }
}

function App() {
  const [workspace, setWorkspaceState] = useState<WorkspaceInfo | null>(null);
  const workspaceRef = useRef<WorkspaceInfo | null>(null);
  const [documents, setDocuments] = useState<DocumentEntry[]>([]);
  const [editor, reactEditorDispatch] = useReducer(editorReducer, null);
  const editorRef = useRef<EditorSession | null>(null);
  const [message, setMessage] = useState("尚未选择工作区。");
  const [watchError, setWatchError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFileOperating, setIsFileOperating] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const generationRef = useRef(0);
  const listRequestRef = useRef(0);
  const reconcileRequestRef = useRef(0);
  const pendingWatchRef = useRef<string | null>(null);
  const watchRevisionRef = useRef({ workspaceId: "", revision: -1 });
  const savePromiseRef = useRef<Promise<boolean> | null>(null);

  const dispatchEditor = useCallback(
    (action: EditorAction) => {
      editorRef.current = editorReducer(editorRef.current, action);
      reactEditorDispatch(action);
    },
    [reactEditorDispatch],
  );

  const setWorkspace = useCallback((next: WorkspaceInfo | null) => {
    workspaceRef.current = next;
    setWorkspaceState(next);
  }, []);

  const refreshDocuments = useCallback(
    async (workspaceId: string, announce = false): Promise<boolean> => {
      const request = ++listRequestRef.current;
      try {
        const entries = await listDocuments(workspaceId);
        if (
          request !== listRequestRef.current ||
          workspaceRef.current?.id !== workspaceId
        ) {
          return false;
        }
        setDocuments(entries);
        if (announce) {
          setMessage(`文档列表已刷新，共 ${entries.length} 篇。`);
        }
        return true;
      } catch (error) {
        if (
          request === listRequestRef.current &&
          workspaceRef.current?.id === workspaceId
        ) {
          setMessage(formatDocumentError(error));
        }
        return false;
      }
    },
    [],
  );

  const reconcileActiveDocument = useCallback(
    async (key: EditorKey): Promise<void> => {
      const current = editorRef.current;
      if (!current || !matchesEditorKey(current, key)) {
        return;
      }
      if (current.phase === "saving") {
        pendingWatchRef.current = editorKeyToken(key);
        return;
      }

      const requestId = ++reconcileRequestRef.current;
      const request = captureReconcileRequest(current, requestId);
      try {
        const external = await readText(key.workspaceId, key.path);
        const applicable = editorRef.current;
        if (
          !applicable ||
          !canApplyReconcileResult(
            request,
            applicable,
            reconcileRequestRef.current,
          )
        ) {
          return;
        }
        const previousVersion = applicable.document.version;
        const previousPhase = applicable.phase;
        dispatchEditor({ type: "externalObserved", key, document: external });
        const next = editorRef.current;
        if (
          external.version !== previousVersion &&
          next?.phase === "clean" &&
          previousPhase === "clean"
        ) {
          setMessage("已加载外部文件变化。");
        } else if (next?.phase === "conflict") {
          setMessage("检测到外部修改，自动保存已冻结。");
        }
      } catch (error) {
        if (
          !canApplyReconcileResult(
            request,
            editorRef.current,
            reconcileRequestRef.current,
          )
        ) {
          return;
        }
        const commandError = normalizeDocumentError(error);
        if (isMissingError(commandError)) {
          const currentForMissing = editorRef.current;
          const hadLocalDraft =
            currentForMissing !== null &&
            (currentForMissing.phase !== "clean" ||
              currentForMissing.draft !==
                currentForMissing.document.content);
          dispatchEditor({ type: "externalMissing", key });
          setMessage(
            hadLocalDraft
              ? "原文件已在外部删除或移动，本地草稿仍保留在编辑器中。"
              : "原文件已在外部删除或移动；当前没有未保存修改，可以安全切换或关闭。",
          );
        } else {
          setMessage(`${commandError.message}（${commandError.code}）`);
        }
      }
    },
    [dispatchEditor],
  );

  const performSave = useCallback(
    async (reason: SaveReason): Promise<boolean> => {
      if (savePromiseRef.current) {
        return savePromiseRef.current;
      }

      const session = editorRef.current;
      if (!session) {
        return true;
      }
      if (session.phase === "clean") {
        return true;
      }
      if (
        session.phase === "saving" ||
        session.phase === "conflict" ||
        session.phase === "missing"
      ) {
        return false;
      }
      if (reason === "auto" && !shouldAutosave(session)) {
        return false;
      }

      const snapshot = makeSaveSnapshot(session);
      if (!snapshot) {
        return false;
      }

      ++reconcileRequestRef.current;
      dispatchEditor({
        type: "saveStarted",
        key: snapshot.key,
        snapshot,
      });
      if (reason !== "auto") {
        setMessage("正在安全保存…");
      }

      const operation = (async () => {
        try {
          const result = await saveText(
            snapshot.key.workspaceId,
            {
              ...session.document,
              version: snapshot.expectedVersion,
            },
            snapshot.content,
          );
          const latest = editorRef.current;
          if (!latest || !matchesEditorKey(latest, snapshot.key)) {
            return false;
          }

          dispatchEditor({
            type: "saveSucceeded",
            key: snapshot.key,
            editRevision: snapshot.editRevision,
            version: result.version,
          });
          const afterSave = editorRef.current;
          if (afterSave?.phase === "dirty") {
            setMessage("已保存当前快照，后续输入仍在等待保存。");
          } else {
            setMessage(
              reason === "auto"
                ? "已自动保存到本地文件。"
                : "已保存到本地文件。",
            );
          }

          if (
            pendingWatchRef.current === editorKeyToken(snapshot.key)
          ) {
            pendingWatchRef.current = null;
            await reconcileActiveDocument(snapshot.key);
          }

          return editorRef.current?.phase === "clean";
        } catch (error) {
          const latest = editorRef.current;
          if (!latest || !matchesEditorKey(latest, snapshot.key)) {
            return false;
          }

          const commandError = normalizeDocumentError(error);
          const hadPendingWatch =
            pendingWatchRef.current === editorKeyToken(snapshot.key);
          pendingWatchRef.current = null;
          if (isMissingError(commandError)) {
            dispatchEditor({ type: "externalMissing", key: snapshot.key });
            setMessage("原文件已不存在，自动保存已冻结，草稿仍然保留。");
            return false;
          }

          if (commandError.code === "document_conflict") {
            const request = ++reconcileRequestRef.current;
            try {
              const external = await readText(
                snapshot.key.workspaceId,
                snapshot.key.path,
              );
              if (
                request === reconcileRequestRef.current &&
                editorRef.current &&
                matchesEditorKey(editorRef.current, snapshot.key)
              ) {
                dispatchEditor({
                  type: "externalObserved",
                  key: snapshot.key,
                  document: external,
                });
                if (editorRef.current?.phase === "saving") {
                  dispatchEditor({
                    type: "saveFailed",
                    key: snapshot.key,
                    editRevision: snapshot.editRevision,
                    error: commandError,
                  });
                  setMessage(
                    "保存时检测到版本竞争，但磁盘内容已恢复。请明确重试保存。",
                  );
                } else {
                  setMessage("检测到外部修改，自动保存已冻结。");
                }
                pendingWatchRef.current = null;
              }
            } catch (readError) {
              if (
                request === reconcileRequestRef.current &&
                editorRef.current &&
                matchesEditorKey(editorRef.current, snapshot.key)
              ) {
                const readCommandError =
                  normalizeDocumentError(readError);
                if (isMissingError(readCommandError)) {
                  dispatchEditor({
                    type: "externalMissing",
                    key: snapshot.key,
                  });
                  setMessage(
                    "原文件已不存在，自动保存已冻结，草稿仍然保留。",
                  );
                } else {
                  dispatchEditor({
                    type: "saveFailed",
                    key: snapshot.key,
                    editRevision: snapshot.editRevision,
                    error: readCommandError,
                  });
                  setMessage(
                    `${readCommandError.message}（${readCommandError.code}）`,
                  );
                }
                pendingWatchRef.current = null;
              }
            }
            return false;
          }

          dispatchEditor({
            type: "saveFailed",
            key: snapshot.key,
            editRevision: snapshot.editRevision,
            error: commandError,
          });
          setMessage(`${commandError.message}（${commandError.code}）`);
          if (hadPendingWatch) {
            await reconcileActiveDocument(snapshot.key);
          }
          return false;
        }
      })();

      savePromiseRef.current = operation;
      try {
        return await operation;
      } finally {
        if (savePromiseRef.current === operation) {
          savePromiseRef.current = null;
        }
      }
    },
    [dispatchEditor, reconcileActiveDocument],
  );

  const flushCurrentDocument = useCallback(async (): Promise<boolean> => {
    const start = editorRef.current;
    if (!start) {
      return true;
    }
    const key = editorKey(start);

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const running = savePromiseRef.current;
      if (running) {
        await running;
      }

      const latest = editorRef.current;
      if (!latest || !matchesEditorKey(latest, key)) {
        return true;
      }
      if (latest.phase === "clean") {
        return true;
      }
      if (latest.phase === "conflict") {
        return false;
      }
      if (latest.phase === "missing") {
        return !blocksDocumentExit(latest);
      }
      if (latest.phase === "dirty" || latest.phase === "error") {
        await performSave("flush");
        const afterAttempt = editorRef.current;
        if (
          !afterAttempt ||
          !matchesEditorKey(afterAttempt, key)
        ) {
          return true;
        }
        if (
          afterAttempt.phase === "error" ||
          afterAttempt.phase === "conflict" ||
          afterAttempt.phase === "missing"
        ) {
          return false;
        }
        continue;
      }
    }

    setMessage("输入仍在变化，暂时无法完成保存，请稍后重试。");
    return false;
  }, [performSave]);

  const loadDocument = useCallback(
    async (workspaceId: string, relativePath: string): Promise<boolean> => {
      const generation = ++generationRef.current;
      setIsLoading(true);
      try {
        const document = await readText(workspaceId, relativePath);
        if (
          generation !== generationRef.current ||
          workspaceRef.current?.id !== workspaceId
        ) {
          return false;
        }
        dispatchEditor({ type: "load", workspaceId, document, generation });
        pendingWatchRef.current = null;
        setMessage(`已打开“${relativePath}”。`);
        return true;
      } catch (error) {
        if (generation === generationRef.current) {
          setMessage(formatDocumentError(error));
        }
        return false;
      } finally {
        if (generation === generationRef.current) {
          setIsLoading(false);
        }
      }
    },
    [dispatchEditor],
  );

  const loadReturnedDocument = useCallback(
    (workspaceId: string, document: TextDocument) => {
      const generation = ++generationRef.current;
      dispatchEditor({ type: "load", workspaceId, document, generation });
      pendingWatchRef.current = null;
      setIsLoading(false);
    },
    [dispatchEditor],
  );

  useEffect(() => {
    if (!editor || !shouldAutosave(editor)) {
      return;
    }
    const key = editorKey(editor);
    const revision = editor.editRevision;
    const timer = window.setTimeout(() => {
      const latest = editorRef.current;
      if (
        latest &&
        matchesEditorKey(latest, key) &&
        latest.editRevision === revision &&
        latest.phase === "dirty"
      ) {
        void performSave("auto");
      }
    }, AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [editor, performSave]);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    let disposed = false;
    const unlisteners: UnlistenFn[] = [];

    async function registerListeners() {
      try {
        const unlistenDocuments = await listen<WorkspaceDocumentsChanged>(
          "workspace-documents-changed",
          (event) => {
            if (
              disposed ||
              event.payload.workspaceId !== workspaceRef.current?.id
            ) {
              return;
            }

            const previous = watchRevisionRef.current;
            if (
              previous.workspaceId === event.payload.workspaceId &&
              event.payload.revision <= previous.revision
            ) {
              return;
            }
            watchRevisionRef.current = event.payload;
            void refreshDocuments(event.payload.workspaceId);

            const current = editorRef.current;
            if (current?.workspaceId === event.payload.workspaceId) {
              const key = editorKey(current);
              if (current.phase === "saving") {
                pendingWatchRef.current = editorKeyToken(key);
              } else {
                void reconcileActiveDocument(key);
              }
            }
          },
        );
        if (disposed) {
          unlistenDocuments();
          return;
        }
        unlisteners.push(unlistenDocuments);

        const unlistenErrors = await listen<WorkspaceWatchError>(
          "workspace-watch-error",
          (event) => {
            if (
              disposed ||
              event.payload.workspaceId !== workspaceRef.current?.id
            ) {
              return;
            }
            const suffix = event.payload.code
              ? `（${event.payload.code}）`
              : "";
            setWatchError(
              `实时文件监听发生错误${suffix}。请先使用“刷新”核对文件，自动监听恢复前不要依赖界面状态。`,
            );
          },
        );
        if (disposed) {
          unlistenErrors();
          return;
        }
        unlisteners.push(unlistenErrors);

        const activeWorkspace = workspaceRef.current;
        if (activeWorkspace) {
          const refreshed = await refreshDocuments(activeWorkspace.id);
          const current = editorRef.current;
          if (
            refreshed &&
            current?.workspaceId === activeWorkspace.id
          ) {
            await reconcileActiveDocument(editorKey(current));
          }
        }
      } catch {
        if (!disposed) {
          setWatchError(
            "无法连接实时文件监听。请使用“刷新”核对文件状态。",
          );
        }
      }
    }

    void registerListeners();
    return () => {
      disposed = true;
      for (const unlisten of unlisteners) {
        unlisten();
      }
    };
  }, [
    reconcileActiveDocument,
    refreshDocuments,
  ]);

  const flushRef = useRef(flushCurrentDocument);
  useEffect(() => {
    flushRef.current = flushCurrentDocument;
  }, [flushCurrentDocument]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (blocksDocumentExit(editorRef.current)) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    if (!isTauriRuntime()) {
      return () =>
        window.removeEventListener("beforeunload", handleBeforeUnload);
    }

    let disposed = false;
    let closing = false;
    let closeInProgress = false;
    let unlisten: UnlistenFn | null = null;
    const appWindow = getCurrentWindow();

    void appWindow
      .onCloseRequested(async (event) => {
        if (closing) {
          return;
        }
        event.preventDefault();
        if (closeInProgress) {
          return;
        }
        closeInProgress = true;
        setIsClosing(true);
        setMessage("正在保存并关闭…");
        const canClose = await flushRef.current();
        if (!canClose) {
          closeInProgress = false;
          setIsClosing(false);
          setMessage(
            "保存未完成，窗口保持打开。请解决保存错误、外部冲突或文件缺失后重试。",
          );
          return;
        }

        closing = true;
        try {
          await appWindow.destroy();
        } catch {
          closing = false;
          closeInProgress = false;
          setIsClosing(false);
          setMessage("窗口关闭失败，请重试。");
        }
      })
      .then((stopListening) => {
        if (disposed) {
          stopListening();
        } else {
          unlisten = stopListening;
        }
      })
      .catch(() => {
        if (!disposed) {
          setMessage("无法注册安全关闭处理，请先手动保存后再关闭窗口。");
        }
      });

    return () => {
      disposed = true;
      unlisten?.();
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  async function handleOpenWorkspace() {
    if (isOpening || isFileOperating || isClosing) {
      return;
    }
    setIsFileOperating(true);
    if (!(await flushCurrentDocument())) {
      setIsFileOperating(false);
      setMessage(
        "当前文档尚未安全保存，无法更换工作区。请先解决保存状态。",
      );
      return;
    }

    setIsOpening(true);
    setMessage("正在打开系统目录选择器…");
    try {
      const selected = await openWorkspace();
      if (selected === null) {
        setMessage("已取消选择，未授予新的目录权限。");
        return;
      }

      ++generationRef.current;
      dispatchEditor({ type: "clear" });
      setWorkspace(selected);
      setDocuments([]);
      setWatchError(null);
      setFileError(null);
      watchRevisionRef.current = { workspaceId: selected.id, revision: -1 };
      const entries = await listDocuments(selected.id);
      if (workspaceRef.current?.id !== selected.id) {
        return;
      }
      setDocuments(entries);
      if (entries.length === 0) {
        setMessage(
          `已打开“${selected.name}”，暂未发现 Markdown 或 TXT 文件。`,
        );
      } else {
        setMessage(`已打开“${selected.name}”，发现 ${entries.length} 篇文档。`);
        await loadDocument(selected.id, entries[0].path);
      }
    } catch (error) {
      const commandError =
        workspaceRef.current === null
          ? normalizeWorkspaceError(error)
          : normalizeDocumentError(error);
      setMessage(`${commandError.message}（${commandError.code}）`);
    } finally {
      setIsOpening(false);
      setIsFileOperating(false);
    }
  }

  async function handleSelectDocument(entry: DocumentEntry) {
    const currentWorkspace = workspaceRef.current;
    if (
      !currentWorkspace ||
      entry.path === editorRef.current?.path ||
      isLoading ||
      isFileOperating ||
      isClosing
    ) {
      return;
    }

    setIsFileOperating(true);
    const flushed = await flushCurrentDocument();
    if (!flushed) {
      setMessage(
        "当前文档尚未安全保存，无法切换。请先解决保存错误、冲突或文件缺失。",
      );
      setIsFileOperating(false);
      return;
    }
    await loadDocument(currentWorkspace.id, entry.path);
    setIsFileOperating(false);
  }

  async function handleRefreshDocuments() {
    const currentWorkspace = workspaceRef.current;
    if (!currentWorkspace) {
      return;
    }
    const refreshed = await refreshDocuments(currentWorkspace.id, true);
    const current = editorRef.current;
    if (refreshed && current?.workspaceId === currentWorkspace.id) {
      await reconcileActiveDocument(editorKey(current));
    }
  }

  async function handleCreateDocument() {
    const currentWorkspace = workspaceRef.current;
    if (!currentWorkspace || isFileOperating || isClosing) {
      return;
    }
    const relativePath = window.prompt(
      "请输入新文档的相对路径（仅支持 .md 或 .txt），例如 notes/today.md：",
    );
    if (relativePath === null || relativePath.trim() === "") {
      return;
    }

    setIsFileOperating(true);
    setFileError(null);
    try {
      if (!(await flushCurrentDocument())) {
        setMessage("当前文档尚未安全保存，无法新建并切换文档。");
        return;
      }
      const created = await createText(
        currentWorkspace.id,
        relativePath.trim(),
      );
      await refreshDocuments(currentWorkspace.id);
      loadReturnedDocument(currentWorkspace.id, created);
      setMessage(`已新建“${created.path}”。`);
    } catch (error) {
      const text = formatDocumentError(error);
      setFileError(text);
      setMessage(text);
    } finally {
      setIsFileOperating(false);
    }
  }

  async function handleRenameDocument(entry: DocumentEntry) {
    const currentWorkspace = workspaceRef.current;
    if (!currentWorkspace || isFileOperating || isClosing) {
      return;
    }
    const newName = window.prompt(
      "请输入新文件名（仅支持 .md 或 .txt，不会移动目录或覆盖同名文件）：",
      entry.name,
    );
    if (
      newName === null ||
      newName.trim() === "" ||
      newName.trim() === entry.name
    ) {
      return;
    }
    if (newName.includes("/") || newName.includes("\\")) {
      setFileError("重命名只接受文件名，不支持移动到其他目录。");
      return;
    }
    const parentSeparator = entry.path.lastIndexOf("/");
    const targetPath =
      parentSeparator === -1
        ? newName.trim()
        : `${entry.path.slice(0, parentSeparator + 1)}${newName.trim()}`;

    setIsFileOperating(true);
    setFileError(null);
    try {
      const active = editorRef.current;
      let source: TextDocument;
      if (active?.path === entry.path) {
        if (!(await flushCurrentDocument())) {
          setMessage("当前文档尚未安全保存，无法重命名。");
          return;
        }
        const flushed = editorRef.current;
        if (!flushed || flushed.path !== entry.path) {
          return;
        }
        source = flushed.document;
      } else {
        source = await readText(currentWorkspace.id, entry.path);
      }

      const renamed = await renameDocument(
        currentWorkspace.id,
        entry.path,
        targetPath,
        source.version,
      );
      if (
        workspaceRef.current?.id !== currentWorkspace.id
      ) {
        return;
      }
      if (editorRef.current?.path === entry.path) {
        loadReturnedDocument(currentWorkspace.id, renamed);
      }
      await refreshDocuments(currentWorkspace.id);
      setMessage(`已将“${entry.path}”重命名为“${renamed.path}”。`);
    } catch (error) {
      const text = formatDocumentError(error);
      setFileError(text);
      setMessage(text);
      const active = editorRef.current;
      if (active?.workspaceId === currentWorkspace.id) {
        await reconcileActiveDocument(editorKey(active));
      }
    } finally {
      setIsFileOperating(false);
    }
  }

  async function handleDeleteDocument(entry: DocumentEntry) {
    const currentWorkspace = workspaceRef.current;
    if (!currentWorkspace || isFileOperating || isClosing) {
      return;
    }
    const active = editorRef.current;
    if (active?.path === entry.path && active.phase !== "clean") {
      setFileError(
        "当前文档有未保存内容、保存错误或外部冲突，必须先保存或解决后才能删除。",
      );
      return;
    }
    if (
      !window.confirm(
        `确认将“${entry.path}”移入系统回收站？此操作不会永久删除。`,
      )
    ) {
      return;
    }

    setIsFileOperating(true);
    setFileError(null);
    try {
      const source =
        active?.path === entry.path
          ? active.document
          : await readText(currentWorkspace.id, entry.path);
      await trashDocument(
        currentWorkspace.id,
        entry.path,
        source.version,
      );
      if (editorRef.current?.path === entry.path) {
        ++generationRef.current;
        dispatchEditor({ type: "clear" });
      }
      await refreshDocuments(currentWorkspace.id);
      setMessage(`已将“${entry.path}”移入系统回收站。`);
    } catch (error) {
      const text = formatDocumentError(error);
      setFileError(text);
      setMessage(text);
      const latest = editorRef.current;
      if (latest?.workspaceId === currentWorkspace.id) {
        await reconcileActiveDocument(editorKey(latest));
      }
    } finally {
      setIsFileOperating(false);
    }
  }

  async function handleRecreateMissing() {
    let current = editorRef.current;
    if (
      !current ||
      current.phase !== "missing" ||
      !current.missingHasLocalDraft ||
      isFileOperating ||
      isClosing
    ) {
      return;
    }
    if (
      !window.confirm(
        `确认在原路径“${current.path}”新建文件，并把当前草稿保存进去？如果同名文件已重新出现，操作会停止且不会覆盖。`,
      )
    ) {
      return;
    }

    const key = editorKey(current);
    setIsFileOperating(true);
    setFileError(null);
    try {
      if (savePromiseRef.current) {
        await savePromiseRef.current;
        current = editorRef.current;
        if (
          !current ||
          !matchesEditorKey(current, key) ||
          current.phase !== "missing" ||
          !current.missingHasLocalDraft
        ) {
          return;
        }
      }
      const created = await createText(key.workspaceId, key.path);
      const latest = editorRef.current;
      if (!latest || !matchesEditorKey(latest, key)) {
        return;
      }
      dispatchEditor({ type: "recreated", key, document: created });
      await refreshDocuments(key.workspaceId);
      const saved = await flushCurrentDocument();
      setMessage(
        saved
          ? `已在原路径重建“${key.path}”并保存草稿。`
          : `已重建“${key.path}”，但草稿保存失败，请重试。`,
      );
    } catch (error) {
      const text = formatDocumentError(error);
      setFileError(text);
      setMessage(text);
      await reconcileActiveDocument(key);
    } finally {
      setIsFileOperating(false);
    }
  }

  function handleEditorChange(content: string) {
    const current = editorRef.current;
    if (!current || isClosing || isFileOperating || isLoading) {
      return;
    }
    dispatchEditor({ type: "edit", key: editorKey(current), content });
  }

  function dismissCleanMissingDocument() {
    const current = editorRef.current;
    if (
      !current ||
      current.phase !== "missing" ||
      current.missingHasLocalDraft
    ) {
      return;
    }
    ++generationRef.current;
    dispatchEditor({ type: "clear" });
    setMessage("原文件已移除，已关闭无本地修改的编辑标签。");
  }

  async function useExternalVersion() {
    if (savePromiseRef.current) {
      await savePromiseRef.current;
    }
    const current = editorRef.current;
    if (!current || current.phase !== "conflict") {
      return;
    }
    dispatchEditor({ type: "useExternal", key: editorKey(current) });
    setMessage("已加载外部版本，本地草稿已明确放弃。");
  }

  async function keepLocalDraft() {
    if (savePromiseRef.current) {
      await savePromiseRef.current;
    }
    const current = editorRef.current;
    if (!current || current.phase !== "conflict") {
      return;
    }
    dispatchEditor({ type: "keepLocal", key: editorKey(current) });
    setMessage("已保留当前本地草稿，将基于最新外部版本自动保存。");
  }

  const editorIsReadOnly = isLoading || isFileOperating || isClosing;
  const controlsDisabled =
    isOpening || isLoading || isFileOperating || isClosing;

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">MVP 技术 Spike · 文件闭环</p>
          <h1>Easy Markdown</h1>
        </div>
        <button
          type="button"
          onClick={handleOpenWorkspace}
          disabled={controlsDisabled}
        >
          {isOpening ? "正在选择…" : workspace ? "更换工作区" : "选择工作区"}
        </button>
      </header>

      <p className="status" role="status" aria-live="polite">
        {message}
      </p>

      {watchError ? (
        <p className="persistent-error" role="alert">
          {watchError}
        </p>
      ) : null}
      {fileError ? (
        <div className="persistent-error inline-alert" role="alert">
          <span>{fileError}</span>
          <button
            className="secondary-button compact-button"
            type="button"
            onClick={() => setFileError(null)}
          >
            关闭提示
          </button>
        </div>
      ) : null}

      {workspace ? (
        <section className="workspace-layout">
          <aside className="document-sidebar" aria-label="工作区文档">
            <div className="sidebar-heading">
              <div>
                <strong>{workspace.name}</strong>
                <span>{documents.length} 篇文档</span>
              </div>
              <div className="sidebar-actions">
                <button
                  className="secondary-button compact-button"
                  type="button"
                  onClick={handleCreateDocument}
                  disabled={controlsDisabled}
                >
                  新建
                </button>
                <button
                  className="secondary-button compact-button"
                  type="button"
                  onClick={handleRefreshDocuments}
                  disabled={controlsDisabled}
                >
                  刷新
                </button>
              </div>
            </div>

            <nav className="document-list">
              {documents.map((entry) => (
                <div
                  className={
                    entry.path === editor?.path
                      ? "document-row is-active"
                      : "document-row"
                  }
                  key={entry.path}
                >
                  <button
                    className="document-item"
                    type="button"
                    onClick={() => handleSelectDocument(entry)}
                    disabled={controlsDisabled}
                    title={entry.path}
                  >
                    <span>{entry.name}</span>
                    <small>{entry.path}</small>
                  </button>
                  <div className="document-actions">
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() => handleRenameDocument(entry)}
                      disabled={controlsDisabled}
                      aria-label={`重命名 ${entry.path}`}
                      title="重命名"
                    >
                      改
                    </button>
                    <button
                      className="icon-button danger-button"
                      type="button"
                      onClick={() => handleDeleteDocument(entry)}
                      disabled={
                        controlsDisabled ||
                        (entry.path === editor?.path &&
                          editor.phase !== "clean")
                      }
                      aria-label={`删除 ${entry.path}`}
                      title="移入回收站"
                    >
                      删
                    </button>
                  </div>
                </div>
              ))}
            </nav>
          </aside>

          <section className="editor-panel" aria-label="文档编辑区域">
            {editor ? (
              <>
                <div className="editor-toolbar">
                  <div>
                    <strong>{editor.path}</strong>
                    <span>
                      {editor.document.hasUtf8Bom ? "UTF-8 BOM" : "UTF-8"} ·{" "}
                      {editor.document.lineEnding.toUpperCase()} ·{" "}
                      {phaseLabel(editor)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void performSave("manual")}
                    disabled={
                      controlsDisabled ||
                      editor.phase === "clean" ||
                      editor.phase === "saving" ||
                      editor.phase === "conflict" ||
                      editor.phase === "missing"
                    }
                  >
                    {editor.phase === "saving"
                      ? "正在保存…"
                      : editor.phase === "error"
                        ? "重试保存"
                        : editor.phase === "clean"
                          ? "已保存"
                          : "立即保存"}
                  </button>
                </div>

                {editor.phase === "error" && editor.error ? (
                  <section className="save-error-panel" role="alert">
                    <div>
                      <strong>保存失败，草稿仍保留</strong>
                      <p>
                        {editor.error.message}（{editor.error.code}）
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void performSave("manual")}
                      disabled={controlsDisabled}
                    >
                      重试保存
                    </button>
                  </section>
                ) : null}

                {editor.phase === "conflict" && editor.external ? (
                  <section
                    className="conflict-panel"
                    aria-labelledby="conflict-title"
                  >
                    <div className="conflict-heading">
                      <div role="alert">
                        <strong id="conflict-title">文件已在外部修改</strong>
                        <p>
                          自动保存已冻结。请比较当前草稿与磁盘版本，再选择一方。
                        </p>
                      </div>
                      <div className="conflict-actions">
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => void useExternalVersion()}
                        >
                          加载外部版本
                        </button>
                        <button
                          type="button"
                          onClick={() => void keepLocalDraft()}
                        >
                          保留本地草稿
                        </button>
                      </div>
                    </div>
                    <div className="compare-grid" aria-label="内容比较">
                      <section>
                        <h2>当前本地草稿</h2>
                        <pre>{editor.draft}</pre>
                      </section>
                      <section>
                        <h2>磁盘外部版本</h2>
                        <pre>{editor.external.content}</pre>
                      </section>
                    </div>
                  </section>
                ) : null}

                {editor.phase === "missing" &&
                editor.missingHasLocalDraft ? (
                  <section className="missing-panel" role="alert">
                    <div>
                      <strong>原文件已删除或移动</strong>
                      <p>
                        自动保存已冻结，当前草稿不会被丢弃。仅在你明确确认后才会在原路径重建。
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRecreateMissing}
                      disabled={controlsDisabled}
                    >
                      确认在原路径重建
                    </button>
                  </section>
                ) : editor.phase === "missing" ? (
                  <section className="missing-panel" role="status">
                    <div>
                      <strong>原文件已删除或移动</strong>
                      <p>
                        当前没有尚未保存的本地修改，可以直接切换文档、关闭工作区或关闭窗口。
                      </p>
                    </div>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={dismissCleanMissingDocument}
                      disabled={controlsDisabled}
                    >
                      关闭此文档
                    </button>
                  </section>
                ) : null}

                <CodeMirrorEditor
                  value={editor.draft}
                  readOnly={editorIsReadOnly}
                  onChange={handleEditorChange}
                />
              </>
            ) : (
              <div className="empty-state">
                <strong>请选择或新建一篇文档</strong>
                <p>当前只展示工作区内的 Markdown 和 TXT 文件。</p>
              </div>
            )}
          </section>
        </section>
      ) : (
        <section className="workspace-card" aria-labelledby="workspace-title">
          <h2 id="workspace-title">打开本地知识库</h2>
          <p className="intro">
            选择一个包含 Markdown 或 TXT 的文件夹。绝对路径由 Rust
            安全边界保管，界面只使用工作区句柄和相对路径。
          </p>
        </section>
      )}
    </main>
  );
}

export default App;
