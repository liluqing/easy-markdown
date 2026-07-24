import { describe, expect, it } from "vitest";
import type { TextDocument } from "../../contracts/document";
import {
  blocksDocumentExit,
  canApplyReconcileResult,
  captureReconcileRequest,
  editorKey,
  editorReducer,
  makeSaveSnapshot,
  shouldAutosave,
  type EditorSession,
} from "./documentState";

const document: TextDocument = {
  path: "notes/example.md",
  content: "saved",
  version: "v1",
  hasUtf8Bom: false,
  lineEnding: "lf",
};

function loaded(): EditorSession {
  const state = editorReducer(null, {
    type: "load",
    workspaceId: "workspace-1",
    document,
    generation: 4,
  });
  if (!state) {
    throw new Error("expected a loaded state");
  }
  return state;
}

describe("editorReducer", () => {
  it("queues edits made while a snapshot is saving", () => {
    let state = loaded();
    const key = editorKey(state);
    state = editorReducer(state, {
      type: "edit",
      key,
      content: "first edit",
    })!;
    const snapshot = makeSaveSnapshot(state)!;
    state = editorReducer(state, {
      type: "saveStarted",
      key,
      snapshot,
    })!;
    state = editorReducer(state, {
      type: "edit",
      key,
      content: "second edit",
    })!;
    state = editorReducer(state, {
      type: "saveSucceeded",
      key,
      editRevision: snapshot.editRevision,
      version: "v2",
    })!;

    expect(state.phase).toBe("dirty");
    expect(state.document.content).toBe("first edit");
    expect(state.document.version).toBe("v2");
    expect(state.draft).toBe("second edit");
    expect(shouldAutosave(state)).toBe(true);
  });

  it("ignores stale async results from an older generation", () => {
    const state = loaded();
    const result = editorReducer(state, {
      type: "externalMissing",
      key: { ...editorKey(state), generation: 3 },
    });

    expect(result).toBe(state);
  });

  it("reloads a clean external version and conflicts with a dirty one", () => {
    const external = { ...document, content: "external", version: "v2" };
    let state = editorReducer(loaded(), {
      type: "externalObserved",
      key: editorKey(loaded()),
      document: external,
    })!;

    expect(state.phase).toBe("clean");
    expect(state.draft).toBe("external");

    const key = editorKey(state);
    state = editorReducer(state, {
      type: "edit",
      key,
      content: "local",
    })!;
    state = editorReducer(state, {
      type: "externalObserved",
      key,
      document: { ...external, content: "new external", version: "v3" },
    })!;

    expect(state.phase).toBe("conflict");
    expect(state.draft).toBe("local");
    expect(state.external?.content).toBe("new external");
  });

  it("does not treat a self-save invalidation as a conflict", () => {
    let state = loaded();
    const key = editorKey(state);
    state = editorReducer(state, {
      type: "edit",
      key,
      content: "local",
    })!;
    const snapshot = makeSaveSnapshot(state)!;
    state = editorReducer(state, {
      type: "saveStarted",
      key,
      snapshot,
    })!;
    state = editorReducer(state, {
      type: "saveSucceeded",
      key,
      editRevision: snapshot.editRevision,
      version: "v2",
    })!;
    state = editorReducer(state, {
      type: "externalObserved",
      key,
      document: { ...document, content: "local", version: "v2" },
    })!;

    expect(state.phase).toBe("clean");
    expect(state.external).toBeNull();
  });

  it("preserves a draft when the file disappears and recreates from it", () => {
    let state = loaded();
    const key = editorKey(state);
    state = editorReducer(state, {
      type: "edit",
      key,
      content: "draft to preserve",
    })!;
    state = editorReducer(state, { type: "externalMissing", key })!;

    expect(state.phase).toBe("missing");
    expect(state.draft).toBe("draft to preserve");
    expect(shouldAutosave(state)).toBe(false);

    state = editorReducer(state, {
      type: "recreated",
      key,
      document: { ...document, content: "", version: "empty-v1" },
    })!;

    expect(state.phase).toBe("dirty");
    expect(state.draft).toBe("draft to preserve");
    expect(state.document.version).toBe("empty-v1");
  });

  it("moves a missing document to conflict when the path reappears", () => {
    let state = loaded();
    const key = editorKey(state);
    state = editorReducer(state, {
      type: "edit",
      key,
      content: "preserved draft",
    })!;
    state = editorReducer(state, { type: "externalMissing", key })!;
    state = editorReducer(state, {
      type: "externalObserved",
      key,
      document,
    })!;

    expect(state.phase).toBe("conflict");
    expect(state.draft).toBe("preserved draft");
    expect(state.external).toEqual(document);
  });

  it("allows a clean externally deleted document to be left safely", () => {
    const clean = loaded();
    const key = editorKey(clean);
    const missing = editorReducer(clean, {
      type: "externalMissing",
      key,
    })!;

    expect(missing.phase).toBe("missing");
    expect(missing.missingHasLocalDraft).toBe(false);
    expect(blocksDocumentExit(missing)).toBe(false);
  });

  it("blocks leaving when an externally deleted document has a local draft", () => {
    let state = loaded();
    const key = editorKey(state);
    state = editorReducer(state, {
      type: "edit",
      key,
      content: "local draft",
    })!;
    state = editorReducer(state, { type: "externalMissing", key })!;

    expect(state.phase).toBe("missing");
    expect(state.missingHasLocalDraft).toBe(true);
    expect(blocksDocumentExit(state)).toBe(true);
  });

  it("turns a clean missing document into a retained draft when edited", () => {
    let state = loaded();
    const key = editorKey(state);
    state = editorReducer(state, { type: "externalMissing", key })!;
    state = editorReducer(state, {
      type: "edit",
      key,
      content: "new local draft",
    })!;

    expect(state.missingHasLocalDraft).toBe(true);
    expect(blocksDocumentExit(state)).toBe(true);
  });

  it("loads a reappearing path automatically when missing had no local draft", () => {
    let state = loaded();
    const key = editorKey(state);
    state = editorReducer(state, { type: "externalMissing", key })!;
    state = editorReducer(state, {
      type: "externalObserved",
      key,
      document: { ...document, content: "reappeared", version: "v2" },
    })!;

    expect(state.phase).toBe("clean");
    expect(state.draft).toBe("reappeared");
    expect(blocksDocumentExit(state)).toBe(false);
  });

  it("refreshes the external side while a conflict is open", () => {
    let state = loaded();
    const key = editorKey(state);
    state = editorReducer(state, {
      type: "edit",
      key,
      content: "local",
    })!;
    state = editorReducer(state, {
      type: "externalObserved",
      key,
      document: { ...document, content: "external", version: "v2" },
    })!;
    state = editorReducer(state, {
      type: "externalObserved",
      key,
      document,
    })!;

    expect(state.phase).toBe("conflict");
    expect(state.external).toEqual(document);
    expect(state.draft).toBe("local");
  });

  it("keeps save errors visible through later edits until retry starts", () => {
    let state = loaded();
    const key = editorKey(state);
    state = editorReducer(state, {
      type: "edit",
      key,
      content: "first",
    })!;
    const snapshot = makeSaveSnapshot(state)!;
    state = editorReducer(state, {
      type: "saveStarted",
      key,
      snapshot,
    })!;
    state = editorReducer(state, {
      type: "saveFailed",
      key,
      editRevision: snapshot.editRevision,
      error: { code: "write_failed", message: "无法写入" },
    })!;
    state = editorReducer(state, {
      type: "edit",
      key,
      content: "second",
    })!;

    expect(state.phase).toBe("error");
    expect(state.error?.code).toBe("write_failed");
    expect(shouldAutosave(state)).toBe(false);
    expect(makeSaveSnapshot(state)?.content).toBe("second");
  });

  it("supports choosing either side of a conflict", () => {
    let state = loaded();
    const key = editorKey(state);
    state = editorReducer(state, {
      type: "edit",
      key,
      content: "local",
    })!;
    state = editorReducer(state, {
      type: "externalObserved",
      key,
      document: { ...document, content: "external", version: "v2" },
    })!;

    const keepLocal = editorReducer(state, { type: "keepLocal", key })!;
    expect(keepLocal.phase).toBe("dirty");
    expect(keepLocal.draft).toBe("local");
    expect(keepLocal.document.version).toBe("v2");

    const useExternal = editorReducer(state, { type: "useExternal", key })!;
    expect(useExternal.phase).toBe("clean");
    expect(useExternal.draft).toBe("external");
  });
});

