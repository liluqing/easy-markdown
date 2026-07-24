import type {
  DocumentCommandError,
  TextDocument,
} from "../../contracts/document";

export type DocumentPhase =
  | "clean"
  | "dirty"
  | "saving"
  | "error"
  | "conflict"
  | "missing";

export interface EditorKey {
  workspaceId: string;
  path: string;
  generation: number;
}

export interface SaveSnapshot {
  key: EditorKey;
  content: string;
  editRevision: number;
  expectedVersion: string;
}

export interface EditorSession extends EditorKey {
  document: TextDocument;
  draft: string;
  phase: DocumentPhase;
  missingHasLocalDraft: boolean;
  editRevision: number;
  inFlight: SaveSnapshot | null;
  external: TextDocument | null;
  error: DocumentCommandError | null;
}

export interface ReconcileRequest {
  key: EditorKey;
  requestId: number;
  baseVersion: string;
  editRevision: number;
  phase: DocumentPhase;
}

export type EditorAction =
  | {
      type: "load";
      workspaceId: string;
      document: TextDocument;
      generation: number;
    }
  | { type: "clear" }
  | { type: "edit"; key: EditorKey; content: string }
  | { type: "saveStarted"; key: EditorKey; snapshot: SaveSnapshot }
  | {
      type: "saveSucceeded";
      key: EditorKey;
      editRevision: number;
      version: string;
    }
  | {
      type: "saveFailed";
      key: EditorKey;
      editRevision: number;
      error: DocumentCommandError;
    }
  | { type: "externalObserved"; key: EditorKey; document: TextDocument }
  | { type: "externalMissing"; key: EditorKey }
  | { type: "useExternal"; key: EditorKey }
  | { type: "keepLocal"; key: EditorKey }
  | {
      type: "recreated";
      key: EditorKey;
      document: TextDocument;
    };

export function editorReducer(
  state: EditorSession | null,
  action: EditorAction,
): EditorSession | null {
  if (action.type === "load") {
    return {
      workspaceId: action.workspaceId,
      path: action.document.path,
      generation: action.generation,
      document: action.document,
      draft: action.document.content,
      phase: "clean",
      missingHasLocalDraft: false,
      editRevision: 0,
      inFlight: null,
      external: null,
      error: null,
    };
  }

  if (action.type === "clear") {
    return null;
  }

  if (!state || !matchesEditorKey(state, action.key)) {
    return state;
  }

  switch (action.type) {
    case "edit": {
      if (action.content === state.draft) {
        return state;
      }

      let phase = state.phase;
      if (phase === "clean") {
        phase = "dirty";
      }

      return {
        ...state,
        draft: action.content,
        editRevision: state.editRevision + 1,
        phase,
        missingHasLocalDraft:
          state.phase === "missing" ? true : state.missingHasLocalDraft,
      };
    }
    case "saveStarted":
      if (state.phase !== "dirty" && state.phase !== "error") {
        return state;
      }
      return {
        ...state,
        phase: "saving",
        inFlight: action.snapshot,
        error: null,
      };
    case "saveSucceeded": {
      const snapshot = state.inFlight;
      if (!snapshot || snapshot.editRevision !== action.editRevision) {
        return state;
      }

      const hasNewerEdits = state.editRevision > snapshot.editRevision;
      return {
        ...state,
        document: {
          ...state.document,
          content: snapshot.content,
          version: action.version,
        },
        phase: hasNewerEdits ? "dirty" : "clean",
        missingHasLocalDraft: false,
        inFlight: null,
        external: null,
        error: null,
      };
    }
    case "saveFailed":
      if (state.inFlight?.editRevision !== action.editRevision) {
        return state;
      }
      return {
        ...state,
        phase: "error",
        inFlight: null,
        error: action.error,
      };
    case "externalObserved":
      if (state.phase === "missing" || state.phase === "conflict") {
        if (
          state.phase === "missing" &&
          !state.missingHasLocalDraft
        ) {
          return {
            ...state,
            path: action.document.path,
            document: action.document,
            draft: action.document.content,
            phase: "clean",
            missingHasLocalDraft: false,
            editRevision: 0,
            inFlight: null,
            external: null,
            error: null,
          };
        }
        return {
          ...state,
          phase: "conflict",
          missingHasLocalDraft: false,
          inFlight: null,
          external: action.document,
          error: null,
        };
      }

      if (action.document.version === state.document.version) {
        return state;
      }

      if (state.phase === "clean") {
        return {
          ...state,
          document: action.document,
          draft: action.document.content,
          editRevision: 0,
          missingHasLocalDraft: false,
          inFlight: null,
          external: null,
          error: null,
        };
      }

      return {
        ...state,
        phase: "conflict",
        inFlight: null,
        external: action.document,
        error: null,
      };
    case "externalMissing":
      return {
        ...state,
        phase: "missing",
        missingHasLocalDraft:
          state.phase === "missing"
            ? state.missingHasLocalDraft
            : state.phase !== "clean",
        inFlight: null,
        external: null,
        error: null,
      };
    case "useExternal":
      if (!state.external) {
        return state;
      }
      return {
        ...state,
        path: state.external.path,
        document: state.external,
        draft: state.external.content,
        phase: "clean",
        missingHasLocalDraft: false,
        editRevision: 0,
        inFlight: null,
        external: null,
        error: null,
      };
    case "keepLocal":
      if (!state.external) {
        return state;
      }
      return {
        ...state,
        path: state.external.path,
        document: state.external,
        phase:
          state.draft === state.external.content ? "clean" : "dirty",
        missingHasLocalDraft: false,
        inFlight: null,
        external: null,
        error: null,
      };
    case "recreated":
      return {
        ...state,
        path: action.document.path,
        document: action.document,
        phase:
          state.draft === action.document.content ? "clean" : "dirty",
        missingHasLocalDraft: false,
        inFlight: null,
        external: null,
        error: null,
      };
  }
}

