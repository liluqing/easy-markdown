use crate::workspace::has_internal_component;
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::{
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicU64, Ordering},
        mpsc::{self, Receiver, RecvTimeoutError, Sender},
        Arc, Mutex,
    },
    thread::{self, JoinHandle},
    time::Duration,
};
use tauri::Emitter;

const WATCH_DEBOUNCE: Duration = Duration::from_millis(250);
const DOCUMENTS_CHANGED_EVENT: &str = "workspace-documents-changed";
const WATCH_ERROR_EVENT: &str = "workspace-watch-error";

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WatchChangedPayload {
    workspace_id: String,
    revision: u64,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WatchErrorPayload {
    workspace_id: String,
    code: &'static str,
    message: &'static str,
}

#[derive(Debug)]
pub(crate) struct WatchRegistryError;

trait WatchEventSink: Send + Sync {
    fn documents_changed(&self, payload: WatchChangedPayload);
    fn watch_error(&self, payload: WatchErrorPayload);
}

struct TauriWatchEventSink(tauri::AppHandle);

impl WatchEventSink for TauriWatchEventSink {
    fn documents_changed(&self, payload: WatchChangedPayload) {
        let _ = self.0.emit(DOCUMENTS_CHANGED_EVENT, payload);
    }

    fn watch_error(&self, payload: WatchErrorPayload) {
        let _ = self.0.emit(WATCH_ERROR_EVENT, payload);
    }
}

enum WatchSignal {
    Changed,
    Error,
    Stop,
}

struct ActiveWatcher {
    watcher: Option<RecommendedWatcher>,
    signals: Sender<WatchSignal>,
    worker: Option<JoinHandle<()>>,
}

impl Drop for ActiveWatcher {
    fn drop(&mut self) {
        self.watcher.take();
        let _ = self.signals.send(WatchSignal::Stop);
        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
        }
    }
}

pub(crate) struct PreparedWatcher(ActiveWatcher);

pub(crate) struct WatchRegistry {
    active: Mutex<Option<ActiveWatcher>>,
    revision: Arc<AtomicU64>,
}

impl Default for WatchRegistry {
    fn default() -> Self {
        Self {
            active: Mutex::new(None),
            revision: Arc::new(AtomicU64::new(0)),
        }
    }
}

impl WatchRegistry {
    pub(crate) fn prepare(
        &self,
        workspace_id: String,
        root: PathBuf,
        app_handle: tauri::AppHandle,
    ) -> Result<PreparedWatcher, WatchRegistryError> {
        self.prepare_with_sink(
            workspace_id,
            root,
            Arc::new(TauriWatchEventSink(app_handle)),
        )
    }

    pub(crate) fn activate(&self, prepared: PreparedWatcher) -> Result<(), WatchRegistryError> {
        let previous = self
            .active
            .lock()
            .map_err(|_| WatchRegistryError)?
            .replace(prepared.0);
        drop(previous);
        Ok(())
    }

    fn prepare_with_sink(
        &self,
        workspace_id: String,
        root: PathBuf,
        sink: Arc<dyn WatchEventSink>,
    ) -> Result<PreparedWatcher, WatchRegistryError> {
        let (signals, receiver) = mpsc::channel();
        let callback_signals = signals.clone();
        let callback_root = root.clone();
        let mut watcher = notify::recommended_watcher(move |result: notify::Result<Event>| {
            let signal = match result {
                Ok(event) if is_relevant_event(&callback_root, &event) => {
                    Some(WatchSignal::Changed)
                }
                Ok(_) => None,
                Err(_) => Some(WatchSignal::Error),
            };
            if let Some(signal) = signal {
                let _ = callback_signals.send(signal);
            }
        })
        .map_err(|_| WatchRegistryError)?;

        watcher
            .watch(&root, RecursiveMode::Recursive)
            .map_err(|_| WatchRegistryError)?;

        let revision = Arc::clone(&self.revision);
        let worker = thread::Builder::new()
            .name("easy-markdown-workspace-watch".to_owned())
            .spawn(move || run_debounce_worker(receiver, workspace_id, revision, sink))
            .map_err(|_| WatchRegistryError)?;

        Ok(PreparedWatcher(ActiveWatcher {
            watcher: Some(watcher),
            signals,
            worker: Some(worker),
        }))
    }

