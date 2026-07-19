use serde::Serialize;
use std::{
    collections::HashMap,
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
    const fn new(code: &'static str, message: &'static str) -> Self {
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
    roots: Mutex<HashMap<String, PathBuf>>,
}

impl WorkspaceRegistry {
    pub(crate) fn register(&self, selected_path: PathBuf) -> Result<WorkspaceInfo, WorkspaceError> {
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

        self.roots
            .lock()
            .map_err(|_| WorkspaceError::registry_unavailable())?
            .insert(id.clone(), root);

        Ok(WorkspaceInfo { id, name })
    }

    #[cfg_attr(not(test), allow(dead_code))]
    pub fn resolve_existing_path(
        &self,
        workspace_id: &str,
        relative_path: &Path,
    ) -> Result<PathBuf, WorkspaceError> {
        validate_relative_path(relative_path)?;

        let root = self
            .roots
            .lock()
            .map_err(|_| WorkspaceError::registry_unavailable())?
            .get(workspace_id)
            .cloned()
            .ok_or_else(|| WorkspaceError::new("workspace_unknown", "工作区已关闭或尚未打开。"))?;

        let resolved = root.join(relative_path).canonicalize().map_err(|_| {
            WorkspaceError::new("path_unavailable", "目标文件或目录不存在或无法访问。")
        })?;

        if !resolved.starts_with(&root) {
            return Err(WorkspaceError::new(
                "path_outside_workspace",
                "目标路径不在已授权工作区内。",
            ));
        }

        Ok(resolved)
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

    Ok(())
}

#[tauri::command]
pub async fn open_workspace(
    registry: State<'_, WorkspaceRegistry>,
) -> Result<Option<WorkspaceInfo>, WorkspaceError> {
    let selected_path = rfd::AsyncFileDialog::new()
        .set_title("选择 Easy Markdown 工作区")
        .pick_folder()
        .await;

    let Some(selected_path) = selected_path else {
        return Ok(None);
    };

    registry.register(selected_path.path().to_owned()).map(Some)
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

        assert_eq!(error.code, "path_outside_workspace");
    }
}
