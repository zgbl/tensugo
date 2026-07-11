mod engine_discovery;
mod platform;

use engine_discovery::{EngineDiscoveryResult, EngineProfile, EngineProfileCandidate};
use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::mpsc::{self, Receiver};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};
use tauri::AppHandle;

const ANALYSIS_COLLECT_MIN_MS: u64 = 120;
const ANALYSIS_COLLECT_MAX_MS: u64 = 500;
const CONTINUOUS_ANALYSIS_INTERVAL_CS: usize = 30;
const ANALYSIS_BOOT_WAIT_MS: u64 = 300_000;
const ENGINE_TEST_BOOT_WAIT_MS: u64 = 180_000;
const PDF_EXPORT_TIMEOUT_MS: u64 = 45_000;
const ENGINE_MEMORY_SOFT_LIMIT_BYTES: u64 = 12 * 1024 * 1024 * 1024;

struct EngineState {
    session: Mutex<Option<EngineSession>>,
}

struct EngineSession {
    profile_key: String,
    current_position_key: String,
    continuous_analysis: Option<ContinuousAnalysisState>,
    stdin: ChildStdin,
    stdout_rx: Receiver<String>,
    stderr_rx: Receiver<String>,
    child: Child,
}

struct ContinuousAnalysisState {
    position_key: String,
    candidates: Vec<CandidateMove>,
    raw_output_tail: Vec<String>,
    diagnostics: String,
}

impl Drop for EngineSession {
    fn drop(&mut self) {
        terminate_engine_process(self);
    }
}

#[derive(Debug, Deserialize)]
struct AnalyzeMove {
    color: String,
    x: usize,
    y: usize,
}

#[derive(Debug, Deserialize)]
struct AnalyzeRequest {
    profile: EngineProfile,
    board_size: usize,
    komi: f64,
    moves: Vec<AnalyzeMove>,
    next_color: String,
    max_visits: usize,
}

#[derive(Debug, Serialize)]
struct EngineProbeResult {
    ok: bool,
    summary: String,
    diagnostics: String,
}

#[derive(Debug, Deserialize)]
struct ChoosePathRequest {
    kind: String,
}

