use std::path::PathBuf;

pub type KnownEngineProfile = (String, PathBuf, PathBuf, PathBuf, String);

pub fn current_platform() -> &'static str {
    "macos"
}

pub fn local_engine_supported() -> bool {
    true
}

pub fn executable_name() -> &'static str {
    "katago"
}

pub fn common_engine_roots() -> Vec<PathBuf> {
    vec![
        PathBuf::from("/opt/homebrew"),
        PathBuf::from("/opt/homebrew/bin"),
        PathBuf::from("/usr/local"),
        PathBuf::from("/usr/local/bin"),
        PathBuf::from("/Applications/KataGo"),
    ]
}

pub fn known_engine_profiles() -> Vec<KnownEngineProfile> {
    vec![(
        "本机 KataGo OpenCL".to_string(),
        PathBuf::from("/opt/homebrew/bin/katago"),
        PathBuf::from("/opt/homebrew/share/katago/g170e-b20c256x2-s5303129600-d1228401921.bin.gz"),
        PathBuf::from("/Users/tuxy/App/KataGo/Config/winConfigs/default_gtp.cfg"),
        "macOS 兼容配置".to_string(),
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
        "engine" => dialog.set_title("选择 KataGo 可执行文件"),
        "model" => dialog
            .set_title("选择 KataGo Model 文件")
            .add_filter("KataGo Model", &["gz", "bin", "txt"]),
        "config" => dialog
            .set_title("选择 KataGo 配置文件")
            .add_filter("KataGo Config", &["cfg"]),
        _ => dialog.set_title("选择文件"),
    };
    Ok(dialog.pick_file())
}

pub fn choose_game_record_paths() -> Result<Vec<PathBuf>, String> {
    Ok(rfd::FileDialog::new()
        .set_title("选择要批量分析的棋谱")
        .add_filter("Game Records", &["sgf", "gib", "tsg", "json", "txt"])
        .pick_files()
        .unwrap_or_default())
}

pub fn choose_directory_path() -> Result<Option<PathBuf>, String> {
    Ok(rfd::FileDialog::new()
        .set_title("选择 TSG 输出目录")
        .pick_folder())
}
