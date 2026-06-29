use std::path::PathBuf;

pub type KnownEngineProfile = (String, PathBuf, PathBuf, PathBuf, String);

pub fn current_platform() -> &'static str {
    #[cfg(target_os = "ios")]
    {
        "ios"
    }
    #[cfg(target_os = "android")]
    {
        "android"
    }
}

pub fn local_engine_supported() -> bool {
    false
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
        "移动端暂未实现原生保存对话框，请提供文件路径后再保存: {}",
        default_name
    ))
}

pub fn choose_file_path(kind: &str) -> Result<Option<PathBuf>, String> {
    Err(format!("移动端暂不支持选择本地 KataGo {} 文件。", kind))
}