#[derive(Debug, Serialize)]
struct ChoosePathResult {
    selected: bool,
    path: Option<String>,
    error: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
struct CandidateMove {
    rank: usize,
    move_name: String,
    visits: usize,
    winrate: f64,
    score_lead: f64,
    pv: Vec<String>,
}

#[derive(Debug, Serialize)]
struct AnalysisResult {
    ok: bool,
    status: String,
    candidates: Vec<CandidateMove>,
    raw_output: String,
    diagnostics: String,
}

#[derive(Debug, Deserialize)]
struct SaveTextFileRequest {
    default_name: String,
    default_dir: Option<String>,
    content: String,
}

#[derive(Debug, Deserialize)]
struct SavePdfRequest {
    default_name: String,
    default_dir: Option<String>,
    html: String,
}

#[derive(Debug, Serialize)]
struct SaveTextFileResult {
    saved: bool,
    path: Option<String>,
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct WriteTextFileRequest {
    path: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct ChooseFilesResult {
    selected: bool,
    paths: Vec<String>,
    error: Option<String>,
}

#[derive(Debug, Serialize)]
struct ChooseDirectoryResult {
    selected: bool,
    path: Option<String>,
    error: Option<String>,
}

#[derive(Debug, Serialize)]
struct ReadTextFileResult {
    ok: bool,
    content: Option<String>,
    error: Option<String>,
}

#[derive(Debug, Serialize)]
struct WriteTextFileResult {
    ok: bool,
    error: Option<String>,
}

#[tauri::command]
fn app_name() -> &'static str {
    "TensuGo"
}

#[tauri::command]
fn platform_paths(app: AppHandle) -> Result<platform::PlatformPaths, String> {
    platform::platform_paths(&app)
}

#[tauri::command]
fn save_text_file_with_dialog(_app: AppHandle, request: SaveTextFileRequest) -> SaveTextFileResult {
    match platform::choose_save_path(&request.default_name, request.default_dir.as_deref()) {
        Ok(Some(path)) => match std::fs::write(&path, request.content) {
            Ok(()) => SaveTextFileResult {
                saved: true,
                path: Some(path.display().to_string()),
                error: None,
            },
            Err(error) => SaveTextFileResult {
                saved: false,
                path: Some(path.display().to_string()),
                error: Some(error.to_string()),
            },
        },
        Ok(None) => SaveTextFileResult {
            saved: false,
            path: None,
            error: None,
        },
        Err(error) => SaveTextFileResult {
            saved: false,
            path: None,
            error: Some(error),
        },
    }
}

#[tauri::command]
fn save_pdf_with_dialog(_app: AppHandle, request: SavePdfRequest) -> SaveTextFileResult {
    match platform::choose_save_path(&request.default_name, request.default_dir.as_deref()) {
        Ok(Some(path)) => match render_html_to_pdf(&request.html, &path) {
            Ok(()) => SaveTextFileResult {
                saved: true,
                path: Some(path.display().to_string()),
                error: None,
            },
            Err(error) => SaveTextFileResult {
                saved: false,
                path: Some(path.display().to_string()),
                error: Some(error),
            },
        },
        Ok(None) => SaveTextFileResult {
            saved: false,
            path: None,
            error: None,
        },
        Err(error) => SaveTextFileResult {
            saved: false,
            path: None,
            error: Some(error),
        },
    }
}

#[tauri::command]
fn default_engine_profile(app: AppHandle) -> EngineProfileCandidate {
    engine_discovery::discover_engine(&app, None).selected
}

#[tauri::command]
fn discover_engine_profile(
    app: AppHandle,
    profile: Option<EngineProfile>,
) -> EngineDiscoveryResult {
    engine_discovery::discover_engine(&app, profile)
}

#[tauri::command]
fn choose_engine_path(request: ChoosePathRequest) -> ChoosePathResult {
    match platform::choose_file_path(&request.kind) {
        Ok(Some(path)) => ChoosePathResult {
            selected: true,
            path: Some(path.display().to_string()),
            error: None,
        },
        Ok(None) => ChoosePathResult {
            selected: false,
            path: None,
            error: None,
        },
        Err(error) => ChoosePathResult {
            selected: false,
            path: None,
            error: Some(error),
        },
    }
}

#[tauri::command]
fn choose_game_record_files() -> ChooseFilesResult {
    match platform::choose_game_record_paths() {
        Ok(paths) => ChooseFilesResult {
            selected: !paths.is_empty(),
            paths: paths
                .into_iter()
                .map(|path| path.display().to_string())
                .collect(),
            error: None,
        },
        Err(error) => ChooseFilesResult {
            selected: false,
            paths: Vec::new(),
            error: Some(error),
        },
    }
}

#[tauri::command]
fn choose_output_directory() -> ChooseDirectoryResult {
    match platform::choose_directory_path() {
        Ok(Some(path)) => ChooseDirectoryResult {
            selected: true,
            path: Some(path.display().to_string()),
            error: None,
        },
        Ok(None) => ChooseDirectoryResult {
            selected: false,
            path: None,
            error: None,
        },
        Err(error) => ChooseDirectoryResult {
            selected: false,
            path: None,
            error: Some(error),
        },
    }
}

#[tauri::command]
fn read_text_file(path: String) -> ReadTextFileResult {
    match std::fs::read_to_string(path) {
        Ok(content) => ReadTextFileResult {
            ok: true,
            content: Some(content),
            error: None,
        },
        Err(error) => ReadTextFileResult {
            ok: false,
            content: None,
            error: Some(error.to_string()),
        },
    }
}

#[tauri::command]
fn write_text_file(request: WriteTextFileRequest) -> WriteTextFileResult {
    match std::fs::write(request.path, request.content) {
        Ok(()) => WriteTextFileResult {
            ok: true,
            error: None,
        },
        Err(error) => WriteTextFileResult {
            ok: false,
            error: Some(error.to_string()),
        },
    }
}

#[tauri::command]
fn probe_engine(app: AppHandle, profile: EngineProfile) -> EngineProbeResult {
    let mut diagnostics = Vec::new();
    diagnostics.push(format!("profile: {}", profile.name));
    match platform::engine_runtime_dir(&app) {
        Ok(path) => diagnostics.push(format!("runtime dir: {}", path.display())),
        Err(error) => diagnostics.push(format!("runtime dir unavailable: {}", error)),
    }

    if is_manual_command_profile(&profile) {
        diagnostics.push(format!("manual command: {}", profile.command_line));
        return run_engine_start_test(&app, &profile, diagnostics);
    }

    for (label, path) in [
        ("katago", profile.executable_path.as_str()),
        ("model", profile.model_path.as_str()),
        ("config", profile.config_path.as_str()),
    ] {
        if std::path::Path::new(path).exists() {
            diagnostics.push(format!("OK {}: {}", label, path));
        } else {
            diagnostics.push(format!("MISSING {}: {}", label, path));
        }
    }

    match Command::new(&profile.executable_path)
        .arg("version")
        .output()
    {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            diagnostics.push(stdout.clone());

            if !std::path::Path::new(&profile.model_path).exists()
                || !std::path::Path::new(&profile.config_path).exists()
            {
                return EngineProbeResult {
                    ok: false,
                    summary: "模型或配置文件不存在".to_string(),
                    diagnostics: diagnostics.join("\n"),
                };
            }

            diagnostics.push("version probe: OK".to_string());
            run_engine_start_test(&app, &profile, diagnostics)
        }
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            diagnostics.push(format!("version exit status: {}", output.status));
            diagnostics.push(engine_status_report(
                &profile,
                Some(&output.status.to_string()),
            ));
            if !stdout.trim().is_empty() {
                diagnostics.push(stdout);
            }
            diagnostics.push(stderr.clone());
            diagnostics.push(engine_start_hint(&diagnostics.join("\n")));
            EngineProbeResult {
                ok: false,
                summary: "KataGo 启动失败".to_string(),
                diagnostics: diagnostics.join("\n"),
            }
        }
        Err(error) => EngineProbeResult {
            ok: false,
            summary: "无法执行 KataGo".to_string(),
            diagnostics: format!(
                "{}\n{}\n{}",
                diagnostics.join("\n"),
                error,
                engine_start_hint(&error.to_string())
            ),
        },
    }
}

