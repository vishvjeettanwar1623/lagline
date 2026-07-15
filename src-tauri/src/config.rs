use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub root_path: Option<String>,
    pub github_token: Option<String>,
    pub last_full_scan: Option<String>,
    pub auto_rescan_interval: Option<String>,
    #[serde(default)]
    pub ignored_paths: Option<Vec<String>>,
    #[serde(default)]
    pub pinned_paths: Option<Vec<String>>,
}

// Retrieve token from OS keyring securely
fn get_keyring_token() -> Option<String> {
    if let Ok(entry) = keyring::Entry::new("com.lagline.app", "github_token") {
        entry.get_password().ok()
    } else {
        None
    }
}

// Save token to OS keyring securely, or delete it if it is empty/None
fn set_keyring_token(token: Option<&str>) -> Result<(), String> {
    let entry = keyring::Entry::new("com.lagline.app", "github_token")
        .map_err(|e| format!("Failed to initialize keyring: {}", e))?;
    match token {
        Some(t) if !t.is_empty() => {
            entry.set_password(t).map_err(|e| format!("Failed to save token to keyring: {}", e))?;
        }
        _ => {
            let _ = entry.delete_password(); // ignore error if it didn't exist
        }
    }
    Ok(())
}

#[tauri::command]
pub(crate) async fn load_config(app: AppHandle) -> Result<AppConfig, String> {
    let store = app.store("config.json").map_err(|e| e.to_string())?;
    let mut config = if let Some(value) = store.get("config") {
        serde_json::from_value::<AppConfig>(value.clone()).map_err(|e| e.to_string())?
    } else {
        AppConfig {
            root_path: None,
            github_token: None,
            last_full_scan: None,
            auto_rescan_interval: None,
            ignored_paths: Some(Vec::new()),
            pinned_paths: Some(Vec::new()),
        }
    };
    
    // Retrieve token from secure keyring instead of plaintext file
    config.github_token = get_keyring_token();
    
    Ok(config)
}

#[tauri::command]
pub(crate) async fn save_config(app: AppHandle, mut config: AppConfig) -> Result<(), String> {
    // 1. Extract the token and write it to the keyring
    let token = config.github_token.take();
    set_keyring_token(token.as_deref())?;

    // 2. Save the rest of the configuration (with githubToken = None) to config.json
    let store = app.store("config.json").map_err(|e| e.to_string())?;
    let value = serde_json::to_value(config).map_err(|e| e.to_string())?;
    store.set("config", value);
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}
