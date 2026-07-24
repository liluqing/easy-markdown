use crate::workspace::{WorkspaceError, WorkspaceRegistry};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    fmt::Write as _,
    fs::{self, File, OpenOptions},
    io::{self, Read, Seek, SeekFrom, Write},
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
};
use tauri::State;

#[cfg(windows)]
use std::{
    ffi::OsString,
    os::windows::ffi::{OsStrExt, OsStringExt},
    os::windows::{fs::OpenOptionsExt, io::AsRawHandle},
};

#[cfg(windows)]
use windows_sys::Win32::{
    Foundation::{GENERIC_READ, GENERIC_WRITE},
    Storage::FileSystem::{
        FileAttributeTagInfo, FileDispositionInfo, FileRenameInfo, GetFileInformationByHandleEx,
        GetFinalPathNameByHandleW, SetFileInformationByHandle, DELETE,
        FILE_ATTRIBUTE_REPARSE_POINT, FILE_ATTRIBUTE_TAG_INFO, FILE_DISPOSITION_INFO,
        FILE_FLAG_BACKUP_SEMANTICS, FILE_FLAG_OPEN_REPARSE_POINT, FILE_FLAG_WRITE_THROUGH,
        FILE_NAME_NORMALIZED, FILE_RENAME_INFO, FILE_SHARE_DELETE, FILE_SHARE_READ,
        FILE_SHARE_WRITE,
    },
};

const MAX_TEXT_FILE_BYTES: u64 = 5 * 1024 * 1024;
const MAX_DOCUMENTS: usize = 20_000;
const UTF8_BOM: &[u8] = &[0xEF, 0xBB, 0xBF];
#[cfg_attr(windows, allow(dead_code))]
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

#[tauri::command(rename_all = "camelCase")]
pub fn create_text(
    workspace_id: String,
    relative_path: String,
    registry: State<'_, WorkspaceRegistry>,
) -> Result<TextDocument, DocumentError> {
    create_text_for(&registry, &workspace_id, &relative_path)
}

#[tauri::command(rename_all = "camelCase")]
pub fn rename_document(
    workspace_id: String,
    source_path: String,
    target_path: String,
    expected_version: String,
    registry: State<'_, WorkspaceRegistry>,
) -> Result<TextDocument, DocumentError> {
    rename_document_for(
        &registry,
        &workspace_id,
        &source_path,
        &target_path,
        &expected_version,
    )
}

#[tauri::command(rename_all = "camelCase")]
pub async fn trash_document(
    workspace_id: String,
    relative_path: String,
    expected_version: String,
    registry: State<'_, WorkspaceRegistry>,
) -> Result<(), DocumentError> {
    let path = resolve_text_path(&registry, &workspace_id, &relative_path)?;

    #[cfg(windows)]
    let (root, parent) = {
        let root = registry.root_for(&workspace_id)?;
        let parent_path = path
            .parent()
            .ok_or_else(|| DocumentError::new("document_trash_failed", "无法确定文件所在目录。"))?;
        let parent = open_secure_directory(parent_path, &root)?;
        (root, parent)
    };

    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(windows)]
        {
            let file = open_secure_document(&path, &root, SecureAccess::Trash)?;
            trash_path_with_secure_handles(&path, file, parent, &expected_version, &SystemTrash)
        }

        #[cfg(not(windows))]
        trash_path_with_provider(&path, &expected_version, &SystemTrash)
    })
    .await
    .map_err(|_| {
        DocumentError::new(
            "document_trash_failed",
            "无法移入系统回收站，原文件未被永久删除。",
        )
    })?
}