export function editorKey(session: EditorSession): EditorKey {
  return {
    workspaceId: session.workspaceId,
    path: session.path,
    generation: session.generation,
  };
}

export function matchesEditorKey(
  session: EditorSession,
  key: EditorKey,
): boolean {
  return (
    session.workspaceId === key.workspaceId &&
    session.path === key.path &&
    session.generation === key.generation
  );
}

export function makeSaveSnapshot(
  session: EditorSession,
): SaveSnapshot | null {
  if (session.phase !== "dirty" && session.phase !== "error") {
    return null;
  }

  return {
    key: editorKey(session),
    content: session.draft,
    editRevision: session.editRevision,
    expectedVersion: session.document.version,
  };
}

export function shouldAutosave(session: EditorSession | null): boolean {
  return session?.phase === "dirty";
}

export function blocksDocumentExit(
  session: EditorSession | null,
): boolean {
  if (!session || session.phase === "clean") {
    return false;
  }
  if (session.phase === "missing") {
    return session.missingHasLocalDraft;
  }
  return true;
}

export function captureReconcileRequest(
  session: EditorSession,
  requestId: number,
): ReconcileRequest {
  return {
    key: editorKey(session),
    requestId,
    baseVersion: session.document.version,
    editRevision: session.editRevision,
    phase: session.phase,
  };
}

export function canApplyReconcileResult(
  request: ReconcileRequest,
  session: EditorSession | null,
  latestRequestId: number,
): boolean {
  const canAdvanceLocalDraft =
    session !== null &&
    request.phase === session.phase &&
    request.phase !== "clean" &&
    request.phase !== "saving" &&
    session.editRevision > request.editRevision;

  return (
    session !== null &&
    request.requestId === latestRequestId &&
    matchesEditorKey(session, request.key) &&
    session.document.version === request.baseVersion &&
    session.phase === request.phase &&
    (session.editRevision === request.editRevision || canAdvanceLocalDraft)
  );
}
