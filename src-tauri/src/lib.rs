mod engine_discovery;
mod platform;

use engine_discovery::{EngineDiscoveryResult, EngineProfile, EngineProfileCandidate};
use postgres::NoTls;
use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::mpsc::{self, Receiver};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::AppHandle;

const ANALYSIS_COLLECT_MIN_MS: u64 = 120;
const ANALYSIS_COLLECT_MAX_MS: u64 = 15_000;
const CONTINUOUS_ANALYSIS_INTERVAL_CS: usize = 30;
const ANALYSIS_BOOT_WAIT_MS: u64 = 300_000;
const ENGINE_TEST_BOOT_WAIT_MS: u64 = 180_000;
const PDF_EXPORT_TIMEOUT_MS: u64 = 45_000;
const ENGINE_MEMORY_SOFT_LIMIT_BYTES: u64 = 12 * 1024 * 1024 * 1024;
const GENMOVE_VISITS_TIMEOUT_MS: u64 = 600_000;
const ANALYSIS_STOP_TIMEOUT_MS: u64 = 15_000;

struct EngineState {
    cancel_generation: Arc<AtomicBool>,
    session: Arc<Mutex<Option<EngineSession>>>,
    machine_sessions: Arc<Mutex<Vec<Option<EngineSession>>>>,
    problem_session: Arc<Mutex<Option<EngineSession>>>,
    batch_keep_awake: Mutex<Option<Child>>,
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
    x: isize,
    y: isize,
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

#[derive(Debug, Deserialize)]
struct GenerateMoveRequest {
    profile: EngineProfile,
    board_size: usize,
    komi: f64,
    max_time_seconds: f64,
    max_visits: usize,
    moves: Vec<AnalyzeMove>,
    next_color: String,
    search_limit: String,
    #[serde(default)]
    engine_slot: Option<String>,
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

#[derive(Debug, Serialize)]
struct GenerateMoveResult {
    ok: bool,
    status: String,
    move_name: Option<String>,
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
struct ReadFileBytesResult {
    ok: bool,
    content: Option<Vec<u8>>,
    error: Option<String>,
}

#[derive(Debug, Serialize)]
struct WriteTextFileResult {
    ok: bool,
    error: Option<String>,
}

#[derive(Debug, Serialize)]
struct SaveProblemResult {
    ok: bool,
    error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProblemLibraryItem {
    id: String,
    source_file_name: String,
    move_number: i32,
    board_size: i32,
    color: String,
    updated_at: String,
    payload: serde_json::Value,
}

#[derive(Debug, Serialize)]
struct ProblemDuplicateResult {
    found: bool,
    id: Option<String>,
    source_file_name: Option<String>,
    move_number: Option<i32>,
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
fn read_file_bytes(path: String) -> ReadFileBytesResult {
    match std::fs::read(path) {
        Ok(content) => ReadFileBytesResult {
            ok: true,
            content: Some(content),
            error: None,
        },
        Err(error) => ReadFileBytesResult {
            ok: false,
            content: None,
            error: Some(error.to_string()),
        },
    }
}

#[tauri::command]
fn save_problem_to_database(payload: String) -> SaveProblemResult {
    let database_url = match problem_database_url() {
        Ok(value) => value,
        Err(error) => return SaveProblemResult { ok: false, error: Some(error) },
    };
    let value: serde_json::Value = match serde_json::from_str(&payload) {
        Ok(value) => value,
        Err(error) => {
            return SaveProblemResult {
                ok: false,
                error: Some(format!("题目数据无效：{error}")),
            }
        }
    };
    let id = value.get("id").and_then(|item| item.as_str()).unwrap_or("");
    if id.is_empty() {
        return SaveProblemResult {
            ok: false,
            error: Some("题目缺少 id".to_string()),
        };
    }
    let move_number = value.get("moveNumber").and_then(|item| item.as_i64()).unwrap_or(0) as i32;
    let color = value.get("color").and_then(|item| item.as_str()).unwrap_or("");
    let full_score_move = value.get("fullScoreMove").and_then(|item| item.as_str()).unwrap_or("");
    let position_hash = value.get("positionHash").and_then(|item| item.as_str()).unwrap_or("");
    let source = value.get("source").cloned().unwrap_or(serde_json::Value::Null);
    let source_file_name = source.get("fileName").and_then(|item| item.as_str()).unwrap_or("");
    let board_size = source.get("boardSize").and_then(|item| item.as_i64()).unwrap_or(0) as i32;
    let source_position = source.get("movesBeforeProblem").cloned().unwrap_or_else(|| serde_json::json!([]));
    let actual_move = source.get("actualMove").cloned().unwrap_or(serde_json::Value::Null);
    let candidate_scores = value.get("candidateScores").cloned().unwrap_or_else(|| serde_json::json!([]));
    let metadata = value.get("metadata").cloned().unwrap_or(serde_json::Value::Null);
    let players = metadata.get("gamePlayers").cloned().unwrap_or(serde_json::Value::Null);
    let black_name = players.get("black").and_then(|item| item.as_str()).or_else(|| source.get("blackName").and_then(|item| item.as_str())).unwrap_or("");
    let white_name = players.get("white").and_then(|item| item.as_str()).or_else(|| source.get("whiteName").and_then(|item| item.as_str())).unwrap_or("");
    let game_date = metadata.get("gameDate").and_then(|item| item.as_str()).or_else(|| source.get("gameDate").and_then(|item| item.as_str())).unwrap_or("");
    let problem_creator = metadata.get("creator").and_then(|item| item.as_str()).unwrap_or("");
    let problem_created_at = metadata.get("createdAt").and_then(|item| item.as_str()).unwrap_or("");
    let problem_collection = metadata.get("collection").and_then(|item| item.as_str()).unwrap_or("");
    if move_number <= 0 || board_size <= 0 || color.is_empty() || full_score_move.is_empty() || position_hash.is_empty() {
        return SaveProblemResult {
            ok: false,
            error: Some("题目缺少手数、棋盘大小、行棋方、正确答案或局面哈希".to_string()),
        };
    }
    let sql = r#"
        CREATE TABLE IF NOT EXISTS go_problems (
            id TEXT PRIMARY KEY,
            source_file_name TEXT NOT NULL,
            move_number INTEGER NOT NULL,
            board_size INTEGER NOT NULL,
            color TEXT NOT NULL,
            full_score_move TEXT NOT NULL,
            position_hash TEXT NOT NULL,
            source_position JSONB NOT NULL,
            actual_move JSONB,
            candidate_scores JSONB NOT NULL,
            black_name TEXT,
            white_name TEXT,
            game_date TEXT,
            problem_creator TEXT,
            problem_created_at TEXT,
            problem_collection TEXT,
            payload JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        ALTER TABLE go_problems ADD COLUMN IF NOT EXISTS source_file_name TEXT;
        ALTER TABLE go_problems ADD COLUMN IF NOT EXISTS move_number INTEGER;
        ALTER TABLE go_problems ADD COLUMN IF NOT EXISTS board_size INTEGER;
        ALTER TABLE go_problems ADD COLUMN IF NOT EXISTS color TEXT;
        ALTER TABLE go_problems ADD COLUMN IF NOT EXISTS full_score_move TEXT;
        ALTER TABLE go_problems ADD COLUMN IF NOT EXISTS position_hash TEXT;
        ALTER TABLE go_problems ADD COLUMN IF NOT EXISTS source_position JSONB;
        ALTER TABLE go_problems ADD COLUMN IF NOT EXISTS actual_move JSONB;
        ALTER TABLE go_problems ADD COLUMN IF NOT EXISTS candidate_scores JSONB;
        ALTER TABLE go_problems ADD COLUMN IF NOT EXISTS black_name TEXT;
        ALTER TABLE go_problems ADD COLUMN IF NOT EXISTS white_name TEXT;
        ALTER TABLE go_problems ADD COLUMN IF NOT EXISTS game_date TEXT;
        ALTER TABLE go_problems ADD COLUMN IF NOT EXISTS problem_creator TEXT;
        ALTER TABLE go_problems ADD COLUMN IF NOT EXISTS problem_created_at TEXT;
        ALTER TABLE go_problems ADD COLUMN IF NOT EXISTS problem_collection TEXT;
        CREATE INDEX IF NOT EXISTS go_problems_source_move_idx ON go_problems(source_file_name, move_number);
        CREATE INDEX IF NOT EXISTS go_problems_position_hash_idx ON go_problems(position_hash);
        CREATE INDEX IF NOT EXISTS go_problems_updated_at_idx ON go_problems(updated_at DESC);
    "#;
    let result = (|| -> Result<(), String> {
        let mut config = database_url
            .parse::<postgres::Config>()
            .map_err(|error| error.to_string())?;
        config.connect_timeout(Duration::from_secs(2));
        let mut client = config.connect(NoTls).map_err(|error| error.to_string())?;
        client
            .batch_execute(sql)
            .map_err(|error| error.to_string())?;
        client.execute(
            "INSERT INTO go_problems (id, source_file_name, move_number, board_size, color, full_score_move, position_hash, source_position, actual_move, candidate_scores, black_name, white_name, game_date, problem_creator, problem_created_at, problem_collection, payload, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW()) ON CONFLICT (id) DO UPDATE SET source_file_name = EXCLUDED.source_file_name, move_number = EXCLUDED.move_number, board_size = EXCLUDED.board_size, color = EXCLUDED.color, full_score_move = EXCLUDED.full_score_move, position_hash = EXCLUDED.position_hash, source_position = EXCLUDED.source_position, actual_move = EXCLUDED.actual_move, candidate_scores = EXCLUDED.candidate_scores, black_name = EXCLUDED.black_name, white_name = EXCLUDED.white_name, game_date = EXCLUDED.game_date, problem_creator = EXCLUDED.problem_creator, problem_created_at = EXCLUDED.problem_created_at, problem_collection = EXCLUDED.problem_collection, payload = EXCLUDED.payload, updated_at = NOW()",
            &[&id, &source_file_name, &move_number, &board_size, &color, &full_score_move, &position_hash, &source_position, &actual_move, &candidate_scores, &black_name, &white_name, &game_date, &problem_creator, &problem_created_at, &problem_collection, &value],
        ).map_err(|error| error.to_string())?;
        Ok(())
    })();
    match result {
        Ok(()) => SaveProblemResult {
            ok: true,
            error: None,
        },
        Err(error) => SaveProblemResult {
            ok: false,
            error: Some(error),
        },
    }
}

#[tauri::command]
fn record_problem_answer(problem_id: String, move_name: String, score: f64, problem_type: String) -> Result<(), String> {
    if problem_id.trim().is_empty() || move_name.trim().is_empty() {
        return Err("答题统计缺少题目 ID 或落点".to_string());
    }
    if problem_type != "A" && problem_type != "B" {
        return Err("题型必须是 A 或 B".to_string());
    }
    let database_url = problem_database_url()?;
    let mut config = database_url.parse::<postgres::Config>().map_err(|error| error.to_string())?;
    config.connect_timeout(Duration::from_secs(2));
    let mut client = config.connect(NoTls).map_err(|error| error.to_string())?;
    client.batch_execute(r#"
        CREATE TABLE IF NOT EXISTS problem_answer_stats (
            problem_id TEXT NOT NULL REFERENCES go_problems(id) ON DELETE CASCADE,
            move_name TEXT NOT NULL,
            problem_type TEXT NOT NULL,
            answer_count BIGINT NOT NULL DEFAULT 0,
            score_sum DOUBLE PRECISION NOT NULL DEFAULT 0,
            full_score_count BIGINT NOT NULL DEFAULT 0,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (problem_id, move_name)
        );
    "#).map_err(|error| error.to_string())?;
    let full_score_count: i64 = if score >= 10.0 { 1 } else { 0 };
    client.execute(
        "INSERT INTO problem_answer_stats (problem_id, move_name, problem_type, answer_count, score_sum, full_score_count) VALUES ($1, $2, $3, 1, $4, $5) ON CONFLICT (problem_id, move_name) DO UPDATE SET problem_type = EXCLUDED.problem_type, answer_count = problem_answer_stats.answer_count + 1, score_sum = problem_answer_stats.score_sum + EXCLUDED.score_sum, full_score_count = problem_answer_stats.full_score_count + EXCLUDED.full_score_count, updated_at = NOW()",
        &[&problem_id, &move_name, &problem_type, &score, &full_score_count],
    ).map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn record_problem_tag(problem_id: String, tag: String) -> Result<(), String> {
    const ALLOWED_TAGS: [&str; 9] = ["中盘", "定式", "对杀", "死活", "收气", "官子", "打入", "做活", "手筋"];
    if problem_id.trim().is_empty() || !ALLOWED_TAGS.contains(&tag.as_str()) {
        return Err("题目 ID 或标签无效".to_string());
    }
    let database_url = problem_database_url()?;
    let mut config = database_url.parse::<postgres::Config>().map_err(|error| error.to_string())?;
    config.connect_timeout(Duration::from_secs(2));
    let mut client = config.connect(NoTls).map_err(|error| error.to_string())?;
    client.batch_execute(r#"
        CREATE TABLE IF NOT EXISTS problem_tag_stats (
            problem_id TEXT NOT NULL REFERENCES go_problems(id) ON DELETE CASCADE,
            tag TEXT NOT NULL,
            vote_count BIGINT NOT NULL DEFAULT 0,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (problem_id, tag)
        );
    "#).map_err(|error| error.to_string())?;
    client.execute(
        "INSERT INTO problem_tag_stats (problem_id, tag, vote_count) VALUES ($1, $2, 1) ON CONFLICT (problem_id, tag) DO UPDATE SET vote_count = problem_tag_stats.vote_count + 1, updated_at = NOW()",
        &[&problem_id, &tag],
    ).map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn find_problem_by_position_hash(position_hash: String) -> Result<ProblemDuplicateResult, String> {
    let database_url = problem_database_url()?;
    let mut config = database_url.parse::<postgres::Config>().map_err(|error| error.to_string())?;
    config.connect_timeout(Duration::from_secs(2));
    let mut client = config.connect(NoTls).map_err(|error| error.to_string())?;
    let row = client
        .query_opt(
            "SELECT id, source_file_name, move_number FROM go_problems WHERE position_hash = $1 ORDER BY updated_at DESC LIMIT 1",
            &[&position_hash],
        )
        .map_err(|error| error.to_string())?;
    Ok(match row {
        Some(row) => ProblemDuplicateResult {
            found: true,
            id: row.get(0),
            source_file_name: row.get(1),
            move_number: row.get(2),
        },
        None => ProblemDuplicateResult {
            found: false,
            id: None,
            source_file_name: None,
            move_number: None,
        },
    })
}

#[tauri::command]
fn list_problem_library() -> Result<Vec<ProblemLibraryItem>, String> {
    let database_url = problem_database_url()?;
    let mut config = database_url.parse::<postgres::Config>().map_err(|error| error.to_string())?;
    config.connect_timeout(Duration::from_secs(2));
    let mut client = config.connect(NoTls).map_err(|error| error.to_string())?;
    let rows = client.query(
        "SELECT id, source_file_name, move_number, board_size, color, updated_at::text, payload FROM go_problems ORDER BY created_at ASC, id ASC",
        &[],
    ).map_err(|error| error.to_string())?;
    Ok(rows.into_iter().map(|row| ProblemLibraryItem {
        id: row.get(0),
        source_file_name: row.get(1),
        move_number: row.get(2),
        board_size: row.get(3),
        color: row.get(4),
        updated_at: row.get(5),
        payload: row.get(6),
    }).collect())
}

fn problem_database_url() -> Result<String, String> {
    for key in ["TENSUGO_PROBLEM_DATABASE_URL", "DATABASE_URL"] {
        if let Ok(value) = std::env::var(key) {
            if !value.trim().is_empty() {
                return validate_problem_database_url(value, key);
            }
        }
    }
    let mut roots = Vec::new();
    if let Ok(current) = std::env::current_dir() {
        roots.push(current);
    }
    if let Ok(executable) = std::env::current_exe() {
        if let Some(parent) = executable.parent() {
            roots.push(parent.to_path_buf());
        }
    }
    roots.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")));
    for root in roots {
        for directory in root.ancestors().take(8) {
            let path = directory.join(".env");
            let Ok(content) = std::fs::read_to_string(&path) else { continue };
            for wanted_key in ["TENSUGO_PROBLEM_DATABASE_URL", "DATABASE_URL"] {
                for line in content.lines() {
                    let line = line.trim();
                    if line.is_empty() || line.starts_with('#') { continue; }
                    let Some((key, value)) = line.split_once('=') else { continue };
                    if key.trim() == wanted_key && !value.trim().is_empty() {
                        return validate_problem_database_url(value.trim().trim_matches(['\'', '"']).to_string(), wanted_key);
                    }
                }
            }
        }
    }
    Err("数据库连接未配置；Desktop 未能从 TENSUGO_PROBLEM_DATABASE_URL、DATABASE_URL 或项目 .env 读取连接".to_string())
}

fn validate_problem_database_url(value: String, source: &str) -> Result<String, String> {
    let without_query = value.split('?').next().unwrap_or(&value).trim_end_matches('/');
    let database = without_query.rsplit('/').next().unwrap_or("");
    if !value.contains("://") || database.is_empty() || database.contains(':') {
        return Err(format!("{} 缺少数据库名；连接必须以 /tensugo_forum 之类的数据库名结尾", source));
    }
    Ok(value)
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

    let mut required_paths = vec![
        ("katago", profile.executable_path.as_str()),
        ("normal model", profile.model_path.as_str()),
        ("normal config", profile.config_path.as_str()),
    ];
    if is_human_engine_mode(&profile) {
        required_paths.push(("human model", profile.human_model_path.as_str()));
        required_paths.push(("human config", profile.human_config_path.as_str()));
    }
    for (label, path) in required_paths {
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

            if gtp_arguments(&profile).is_err()
                || !std::path::Path::new(&profile.model_path).exists()
                || !std::path::Path::new(&profile.config_path).exists()
                || (is_human_engine_mode(&profile)
                    && (!std::path::Path::new(&profile.human_model_path).exists()
                        || !std::path::Path::new(&profile.human_config_path).exists()))
            {
                return EngineProbeResult {
                    ok: false,
                    summary: "当前模式所需的模型或配置文件不存在".to_string(),
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
        "Normal model found",
        std::path::Path::new(&profile.model_path).exists(),
    ));
    lines.push(status_line(
        "Normal config found",
        std::path::Path::new(&profile.config_path).exists(),
    ));
    if is_human_engine_mode(profile) {
        lines.push(status_line(
            "Human model found",
            std::path::Path::new(&profile.human_model_path).exists(),
        ));
        lines.push(status_line(
            "Human config found",
            std::path::Path::new(&profile.human_config_path).exists(),
        ));
    }
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
    state: tauri::State<'_, EngineState>,
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
        if !stop_continuous_session(session) {
            *guard = None;
            return analysis_error(
                "engine-stop-timeout",
                format!("KataGo 在 {} 秒内没有确认停止上一局面，已废弃会话，下次调用将重启引擎", ANALYSIS_STOP_TIMEOUT_MS / 1000),
            );
        }
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

    let result = collect_analysis(session, request.max_visits);
    stop_search_session(session);
    result
}

#[tauri::command]
async fn analyze_problem_position(
    app: AppHandle,
    state: tauri::State<'_, EngineState>,
    request: AnalyzeRequest,
) -> Result<AnalysisResult, String> {
    let session_state = Arc::clone(&state.problem_session);
    tauri::async_runtime::spawn_blocking(move || analyze_problem_position_blocking(app, session_state, request))
        .await
        .map_err(|error| format!("拟人出题分析任务异常: {}", error))
}

fn analyze_problem_position_blocking(
    app: AppHandle,
    session_state: Arc<Mutex<Option<EngineSession>>>,
    request: AnalyzeRequest,
) -> AnalysisResult {
    let mut guard = match session_state.lock() {
        Ok(guard) => guard,
        Err(error) => return analysis_error("engine-state-lock-failed", error.to_string()),
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
        None => return analysis_error("engine-session-missing", "拟人出题引擎会话不存在".to_string()),
    };
    drain_receiver(&session.stdout_rx);
    drain_receiver(&session.stderr_rx);
    if let Err(error) = write_position_commands(session, &request) {
        *guard = None;
        return analysis_error("engine-command-failed", error);
    }
    session.current_position_key = request_position_key(&request);
    let result = collect_analysis(session, request.max_visits);
    stop_search_session(session);
    result
}

fn analysis_error(status: &str, diagnostics: String) -> AnalysisResult {
    AnalysisResult { ok: false, status: status.to_string(), candidates: Vec::new(), raw_output: String::new(), diagnostics }
}

#[tauri::command]
fn begin_batch_keep_awake(state: tauri::State<'_, EngineState>) -> Result<String, String> {
    let mut guard = state.batch_keep_awake.lock().map_err(|error| error.to_string())?;
    if guard.as_mut().is_some_and(|child| child.try_wait().ok().flatten().is_none()) {
        return Ok("批量任务保持唤醒已启用".to_string());
    }
    #[cfg(target_os = "macos")]
    {
        let child = Command::new("/usr/bin/caffeinate")
            .args(["-i", "-m"])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|error| format!("无法启动 macOS caffeinate: {error}"))?;
        *guard = Some(child);
        return Ok("已启用 macOS caffeinate，批量任务期间禁止系统空闲休眠".to_string());
    }
    #[cfg(not(target_os = "macos"))]
    Err("当前平台尚未实现批量任务保持唤醒".to_string())
}

#[tauri::command]
fn end_batch_keep_awake(state: tauri::State<'_, EngineState>) -> Result<(), String> {
    let mut guard = state.batch_keep_awake.lock().map_err(|error| error.to_string())?;
    if let Some(mut child) = guard.take() {
        let _ = child.kill();
        let _ = child.wait();
    }
    Ok(())
}

#[tauri::command]
async fn generate_move(
    app: AppHandle,
    state: tauri::State<'_, EngineState>,
    request: GenerateMoveRequest,
) -> Result<GenerateMoveResult, String> {
    let session_state = Arc::clone(&state.session);
    let machine_sessions = Arc::clone(&state.machine_sessions);
    let cancel_generation = Arc::clone(&state.cancel_generation);
    tauri::async_runtime::spawn_blocking(move || {
        generate_move_blocking(app, session_state, machine_sessions, cancel_generation, request)
    })
    .await
    .map_err(|error| format!("KataGo 落子任务异常: {}", error))
}

fn generate_move_blocking(
    app: AppHandle,
    session_state: Arc<Mutex<Option<EngineSession>>>,
    machine_sessions: Arc<Mutex<Vec<Option<EngineSession>>>>,
    cancel_generation: Arc<AtomicBool>,
    request: GenerateMoveRequest,
) -> GenerateMoveResult {
    if let Some(slot_name) = request.engine_slot.as_deref() {
        let slot_index = if slot_name == "white" { 1 } else { 0 };
        let mut pool = match machine_sessions.lock() {
            Ok(pool) => pool,
            Err(error) => return generate_move_error("engine-state-lock-failed", error.to_string()),
        };
        let mut slot = pool.get_mut(slot_index).and_then(Option::take);
        let result = generate_move_on_slot(&app, &cancel_generation, &request, &mut slot);
        if pool.len() < 2 { pool.resize_with(2, || None); }
        pool[slot_index] = slot;
        return result;
    }
    let mut guard = match session_state.lock() {
        Ok(guard) => guard,
        Err(error) => return generate_move_error("engine-state-lock-failed", error.to_string()),
    };
    cancel_generation.store(false, Ordering::SeqCst);
    let profile_key = profile_key(&request.profile);
    if guard.as_ref().map(|session| session.profile_key.as_str()) != Some(profile_key.as_str()) {
        *guard = match start_engine_session(&app, &request.profile, &profile_key) {
            Ok(session) => Some(session),
            Err(result) => return generate_move_error(&result.status, result.diagnostics),
        };
    }
    if let Some(result) = restart_engine_if_memory_limit_exceeded(
        &app,
        &request.profile,
        &profile_key,
        &mut guard,
    ) {
        return generate_move_error(&result.status, result.diagnostics);
    }
    let session = match guard.as_mut() {
        Some(session) => session,
        None => return generate_move_error("engine-session-missing", "KataGo session missing after startup.".to_string()),
    };
    stop_continuous_session(session);
    drain_receiver(&session.stdout_rx);
    drain_receiver(&session.stderr_rx);
    if let Err(error) = writeln!(session.stdin, "{}", generate_move_limits_command(&request))
        .map_err(|error| error.to_string())
    {
        *guard = None;
        return generate_move_error("engine-command-failed", error);
    }
    if let Err(error) = write_board_position(
        session,
        request.board_size,
        request.komi,
        &request.moves,
    ) {
        *guard = None;
        return generate_move_error("engine-command-failed", error);
    }
    let color = if request.next_color == "black" { "B" } else { "W" };
    if let Err(error) = writeln!(session.stdin, "genmove {}", color)
        .map_err(|error| error.to_string())
        .and_then(|_| session.stdin.flush().map_err(|error| error.to_string()))
    {
        *guard = None;
        return generate_move_error("engine-command-failed", error);
    }
    session.current_position_key = generate_move_position_key(&request);
    let result = collect_generated_move(
        session,
        &cancel_generation,
        generate_move_timeout_ms(&request),
    );
    if result.ok {
        stop_search_session(session);
    }
    result
}

fn generate_move_on_slot(
    app: &AppHandle,
    cancel_generation: &AtomicBool,
    request: &GenerateMoveRequest,
    slot: &mut Option<EngineSession>,
) -> GenerateMoveResult {
    cancel_generation.store(false, Ordering::SeqCst);
    let profile_key = profile_key(&request.profile);
    if slot.as_ref().map(|session| session.profile_key.as_str()) != Some(profile_key.as_str()) {
        *slot = match start_engine_session(app, &request.profile, &profile_key) {
            Ok(session) => Some(session),
            Err(result) => return generate_move_error(&result.status, result.diagnostics),
        };
    }
    let session = match slot.as_mut() {
        Some(session) => session,
        None => return generate_move_error("engine-session-missing", "KataGo session missing after startup.".to_string()),
    };
    stop_continuous_session(session);
    drain_receiver(&session.stdout_rx);
    drain_receiver(&session.stderr_rx);
    if let Err(error) = writeln!(session.stdin, "{}", generate_move_limits_command(request))
        .map_err(|error| error.to_string())
        .and_then(|_| write_board_position(session, request.board_size, request.komi, &request.moves))
        .and_then(|_| writeln!(session.stdin, "genmove {}", if request.next_color == "black" { "B" } else { "W" }).map_err(|error| error.to_string()))
        .and_then(|_| session.stdin.flush().map_err(|error| error.to_string()))
    {
        *slot = None;
        return generate_move_error("engine-command-failed", error);
    }
    session.current_position_key = generate_move_position_key(request);
    let result = collect_generated_move(session, cancel_generation, generate_move_timeout_ms(request));
    if result.ok { stop_search_session(session); }
    result
}

#[tauri::command]
fn cancel_generate_move(state: tauri::State<EngineState>) {
    state.cancel_generation.store(true, Ordering::SeqCst);
}

fn generate_move_error(status: &str, diagnostics: String) -> GenerateMoveResult {
    GenerateMoveResult {
        ok: false,
        status: status.to_string(),
        move_name: None,
        diagnostics,
    }
}

fn collect_generated_move(
    session: &mut EngineSession,
    cancel_generation: &AtomicBool,
    timeout_ms: u64,
) -> GenerateMoveResult {
    let deadline = Instant::now() + Duration::from_millis(timeout_ms);
    let mut stdout_lines = Vec::new();
    let mut stderr_lines = Vec::new();
    while Instant::now() < deadline {
        if cancel_generation.load(Ordering::SeqCst) {
            stop_search_session(session);
            return generate_move_error("genmove-cancelled", "KataGo 落子已取消。".to_string());
        }
        stdout_lines.extend(drain_receiver(&session.stdout_rx));
        stderr_lines.extend(drain_receiver(&session.stderr_rx));
        if let Some(move_name) = parse_gtp_move_response(&stdout_lines) {
            return GenerateMoveResult {
                ok: true,
                status: "generated".to_string(),
                move_name: Some(move_name),
                diagnostics: stderr_lines.join("\n"),
            };
        }
        if let Some(error_line) = stdout_lines.iter().find(|line| line.trim_start().starts_with('?')) {
            return generate_move_error("gtp-error", format!("{}\n{}", error_line, stderr_lines.join("\n")));
        }
        match session.child.try_wait() {
            Ok(Some(status)) => {
                return generate_move_error(
                    "engine-exited-during-genmove",
                    format!("KataGo 生成落子期间退出: {}\n{}", status, stderr_lines.join("\n")),
                );
            }
            Ok(None) => thread::sleep(Duration::from_millis(25)),
            Err(error) => return generate_move_error("engine-status-failed", error.to_string()),
        }
    }
    generate_move_error(
        "genmove-timeout",
        format!("KataGo 在 {} 秒内没有返回落子。\n{}", timeout_ms / 1000, stderr_lines.join("\n")),
    )
}

fn generate_move_limits_command(request: &GenerateMoveRequest) -> String {
    let max_playouts = 1_000_000_000usize;
    let (max_visits, max_time) = if request.search_limit == "visits" {
        (request.max_visits.clamp(1, 1_000_000), 1_000_000_000.0)
    } else {
        let max_time = if request.max_time_seconds.is_finite() {
            request.max_time_seconds.clamp(0.1, 600.0)
        } else {
            5.0
        };
        (1_000_000_000, max_time)
    };
    format!(
        "kata-set-params {{\"maxVisits\":{},\"maxPlayouts\":{},\"maxTime\":{}}}",
        max_visits, max_playouts, max_time
    )
}

fn generate_move_timeout_ms(request: &GenerateMoveRequest) -> u64 {
    if request.search_limit == "visits" {
        GENMOVE_VISITS_TIMEOUT_MS
    } else {
        let seconds = if request.max_time_seconds.is_finite() {
            request.max_time_seconds.clamp(0.1, 600.0)
        } else {
            5.0
        };
        ((seconds * 1000.0) as u64 + 30_000).clamp(30_000, 630_000)
    }
}

fn parse_gtp_move_response(lines: &[String]) -> Option<String> {
    lines.iter().find_map(|line| {
        let trimmed = line.trim();
        if !trimmed.starts_with('=') {
            return None;
        }
        trimmed.trim_start_matches('=').trim().split_whitespace().next().map(str::to_string)
    })
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
        if session.continuous_analysis.is_some() && !stop_continuous_session(session) {
            *guard = None;
            return analysis_error(
                "engine-stop-timeout",
                format!("KataGo 在 {} 秒内没有确认停止上一局面，已废弃会话，下次调用将重启引擎", ANALYSIS_STOP_TIMEOUT_MS / 1000),
            );
        }
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
            if !stop_continuous_session(session) {
                *guard = None;
                return Err(format!(
                    "KataGo 在 {} 秒内没有确认停止，已废弃会话",
                    ANALYSIS_STOP_TIMEOUT_MS / 1000
                ));
            }
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

fn stop_continuous_session(session: &mut EngineSession) -> bool {
    let stopped = stop_search_session(session);
    session.continuous_analysis = None;
    stopped
}

fn stop_search_session(session: &mut EngineSession) -> bool {
    // Discard old streaming analysis before sending stop. Otherwise an old GTP
    // success line can be mistaken for the acknowledgement of this stop.
    drain_receiver(&session.stdout_rx);
    drain_receiver(&session.stderr_rx);
    let _ = writeln!(session.stdin, "stop");
    if session.stdin.flush().is_err() {
        return false;
    }
    let acknowledged = wait_after_stop(session);
    drain_receiver(&session.stdout_rx);
    drain_receiver(&session.stderr_rx);
    acknowledged
}

fn wait_after_stop(session: &mut EngineSession) -> bool {
    let deadline = Instant::now() + Duration::from_millis(ANALYSIS_STOP_TIMEOUT_MS);
    while Instant::now() < deadline {
        let stdout = drain_receiver(&session.stdout_rx);
        drain_receiver(&session.stderr_rx);
        if stdout.iter().any(|line| {
            let line = line.trim();
            line == "=" || line.starts_with("= ")
        }) {
            return true;
        }
        if matches!(session.child.try_wait(), Ok(Some(_))) {
            return false;
        }
        thread::sleep(Duration::from_millis(25));
    }
    false
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
    write_board_position(session, request.board_size, request.komi, &request.moves)?;
    let next_color = if request.next_color == "black" {
        "B"
    } else {
        "W"
    };
    let max_visits = max_visits.clamp(1, 100000);
    writeln!(session.stdin, "kata-set-params {{\"maxVisits\":{}}}", max_visits)
        .map_err(|error| error.to_string())?;
    writeln!(session.stdin, "kata-analyze {} {}", next_color, CONTINUOUS_ANALYSIS_INTERVAL_CS)
        .map_err(|error| error.to_string())?;
    session.stdin.flush().map_err(|error| error.to_string())
}

fn write_continuous_position_commands(
    session: &mut EngineSession,
    request: &AnalyzeRequest,
) -> Result<(), String> {
    write_board_position(session, request.board_size, request.komi, &request.moves)?;
    let next_color = if request.next_color == "black" {
        "B"
    } else {
        "W"
    };
    writeln!(session.stdin, "kata-set-params {{\"maxVisits\":1000000000}}")
        .map_err(|error| error.to_string())?;
    writeln!(session.stdin, "{}", continuous_analysis_command(next_color))
        .map_err(|error| error.to_string())?;
    session.stdin.flush().map_err(|error| error.to_string())
}

fn write_board_position(
    session: &mut EngineSession,
    board_size: usize,
    komi: f64,
    moves: &[AnalyzeMove],
) -> Result<(), String> {
    writeln!(session.stdin, "boardsize {}", board_size)
        .map_err(|error| error.to_string())?;
    writeln!(session.stdin, "komi {}", komi).map_err(|error| error.to_string())?;
    writeln!(session.stdin, "clear_board").map_err(|error| error.to_string())?;
    for game_move in moves {
        let color = if game_move.color == "black" { "B" } else { "W" };
        writeln!(
            session.stdin,
            "play {} {}",
            color,
            analyze_move_to_gtp_point(game_move, board_size)
        )
        .map_err(|error| error.to_string())?;
    }
    session.stdin.flush().map_err(|error| error.to_string())
}

fn analyze_move_to_gtp_point(game_move: &AnalyzeMove, board_size: usize) -> String {
    if game_move.x < 0 || game_move.y < 0 {
        "pass".to_string()
    } else {
        to_gtp_point(game_move.x as usize, game_move.y as usize, board_size)
    }
}

fn continuous_analysis_command(next_color: &str) -> String {
    format!(
        "kata-analyze {} {}",
        next_color, CONTINUOUS_ANALYSIS_INTERVAL_CS
    )
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
            WinrateScale::KataAnalyzeProbability,
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
        .saturating_mul(20)
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
            let snapshot = parse_analysis_output(&stdout_lines.join("\n"), WinrateScale::KataAnalyzeProbability);
            let collected_visits = snapshot.iter().map(|candidate| candidate.visits).sum::<usize>();
            if collected_visits >= max_visits.saturating_mul(9) / 10 {
                thread::sleep(Duration::from_millis(25));
                stdout_lines.extend(drain_receiver(&session.stdout_rx));
                break;
            }
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
    command.args(gtp_arguments(profile)?);
    Ok(command)
}

fn gtp_arguments(profile: &EngineProfile) -> Result<Vec<String>, String> {
    if profile.executable_path.trim().is_empty() {
        return Err("KataGo Engine Path 为空".to_string());
    }
    if profile.model_path.trim().is_empty() {
        return Err("普通 Model 为空；拟人模式仍需要普通模型作为 -model".to_string());
    }
    if is_human_engine_mode(profile) {
        if profile.human_model_path.trim().is_empty() {
            return Err("拟人模式缺少 Human Model（-human-model）".to_string());
        }
        if profile.human_config_path.trim().is_empty() {
            return Err("拟人模式缺少 Human 配置".to_string());
        }
        return Ok(vec![
            "gtp".to_string(),
            "-model".to_string(),
            profile.model_path.clone(),
            "-human-model".to_string(),
            profile.human_model_path.clone(),
            "-config".to_string(),
            profile.human_config_path.clone(),
        ]);
    }
    if profile.config_path.trim().is_empty() {
        return Err("普通模式缺少普通配置".to_string());
    }
    Ok(vec![
        "gtp".to_string(),
        "-model".to_string(),
        profile.model_path.clone(),
        "-config".to_string(),
        profile.config_path.clone(),
    ])
}

fn is_human_engine_mode(profile: &EngineProfile) -> bool {
    profile.engine_mode.eq_ignore_ascii_case("human")
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
        "{}|{}|{}|{}|{}|{}",
        profile.executable_path,
        profile.model_path,
        profile.config_path,
        profile.human_model_path,
        profile.human_config_path,
        profile.engine_mode
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

fn generate_move_position_key(request: &GenerateMoveRequest) -> String {
    let moves = request
        .moves
        .iter()
        .map(|game_move| format!("{}:{}:{}", game_move.color, game_move.x, game_move.y))
        .collect::<Vec<_>>()
        .join("|");
    format!(
        "genmove:{}:{}:{}:{}",
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
    #[cfg(test)]
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
    // Native `kata-analyze` reports both scoreLead and scoreMean. Prefer
    // scoreLead because it is the expected absolute score margin (including
    // komi) from the analyzed side's perspective, not a move-to-move delta.
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
        #[cfg(test)]
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

    fn engine_profile(mode: &str) -> EngineProfile {
        EngineProfile {
            name: "test".to_string(),
            executable_path: "/opt/homebrew/bin/katago".to_string(),
            model_path: "/models/strong.bin.gz".to_string(),
            config_path: "/configs/normal.cfg".to_string(),
            human_model_path: "/models/human.bin.gz".to_string(),
            human_config_path: "/configs/human.cfg".to_string(),
            engine_mode: mode.to_string(),
            command_line: String::new(),
        }
    }

    fn generate_request(search_limit: &str, max_time_seconds: f64, max_visits: usize) -> GenerateMoveRequest {
        GenerateMoveRequest {
            profile: engine_profile("human"),
            board_size: 19,
            komi: 7.5,
            max_time_seconds,
            max_visits,
            moves: Vec::new(),
            next_color: "black".to_string(),
            search_limit: search_limit.to_string(),
        }
    }

    #[test]
    fn normal_engine_uses_normal_model_and_config() {
        assert_eq!(
            gtp_arguments(&engine_profile("normal")).unwrap(),
            vec!["gtp", "-model", "/models/strong.bin.gz", "-config", "/configs/normal.cfg"]
        );
    }

    #[test]
    fn human_engine_loads_strong_and_human_models_together() {
        assert_eq!(
            gtp_arguments(&engine_profile("human")).unwrap(),
            vec![
                "gtp",
                "-model",
                "/models/strong.bin.gz",
                "-human-model",
                "/models/human.bin.gz",
                "-config",
                "/configs/human.cfg",
            ]
        );
    }

    #[test]
    fn gtp_move_response_parses_move_pass_and_resign() {
        assert_eq!(parse_gtp_move_response(&["= Q16".to_string()]), Some("Q16".to_string()));
        assert_eq!(parse_gtp_move_response(&["= pass".to_string()]), Some("pass".to_string()));
        assert_eq!(parse_gtp_move_response(&["= resign".to_string()]), Some("resign".to_string()));
    }

    #[test]
    fn pass_move_is_written_as_gtp_pass() {
        let game_move = AnalyzeMove { color: "white".to_string(), x: -1, y: -1 };
        assert_eq!(analyze_move_to_gtp_point(&game_move, 19), "pass");
    }

    #[test]
    fn genmove_time_limit_disables_other_search_caps() {
        assert_eq!(
            generate_move_limits_command(&generate_request("time", 5.0, 400)),
            "kata-set-params {\"maxVisits\":1000000000,\"maxPlayouts\":1000000000,\"maxTime\":5}"
        );
    }

    #[test]
    fn genmove_visit_limit_disables_time_cap() {
        assert_eq!(
            generate_move_limits_command(&generate_request("visits", 5.0, 800)),
            "kata-set-params {\"maxVisits\":800,\"maxPlayouts\":1000000000,\"maxTime\":1000000000}"
        );
    }

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

    #[test]
    fn kata_analyze_parses_real_score_lead_sample() {
        let output = "info move Q16 visits 378 edgeVisits 378 utility 0.134031 winrate 0.564374 scoreMean 0.222173 scoreStdev 18.8274 scoreLead 0.222173 scoreSelfplay 0.769586 prior 0.0843889 lcb 0.562286 utilityLcb 0.128184 weight 377.13 order 0 pv Q16 D4 D16 Q4";

        let candidates = parse_analysis_output(output, WinrateScale::KataAnalyzeProbability);

        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].move_name, "Q16");
        assert!((candidates[0].winrate - 56.4374).abs() < 0.0001);
        assert!((candidates[0].score_lead - 0.222173).abs() < 0.000001);
    }

    #[test]
    fn continuous_analysis_uses_native_katago_output_with_score_lead() {
        assert_eq!(continuous_analysis_command("B"), "kata-analyze B 30");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(EngineState {
            cancel_generation: Arc::new(AtomicBool::new(false)),
            session: Arc::new(Mutex::new(None)),
            machine_sessions: Arc::new(Mutex::new(vec![None, None])),
            problem_session: Arc::new(Mutex::new(None)),
            batch_keep_awake: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            app_name,
            platform_paths,
            save_text_file_with_dialog,
            save_pdf_with_dialog,
            choose_game_record_files,
            choose_output_directory,
            read_text_file,
            read_file_bytes,
            write_text_file,
            save_problem_to_database,
            record_problem_answer,
            record_problem_tag,
            begin_batch_keep_awake,
            end_batch_keep_awake,
            find_problem_by_position_hash,
            list_problem_library,
            default_engine_profile,
            discover_engine_profile,
            choose_engine_path,
            probe_engine,
            analyze_position,
            analyze_problem_position,
            analyze_position_continuous,
            generate_move,
            cancel_generate_move,
            stop_continuous_analysis
        ])
        .run(tauri::generate_context!())
        .expect("failed to run TensuGo");
}