fn list_documents_for(
    registry: &WorkspaceRegistry,
    workspace_id: &str,
) -> Result<Vec<DocumentEntry>, DocumentError> {
    let root = registry.resolve_existing_path(workspace_id, Path::new("."))?;
    #[cfg(windows)]
    let secure_root = registry.root_for(workspace_id)?;
    let mut pending = vec![root.clone()];
    let mut documents = Vec::new();

    while let Some(directory) = pending.pop() {
        #[cfg(windows)]
        let _directory_handle = open_secure_directory(&directory, &secure_root)?;
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
            let path = entry.path();
            let metadata = path.symlink_metadata().map_err(|_| {
                DocumentError::new("document_list_failed", "无法识别工作区目录项，请重试。")
            })?;

            if crate::workspace::is_link_like(&metadata) {
                continue;
            }

            let file_type = metadata.file_type();
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
    #[cfg(windows)]
    let bytes = {
        let root = registry.root_for(workspace_id)?;
        let file = open_secure_document(&path, &root, SecureAccess::Read)?;
        read_supported_file(file)?
    };
    #[cfg(not(windows))]
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

    #[cfg(windows)]
    {
        let root = registry.root_for(workspace_id)?;
        let mut file = open_secure_document(&path, &root, SecureAccess::Write)?;
        let current_bytes = read_supported_file(file.try_clone().map_err(|_| {
            DocumentError::new("document_read_failed", "无法读取文件，请检查访问权限。")
        })?)?;

        if version_for(&current_bytes) != expected_version {
            return Err(DocumentError::conflict());
        }

        let replacement = replacement_bytes(&current_bytes, content)?;
        if replacement == current_bytes {
            return Ok(SaveTextResult {
                version: expected_version.to_owned(),
            });
        }

        write_through_handle(&mut file, &replacement, expected_version)?;
        Ok(SaveTextResult {
            version: version_for(&replacement),
        })
    }

    #[cfg(not(windows))]
    {
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
}

fn create_text_for(
    registry: &WorkspaceRegistry,
    workspace_id: &str,
    relative_path: &str,
) -> Result<TextDocument, DocumentError> {
    let path = resolve_new_text_path(registry, workspace_id, relative_path)?;

    #[cfg(windows)]
    {
        let root = registry.root_for(workspace_id)?;
        let file = open_secure_new_document(&path, &root)?;
        if file.sync_all().is_err() {
            let _ = delete_file_by_handle(&file);
            return Err(DocumentError::new(
                "document_create_failed",
                "无法新建文档，请检查目标文件夹权限。",
            ));
        }
        drop(file);
        if let Some(parent) = path.parent() {
            sync_parent_directory(parent);
        }
        Ok(TextDocument {
            path: path_for_frontend(Path::new(relative_path)),
            content: String::new(),
            version: version_for(&[]),
            has_utf8_bom: false,
            line_ending: "lf",
        })
    }

    #[cfg(not(windows))]
    {
        let file = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&path)
            .map_err(|error| {
                if error.kind() == io::ErrorKind::AlreadyExists {
                    DocumentError::new("document_already_exists", "同名文档已存在，未覆盖目标。")
                } else {
                    DocumentError::new(
                        "document_create_failed",
                        "无法新建文档，请检查目标文件夹权限。",
                    )
                }
            })?;

        if file.sync_all().is_err() {
            drop(file);
            let _ = fs::remove_file(&path);
            return Err(DocumentError::new(
                "document_create_failed",
                "无法新建文档，请检查目标文件夹权限。",
            ));
        }
        drop(file);

        if let Some(parent) = path.parent() {
            sync_parent_directory(parent);
        }

        Ok(TextDocument {
            path: path_for_frontend(Path::new(relative_path)),
            content: String::new(),
            version: version_for(&[]),
            has_utf8_bom: false,
            line_ending: "lf",
        })
    }
}

fn rename_document_for(
    registry: &WorkspaceRegistry,
    workspace_id: &str,
    source_path: &str,
    target_path: &str,
    expected_version: &str,
) -> Result<TextDocument, DocumentError> {
    if Path::new(source_path) == Path::new(target_path) {
        return Err(DocumentError::new(
            "document_same_path",
            "新文件名必须与当前文件名不同。",
        ));
    }

    let source = resolve_text_path(registry, workspace_id, source_path)?;
    let target = resolve_new_text_path(registry, workspace_id, target_path)?;
    if source.parent() != target.parent() {
        return Err(DocumentError::new(
            "document_cross_directory_unsupported",
            "当前只支持在原文件夹内重命名文档。",
        ));
    }

    #[cfg(windows)]
    {
        let root = registry.root_for(workspace_id)?;
        let parent = open_secure_directory(
            source.parent().ok_or_else(|| {
                DocumentError::new("document_rename_failed", "无法确定文件所在目录。")
            })?,
            &root,
        )?;
        let source_file = open_secure_document(&source, &root, SecureAccess::Rename)?;
        let current_bytes = read_supported_file(source_file.try_clone().map_err(|_| {
            DocumentError::new("document_read_failed", "无法读取文件，请检查访问权限。")
        })?)?;
        if version_for(&current_bytes) != expected_version {
            return Err(DocumentError::conflict());
        }

        let _target_name = target
            .file_name()
            .ok_or_else(|| DocumentError::new("document_rename_failed", "无法确定目标文件名。"))?;
        if let Err(error) = rename_by_handle_no_clobber(&source_file, &parent, &target) {
            return if is_already_exists_error(&error) {
                Err(DocumentError::new(
                    "document_already_exists",
                    "同名文档已存在，未覆盖目标。",
                ))
            } else {
                Err(DocumentError::new(
                    "document_rename_failed",
                    "重命名失败，原文件保持不变。",
                ))
            };
        }

        if let Some(parent) = source.parent() {
            sync_parent_directory(parent);
        }
        read_text_for(registry, workspace_id, target_path)
    }

    #[cfg(not(windows))]
    {
        let current_bytes = read_supported_bytes(&source)?;
        if version_for(&current_bytes) != expected_version {
            return Err(DocumentError::conflict());
        }

        let latest_bytes = read_supported_bytes(&source)?;
        if version_for(&latest_bytes) != expected_version {
            return Err(DocumentError::conflict());
        }

        if let Err(error) = rename_no_clobber(&source, &target) {
            return if error.kind() == io::ErrorKind::AlreadyExists {
                Err(DocumentError::new(
                    "document_already_exists",
                    "同名文档已存在，未覆盖目标。",
                ))
            } else {
                Err(DocumentError::new(
                    "document_rename_failed",
                    "重命名失败，原文件保持不变。",
                ))
            };
        }

        if let Some(parent) = source.parent() {
            sync_parent_directory(parent);
        }

        read_text_for(registry, workspace_id, target_path)
    }
}

#[cfg(windows)]
#[allow(dead_code)]
fn rename_no_clobber(source: &Path, target: &Path) -> io::Result<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{MoveFileExW, MOVEFILE_WRITE_THROUGH};

    let source_wide: Vec<u16> = source.as_os_str().encode_wide().chain(Some(0)).collect();
    let target_wide: Vec<u16> = target.as_os_str().encode_wide().chain(Some(0)).collect();
    let succeeded = unsafe {
        MoveFileExW(
            source_wide.as_ptr(),
            target_wide.as_ptr(),
            MOVEFILE_WRITE_THROUGH,
        )
    };
    if succeeded == 0 {
        Err(io::Error::last_os_error())
    } else {
        Ok(())
    }
}

