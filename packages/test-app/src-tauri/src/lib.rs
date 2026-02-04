//! Test application for tauri-mcp plugin

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_mcp::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
