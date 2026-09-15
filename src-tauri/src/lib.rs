mod scanner;
mod config;
mod git_ops;
mod github_api;

use git_ops::RepoInfo;
use tauri::{Manager, Emitter, tray::{MouseButton, MouseButtonState, TrayIconEvent}};
use tauri_plugin_store::StoreExt;

pub struct AppWatcherState {
    watcher: std::sync::Mutex<Option<notify::RecommendedWatcher>>,
    current_path: std::sync::Mutex<Option<String>>,
}

pub fn update_tray_icon(app: &tauri::AppHandle, repos: &[RepoInfo]) {
    if let Some(tray) = app.tray_by_id("main") {
        let any_attention = repos.iter().any(|r| {
            r.status == "ahead" || r.status == "behind" || r.status == "dirty" || r.status == "diverged"
        });
        
        let icon_bytes = if any_attention {
            include_bytes!("../icons/attention.png").as_ref()
        } else {
            include_bytes!("../icons/clean.png").as_ref()
        };
        
        if let Ok(icon) = tauri::image::Image::from_bytes(icon_bytes) {
            let _ = tray.set_icon(Some(icon));
        }
    }
}

fn is_actual_project_file(entry_path: &std::path::Path) -> bool {
    let name = match entry_path.file_name().and_then(|s| s.to_str()) {
        Some(n) => n,
        None => return false,
    };
    let name_lower = name.to_lowercase();

    if name_lower == ".ds_store" || name_lower == "thumbs.db" || name_lower == ".git" {
        return false;
    }

    if entry_path.is_file() {
        if let Some(ext) = entry_path.extension().and_then(|s| s.to_str()) {
            let ext_lower = ext.to_lowercase();
            if ext_lower == "md" || ext_lower == "txt" || ext_lower == "license" || ext_lower == "gitignore" {
                return false;
            }
        }
        
        if name_lower == "license" || name_lower == "readme" || name_lower == "copying" || name_lower == ".gitignore" {
            return false;
        }

        return true;
    }

    false
}

fn is_project_folder_name(name: &str) -> bool {
    let name_lower = name.to_lowercase();
    name_lower == "src" 
        || name_lower == "source" 
        || name_lower == "public" 
        || name_lower == "lib" 
        || name_lower == "bin"
        || name_lower == "components"
        || name_lower == "views"
}

fn scan_folder_recursive(path: &std::path::Path, depth: usize) -> Vec<RepoInfo> {
    if depth > 8 {
        return vec![create_non_git_placeholder(path)];
    }

    // 1. Check if it's a git repo
    let git_dir = path.join(".git");
    if git_dir.exists() && git_dir.is_dir() {
        if let Ok(info) = git_ops::get_repo_info(path) {
            return vec![info];
        }
    }

    // 2. Read entries
    let entries = match std::fs::read_dir(path) {
        Ok(e) => e,
        Err(_) => {
            return vec![create_non_git_placeholder(path)];
        }
    };

    let mut subdirs = Vec::new();
    let mut has_project_files = false;
    let mut has_project_folders = false;

    for entry_res in entries {
        let entry = match entry_res {
            Ok(e) => e,
            Err(_) => continue,
        };
        let entry_path = entry.path();
        let name = entry.file_name();
        let name_str = name.to_string_lossy();

        if name_str == ".git" || name_str == ".DS_Store" || name_str == "Thumbs.db" {
            continue;
        }

        if entry_path.is_dir() {
            if is_project_folder_name(&name_str) {
                has_project_folders = true;
            } else {
                subdirs.push(entry_path);
            }
        } else {
            if is_actual_project_file(&entry_path) {
                has_project_files = true;
            }
        }
    }

    if has_project_files || has_project_folders {
        return vec![create_non_git_placeholder(path)];
    }

    if subdirs.is_empty() {
        return vec![create_non_git_placeholder(path)];
    }

    // Recurse into subdirectories
    let mut results = Vec::new();
    for subdir in subdirs {
        results.extend(scan_folder_recursive(&subdir, depth + 1));
    }
    results
}

fn create_non_git_placeholder(path: &std::path::Path) -> RepoInfo {
    let name = path.file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("unknown")
        .to_string();
    let local_path = path.to_string_lossy().to_string();
    RepoInfo {
        id: local_path.clone(),
        name,
        local_path,
        branch: "".to_string(),
        remote_url: None,
        status: "non-git".to_string(),
        last_commit_time: None,
        ahead_count: 0,
        behind_count: 0,
        changed_files: Vec::new(),
        ahead_commits: Vec::new(),
        behind_commits: Vec::new(),
        last_scanned: chrono::Utc::now().to_rfc3339(),
        remote_type: None,
        project_type: git_ops::detect_project_type(path),
    }
}

