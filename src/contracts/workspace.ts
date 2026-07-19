import { invoke } from "@tauri-apps/api/core";

export interface WorkspaceInfo {
  id: string;
  name: string;
}

export interface WorkspaceCommandError {
  code: string;
  message: string;
}

export function openWorkspace(): Promise<WorkspaceInfo | null> {
  return invoke<WorkspaceInfo | null>("open_workspace");
}

export function normalizeWorkspaceError(error: unknown): WorkspaceCommandError {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return { code: error.code, message: error.message };
  }

  return {
    code: "workspace_unknown_error",
    message: "无法打开工作区，请重试。",
  };
}