    #[cfg(test)]
    fn replace_with_sink(
        &self,
        workspace_id: String,
        root: PathBuf,
        sink: Arc<dyn WatchEventSink>,
    ) -> Result<(), WatchRegistryError> {
        let prepared = self.prepare_with_sink(workspace_id, root, sink)?;
        self.activate(prepared)
    }
}

fn run_debounce_worker(
    receiver: Receiver<WatchSignal>,
    workspace_id: String,
    revision: Arc<AtomicU64>,
    sink: Arc<dyn WatchEventSink>,
) {
    loop {
        match receiver.recv() {
            Ok(WatchSignal::Changed) => loop {
                match receiver.recv_timeout(WATCH_DEBOUNCE) {
                    Ok(WatchSignal::Changed) => {}
                    Ok(WatchSignal::Error) => emit_watch_error(&workspace_id, sink.as_ref()),
                    Ok(WatchSignal::Stop) | Err(RecvTimeoutError::Disconnected) => return,
                    Err(RecvTimeoutError::Timeout) => {
                        let revision = revision.fetch_add(1, Ordering::Relaxed) + 1;
                        sink.documents_changed(WatchChangedPayload {
                            workspace_id: workspace_id.clone(),
                            revision,
                        });
                        break;
                    }
                }
            },
            Ok(WatchSignal::Error) => emit_watch_error(&workspace_id, sink.as_ref()),
            Ok(WatchSignal::Stop) | Err(_) => return,
        }
    }
}

fn emit_watch_error(workspace_id: &str, sink: &dyn WatchEventSink) {
    sink.watch_error(WatchErrorPayload {
        workspace_id: workspace_id.to_owned(),
        code: "workspace_watch_failed",
        message: "实时文件监听遇到错误，请手动刷新并重试。",
    });
}