fn run_engine_start_test(
    app: &AppHandle,
    profile: &EngineProfile,
    mut diagnostics: Vec<String>,
) -> EngineProbeResult {
    let runtime_dir = match platform::engine_runtime_dir(app) {
        Ok(path) => path,
        Err(error) => {
            diagnostics.push(error);
            return EngineProbeResult {
                ok: false,
                summary: "无法创建引擎运行目录".to_string(),
                diagnostics: diagnostics.join("\n"),
            };
        }
    };

    let mut command = match gtp_command(profile) {
        Ok(command) => command,
        Err(error) => {
            diagnostics.push(error);
            return EngineProbeResult {
                ok: false,
                summary: "手工命令解析失败".to_string(),
                diagnostics: diagnostics.join("\n"),
            };
        }
    };
    let mut child = match command
        .current_dir(&runtime_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(child) => child,
        Err(error) => {
            diagnostics.push(error.to_string());
            diagnostics.push(engine_start_hint(&error.to_string()));
            return EngineProbeResult {
                ok: false,
                summary: "KataGo GTP 启动失败".to_string(),
                diagnostics: diagnostics.join("\n"),
            };
        }
    };

    let mut stdin = child.stdin.take();
    let stdout_rx = spawn_line_reader(child.stdout.take(), "stdout");
    let stderr_rx = spawn_line_reader(child.stderr.take(), "stderr");
    let deadline = Instant::now() + Duration::from_millis(ENGINE_TEST_BOOT_WAIT_MS);
    let mut boot_log = Vec::new();
    let mut ready = false;

    while Instant::now() < deadline {
        boot_log.extend(drain_receiver(&stdout_rx));
        boot_log.extend(drain_receiver(&stderr_rx));
        if boot_log.iter().any(|line| line.contains("GTP ready")) {
            ready = true;
            break;
        }
        match child.try_wait() {
            Ok(Some(status)) => {
                boot_log.extend(drain_receiver(&stdout_rx));
                boot_log.extend(drain_receiver(&stderr_rx));
                diagnostics.push(format!("gtp exited during boot: {}", status));
                diagnostics.push(boot_log.join("\n"));
                diagnostics.push(engine_start_hint(&diagnostics.join("\n")));
                return EngineProbeResult {
                    ok: false,
                    summary: "KataGo GTP 启动期间退出".to_string(),
                    diagnostics: diagnostics.join("\n"),
                };
            }
            Ok(None) => thread::sleep(Duration::from_millis(80)),
            Err(error) => {
                diagnostics.push(error.to_string());
                return EngineProbeResult {
                    ok: false,
                    summary: "KataGo 状态检查失败".to_string(),
                    diagnostics: diagnostics.join("\n"),
                };
            }
        }
    }

    if let Some(stdin) = stdin.as_mut() {
        let _ = writeln!(stdin, "quit");
        let _ = stdin.flush();
    }
    let _ = child.kill();
    let _ = child.wait();

    boot_log.extend(drain_receiver(&stdout_rx));
    boot_log.extend(drain_receiver(&stderr_rx));
    diagnostics.push(boot_log.join("\n"));

    if ready {
        EngineProbeResult {
            ok: true,
            summary: "KataGo GTP 启动测试通过".to_string(),
            diagnostics: diagnostics.join("\n"),
        }
    } else {
        EngineProbeResult {
            ok: false,
            summary: "KataGo GTP 启动超时".to_string(),
            diagnostics: format!(
                "{}\n{}",
                diagnostics.join("\n"),
                engine_start_hint(&diagnostics.join("\n"))
            ),
        }
    }
}

fn engine_start_hint(log: &str) -> String {
    let lower = log.to_ascii_lowercase();
    let mut hints = Vec::new();
    if lower.contains("0xc0000135") {
        hints.push("Recommendation: Windows could not load a required runtime library. Verify the Microsoft Visual C++ Runtime, and if this is a CUDA build, verify the CUDA runtime and cuDNN libraries. To identify the exact missing DLL, open katago.exe using Dependencies.exe (modern Dependency Walker).");
    }
    if lower.contains("0xc000007b") {
        hints.push("Recommendation: Windows reported an invalid image format. Verify that KataGo and all runtime libraries are x64 and not mixed with 32-bit DLLs.");
    }
    if lower.contains("tuning") || lower.contains("timing cache") {
        hints.push("Note: GPU builds can tune or generate caches on first start. This can take seconds to minutes; later starts are usually faster.");
    }
    if lower.contains("dll") || lower.contains("126") || lower.contains("module could not be found")
    {
        hints.push("Recommendation: Windows reported a missing module. Keep the KataGo package fully extracted, preserve DLLs next to katago.exe, and verify required runtimes.");
    }
    if lower.contains("no cuda") || lower.contains("no gpu") || lower.contains("no devices") {
        hints.push("Recommendation: KataGo reported no usable GPU device. Check GPU drivers or use another KataGo backend.");
    }

    if hints.is_empty() {
        "Recommendation: Verify the KataGo package is fully extracted and that engine, model, and config paths are correct.".to_string()
    } else {
        hints.join("\n")
    }
}

fn engine_status_report(profile: &EngineProfile, exit_status: Option<&str>) -> String {
    let mut lines = Vec::new();
    lines.push("Engine Status".to_string());
    lines.push("".to_string());
    lines.push(status_line(
        "Engine executable found",
        std::path::Path::new(&profile.executable_path).exists(),
    ));
    lines.push(status_line(
        "Model found",
        std::path::Path::new(&profile.model_path).exists(),
    ));
    lines.push(status_line(
        "Config found",
        std::path::Path::new(&profile.config_path).exists(),
    ));
    lines.push(status_line("Profile", true));

    if let Some(status) = exit_status {
        lines.push(status_line("Engine startup failed", false));
        lines.push("".to_string());
        if let Some(code) = extract_windows_exit_code(status) {
            lines.push("Exit code:".to_string());
            lines.push(code.to_string());
            if let Some(info) = windows_exit_code_info(code) {
                lines.push("".to_string());
                lines.push("Meaning:".to_string());
                lines.push(info.name.to_string());
                lines.push("".to_string());
                lines.push(info.description.to_string());
                if !info.possible_missing_libraries.is_empty() {
                    lines.push("".to_string());
                    lines.push("Possible missing runtime libraries:".to_string());
                    for library in info.possible_missing_libraries {
                        lines.push(format!("- {}", library));
                    }
                    lines.push("".to_string());
                    lines.push(
                        "These are possible missing libraries, not a confirmed list.".to_string(),
                    );
                }
            }
        } else {
            lines.push("Exit status:".to_string());
            lines.push(status.to_string());
        }
    }

    lines.join("\n")
}

fn status_line(label: &str, ok: bool) -> String {
    format!("{} {}", if ok { "OK" } else { "FAIL" }, label)
}

struct WindowsExitCodeInfo {
    name: &'static str,
    description: &'static str,
    possible_missing_libraries: &'static [&'static str],
}

fn extract_windows_exit_code(status: &str) -> Option<&str> {
    let lower = status.to_ascii_lowercase();
    ["0xc0000135", "0xc000007b", "0xc0000005"]
        .into_iter()
        .find(|code| lower.contains(code))
}

fn windows_exit_code_info(code: &str) -> Option<WindowsExitCodeInfo> {
    match code.to_ascii_lowercase().as_str() {
        "0xc0000135" => Some(WindowsExitCodeInfo {
            name: "STATUS_DLL_NOT_FOUND",
            description: "Windows could not load one or more required DLLs before KataGo started.",
            possible_missing_libraries: &[
                "vcruntime140.dll",
                "msvcp140.dll",
                "cudart64_12.dll",
                "cublas64_12.dll",
                "cublasLt64_12.dll",
                "cudnn64_8.dll",
            ],
        }),
        "0xc000007b" => Some(WindowsExitCodeInfo {
            name: "STATUS_INVALID_IMAGE_FORMAT",
            description:
                "Windows loaded a binary or DLL with the wrong architecture or an invalid format.",
            possible_missing_libraries: &[],
        }),
        "0xc0000005" => Some(WindowsExitCodeInfo {
            name: "STATUS_ACCESS_VIOLATION",
            description: "The engine process crashed while accessing memory.",
            possible_missing_libraries: &[],
        }),
        _ => None,
    }
}

