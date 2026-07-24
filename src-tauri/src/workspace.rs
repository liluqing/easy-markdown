use serde::Serialize;
use std::{
    ffi::OsStr,
    fs, io,
    path::{Component, Path, PathBuf},
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
};
use tauri::State;

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceInfo {
    pub(crate) id: String,
    pub(crate) name: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceError {
    pub(crate) code: &'static str,
    pub(crate) message: &'static str,
}

impl WorkspaceError {
    pub(crate) const fn new(code: &'static str, message: &'static str) -> Self {
        Self { code, message }
    }

    fn registry_unavailable() -> Self {
        Self::new(
            "workspace_registry_unavailable",
            "工作区注册表暂时不可用，请重试。",
        )
    }
}

#[derive(Default)]
pub struct WorkspaceRegistry {
    next_id: AtomicU64,
    active: Mutex<Option<ActiveWorkspace>>,
}

struct ActiveWorkspace {
    id: String,
    root: PathBuf,
}

pub(crate) struct PreparedWorkspace {
    info: WorkspaceInfo,
    root: PathBuf,
}

pub(crate) struct PreviousWorkspace(Option<ActiveWorkspace>);

impl PreparedWorkspace {
    pub(crate) fn id(&self) -> &str {
        &self.info.id
    }

    pub(crate) fn root(&self) -> &Path {
        &self.root
    }
}

impl WorkspaceRegistry {
    #[cfg_attr(not(test), allow(dead_code))]
    pub(crate) fn register(&self, selected_path: PathBuf) -> Result<WorkspaceInfo, WorkspaceError> {
        let prepared = self.prepare(selected_path)?;
        let (info, _) = self.activate(prepared)?;
        Ok(info)
    }

    pub(crate) fn prepare(
        &self,
        selected_path: PathBuf,
    ) -> Result<PreparedWorkspace, WorkspaceError> {
        let root = selected_path.canonicalize().map_err(|_| {
            WorkspaceError::new("workspace_unavailable", "所选工作区不存在或当前无法访问。")
        })?;

        if !root.is_dir() {
            return Err(WorkspaceError::new(
                "workspace_not_directory",
                "请选择一个文件夹作为工作区。",
            ));
        }

        let name = root
            .file_name()
            .filter(|name| !name.is_empty())
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_else(|| "工作区".to_owned());
        let id = format!(
            "workspace-{}",
            self.next_id.fetch_add(1, Ordering::Relaxed) + 1
        );

        Ok(PreparedWorkspace {
            info: WorkspaceInfo { id, name },
            root,
        })
    }

    pub(crate) fn activate(
        &self,
        prepared: PreparedWorkspace,
    ) -> Result<(WorkspaceInfo, PreviousWorkspace), WorkspaceError> {
        let info = prepared.info;
        let active = ActiveWorkspace {
            id: info.id.clone(),
            root: prepared.root,
        };
        let previous = self
            .active
            .lock()
            .map_err(|_| WorkspaceError::registry_unavailable())?
            .replace(active);

        Ok((info, PreviousWorkspace(previous)))
    }

    pub(crate) fn restore(&self, previous: PreviousWorkspace) -> Result<(), WorkspaceError> {
        *self
            .active
            .lock()
            .map_err(|_| WorkspaceError::registry_unavailable())? = previous.0;
        Ok(())
    }

    pub(crate) fn root_for(&self, workspace_id: &str) -> Result<PathBuf, WorkspaceError> {
        self.active
            .lock()
            .map_err(|_| WorkspaceError::registry_unavailable())?
            .as_ref()
            .filter(|active| active.id == workspace_id)
            .map(|active| active.root.clone())
            .ok_or_else(|| WorkspaceError::new("workspace_unknown", "工作区已关闭或尚未打开。"))
    }

    #[cfg_attr(not(test), allow(dead_code))]
    pub fn resolve_existing_path(
        &self,
        workspace_id: &str,
        relative_path: &Path,
    ) -> Result<PathBuf, WorkspaceError> {
        validate_relative_path(relative_path)?;
        let root = self.root_for(workspace_id)?;
        reject_symlink_components(&root, relative_path, false)?;

        let resolved = root.join(relative_path).canonicalize().map_err(|_| {
            WorkspaceError::new("path_unavailable", "目标文件或目录不存在或无法访问。")
        })?;

        if !resolved.starts_with(&root) {
            return Err(WorkspaceError::new(
                "path_outside_workspace",
                "目标路径不在已授权工作区内。",
            ));
        }
        let canonical_relative = resolved.strip_prefix(&root).map_err(|_| {
            WorkspaceError::new("path_outside_workspace", "目标路径不在已授权工作区内。")
        })?;
        if has_internal_component(canonical_relative) {
            return Err(WorkspaceError::new(
                "path_internal_reserved",
                "不能访问工作区内部目录。",
            ));
        }

        Ok(resolved)
    }

    pub(crate) fn resolve_new_path(
        &self,
        workspace_id: &str,
        relative_path: &Path,
    ) -> Result<PathBuf, WorkspaceError> {
        validate_relative_path(relative_path)?;

        let file_name = relative_path
            .file_name()
            .ok_or_else(|| WorkspaceError::new("path_invalid", "路径必须指向工作区内的文件。"))?;
        let root = self.root_for(workspace_id)?;
        reject_symlink_components(&root, relative_path, true)?;
        let relative_parent = relative_path
            .parent()
            .filter(|parent| !parent.as_os_str().is_empty())
            .unwrap_or_else(|| Path::new("."));
        let parent = root.join(relative_parent).canonicalize().map_err(|_| {
            WorkspaceError::new("path_parent_unavailable", "目标文件夹不存在或无法访问。")
        })?;

        if !parent.starts_with(&root) {
            return Err(WorkspaceError::new(
                "path_outside_workspace",
                "目标路径不在已授权工作区内。",
            ));
        }
        let canonical_parent = parent.strip_prefix(&root).map_err(|_| {
            WorkspaceError::new("path_outside_workspace", "目标路径不在已授权工作区内。")
        })?;
        if has_internal_component(canonical_parent) {
            return Err(WorkspaceError::new(
                "path_internal_reserved",
                "不能访问工作区内部目录。",
            ));
        }
        if !parent.is_dir() {
            return Err(WorkspaceError::new(
                "path_parent_not_directory",
                "目标文件夹不存在或不是目录。",
            ));
        }

        let target = parent.join(file_name);
        match target.symlink_metadata() {
            Ok(_) => Err(WorkspaceError::new(
                "path_already_exists",
                "目标路径已存在。",
            )),
            Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(target),
            Err(_) => Err(WorkspaceError::new(
                "path_unavailable",
                "无法确认目标路径是否可用。",
            )),
        }
    }
}

fn validate_relative_path(relative_path: &Path) -> Result<(), WorkspaceError> {
    if relative_path.is_absolute()
        || relative_path.components().any(|component| {
            matches!(
                component,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        })
    {
        return Err(WorkspaceError::new(
            "path_invalid",
            "路径必须是工作区内不含父级穿越的相对路径。",
        ));
    }

    if relative_path.components().any(|component| {
        matches!(
            component,
            Component::Normal(name) if name.to_string_lossy().contains(':')
        )
    }) {
        return Err(WorkspaceError::new(
            "path_alternate_stream_unsupported",
            "路径不能包含备用数据流分隔符。",
        ));
    }

    if has_internal_component(relative_path) {
        return Err(WorkspaceError::new(
            "path_internal_reserved",
            "不能访问工作区内部目录。",
        ));
    }

    Ok(())
}

fn reject_symlink_components(
    root: &Path,
    relative_path: &Path,
    allow_missing_final: bool,
) -> Result<(), WorkspaceError> {
    let normal_components = relative_path
        .components()
        .filter_map(|component| match component {
            Component::Normal(name) => Some(name),
            _ => None,
        })
        .collect::<Vec<_>>();
    let mut current = root.to_path_buf();

    for (index, component) in normal_components.iter().enumerate() {
        current.push(component);
        match current.symlink_metadata() {
            Ok(metadata) if is_link_like(&metadata) => {
                return Err(WorkspaceError::new(
                    "path_symlink_unsupported",
                    "文档路径不能经过符号链接。",
                ));
            }
            Ok(_) => {}
            Err(error)
                if allow_missing_final
                    && index + 1 == normal_components.len()
                    && error.kind() == io::ErrorKind::NotFound => {}
            Err(error)
                if allow_missing_final
                    && index + 1 < normal_components.len()
                    && error.kind() == io::ErrorKind::NotFound =>
            {
                return Err(WorkspaceError::new(
                    "path_parent_unavailable",
                    "目标文件夹不存在或无法访问。",
                ));
            }
            Err(_) => {
                return Err(WorkspaceError::new(
                    "path_unavailable",
                    "目标文件或目录不存在或无法访问。",
                ));
            }
        }
    }

    Ok(())
}

#[cfg(windows)]
pub(crate) fn is_link_like(metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    use windows_sys::Win32::Storage::FileSystem::FILE_ATTRIBUTE_REPARSE_POINT;

    metadata.file_type().is_symlink()
        || metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

#[cfg(not(windows))]
pub(crate) fn is_link_like(metadata: &fs::Metadata) -> bool {
    metadata.file_type().is_symlink()
}

pub(crate) fn has_internal_component(path: &Path) -> bool {
    path.components()
        .any(|component| matches!(component, Component::Normal(name) if is_internal_name(name)))
}

fn is_internal_name(name: &OsStr) -> bool {
    let display = name.to_string_lossy();
    let normalized = display.trim_end_matches(['.', ' ']);
    [".git", ".easy-markdown", "node_modules", "target", "dist"]
        .iter()
        .any(|reserved| normalized.eq_ignore_ascii_case(reserved))
}

#[tauri::command]
pub async fn open_workspace(
    registry: State<'_, WorkspaceRegistry>,
    watchers: State<'_, crate::watcher::WatchRegistry>,
    app_handle: tauri::AppHandle,
) -> Result<Option<WorkspaceInfo>, WorkspaceError> {
    let selected_path = rfd::AsyncFileDialog::new()
        .set_title("选择 Easy Markdown 工作区")
        .pick_folder()
        .await;

    let Some(selected_path) = selected_path else {
        return Ok(None);
    };

    let prepared_workspace = registry.prepare(selected_path.path().to_owned())?;
    let prepared_watcher = watchers
        .prepare(
            prepared_workspace.id().to_owned(),
            prepared_workspace.root().to_owned(),
            app_handle,
        )
        .map_err(|_| {
            WorkspaceError::new(
                "workspace_watch_unavailable",
                "无法启动实时文件监听，请重试。",
            )
        })?;
    let (info, previous_workspace) = registry.activate(prepared_workspace)?;

    if watchers.activate(prepared_watcher).is_err() {
        registry.restore(previous_workspace)?;
        return Err(WorkspaceError::new(
            "workspace_watch_unavailable",
            "无法切换实时文件监听，请重试。",
        ));
    }

    Ok(Some(info))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        fs,
        sync::atomic::{AtomicU64, Ordering},
    };

    static NEXT_TEST_DIRECTORY: AtomicU64 = AtomicU64::new(1);

    struct TestDirectory(PathBuf);

    impl TestDirectory {
        fn new(name: &str) -> Self {
            let unique = NEXT_TEST_DIRECTORY.fetch_add(1, Ordering::Relaxed);
            let path = std::env::temp_dir().join(format!(
                "easy-markdown-workspace-{name}-{}-{unique}",
                std::process::id()
            ));
            fs::create_dir_all(&path).expect("create test directory");
            Self(path)
        }
    }

    impl Drop for TestDirectory {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn registers_a_directory_without_exposing_its_absolute_path() {
        let directory = TestDirectory::new("中文 空格");
        let registry = WorkspaceRegistry::default();

        let info = registry
            .register(directory.0.clone())
            .expect("register workspace");

        assert!(info.name.starts_with("easy-markdown-workspace-中文 空格-"));
        assert!(info.id.starts_with("workspace-"));

        let serialized = serde_json::to_string(&info).expect("serialize workspace info");
        assert!(!serialized.contains(&directory.0.to_string_lossy().to_string()));
    }

    #[test]
    fn rejects_files_as_workspace_roots() {
        let directory = TestDirectory::new("file-root");
        let file = directory.0.join("note.md");
        fs::write(&file, "# note\n").expect("write fixture");

        let error = WorkspaceRegistry::default()
            .register(file)
            .expect_err("file root must be rejected");

        assert_eq!(error.code, "workspace_not_directory");
    }

    #[test]
    fn resolves_existing_paths_inside_registered_workspace() {
        let directory = TestDirectory::new("inside");
        fs::create_dir_all(directory.0.join("子目录")).expect("create nested directory");
        fs::write(directory.0.join("子目录").join("文档.md"), "内容\n").expect("write fixture");
        let registry = WorkspaceRegistry::default();
        let info = registry
            .register(directory.0.clone())
            .expect("register workspace");

        let resolved = registry
            .resolve_existing_path(&info.id, Path::new("子目录/文档.md"))
            .expect("resolve inside path");

        assert_eq!(
            resolved,
            directory
                .0
                .join("子目录")
                .join("文档.md")
                .canonicalize()
                .expect("canonical fixture")
        );
    }

    #[test]
    fn rejects_absolute_and_parent_traversal_paths() {
        let directory = TestDirectory::new("traversal");
        let registry = WorkspaceRegistry::default();
        let info = registry
            .register(directory.0.clone())
            .expect("register workspace");

        for path in [Path::new("../outside.md"), directory.0.as_path()] {
            let error = registry
                .resolve_existing_path(&info.id, path)
                .expect_err("unsafe path must be rejected");
            assert_eq!(error.code, "path_invalid");
        }
    }

    #[test]
    fn rejects_unknown_workspace_handles() {
        let error = WorkspaceRegistry::default()
            .resolve_existing_path("workspace-missing", Path::new("note.md"))
            .expect_err("unknown workspace must be rejected");

        assert_eq!(error.code, "workspace_unknown");
    }

    #[test]
    fn activating_a_new_workspace_revokes_the_previous_handle() {
        let first = TestDirectory::new("first");
        let second = TestDirectory::new("second");
        fs::write(first.0.join("first.md"), "first\n").expect("write first fixture");
        fs::write(second.0.join("second.md"), "second\n").expect("write second fixture");
        let registry = WorkspaceRegistry::default();
        let first_info = registry
            .register(first.0.clone())
            .expect("register first workspace");
        let second_info = registry
            .register(second.0.clone())
            .expect("register second workspace");

        let error = registry
            .resolve_existing_path(&first_info.id, Path::new("first.md"))
            .expect_err("old handle must be revoked");
        assert_eq!(error.code, "workspace_unknown");
        registry
            .resolve_existing_path(&second_info.id, Path::new("second.md"))
            .expect("new handle remains active");
    }

    #[test]
    fn rejects_internal_document_components_case_insensitively() {
        let directory = TestDirectory::new("internal");
        for name in [
            ".git",
            ".GIT",
            ".easy-markdown",
            "NODE_MODULES",
            "target",
            "Dist",
        ] {
            fs::create_dir_all(directory.0.join(name)).expect("create internal directory");
            fs::write(directory.0.join(name).join("hidden.md"), "fixture\n")
                .expect("write internal fixture");
        }
        let registry = WorkspaceRegistry::default();
        let info = registry
            .register(directory.0.clone())
            .expect("register workspace");

        for path in [
            ".git/hidden.md",
            ".GIT/hidden.md",
            ".easy-markdown/hidden.md",
            "NODE_MODULES/hidden.md",
            "target/hidden.md",
            "Dist/hidden.md",
        ] {
            let error = registry
                .resolve_existing_path(&info.id, Path::new(path))
                .expect_err("internal path must be rejected");
            assert_eq!(error.code, "path_internal_reserved", "{path}");
        }
    }

    #[test]
    fn resolves_new_paths_only_under_existing_safe_parents() {
        let directory = TestDirectory::new("new-path");
        fs::create_dir_all(directory.0.join("子目录")).expect("create nested directory");
        let registry = WorkspaceRegistry::default();
        let info = registry
            .register(directory.0.clone())
            .expect("register workspace");

        let resolved = registry
            .resolve_new_path(&info.id, Path::new("子目录/新文档.md"))
            .expect("resolve new document path");
        assert_eq!(
            resolved,
            directory
                .0
                .join("子目录")
                .canonicalize()
                .expect("canonical parent")
                .join("新文档.md")
        );

        let missing_parent = registry
            .resolve_new_path(&info.id, Path::new("不存在/文档.md"))
            .expect_err("missing parent must be rejected");
        assert_eq!(missing_parent.code, "path_parent_unavailable");

        let internal = registry
            .resolve_new_path(&info.id, Path::new(".git/new.md"))
            .expect_err("internal target must be rejected");
        assert_eq!(internal.code, "path_internal_reserved");

        let alternate_stream = registry
            .resolve_new_path(&info.id, Path::new("note.md:secret.md"))
            .expect_err("alternate data stream syntax must be rejected");
        assert_eq!(alternate_stream.code, "path_alternate_stream_unsupported");
    }

    #[test]
    fn rejects_symbolic_links_that_escape_the_workspace() {
        let workspace = TestDirectory::new("symlink-root");
        let outside = TestDirectory::new("symlink-outside");
        fs::write(outside.0.join("secret.md"), "fixture\n").expect("write outside fixture");
        let link = workspace.0.join("outside-link");

        #[cfg(unix)]
        std::os::unix::fs::symlink(&outside.0, &link).expect("create directory symlink");

        #[cfg(windows)]
        if let Err(error) = std::os::windows::fs::symlink_dir(&outside.0, &link) {
            // Creating directory symlinks requires SeCreateSymbolicLinkPrivilege on
            // Windows. Keep the test green when the runner lacks that privilege;
            // the privileged path is covered on a security-enabled test host.
            if error.kind() == std::io::ErrorKind::PermissionDenied
                || error.raw_os_error() == Some(1314)
            {
                return;
            }
            panic!("create directory symlink: {error}");
        }

        let registry = WorkspaceRegistry::default();
        let info = registry
            .register(workspace.0.clone())
            .expect("register workspace");
        let error = registry
            .resolve_existing_path(&info.id, Path::new("outside-link/secret.md"))
            .expect_err("symlink escape must be rejected");

        assert_eq!(error.code, "path_symlink_unsupported");
    }

    #[test]
    fn rejects_symbolic_links_even_when_the_target_stays_inside_the_workspace() {
        let workspace = TestDirectory::new("symlink-inside");
        fs::create_dir_all(workspace.0.join("real")).expect("create real directory");
        fs::write(workspace.0.join("real").join("note.md"), "fixture\n").expect("write fixture");
        let link = workspace.0.join("alias");

        #[cfg(unix)]
        std::os::unix::fs::symlink(workspace.0.join("real"), &link)
            .expect("create directory symlink");

        #[cfg(windows)]
        if let Err(error) = std::os::windows::fs::symlink_dir(workspace.0.join("real"), &link) {
            if error.kind() == std::io::ErrorKind::PermissionDenied
                || error.raw_os_error() == Some(1314)
            {
                return;
            }
            panic!("create directory symlink: {error}");
        }

        let registry = WorkspaceRegistry::default();
        let info = registry
            .register(workspace.0.clone())
            .expect("register workspace");
        let error = registry
            .resolve_existing_path(&info.id, Path::new("alias/note.md"))
            .expect_err("symlinked document paths must be rejected");

        assert_eq!(error.code, "path_symlink_unsupported");
    }
}
