mod document;
mod workspace;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(workspace::WorkspaceRegistry::default())
        .invoke_handler(tauri::generate_handler![
            workspace::open_workspace,
            document::list_documents,
            document::read_text,
            document::save_text
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