#[cfg(not(windows))]
fn rename_no_clobber(source: &Path, target: &Path) -> io::Result<()> {
    fs::hard_link(source, target)?;
    if let Err(error) = fs::remove_file(source) {
        let _ = fs::remove_file(target);
        return Err(error);
    }
    Ok(())
}

fn resolve_new_text_path(
    registry: &WorkspaceRegistry,
    workspace_id: &str,
    relative_path: &str,
) -> Result<PathBuf, DocumentError> {
    let relative = Path::new(relative_path);
    if !is_supported_text_path(relative) {
        return Err(DocumentError::new(
            "document_type_unsupported",
            "当前只支持 Markdown 和 TXT 文件。",
        ));
    }

    registry
        .resolve_new_path(workspace_id, relative)
        .map_err(|error| {
            if error.code == "path_already_exists" {
                DocumentError::new("document_already_exists", "同名文档已存在，未覆盖目标。")
            } else {
                error.into()
            }
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

trait TrashProvider {
    fn trash(&self, path: &Path) -> Result<(), ()>;
}

struct SystemTrash;

impl TrashProvider for SystemTrash {
    fn trash(&self, path: &Path) -> Result<(), ()> {
        trash::delete(path).map_err(|_| ())
    }
}

#[cfg_attr(windows, allow(dead_code))]
fn trash_path_with_provider(
    path: &Path,
    expected_version: &str,
    provider: &dyn TrashProvider,
) -> Result<(), DocumentError> {
    let current_bytes = read_supported_bytes(path)?;
    if version_for(&current_bytes) != expected_version {
        return Err(DocumentError::conflict());
    }

    provider.trash(path).map_err(|_| {
        DocumentError::new(
            "document_trash_failed",
            "无法移入系统回收站，原文件未被永久删除。",
        )
    })
}

#[cfg_attr(windows, allow(dead_code))]
fn read_supported_bytes(path: &Path) -> Result<Vec<u8>, DocumentError> {
    let file = File::open(path)
        .map_err(|_| DocumentError::new("document_unavailable", "文件不存在或当前无法访问。"))?;
    read_supported_file(file)
}

fn read_supported_file(file: File) -> Result<Vec<u8>, DocumentError> {
    read_bounded_file(file).map_err(|error| {
        if error.kind() == io::ErrorKind::InvalidData {
            DocumentError::new("document_too_large", "文件超过当前 5 MiB 编辑上限。")
        } else {
            DocumentError::new("document_read_failed", "无法读取文件，请检查访问权限。")
        }
    })
}

fn replacement_bytes(current_bytes: &[u8], content: &str) -> Result<Vec<u8>, DocumentError> {
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
    Ok(replacement)
}

fn read_bounded_file(file: File) -> io::Result<Vec<u8>> {
    let mut file = file;
    file.seek(SeekFrom::Start(0))?;
    let metadata = file.metadata()?;
    if metadata.len() > MAX_TEXT_FILE_BYTES {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "document exceeds the editing limit",
        ));
    }

    let mut bytes = Vec::with_capacity(metadata.len() as usize);
    file.take(MAX_TEXT_FILE_BYTES + 1).read_to_end(&mut bytes)?;
    if bytes.len() as u64 > MAX_TEXT_FILE_BYTES {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "document grew beyond the editing limit",
        ));
    }
    Ok(bytes)
}

