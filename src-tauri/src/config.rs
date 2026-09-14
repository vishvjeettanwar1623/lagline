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

#[tauri::command]
pub(crate) async fn load_config(app: AppHandle) -> Result<AppConfig, String> {
    let store = app.store("config.json").map_err(|e| e.to_string())?;
    if let Some(value) = store.get("config") {
        let config: AppConfig = serde_json::from_value(value.clone()).map_err(|e| e.to_string())?;
        Ok(config)
    } else {
        Ok(AppConfig {
            root_path: None,
            github_token: None,
            last_full_scan: None,
            auto_rescan_interval: None,
            ignored_paths: Some(Vec::new()),
            pinned_paths: Some(Vec::new()),
        })
    }
}

#[tauri::command]
pub(crate) async fn save_config(app: AppHandle, config: AppConfig) -> Result<(), String> {
    let store = app.store("config.json").map_err(|e| e.to_string())?;
    let value = serde_json::to_value(config).map_err(|e| e.to_string())?;
    store.set("config", value);
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}
