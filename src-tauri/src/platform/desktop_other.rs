use std::path::PathBuf;

pub type KnownEngineProfile = (String, PathBuf, PathBuf, PathBuf, String);

pub fn current_platform() -> &'static str {
    "desktop"
}

pub fn local_engine_supported() -> bool {
    true
}

pub fn executable_name() -> &'static str {
    "katago"
}

pub fn common_engine_roots() -> Vec<PathBuf> {
    Vec::new()
}

pub fn known_engine_profiles() -> Vec<KnownEngineProfile> {
    Vec::new()
}

pub fn choose_save_path(
    default_name: &str,
    _default_dir: Option<&str>,
) -> Result<Option<PathBuf>, String> {
    Err(format!(
        "当前平台暂未实现原生保存对话框，请提供文件路径后再保存: {}",
        default_name
    ))
}

pub fn choose_file_path(kind: &str) -> Result<Option<PathBuf>, String> {
    Err(format!(
        "{} 文件选择器尚未接入当前平台。可以先手动粘贴路径。",
        kind
    ))
}

pub fn choose_game_record_paths() -> Result<Vec<PathBuf>, String> {
    Err("当前平台暂未实现批量棋谱选择器。".to_string())
}

pub fn choose_directory_path() -> Result<Option<PathBuf>, String> {
    Err("当前平台暂未实现目录选择器。".to_string())
}
