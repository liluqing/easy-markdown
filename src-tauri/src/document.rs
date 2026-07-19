use crate::workspace::{WorkspaceError, WorkspaceRegistry};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    fmt::Write as _,
    fs::{self, OpenOptions},
    io::{self, Write},
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
};
use tauri::State;

const MAX_TEXT_FILE_BYTES: u64 = 5 * 1024 * 1024;
const MAX_DOCUMENTS: usize = 20_000;
const UTF8_BOM: &[u8] = &[0xEF, 0xBB, 0xBF];
static NEXT_TEMP_FILE: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DocumentEntry {
    path: String,
    name: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TextDocument {
    path: String,
    content: String,
    version: String,
    has_utf8_bom: bool,
    line_ending: &'static str,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SaveTextResult {
    version: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DocumentError {
    code: &'static str,
    message: &'static str,
}

impl DocumentError {
    const fn new(code: &'static str, message: &'static str) -> Self {
        Self { code, message }
    }

    const fn conflict() -> Self {
        Self::new(
            "document_conflict",
            "文件已被其他程序修改，请比较内容后再决定。",
        )
    }
}

impl From<WorkspaceError> for DocumentError {
    fn from(error: WorkspaceError) -> Self {
        Self {
            code: error.code,
            message: error.message,
        }
    }
}

#[tauri::command(rename_all = "camelCase")]
pub fn list_documents(
    workspace_id: String,
    registry: State<'_, WorkspaceRegistry>,
) -> Result<Vec<DocumentEntry>, DocumentError> {
    list_documents_for(&registry, &workspace_id)
}

#[tauri::command(rename_all = "camelCase")]
pub fn read_text(
    workspace_id: String,
    relative_path: String,
    registry: State<'_, WorkspaceRegistry>,
) -> Result<TextDocument, DocumentError> {
    read_text_for(&registry, &workspace_id, &relative_path)
}

#[tauri::command(rename_all = "camelCase")]
pub fn save_text(
    workspace_id: String,
    relative_path: String,
    expected_version: String,
    content: String,
    registry: State<'_, WorkspaceRegistry>,
) -> Result<SaveTextResult, DocumentError> {
    save_text_for(
        &registry,
        &workspace_id,
        &relative_path,
        &expected_version,
        &content,
    )
}

fn list_documents_for(
    registry: &WorkspaceRegistry,
    workspace_id: &str,
) -> Result<Vec<DocumentEntry>, DocumentError> {
    let root = registry.resolve_existing_path(workspace_id, Path::new("."))?;
    let mut pending = vec![root.clone()];
    let mut documents = Vec::new();

    while let Some(directory) = pending.pop() {
        let entries = fs::read_dir(&directory).map_err(|_| {
            DocumentError::new(
                "document_list_failed",
                "无法读取工作区目录，请检查访问权限。",
            )
        })?;

        for entry in entries {
            let entry = entry.map_err(|_| {
                DocumentError::new("document_list_failed", "无法读取工作区目录项，请重试。")
            })?;
            let file_type = entry.file_type().map_err(|_| {
                DocumentError::new("document_list_failed", "无法识别工作区目录项，请重试。")
            })?;

            if file_type.is_symlink() {
                continue;
            }

            let path = entry.path();
            if file_type.is_dir() {
                if !is_hidden_internal_directory(&entry.file_name()) {
                    pending.push(path);
                }
                continue;
            }

            if !file_type.is_file() || !is_supported_text_path(&path) {
                continue;
            }

            let relative = path.strip_prefix(&root).map_err(|_| {
                DocumentError::new("path_outside_workspace", "目录项不在已授权工作区内。")
            })?;
            documents.push(DocumentEntry {
                path: path_for_frontend(relative),
                name: entry.file_name().to_string_lossy().into_owned(),
            });

            if documents.len() > MAX_DOCUMENTS {
                return Err(DocumentError::new(
                    "workspace_document_limit",
                    "工作区文档数量超过当前 Spike 上限。",
                ));
            }
        }
    }

    documents.sort_by(|left, right| {
        left.path
            .to_lowercase()
            .cmp(&right.path.to_lowercase())
            .then_with(|| left.path.cmp(&right.path))
    });
    Ok(documents)
}

fn read_text_for(
    registry: &WorkspaceRegistry,
    workspace_id: &str,
    relative_path: &str,
) -> Result<TextDocument, DocumentError> {
    let path = resolve_text_path(registry, workspace_id, relative_path)?;
    let bytes = read_supported_bytes(&path)?;
    let has_utf8_bom = bytes.starts_with(UTF8_BOM);
    let content_bytes = if has_utf8_bom {
        &bytes[UTF8_BOM.len()..]
    } else {
        bytes.as_slice()
    };
    let content = std::str::from_utf8(content_bytes)
        .map_err(|_| {
            DocumentError::new(
                "document_encoding_unsupported",
                "当前只支持 UTF-8 编码的 Markdown 和 TXT 文件。",
            )
        })?
        .to_owned();

    Ok(TextDocument {
        path: relative_path.to_owned(),
        line_ending: detect_line_ending(&content),
        content,
        version: version_for(&bytes),
        has_utf8_bom,
    })
}

fn save_text_for(
    registry: &WorkspaceRegistry,
    workspace_id: &str,
    relative_path: &str,
    expected_version: &str,
    content: &str,
) -> Result<SaveTextResult, DocumentError> {
    let path = resolve_text_path(registry, workspace_id, relative_path)?;
    let current_bytes = read_supported_bytes(&path)?;

    if version_for(&current_bytes) != expected_version {
        return Err(DocumentError::conflict());
    }

    let has_utf8_bom = current_bytes.starts_with(UTF8_BOM);
    let content_bytes = content.as_bytes();
    let total_size = content_bytes.len() + usize::from(has_utf8_bom) * UTF8_BOM.len();
    if total_size as u64 > MAX_TEXT_FILE_BYTES {
        return Err(DocumentError::new(
            "document_too_large",
            "文件超过当前 5 MiB 编辑上限。",
        ));
    }

    let mut replacement = Vec::with_capacity(total_size);
    if has_utf8_bom {
        replacement.extend_from_slice(UTF8_BOM);
    }
    replacement.extend_from_slice(content_bytes);

    if replacement == current_bytes {
        return Ok(SaveTextResult {
            version: expected_version.to_owned(),
        });
    }

    write_atomically(&path, &replacement, expected_version)?;

    Ok(SaveTextResult {
        version: version_for(&replacement),
    })
}

fn resolve_text_path(
    registry: &WorkspaceRegistry,
    workspace_id: &str,
    relative_path: &str,
) -> Result<PathBuf, DocumentError> {
    let path = registry.resolve_existing_path(workspace_id, Path::new(relative_path))?;
    if !path.is_file() {
        return Err(DocumentError::new(
            "document_not_file",
            "请选择一个 Markdown 或 TXT 文件。",
        ));
    }
    if !is_supported_text_path(&path) {
        return Err(DocumentError::new(
            "document_type_unsupported",
            "当前只支持 Markdown 和 TXT 文件。",
        ));
    }
    Ok(path)
}

fn read_supported_bytes(path: &Path) -> Result<Vec<u8>, DocumentError> {
    let metadata = fs::metadata(path)
        .map_err(|_| DocumentError::new("document_unavailable", "文件不存在或当前无法访问。"))?;
    if metadata.len() > MAX_TEXT_FILE_BYTES {
        return Err(DocumentError::new(
            "document_too_large",
            "文件超过当前 5 MiB 编辑上限。",
        ));
    }
    fs::read(path)
        .map_err(|_| DocumentError::new("document_read_failed", "无法读取文件，请检查访问权限。"))
}

fn write_atomically(
    path: &Path,
    replacement: &[u8],
    expected_version: &str,
) -> Result<(), DocumentError> {
    let parent = path
        .parent()
        .ok_or_else(|| DocumentError::new("document_write_failed", "无法确定文件所在目录。"))?;
    let file_name = path
        .file_name()
        .ok_or_else(|| DocumentError::new("document_write_failed", "无法确定目标文件名。"))?;
    let temp_sequence = NEXT_TEMP_FILE.fetch_add(1, Ordering::Relaxed);
    let temp_name = format!(
        ".{}.easy-markdown-{}-{temp_sequence}.tmp",
        file_name.to_string_lossy(),
        std::process::id()
    );
    let temp_path = parent.join(temp_name);

    let write_result = (|| -> io::Result<()> {
        let mut temp_file = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&temp_path)?;
        temp_file.write_all(replacement)?;
        temp_file.sync_all()?;

        let latest_bytes = fs::read(path)?;
        if version_for(&latest_bytes) != expected_version {
            return Err(io::Error::new(
                io::ErrorKind::AlreadyExists,
                "document version changed before replace",
            ));
        }

        replace_file(&temp_path, path)
    })();

    match write_result {
        Ok(()) => {
            sync_parent_directory(parent);
            Ok(())
        }
        Err(error) => {
            let _ = fs::remove_file(&temp_path);
            if error.kind() == io::ErrorKind::AlreadyExists {
                Err(DocumentError::conflict())
            } else {
                Err(DocumentError::new(
                    "document_write_failed",
                    "保存失败，原文件未被覆盖。",
                ))
            }
        }
    }
}

#[cfg(windows)]
fn replace_file(temp_path: &Path, target_path: &Path) -> io::Result<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };

    let temp_wide: Vec<u16> = temp_path.as_os_str().encode_wide().chain(Some(0)).collect();
    let target_wide: Vec<u16> = target_path
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect();
    let succeeded = unsafe {
        MoveFileExW(
            temp_wide.as_ptr(),
            target_wide.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if succeeded == 0 {
        Err(io::Error::last_os_error())
    } else {
        Ok(())
    }
}

#[cfg(not(windows))]
fn replace_file(temp_path: &Path, target_path: &Path) -> io::Result<()> {
    fs::rename(temp_path, target_path)
}

#[cfg(unix)]
fn sync_parent_directory(parent: &Path) {
    let _ = std::fs::File::open(parent).and_then(|directory| directory.sync_all());
}

#[cfg(not(unix))]
fn sync_parent_directory(_parent: &Path) {}

fn version_for(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    let mut version = String::with_capacity(digest.len() * 2);
    for byte in digest {
        let _ = write!(version, "{byte:02x}");
    }
    version
}

fn detect_line_ending(content: &str) -> &'static str {
    if content.contains("\r\n") {
        "crlf"
    } else if content.contains('\n') {
        "lf"
    } else {
        "none"
    }
}