#[tauri::command]
fn analyze_position(
    app: AppHandle,
    state: tauri::State<EngineState>,
    request: AnalyzeRequest,
) -> AnalysisResult {
    let mut guard = match state.session.lock() {
        Ok(guard) => guard,
        Err(error) => {
            return AnalysisResult {
                ok: false,
                status: "engine-state-lock-failed".to_string(),
                candidates: Vec::new(),
                raw_output: String::new(),
                diagnostics: error.to_string(),
            };
        }
    };

    let profile_key = profile_key(&request.profile);
    if guard.as_ref().map(|session| session.profile_key.as_str()) != Some(profile_key.as_str()) {
        *guard = match start_engine_session(&app, &request.profile, &profile_key) {
            Ok(session) => Some(session),
            Err(result) => return result,
        };
    }
    if let Some(result) =
        restart_engine_if_memory_limit_exceeded(&app, &request.profile, &profile_key, &mut guard)
    {
        return result;
    }

    let session = match guard.as_mut() {
        Some(session) => session,
        None => {
            return AnalysisResult {
                ok: false,
                status: "engine-session-missing".to_string(),
                candidates: Vec::new(),
                raw_output: String::new(),
                diagnostics: "KataGo session missing after startup.".to_string(),
            };
        }
    };

    let position_key = request_position_key(&request);
    if session.continuous_analysis.is_some() {
        stop_continuous_session(session);
    }
    drain_receiver(&session.stdout_rx);
    drain_receiver(&session.stderr_rx);

    if let Err(error) = write_position_commands(session, &request) {
        *guard = None;
        return AnalysisResult {
            ok: false,
            status: "engine-command-failed".to_string(),
            candidates: Vec::new(),
            raw_output: String::new(),
            diagnostics: error,
        };
    }
    session.current_position_key = position_key;

    collect_analysis(session, request.max_visits)
}

#[tauri::command]
fn analyze_position_continuous(
    app: AppHandle,
    state: tauri::State<EngineState>,
    request: AnalyzeRequest,
) -> AnalysisResult {
    let mut guard = match state.session.lock() {
        Ok(guard) => guard,
        Err(error) => {
            return AnalysisResult {
                ok: false,
                status: "engine-state-lock-failed".to_string(),
                candidates: Vec::new(),
                raw_output: String::new(),
                diagnostics: error.to_string(),
            };
        }
    };

    let profile_key = profile_key(&request.profile);
    if guard.as_ref().map(|session| session.profile_key.as_str()) != Some(profile_key.as_str()) {
        *guard = match start_engine_session(&app, &request.profile, &profile_key) {
            Ok(session) => Some(session),
            Err(result) => return result,
        };
    }
    if let Some(result) =
        restart_engine_if_memory_limit_exceeded(&app, &request.profile, &profile_key, &mut guard)
    {
        return result;
    }

    let session = match guard.as_mut() {
        Some(session) => session,
        None => {
            return AnalysisResult {
                ok: false,
                status: "engine-session-missing".to_string(),
                candidates: Vec::new(),
                raw_output: String::new(),
                diagnostics: "KataGo session missing after startup.".to_string(),
            };
        }
    };

    let position_key = request_position_key(&request);
    if session
        .continuous_analysis
        .as_ref()
        .map(|analysis| analysis.position_key.as_str())
        != Some(position_key.as_str())
    {
        stop_continuous_session(session);
        if let Err(error) = write_continuous_position_commands(session, &request) {
            *guard = None;
            return AnalysisResult {
                ok: false,
                status: "engine-command-failed".to_string(),
                candidates: Vec::new(),
                raw_output: String::new(),
                diagnostics: error,
            };
        }
        session.current_position_key = position_key.clone();
        session.continuous_analysis = Some(ContinuousAnalysisState {
            position_key,
            candidates: Vec::new(),
            raw_output_tail: Vec::new(),
            diagnostics: "continuous KataGo analysis started".to_string(),
        });
    }

    collect_continuous_analysis_snapshot(session)
}

#[tauri::command]
fn stop_continuous_analysis(state: tauri::State<EngineState>) -> Result<(), String> {
    let mut guard = state
        .session
        .lock()
        .map_err(|error| format!("engine state lock failed: {}", error))?;
    if let Some(session) = guard.as_mut() {
        if session.continuous_analysis.is_some() {
            stop_continuous_session(session);
        }
    }
    Ok(())
}

fn restart_engine_if_memory_limit_exceeded(
    app: &AppHandle,
    profile: &EngineProfile,
    profile_key: &str,
    guard: &mut Option<EngineSession>,
) -> Option<AnalysisResult> {
    let memory_bytes = guard
        .as_ref()
        .and_then(|session| engine_resident_memory_bytes(session.child.id()));
    if !matches!(memory_bytes, Some(bytes) if bytes > ENGINE_MEMORY_SOFT_LIMIT_BYTES) {
        return None;
    }

    let memory_bytes = memory_bytes.unwrap_or(0);
    *guard = None;
    match start_engine_session(app, profile, profile_key) {
        Ok(session) => {
            *guard = Some(session);
            None
        }
        Err(mut result) => {
            result.diagnostics = format!(
                "KataGo memory guard restarted the engine after it reached {:.1} GB.\n{}",
                memory_bytes as f64 / 1024.0 / 1024.0 / 1024.0,
                result.diagnostics
            );
            Some(result)
        }
    }
}

fn stop_continuous_session(session: &mut EngineSession) {
    let _ = writeln!(session.stdin, "stop");
    let _ = session.stdin.flush();
    wait_after_stop(session);
    session.continuous_analysis = None;
    drain_receiver(&session.stdout_rx);
    drain_receiver(&session.stderr_rx);
}