#[cfg(windows)]
#[derive(Clone, Copy)]
enum SecureAccess {
    Read,
    Write,
    Rename,
    Trash,
}

#[cfg(windows)]
fn open_secure_document(
    path: &Path,
    root: &Path,
    access: SecureAccess,
) -> Result<File, DocumentError> {
    let mut options = OpenOptions::new();
    options.read(true);

    let share_mode = match access {
        SecureAccess::Read | SecureAccess::Trash => {
            FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE
        }
        SecureAccess::Write | SecureAccess::Rename => FILE_SHARE_READ,
    };
    options.share_mode(share_mode);
    options.custom_flags(FILE_FLAG_OPEN_REPARSE_POINT);

    if matches!(access, SecureAccess::Write) {
        options.write(true);
        options.custom_flags(FILE_FLAG_OPEN_REPARSE_POINT | FILE_FLAG_WRITE_THROUGH);
    } else if matches!(access, SecureAccess::Rename | SecureAccess::Trash) {
        options.access_mode(GENERIC_READ | DELETE);
    }

    let file = options
        .open(path)
        .map_err(|_| DocumentError::new("document_unavailable", "文件不存在或当前无法访问。"))?;
    validate_secure_handle(&file, root)?;
    Ok(file)
}

#[cfg(windows)]
fn open_secure_new_document(path: &Path, root: &Path) -> Result<File, DocumentError> {
    let mut options = OpenOptions::new();
    options
        .write(true)
        .create_new(true)
        .share_mode(FILE_SHARE_READ | FILE_SHARE_WRITE)
        .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT | FILE_FLAG_WRITE_THROUGH)
        .access_mode(GENERIC_WRITE | DELETE);

    let file = options.open(path).map_err(|error| {
        if error.kind() == io::ErrorKind::AlreadyExists {
            DocumentError::new("document_already_exists", "同名文档已存在，未覆盖目标。")
        } else {
            DocumentError::new(
                "document_create_failed",
                "无法新建文档，请检查目标文件夹权限。",
            )
        }
    })?;

    if let Err(error) = validate_secure_handle(&file, root) {
        let _ = delete_file_by_handle(&file);
        return Err(error);
    }
    Ok(file)
}