fn is_supported_text_path(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            extension.eq_ignore_ascii_case("md") || extension.eq_ignore_ascii_case("txt")
        })
}

fn is_hidden_internal_directory(name: &std::ffi::OsStr) -> bool {
    matches!(
        name.to_str(),
        Some(".git" | ".easy-markdown" | "node_modules" | "target" | "dist")
    )
}

fn path_for_frontend(path: &Path) -> String {
    path.components()
        .map(|component| component.as_os_str().to_string_lossy())
        .collect::<Vec<_>>()
        .join("/")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};

    static NEXT_TEST_DIRECTORY: AtomicU64 = AtomicU64::new(1);

    struct TestDirectory(PathBuf);

    impl TestDirectory {
        fn new(name: &str) -> Self {
            let unique = NEXT_TEST_DIRECTORY.fetch_add(1, Ordering::Relaxed);
            let path = std::env::temp_dir().join(format!(
                "easy-markdown-document-{name}-{}-{unique}",
                std::process::id()
            ));
            fs::create_dir_all(&path).expect("create test directory");
            Self(path)
        }

        fn registry(&self) -> (WorkspaceRegistry, String) {
            let registry = WorkspaceRegistry::default();
            let info = registry
                .register(self.0.clone())
                .expect("register workspace");
            (registry, info.id)
        }
    }

    impl Drop for TestDirectory {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn lists_markdown_and_text_files_without_internal_directories() {
        let directory = TestDirectory::new("list");
        fs::create_dir_all(directory.0.join("子目录")).expect("create nested directory");
        fs::create_dir_all(directory.0.join(".git")).expect("create git directory");
        fs::write(directory.0.join("README.md"), "# readme\n").expect("write markdown");
        fs::write(directory.0.join("子目录").join("说明.txt"), "说明\n").expect("write text");
        fs::write(directory.0.join("image.png"), b"not an image").expect("write image fixture");
        fs::write(directory.0.join(".git").join("hidden.md"), "hidden\n")
            .expect("write hidden fixture");
        let (registry, workspace_id) = directory.registry();

        let documents =
            list_documents_for(&registry, &workspace_id).expect("list workspace documents");

        assert_eq!(
            documents,
            vec![
                DocumentEntry {
                    path: "README.md".to_owned(),
                    name: "README.md".to_owned(),
                },
                DocumentEntry {
                    path: "子目录/说明.txt".to_owned(),
                    name: "说明.txt".to_owned(),
                },
            ]
        );
    }

    #[test]
    fn reads_utf8_bom_and_crlf_without_exposing_the_bom() {
        let directory = TestDirectory::new("read");
        let path = directory.0.join("中文.md");
        let mut bytes = UTF8_BOM.to_vec();
        bytes.extend_from_slice("# 标题\r\nEmoji 😀\r\n".as_bytes());
        fs::write(&path, bytes).expect("write fixture");
        let (registry, workspace_id) = directory.registry();

        let document = read_text_for(&registry, &workspace_id, "中文.md").expect("read document");

        assert_eq!(document.content, "# 标题\r\nEmoji 😀\r\n");
        assert!(document.has_utf8_bom);
        assert_eq!(document.line_ending, "crlf");
        assert_eq!(document.version.len(), 64);
    }

    #[test]
    fn saves_with_expected_version_and_preserves_utf8_bom() {
        let directory = TestDirectory::new("save");
        let path = directory.0.join("note.md");
        let mut bytes = UTF8_BOM.to_vec();
        bytes.extend_from_slice("old\r\n".as_bytes());
        fs::write(&path, bytes).expect("write fixture");
        let (registry, workspace_id) = directory.registry();
        let document = read_text_for(&registry, &workspace_id, "note.md").expect("read document");

        let result = save_text_for(
            &registry,
            &workspace_id,
            "note.md",
            &document.version,
            "new\r\n",
        )
        .expect("save document");

        let saved = fs::read(&path).expect("read saved document");
        assert!(saved.starts_with(UTF8_BOM));
        assert_eq!(&saved[UTF8_BOM.len()..], b"new\r\n");
        assert_eq!(result.version, version_for(&saved));
    }

    #[test]
    fn refuses_to_overwrite_an_external_change() {
        let directory = TestDirectory::new("conflict");
        let path = directory.0.join("note.md");
        fs::write(&path, "original\n").expect("write fixture");
        let (registry, workspace_id) = directory.registry();
        let document = read_text_for(&registry, &workspace_id, "note.md").expect("read document");
        fs::write(&path, "external\n").expect("write external change");

        let error = save_text_for(
            &registry,
            &workspace_id,
            "note.md",
            &document.version,
            "local\n",
        )
        .expect_err("stale save must fail");

        assert_eq!(error.code, "document_conflict");
        assert_eq!(
            fs::read_to_string(path).expect("read current file"),
            "external\n"
        );
    }

    #[test]
    fn rejects_non_text_and_parent_paths() {
        let directory = TestDirectory::new("paths");
        fs::write(directory.0.join("image.png"), b"image").expect("write image");
        let (registry, workspace_id) = directory.registry();

        let image_error = read_text_for(&registry, &workspace_id, "image.png")
            .expect_err("image must be rejected");
        assert_eq!(image_error.code, "document_type_unsupported");

        let traversal_error = read_text_for(&registry, &workspace_id, "../outside.md")
            .expect_err("parent traversal must be rejected");
        assert_eq!(traversal_error.code, "path_invalid");
    }
}
