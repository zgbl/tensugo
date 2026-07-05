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
    roots.push(PathBuf::from(
        r"C:\Apps\KataGo202306\2023-06-15-windows64+katago\2023-06-15-windows64+katago",
    ));
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
        "KataGo CUDA 202605".to_string(),
        lizzie_root.join("katago_cuda202605").join("katago.exe"),
        lizzie_root
            .join("weights")
            .join("kata1-b28c512nbt-s12674021632-d5782420041.bin.gz"),
        lizzie_root.join("katago_configs").join("default_gtp.cfg"),
        "Windows 已知新版 CUDA 引擎".to_string(),
    )]
}

pub fn choose_save_path(
    default_name: &str,
    default_dir: Option<&str>,
) -> Result<Option<PathBuf>, String> {
    let mut dialog = rfd::FileDialog::new()
        .set_title("保存 TensuGo 研究文档")
        .set_file_name(default_name);
    if let Some(default_dir) = default_dir.filter(|path| !path.trim().is_empty()) {
        dialog = dialog.set_directory(default_dir);
    }
    Ok(dialog.save_file())
}

pub fn choose_file_path(kind: &str) -> Result<Option<PathBuf>, String> {
    let mut dialog = rfd::FileDialog::new();
    dialog = match kind {
        "engine" => dialog
            .set_title("选择 katago.exe")
            .add_filter("KataGo Engine", &["exe"]),
        "model" => dialog
            .set_title("选择 KataGo 权重文件")
            .add_filter("KataGo Model", &["gz", "bin", "txt"]),
        "config" => dialog
            .set_title("选择 KataGo GTP 配置")
            .add_filter("KataGo Config", &["cfg"]),
        _ => dialog.set_title("选择文件"),
    };

    Ok(dialog.pick_file())
}