fn setup_watcher(app: tauri::AppHandle, path_str: &str) -> Result<notify::RecommendedWatcher, String> {
    use notify::Watcher;
    let path = std::path::Path::new(path_str);
    let app_clone = app.clone();
    
    let (tx, rx) = std::sync::mpsc::channel();
    
    let mut watcher = notify::recommended_watcher(move |res: Result<notify::Event, notify::Error>| {
        if let Ok(event) = res {
            let is_ignorable = !event.paths.is_empty() && event.paths.iter().all(|p| {
                let s = p.to_string_lossy().to_lowercase();
                s.contains("node_modules")
                    || s.contains("target")
                    || s.contains(".venv")
                    || s.contains("venv")
                    || s.contains("vendor")
                    || s.contains(".next")
                    || s.contains("dist")
                    || s.contains("build")
                    || s.contains(".git\\objects")
                    || s.contains(".git/objects")
                    || s.contains(".git\\logs")
                    || s.contains(".git/logs")
                    || s.contains("tmp")
            });

            if !is_ignorable {
                let _ = tx.send(event);
            }
        }
    }).map_err(|e| e.to_string())?;
    
    watcher.watch(path, notify::RecursiveMode::Recursive).map_err(|e| e.to_string())?;
    
    tauri::async_runtime::spawn(async move {
        let mut last_event_time = std::time::Instant::now();
        let mut has_pending = false;
        
        loop {
            if let Ok(_) = rx.recv_timeout(std::time::Duration::from_millis(500)) {
                last_event_time = std::time::Instant::now();
                has_pending = true;
            } else {
                if has_pending && last_event_time.elapsed() >= std::time::Duration::from_secs(2) {
                    has_pending = false;
                    let _ = app_clone.emit("watcher-rescan", ());
                }
            }
        }
    });
    
    Ok(watcher)
}