fn wait_after_stop(session: &mut EngineSession) {
    let deadline = Instant::now() + Duration::from_millis(250);
    while Instant::now() < deadline {
        drain_receiver(&session.stdout_rx);
        drain_receiver(&session.stderr_rx);
        if matches!(session.child.try_wait(), Ok(Some(_))) {
            break;
        }
        thread::sleep(Duration::from_millis(25));
    }
}

fn terminate_engine_process(session: &mut EngineSession) {
    let _ = writeln!(session.stdin, "stop");
    let _ = writeln!(session.stdin, "quit");
    let _ = session.stdin.flush();

    let deadline = Instant::now() + Duration::from_millis(750);
    while Instant::now() < deadline {
        match session.child.try_wait() {
            Ok(Some(_)) => return,
            Ok(None) => thread::sleep(Duration::from_millis(25)),
            Err(_) => break,
        }
    }

    let _ = session.child.kill();
    let _ = session.child.wait();
}

fn start_engine_session(
    app: &AppHandle,
    profile: &EngineProfile,
    profile_key: &str,
) -> Result<EngineSession, AnalysisResult> {
    let runtime_dir = match platform::engine_runtime_dir(app) {
        Ok(path) => path,
        Err(error) => {
            return Err(AnalysisResult {
                ok: false,
                status: "engine-runtime-dir-failed".to_string(),
                candidates: Vec::new(),
                raw_output: String::new(),
                diagnostics: format!("无法创建 KataGo 运行目录: {}", error),
            });
        }
    };

    let mut command = match gtp_command(profile) {
        Ok(command) => command,
        Err(error) => {
            return Err(AnalysisResult {
                ok: false,
                status: "engine-command-parse-failed".to_string(),
                candidates: Vec::new(),
                raw_output: String::new(),
                diagnostics: error,
            });
        }
    };
    command
        .current_dir(&runtime_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = match command.spawn() {
        Ok(child) => child,
        Err(error) => {
            return Err(AnalysisResult {
                ok: false,
                status: "engine-start-failed".to_string(),
                candidates: Vec::new(),
                raw_output: String::new(),
                diagnostics: format!("runtime dir: {}\n{}", runtime_dir.display(), error),
            });
        }
    };

    let stdin = match child.stdin.take() {
        Some(stdin) => stdin,
        None => {
            return Err(AnalysisResult {
                ok: false,
                status: "engine-stdin-missing".to_string(),
                candidates: Vec::new(),
                raw_output: String::new(),
                diagnostics: "KataGo stdin unavailable.".to_string(),
            });
        }
    };
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let stdout_rx = spawn_line_reader(stdout, "stdout");
    let stderr_rx = spawn_line_reader(stderr, "stderr");
    let boot_deadline = Instant::now() + Duration::from_millis(ANALYSIS_BOOT_WAIT_MS);
    let mut boot_log = Vec::new();
    let mut ready = false;
    while Instant::now() < boot_deadline {
        let mut new_lines = drain_receiver(&stdout_rx);
        new_lines.extend(drain_receiver(&stderr_rx));
        for line in &new_lines {
            if line.contains("Performing autotuning") || line.contains("Tuning ") {
                boot_log.push(line.clone());
            }
        }
        boot_log.extend(new_lines);
        if boot_log.iter().any(|line| line.contains("GTP ready")) {
            ready = true;
            break;
        }
        match child.try_wait() {
            Ok(Some(status)) => {
                boot_log.extend(drain_receiver(&stdout_rx));
                boot_log.extend(drain_receiver(&stderr_rx));
                return Err(AnalysisResult {
                    ok: false,
                    status: "engine-exited-during-boot".to_string(),
                    candidates: Vec::new(),
                    raw_output: String::new(),
                    diagnostics: format!(
                        "KataGo 启动期间退出，退出状态: {}\n{}",
                        status,
                        boot_log.join("\n")
                    ),
                });
            }
            Ok(None) => {}
            Err(error) => {
                return Err(AnalysisResult {
                    ok: false,
                    status: "engine-status-failed".to_string(),
                    candidates: Vec::new(),
                    raw_output: String::new(),
                    diagnostics: format!("检查 KataGo 进程状态失败: {}", error),
                });
            }
        }
        thread::sleep(Duration::from_millis(100));
    }
    if !ready {
        let tuning_hint = if boot_log
            .iter()
            .any(|line| line.contains("Performing autotuning"))
        {
            "\nKataGo 正在进行首次 OpenCL 调优，可能需要几分钟，请等待缓存生成后重试。"
        } else {
            ""
        };
        return Err(AnalysisResult {
            ok: false,
            status: "engine-boot-timeout".to_string(),
            candidates: Vec::new(),
            raw_output: String::new(),
            diagnostics: format!(
                "KataGo 在 {} 秒内未输出 GTP ready 信号。{}\n{}",
                ANALYSIS_BOOT_WAIT_MS / 1000,
                tuning_hint,
                boot_log.join("\n")
            ),
        });
    }
    Ok(EngineSession {
        profile_key: profile_key.to_string(),
        current_position_key: String::new(),
        continuous_analysis: None,
        stdin,
        stdout_rx,
        stderr_rx,
        child,
    })
}

fn write_position_commands(
    session: &mut EngineSession,
    request: &AnalyzeRequest,
) -> Result<(), String> {
    write_position_commands_with_visits(session, request, request.max_visits)
}

fn write_position_commands_with_visits(
    session: &mut EngineSession,
    request: &AnalyzeRequest,
    max_visits: usize,
) -> Result<(), String> {
    writeln!(session.stdin, "boardsize {}", request.board_size)
        .map_err(|error| error.to_string())?;
    writeln!(session.stdin, "komi {}", request.komi).map_err(|error| error.to_string())?;
    writeln!(session.stdin, "clear_board").map_err(|error| error.to_string())?;
    for game_move in &request.moves {
        let color = if game_move.color == "black" { "B" } else { "W" };
        writeln!(
            session.stdin,
            "play {} {}",
            color,
            to_gtp_point(game_move.x, game_move.y, request.board_size)
        )
        .map_err(|error| error.to_string())?;
    }
    let next_color = if request.next_color == "black" {
        "B"
    } else {
        "W"
    };
    let max_visits = max_visits.clamp(1, 10000);
    writeln!(session.stdin, "kata-analyze {} {}", next_color, max_visits)
        .map_err(|error| error.to_string())?;
    session.stdin.flush().map_err(|error| error.to_string())
}

fn write_continuous_position_commands(
    session: &mut EngineSession,
    request: &AnalyzeRequest,
) -> Result<(), String> {
    writeln!(session.stdin, "boardsize {}", request.board_size)
        .map_err(|error| error.to_string())?;
    writeln!(session.stdin, "komi {}", request.komi).map_err(|error| error.to_string())?;
    writeln!(session.stdin, "clear_board").map_err(|error| error.to_string())?;
    for game_move in &request.moves {
        let color = if game_move.color == "black" { "B" } else { "W" };
        writeln!(
            session.stdin,
            "play {} {}",
            color,
            to_gtp_point(game_move.x, game_move.y, request.board_size)
        )
        .map_err(|error| error.to_string())?;
    }
    let next_color = if request.next_color == "black" {
        "B"
    } else {
        "W"
    };
    writeln!(
        session.stdin,
        "lz-analyze {} {}",
        next_color, CONTINUOUS_ANALYSIS_INTERVAL_CS
    )
    .map_err(|error| error.to_string())?;
    session.stdin.flush().map_err(|error| error.to_string())
}

fn collect_continuous_analysis_snapshot(session: &mut EngineSession) -> AnalysisResult {
    let stdout_lines = drain_receiver(&session.stdout_rx);
    let stderr_lines = drain_receiver(&session.stderr_rx);
    match session.child.try_wait() {
        Ok(Some(status)) => {
            let raw_output = stdout_lines.join("\n");
            let diagnostics = format!(
                "KataGo 持续分析期间退出，退出状态: {}\n{}",
                status,
                stderr_lines.join("\n")
            );
            session.continuous_analysis = None;
            return AnalysisResult {
                ok: false,
                status: "engine-exited-during-analysis".to_string(),
                candidates: Vec::new(),
                raw_output,
                diagnostics,
            };
        }
        Ok(None) => {}
        Err(error) => {
            return AnalysisResult {
                ok: false,
                status: "engine-status-failed".to_string(),
                candidates: Vec::new(),
                raw_output: stdout_lines.join("\n"),
                diagnostics: format!("检查 KataGo 进程状态失败: {}", error),
            };
        }
    }

    let analysis = match session.continuous_analysis.as_mut() {
        Some(analysis) => analysis,
        None => {
            return AnalysisResult {
                ok: false,
                status: "continuous-analysis-missing".to_string(),
                candidates: Vec::new(),
                raw_output: stdout_lines.join("\n"),
                diagnostics: "No continuous analysis is active.".to_string(),
            };
        }
    };

    if !stdout_lines.is_empty() {
        analysis.raw_output_tail.extend(stdout_lines);
        let overflow = analysis.raw_output_tail.len().saturating_sub(160);
        if overflow > 0 {
            analysis.raw_output_tail.drain(0..overflow);
        }
        let parsed = parse_analysis_output(
            &analysis.raw_output_tail.join("\n"),
            WinrateScale::LizzieCentipercent,
        );
        if !parsed.is_empty() {
            analysis.candidates = parsed;
        }
    }
    if !stderr_lines.is_empty() {
        analysis.diagnostics = stderr_lines.join("\n");
    }

    AnalysisResult {
        ok: !analysis.candidates.is_empty(),
        status: if analysis.candidates.is_empty() {
            "waiting-for-candidates"
        } else {
            "analyzed"
        }
        .to_string(),
        candidates: analysis.candidates.clone(),
        raw_output: analysis.raw_output_tail.join("\n"),
        diagnostics: format!("continuous KataGo session\n{}", analysis.diagnostics),
    }
}

fn collect_analysis(session: &mut EngineSession, max_visits: usize) -> AnalysisResult {
    let collect_ms = (max_visits as u64)
        .saturating_mul(6)
        .clamp(ANALYSIS_COLLECT_MIN_MS, ANALYSIS_COLLECT_MAX_MS);
    let deadline = Instant::now() + Duration::from_millis(collect_ms);
    let mut stdout_lines = Vec::new();
    let mut stderr_lines = Vec::new();
    while Instant::now() < deadline {
        stdout_lines.extend(drain_receiver(&session.stdout_rx));
        stderr_lines.extend(drain_receiver(&session.stderr_rx));
        match session.child.try_wait() {
            Ok(Some(status)) => {
                stdout_lines.extend(drain_receiver(&session.stdout_rx));
                stderr_lines.extend(drain_receiver(&session.stderr_rx));
                return AnalysisResult {
                    ok: false,
                    status: "engine-exited-during-analysis".to_string(),
                    candidates: Vec::new(),
                    raw_output: stdout_lines.join("\n"),
                    diagnostics: format!(
                        "KataGo 分析期间退出，退出状态: {}\n{}",
                        status,
                        stderr_lines.join("\n")
                    ),
                };
            }
            Ok(None) => {}
            Err(error) => {
                return AnalysisResult {
                    ok: false,
                    status: "engine-status-failed".to_string(),
                    candidates: Vec::new(),
                    raw_output: stdout_lines.join("\n"),
                    diagnostics: format!("检查 KataGo 进程状态失败: {}", error),
                };
            }
        }
        if stdout_lines.iter().any(|line| line.contains("info move")) {
            thread::sleep(Duration::from_millis(25));
            stdout_lines.extend(drain_receiver(&session.stdout_rx));
            break;
        }
        thread::sleep(Duration::from_millis(15));
    }
    let stdout = stdout_lines.join("\n");
    let stderr = stderr_lines.join("\n");
    let candidates = parse_analysis_output(&stdout, WinrateScale::KataAnalyzeProbability);
    AnalysisResult {
        ok: !candidates.is_empty(),
        status: if candidates.is_empty() {
            "no-candidates"
        } else {
            "analyzed"
        }
        .to_string(),
        candidates,
        raw_output: stdout,
        diagnostics: format!(
            "persistent KataGo session\nanalysis collect: {} ms\n{}",
            collect_ms, stderr
        ),
    }
}

fn spawn_line_reader(
    stream: Option<impl std::io::Read + Send + 'static>,
    label: &'static str,
) -> Receiver<String> {
    let (tx, rx) = mpsc::channel();
    if let Some(stream) = stream {
        thread::spawn(move || {
            for line in BufReader::new(stream).lines() {
                match line {
                    Ok(line) => {
                        let _ = tx.send(line);
                    }
                    Err(error) => {
                        let _ = tx.send(format!("{} read error: {}", label, error));
                        break;
                    }
                }
            }
        });
    }
    rx
}

fn drain_receiver(rx: &Receiver<String>) -> Vec<String> {
    let mut lines = Vec::new();
    while let Ok(line) = rx.try_recv() {
        lines.push(line);
    }
    lines
}

fn engine_resident_memory_bytes(pid: u32) -> Option<u64> {
    let output = Command::new("ps")
        .args(["-o", "rss=", "-p", &pid.to_string()])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let rss_kb = stdout.trim().parse::<u64>().ok()?;
    Some(rss_kb.saturating_mul(1024))
}

fn gtp_command(profile: &EngineProfile) -> Result<Command, String> {
    if is_manual_command_profile(profile) {
        let parts = split_command_line(&profile.command_line)?;
        let (program, args) = parts
            .split_first()
            .ok_or_else(|| "手工命令为空".to_string())?;
        let mut command = Command::new(program);
        command.args(args);
        return Ok(command);
    }

    let mut command = Command::new(&profile.executable_path);
    command.args([
        "gtp",
        "-model",
        &profile.model_path,
        "-config",
        &profile.config_path,
    ]);
    Ok(command)
}

fn is_manual_command_profile(profile: &EngineProfile) -> bool {
    !profile.command_line.trim().is_empty() && profile.executable_path.trim().is_empty()
}

fn split_command_line(input: &str) -> Result<Vec<String>, String> {
    let mut parts = Vec::new();
    let mut current = String::new();
    let mut chars = input.chars().peekable();
    let mut quote: Option<char> = None;

    while let Some(ch) = chars.next() {
        match ch {
            '\\' => current.push(ch),
            '"' | '\'' => {
                if quote == Some(ch) {
                    quote = None;
                } else if quote.is_none() {
                    quote = Some(ch);
                } else {
                    current.push(ch);
                }
            }
            ch if ch.is_whitespace() && quote.is_none() => {
                if !current.is_empty() {
                    parts.push(current.clone());
                    current.clear();
                }
            }
            _ => current.push(ch),
        }
    }

    if let Some(open_quote) = quote {
        return Err(format!("手工命令引号未闭合: {}", open_quote));
    }
    if !current.is_empty() {
        parts.push(current);
    }
    if parts.is_empty() {
        Err("手工命令为空".to_string())
    } else {
        Ok(parts)
    }
}

fn profile_key(profile: &EngineProfile) -> String {
    if !profile.command_line.trim().is_empty() {
        return format!("manual:{}", profile.command_line.trim());
    }
    format!(
        "{}|{}|{}",
        profile.executable_path, profile.model_path, profile.config_path
    )
}

fn request_position_key(request: &AnalyzeRequest) -> String {
    let moves = request
        .moves
        .iter()
        .map(|game_move| format!("{}:{}:{}", game_move.color, game_move.x, game_move.y))
        .collect::<Vec<_>>()
        .join("|");
    format!(
        "{}:{}:{}:{}",
        request.board_size, request.komi, request.next_color, moves
    )
}

fn to_gtp_point(x: usize, y: usize, board_size: usize) -> String {
    const LABELS: &[u8] = b"ABCDEFGHJKLMNOPQRSTUVWXYZ";
    let col = LABELS.get(x).copied().unwrap_or(b'?') as char;
    let row = board_size.saturating_sub(y);
    format!("{}{}", col, row)
}

#[derive(Clone, Copy, Debug)]
enum WinrateScale {
    KataAnalyzeProbability,
    LizzieCentipercent,
}

fn parse_analysis_output(output: &str, winrate_scale: WinrateScale) -> Vec<CandidateMove> {
    let mut candidates: Vec<CandidateMove> = Vec::new();
    for line in output.lines().filter(|line| line.contains("info move")) {
        for segment in line.split(" info ") {
            let normalized = if segment.starts_with("info ") {
                segment.to_string()
            } else if segment.starts_with("move ") {
                format!("info {}", segment)
            } else {
                continue;
            };
            if let Some(candidate) =
                parse_candidate_line(&normalized, candidates.len() + 1, winrate_scale)
            {
                if let Some(existing) = candidates
                    .iter_mut()
                    .find(|item| item.move_name == candidate.move_name)
                {
                    if candidate.visits >= existing.visits {
                        *existing = candidate;
                    }
                } else {
                    candidates.push(candidate);
                }
            }
        }
    }

    candidates.sort_by(|left, right| right.visits.cmp(&left.visits));
    for (index, candidate) in candidates.iter_mut().enumerate() {
        candidate.rank = index + 1;
    }
    candidates.truncate(12);
    candidates
}

fn parse_candidate_line(
    line: &str,
    rank: usize,
    winrate_scale: WinrateScale,
) -> Option<CandidateMove> {
    let move_name = token_after(line, "move")?;
    let visits = token_after(line, "visits")
        .and_then(|value| value.parse::<usize>().ok())
        .unwrap_or(0);
    let winrate = token_after(line, "winrate")
        .and_then(|value| value.parse::<f64>().ok())
        .map(|value| normalize_winrate(value, winrate_scale))
        .unwrap_or(0.0);
    // `kata-analyze` reports scoreLead; continuous `lz-analyze` reports
    // scoreMean. Both represent the engine's expected score at this point.
    let score_lead = token_after(line, "scoreLead")
        .or_else(|| token_after(line, "scoreMean"))
        .and_then(|value| value.parse::<f64>().ok())
        .unwrap_or(0.0);
    let pv = tokens_after_until_keyword(line, "pv");
    Some(CandidateMove {
        rank,
        move_name,
        visits,
        winrate,
        score_lead,
        pv,
    })
}

fn normalize_winrate(value: f64, scale: WinrateScale) -> f64 {
    match scale {
        WinrateScale::KataAnalyzeProbability => {
            if value <= 1.0 {
                value * 100.0
            } else if value <= 100.0 {
                value
            } else {
                value / 100.0
            }
        }
        WinrateScale::LizzieCentipercent => value / 100.0,
    }
    .clamp(0.0, 100.0)
}

fn render_html_to_pdf(html: &str, pdf_path: &PathBuf) -> Result<(), String> {
    let chrome_path = find_chrome_executable()
        .ok_or_else(|| "未找到 Google Chrome，暂时无法导出 PDF。".to_string())?;
    if let Some(parent) = pdf_path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let temp_dir = std::env::temp_dir().join(format!(
        "tensugo-pdf-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|error| error.to_string())?
            .as_millis()
    ));
    std::fs::create_dir_all(&temp_dir).map_err(|error| error.to_string())?;
    let html_path = temp_dir.join("research.html");
    let profile_dir = temp_dir.join("chrome-profile");
    std::fs::write(&html_path, html).map_err(|error| error.to_string())?;

    let mut child = Command::new(chrome_path)
        .arg("--headless=new")
        .arg("--no-sandbox")
        .arg("--disable-gpu")
        .arg(format!("--user-data-dir={}", profile_dir.display()))
        .arg(format!("--print-to-pdf={}", pdf_path.display()))
        .arg(format!("file://{}", html_path.display()))
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| error.to_string())?;

    let start = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(_status)) => {
                let output = child
                    .wait_with_output()
                    .map_err(|error| error.to_string())?;
                let _ = std::fs::remove_dir_all(&temp_dir);
                if output.status.success() && pdf_path.exists() {
                    return Ok(());
                }
                return Err(format!(
                    "Chrome PDF 导出失败，退出码: {} stderr: {} stdout: {}",
                    output.status,
                    String::from_utf8_lossy(&output.stderr).trim(),
                    String::from_utf8_lossy(&output.stdout).trim()
                ));
            }
            Ok(None) if start.elapsed() > Duration::from_millis(PDF_EXPORT_TIMEOUT_MS) => {
                let _ = child.kill();
                let _ = child.wait();
                let _ = std::fs::remove_dir_all(&temp_dir);
                return Err(
                    "Chrome PDF 导出超时。请确认 Chrome 没有卡在权限弹窗或后台启动失败。"
                        .to_string(),
                );
            }
            Ok(None) => thread::sleep(Duration::from_millis(100)),
            Err(error) => {
                let _ = child.kill();
                let _ = std::fs::remove_dir_all(&temp_dir);
                return Err(error.to_string());
            }
        }
    }
}

