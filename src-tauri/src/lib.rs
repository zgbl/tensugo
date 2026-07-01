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
fn probe_engine(app: AppHandle, profile: EngineProfile) -> EngineProbeResult {
    let mut diagnostics = Vec::new();
    diagnostics.push(format!("profile: {}", profile.name));
    match platform::engine_runtime_dir(&app) {
        Ok(path) => diagnostics.push(format!("runtime dir: {}", path.display())),
        Err(error) => diagnostics.push(format!("runtime dir unavailable: {}", error)),
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
            if !stdout.trim().is_empty() {
                diagnostics.push(stdout);
            }
            diagnostics.push(stderr.clone());
            diagnostics.push(engine_start_hint(&stderr));
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

    let mut child = match Command::new(&profile.executable_path)
        .current_dir(&runtime_dir)
        .args([
            "gtp",
            "-model",
            &profile.model_path,
            "-config",
            &profile.config_path,
        ])
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
    if log.trim().is_empty() {
        hints.push("提示: KataGo 未输出错误信息就退出。CUDA/cuDNN/NVIDIA 驱动或 VC++ 运行库不匹配时，Windows 可能只返回退出码而不写 stderr。请先在命令行运行 `katago.exe version`，并确认下载的是适合本机 CUDA/显卡驱动的版本。");
    }
    if lower.contains("cudart")
        || lower.contains("cudnn")
        || lower.contains("cuda")
        || lower.contains("nvcuda")
        || lower.contains("tensorrt")
    {
        hints.push("提示: 当前 KataGo 是 CUDA/GPU 版本。请确认已安装匹配的 NVIDIA 驱动、CUDA Runtime 和 cuDNN，并优先使用 NVIDIA 10xx-50xx 系列独显运行。GTX 1080 建议优先使用 CUDA 版，不要选择 TensorRT 专用包。");
    }
    if lower.contains("tuning") || lower.contains("timing cache") {
        hints.push("提示: GPU 版 KataGo 首次启动可能会进行调优或生成缓存，耗时数十秒到数分钟。缓存生成后后续启动会明显变快。");
    }
    if lower.contains("dll") || lower.contains("126") || lower.contains("module could not be found")
    {
        hints.push("提示: Windows 报 DLL 缺失时，通常需要把 KataGo 发布包完整解压，保留 exe 同目录下的所有 dll，或安装对应 VC++/CUDA 运行库。");
    }
    if lower.contains("no cuda") || lower.contains("no gpu") || lower.contains("no devices") {
        hints.push(
            "提示: 没有检测到可用 NVIDIA GPU。请检查显卡驱动，或之后改用 CPU/OpenCL 版本 KataGo。",
        );
    }

    if hints.is_empty() {
        "提示: 如果这是新下载的 GPU 版 KataGo，请确认发布包完整解压，模型文件与 GTP 配置文件路径正确。".to_string()
    } else {
        hints.join("\n")
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
        let _ = writeln!(session.stdin, "stop");
        let _ = session.stdin.flush();
        session.continuous_analysis = None;
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
        let _ = writeln!(session.stdin, "stop");
        let _ = session.stdin.flush();
        drain_receiver(&session.stdout_rx);
        drain_receiver(&session.stderr_rx);
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
            writeln!(session.stdin, "stop").map_err(|error| error.to_string())?;
            session.stdin.flush().map_err(|error| error.to_string())?;
            session.continuous_analysis = None;
            drain_receiver(&session.stdout_rx);
            drain_receiver(&session.stderr_rx);
        }
    }
    Ok(())
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

    let mut command = Command::new(&profile.executable_path);
    command
        .current_dir(&runtime_dir)
        .args([
            "gtp",
            "-model",
            &profile.model_path,
            "-config",
            &profile.config_path,
        ])
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
        let parsed = parse_analysis_output(&analysis.raw_output_tail.join("\n"));
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
    let candidates = parse_analysis_output(&stdout);
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

fn profile_key(profile: &EngineProfile) -> String {
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

fn parse_analysis_output(output: &str) -> Vec<CandidateMove> {
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
            if let Some(candidate) = parse_candidate_line(&normalized, candidates.len() + 1) {
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

fn parse_candidate_line(line: &str, rank: usize) -> Option<CandidateMove> {
    let move_name = token_after(line, "move")?;
    let visits = token_after(line, "visits")
        .and_then(|value| value.parse::<usize>().ok())
        .unwrap_or(0);
    let winrate = token_after(line, "winrate")
        .and_then(|value| value.parse::<f64>().ok())
        .map(normalize_winrate)
        .unwrap_or(0.0);
    let score_lead = token_after(line, "scoreLead")
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

fn normalize_winrate(value: f64) -> f64 {
    if value <= 1.0 {
        value * 100.0
    } else if value <= 100.0 {
        value
    } else {
        value / 100.0
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(EngineState {
            session: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            app_name,
            platform_paths,
            save_text_file_with_dialog,
            save_pdf_with_dialog,
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
