mod document;
mod watcher;
mod workspace;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(workspace::WorkspaceRegistry::default())
        .manage(watcher::WatchRegistry::default())
        .invoke_handler(tauri::generate_handler![
            workspace::open_workspace,
            document::list_documents,
            document::read_text,
            document::save_text,
            document::create_text,
            document::rename_document,
            document::trash_document
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
