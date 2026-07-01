use crate::platform;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::env;
use std::path::{Path, PathBuf};
use tauri::AppHandle;

#[derive(Debug, Clone, Deserialize)]
pub struct EngineProfile {
    pub name: String,
    pub executable_path: String,
    pub model_path: String,
    pub config_path: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct EngineProfileCandidate {
    pub name: String,
    pub executable_path: String,
    pub model_path: String,
    pub config_path: String,
    pub command_line: String,
    pub exists: bool,
    pub source: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct EngineDiscoveryResult {
    pub platform: String,
    pub local_engine_supported: bool,
    pub selected: EngineProfileCandidate,
    pub candidates: Vec<EngineProfileCandidate>,
    pub diagnostics: String,
}

impl From<EngineProfileCandidate> for EngineProfile {
    fn from(candidate: EngineProfileCandidate) -> Self {
        Self {
            name: candidate.name,
            executable_path: candidate.executable_path,
            model_path: candidate.model_path,
            config_path: candidate.config_path,
        }
    }
}

pub fn discover_engine(
    app: &AppHandle,
    user_profile: Option<EngineProfile>,
) -> EngineDiscoveryResult {
    let platform_name = platform::current_platform().to_string();
    let local_supported = platform::local_engine_supported();
    let mut diagnostics = Vec::new();
    diagnostics.push(format!("platform: {}", platform_name));

    if !local_supported {
        let selected = empty_candidate("移动端暂不支持本地 KataGo", "unsupported");
        return EngineDiscoveryResult {
            platform: platform_name,
            local_engine_supported: false,
            selected: selected.clone(),
            candidates: vec![selected],
            diagnostics: diagnostics.join("\n"),
        };
    }

    let mut candidates = Vec::new();
    if let Some(profile) = user_profile.filter(profile_has_paths) {
        candidates.push(candidate_from_profile(profile, "用户配置"));
    }

    candidates.extend(known_platform_candidates());
    candidates.extend(bundled_candidates(app));
    candidates.extend(common_install_candidates());
    candidates.extend(path_candidates());
    candidates.extend(dev_candidates());
    candidates = dedupe_candidates(candidates);

    for candidate in &mut candidates {
        candidate.exists = profile_files_exist(candidate);
        candidate.command_line = command_line(candidate);
    }

    let selected = candidates
        .iter()
        .find(|candidate| candidate.exists)
        .cloned()
        .or_else(|| candidates.first().cloned())
        .unwrap_or_else(|| empty_candidate("未发现 KataGo", "none"));

    diagnostics.push(format!("candidate count: {}", candidates.len()));
    diagnostics.push(format!("selected source: {}", selected.source));
    if let Ok(paths) = platform::platform_paths(app) {
        diagnostics.push(format!("app data: {}", paths.app_data_dir));
        diagnostics.push(format!(
            "resources: {}",
            paths.resource_dir.unwrap_or_else(|| "(none)".to_string())
        ));
    }

    EngineDiscoveryResult {
        platform: platform_name,
        local_engine_supported: local_supported,
        selected,
        candidates,
        diagnostics: diagnostics.join("\n"),
    }
}

fn profile_has_paths(profile: &EngineProfile) -> bool {
    !profile.executable_path.trim().is_empty()
        || !profile.model_path.trim().is_empty()
        || !profile.config_path.trim().is_empty()
}

fn candidate_from_profile(profile: EngineProfile, source: &str) -> EngineProfileCandidate {
    let executable = PathBuf::from(profile.executable_path);
    let root = executable
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .to_path_buf();
    let model = if profile.model_path.trim().is_empty() {
        find_first_model_near_engine(&root).unwrap_or_default()
    } else {
        PathBuf::from(profile.model_path)
    };
    let config = if profile.config_path.trim().is_empty() {
        find_first_config_near_engine(&root).unwrap_or_default()
    } else {
        PathBuf::from(profile.config_path)
    };
    let name = if profile.name.trim().is_empty() {
        "用户 KataGo".to_string()
    } else {
        profile.name
    };

    EngineProfileCandidate {
        name,
        executable_path: executable.display().to_string(),
        model_path: model.display().to_string(),
        config_path: config.display().to_string(),
        command_line: String::new(),
        exists: false,
        source: source.to_string(),
    }
}

fn bundled_candidates(app: &AppHandle) -> Vec<EngineProfileCandidate> {
    let mut result = Vec::new();
    if let Some(resource_dir) = platform::resource_dir(app) {
        let root = resource_dir.join("katago");
        let executable = root.join(platform::executable_name());
        result.push(candidate_from_parts(
            "Bundled KataGo",
            executable,
            find_first_model(&root).unwrap_or_else(|| root.join("models").join("model.bin.gz")),
            root.join("configs").join("default_gtp.cfg"),
            "Bundled Engine",
        ));
    }
    result
}

fn known_platform_candidates() -> Vec<EngineProfileCandidate> {
    platform::known_engine_profiles()
        .into_iter()
        .map(|(name, executable, model, config, source)| {
            candidate_from_parts(&name, executable, model, config, &source)
        })
        .collect()
}

fn common_install_candidates() -> Vec<EngineProfileCandidate> {
    let mut result = Vec::new();
    for root in platform::common_engine_roots() {
        let executable =
            find_first_executable(&root).unwrap_or_else(|| root.join(platform::executable_name()));
        let config = find_first_config(&root).unwrap_or_else(|| root.join("default_gtp.cfg"));
        let model = find_first_model(&root).unwrap_or_else(|| root.join("model.bin.gz"));
        result.push(candidate_from_parts(
            "KataGo",
            executable,
            model,
            config,
            "常见安装目录",
        ));
    }
    result
}

fn find_first_executable(root: &Path) -> Option<PathBuf> {
    [
        root.join(platform::executable_name()),
        root.join("bin").join(platform::executable_name()),
    ]
    .into_iter()
    .find(|path| path.exists())
}

fn path_candidates() -> Vec<EngineProfileCandidate> {
    find_on_path(platform::executable_name())
        .into_iter()
        .map(|executable| {
            let root = executable
                .parent()
                .unwrap_or_else(|| Path::new("."))
                .to_path_buf();
            candidate_from_parts(
                "PATH KataGo",
                executable,
                find_first_model(&root).unwrap_or_default(),
                find_first_config(&root).unwrap_or_default(),
                "PATH",
            )
        })
        .collect()
}

fn dev_candidates() -> Vec<EngineProfileCandidate> {
    if !cfg!(debug_assertions) {
        return Vec::new();
    }
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join("KataGoData");
    vec![candidate_from_parts(
        "Dev KataGo",
        root.join(platform::executable_name()),
        find_first_model(&root).unwrap_or_else(|| root.join("models").join("model.bin.gz")),
        find_first_config(&root).unwrap_or_else(|| root.join("configs").join("default_gtp.cfg")),
        "Dev 环境",
    )]
}

fn find_on_path(name: &str) -> Vec<PathBuf> {
    let mut result = Vec::new();
    if let Some(paths) = env::var_os("PATH") {
        for dir in env::split_paths(&paths) {
            let path = dir.join(name);
            if path.exists() {
                result.push(path);
            }
        }
    }
    result
}

fn find_first_model(root: &Path) -> Option<PathBuf> {
    find_first_with_extensions(root, &["bin.gz", "txt.gz", "gz"])
}

fn find_first_model_near_engine(root: &Path) -> Option<PathBuf> {
    find_first_with_extensions_in_dirs(&engine_related_dirs(root), &["bin.gz", "txt.gz", "gz"])
}

fn find_first_config(root: &Path) -> Option<PathBuf> {
    find_first_config_in_dirs(&[
        root.to_path_buf(),
        root.join("configs"),
        root.join("share").join("katago"),
        root.join("share").join("katago").join("configs"),
    ])
}

fn find_first_config_near_engine(root: &Path) -> Option<PathBuf> {
    find_first_config_in_dirs(&engine_related_dirs(root))
}

fn engine_related_dirs(root: &Path) -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    for base in root.ancestors().take(5) {
        dirs.push(base.to_path_buf());
        dirs.push(base.join("models"));
        dirs.push(base.join("Models"));
        dirs.push(base.join("weights"));
        dirs.push(base.join("Weights"));
        dirs.push(base.join("configs"));
        dirs.push(base.join("katago_configs"));
        dirs.push(base.join("share").join("katago"));
        dirs.push(base.join("share").join("katago").join("models"));
        dirs.push(base.join("share").join("katago").join("configs"));
    }
    dirs
}

fn find_first_with_extensions(root: &Path, extensions: &[&str]) -> Option<PathBuf> {
    find_first_with_extensions_in_dirs(
        &[
            root.to_path_buf(),
            root.join("models"),
            root.join("configs"),
            root.join("share").join("katago"),
            root.join("share").join("katago").join("models"),
            root.join("share").join("katago").join("configs"),
        ],
        extensions,
    )
}

fn find_first_with_extensions_in_dirs(dirs: &[PathBuf], extensions: &[&str]) -> Option<PathBuf> {
    let mut best = None;
    for dir in dirs {
        let entries = match std::fs::read_dir(&dir) {
            Ok(entries) => entries,
            Err(_) => continue,
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let name = path
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or_default();
            if extensions.iter().any(|extension| name.ends_with(extension)) {
                if best.as_ref().map_or(true, |current: &PathBuf| {
                    model_rank(&path) > model_rank(current)
                }) {
                    best = Some(path);
                }
            }
        }
    }
    best
}

fn model_rank(path: &Path) -> usize {
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let mut score = 0;
    if name.ends_with(".bin.gz") {
        score += 20;
    }
    if name.contains("kata1-") {
        score += 10;
    }
    if name.contains("b28") || name.contains("b40") || name.contains("b60") {
        score += 5;
    }
    score
}

fn find_first_config_in_dirs(dirs: &[PathBuf]) -> Option<PathBuf> {
    let mut fallback = None;
    for dir in dirs {
        let entries = match std::fs::read_dir(dir) {
            Ok(entries) => entries,
            Err(_) => continue,
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let name = path
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or_default();
            if !name.ends_with(".cfg") {
                continue;
            }
            if is_gtp_config(&path) {
                if name == "default_gtp.cfg" {
                    return Some(path);
                }
                if fallback.is_none() {
                    fallback = Some(path);
                }
            }
        }
    }
    fallback
}

fn is_gtp_config(path: &Path) -> bool {
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    if name.to_ascii_lowercase().contains("gtp") {
        return true;
    }
    std::fs::read_to_string(path)
        .map(|content| content.contains("logAllGTPCommunication"))
        .unwrap_or(false)
}

fn candidate_from_parts(
    name: &str,
    executable: PathBuf,
    model: PathBuf,
    config: PathBuf,
    source: &str,
) -> EngineProfileCandidate {
    EngineProfileCandidate {
        name: name.to_string(),
        executable_path: executable.display().to_string(),
        model_path: model.display().to_string(),
        config_path: config.display().to_string(),
        command_line: String::new(),
        exists: false,
        source: source.to_string(),
    }
}

fn profile_files_exist(candidate: &EngineProfileCandidate) -> bool {
    Path::new(&candidate.executable_path).exists()
        && Path::new(&candidate.model_path).exists()
        && Path::new(&candidate.config_path).exists()
        && is_gtp_config(Path::new(&candidate.config_path))
}

fn command_line(candidate: &EngineProfileCandidate) -> String {
    if candidate.executable_path.is_empty() {
        return String::new();
    }
    format!(
        "{} gtp -model \"{}\" -config \"{}\"",
        candidate.executable_path, candidate.model_path, candidate.config_path
    )
}

fn dedupe_candidates(candidates: Vec<EngineProfileCandidate>) -> Vec<EngineProfileCandidate> {
    let mut seen = HashSet::new();
    let mut result = Vec::new();
    for candidate in candidates {
        let key = format!(
            "{}|{}|{}",
            candidate.executable_path, candidate.model_path, candidate.config_path
        );
        if seen.insert(key) {
            result.push(candidate);
        }
    }
    result
}

fn empty_candidate(name: &str, source: &str) -> EngineProfileCandidate {
    EngineProfileCandidate {
        name: name.to_string(),
        executable_path: String::new(),
        model_path: String::new(),
        config_path: String::new(),
        command_line: String::new(),
        exists: false,
        source: source.to_string(),
    }
}