#[cfg(windows)]
fn open_secure_directory(path: &Path, root: &Path) -> Result<File, DocumentError> {
    let mut options = OpenOptions::new();
    options
        .read(true)
        .share_mode(FILE_SHARE_READ | FILE_SHARE_WRITE)
        .custom_flags(FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT);
    let directory = options
        .open(path)
        .map_err(|_| DocumentError::new("path_unavailable", "目标文件夹不存在或无法访问。"))?;
    validate_secure_handle(&directory, root)?;
    Ok(directory)
}

#[cfg(windows)]
fn validate_secure_handle(file: &File, root: &Path) -> Result<(), DocumentError> {
    let mut tag_info = FILE_ATTRIBUTE_TAG_INFO::default();
    let tag_info_ok = unsafe {
        GetFileInformationByHandleEx(
            file.as_raw_handle(),
            FileAttributeTagInfo,
            (&mut tag_info as *mut FILE_ATTRIBUTE_TAG_INFO).cast(),
            std::mem::size_of::<FILE_ATTRIBUTE_TAG_INFO>() as u32,
        )
    };
    if tag_info_ok == 0 {
        return Err(DocumentError::new(
            "path_unavailable",
            "无法确认目标路径是否安全。",
        ));
    }
    if tag_info.FileAttributes & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
        return Err(DocumentError::new(
            "path_symlink_unsupported",
            "文档路径不能经过符号链接。",
        ));
    }

    let final_path = final_path_by_handle(file)
        .map_err(|_| DocumentError::new("path_unavailable", "无法确认目标路径是否安全。"))?;
    let root_value = normalize_windows_path(root);
    let final_value = normalize_windows_path(&final_path);
    if final_value != root_value && !final_value.starts_with(&(root_value.clone() + "\\")) {
        return Err(DocumentError::new(
            "path_outside_workspace",
            "目标路径不在已授权工作区内。",
        ));
    }

    if final_value.len() > root_value.len() {
        let relative = &final_value[root_value.len() + 1..];
        if crate::workspace::has_internal_component(Path::new(relative)) {
            return Err(DocumentError::new(
                "path_internal_reserved",
                "不能访问工作区内部目录。",
            ));
        }
    }
    Ok(())
}

#[cfg(windows)]
fn final_path_by_handle(file: &File) -> io::Result<PathBuf> {
    let mut buffer = vec![0u16; 512];
    loop {
        let length = unsafe {
            GetFinalPathNameByHandleW(
                file.as_raw_handle(),
                buffer.as_mut_ptr(),
                buffer.len() as u32,
                FILE_NAME_NORMALIZED,
            )
        };
        if length == 0 {
            return Err(io::Error::last_os_error());
        }
        if length < buffer.len() as u32 {
            return Ok(PathBuf::from(OsString::from_wide(
                &buffer[..length as usize],
            )));
        }
        buffer.resize(buffer.len() * 2, 0);
    }
}

#[cfg(windows)]
fn normalize_windows_path(path: &Path) -> String {
    let mut value = path.as_os_str().to_string_lossy().replace('/', "\\");
    if let Some(rest) = value.strip_prefix(r"\\?\UNC\") {
        value = format!(r"\\{rest}");
    } else if let Some(rest) = value.strip_prefix(r"\\?\") {
        value = rest.to_owned();
    }
    value.trim_end_matches('\\').to_ascii_lowercase()
}

#[cfg(windows)]
fn rename_by_handle_no_clobber(source: &File, _parent: &File, target: &Path) -> io::Result<()> {
    let target_wide = target.as_os_str().encode_wide().collect::<Vec<_>>();
    let file_name_offset = std::mem::offset_of!(FILE_RENAME_INFO, FileName);
    let buffer_size = file_name_offset
        .checked_add(target_wide.len() * std::mem::size_of::<u16>())
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "rename target is too long"))?;
    let mut buffer = vec![0u8; buffer_size];
    let info = buffer.as_mut_ptr().cast::<FILE_RENAME_INFO>();

    unsafe {
        (*info).Anonymous.ReplaceIfExists = false;
        (*info).RootDirectory = std::ptr::null_mut();
        (*info).FileNameLength = (target_wide.len() * std::mem::size_of::<u16>()) as u32;
        std::ptr::copy_nonoverlapping(
            target_wide.as_ptr(),
            (*info).FileName.as_mut_ptr(),
            target_wide.len(),
        );
        if SetFileInformationByHandle(
            source.as_raw_handle(),
            FileRenameInfo,
            info.cast(),
            buffer.len() as u32,
        ) == 0
        {
            return Err(io::Error::last_os_error());
        }
    }
    Ok(())
}

