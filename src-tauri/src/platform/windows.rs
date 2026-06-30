use std::env;
use std::path::PathBuf;

pub type KnownEngineProfile = (String, PathBuf, PathBuf, PathBuf, String);

pub fn current_platform() -> &'static str {
    "windows"
}

pub fn local_engine_supported() -> bool {
    true
}

pub fn executable_name() -> &'static str {
    "katago.exe"
}

pub fn common_engine_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();
    if let Ok(program_files) = env::var("ProgramFiles") {
        roots.push(PathBuf::from(program_files).join("KataGo"));
    }
    if let Ok(program_files_x86) = env::var("ProgramFiles(x86)") {
        roots.push(PathBuf::from(program_files_x86).join("KataGo"));
    }
    if let Ok(local_app_data) = env::var("LOCALAPPDATA") {
        roots.push(PathBuf::from(local_app_data).join("KataGo"));
    }
    roots
}

pub fn known_engine_profiles() -> Vec<KnownEngineProfile> {
    let lizzie_root = PathBuf::from(
        r"C:\Apps\KataGo202306\2023-06-15-windows64+katago\2023-06-15-windows64+katago",
    );

    vec![(
        "Lizzie KataGo TensorRT".to_string(),
        lizzie_root.join("katago_tensorRT").join("katago.exe"),
        lizzie_root
            .join("weights")
            .join("b18c384nbt-optimisticv13-s5971M.bin.gz"),
        lizzie_root.join("katago_configs").join("default_gtp.cfg"),
        "Windows 已知整合包".to_string(),
    )]
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
