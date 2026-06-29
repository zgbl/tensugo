use std::path::PathBuf;
use std::process::Command;

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
    let mut script = format!(
        "set chosenFile to choose file name with prompt \"保存 TensuGo 研究文档\" default name \"{}\"",
        applescript_escape(default_name)
    );
    if let Some(default_dir) = default_dir.filter(|path| !path.trim().is_empty()) {
        script.push_str(&format!(
            " default location POSIX file \"{}\"",
            applescript_escape(default_dir)
        ));
    }
    script.push_str("\nPOSIX path of chosenFile");
    run_osascript_path(script)
}

pub fn choose_file_path(kind: &str) -> Result<Option<PathBuf>, String> {
    let prompt = match kind {
        "engine" => "选择 KataGo 可执行文件",
        "model" => "选择 KataGo Model 文件",
        "config" => "选择 KataGo 配置文件",
        _ => "选择文件",
    };
    let script = format!(
        "set chosenFile to choose file with prompt \"{}\"\nPOSIX path of chosenFile",
        applescript_escape(prompt)
    );
    run_osascript_path(script)
}

fn run_osascript_path(script: String) -> Result<Option<PathBuf>, String> {
    let output = Command::new("osascript")
        .arg("-e")
        .arg(script)
        .output()
        .map_err(|error| error.to_string())?;

    if output.status.success() {
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if path.is_empty() {
            Ok(None)
        } else {
            Ok(Some(PathBuf::from(path)))
        }
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("User canceled") || stderr.contains("-128") {
            Ok(None)
        } else {
            Err(stderr.trim().to_string())
        }
    }
}

fn applescript_escape(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}