describe("reconcile request coordination", () => {
  it("accepts only a result captured from the current editor state", () => {
    const state = loaded();
    const request = captureReconcileRequest(state, 7);

    expect(canApplyReconcileResult(request, state, 7)).toBe(true);
    expect(canApplyReconcileResult(request, state, 8)).toBe(false);
  });

  it("rejects an old read after a save advances the base version", () => {
    let state = loaded();
    const key = editorKey(state);
    state = editorReducer(state, {
      type: "edit",
      key,
      content: "local",
    })!;
    const request = captureReconcileRequest(state, 10);
    const snapshot = makeSaveSnapshot(state)!;
    state = editorReducer(state, {
      type: "saveStarted",
      key,
      snapshot,
    })!;
    state = editorReducer(state, {
      type: "saveSucceeded",
      key,
      editRevision: snapshot.editRevision,
      version: "v2",
    })!;

    expect(canApplyReconcileResult(request, state, 11)).toBe(false);
    expect(canApplyReconcileResult(request, state, 10)).toBe(false);
  });

  it("rejects a read when editing changes its captured revision", () => {
    let state = loaded();
    const key = editorKey(state);
    const request = captureReconcileRequest(state, 3);
    state = editorReducer(state, {
      type: "edit",
      key,
      content: "typed while reading",
    })!;

    expect(canApplyReconcileResult(request, state, 3)).toBe(false);
  });

  it("applies a dirty read after more typing without reverting the draft", () => {
    let state = loaded();
    const key = editorKey(state);
    state = editorReducer(state, {
      type: "edit",
      key,
      content: "first local edit",
    })!;
    const request = captureReconcileRequest(state, 12);
    state = editorReducer(state, {
      type: "edit",
      key,
      content: "latest local edit",
    })!;

    expect(canApplyReconcileResult(request, state, 12)).toBe(true);
    state = editorReducer(state, {
      type: "externalObserved",
      key,
      document: { ...document, content: "external", version: "v2" },
    })!;
    expect(state.phase).toBe("conflict");
    expect(state.draft).toBe("latest local edit");
    expect(state.external?.content).toBe("external");
  });

  it("refreshes a conflict read after more typing without reverting the draft", () => {
    let state = loaded();
    const key = editorKey(state);
    state = editorReducer(state, {
      type: "edit",
      key,
      content: "local",
    })!;
    state = editorReducer(state, {
      type: "externalObserved",
      key,
      document: { ...document, content: "external v2", version: "v2" },
    })!;
    const request = captureReconcileRequest(state, 20);
    state = editorReducer(state, {
      type: "edit",
      key,
      content: "latest local",
    })!;

    expect(canApplyReconcileResult(request, state, 20)).toBe(true);
    state = editorReducer(state, {
      type: "externalObserved",
      key,
      document: { ...document, content: "external v3", version: "v3" },
    })!;
    expect(state.phase).toBe("conflict");
    expect(state.draft).toBe("latest local");
    expect(state.external?.content).toBe("external v3");
  });
});
