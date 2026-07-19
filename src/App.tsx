import { useState } from "react";
import "./App.css";
import { CodeMirrorEditor } from "./components/CodeMirrorEditor";
import {
  listDocuments,
  normalizeDocumentError,
  readText,
  saveText,
  type DocumentEntry,
  type TextDocument,
} from "./contracts/document";
import {
  normalizeWorkspaceError,
  openWorkspace,
  type WorkspaceInfo,
} from "./contracts/workspace";

interface DocumentConflict {
  localContent: string;
  external: TextDocument;
}

function App() {
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [documents, setDocuments] = useState<DocumentEntry[]>([]);
  const [activeDocument, setActiveDocument] = useState<TextDocument | null>(
    null,
  );
  const [draft, setDraft] = useState("");
  const [conflict, setConflict] = useState<DocumentConflict | null>(null);
  const [message, setMessage] = useState("尚未选择工作区。");
  const [isOpening, setIsOpening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const hasUnsavedChanges =
    activeDocument !== null && draft !== activeDocument.content;

  async function handleOpenWorkspace() {
    if (
      hasUnsavedChanges &&
      !window.confirm("当前文档有未保存修改。继续将放弃这些修改，是否继续？")
    ) {
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

      const entries = await listDocuments(selected.id);
      setWorkspace(selected);
      setDocuments(entries);
      setActiveDocument(null);
      setDraft("");
      setConflict(null);

      if (entries.length === 0) {
        setMessage(`已打开“${selected.name}”，暂未发现 Markdown 或 TXT 文件。`);
      } else {
        setMessage(`已打开“${selected.name}”，发现 ${entries.length} 篇文档。`);
        await loadDocument(selected.id, entries[0].path);
      }
    } catch (error) {
      const commandError =
        workspace === null
          ? normalizeWorkspaceError(error)
          : normalizeDocumentError(error);
      setMessage(`${commandError.message}（${commandError.code}）`);
    } finally {
      setIsOpening(false);
    }
  }

  async function loadDocument(workspaceId: string, relativePath: string) {
    setIsLoading(true);
    setConflict(null);
    try {
      const document = await readText(workspaceId, relativePath);
      setActiveDocument(document);
      setDraft(document.content);
      setMessage(`已打开“${relativePath}”。`);
    } catch (error) {
      const commandError = normalizeDocumentError(error);
      setMessage(`${commandError.message}（${commandError.code}）`);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSelectDocument(entry: DocumentEntry) {
    if (!workspace || entry.path === activeDocument?.path) {
      return;
    }
    if (
      hasUnsavedChanges &&
      !window.confirm("当前文档有未保存修改。切换文档将放弃这些修改，是否继续？")
    ) {
      return;
    }
    await loadDocument(workspace.id, entry.path);
  }

  async function handleRefreshDocuments() {
    if (!workspace) {
      return;
    }
    try {
      const entries = await listDocuments(workspace.id);
      setDocuments(entries);
      setMessage(`文档列表已刷新，共 ${entries.length} 篇。`);
    } catch (error) {
      const commandError = normalizeDocumentError(error);
      setMessage(`${commandError.message}（${commandError.code}）`);
    }
  }

  async function handleSave() {
    if (!workspace || !activeDocument || !hasUnsavedChanges) {
      return;
    }

    setIsSaving(true);
    setConflict(null);
    setMessage("正在安全保存…");
    try {
      const result = await saveText(workspace.id, activeDocument, draft);
      setActiveDocument({
        ...activeDocument,
        content: draft,
        version: result.version,
      });
      setMessage("已保存到本地文件。");
    } catch (error) {
      const commandError = normalizeDocumentError(error);
      if (commandError.code === "document_conflict") {
        try {
          const external = await readText(workspace.id, activeDocument.path);
          setConflict({ localContent: draft, external });
          setMessage("检测到外部修改，已停止保存。");
        } catch (readError) {
          const readCommandError = normalizeDocumentError(readError);
          setMessage(
            `${readCommandError.message}（${readCommandError.code}）`,
          );
        }
      } else {
        setMessage(`${commandError.message}（${commandError.code}）`);
      }
    } finally {
      setIsSaving(false);
    }
  }

  function useExternalVersion() {
    if (!conflict) {
      return;
    }
    setActiveDocument(conflict.external);
    setDraft(conflict.external.content);
    setConflict(null);
    setMessage("已加载外部版本，本地草稿已放弃。");
  }

  function keepLocalDraft() {
    if (!conflict) {
      return;
    }
    setActiveDocument(conflict.external);
    setDraft(conflict.localContent);
    setConflict(null);
    setMessage("已保留本地草稿；再次保存将基于最新外部版本写入。");
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">MVP 技术 Spike · Day 2</p>
          <h1>Easy Markdown</h1>
        </div>
        <button
          type="button"
          onClick={handleOpenWorkspace}
          disabled={isOpening || isSaving}
        >
          {isOpening ? "正在选择…" : workspace ? "更换工作区" : "选择工作区"}
        </button>
      </header>

      <p className="status" role="status" aria-live="polite">
        {message}
      </p>

      {workspace ? (
        <section className="workspace-layout">
          <aside className="document-sidebar" aria-label="工作区文档">
            <div className="sidebar-heading">
              <div>
                <strong>{workspace.name}</strong>
                <span>{documents.length} 篇文档</span>
              </div>
              <button
                className="secondary-button"
                type="button"
                onClick={handleRefreshDocuments}
              >
                刷新
              </button>
            </div>

            <nav className="document-list">
              {documents.map((entry) => (
                <button
                  className={
                    entry.path === activeDocument?.path
                      ? "document-item is-active"
                      : "document-item"
                  }
                  type="button"
                  key={entry.path}
                  onClick={() => handleSelectDocument(entry)}
                  disabled={isLoading || isSaving}
                  title={entry.path}
                >
                  <span>{entry.name}</span>
                  <small>{entry.path}</small>
                </button>
              ))}
            </nav>
          </aside>

          <section className="editor-panel" aria-label="文档编辑区域">
            {activeDocument ? (
              <>
                <div className="editor-toolbar">
                  <div>
                    <strong>{activeDocument.path}</strong>
                    <span>
                      {activeDocument.hasUtf8Bom ? "UTF-8 BOM" : "UTF-8"} ·{" "}
                      {activeDocument.lineEnding.toUpperCase()}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={
                      !hasUnsavedChanges ||
                      isSaving ||
                      isLoading ||
                      conflict !== null
                    }
                  >
                    {isSaving
                      ? "正在保存…"
                      : hasUnsavedChanges
                        ? "保存"
                        : "已保存"}
                  </button>
                </div>

                {conflict ? (
                  <section className="conflict-panel" role="alert">
                    <div>
                      <strong>文件已在外部修改</strong>
                      <p>
                        保存已停止。请选择加载外部版本，或明确保留本地草稿。
                      </p>
                    </div>
                    <div className="conflict-actions">
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={useExternalVersion}
                      >
                        加载外部版本
                      </button>
                      <button type="button" onClick={keepLocalDraft}>
                        保留本地草稿
                      </button>
                    </div>
                  </section>
                ) : null}

                <CodeMirrorEditor
                  value={draft}
                  readOnly={isLoading || isSaving}
                  onChange={setDraft}
                />
              </>
            ) : (
              <div className="empty-state">
                <strong>请选择一篇文档</strong>
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