#[cfg(windows)]
fn is_already_exists_error(error: &io::Error) -> bool {
    error.kind() == io::ErrorKind::AlreadyExists || error.raw_os_error() == Some(183)
}

#[cfg(windows)]
fn delete_file_by_handle(file: &File) -> io::Result<()> {
    let disposition = FILE_DISPOSITION_INFO { DeleteFile: true };
    let succeeded = unsafe {
        SetFileInformationByHandle(
            file.as_raw_handle(),
            FileDispositionInfo,
            (&disposition as *const FILE_DISPOSITION_INFO).cast(),
            std::mem::size_of::<FILE_DISPOSITION_INFO>() as u32,
        )
    };
    if succeeded == 0 {
        Err(io::Error::last_os_error())
    } else {
        Ok(())
    }
}

#[cfg(windows)]
fn write_through_handle(
    file: &mut File,
    replacement: &[u8],
    expected_version: &str,
) -> Result<(), DocumentError> {
    let latest_bytes = read_supported_file(file.try_clone().map_err(|_| {
        DocumentError::new("document_read_failed", "无法读取文件，请检查访问权限。")
    })?)?;
    if version_for(&latest_bytes) != expected_version {
        return Err(DocumentError::conflict());
    }

    file.seek(SeekFrom::Start(0))
        .map_err(|_| DocumentError::new("document_write_failed", "保存失败，原文件未被覆盖。"))?;
    file.set_len(0)
        .map_err(|_| DocumentError::new("document_write_failed", "保存失败，原文件未被覆盖。"))?;
    file.write_all(replacement)
        .map_err(|_| DocumentError::new("document_write_failed", "保存失败，原文件未被覆盖。"))?;
    file.sync_all()
        .map_err(|_| DocumentError::new("document_write_failed", "保存失败，原文件未被覆盖。"))?;
    Ok(())
}

#[cfg(windows)]
fn trash_path_with_secure_handles(
    path: &Path,
    file: File,
    _parent: File,
    expected_version: &str,
    provider: &dyn TrashProvider,
) -> Result<(), DocumentError> {
    let current_bytes = read_supported_file(file.try_clone().map_err(|_| {
        DocumentError::new("document_read_failed", "无法读取文件，请检查访问权限。")
    })?)?;
    if version_for(&current_bytes) != expected_version {
        return Err(DocumentError::conflict());
    }

    provider.trash(path).map_err(|_| {
        DocumentError::new(
            "document_trash_failed",
            "无法移入系统回收站，原文件未被永久删除。",
        )
    })
}