fn is_relevant_event(root: &Path, event: &Event) -> bool {
    if matches!(event.kind, EventKind::Access(_)) {
        return false;
    }

    if event.paths.is_empty() {
        return true;
    }

    event.paths.iter().any(|path| {
        let relative = if path.is_absolute() {
            let Ok(relative) = path.strip_prefix(root) else {
                return false;
            };
            relative
        } else {
            path.as_path()
        };
        !has_internal_component(relative)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        fs,
        sync::atomic::{AtomicU64, Ordering},
        time::Instant,
    };

    static NEXT_TEST_DIRECTORY: AtomicU64 = AtomicU64::new(1);

    struct TestDirectory(PathBuf);

    impl TestDirectory {
        fn new(name: &str) -> Self {
            let unique = NEXT_TEST_DIRECTORY.fetch_add(1, Ordering::Relaxed);
            let path = std::env::temp_dir().join(format!(
                "easy-markdown-watcher-{name}-{}-{unique}",
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

    #[derive(Default)]
    struct RecordingSink {
        changes: Mutex<Vec<WatchChangedPayload>>,
        errors: Mutex<Vec<WatchErrorPayload>>,
    }

    impl RecordingSink {
        fn change_count(&self) -> usize {
            self.changes.lock().expect("lock changes").len()
        }

        fn wait_for_changes(&self, expected: usize) {
            let deadline = Instant::now() + Duration::from_secs(5);
            while self.change_count() < expected && Instant::now() < deadline {
                thread::sleep(Duration::from_millis(20));
            }
            assert!(
                self.change_count() >= expected,
                "timed out waiting for {expected} watch notifications"
            );
        }
    }

    impl WatchEventSink for RecordingSink {
        fn documents_changed(&self, payload: WatchChangedPayload) {
            self.changes.lock().expect("lock changes").push(payload);
        }

        fn watch_error(&self, payload: WatchErrorPayload) {
            self.errors.lock().expect("lock errors").push(payload);
        }
    }

    #[test]
    fn debounce_worker_coalesces_bursts_and_sanitizes_payloads() {
        let (signals, receiver) = mpsc::channel();
        let sink = Arc::new(RecordingSink::default());
        let worker_sink: Arc<dyn WatchEventSink> = sink.clone();
        let revision = Arc::new(AtomicU64::new(0));
        let worker = thread::spawn(move || {
            run_debounce_worker(receiver, "workspace-test".to_owned(), revision, worker_sink)
        });

        signals.send(WatchSignal::Changed).expect("send change");
        thread::sleep(Duration::from_millis(40));
        signals.send(WatchSignal::Changed).expect("send change");
        thread::sleep(Duration::from_millis(40));
        signals.send(WatchSignal::Changed).expect("send change");

        sink.wait_for_changes(1);
        thread::sleep(Duration::from_millis(350));
        assert_eq!(sink.change_count(), 1);
        assert_eq!(
            sink.changes.lock().expect("lock changes").as_slice(),
            &[WatchChangedPayload {
                workspace_id: "workspace-test".to_owned(),
                revision: 1,
            }]
        );

        signals.send(WatchSignal::Stop).expect("stop worker");
        worker.join().expect("join worker");
    }

    #[test]
    fn event_payloads_use_only_the_sanitized_camel_case_contract() {
        let changed = serde_json::to_value(WatchChangedPayload {
            workspace_id: "workspace-test".to_owned(),
            revision: 7,
        })
        .expect("serialize changed payload");
        assert_eq!(
            changed,
            serde_json::json!({
                "workspaceId": "workspace-test",
                "revision": 7
            })
        );

        let error = serde_json::to_value(WatchErrorPayload {
            workspace_id: "workspace-test".to_owned(),
            code: "workspace_watch_failed",
            message: "sanitized",
        })
        .expect("serialize error payload");
        assert_eq!(
            error,
            serde_json::json!({
                "workspaceId": "workspace-test",
                "code": "workspace_watch_failed",
                "message": "sanitized"
            })
        );
    }

    #[test]
    fn recursive_watcher_observes_file_lifecycle_and_ignores_internal_directories() {
        let directory = TestDirectory::new("lifecycle");
        fs::create_dir_all(directory.0.join("nested")).expect("create nested directory");
        fs::create_dir_all(directory.0.join(".GIT")).expect("create internal directory");
        let sink = Arc::new(RecordingSink::default());
        let registry = WatchRegistry::default();
        registry
            .replace_with_sink(
                "workspace-lifecycle".to_owned(),
                directory.0.clone(),
                sink.clone(),
            )
            .expect("start watcher");

        let source = directory.0.join("nested").join("note.md");
        fs::write(&source, "created\n").expect("create document");
        sink.wait_for_changes(1);

        fs::write(&source, "modified\n").expect("modify document");
        sink.wait_for_changes(2);

        let renamed = directory.0.join("nested").join("renamed.md");
        fs::rename(&source, &renamed).expect("rename document");
        sink.wait_for_changes(3);

        fs::remove_file(&renamed).expect("delete document");
        sink.wait_for_changes(4);

        let before_internal_write = sink.change_count();
        fs::write(directory.0.join(".GIT").join("ignored.md"), "ignored\n")
            .expect("write internal document");
        thread::sleep(Duration::from_millis(500));
        assert_eq!(sink.change_count(), before_internal_write);
        assert!(sink.errors.lock().expect("lock errors").is_empty());
    }

    #[test]
    fn replacing_a_watcher_stops_notifications_from_the_old_workspace() {
        let old_directory = TestDirectory::new("replace-old");
        let new_directory = TestDirectory::new("replace-new");
        let sink = Arc::new(RecordingSink::default());
        let registry = WatchRegistry::default();
        registry
            .replace_with_sink(
                "workspace-old".to_owned(),
                old_directory.0.clone(),
                sink.clone(),
            )
            .expect("start old watcher");
        registry
            .replace_with_sink(
                "workspace-new".to_owned(),
                new_directory.0.clone(),
                sink.clone(),
            )
            .expect("replace watcher");

        fs::write(old_directory.0.join("old.md"), "old\n").expect("write old workspace");
        thread::sleep(Duration::from_millis(500));
        assert_eq!(sink.change_count(), 0);

        fs::write(new_directory.0.join("new.md"), "new\n").expect("write new workspace");
        sink.wait_for_changes(1);
        assert_eq!(
            sink.changes.lock().expect("lock changes")[0].workspace_id,
            "workspace-new"
        );
    }
}