fn find_chrome_executable() -> Option<PathBuf> {
    [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ]
    .iter()
    .map(PathBuf::from)
    .find(|path| path.exists())
}

fn token_after(line: &str, key: &str) -> Option<String> {
    let mut tokens = line.split_whitespace();
    while let Some(token) = tokens.next() {
        if token == key {
            return tokens.next().map(str::to_string);
        }
    }
    None
}

fn tokens_after_until_keyword(line: &str, key: &str) -> Vec<String> {
    const STOP_KEYS: &[&str] = &[
        "info",
        "move",
        "visits",
        "winrate",
        "scoreLead",
        "scoreStdev",
        "utility",
        "prior",
        "lcb",
        "order",
        "pvVisits",
    ];

    let mut tokens = line.split_whitespace();
    let mut collecting = false;
    let mut values = Vec::new();

    while let Some(token) = tokens.next() {
        if token == key {
            collecting = true;
            continue;
        }
        if collecting {
            if STOP_KEYS.contains(&token) {
                break;
            }
            values.push(token.to_string());
        }
    }

    values
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lz_analyze_winrate_uses_centipercent_scale_below_one_percent() {
        let output = "info move G16 visits 53 winrate 53 scoreLead -120.5 pv G16 H16";

        let candidates = parse_analysis_output(output, WinrateScale::LizzieCentipercent);

        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].move_name, "G16");
        assert!((candidates[0].winrate - 0.53).abs() < 0.001);
        assert_eq!(candidates[0].score_lead, -120.5);
    }

    #[test]
    fn lz_analyze_winrate_uses_centipercent_scale_near_forced_win() {
        let output = "info move L12 visits 262 winrate 9940 scoreLead 129.0 pv L12 K11";

        let candidates = parse_analysis_output(output, WinrateScale::LizzieCentipercent);

        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].move_name, "L12");
        assert!((candidates[0].winrate - 99.4).abs() < 0.001);
    }

    #[test]
    fn kata_analyze_probability_scale_keeps_existing_probability_behavior() {
        let output = "info move K11 visits 658 winrate 0.53 scoreLead 129.0 pv K11 L12";

        let candidates = parse_analysis_output(output, WinrateScale::KataAnalyzeProbability);

        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].move_name, "K11");
        assert!((candidates[0].winrate - 53.0).abs() < 0.001);
    }

    #[test]
    fn lz_analyze_uses_score_mean_when_score_lead_is_absent() {
        let output = "info move K11 visits 658 winrate 0.53 scoreMean -3.4 pv K11 L12";

        let candidates = parse_analysis_output(output, WinrateScale::LizzieCentipercent);

        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].score_lead, -3.4);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(EngineState {
            session: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            app_name,
            platform_paths,
            save_text_file_with_dialog,
            save_pdf_with_dialog,
            choose_game_record_files,
            choose_output_directory,
            read_text_file,
            write_text_file,
            default_engine_profile,
            discover_engine_profile,
            choose_engine_path,
            probe_engine,
            analyze_position,
            analyze_position_continuous,
            stop_continuous_analysis
        ])
        .run(tauri::generate_context!())
        .expect("failed to run TensuGo");
}