#[tauri::command]
async fn open_terminal(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd.exe")
            .args(&["/c", "start", "powershell.exe", "-NoExit", "-WorkingDirectory", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new("x-terminal-emulator")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn scan_repos(
    app: tauri::AppHandle, 
    root_path: String,
    state: tauri::State<'_, AppWatcherState>
) -> Result<Vec<RepoInfo>, String> {
    // Setup or update filesystem watcher
    {
        let mut current = state.current_path.lock().unwrap();
        if current.as_deref() != Some(&root_path) {
            let mut watcher_lock = state.watcher.lock().unwrap();
            *watcher_lock = None;
            if let Ok(new_watcher) = setup_watcher(app.clone(), &root_path) {
                *watcher_lock = Some(new_watcher);
                *current = Some(root_path.clone());
            }
        }
    }

    let root_path_clone = root_path.clone();
    let app_handle = app.clone();

    let repos = tauri::async_runtime::spawn_blocking(move || {
        let mut repos = Vec::new();
        let entries = match std::fs::read_dir(&root_path_clone) {
            Ok(e) => e,
            Err(_) => return repos,
        };
        
        let mut dirs = Vec::new();
        for entry_res in entries {
            if let Ok(entry) = entry_res {
                let path = entry.path();
                if path.is_dir() {
                    dirs.push(path);
                }
            }
        }

        let total = dirs.len();
        for (i, path) in dirs.iter().enumerate() {
            let _ = app_handle.emit("scan-progress", serde_json::json!({
                "current": i + 1,
                "total": total,
                "folderName": path.file_name().and_then(|s| s.to_str()).unwrap_or("")
            }));
            repos.extend(scan_folder_recursive(path, 0));
        }
        repos
    }).await.map_err(|e| e.to_string())?;

    update_tray_icon(&app, &repos);
    Ok(repos)
}

#[tauri::command]
async fn get_repo_detail(repo_path: String) -> Result<RepoInfo, String> {
    let path = std::path::Path::new(&repo_path);
    git_ops::get_repo_info(path)
}

#[tauri::command]
async fn open_in_explorer(path: String) -> Result<(), String> {
    git_ops::open_explorer(&path)
}

#[tauri::command]
async fn open_in_vscode(path: String) -> Result<(), String> {
    git_ops::open_vscode(&path)
}

#[tauri::command]
async fn get_total_folders(root_path: String) -> Result<usize, String> {
    let mut count = 0;
    if let Ok(entries) = std::fs::read_dir(&root_path) {
        for entry_res in entries {
            if let Ok(entry) = entry_res {
                let path = entry.path();
                if path.is_dir() {
                    count += scan_folder_recursive(&path, 0).len();
                }
            }
        }
    }
    Ok(count)
}

#[tauri::command]
async fn git_push_repo(repo_path: String) -> Result<(), String> {
    git_ops::git_push(&repo_path)
}

#[tauri::command]
async fn git_stash_repo(repo_path: String) -> Result<(), String> {
    git_ops::git_stash(&repo_path)
}

#[tauri::command]
async fn git_discard_repo(repo_path: String) -> Result<(), String> {
    git_ops::git_discard_changes(&repo_path)
}

#[tauri::command]
async fn get_heavy_folders(repo_path: String) -> Result<Vec<git_ops::HeavyFolderInfo>, String> {
    Ok(git_ops::scan_heavy_folders(&repo_path))
}

#[tauri::command]
async fn clean_heavy_folder(full_path: String) -> Result<(), String> {
    git_ops::remove_folder(&full_path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppWatcherState {
            watcher: std::sync::Mutex::new(None),
            current_path: std::sync::Mutex::new(None),
        })
        .setup(|app| {
            // Restore window size and position from store
            let window = app.get_webview_window("main").unwrap();
            let _ = window.set_min_size(Some(tauri::Size::Logical(tauri::LogicalSize::new(860.0, 560.0))));
            let _ = window.show();
            let _ = window.set_focus();

            if let Ok(store) = app.store("config.json") {
                if let Some(pos_val) = store.get("windowPosition") {
                    if let (Some(x), Some(y)) = (
                        pos_val.get("x").and_then(|v| v.as_i64().map(|n| n as i32)),
                        pos_val.get("y").and_then(|v| v.as_i64().map(|n| n as i32))
                    ) {
                        let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(x, y)));
                    }
                }
                if let Some(size_val) = store.get("windowSize") {
                    if let (Some(w), Some(h)) = (
                        size_val.get("width").and_then(|v| v.as_u64().map(|n| n as u32)),
                        size_val.get("height").and_then(|v| v.as_u64().map(|n| n as u32))
                    ) {
                        let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize::new(w, h)));
                    }
                }
            }

            // Create tray menu items
            let open_i = tauri::menu::MenuItem::with_id(app, "open", "Open LagLine", true, None::<&str>)?;
            let rescan_i = tauri::menu::MenuItem::with_id(app, "rescan", "Rescan Now", true, None::<&str>)?;
            let quit_i = tauri::menu::MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = tauri::menu::Menu::with_items(app, &[&open_i, &rescan_i, &quit_i])?;

            // Build system tray icon
            let _tray = tauri::tray::TrayIconBuilder::with_id("main")
                .menu(&menu)
                .icon(tauri::image::Image::from_bytes(include_bytes!("../icons/clean.png")).unwrap())
                .on_tray_icon_event(|tray, event| {
                    match event {
                        TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } => {
                            if let Some(window) = tray.app_handle().get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        _ => {}
                    }
                })
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "open" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "rescan" => {
                            let app_handle = app.clone();
                            tauri::async_runtime::spawn(async move {
                                if let Ok(store) = app_handle.store("config.json") {
                                    if let Some(config_val) = store.get("config") {
                                        if let Some(root_path) = config_val.get("rootPath").and_then(|v| v.as_str()) {
                                            let paths = scanner::scan_directories(root_path);
                                            let mut repos = Vec::new();
                                            for path in paths {
                                                if let Ok(info) = git_ops::get_repo_info(&path) {
                                                    repos.push(info);
                                                }
                                            }
                                            update_tray_icon(&app_handle, &repos);
                                            let _ = app_handle.emit("repos-scanned", &repos);
                                        }
                                    }
                                }
                            });
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let app = window.app_handle();
                if let (Ok(pos), Ok(size)) = (window.outer_position(), window.inner_size()) {
                    if let Ok(store) = app.store("config.json") {
                        store.set("windowPosition", serde_json::json!({ "x": pos.x, "y": pos.y }));
                        store.set("windowSize", serde_json::json!({ "width": size.width, "height": size.height }));
                        let _ = store.save();
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            scan_repos,
            get_repo_detail,
            config::load_config,
            config::save_config,
            open_in_explorer,
            open_in_vscode,
            get_total_folders,
            github_api::fetch_remote_status,
            github_api::fetch_all_remotes,
            open_terminal,
            git_push_repo,
            git_stash_repo,
            git_discard_repo,
            get_heavy_folders,
            clean_heavy_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
