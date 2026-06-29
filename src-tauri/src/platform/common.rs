use serde::Serialize;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize)]
pub struct PlatformPaths {
    pub platform: String,
    pub app_config_dir: String,
    pub app_data_dir: String,
    pub app_log_dir: String,
    pub resource_dir: Option<String>,
    pub engine_runtime_dir: String,
    pub bundled_engine_dir: Option<String>,
}

pub fn platform_paths(app: &AppHandle) -> Result<PlatformPaths, String> {
    let paths = app.path();
    let app_config_dir = paths.app_config_dir().map_err(|error| error.to_string())?;
    let app_data_dir = paths.app_data_dir().map_err(|error| error.to_string())?;
    let app_log_dir = paths.app_log_dir().map_err(|error| error.to_string())?;
    let resource_dir = paths.resource_dir().ok();
    let engine_runtime_dir = app_data_dir.join("KataGoRuntime");
    let bundled_engine_dir = resource_dir.as_ref().map(|path| path.join("katago"));

    for path in [
        &app_config_dir,
        &app_data_dir,
        &app_log_dir,
        &engine_runtime_dir,
    ] {
        std::fs::create_dir_all(path).map_err(|error| error.to_string())?;
    }

    Ok(PlatformPaths {
        platform: super::current_platform().to_string(),
        app_config_dir: app_config_dir.display().to_string(),
        app_data_dir: app_data_dir.display().to_string(),
        app_log_dir: app_log_dir.display().to_string(),
        resource_dir: resource_dir.map(|path| path.display().to_string()),
        engine_runtime_dir: engine_runtime_dir.display().to_string(),
        bundled_engine_dir: bundled_engine_dir.map(|path| path.display().to_string()),
    })
}

pub fn engine_runtime_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("KataGoRuntime");
    std::fs::create_dir_all(&path).map_err(|error| error.to_string())?;
    Ok(path)
}

pub fn resource_dir(app: &AppHandle) -> Option<PathBuf> {
    app.path().resource_dir().ok()
}