#[cfg_attr(windows, allow(dead_code))]
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

        let latest_bytes = read_bounded_file(File::open(path)?)?;
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
#[allow(dead_code)]
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
    crate::workspace::has_internal_component(Path::new(name))
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
        fs::create_dir_all(directory.0.join(".GIT")).expect("create git directory");
        fs::write(directory.0.join("README.md"), "# readme\n").expect("write markdown");
        fs::write(directory.0.join("子目录").join("说明.txt"), "说明\n").expect("write text");
        fs::write(directory.0.join("image.png"), b"not an image").expect("write image fixture");
        fs::write(directory.0.join(".GIT").join("hidden.md"), "hidden\n")
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
    fn rejects_documents_larger_than_the_bounded_read_limit() {
        let directory = TestDirectory::new("read-limit");
        let path = directory.0.join("large.md");
        let file = File::create(&path).expect("create sparse oversized fixture");
        file.set_len(MAX_TEXT_FILE_BYTES + 1)
            .expect("extend oversized fixture");
        let (registry, workspace_id) = directory.registry();

        let error = read_text_for(&registry, &workspace_id, "large.md")
            .expect_err("oversized document must be rejected");

        assert_eq!(error.code, "document_too_large");
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

    #[test]
    fn explicit_document_operations_reject_internal_and_alternate_stream_paths() {
        let directory = TestDirectory::new("strict-paths");
        fs::create_dir_all(directory.0.join(".git")).expect("create internal directory");
        fs::write(directory.0.join(".git").join("hidden.md"), "hidden\n")
            .expect("write hidden fixture");
        let (registry, workspace_id) = directory.registry();

        let internal = read_text_for(&registry, &workspace_id, ".git/hidden.md")
            .expect_err("explicit internal read must be rejected");
        assert_eq!(internal.code, "path_internal_reserved");

        let internal_create = create_text_for(&registry, &workspace_id, "TARGET/new.md")
            .expect_err("case-insensitive internal create must be rejected");
        assert_eq!(internal_create.code, "path_internal_reserved");

        let alternate_stream = create_text_for(&registry, &workspace_id, "note.md:secret.md")
            .expect_err("alternate data stream must be rejected");
        assert_eq!(alternate_stream.code, "path_alternate_stream_unsupported");
    }

    #[test]
    fn creates_empty_unicode_document_without_clobbering_collisions() {
        let directory = TestDirectory::new("create");
        fs::create_dir_all(directory.0.join("子目录")).expect("create nested directory");
        let existing = directory.0.join("子目录").join("已有.txt");
        fs::write(&existing, "保留\n").expect("write existing fixture");
        let (registry, workspace_id) = directory.registry();

        let created = create_text_for(&registry, &workspace_id, "子目录/新建😀.md")
            .expect("create unicode document");
        assert_eq!(created.path, "子目录/新建😀.md");
        assert_eq!(created.content, "");
        assert_eq!(created.version, version_for(&[]));
        assert!(!created.has_utf8_bom);
        assert_eq!(created.line_ending, "lf");
        assert_eq!(
            fs::read(directory.0.join("子目录").join("新建😀.md")).expect("read created file"),
            Vec::<u8>::new()
        );

        let collision = create_text_for(&registry, &workspace_id, "子目录/已有.txt")
            .expect_err("collision must not clobber");
        assert_eq!(collision.code, "document_already_exists");
        assert_eq!(
            fs::read_to_string(existing).expect("read collision target"),
            "保留\n"
        );
    }

    #[test]
    fn renames_unicode_document_without_overwriting_a_collision() {
        let directory = TestDirectory::new("rename");
        let source = directory.0.join("原文.md");
        let collision = directory.0.join("已存在.md");
        fs::write(&source, "原始内容\n").expect("write source");
        fs::write(&collision, "目标内容\n").expect("write collision");
        let (registry, workspace_id) = directory.registry();
        let document = read_text_for(&registry, &workspace_id, "原文.md").expect("read source");

        let collision_error = rename_document_for(
            &registry,
            &workspace_id,
            "原文.md",
            "已存在.md",
            &document.version,
        )
        .expect_err("rename collision must fail");
        assert_eq!(collision_error.code, "document_already_exists");
        assert_eq!(
            fs::read_to_string(&source).expect("read unchanged source"),
            "原始内容\n"
        );
        assert_eq!(
            fs::read_to_string(&collision).expect("read unchanged target"),
            "目标内容\n"
        );

        let renamed = rename_document_for(
            &registry,
            &workspace_id,
            "原文.md",
            "重命名😀.txt",
            &document.version,
        )
        .expect("rename unicode document");
        assert_eq!(renamed.path, "重命名😀.txt");
        assert_eq!(renamed.content, "原始内容\n");
        assert!(!source.exists());
        assert_eq!(
            fs::read_to_string(directory.0.join("重命名😀.txt")).expect("read renamed document"),
            "原始内容\n"
        );
    }

    #[test]
    fn stale_rename_never_moves_or_loses_the_external_version() {
        let directory = TestDirectory::new("rename-stale");
        let source = directory.0.join("note.md");
        fs::write(&source, "original\n").expect("write source");
        let (registry, workspace_id) = directory.registry();
        let document = read_text_for(&registry, &workspace_id, "note.md").expect("read source");
        fs::write(&source, "external\n").expect("write external version");

        let error = rename_document_for(
            &registry,
            &workspace_id,
            "note.md",
            "renamed.md",
            &document.version,
        )
        .expect_err("stale rename must fail");
        assert_eq!(error.code, "document_conflict");
        assert_eq!(
            fs::read_to_string(&source).expect("read current source"),
            "external\n"
        );
        assert!(!directory.0.join("renamed.md").exists());
    }

    #[test]
    fn rename_rejects_cross_directory_moves() {
        let directory = TestDirectory::new("rename-cross-directory");
        fs::create_dir_all(directory.0.join("first")).expect("create source directory");
        fs::create_dir_all(directory.0.join("second")).expect("create target directory");
        let source = directory.0.join("first").join("note.md");
        fs::write(&source, "content\n").expect("write source");
        let (registry, workspace_id) = directory.registry();
        let document =
            read_text_for(&registry, &workspace_id, "first/note.md").expect("read source");

        let error = rename_document_for(
            &registry,
            &workspace_id,
            "first/note.md",
            "second/note.md",
            &document.version,
        )
        .expect_err("cross-directory move must be rejected");

        assert_eq!(error.code, "document_cross_directory_unsupported");
        assert_eq!(
            fs::read_to_string(&source).expect("read preserved source"),
            "content\n"
        );
        assert!(!directory.0.join("second").join("note.md").exists());
    }

    #[test]
    fn rename_primitive_never_clobbers_an_existing_target() {
        let directory = TestDirectory::new("rename-primitive-collision");
        let source = directory.0.join("source.md");
        let target = directory.0.join("target.md");
        fs::write(&source, "source\n").expect("write source");
        fs::write(&target, "target\n").expect("write target");

        let error = rename_no_clobber(&source, &target).expect_err("primitive collision must fail");

        assert_eq!(error.kind(), io::ErrorKind::AlreadyExists);
        assert_eq!(
            fs::read_to_string(source).expect("read preserved source"),
            "source\n"
        );
        assert_eq!(
            fs::read_to_string(target).expect("read preserved target"),
            "target\n"
        );
    }

    struct FailingTrash {
        calls: AtomicU64,
    }

    impl FailingTrash {
        fn new() -> Self {
            Self {
                calls: AtomicU64::new(0),
            }
        }
    }

    impl TrashProvider for FailingTrash {
        fn trash(&self, _path: &Path) -> Result<(), ()> {
            self.calls.fetch_add(1, Ordering::Relaxed);
            Err(())
        }
    }

    #[test]
    fn stale_trash_is_rejected_before_the_provider_runs() {
        let directory = TestDirectory::new("trash-stale");
        let path = directory.0.join("note.md");
        fs::write(&path, "original\n").expect("write fixture");
        let (registry, workspace_id) = directory.registry();
        let document = read_text_for(&registry, &workspace_id, "note.md").expect("read fixture");
        fs::write(&path, "external\n").expect("write external version");
        let provider = FailingTrash::new();

        let error = trash_path_with_provider(&path, &document.version, &provider)
            .expect_err("stale trash must fail");
        assert_eq!(error.code, "document_conflict");
        assert_eq!(provider.calls.load(Ordering::Relaxed), 0);
        assert_eq!(
            fs::read_to_string(path).expect("read preserved fixture"),
            "external\n"
        );
    }

    #[test]
    fn trash_provider_failure_never_falls_back_to_permanent_delete() {
        let directory = TestDirectory::new("trash-failure");
        let path = directory.0.join("note.md");
        fs::write(&path, "keep me\n").expect("write fixture");
        let bytes = fs::read(&path).expect("read fixture");
        let provider = FailingTrash::new();

        let error = trash_path_with_provider(&path, &version_for(&bytes), &provider)
            .expect_err("provider failure must surface");
        assert_eq!(error.code, "document_trash_failed");
        assert_eq!(provider.calls.load(Ordering::Relaxed), 1);
        assert_eq!(
            fs::read_to_string(path).expect("read preserved fixture"),
            "keep me\n"
        );
    }
}
