import { invoke } from "@tauri-apps/api/core";

export interface DocumentEntry {
  path: string;
  name: string;
}

export interface TextDocument {
  path: string;
  content: string;
  version: string;
  hasUtf8Bom: boolean;
  lineEnding: "lf" | "crlf" | "none";
}

export interface SaveTextResult {
  version: string;
}

export interface DocumentCommandError {
  code: string;
  message: string;
}

export function listDocuments(workspaceId: string): Promise<DocumentEntry[]> {
  return invoke<DocumentEntry[]>("list_documents", { workspaceId });
}

export function readText(
  workspaceId: string,
  relativePath: string,
): Promise<TextDocument> {
  return invoke<TextDocument>("read_text", { workspaceId, relativePath });
}

export function saveText(
  workspaceId: string,
  document: TextDocument,
  content: string,
): Promise<SaveTextResult> {
  return invoke<SaveTextResult>("save_text", {
    workspaceId,
    relativePath: document.path,
    expectedVersion: document.version,
    content: normalizeLineEndings(content, document.lineEnding),
  });
}

export function normalizeDocumentError(
  error: unknown,
): DocumentCommandError {
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
    code: "document_unknown_error",
    message: "文档操作失败，请重试。",
  };
}

function normalizeLineEndings(
  content: string,
  lineEnding: TextDocument["lineEnding"],
): string {
  const normalized = content.replace(/\r\n?/g, "\n");
  return lineEnding === "crlf"
    ? normalized.replace(/\n/g, "\r\n")
    : normalized;
}
