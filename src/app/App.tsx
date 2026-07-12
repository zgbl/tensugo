import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { BoardPlaceholder, type MoveNumberDisplayMode } from "../board/BoardPlaceholder";
import { AutoAnalysisDialog, type AutoAnalysisSettings } from "../components/AutoAnalysisDialog";
import { BatchAnalysisDialog, type BatchAnalysisSettings } from "../components/BatchAnalysisDialog";
import { BottomToolbar } from "../components/BottomToolbar";
import { CandidatePanel, ReviewGraph } from "../components/CandidatePanel";
import { GameInfoPanel } from "../components/GameInfoPanel";
import { ResearchDocumentPanel } from "../components/ResearchDocumentPanel";
import { OgsBrowserDialog } from "../components/OgsBrowserDialog";
import { OgsDialog } from "../components/OgsDialog";
import { SettingsDialog } from "../components/SettingsDialog";
import { TopToolbar } from "../components/TopToolbar";
import type { EngineAnalysisResult, EngineCandidateMove, EngineProfile, ReviewAnalysisPoint } from "../engine/types";
import {
  analyzePositionContinuous,
  chooseEnginePath,
  DEFAULT_ENGINE_PROFILE,
  discoverEngineProfile,
  getDefaultEngineProfile,
  isTauriRuntime,
  probeEngine,
  readTextFile,
  saveProblemToDatabase,
  stopContinuousAnalysis,
  writeTextFile
} from "../engine/tauriEngine";
import { buildBoardPosition, canPlayMove, getNextColor } from "../game/boardRules";
import {
  appendMoveToGameTree,
  createEmptyGameTree,
  createGameTreeFromMoves,
  deleteSubtreeFromGameTree,
  findChildNodeIdByMove,
  findMainLineEndNodeId,
  findVariationAnchorNodeId,
  flattenBranchTree,
  mainLineMovesFromTree,
  moveNodeIdsToNode,
  nodeIdAtMoveNumber,
  pathMovesToNode,
  pathMovesWithMainContinuation,
  promoteNodeToMainLine,
  type GameTree
} from "../game/gameTree";
import type { ReviewMove, ReviewStone } from "../game/sampleGame";
import { parseGameRecord } from "../sgf/parseSgf";
import {
  appendBlock,
  createCandidateMovesBlock,
  createGameProgressBlock,
  createManualVariationBlock,
  createParagraphBlock,
  createResearchDocument,
  createVariationBlock,
  makeSnapshot,
  moveBlock,
  replaceBlock,
  toBrgDocument,
  updateBlockMarkdown,
  updateDocumentSource,
  validateResearchDocument
} from "../research/document";
import {
  DEFAULT_RESEARCH_EXPORT_SETTINGS,
  renderResearchDocumentHtml,
  type ResearchExportSettings
} from "../research/renderHtml";
import {
  LANGUAGE_STORAGE_KEY,
  makeTranslator,
  normalizeLanguage,
  type AppLanguage,
  type Translator
} from "../i18n";
import { OGSConnector } from "../ogs/OGSConnector";
import { parseOgsUrl } from "../ogs/ogsUrl";
import type { OgsConnectionStatus, OgsMoveUpdate } from "../ogs/types";
import type { ProblemItem, ProblemSet, ResearchAnalysisCompletion, ResearchBlock, ResearchDocument } from "../research/types";
import { useGameStore } from "../stores/gameStore";
import { APP_VERSION, appDisplayVersion } from "../version";

type AutoAnalysisSummary = {
  analyzed: number;
  candidateMatches: number;
  matches: number;
  details: AutoAnalysisMoveDetail[];
  knownScoreLosses: number;
  knownWinrateLosses: number;
  topMatches: number;
  totalScoreLoss: number;
  totalWinrateLoss: number;
  totalMatchScore: number;
};

type BatchRunReport = {
  analyzedMoves: number;
  completedFiles: number;
  outputDirectory: string;
  problemCount: number;
  selectedFiles: number;
  skippedFiles: number;
  stopped: boolean;
  targetPlayer: string;
};

type TianshuReport = AutoAnalysisSummary & {
  analyzedAt: string;
  endMove: number;
  startMove: number;
};

type AutoAnalysisMoveDetail = {
  actualMoveName?: string;
  color: "black" | "white";
  isCandidate?: boolean;
  isMatch?: boolean;
  isTopMove?: boolean;
  matchScore: number;
  moveNumber: number;
  rank: number | null;
  scoreLoss: number | null;
  winrate: number;
  winrateLoss: number | null;
};

const MATCH_SETTINGS = {
  bestNums: 3,
  percentVisits: 20
} as const;
const AUTO_ANALYSIS_CANDIDATE_TIMEOUT_MS = 15_000;

type LossBucket = {
  count: number;
  label: string;
};

type SaveTextFileResult = {
  saved: boolean;
  path: string | null;
  error: string | null;
};

const LAST_RESEARCH_SAVE_DIR_KEY = "tensugo.lastResearchSaveDir";
const RESEARCH_EXPORT_SETTINGS_KEY = "tensugo.researchExportSettings";
const INTERFACE_SETTINGS_KEY = "tensugo.interfaceSettings";
const ENGINE_PROFILE_STORAGE_KEY = "tensugo.engineProfile";
const ENGINE_PROFILES_STORAGE_KEY = "tensugo.engineProfiles";
const ACTIVE_ENGINE_PROFILE_KEY = "tensugo.activeEngineProfileKey";
const HIDDEN_ENGINE_PROFILE_KEYS = "tensugo.hiddenEngineProfileKeys";
const DEFAULT_CANDIDATE_DISPLAY_LIMIT = 5;
const INITIAL_GAME_TREE = createEmptyGameTree(19, 7.5);
const INITIAL_SELECTED_NODE_ID = "root";
const INITIAL_PATH_NODE_IDS: string[] = [];

export function App() {
  const game = useGameStore();
  const [boardSize, setBoardSize] = useState(game.boardSize);
  const [komi, setKomi] = useState(game.komi);
  const [rules, setRules] = useState("中国");
  const [blackName, setBlackName] = useState("黑棋");
  const [whiteName, setWhiteName] = useState("白棋");
  const [sourceFileName, setSourceFileName] = useState("新棋谱");
  const [gameDate, setGameDate] = useState<string | undefined>(undefined);
  const [gameResult, setGameResult] = useState<string | undefined>(undefined);
  const [gameTimeControl, setGameTimeControl] = useState<string | undefined>(undefined);
  const [lastAction, setLastAction] = useState("空棋盘已就绪。点“开”选择 SGF，或点棋盘空交点开始摆棋。");
  const [sgfWarnings, setSgfWarnings] = useState<string[]>([]);
  const [engineProfile, setEngineProfile] = useState<EngineProfile | null>(() => loadEngineProfile());
  const [engineProfiles, setEngineProfiles] = useState<EngineProfile[]>(() => loadEngineProfiles());
  const [selectedEngineProfileIndex, setSelectedEngineProfileIndex] = useState(0);
  const [engineStatus, setEngineStatus] = useState("引擎未配置");
  const [engineDiagnostics, setEngineDiagnostics] = useState("尚未运行引擎测试。");
  const [researchExportSettings, setResearchExportSettings] = useState<ResearchExportSettings>(() => loadResearchExportSettings());
  const [candidateDisplayLimit, setCandidateDisplayLimit] = useState(() => loadCandidateDisplayLimit());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isOgsBrowserOpen, setIsOgsBrowserOpen] = useState(false);
  const [isOgsDialogOpen, setIsOgsDialogOpen] = useState(false);
  const [ogsStatus, setOgsStatus] = useState<OgsConnectionStatus>("idle");
  const [ogsStatusDetail, setOgsStatusDetail] = useState<string | undefined>(undefined);
  const [ogsSourceLabel, setOgsSourceLabel] = useState<string | undefined>(undefined);
  const [isAutoAnalysisOpen, setIsAutoAnalysisOpen] = useState(false);
  const [isBatchAnalysisOpen, setIsBatchAnalysisOpen] = useState(false);
  const [batchFilePaths, setBatchFilePaths] = useState<string[]>([]);
  const [batchBrowserFiles, setBatchBrowserFiles] = useState<File[]>([]);
  const [batchOutputDirectory, setBatchOutputDirectory] = useState<string | null>(() => window.localStorage.getItem("tensugo.batchOutputDir"));
  const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false);
  const [isBatchPaused, setIsBatchPaused] = useState(false);
  const [isBatchConsoleVisible, setIsBatchConsoleVisible] = useState(false);
  const [batchJobLogs, setBatchJobLogs] = useState<string[]>([]);
  const [batchRunReport, setBatchRunReport] = useState<BatchRunReport | null>(null);
  const [activeProblem, setActiveProblem] = useState<ProblemItem | null>(null);
  const [isEditingProblemCandidates, setIsEditingProblemCandidates] = useState(false);
  const [isSavingProblem, setIsSavingProblem] = useState(false);
  const [problemSaveStatus, setProblemSaveStatus] = useState("");
  const [problemAiCandidates, setProblemAiCandidates] = useState<EngineCandidateMove[]>([]);
  const [isGameProgressPanelOpen, setIsGameProgressPanelOpen] = useState(false);
  const [isAutoAnalyzing, setIsAutoAnalyzing] = useState(false);
  const [autoAnalysisResume, setAutoAnalysisResume] = useState<AutoAnalysisSettings | null>(null);
  const [autoAnalysisSummary, setAutoAnalysisSummary] = useState<AutoAnalysisSummary | null>(null);
  const [tianshuReport, setTianshuReport] = useState<TianshuReport | null>(null);
  const [isTianshuOpen, setIsTianshuOpen] = useState(false);
  const [language, setLanguage] = useState<AppLanguage>(() => normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)));
  const t = useMemo(() => makeTranslator(language), [language]);
  const [isAnalysisEnabled, setIsAnalysisEnabled] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasAnalysisAttempted, setHasAnalysisAttempted] = useState(false);
  const [engineCandidates, setEngineCandidates] = useState<EngineCandidateMove[]>([]);
  const [engineCandidatesPositionKey, setEngineCandidatesPositionKey] = useState<string | null>(null);
  const [analysisPoints, setAnalysisPoints] = useState<ReviewAnalysisPoint[]>([]);
  const [showSavedAnalysis, setShowSavedAnalysis] = useState(false);
  const [previewCandidateRank, setPreviewCandidateRank] = useState<number | null>(null);
  const [candidateListVisible, setCandidateListVisible] = useState(true);
  const [coordinateLabelsVisible, setCoordinateLabelsVisible] = useState(true);
  const [moveNumberDisplay, setMoveNumberDisplay] = useState<MoveNumberDisplayMode>("last1");
  const [isResearchMode, setIsResearchMode] = useState(false);
  const [showVariationNumbers, setShowVariationNumbers] = useState(false);
  const [researchBaseMoveNumber, setResearchBaseMoveNumber] = useState<number | null>(null);
  const [sourceMainLineMoveCount, setSourceMainLineMoveCount] = useState(0);
  const [leftPaneWidth, setLeftPaneWidth] = useState(230);
  const [rightPaneWidth, setRightPaneWidth] = useState(300);
  const [viewportSize, setViewportSize] = useState(() => ({
    height: window.innerHeight,
    width: window.innerWidth
  }));
  const [analysisTrigger, setAnalysisTrigger] = useState(0);
  const [moves, setMoves] = useState<ReviewMove[]>([]);
  const [sourceMainLineMoves, setSourceMainLineMoves] = useState<ReviewMove[]>([]);
  const [gameTree, setGameTree] = useState(() => INITIAL_GAME_TREE);
  const [selectedGameNodeId, setSelectedGameNodeId] = useState(() => INITIAL_SELECTED_NODE_ID);
  const [currentPathNodeIds, setCurrentPathNodeIds] = useState<string[]>(() => INITIAL_PATH_NODE_IDS);
  const totalMoves = moves.length;
  const navigationTotalMoves = Math.max(totalMoves, sourceMainLineMoveCount || sourceMainLineMoves.length);
  const initialSnapshot = useMemo(
    () =>
      makeSnapshot({
        blackName,
        boardSize,
        currentMoveNumber: totalMoves,
        komi,
        moves: [],
        rules,
        sourceFileName,
        totalMoves,
        whiteName,
        gameDate,
        result: gameResult
      }),
    [gameResult]
  );
  const initialResearchDocument = useMemo(() => createResearchDocument(initialSnapshot), [initialSnapshot]);
  const [researchDocument, setResearchDocument] = useState<ResearchDocument>(() => initialResearchDocument);
  const [selectedResearchBlockId, setSelectedResearchBlockId] = useState<string | null>(
    () => initialResearchDocument.sections[0]?.blocks[0]?.id ?? null
  );
  const [commentaryDraft, setCommentaryDraft] = useState("");
  const [activeCommentaryBlockId, setActiveCommentaryBlockId] = useState<string | null>(
    () => initialResearchDocument.sections[0]?.blocks.find((block) => block.type === "paragraph")?.id ?? null
  );
  const analysisRequestRef = useRef(0);
  const analysisTimerRef = useRef<number | null>(null);
  const autoAnalysisStopRef = useRef(false);
  const autoAnalysisFinishRef = useRef(false);
  const batchAnalysisStopRef = useRef(false);
  const batchAnalysisPauseRef = useRef(false);
  const autoAnalysisReportRangeRef = useRef<{ startMove: number; endMove: number } | null>(null);
  const autoAnalysisSummaryRef = useRef<AutoAnalysisSummary>(createEmptyAutoAnalysisSummary());
  const engineProgressTimerRef = useRef<number | null>(null);
  const ogsConnectorRef = useRef<OGSConnector | null>(null);
  const applyOgsMoveUpdateRef = useRef<(update: OgsMoveUpdate) => void>(() => undefined);
  const processedAnalysisTriggerRef = useRef(-1);
  const [currentMoveNumber, setCurrentMoveNumber] = useState(totalMoves);
  const isAnalysisEnabledRef = useRef(isAnalysisEnabled);
  const position = useMemo(
    () => buildBoardPosition(moves, boardSize, currentMoveNumber),
    [moves, boardSize, currentMoveNumber]
  );
  const stones = position.stones;
  const currentPositionKey = useMemo(
    () => candidatePositionKey(boardSize, komi, moves.slice(0, currentMoveNumber)),
    [boardSize, currentMoveNumber, komi, moves]
  );
  const currentSnapshot = useMemo(
    () =>
      makeSnapshot({
        blackName,
        boardSize,
        currentMoveNumber,
        komi,
        moves,
        rules,
        sourceFileName,
        totalMoves,
        whiteName,
        gameDate,
        result: gameResult
      }),
    [blackName, boardSize, currentMoveNumber, gameDate, gameResult, komi, moves, rules, sourceFileName, totalMoves, whiteName]
  );
  const savedCandidates = useMemo(
    () => findSavedCandidatesForMove(researchDocument, currentMoveNumber),
    [currentMoveNumber, researchDocument]
  );
  const hasSavedAnalysis = useMemo(() => documentHasSavedAnalysis(researchDocument), [researchDocument]);
  const liveEngineCandidates = engineCandidatesPositionKey === currentPositionKey ? engineCandidates : [];
  const rawActiveCandidates = liveEngineCandidates.length > 0 ? liveEngineCandidates : showSavedAnalysis ? savedCandidates : [];
  const boardActiveCandidates = filterCandidatesOnEmptyPoints(rawActiveCandidates, stones, boardSize);
  const activeCandidates = boardActiveCandidates.slice(0, candidateDisplayLimit);
  const isShowingSavedAnalysis = liveEngineCandidates.length === 0 && showSavedAnalysis && activeCandidates.length > 0;
  const bestCandidate = activeCandidates[0];
  const previewCandidate =
    activeCandidates.find((candidate) => candidate.rank === previewCandidateRank) ?? bestCandidate ?? null;
  const displayedWinrate = bestCandidate?.winrate ?? 28;
  const activeProblemActualMove = useMemo(() => {
    if (!activeProblem || currentMoveNumber !== activeProblem.moveNumber - 1) return null;
    const move = sourceMainLineMoves[activeProblem.moveNumber - 1] ?? moves[activeProblem.moveNumber - 1];
    return move ? { ...move, isLast: false } : null;
  }, [activeProblem, currentMoveNumber, moves, sourceMainLineMoves]);
  const displayedScoreLead = bestCandidate?.scoreLead ?? -3.4;
  const displayedVisits = bestCandidate?.visits ?? 137000;
  const engineLabel = isShowingSavedAnalysis ? "TSG 静态分析" : engineProfile?.name ?? "未配置";
  const displayedVariationBaseMoveNumber = showVariationNumbers
    ? researchBaseMoveNumber ?? inferVariationBaseMoveNumber(moves, sourceMainLineMoves)
    : null;
  const candidateCountText = activeCandidates.length > 0 ? `${activeCandidates.length} 个候选点` : "无候选点";
  const branchRows = useMemo(() => flattenBranchTree(gameTree, selectedGameNodeId), [gameTree, selectedGameNodeId]);
  const selectedResearchBlock = useMemo(
    () =>
      researchDocument.sections
        .flatMap((section) => section.blocks)
        .find((block) => block.id === selectedResearchBlockId) ?? null,
    [researchDocument, selectedResearchBlockId]
  );
  const autoMatchText = autoAnalysisSummary
    ? `${formatPercent(autoAnalysisSummary.candidateMatches / autoAnalysisSummary.analyzed)} / 首选 ${formatPercent(
        autoAnalysisSummary.topMatches / autoAnalysisSummary.analyzed
      )}`
    : "未统计";
  const coordinateLabelInset = coordinateLabelsVisible ? 48 : 0;
  const boardPixelSize = Math.max(
    180,
    Math.floor(
      Math.min(
        viewportSize.height - 104,
        viewportSize.width - leftPaneWidth - rightPaneWidth - 34 + coordinateLabelInset
      )
    )
  );
  const toolbarScale = toolbarScaleForBoardSize(boardPixelSize);
  const startEngineProgressLog = (title: string, lines: string[]) => {
    if (engineProgressTimerRef.current !== null) {
      window.clearInterval(engineProgressTimerRef.current);
      engineProgressTimerRef.current = null;
    }
    const startedAt = Date.now();
    setEngineDiagnostics([`${new Date().toLocaleTimeString()} ${title}`, ...lines].join("\n"));
    engineProgressTimerRef.current = window.setInterval(() => {
      const elapsed = Math.round((Date.now() - startedAt) / 1000);
      setEngineDiagnostics((previous) => `${previous}\n${new Date().toLocaleTimeString()} still working... ${elapsed}s`);
    }, 1500);
  };
  const stopEngineProgressLog = () => {
    if (engineProgressTimerRef.current !== null) {
      window.clearInterval(engineProgressTimerRef.current);
      engineProgressTimerRef.current = null;
    }
  };
  useEffect(() => {
    isAnalysisEnabledRef.current = isAnalysisEnabled;
    if (isAnalysisEnabled) {
      queueAnalysisIfEnabled(20);
    } else if (analysisTimerRef.current !== null) {
      window.clearTimeout(analysisTimerRef.current);
      analysisTimerRef.current = null;
      if (isTauriRuntime()) {
        void stopContinuousAnalysis();
      }
    }
    return undefined;
  }, [isAnalysisEnabled]);
  useEffect(() => {
    if (!hasSavedAnalysis && showSavedAnalysis) {
      setShowSavedAnalysis(false);
    }
  }, [hasSavedAnalysis, showSavedAnalysis]);
  useEffect(() => {
    const handleResize = () => {
      setViewportSize({
        height: window.innerHeight,
        width: window.innerWidth
      });
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  useEffect(() => {
    const connector = new OGSConnector();
    ogsConnectorRef.current = connector;
    connector.onConnectionStatusChanged((update) => {
      setOgsStatus(update.status);
      setOgsStatusDetail(update.detail);
      if (update.sourceLabel) {
        setOgsSourceLabel(update.sourceLabel);
      }
      if (update.detail) {
        setLastAction(update.detail);
      }
      if (update.status === "error") {
        setLastAction(update.detail ?? "OGS connection error");
      }
    });
    connector.onMovesUpdated((update) => {
      applyOgsMoveUpdateRef.current(update);
    });
    return () => {
      connector.disconnect();
      ogsConnectorRef.current = null;
    };
  }, []);
  useEffect(() => {
    if (!isTauriRuntime()) {
      setEngineStatus("浏览器预览：分析需要在 Mac App 中运行");
      return;
    }
    let cancelled = false;
    void getDefaultEngineProfile()
      .then((builtinProfile) => {
        if (cancelled) {
          return;
        }
        const savedProfiles = filterHiddenEngineProfiles(loadEngineProfiles());
        const nextProfiles = mergeEngineProfiles(savedProfiles, isCompleteEngineProfile(builtinProfile) ? [builtinProfile] : []);
        const activeKey = window.localStorage.getItem(ACTIVE_ENGINE_PROFILE_KEY);
        const activeProfile =
          nextProfiles.find((item) => engineProfileKey(item) === activeKey) ??
          nextProfiles.find((item) => engineProfileKey(item) === engineProfileKey(builtinProfile)) ??
          nextProfiles.find(isCompleteEngineProfile) ??
          nextProfiles[0] ??
          filterHiddenEngineProfiles([loadEngineProfile()])[0] ??
          DEFAULT_ENGINE_PROFILE;
        setEngineProfiles(nextProfiles);
        setSelectedEngineProfileIndex(Math.max(0, nextProfiles.findIndex((item) => engineProfileKey(item) === engineProfileKey(activeProfile))));
        setEngineProfile(activeProfile);
        setEngineStatus(isCompleteEngineProfile(activeProfile) ? `已加载引擎配置：${activeProfile.name}` : "引擎未配置，请手动选择或点击 Auto Detect");
        setEngineDiagnostics("启动时只加载内置/已保存引擎，不扫描系统路径。点击 Auto Detect 才会扫描。");
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        const savedProfiles = filterHiddenEngineProfiles(loadEngineProfiles());
        const activeProfile = savedProfiles.find(isCompleteEngineProfile) ?? savedProfiles[0] ?? DEFAULT_ENGINE_PROFILE;
        setEngineProfiles(savedProfiles);
        setEngineProfile(activeProfile);
        setEngineDiagnostics(`内置引擎加载失败：${String(error)}\n启动时不自动扫描系统路径。点击 Auto Detect 才会扫描。`);
        setEngineStatus(isCompleteEngineProfile(activeProfile) ? `已加载引擎配置：${activeProfile.name}` : "引擎未配置，请手动选择或点击 Auto Detect");
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const invalidatePendingAnalysis = () => {
    analysisRequestRef.current += 1;
    if (analysisTimerRef.current !== null) {
      window.clearTimeout(analysisTimerRef.current);
      analysisTimerRef.current = null;
    }
    setIsAnalyzing(false);
  };
  const queueAnalysisIfEnabled = (delayMs = 80) => {
    if (isAnalysisEnabled) {
      if (analysisTimerRef.current !== null) {
        window.clearTimeout(analysisTimerRef.current);
      }
      analysisTimerRef.current = window.setTimeout(() => {
        analysisTimerRef.current = null;
        setAnalysisTrigger((value) => value + 1);
      }, delayMs);
    }
  };
  const appendResearchBlock = (block: ResearchBlock | null) => {
    if (!block) {
      setLastAction("当前没有可插入的研究内容。");
      return;
    }
    setResearchDocument((document) =>
      withCurrentAnalysisBlocks(appendBlock(updateDocumentSource(document, currentSnapshot), block))
    );
    setSelectedResearchBlockId(block.id);
    setLastAction("已插入研究文档 block。");
  };
  const withCurrentAnalysisBlocks = (document: ResearchDocument): ResearchDocument => {
    return withCandidateMovesBlock(document, currentMoveNumber, liveEngineCandidates);
  };
  const withCandidateMovesBlock = (
    document: ResearchDocument,
    moveNumber: number,
    candidates: EngineCandidateMove[]
  ): ResearchDocument => {
    const candidateBlock = createCandidateMovesBlock(moveNumber, candidates);
    if (!candidateBlock) {
      return document;
    }
    const existingBlock = document.sections
      .flatMap((section) => section.blocks)
      .find((block) => block.type === "candidate_moves" && block.moveNumber === moveNumber);
    return existingBlock
      ? replaceBlock(document, existingBlock.id, candidateBlock)
      : appendBlock(document, candidateBlock);
  };
  const researchDocumentWithAnalysis = (document: ResearchDocument): ResearchDocument => ({
    ...document,
    analysis: buildResearchAnalysisSnapshot(
      autoAnalysisSummaryRef.current.analyzed > 0 ? autoAnalysisSummaryRef.current : autoAnalysisSummary,
      analysisPoints,
      autoAnalysisReportRangeRef.current,
      engineProfile
    )
  });
  const saveResearchDocument = async () => {
    const document = researchDocumentWithAnalysis(withCurrentAnalysisBlocks(updateDocumentSource(researchDocument, currentSnapshot)));
    const json = JSON.stringify(toBrgDocument(document, gameTree));
    await saveTextFileWithDialog(json, fileStem(document.title) + ".tsg", `已保存 TensuGo 研究文件，大小 ${formatBytes(utf8ByteLength(json))}。`);
  };
  const exportResearchPdf = async () => {
    const html = renderResearchDocumentHtml(
      researchDocumentWithAnalysis(withCurrentAnalysisBlocks(updateDocumentSource(researchDocument, currentSnapshot))),
      gameTree,
      researchExportSettings
    );
    if (researchExportSettings.format === "html" || !isTauriRuntime()) {
      downloadTextFile(html, fileStem(researchDocument.title) + ".html", "text/html;charset=utf-8");
      setLastAction(researchExportSettings.format === "html" ? "已导出 HTML。" : "浏览器预览暂不能直接导出 PDF，已保存 HTML。");
      return;
    }

    try {
      setLastAction("正在导出 PDF，请稍候...");
      const result = await invoke<SaveTextFileResult>("save_pdf_with_dialog", {
        request: {
          default_name: fileStem(researchDocument.title) + ".pdf",
          default_dir: window.localStorage.getItem(LAST_RESEARCH_SAVE_DIR_KEY),
          html
        }
      });
      if (result.saved && result.path) {
        window.localStorage.setItem(LAST_RESEARCH_SAVE_DIR_KEY, directoryName(result.path));
        setLastAction(`已导出 PDF。${result.path}`);
      } else if (result.error) {
        setLastAction(`PDF 导出失败: ${result.error}`);
      } else {
        setLastAction("已取消 PDF 导出。");
      }
    } catch (error) {
      setLastAction(`PDF 导出失败: ${String(error)}`);
    }
  };
  const saveTextFileWithDialog = async (content: string, defaultName: string, successText: string) => {
    if (!isTauriRuntime()) {
      downloadTextFile(content, defaultName, "text/plain;charset=utf-8");
      setLastAction(`${successText}（浏览器预览使用下载保存。）`);
      return;
    }

    try {
      const result = await invoke<SaveTextFileResult>("save_text_file_with_dialog", {
        request: {
          default_name: defaultName,
          default_dir: window.localStorage.getItem(LAST_RESEARCH_SAVE_DIR_KEY),
          content
        }
      });
      if (result.saved && result.path) {
        window.localStorage.setItem(LAST_RESEARCH_SAVE_DIR_KEY, directoryName(result.path));
        setLastAction(`${successText} ${result.path}`);
      } else if (result.error) {
        setLastAction(`保存失败: ${result.error}`);
      } else {
        setLastAction("已取消保存。");
      }
    } catch (error) {
      setLastAction(`保存失败: ${String(error)}`);
    }
  };
  const loadResearchDocument = async (file: File) => {
    try {
      const parsed = validateResearchDocument(JSON.parse(await file.text()));
      setResearchDocument(parsed);
      setGameResult(parsed.sourceGame.result);
      if (parsed.mainSgf || parsed.gameTree) {
        const gameRecord = parsed.mainSgf ? parseGameRecord(parsed.mainSgf, parsed.sourceGame.fileName) : null;
        const baseTree = parsed.gameTree ?? gameRecord?.gameTree ?? createEmptyGameTree(parsed.sourceGame.boardSize, parsed.sourceGame.komi);
        const restoredTree = parsed.gameTree ? baseTree : appendResearchVariationsToTree(baseTree, parsed);
        const mainMoves = mainLineMovesFromTree(restoredTree);
        const selectedNodeId = findMainLineEndNodeId(restoredTree);
        invalidatePendingAnalysis();
        setAutoAnalysisResume(null);
        setBoardSize(restoredTree.boardSize);
        setKomi(restoredTree.komi);
        setRules(parsed.sourceGame.rules || gameRecord?.rules || "中国");
        setBlackName(parsed.sourceGame.players.black || gameRecord?.blackName || "黑棋");
        setWhiteName(parsed.sourceGame.players.white || gameRecord?.whiteName || "白棋");
        setGameDate(parsed.sourceGame.gameDate || gameRecord?.gameDate);
        setGameResult(parsed.sourceGame.result || gameRecord?.result);
        setGameTimeControl(undefined);
        setSourceFileName(parsed.sourceGame.fileName);
        setSgfWarnings(gameRecord?.warnings ?? []);
        setMoves(mainMoves);
        setSourceMainLineMoves(mainMoves);
        setSourceMainLineMoveCount(mainMoves.length);
        setGameTree(restoredTree);
        setSelectedGameNodeId(selectedNodeId);
        setCurrentPathNodeIds(moveNodeIdsToNode(restoredTree, selectedNodeId));
        setCurrentMoveNumber(mainMoves.length);
        setResearchBaseMoveNumber(null);
        setEngineCandidates([]);
        setAnalysisPoints([]);
        setHasAnalysisAttempted(false);
      }
      if (parsed.analysis) {
        autoAnalysisSummaryRef.current = {
          analyzed: parsed.analysis.analyzed,
          candidateMatches: parsed.analysis.candidateMatches,
          details: parsed.analysis.details,
          knownScoreLosses: parsed.analysis.knownScoreLosses,
          knownWinrateLosses: parsed.analysis.knownWinrateLosses ?? parsed.analysis.details.filter((detail) => detail.winrateLoss !== null).length,
          matches: parsed.analysis.matches ?? parsed.analysis.details.filter((detail) => detail.isMatch).length,
          topMatches: parsed.analysis.topMatches,
          totalMatchScore: parsed.analysis.totalMatchScore,
          totalScoreLoss: parsed.analysis.totalScoreLoss,
          totalWinrateLoss: parsed.analysis.totalWinrateLoss
        };
        autoAnalysisReportRangeRef.current = { startMove: parsed.analysis.startMove, endMove: parsed.analysis.endMove };
        setAutoAnalysisSummary({ ...autoAnalysisSummaryRef.current });
        setAnalysisPoints(parsed.analysis.points);
      } else {
        autoAnalysisSummaryRef.current = createEmptyAutoAnalysisSummary();
        autoAnalysisReportRangeRef.current = null;
        setAutoAnalysisSummary(null);
        setAnalysisPoints([]);
      }
      setShowSavedAnalysis(documentHasSavedAnalysis(parsed));
      setSelectedResearchBlockId(firstVisibleResearchBlockId(parsed));
      setActiveCommentaryBlockId(parsed.sections[0]?.blocks.find((block) => block.type === "paragraph" || block.type === "conclusion")?.id ?? null);
      setCommentaryDraft("");
      setLastAction(`已打开研究文档 ${file.name}。`);
    } catch (error) {
      setLastAction(`研究文档打开失败: ${String(error)}`);
    }
  };
  const updateResearchCommentary = (markdown: string) => {
    setCommentaryDraft(markdown);
  };
  const clearResearchBlockSelection = () => {
    setSelectedResearchBlockId(null);
    setActiveCommentaryBlockId(null);
  };
  const insertTextBlock = () => {
    const markdown = commentaryDraft.trim();
    if (!markdown) {
      setLastAction("当前没有可插入的文字。");
      return;
    }

    const textBlock = createParagraphBlock(markdown);
    textBlock.title = "pure_text";
    if (selectedResearchBlock?.type === "paragraph" || selectedResearchBlock?.type === "conclusion") {
      setResearchDocument((document) => replaceBlock(updateDocumentSource(document, currentSnapshot), selectedResearchBlock.id, textBlock));
      clearResearchBlockSelection();
      setCommentaryDraft("");
      setLastAction("已更新文字 block。");
    } else {
      setResearchDocument((document) => appendBlock(updateDocumentSource(document, currentSnapshot), textBlock));
      clearResearchBlockSelection();
      setCommentaryDraft("");
      setLastAction("已插入纯文字。");
    }
  };
  const updateResearchDocumentMeta = (patch: { author?: string; title?: string }) => {
    setResearchDocument((document) => ({
      ...document,
      ...patch,
      updatedAt: new Date().toISOString()
    }));
  };
  const updateResearchExportSettings = (patch: Partial<ResearchExportSettings>) => {
    setResearchExportSettings((settings) => {
      const next = normalizeResearchExportSettings({ ...settings, ...patch });
      window.localStorage.setItem(RESEARCH_EXPORT_SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
  };
  const updateCandidateDisplayLimit = (value: number) => {
    const nextLimit = normalizeCandidateDisplayLimit(value);
    setCandidateDisplayLimit(nextLimit);
    setPreviewCandidateRank(null);
    window.localStorage.setItem(INTERFACE_SETTINGS_KEY, JSON.stringify({ candidateDisplayLimit: nextLimit }));
  };
  const updateLanguage = (nextLanguage: AppLanguage) => {
    const normalized = normalizeLanguage(nextLanguage);
    setLanguage(normalized);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
  };
  const updateEngineProfile = (profile: EngineProfile) => {
    setEngineProfile(profile);
    window.localStorage.setItem(ENGINE_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  };
  const appendEngineDebug = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setEngineDiagnostics((previous) => `[${timestamp}] ${message}\n${previous}`.slice(0, 12000));
  };
  const saveCurrentEngineProfile = () => {
    if (!engineProfile) {
      setEngineStatus("没有可保存的引擎配置");
      return;
    }
    const nextProfiles = mergeEngineProfiles(engineProfiles, [{ ...engineProfile, source: engineProfile.source ?? "用户配置" }]);
    setEngineProfiles(nextProfiles);
    saveEngineProfiles(nextProfiles);
    setSelectedEngineProfileIndex(nextProfiles.findIndex((profile) => engineProfileKey(profile) === engineProfileKey(engineProfile)));
    window.localStorage.setItem(ENGINE_PROFILE_STORAGE_KEY, JSON.stringify(engineProfile));
    setEngineStatus(`已添加/更新引擎：${engineProfile.name}`);
  };
  const addManualEngineProfile = (commandLine: string) => {
    const trimmed = commandLine.trim();
    if (!trimmed) {
      setEngineStatus("手工命令为空");
      return;
    }
    const manualProfile: EngineProfile = {
      ...DEFAULT_ENGINE_PROFILE,
      name: "手工 KataGo 命令",
      executablePath: "",
      modelPath: "",
      configPath: "",
      commandLine: trimmed,
      exists: true,
      source: "手工命令"
    };
    const nextProfiles = mergeEngineProfiles(engineProfiles, [manualProfile]);
    const nextIndex = Math.max(0, nextProfiles.findIndex((profile) => engineProfileKey(profile) === engineProfileKey(manualProfile)));
    setEngineProfiles(nextProfiles);
    saveEngineProfiles(nextProfiles);
    setSelectedEngineProfileIndex(nextIndex);
    updateEngineProfile(nextProfiles[nextIndex] ?? manualProfile);
    setEngineStatus("已添加手工 KataGo 命令");
  };
  const selectEngineProfile = (profileIndex: number) => {
    const selected = engineProfiles[profileIndex];
    if (!selected) {
      return;
    }
    setSelectedEngineProfileIndex(profileIndex);
    updateEngineProfile(selected);
    setEngineStatus(`已选择引擎：${selected.name}`);
  };
  const deleteEngineProfile = (profileIndex: number) => {
    appendEngineDebug(`delete requested: index=${profileIndex}, count=${engineProfiles.length}, selectedIndex=${selectedEngineProfileIndex}`);
    const selected = engineProfiles[profileIndex];
    if (!selected) {
      appendEngineDebug(`delete aborted: invalid index=${profileIndex}, count=${engineProfiles.length}`);
      setEngineStatus(`删除失败：无效行号 ${profileIndex + 1}`);
      return;
    }
    const profileKey = engineProfileKey(selected);
    if (isProtectedEngineProfile(selected)) {
      appendEngineDebug(`delete blocked: protected source="${selected.source ?? ""}", key="${profileKey}"`);
      setEngineStatus("内置默认引擎不可删除");
      return;
    }
    appendEngineDebug(
      `delete confirmed: index=${profileIndex}, name="${selected.name}", source="${selected.source ?? ""}", engine="${selected.executablePath}", model="${selected.modelPath}", config="${selected.configPath}", key="${profileKey}"`
    );
    saveHiddenEngineProfileKey(profileKey);
    const nextProfiles = [...engineProfiles];
    nextProfiles.splice(profileIndex, 1);
    setEngineProfiles(nextProfiles);
    saveEngineProfiles(nextProfiles);
    const nextIndex = nextProfiles.length === 0 ? 0 : Math.min(profileIndex, nextProfiles.length - 1);
    setSelectedEngineProfileIndex(nextIndex);
    const activeKey = window.localStorage.getItem(ACTIVE_ENGINE_PROFILE_KEY);
    const currentKey = engineProfile ? engineProfileKey(engineProfile) : "";
    if (activeKey === profileKey) {
      window.localStorage.removeItem(ACTIVE_ENGINE_PROFILE_KEY);
    }
    if (currentKey === profileKey) {
      window.localStorage.removeItem(ENGINE_PROFILE_STORAGE_KEY);
      const fallback = nextProfiles[Math.min(profileIndex, nextProfiles.length - 1)] ?? DEFAULT_ENGINE_PROFILE;
      updateEngineProfile(fallback);
      appendEngineDebug(`delete completed: before=${engineProfiles.length}, after=${nextProfiles.length}, fallback="${fallback.name}"`);
      setEngineStatus(`已删除第 ${profileIndex + 1} 行引擎：${selected.name}，当前切换到 ${fallback.name}`);
      return;
    }
    appendEngineDebug(`delete completed: before=${engineProfiles.length}, after=${nextProfiles.length}`);
    setEngineStatus(`已删除第 ${profileIndex + 1} 行引擎：${selected.name}`);
  };
  const moveEngineProfile = (index: number, direction: "up" | "down") => {
    if (index < 0 || index >= engineProfiles.length) {
      return;
    }
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= engineProfiles.length) {
      return;
    }
    const nextProfiles = [...engineProfiles];
    const [selected] = nextProfiles.splice(index, 1);
    nextProfiles.splice(targetIndex, 0, selected);
    setEngineProfiles(nextProfiles);
    saveEngineProfiles(nextProfiles);
    setSelectedEngineProfileIndex(targetIndex);
    setEngineStatus(`已调整引擎顺序：${selected.name}`);
  };
  const setCurrentEngineAsDefault = () => {
    if (!engineProfile) {
      setEngineStatus("没有可设为默认的引擎配置");
      return;
    }
    const nextProfiles = mergeEngineProfiles(engineProfiles, [engineProfile]);
    setEngineProfiles(nextProfiles);
    saveEngineProfiles(nextProfiles);
    window.localStorage.setItem(ACTIVE_ENGINE_PROFILE_KEY, engineProfileKey(engineProfile));
    window.localStorage.setItem(ENGINE_PROFILE_STORAGE_KEY, JSON.stringify(engineProfile));
    setEngineStatus(`已设为默认引擎：${engineProfile.name}`);
  };
  const autoDetectEngine = async () => {
    if (!isTauriRuntime()) {
      setEngineStatus("浏览器预览：请在 App 中自动检测引擎");
      return;
    }
    setEngineStatus("正在自动检测 KataGo...");
    startEngineProgressLog("正在自动检测 KataGo...", [
      "扫描内置引擎、已知 Windows 引擎、用户路径附近的模型和 cfg。",
      "检测完成后会自动更新下面的引擎列表。"
    ]);
    try {
      const result = await discoverEngineProfile(engineProfile);
      stopEngineProgressLog();
      const visibleCandidates = filterHiddenEngineProfiles(result.candidates).filter(isCompleteEngineProfile);
      const nextProfiles = mergeEngineProfiles(filterHiddenEngineProfiles(engineProfiles), visibleCandidates);
      const selectedKey = engineProfileKey(result.selected);
      const selectedProfile =
        nextProfiles.find((profile) => engineProfileKey(profile) === selectedKey) ??
        nextProfiles.find((profile) => profile.exists) ??
        nextProfiles[0] ??
        DEFAULT_ENGINE_PROFILE;
      updateEngineProfile(selectedProfile);
      setEngineProfiles(nextProfiles);
      saveEngineProfiles(nextProfiles);
      setSelectedEngineProfileIndex(Math.max(0, nextProfiles.findIndex((profile) => engineProfileKey(profile) === engineProfileKey(selectedProfile))));
      setEngineDiagnostics(result.diagnostics);
      setEngineStatus(selectedProfile.exists ? `已发现 ${selectedProfile.name}（${selectedProfile.source ?? "auto"}）` : "未发现完整 KataGo 配置");
    } catch (error) {
      stopEngineProgressLog();
      setEngineDiagnostics(String(error));
      setEngineStatus(`自动检测失败: ${String(error)}`);
    }
  };
  const chooseEngineConfigPath = async (kind: "engine" | "model" | "config") => {
    if (!isTauriRuntime()) {
      setEngineStatus("浏览器预览：请手动粘贴路径");
      return;
    }
    const result = await chooseEnginePath(kind);
    if (result.error) {
      setEngineStatus(result.error);
      return;
    }
    if (!result.selected || !result.path) {
      return;
    }
    if (kind === "engine") {
      const baseProfile = {
        ...(engineProfile ?? DEFAULT_ENGINE_PROFILE),
        executablePath: result.path,
        modelPath: "",
        configPath: "",
        name: engineProfile?.name || "用户 KataGo",
        source: "用户选择"
      };
      try {
        setEngineStatus("正在根据 katago.exe 自动查找模型和配置...");
        startEngineProgressLog("正在根据 katago.exe 自动查找模型和配置...", [
          result.path,
          "会在引擎目录、上级目录、weights/Weights、configs、katago_configs 中查找。"
        ]);
        const discovery = await discoverEngineProfile(baseProfile);
        stopEngineProgressLog();
        updateEngineProfile(discovery.selected);
        setEngineDiagnostics(discovery.diagnostics);
        setEngineStatus(
          discovery.selected.exists
            ? `已配置 ${discovery.selected.name}（${discovery.selected.source ?? "auto"}）`
            : "已选择 katago.exe，但还需要模型或配置文件"
        );
      } catch (error) {
        stopEngineProgressLog();
        updateEngineProfile(baseProfile);
        setEngineDiagnostics(String(error));
        setEngineStatus(`已选择 katago.exe，自动补全失败: ${String(error)}`);
      }
      return;
    }
    if (kind === "model") {
      const baseProfile = {
        ...(engineProfile ?? DEFAULT_ENGINE_PROFILE),
        modelPath: result.path,
        configPath: "",
        name: engineProfile?.name || "用户 KataGo",
        source: "用户选择"
      };
      try {
        setEngineStatus("正在根据权重文件自动查找 GTP 配置...");
        startEngineProgressLog("正在根据权重文件自动查找 GTP 配置...", [
          result.path,
          "会在权重目录、引擎目录和常见配置目录里查找 default_gtp.cfg。"
        ]);
        const discovery = await discoverEngineProfile(baseProfile);
        stopEngineProgressLog();
        updateEngineProfile(discovery.selected);
        setEngineDiagnostics(discovery.diagnostics);
        setEngineStatus(
          discovery.selected.exists
            ? `已配置 ${discovery.selected.name}（${discovery.selected.source ?? "auto"}）`
            : "已选择权重文件，但还需要 katago.exe 或配置文件"
        );
      } catch (error) {
        stopEngineProgressLog();
        updateEngineProfile(baseProfile);
        setEngineDiagnostics(String(error));
        setEngineStatus(`已选择权重文件，自动补全失败: ${String(error)}`);
      }
      return;
    }
    const patch = { configPath: result.path };
    updateEngineProfile({
      ...(engineProfile ?? DEFAULT_ENGINE_PROFILE),
      ...patch,
      name: engineProfile?.name || "用户 KataGo",
      source: "用户配置"
    });
  };
  const resetEngineProfile = async () => {
    window.localStorage.removeItem(ENGINE_PROFILE_STORAGE_KEY);
    window.localStorage.removeItem(ACTIVE_ENGINE_PROFILE_KEY);
    setEngineProfile(DEFAULT_ENGINE_PROFILE);
    setEngineDiagnostics("已重置引擎配置。不会自动检测；需要扫描时请手动点击 Auto Detect。");
    setEngineStatus("已重置引擎配置");
  };
  const showResearchBlockOnBoard = (blockId: string) => {
    const block = researchDocument.sections.flatMap((section) => section.blocks).find((item) => item.id === blockId);
    if (!block) {
      return;
    }
    setSelectedResearchBlockId(block.id);
    setActiveCommentaryBlockId(block.type === "paragraph" || block.type === "conclusion" ? block.id : null);
    setCommentaryDraft(block.type === "paragraph" || block.type === "conclusion" ? block.markdown : "");
    if (block.type === "variation") {
      const baseMoves = sourceMainLineMoves.slice(0, block.fromMoveNumber);
      const variationMoves = block.sequence
        .map((point, index) => gtpPointToMove(point, block.boardSize, block.fromMoveNumber + index + 1))
        .filter((move): move is ReviewMove => Boolean(move));
      const nextMoves = [...baseMoves, ...variationMoves];
      invalidatePendingAnalysis();
      setMoves(nextMoves);
      setCurrentMoveNumber(nextMoves.length);
      setResearchBaseMoveNumber(block.fromMoveNumber);
      setShowVariationNumbers(true);
      setLastAction(`已显示第 ${block.fromMoveNumber} 手后的评论变化。`);
      return;
    }
    if (block.type === "board") {
      jumpToMove(block.moveNumber);
      return;
    }
    if (block.type === "game_progress") {
      jumpToMove(block.endMoveNumber);
      setShowVariationNumbers(true);
      setLastAction(`已跳到原棋谱第 ${block.endMoveNumber} 手。`);
    }
  };
  const setResearchMode = (enabled: boolean) => {
    setIsResearchMode(enabled);
    if (enabled) {
      setShowVariationNumbers(true);
      setResearchBaseMoveNumber(null);
      setLastAction("已进入写棋评模式：从任意手开始落子时，会自动记录变化图起点。");
    } else {
      setLastAction("已回到复盘模式。");
    }
  };
  const insertCurrentVariation = () => {
    const commentary = commentaryDraft.trim();
    const baseMoveNumber = researchBaseMoveNumber ?? inferVariationBaseMoveNumber(moves, sourceMainLineMoves);
    if (baseMoveNumber !== null) {
      const variationMoves = moves.slice(baseMoveNumber, currentMoveNumber);
      if (variationMoves.length > 0) {
        const sequence = variationMoves.map((move) => moveToGtpPoint(move, boardSize));
        const variationBlock = withVariationComment(
          createManualVariationBlock(baseMoveNumber, boardSize, currentSnapshot.stones, sequence),
          commentary
        );
        if (selectedResearchBlock?.type === "variation") {
          setResearchDocument((document) =>
            withCurrentAnalysisBlocks(replaceBlock(updateDocumentSource(document, currentSnapshot), selectedResearchBlock.id, variationBlock))
          );
          clearResearchBlockSelection();
          setLastAction(`已更新 ${sequence.length} 手变化，并回到第 ${baseMoveNumber} 手。`);
        } else {
          setResearchDocument((document) =>
            withCurrentAnalysisBlocks(appendBlock(updateDocumentSource(document, currentSnapshot), variationBlock))
          );
          clearResearchBlockSelection();
          setLastAction(`已插入 ${sequence.length} 手变化，并回到第 ${baseMoveNumber} 手。`);
        }
        setActiveCommentaryBlockId(null);
        setCommentaryDraft("");
        setResearchBaseMoveNumber(null);
        jumpToMove(baseMoveNumber);
        return;
      }
    }

    const variationBlock = createVariationBlock(currentSnapshot, previewCandidate);
    if (!variationBlock) {
      appendResearchBlock(null);
      return;
    }
    const commentedVariationBlock = withVariationComment(variationBlock, commentary);
    if (selectedResearchBlock?.type === "variation") {
      setResearchDocument((document) =>
        withCurrentAnalysisBlocks(replaceBlock(updateDocumentSource(document, currentSnapshot), selectedResearchBlock.id, commentedVariationBlock))
      );
      clearResearchBlockSelection();
      setLastAction("已更新当前变化。");
    } else {
      setResearchDocument((document) =>
        withCurrentAnalysisBlocks(appendBlock(updateDocumentSource(document, currentSnapshot), commentedVariationBlock))
      );
      clearResearchBlockSelection();
      setLastAction("已插入当前变化。");
    }
    setActiveCommentaryBlockId(null);
    setCommentaryDraft("");
  };
  const insertGameProgress = (range: { startMoveNumber: number; endMoveNumber: number }) => {
    const mainMoves = sourceMainLineMoves.length > 0 ? sourceMainLineMoves : mainLineMovesFromTree(gameTree);
    const block = createGameProgressBlock(mainMoves.length > 0 ? mainMoves : moves, boardSize, range.startMoveNumber, range.endMoveNumber);
    if (!block) {
      setLastAction("当前没有可插入的原棋谱。");
      return;
    }
    setResearchDocument((document) => appendBlock(updateDocumentSource(document, currentSnapshot), block));
    setSelectedResearchBlockId(block.id);
    setIsGameProgressPanelOpen(false);
    setLastAction(`已插入原棋谱第 ${block.startMoveNumber}-${block.endMoveNumber} 手。`);
  };
  const updateKomi = (nextKomi: number) => {
    invalidatePendingAnalysis();
    setKomi(nextKomi);
    setEngineCandidates([]);
    setAnalysisPoints([]);
    setPreviewCandidateRank(null);
    setHasAnalysisAttempted(false);
    setLastAction(`贴目已改为 ${nextKomi.toFixed(1)}，当前分析结果已作废。`);
    queueAnalysisIfEnabled();
  };
  const jumpToMove = (moveNumber: number) => {
    invalidatePendingAnalysis();
    const nextMoveNumber = Math.max(0, Math.min(navigationTotalMoves, moveNumber));
    if (nextMoveNumber > totalMoves && sourceMainLineMoves.length >= nextMoveNumber) {
      const mainLineEndNodeId = findMainLineEndNodeId(gameTree);
      const nextSelectedNodeId = nodeIdAtMoveNumber(gameTree, mainLineEndNodeId, nextMoveNumber);
      setMoves(sourceMainLineMoves);
      setCurrentPathNodeIds(moveNodeIdsToNode(gameTree, mainLineEndNodeId));
      setCurrentMoveNumber(nextMoveNumber);
      setSelectedGameNodeId(nextSelectedNodeId);
      setResearchBaseMoveNumber(null);
      setEngineCandidates([]);
      setHasAnalysisAttempted(false);
      setLastAction(`已切回直播主线第 ${nextMoveNumber} / ${sourceMainLineMoves.length} 手。`);
      if (isAnalysisEnabled) {
        setLastAction(`已切回直播主线第 ${nextMoveNumber} / ${sourceMainLineMoves.length} 手，正在排队分析。`);
        queueAnalysisIfEnabled();
      }
      return;
    }
    setCurrentMoveNumber(nextMoveNumber);
    setSelectedGameNodeId(nextMoveNumber > 0 ? currentPathNodeIds[nextMoveNumber - 1] ?? selectedGameNodeId : "root");
    setEngineCandidates([]);
    setHasAnalysisAttempted(false);
    setLastAction(`跳到第 ${nextMoveNumber} / ${navigationTotalMoves} 手。`);
    if (isAnalysisEnabled) {
      setLastAction(`跳到第 ${nextMoveNumber} / ${navigationTotalMoves} 手，正在排队分析。`);
      queueAnalysisIfEnabled();
    }
  };
  const jumpToGameNode = (nodeId: string) => {
    invalidatePendingAnalysis();
    const pathMoves = pathMovesToNode(gameTree, nodeId);
    const fullPath = pathMovesWithMainContinuation(gameTree, nodeId);
    if (!pathMoves) {
      setLastAction("没有找到这个分支节点。");
      return;
    }
    setMoves(fullPath?.moves ?? pathMoves);
    setCurrentMoveNumber(pathMoves.length);
    setSelectedGameNodeId(nodeId);
    setCurrentPathNodeIds(fullPath?.nodeIds ?? moveNodeIdsToNode(gameTree, nodeId));
    setEngineCandidates([]);
    setHasAnalysisAttempted(false);
    setResearchBaseMoveNumber(null);
    setLastAction(`已跳到分支第 ${pathMoves.length} 手。`);
    queueAnalysisIfEnabled();
  };
  const promoteCurrentBranch = () => {
    if (selectedGameNodeId === "root") {
      setLastAction("当前在根节点，没有可设为主分支的变化。");
      return;
    }
    const nextTree = promoteNodeToMainLine(gameTree, selectedGameNodeId);
    const nextSourceMoves = mainLineMovesFromTree(nextTree);
    const fullPath = pathMovesWithMainContinuation(nextTree, selectedGameNodeId);
    const pathMoves = fullPath?.moves ?? pathMovesToNode(nextTree, selectedGameNodeId) ?? moves;
    const pathNodeIds = fullPath?.nodeIds ?? moveNodeIdsToNode(nextTree, selectedGameNodeId);
    const clickedMoveNumber = pathMovesToNode(nextTree, selectedGameNodeId)?.length ?? currentMoveNumber;
    const nextMoveNumber = Math.min(currentMoveNumber, clickedMoveNumber, pathMoves.length);
    const nextSelectedNodeId = nextMoveNumber > 0 ? pathNodeIds[nextMoveNumber - 1] ?? selectedGameNodeId : "root";
    setGameTree(nextTree);
    setSourceMainLineMoves(nextSourceMoves);
    setSourceMainLineMoveCount(nextSourceMoves.length);
    setMoves(pathMoves);
    setCurrentMoveNumber(nextMoveNumber);
    setSelectedGameNodeId(nextSelectedNodeId);
    setCurrentPathNodeIds(pathNodeIds);
    setLastAction("已将当前变化设为主分支。");
  };
  const deleteCurrentBranch = () => {
    if (selectedGameNodeId === "root") {
      setLastAction("当前在根节点，不能删除。");
      return;
    }
    const confirmed = window.confirm("删除当前节点及其后续分支？这个操作不能撤销。");
    if (!confirmed) {
      setLastAction("已取消删除分支。");
      return;
    }
    const { tree: nextTree, nextSelectedNodeId } = deleteSubtreeFromGameTree(gameTree, selectedGameNodeId);
    const fullPath = pathMovesWithMainContinuation(nextTree, nextSelectedNodeId);
    const selectedPathMoves = pathMovesToNode(nextTree, nextSelectedNodeId) ?? [];
    const pathMoves = fullPath?.moves ?? selectedPathMoves;
    const pathNodeIds = fullPath?.nodeIds ?? moveNodeIdsToNode(nextTree, nextSelectedNodeId);
    const nextSourceMoves = mainLineMovesFromTree(nextTree);
    setGameTree(nextTree);
    setSourceMainLineMoves(nextSourceMoves);
    setSourceMainLineMoveCount(nextSourceMoves.length);
    setMoves(pathMoves);
    setCurrentMoveNumber(selectedPathMoves.length);
    setSelectedGameNodeId(nextSelectedNodeId);
    setCurrentPathNodeIds(pathNodeIds);
    setEngineCandidates([]);
    setHasAnalysisAttempted(false);
    setLastAction(`已删除分支，并回到第 ${pathMoves.length} 手。`);
    queueAnalysisIfEnabled();
  };
  const returnToMainBranch = () => {
    invalidatePendingAnalysis();
    const anchorNodeId = findVariationAnchorNodeId(gameTree, selectedGameNodeId);
    if (!anchorNodeId) {
      setLastAction("当前已经在主分支。");
      return;
    }
    const fullPath = pathMovesWithMainContinuation(gameTree, anchorNodeId);
    const anchorMoves = pathMovesToNode(gameTree, anchorNodeId) ?? [];
    const pathMoves = fullPath?.moves ?? anchorMoves;
    const pathNodeIds = fullPath?.nodeIds ?? moveNodeIdsToNode(gameTree, anchorNodeId);
    const nextSourceMoves = mainLineMovesFromTree(gameTree);
    setMoves(pathMoves);
    setSourceMainLineMoves(nextSourceMoves);
    setSourceMainLineMoveCount(nextSourceMoves.length);
    setCurrentPathNodeIds(pathNodeIds);
    setCurrentMoveNumber(anchorMoves.length);
    setSelectedGameNodeId(anchorNodeId);
    setEngineCandidates([]);
    setHasAnalysisAttempted(false);
    setResearchBaseMoveNumber(null);
    setLastAction(`已返回主分支分叉点：第 ${anchorMoves.length} / ${pathMoves.length} 手。`);
    queueAnalysisIfEnabled();
  };
  const toggleMoveNumberDisplay = () => {
    setMoveNumberDisplay((mode) => {
      const nextMode = mode === "all" ? "last10" : mode === "last10" ? "last1" : "all";
      setLastAction(`手数显示已切换为：${moveNumberDisplayLabel(nextMode)}。`);
      return nextMode;
    });
  };
  const toggleCoordinateLabels = () => {
    setCoordinateLabelsVisible((visible) => {
      setLastAction(visible ? "已隐藏棋盘坐标，主棋盘放大。" : "已显示棋盘坐标。");
      return !visible;
    });
  };
  const playMove = (x: number, y: number) => {
    invalidatePendingAnalysis();
    setAutoAnalysisResume(null);
    if (!canPlayMove(moves, boardSize, currentMoveNumber, { x, y })) {
      setLastAction(`不能在 ${x + 1},${y + 1} 落子：交点已被占用或不合法。`);
      return;
    }

    const nextMoveNumber = currentMoveNumber + 1;
    const inferredVariationBase = inferVariationBaseMoveNumber(moves, sourceMainLineMoves);
    const isStartingManualVariation = isResearchMode && researchBaseMoveNumber === null && inferredVariationBase === null;
    if (isStartingManualVariation) {
      setResearchBaseMoveNumber(currentMoveNumber);
    }
    const nextColorToPlay = getNextColor(currentMoveNumber);
    const parentNodeId = currentMoveNumber > 0 ? currentPathNodeIds[currentMoveNumber - 1] ?? "root" : "root";
    const move = {
      color: nextColorToPlay,
      point: { col: x, row: y }
    };
    const existingChildNodeId = findChildNodeIdByMove(gameTree, parentNodeId, move);
    const { tree: nextTree, nodeId } = appendMoveToGameTree(gameTree, parentNodeId, {
      color: nextColorToPlay,
      point: { col: x, row: y }
    });
    const nextMoves = [
      ...moves.slice(0, currentMoveNumber),
      {
        moveNumber: nextMoveNumber,
        color: nextColorToPlay,
        x,
        y
      }
    ];
    const nextPathNodeIds = [...currentPathNodeIds.slice(0, currentMoveNumber), nodeId];
    setGameTree(nextTree);
    setSelectedGameNodeId(nodeId);
    setMoves(nextMoves);
    setCurrentPathNodeIds(nextPathNodeIds);
    setCurrentMoveNumber(nextMoves.length);
    setEngineCandidates([]);
    setAnalysisPoints((points) => points.filter((point) => point.moveNumber <= currentMoveNumber));
    setHasAnalysisAttempted(false);
    setLastAction(
      existingChildNodeId
        ? `已切换到已有分支第 ${nextMoves.length} 手，未创建重复分支。`
        : isStartingManualVariation
        ? `已从第 ${currentMoveNumber} 手开始摆变化，当前变化第 1 手。`
        : `已落第 ${nextMoves.length} 手（${nextColorToPlay === "black" ? "黑棋" : "白棋"}）。`
    );
    queueAnalysisIfEnabled();
  };
  const openGameFile = async (file: File) => {
    disconnectOgs("已断开 OGS，同步本地棋谱。");
    if (/\.(tsg|brg|brg\.json|json)$/i.test(file.name)) {
      await loadResearchDocument(file);
      return;
    }
    await openSgfFile(file);
  };
  const openSgfFile = async (file: File) => {
    invalidatePendingAnalysis();
    setAutoAnalysisResume(null);
    const text = await readGameRecordFile(file);
    const parsed = parseGameRecord(text, file.name);
    setBoardSize(parsed.boardSize);
    setKomi(parsed.komi);
    setRules(parsed.rules);
    setBlackName(parsed.blackName);
    setWhiteName(parsed.whiteName);
    setGameDate(parsed.gameDate);
    setGameResult(parsed.result);
    setGameTimeControl(undefined);
    setSourceFileName(file.name);
    setSgfWarnings(parsed.warnings);
    setMoves(parsed.moves);
    setSourceMainLineMoves(parsed.moves);
    setSourceMainLineMoveCount(parsed.moves.length);
    setGameTree(parsed.gameTree);
    const parsedSelectedNodeId = findMainLineEndNodeId(parsed.gameTree);
    setSelectedGameNodeId(parsedSelectedNodeId);
    setCurrentPathNodeIds(moveNodeIdsToNode(parsed.gameTree, parsedSelectedNodeId));
    setCurrentMoveNumber(parsed.moves.length);
    setResearchBaseMoveNumber(null);
    const nextResearchDocument = createResearchDocument({
        blackName: parsed.blackName,
        boardSize: parsed.boardSize,
        currentMoveNumber: parsed.moves.length,
        gameDate: parsed.gameDate,
        result: parsed.result,
        komi: parsed.komi,
        moves: parsed.moves,
        rules: parsed.rules,
        sourceFileName: file.name,
        stones: buildBoardPosition(parsed.moves, parsed.boardSize, parsed.moves.length).stones,
        totalMoves: parsed.moves.length,
        whiteName: parsed.whiteName
      });
    nextResearchDocument.mainSgf = text;
    setResearchDocument(nextResearchDocument);
    setSelectedResearchBlockId(null);
    setActiveCommentaryBlockId(nextResearchDocument.sections[0]?.blocks.find((block) => block.type === "paragraph")?.id ?? null);
    setCommentaryDraft("");
    setEngineCandidates([]);
    setAnalysisPoints([]);
    setHasAnalysisAttempted(false);
    setLastAction(
      `已打开 ${file.name}，载入主线 ${parsed.moves.length} 手，贴目 ${parsed.komi.toFixed(1)}。`
    );
    queueAnalysisIfEnabled();
  };
  const newGame = () => {
    disconnectOgs("已断开 OGS，新建空棋盘。");
    invalidatePendingAnalysis();
    setAutoAnalysisResume(null);
    setBoardSize(19);
    setKomi(7.5);
    setRules("中国");
    setBlackName("黑棋");
    setWhiteName("白棋");
    setGameDate(undefined);
    setGameResult(undefined);
    setGameTimeControl(undefined);
    setSourceFileName("新棋谱");
    setSgfWarnings([]);
    setMoves([]);
    setSourceMainLineMoves([]);
    setSourceMainLineMoveCount(0);
    setGameTree(createEmptyGameTree(19, 7.5));
    setSelectedGameNodeId("root");
    setCurrentPathNodeIds([]);
    setCurrentMoveNumber(0);
    setResearchBaseMoveNumber(null);
    const emptySnapshot = {
      blackName: "黑棋",
      boardSize: 19,
      currentMoveNumber: 0,
      gameDate: undefined,
      result: undefined,
      komi: 7.5,
      moves: [] as ReviewMove[],
      rules: "中国",
      sourceFileName: "新棋谱",
      stones: [],
      totalMoves: 0,
      whiteName: "白棋"
    };
    const nextResearchDocument = createResearchDocument(emptySnapshot);
    setResearchDocument(nextResearchDocument);
    setSelectedResearchBlockId(nextResearchDocument.sections[0]?.blocks[0]?.id ?? null);
    setActiveCommentaryBlockId(nextResearchDocument.sections[0]?.blocks.find((block) => block.type === "paragraph")?.id ?? null);
    setCommentaryDraft("");
    setEngineCandidates([]);
    setAnalysisPoints([]);
    setHasAnalysisAttempted(false);
    setLastAction("已新建空棋盘。点击交点开始摆棋。");
    queueAnalysisIfEnabled();
  };
  const applyOgsMoveUpdate = (update: OgsMoveUpdate) => {
    const isNewOgsSource = sourceFileName !== update.sourceLabel;
    const previousSourceMoves = sourceMainLineMoves.length > 0 ? sourceMainLineMoves : moves;
    const wasOnSourceLine = moves.length === previousSourceMoves.length && movesMatchPrefix(moves, previousSourceMoves, previousSourceMoves.length);
    const wasAtSourceEnd = isNewOgsSource || (wasOnSourceLine && currentMoveNumber === previousSourceMoves.length);
    if (wasAtSourceEnd) {
      invalidatePendingAnalysis();
      setAutoAnalysisResume(null);
    }
    const nextKomi = update.metadata?.komi ?? komi;
    const nextRules = update.metadata?.rules ?? rules;
    const nextBlackName = update.metadata?.blackName ?? blackName;
    const nextWhiteName = update.metadata?.whiteName ?? whiteName;
    const nextResult = update.metadata?.result ?? gameResult;
    const nextTree = extendMainLinePreservingBranches(gameTree, previousSourceMoves, update.moves, update.boardSize, nextKomi);
    const nextMainLineEndNodeId = findMainLineEndNodeId(nextTree);
    const selectedNodeId = wasAtSourceEnd
      ? nextMainLineEndNodeId
      : wasOnSourceLine
        ? nodeIdAtMoveNumber(nextTree, nextMainLineEndNodeId, currentMoveNumber) ?? "root"
        : selectedGameNodeId;
    const nextPathNodeIds = wasOnSourceLine || wasAtSourceEnd ? moveNodeIdsToNode(nextTree, nextMainLineEndNodeId) : currentPathNodeIds;
    setBoardSize(update.boardSize);
    setSourceFileName(update.sourceLabel);
    setSgfWarnings(update.warnings);
    if (update.metadata?.blackName) {
      setBlackName(update.metadata.blackName);
    }
    if (update.metadata?.whiteName) {
      setWhiteName(update.metadata.whiteName);
    }
    if (typeof update.metadata?.komi === "number") {
      setKomi(update.metadata.komi);
    }
    if (update.metadata?.rules) {
      setRules(update.metadata.rules);
    }
    if (update.metadata?.result) {
      setGameResult(update.metadata.result);
    }
    if (update.metadata?.timeControl) {
      setGameTimeControl(update.metadata.timeControl);
    }
    setSourceMainLineMoves(update.moves);
    setSourceMainLineMoveCount(update.moves.length);
    setGameTree(nextTree);
    setSelectedGameNodeId(selectedNodeId);
    setCurrentPathNodeIds(nextPathNodeIds);

    if (wasAtSourceEnd) {
      setMoves(update.moves);
      setCurrentMoveNumber(update.moves.length);
      setResearchBaseMoveNumber(null);
      setEngineCandidates([]);
      setAnalysisPoints([]);
      setHasAnalysisAttempted(false);
      const nextResearchDocument = createResearchDocument({
        blackName: nextBlackName,
        boardSize: update.boardSize,
        currentMoveNumber: update.moves.length,
        gameDate,
        result: nextResult,
        komi: nextKomi,
        moves: update.moves,
        rules: nextRules,
        sourceFileName: update.sourceLabel,
        stones: buildBoardPosition(update.moves, update.boardSize, update.moves.length).stones,
        totalMoves: update.moves.length,
        whiteName: nextWhiteName
      });
      setResearchDocument(nextResearchDocument);
      setSelectedResearchBlockId(null);
      setActiveCommentaryBlockId(nextResearchDocument.sections[0]?.blocks.find((block) => block.type === "paragraph")?.id ?? null);
      setCommentaryDraft("");
      setLastAction(
        `已同步 ${update.sourceLabel}：${update.moves.length} 手。${update.isFinished ? "棋局已结束，已停止轮询。" : ""}${
          update.warnings.length > 0 ? `警告 ${update.warnings.length} 条。` : ""
        }`
      );
      queueAnalysisIfEnabled();
      return;
    }

    if (wasOnSourceLine) {
      setMoves(update.moves);
      setLastAction(
        `已缓存 ${update.sourceLabel} 更新到第 ${update.moves.length} 手；当前停在第 ${currentMoveNumber} 手，点下一手继续。${
          update.isFinished ? "棋局已结束，已停止轮询。" : ""
        }`
      );
      return;
    }

    setLastAction(
      `已缓存 ${update.sourceLabel} 更新到第 ${update.moves.length} 手；当前正在研究本地变化，未打断棋盘。${
        update.isFinished ? "棋局已结束，已停止轮询。" : ""
      }`
    );
  };
  applyOgsMoveUpdateRef.current = applyOgsMoveUpdate;
  const connectOgsUrl = (url: string) => {
    const target = parseOgsUrl(url);
    if (!target) {
      setOgsStatus("error");
      setOgsStatusDetail("无法识别 OGS URL");
      setLastAction("无法识别 OGS URL。请使用 https://online-go.com/demo/1730972 或 /review/1730972");
      return;
    }
    if (target.kind === "game") {
      ogsConnectorRef.current?.connectGame(target.gameId);
      setIsOgsDialogOpen(false);
      return;
    }
    ogsConnectorRef.current?.connectDemo(target.demoId);
    setIsOgsDialogOpen(false);
  };
  const refreshOgs = () => {
    ogsConnectorRef.current?.refreshCurrent();
  };
  const disconnectOgs = (message?: string) => {
    ogsConnectorRef.current?.disconnect();
    setOgsStatus("disconnected");
    setOgsStatusDetail("OGS disconnected");
    if (message) {
      setLastAction(message);
    }
  };
  const nextColor = getNextColor(currentMoveNumber);
  const probeCurrentEngine = async () => {
    if (!isTauriRuntime()) {
      setEngineStatus("浏览器预览：请在 Mac App 中测试引擎");
      setEngineDiagnostics("浏览器预览没有本机进程权限。请在 TensuGo Mac App 中测试。");
      return;
    }
    if (!engineProfile) {
      setEngineStatus("没有可测试的引擎配置");
      setEngineDiagnostics("当前没有 EngineProfile。");
      return;
    }
    setEngineStatus("正在测试 KataGo...");
    startEngineProgressLog("正在测试 KataGo...", [
      "step 1: katago version",
      "step 2: gtp 启动",
      "step 3: 最小分析探针",
      "首次 OpenCL autotune 可能会持续几分钟，请等待日志更新。"
    ]);
    try {
      const probe = await probeEngine(engineProfile);
      stopEngineProgressLog();
      setEngineDiagnostics(probe.diagnostics);
      setEngineStatus(probe.ok ? probe.summary : summarizeEngineFailure("probe-failed", probe.diagnostics));
    } catch (error) {
      stopEngineProgressLog();
      setEngineDiagnostics(String(error));
      setEngineStatus(`测试失败: ${String(error)}`);
    }
  };
  const analyzeCurrentPosition = async () => {
    if (!isTauriRuntime()) {
      setLastAction("当前是浏览器预览，不能启动本机 AI 分析。请在 TensuGo Mac App 中运行。");
      setEngineDiagnostics("浏览器预览没有本机进程权限。请在 TensuGo Mac App 中运行分析。");
      return;
    }
    if (!engineProfile) {
      setLastAction("AI 引擎还没有配置完成。");
      setEngineDiagnostics("当前没有 EngineProfile。");
      return;
    }

    const requestId = analysisRequestRef.current + 1;
    analysisRequestRef.current = requestId;
    const requestMoveNumber = currentMoveNumber;
    const requestMoves = moves.slice(0, currentMoveNumber);
    const requestPositionKey = candidatePositionKey(boardSize, komi, requestMoves);
    const requestNextColor = nextColor;
    // A new analysis at an earlier move invalidates any stale points from the
    // old continuation. Keep the completed history, but never connect to a
    // point that lies after the position being analyzed.
    setAnalysisPoints((points) => points.filter((point) => point.moveNumber <= requestMoveNumber));
    setIsAnalyzing(true);
    setHasAnalysisAttempted(true);
    setEngineStatus(`分析第 ${requestMoveNumber} 手，${requestNextColor === "black" ? "黑棋" : "白棋"}候选...`);
    setLastAction("正在启动 AI 分析当前局面。");
    setEngineDiagnostics("正在启动引擎 GTP 分析。等待 stdout/stderr...");

    try {
      const result = await analyzePositionContinuous({
        boardSize,
        komi,
        moves: requestMoves,
        nextColor: requestNextColor,
        profile: engineProfile
      });
      if (analysisRequestRef.current !== requestId) {
        return;
      }
      if (result.candidates.length > 0) {
        setEngineCandidatesPositionKey(requestPositionKey);
        if (activeProblem) {
          setProblemAiCandidates((previous) => mergeStableCandidates(previous, result.candidates));
        } else {
          setEngineCandidates((previous) =>
            engineCandidatesPositionKey === requestPositionKey
              ? mergeStableCandidates(previous, result.candidates)
              : result.candidates
          );
        }
      }
      if (result.candidates[0]) {
        setAnalysisPoints((points) =>
          upsertAnalysisPoint(points, {
            moveNumber: requestMoveNumber,
            scoreLead: result.candidates[0].scoreLead,
            visits: result.candidates[0].visits,
            winrate: toBlackWinrate(result.candidates[0].winrate, requestNextColor)
          })
        );
      }
      setEngineDiagnostics(buildAnalysisDiagnostics(result.rawOutput, result.diagnostics));
      const failureSummary = summarizeEngineFailure(result.status, result.diagnostics);
      const isWaitingForCandidates = result.status === "waiting-for-candidates";
      setEngineStatus(
        result.ok
          ? `${engineProfile.name} / ${result.candidates.length} 个候选点`
          : isWaitingForCandidates
            ? `${engineProfile.name} / 持续分析中，等待候选点...`
            : failureSummary
      );
      setLastAction(
        result.ok
          ? `AI 引擎已返回 ${result.candidates.length} 个候选点。`
          : isWaitingForCandidates
            ? "KataGo 持续分析已启动，正在等待首批候选点。"
          : `AI 引擎没有返回候选点：${failureSummary}`
      );
    } catch (error) {
      if (analysisRequestRef.current !== requestId) {
        return;
      }
      setEngineDiagnostics(String(error));
      setEngineStatus("分析失败");
      setLastAction(`AI 分析失败: ${String(error)}`);
    } finally {
      if (analysisRequestRef.current === requestId) {
        setIsAnalyzing(false);
        if (isAnalysisEnabledRef.current) {
          queueAnalysisIfEnabled(300);
        }
      }
    }
  };
  const openTianshuReport = () => {
    const range = autoAnalysisReportRangeRef.current ?? {
      endMove: autoAnalysisResume?.endMove ?? totalMoves,
      startMove: autoAnalysisResume?.startMove ?? 1
    };
    setTianshuReport({
      ...autoAnalysisSummaryRef.current,
      analyzedAt: new Date().toLocaleString(),
      endMove: range.endMove,
      startMove: range.startMove
    });
    setIsTianshuOpen(true);
  };
  const runAutoAnalysis = async (settings: AutoAnalysisSettings, isResume = false) => {
    const markAutoAnalysis = (message: string) => {
      setLastAction(message);
      setEngineDiagnostics((previous) => `${new Date().toLocaleTimeString()} ${message}\n${previous}`.slice(0, 12000));
    };
    autoAnalysisStopRef.current = false;
    autoAnalysisFinishRef.current = false;
    analysisRequestRef.current += 1;
    setIsAutoAnalyzing(true);
    setIsAnalysisEnabled(false);
    setIsAnalyzing(false);
    if (!isResume) {
      setAutoAnalysisResume(null);
      setAutoAnalysisSummary(null);
      autoAnalysisSummaryRef.current = createEmptyAutoAnalysisSummary();
      setAnalysisPoints([]);
    }
    setPreviewCandidateRank(null);
    markAutoAnalysis("正在启动自动分析...");

    if (!isTauriRuntime()) {
      markAutoAnalysis("当前是浏览器预览，不能启动自动分析。请在 TensuGo Mac App 中运行。");
      setIsAutoAnalyzing(false);
      return;
    }
    const profileForAnalysis = engineProfile;
    if (!profileForAnalysis) {
      markAutoAnalysis("AI 引擎还没有配置完成。请在 设置 > 引擎 中手动配置，或手动点击 Auto Detect。");
      setIsAutoAnalyzing(false);
      return;
    }

    const analysisMoves = sourceMainLineMoves.length > 0 ? sourceMainLineMoves : moves;
    if (analysisMoves.length === 0) {
      markAutoAnalysis("自动分析未开始：当前棋谱没有可分析的主线手数。");
      setEngineStatus("自动分析未开始：空棋谱");
      setIsAutoAnalyzing(false);
      return;
    }

    const requestedStartMove = Math.min(settings.startMove, settings.endMove);
    const requestedEndMove = Math.max(settings.startMove, settings.endMove);
    const startMove = Math.max(1, Math.min(analysisMoves.length, requestedStartMove));
    const endMove = Math.max(startMove, Math.min(analysisMoves.length, requestedEndMove));
    const targetVisits = settings.visitsPerMove > 0 ? settings.visitsPerMove : 0;
    if (!isResume || !autoAnalysisReportRangeRef.current) {
      autoAnalysisReportRangeRef.current = { startMove, endMove };
    }
    const summary = autoAnalysisSummaryRef.current;
    let stopReason: string | null = null;
    let nextResumeMove = startMove;
    const applyAutoAnalysisResult = (
      moveNumber: number,
      actualMove: ReviewMove,
      result: EngineAnalysisResult,
      countSummary: boolean
    ) => {
      const positionMoveNumber = moveNumber - 1;
      setEngineCandidatesPositionKey(candidatePositionKey(boardSize, komi, analysisMoves.slice(0, positionMoveNumber)));
      setEngineCandidates(result.candidates);
      setEngineDiagnostics((previous) =>
        `${buildAnalysisDiagnostics(result.rawOutput, result.diagnostics)}\n\n${previous}`.slice(0, 12000)
      );
      const failureSummary = summarizeEngineFailure(result.status, result.diagnostics);
      setEngineStatus(
        result.ok
          ? `自动分析第 ${moveNumber} 手：${result.candidates.length} 个候选点`
          : `自动分析第 ${moveNumber} 手失败：${failureSummary}`
      );
      markAutoAnalysis(`引擎返回：第 ${moveNumber} 手，ok=${result.ok ? "yes" : "no"}，候选=${result.candidates.length}。`);
      const best = result.candidates[0];
      if (!best) {
        return;
      }

      const actualPoint = moveToGtpPoint(actualMove, boardSize);
      const statisticsCandidates = result.candidates.slice(0, DEFAULT_CANDIDATE_DISPLAY_LIMIT);
      const actualCandidateIndex = statisticsCandidates.findIndex((candidate) => candidate.moveName === actualPoint);
      if (countSummary) {
        setResearchDocument((document) => withCandidateMovesBlock(document, positionMoveNumber, result.candidates));
        const actualCandidate = actualCandidateIndex >= 0 ? result.candidates[actualCandidateIndex] : null;
        const bestVisits = Math.max(1, ...statisticsCandidates.map((candidate) => candidate.visits));
        const matchScore = actualCandidate ? actualCandidate.visits / bestVisits : 0;
        const isTopMove = actualCandidateIndex === 0;
        const isCandidate = actualCandidateIndex >= 0;
        const isMatch =
          isCandidate &&
          actualCandidateIndex < MATCH_SETTINGS.bestNums &&
          matchScore * 100 >= MATCH_SETTINGS.percentVisits;
        const winrateLoss = actualCandidate ? Math.max(0, best.winrate - actualCandidate.winrate) : null;
        const scoreLoss = actualCandidate ? calculateScoreLoss(actualMove.color, best, actualCandidate) : null;
        summary.analyzed += 1;
        summary.topMatches += isTopMove ? 1 : 0;
        summary.candidateMatches += isCandidate ? 1 : 0;
        summary.matches += isMatch ? 1 : 0;
        if (winrateLoss !== null) {
          summary.totalWinrateLoss += winrateLoss;
          summary.knownWinrateLosses += 1;
        }
        summary.totalMatchScore += matchScore;
        if (scoreLoss !== null) {
          summary.totalScoreLoss += scoreLoss;
          summary.knownScoreLosses += 1;
        }
        summary.details.push({
          actualMoveName: actualPoint,
          color: actualMove.color,
          isCandidate,
          isMatch,
          isTopMove,
          matchScore,
          moveNumber,
          rank: actualCandidateIndex >= 0 ? actualCandidateIndex + 1 : null,
          scoreLoss,
          winrate: toBlackWinrate(best.winrate, actualMove.color),
          winrateLoss
        });
        setAutoAnalysisSummary({ ...summary });
      }
      // The chart records one point only after this move's analysis window has
      // finished. Intermediate KataGo polls update the live candidates, but
      // must not become extra winrate points on the review graph.
      if (countSummary) {
        setAnalysisPoints((points) =>
          upsertAnalysisPoint(points, {
            moveNumber,
            scoreLead: best.scoreLead,
            visits: best.visits,
            winrate: toBlackWinrate(best.winrate, actualMove.color)
          })
        );
      }
      markAutoAnalysis(
        `第 ${moveNumber} 手${countSummary ? "分析完成" : "分析刷新"}：返回 ${result.candidates.length} 个候选点，实战 ${
          actualCandidateIndex >= 0 ? `命中第 ${actualCandidateIndex + 1} 候选` : "未进候选"
        }。`
      );
    };

    markAutoAnalysis(
      targetVisits > 0
        ? `自动分析开始：第 ${startMove} 到 ${endMove} 手，目标 PO=${targetVisits}。`
        : `自动分析开始：第 ${startMove} 到 ${endMove} 手，每手 ${settings.secondsPerMove} 秒。`
    );

    try {
      for (let moveNumber = startMove; moveNumber <= endMove; moveNumber += 1) {
        const moveStartedAt = Date.now();
        nextResumeMove = moveNumber;
        if (autoAnalysisStopRef.current) {
          markAutoAnalysis(`自动分析已停止：完成 ${summary.analyzed} 手。`);
          break;
        }

        const actualMove = analysisMoves[moveNumber - 1];
        if (!actualMove) {
          markAutoAnalysis(`自动分析跳过第 ${moveNumber} 手：棋谱中没有这手。`);
          continue;
        }
        if ((actualMove.color === "black" && !settings.includeBlack) || (actualMove.color === "white" && !settings.includeWhite)) {
          markAutoAnalysis(`自动分析跳过第 ${moveNumber} 手：颜色过滤。`);
          continue;
        }

        const positionMoveNumber = moveNumber - 1;
        showAutoAnalysisPosition(positionMoveNumber);
        setPreviewCandidateRank(null);
        setEngineStatus(`自动分析第 ${moveNumber} / ${endMove} 手...`);
        markAutoAnalysis(`正在调用引擎：第 ${moveNumber} 手之前，实战为${actualMove.color === "black" ? "黑棋" : "白棋"}。`);

        let result = await analyzePositionContinuous({
          boardSize,
          komi,
          moves: analysisMoves.slice(0, positionMoveNumber),
          nextColor: actualMove.color,
          profile: profileForAnalysis
        });
        let best = result.candidates[0];
        if (!best && result.status !== "waiting-for-candidates") {
          markAutoAnalysis(`第 ${moveNumber} 手持续分析未启动：${summarizeEngineFailure(result.status, result.diagnostics)}`);
        }
        while (!autoAnalysisStopRef.current && shouldContinueAutoAnalysisMove(moveStartedAt, settings.secondsPerMove, targetVisits, best)) {
          if (best) {
            applyAutoAnalysisResult(moveNumber, actualMove, result, false);
          }
          if (!best && result.status !== "waiting-for-candidates") {
            break;
          }
          await yieldToUi();
          if (autoAnalysisStopRef.current || !shouldContinueAutoAnalysisMove(moveStartedAt, settings.secondsPerMove, targetVisits, best)) {
            break;
          }
          setEngineStatus(
            !best
              ? `自动分析第 ${moveNumber} 手：等待首批候选点...`
              : targetVisits > 0
              ? `自动分析第 ${moveNumber} 手：累计 ${formatVisits(best?.visits ?? 0)} / ${formatVisits(targetVisits)}`
              : `自动分析第 ${moveNumber} 手：继续计算 ${Math.ceil(
                  (settings.secondsPerMove * 1000 - (Date.now() - moveStartedAt)) / 1000
                )} 秒`
          );
          await waitForAutoAnalysisPoll(autoAnalysisStopRef);
          result = await analyzePositionContinuous({
            boardSize,
            komi,
            moves: analysisMoves.slice(0, positionMoveNumber),
            nextColor: actualMove.color,
            profile: profileForAnalysis
          });
          best = result.candidates[0];
          if (!best && result.status !== "waiting-for-candidates") {
            markAutoAnalysis(`第 ${moveNumber} 手持续分析中断：${summarizeEngineFailure(result.status, result.diagnostics)}`);
          }
        }

        if (autoAnalysisStopRef.current) {
          break;
        }

        const failureSummary = summarizeEngineFailure(result.status, result.diagnostics);
        if (!best) {
          markAutoAnalysis(`第 ${moveNumber} 手暂时没有候选点，跳过并继续下一手：${failureSummary}`);
          nextResumeMove = moveNumber + 1;
          continue;
        }
        applyAutoAnalysisResult(moveNumber, actualMove, result, true);
        nextResumeMove = moveNumber + 1;
        await waitForRemainingMoveTime(moveStartedAt, settings.secondsPerMove, autoAnalysisStopRef);
      }
      if (autoAnalysisStopRef.current) {
        setEngineStatus(`自动分析已停止：完成 ${summary.analyzed} 手`);
        if (autoAnalysisFinishRef.current) {
          setAutoAnalysisResume(null);
          if (summary.analyzed > 0) {
            openTianshuReport();
            markAutoAnalysis(`自动分析已结束：完成 ${summary.analyzed} 手，已生成天书报告。`);
          } else {
            setEngineStatus("自动分析未完成：没有成功分析任何手");
            markAutoAnalysis("自动分析未完成：没有成功分析任何手，未生成天书报告。");
          }
        } else if (!stopReason && nextResumeMove <= endMove) {
          setAutoAnalysisResume({ ...settings, startMove: nextResumeMove, endMove });
          markAutoAnalysis(`自动分析已暂停，可从第 ${nextResumeMove} 手继续。`);
        } else {
          setAutoAnalysisResume(null);
          if (summary.analyzed > 0) {
            openTianshuReport();
            markAutoAnalysis(stopReason ?? `自动分析已停止：完成 ${summary.analyzed} 手，已生成天书报告。`);
          } else {
            setEngineStatus("自动分析未完成：没有成功分析任何手");
            markAutoAnalysis(stopReason ?? "自动分析未完成：没有成功分析任何手，未生成天书报告。");
          }
        }
      } else {
        setAutoAnalysisResume(null);
        if (summary.analyzed > 0) {
          showAutoAnalysisPosition(endMove);
          openTianshuReport();
          setEngineStatus(`自动分析完成：吻合率 ${formatPercent(summary.matches / Math.max(1, summary.analyzed))}`);
          markAutoAnalysis(
            `自动分析完成：${summary.analyzed} 手，吻合率 ${formatPercent(summary.matches / Math.max(1, summary.analyzed))}，候选命中率 ${formatPercent(
              summary.candidateMatches / Math.max(1, summary.analyzed)
            )}。`
          );
        } else {
          setEngineStatus("自动分析未完成：没有成功分析任何手");
          markAutoAnalysis("自动分析未完成：没有成功分析任何手，请检查分析范围、颜色过滤和引擎配置。");
        }
      }
    } catch (error) {
      setAutoAnalysisResume(null);
      setEngineStatus("自动分析失败");
      markAutoAnalysis(`自动分析失败: ${String(error)}`);
    } finally {
      try {
        await stopContinuousAnalysis();
      } catch {
        // The analysis session may already be gone after an engine failure.
      }
      setIsAutoAnalyzing(false);
      autoAnalysisStopRef.current = false;
      autoAnalysisFinishRef.current = false;
    }
  };
  const showAutoAnalysisPosition = (moveNumber: number) => {
    const nextMoveNumber = Math.max(0, Math.min(totalMoves, moveNumber));
    const nextSelectedNodeId = nextMoveNumber > 0 ? currentPathNodeIds[nextMoveNumber - 1] ?? selectedGameNodeId : "root";
    setCurrentMoveNumber(nextMoveNumber);
    setSelectedGameNodeId(nextSelectedNodeId);
  };
  const stopAutoAnalysis = () => {
    autoAnalysisStopRef.current = true;
    autoAnalysisFinishRef.current = false;
    analysisRequestRef.current += 1;
    setIsAutoAnalyzing(false);
    setLastAction("正在暂停自动分析，当前短批次结束后暂停。");
  };
  const finishAutoAnalysis = () => {
    autoAnalysisStopRef.current = true;
    autoAnalysisFinishRef.current = true;
    analysisRequestRef.current += 1;
    setAutoAnalysisResume(null);
    setIsAutoAnalyzing(false);
    if (isAutoAnalyzing) {
      setLastAction("正在结束自动分析，当前短批次结束后生成天书报告。");
      return;
    }
    openTianshuReport();
    setEngineStatus(`自动分析已结束：完成 ${autoAnalysisSummaryRef.current.analyzed} 手`);
    setLastAction("自动分析已结束，已生成天书报告。");
    autoAnalysisFinishRef.current = false;
  };
  const appendBatchJobLog = (message: string) => {
    const line = `${new Date().toLocaleTimeString()} ${message}`;
    setBatchJobLogs((logs) => [...logs, line].slice(-500));
  };
  const suggestBatchTargetPlayers = async (): Promise<string[]> => {
    try {
      const records = isTauriRuntime()
        ? await Promise.all(batchFilePaths.slice(0, 2).map(async (path) => parseGameRecord(await readTextFile(path), baseName(path))))
        : await Promise.all(batchBrowserFiles.slice(0, 2).map(async (file) => parseGameRecord(await readGameRecordFile(file), file.name)));
      if (records.length < 2) {
        return [];
      }
      const firstNames = [records[0].blackName, records[0].whiteName].filter(Boolean);
      return firstNames.filter((name) => playerNameMatches(records[1].blackName, name) || playerNameMatches(records[1].whiteName, name));
    } catch (error) {
      appendBatchJobLog(`目标棋手自动识别失败：${String(error)}`);
      return [];
    }
  };
  const chooseBatchFiles = async () => {
    if (!isTauriRuntime()) {
      try {
        appendBatchJobLog("Browser: 打开棋谱文件选择器");
        setLastAction("Browser 预览：正在打开浏览器文件选择器...");
        const files = await chooseBrowserGameRecordFiles();
        if (files.length === 0) {
          appendBatchJobLog("Browser: 已取消选择棋谱");
          setLastAction("已取消选择棋谱。");
          return;
        }
        const limitedFiles = files.slice(0, 20);
        setBatchBrowserFiles(limitedFiles);
        setBatchFilePaths(limitedFiles.map((file) => file.name));
        appendBatchJobLog(`Browser: 已选择 ${limitedFiles.length} 个棋谱`);
        setLastAction(`Browser 预览已选择 ${limitedFiles.length} 个棋谱；真正批量分析需要在 TensuGo 桌面 App 中运行。`);
      } catch (error) {
        console.error("浏览器选择棋谱失败", error);
        appendBatchJobLog(`Browser: 选择棋谱失败 ${String(error)}`);
        setLastAction(`浏览器选择棋谱失败：${String(error)}`);
      }
      return;
    }
    try {
      appendBatchJobLog("Desktop: 打开棋谱文件选择器");
      setLastAction("正在打开批量棋谱选择器...");
      const selected = await open({
        multiple: true,
        directory: false,
        filters: [
          {
            name: "棋谱文件",
            extensions: ["sgf", "gib", "tsg", "json", "txt"]
          }
        ]
      });
      const paths = Array.isArray(selected) ? selected : selected ? [selected] : [];
      if (paths.length === 0) {
        appendBatchJobLog("Desktop: 已取消选择棋谱");
        setLastAction("已取消选择棋谱。");
        return;
      }
      const limitedPaths = paths.slice(0, 20);
      setBatchBrowserFiles([]);
      setBatchFilePaths(limitedPaths);
      appendBatchJobLog(`Desktop: 已选择 ${limitedPaths.length} 个棋谱`);
      setLastAction(`已选择 ${limitedPaths.length} 个棋谱用于批量任务。`);
    } catch (error) {
      console.error("选择棋谱失败", error);
      appendBatchJobLog(`Desktop: 选择棋谱失败 ${String(error)}`);
      setLastAction(`选择棋谱失败：${String(error)}。请确认已重新启动新版 TensuGo 桌面端。`);
    }
  };
  const chooseBatchOutputDirectory = async () => {
    if (!isTauriRuntime()) {
      try {
        const picker = getBrowserDirectoryPicker();
        if (!picker) {
          appendBatchJobLog("Browser: 当前浏览器不支持选择输出目录");
          setLastAction("Browser 预览不支持选择输出目录；请在 TensuGo 桌面 App 中运行批量分析。");
          return;
        }
        appendBatchJobLog("Browser: 打开输出目录选择器");
        setLastAction("Browser 预览：正在打开目录选择器...");
        const directory = await picker();
        const name = directory?.name ? `Browser:${directory.name}` : "Browser 输出目录";
        setBatchOutputDirectory(name);
        appendBatchJobLog(`Browser: 已选择输出目录 ${name}`);
        setLastAction(`Browser 预览已选择输出目录 ${name}；真正写入 TSG 需要在 TensuGo 桌面 App 中运行。`);
      } catch (error) {
        if (isAbortError(error)) {
          appendBatchJobLog("Browser: 已取消选择输出目录");
          setLastAction("已取消选择输出目录。");
          return;
        }
        console.error("浏览器选择输出目录失败", error);
        appendBatchJobLog(`Browser: 选择输出目录失败 ${String(error)}`);
        setLastAction(`浏览器选择输出目录失败：${String(error)}`);
      }
      return;
    }
    try {
      appendBatchJobLog("Desktop: 打开输出目录选择器");
      setLastAction("正在打开输出目录选择器...");
      const selected = await open({
        directory: true,
        multiple: false
      });
      const path = Array.isArray(selected) ? selected[0] : selected;
      if (!path) {
        appendBatchJobLog("Desktop: 已取消选择输出目录");
        setLastAction("已取消选择输出目录。");
        return;
      }
      setBatchOutputDirectory(path);
      window.localStorage.setItem("tensugo.batchOutputDir", path);
      appendBatchJobLog(`Desktop: 输出目录 ${path}`);
      setLastAction(`批量输出目录：${path}`);
    } catch (error) {
      console.error("选择输出目录失败", error);
      appendBatchJobLog(`Desktop: 选择输出目录失败 ${String(error)}`);
      setLastAction(`选择输出目录失败：${String(error)}。请确认已重新启动新版 TensuGo 桌面端。`);
    }
  };
  const runBatchAnalysis = async (settings: BatchAnalysisSettings) => {
    setBatchJobLogs([]);
    setBatchRunReport(null);
    appendBatchJobLog(
      `任务启动: mode=${settings.mode}, target=${settings.targetPlayer || "全部棋手"}, range=${settings.startMove}-${settings.endMove}, seconds=${settings.secondsPerMove}, visits=${settings.visitsPerMove || "time"}`
    );
    if (!isTauriRuntime()) {
      if (batchBrowserFiles.length === 0) {
        appendBatchJobLog("Browser: 启动失败，没有选择棋谱");
        setLastAction("请先选择要批量分析的棋谱。");
        return;
      }
      setIsBatchAnalyzing(true);
      try {
        let parsedCount = 0;
        for (const [fileIndex, file] of batchBrowserFiles.entries()) {
          appendBatchJobLog(`Browser: 读取 ${fileIndex + 1}/${batchBrowserFiles.length} ${file.name}`);
          const content = await readGameRecordFile(file);
          const parsed = parseGameRecord(content, file.name);
          parsedCount += 1;
          appendBatchJobLog(`Browser: 解析完成 ${file.name}, ${parsed.moves.length} 手`);
        }
        appendBatchJobLog("Browser: 预览完成。本地 KataGo 分析和 TSG 写入需要 Desktop App。");
        setLastAction(
          `Browser 预览已读取 ${parsedCount} 个棋谱；本地 KataGo 批量分析、出题和写入 TSG 需要在 TensuGo 桌面 App 中运行。`
        );
      } catch (error) {
        appendBatchJobLog(`Browser: 读取/解析失败 ${String(error)}`);
        setLastAction(`Browser 预览读取棋谱失败：${String(error)}`);
      } finally {
        setIsBatchAnalyzing(false);
      }
      return;
    }
    if (!engineProfile) {
      appendBatchJobLog("Desktop: 启动失败，AI 引擎未配置");
      setLastAction("AI 引擎还没有配置完成。请先在 设置 > 引擎 中配置 KataGo。");
      return;
    }
    if (batchFilePaths.length === 0) {
      appendBatchJobLog("Desktop: 启动失败，没有选择棋谱");
      setLastAction("请先选择要批量分析的棋谱。");
      return;
    }
    if (!batchOutputDirectory) {
      appendBatchJobLog("Desktop: 启动失败，没有选择输出目录");
      setLastAction("请先选择 TSG 输出目录。");
      return;
    }

    batchAnalysisStopRef.current = false;
    batchAnalysisPauseRef.current = false;
    setIsBatchPaused(false);
    setIsBatchAnalyzing(true);
    setIsBatchConsoleVisible(true);
    setIsBatchAnalysisOpen(false);
    setIsAnalysisEnabled(false);
    appendBatchJobLog(`Desktop: 批量任务开始，文件=${batchFilePaths.length}, 输出=${batchOutputDirectory}`);
    setLastAction(`批量任务开始：${batchFilePaths.length} 个棋谱。`);

    let completed = 0;
    let skipped = 0;
    let totalAnalyzedMoves = 0;
    let totalProblemCount = 0;
    try {
      for (const [fileIndex, path] of batchFilePaths.entries()) {
        if (batchAnalysisStopRef.current) {
          break;
        }
        const fileName = baseName(path);
        const outputPath = joinPath(batchOutputDirectory, `${fileStem(fileName)}.tsg`);
        appendBatchJobLog(`Desktop: 开始 ${fileIndex + 1}/${batchFilePaths.length} ${fileName}`);
        setEngineStatus(`批量任务 ${fileIndex + 1} / ${batchFilePaths.length}: ${fileName}`);
        setLastAction(`正在批量处理：${fileName}`);
        const existingOutputCompletion = await readExistingTsgAnalysisCompletion(outputPath);
        if (existingOutputCompletion?.complete) {
          appendBatchJobLog(
            `Desktop: 跳过 ${fileName}，输出 TSG 已完整自动分析 ${existingOutputCompletion.startMove}-${existingOutputCompletion.endMove}/${existingOutputCompletion.totalMoves}: ${outputPath}`
          );
          setLastAction(`已跳过：${fileName} 的输出 TSG 已有完整自动分析标记。`);
          skipped += 1;
          continue;
        }
        const content = await readTextFile(path);
        const completion = readTsgAnalysisCompletion(content);
        if (completion?.complete) {
          appendBatchJobLog(
            `Desktop: 跳过 ${fileName}，TSG 已完整自动分析 ${completion.startMove}-${completion.endMove}/${completion.totalMoves}，完成时间 ${completion.completedAt}`
          );
          setLastAction(`已跳过：${fileName} 已有完整自动分析标记。`);
          skipped += 1;
          continue;
        }
        const parsed = parseGameRecord(content, fileName);
        appendBatchJobLog(`Desktop: 已读取 ${fileName}, ${parsed.moves.length} 手`);
        const parsedSelectedNodeId = findMainLineEndNodeId(parsed.gameTree);
        const parsedPathNodeIds = moveNodeIdsToNode(parsed.gameTree, parsedSelectedNodeId);
        setBoardSize(parsed.boardSize);
        setKomi(parsed.komi);
        setRules(parsed.rules);
        setBlackName(parsed.blackName);
        setWhiteName(parsed.whiteName);
        setGameDate(parsed.gameDate);
        setGameResult(parsed.result);
        setSourceFileName(fileName);
        setMoves(parsed.moves);
        setSourceMainLineMoves(parsed.moves);
        setSourceMainLineMoveCount(parsed.moves.length);
        setGameTree(parsed.gameTree);
        setSelectedGameNodeId("root");
        setCurrentPathNodeIds(parsedPathNodeIds);
        setCurrentMoveNumber(0);
        setEngineCandidates([]);
        setAnalysisPoints([]);
        const result = await analyzeGameForBatch({
          parsed,
          sourceContent: content,
          sourceFileName: fileName,
          settings,
          profile: engineProfile,
          shouldStop: batchAnalysisStopRef,
          shouldPause: batchAnalysisPauseRef,
          onProgress: ({ candidates, moveNumber, point, status }) => {
            const positionMoveNumber = Math.max(0, moveNumber - 1);
            setCurrentMoveNumber(positionMoveNumber);
            setSelectedGameNodeId(positionMoveNumber > 0 ? parsedPathNodeIds[positionMoveNumber - 1] ?? "root" : "root");
            setEngineCandidatesPositionKey(candidatePositionKey(parsed.boardSize, parsed.komi, parsed.moves.slice(0, positionMoveNumber)));
            setEngineCandidates(candidates);
            if (point) {
              setAnalysisPoints((points) => upsertAnalysisPoint(points, point));
            }
            setEngineStatus(`批量分析 ${fileIndex + 1}/${batchFilePaths.length} · 第 ${moveNumber}/${parsed.moves.length} 手 · ${status}`);
            setLastAction(`正在分析 ${fileName} 第 ${moveNumber} 手：${status}`);
            if (status.startsWith("正在启动")) {
              appendBatchJobLog(`Desktop: ${fileName} 第 ${moveNumber} 手，${status}`);
            }
          }
        });
        await writeTextFile(outputPath, JSON.stringify(toBrgDocument(result.document, parsed.gameTree)));
        setResearchDocument(result.document);
        setShowSavedAnalysis(documentHasSavedAnalysis(result.document));
        completed += 1;
        totalAnalyzedMoves += result.analyzed;
        totalProblemCount += result.problemCount;
        appendBatchJobLog(`Desktop: 已保存 ${outputPath} 分析=${result.analyzed} 题目=${result.problemCount}`);
        setLastAction(`已保存：${outputPath}（分析 ${result.analyzed} 手，题目 ${result.problemCount} 题）`);
      }
      appendBatchJobLog(batchAnalysisStopRef.current ? `Desktop: 已停止，完成 ${completed}/${batchFilePaths.length}` : `Desktop: 完成 ${completed}/${batchFilePaths.length}`);
      setEngineStatus(batchAnalysisStopRef.current ? `批量任务已停止：完成 ${completed} 个棋谱` : `批量任务完成：${completed} 个棋谱`);
      setLastAction(batchAnalysisStopRef.current ? `批量任务已停止：完成 ${completed} 个棋谱。` : `批量任务完成：已保存 ${completed} 个 TSG。`);
      setBatchRunReport({
        analyzedMoves: totalAnalyzedMoves,
        completedFiles: completed,
        outputDirectory: batchOutputDirectory,
        problemCount: totalProblemCount,
        selectedFiles: batchFilePaths.length,
        skippedFiles: skipped,
        stopped: batchAnalysisStopRef.current,
        targetPlayer: settings.targetPlayer
      });
    } catch (error) {
      appendBatchJobLog(`Desktop: 任务失败 ${String(error)}`);
      setEngineStatus("批量任务失败");
      setLastAction(`批量任务失败：${String(error)}`);
    } finally {
      try {
        await stopContinuousAnalysis();
      } catch {
        // The engine session may already be stopped after an error.
      }
      setIsBatchAnalyzing(false);
      setIsBatchPaused(false);
      setIsBatchConsoleVisible(false);
      batchAnalysisStopRef.current = false;
      batchAnalysisPauseRef.current = false;
      appendBatchJobLog("任务结束");
    }
  };
  const stopBatchAnalysis = () => {
    batchAnalysisStopRef.current = true;
    appendBatchJobLog("收到终止请求，等待当前分析点结束");
    setLastAction("正在终止批量任务，当前手分析结束后停止。");
  };
  const toggleBatchAnalysisPause = () => {
    const nextPaused = !batchAnalysisPauseRef.current;
    batchAnalysisPauseRef.current = nextPaused;
    setIsBatchPaused(nextPaused);
    appendBatchJobLog(nextPaused ? "批量任务已暂停" : "批量任务继续");
    setLastAction(nextPaused ? "批量分析已暂停，可继续或终止。" : "批量分析继续运行。");
    if (nextPaused) {
      void stopContinuousAnalysis();
    }
  };
  const toggleAnalysis = () => {
    if (isAnalysisEnabled) {
      pauseAnalysis();
      return;
    }
    setIsAnalysisEnabled(true);
    setLastAction("AI 分析已开启。");
    queueAnalysisIfEnabled(20);
  };
  const openProblemReview = (moveNumber: number) => {
    const problem = researchDocument.problemSet?.items.find((item) => item.moveNumber === moveNumber);
    if (!problem) {
      setLastAction(`第 ${moveNumber} 手没有可读取的出题标记。`);
      return;
    }
    const positionMoveNumber = Math.max(0, problem.moveNumber - 1);
    setActiveProblem(problem);
    setIsEditingProblemCandidates(false);
    setProblemSaveStatus("");
    setCurrentMoveNumber(positionMoveNumber);
    setSelectedGameNodeId(positionMoveNumber > 0 ? currentPathNodeIds[positionMoveNumber - 1] ?? "root" : "root");
    setEngineCandidatesPositionKey(candidatePositionKey(boardSize, komi, sourceMainLineMoves.slice(0, positionMoveNumber)));
    setEngineCandidates(problem.candidateScores.map((candidate) => ({ ...candidate })));
    setProblemAiCandidates(problem.analysis.candidates);
    setPreviewCandidateRank(null);
    setLastAction(`正在 REVIEW 第 ${problem.moveNumber} 手出题标记：已显示 AI 候选点和实战下一手。`);
  };

  const updateProblemCandidateAtPoint = (x: number, y: number) => {
    if (!activeProblem || !isEditingProblemCandidates) {
      playMove(x, y);
      return;
    }
    const moveName = moveToGtpPoint({ color: activeProblem.color, moveNumber: activeProblem.moveNumber, x, y }, boardSize);
    const exists = activeProblem.candidateScores.some((candidate) => candidate.moveName === moveName);
    const nextScores = exists
      ? activeProblem.candidateScores.filter((candidate) => candidate.moveName !== moveName)
      : [...activeProblem.candidateScores, {
          moveName,
          rank: activeProblem.candidateScores.length + 1,
          score: 5,
          visits: 0,
          winrate: 0,
          scoreLead: 0,
          pv: []
        }];
    const nextProblem = { ...activeProblem, candidateScores: nextScores.map((candidate, index) => ({ ...candidate, rank: index + 1 })) };
    setActiveProblem(nextProblem);
    setResearchDocument((document) => document.problemSet ? {
      ...document,
      problemSet: { ...document.problemSet, items: document.problemSet.items.map((item) => item.id === nextProblem.id ? nextProblem : item) }
    } : document);
    setEngineCandidates(nextProblem.candidateScores.map((candidate) => ({ ...candidate })));
  };
  const toggleProblemCandidate = (moveName: string) => {
    if (!activeProblem) return;
    const exists = activeProblem.candidateScores.some((candidate) => candidate.moveName === moveName);
    const sourceCandidate = activeProblem.analysis.candidates.find((candidate) => candidate.moveName === moveName)
      ?? engineCandidates.find((candidate) => candidate.moveName === moveName);
    if (!exists && !sourceCandidate) return;
    const nextScores = exists
      ? activeProblem.candidateScores.filter((candidate) => candidate.moveName !== moveName)
      : [...activeProblem.candidateScores, {
          moveName,
          rank: activeProblem.candidateScores.length + 1,
          score: 5,
          visits: sourceCandidate?.visits ?? 0,
          winrate: sourceCandidate?.winrate ?? 0,
          scoreLead: sourceCandidate?.scoreLead ?? 0,
          pv: sourceCandidate?.pv ?? []
        }];
    const nextProblem = { ...activeProblem, candidateScores: nextScores.map((candidate, index) => ({ ...candidate, rank: index + 1 })) };
    setActiveProblem(nextProblem);
    setResearchDocument((document) => document.problemSet ? {
      ...document,
      problemSet: { ...document.problemSet, items: document.problemSet.items.map((item) => item.id === nextProblem.id ? nextProblem : item) }
    } : document);
    setEngineCandidates(nextProblem.candidateScores.map((candidate) => ({ ...candidate })));
  };
  const reorderProblemCandidate = (fromIndex: number, toIndex: number) => {
    if (!activeProblem || fromIndex === toIndex) return;
    const nextScores = [...activeProblem.candidateScores];
    const [moved] = nextScores.splice(fromIndex, 1);
    nextScores.splice(toIndex, 0, moved);
    const nextProblem = { ...activeProblem, candidateScores: nextScores.map((candidate, index) => ({ ...candidate, rank: index + 1 })) };
    setActiveProblem(nextProblem);
    setResearchDocument((document) => document.problemSet ? {
      ...document,
      problemSet: { ...document.problemSet, items: document.problemSet.items.map((item) => item.id === nextProblem.id ? nextProblem : item) }
    } : document);
    setEngineCandidates(nextProblem.candidateScores.map((candidate) => ({ ...candidate })));
  };
  const saveReviewedProblem = async (problem: ProblemItem) => {
    setIsSavingProblem(true);
    setProblemSaveStatus("正在连接开发数据库并保存…");
    try {
      await saveProblemToDatabase({
        ...problem,
        source: {
          fileName: sourceFileName,
          blackName,
          whiteName,
          boardSize,
          komi,
          rules,
          movesBeforeProblem: sourceMainLineMoves.slice(0, Math.max(0, problem.moveNumber - 1)),
          actualMove: sourceMainLineMoves[problem.moveNumber - 1] ?? null
        },
        reviewedAt: new Date().toISOString()
      });
      setLastAction(`第 ${problem.moveNumber} 手题目已保存到开发数据库。`);
      setProblemSaveStatus("保存成功");
    } catch (error) {
      setLastAction(`保存题目失败：${String(error)}`);
      setProblemSaveStatus(`保存失败：${String(error)}`);
    } finally {
      setIsSavingProblem(false);
    }
  };
  const pauseAnalysis = () => {
    analysisRequestRef.current += 1;
    if (analysisTimerRef.current !== null) {
      window.clearTimeout(analysisTimerRef.current);
      analysisTimerRef.current = null;
    }
    setIsAnalysisEnabled(false);
    setIsAnalyzing(false);
    if (isTauriRuntime()) {
      void stopContinuousAnalysis();
    }
    setLastAction("AI 分析已暂停。");
  };
  useEffect(() => {
    if (!isAnalysisEnabled || isAnalyzing || processedAnalysisTriggerRef.current === analysisTrigger) {
      return;
    }
    processedAnalysisTriggerRef.current = analysisTrigger;
    void analyzeCurrentPosition();
  }, [isAnalysisEnabled, isAnalyzing, currentMoveNumber, boardSize, komi, moves, analysisTrigger]);
  const beginResize = (pane: "left" | "right", startX: number) => {
    const startLeft = leftPaneWidth;
    const startRight = rightPaneWidth;

    const handleMove = (event: MouseEvent) => {
      if (pane === "left") {
        setLeftPaneWidth(Math.min(620, Math.max(220, startLeft + event.clientX - startX)));
        return;
      }
      setRightPaneWidth(Math.min(520, Math.max(210, startRight - (event.clientX - startX))));
    };

    const handleUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      document.body.classList.remove("is-resizing-pane");
    };

    document.body.classList.add("is-resizing-pane");
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  return (
    <main className="app-shell" style={{ "--toolbar-scale": toolbarScale } as CSSProperties}>
      <TopToolbar
        boardPixelSize={boardPixelSize}
        hasSavedAnalysis={hasSavedAnalysis}
        title="TensuGo"
        isResearchMode={isResearchMode}
        komi={komi}
        ogsDetail={ogsStatusDetail}
        ogsSourceLabel={ogsSourceLabel}
        ogsStatus={ogsStatus}
        showSavedAnalysis={showSavedAnalysis}
        showVariationNumbers={showVariationNumbers}
        onKomiChange={updateKomi}
        onOpenFile={openGameFile}
        onOpenOgsBrowser={() => setIsOgsBrowserOpen(true)}
        onOpenOgsUrl={() => setIsOgsDialogOpen(true)}
        onOgsDisconnect={() => disconnectOgs("已断开 OGS。")}
        onOgsRefresh={refreshOgs}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenTianshuReport={openTianshuReport}
        onNewGame={newGame}
        onSaveResearch={saveResearchDocument}
        onExportPdf={exportResearchPdf}
        onToggleAnalysis={toggleAnalysis}
        onOpenAutoAnalysis={() => setIsAutoAnalysisOpen(true)}
        onOpenBatchAnalysis={() => setIsBatchAnalysisOpen(true)}
        onOpenAbout={() => setIsAboutOpen(true)}
        onAddVariation={insertCurrentVariation}
        onToggleSavedAnalysis={() => {
          if (!hasSavedAnalysis) {
            setLastAction("当前 TSG 没有已保存的 AI 分析。");
            return;
          }
          setShowSavedAnalysis((visible) => {
            setLastAction(visible ? "已隐藏 TSG 静态分析。" : "已显示 TSG 静态分析。");
            return !visible;
          });
        }}
        onResearchModeChange={setResearchMode}
        onShowVariationNumbersChange={setShowVariationNumbers}
        t={t}
      />
      <section
        className="workspace"
        aria-label="TensuGo analysis workspace"
        style={{
          gridTemplateColumns: `${leftPaneWidth}px 5px minmax(0, 1fr) 5px ${rightPaneWidth}px`
        }}
      >
        <aside className={`side-panel side-panel-left ${isResearchMode ? "research-mode" : ""}`}>
          <details className="panel-section game-info-details" open>
            <summary>棋谱信息</summary>
            <GameInfoPanel
              boardSize={boardSize}
              blackName={blackName}
              capturedBlack={position.capturedBlack}
              capturedWhite={position.capturedWhite}
              currentMoveNumber={currentMoveNumber}
              komi={komi}
              nextColor={nextColor}
              onBlackNameChange={setBlackName}
              onKomiChange={updateKomi}
              onRulesChange={setRules}
              onWhiteNameChange={setWhiteName}
              result={gameResult}
              rules={rules}
              sourceFileName={sourceFileName}
              timeControl={gameTimeControl}
              totalMoves={totalMoves}
              whiteName={whiteName}
            />
          </details>
          <div className="panel-section">
            <h2>局面评估</h2>
            <div className="player-strip">
              <span className="stone-dot black" />
              <span>{rules}规则</span>
              <span className="stone-dot white" />
            </div>
            <div className="eval-summary">
              <div>
                <strong>{displayedWinrate.toFixed(1)}%</strong>
                <span>黑胜率</span>
              </div>
              <div>
                <strong>{displayedScoreLead.toFixed(1)}</strong>
                <span>黑目差</span>
              </div>
              <div>
                <strong>{formatVisits(displayedVisits)}</strong>
                <span>计算量</span>
              </div>
            </div>
            <div className="winrate-bar" aria-label="Winrate">
              <span style={{ width: `${Math.max(0, Math.min(100, displayedWinrate))}%` }} />
            </div>
            <dl className="info-list">
              <div>
                <dt>当前手</dt>
                <dd>{currentMoveNumber}</dd>
              </div>
              <div>
                <dt>引擎</dt>
                <dd>{engineLabel}</dd>
              </div>
              <div>
                <dt>候选点</dt>
                <dd>{candidateCountText}</dd>
              </div>
              <div>
                <dt>吻合率</dt>
                <dd>{autoMatchText}</dd>
              </div>
            </dl>
          </div>
          <div className="panel-section review-graph-section left-review-graph-section">
            <h2>胜率变化</h2>
            <ReviewGraph
              currentMoveNumber={currentMoveNumber}
              points={analysisPoints}
              totalMoves={totalMoves}
              onJump={jumpToMove}
            />
          </div>
          {isResearchMode ? (
            <div className="panel-section research-section">
              <ResearchDocumentPanel
                document={researchDocument}
                commentary={commentaryDraft}
                onAddGameProgress={() => setIsGameProgressPanelOpen(true)}
                onAddText={insertTextBlock}
                onAddVariation={insertCurrentVariation}
                onExportPdf={exportResearchPdf}
                onSaveDocument={saveResearchDocument}
                onUpdateCommentary={updateResearchCommentary}
                onUpdateTextBlock={(blockId, markdown) => setResearchDocument((document) => updateBlockMarkdown(document, blockId, markdown))}
                onUpdateDocumentMeta={updateResearchDocumentMeta}
                selectedBlock={selectedResearchBlock}
                t={t}
              />
            </div>
          ) : (
            <div className="panel-section status-log">
              <h2>当前状态</h2>
              <dl className="stable-status-list">
                <div>
                  <dt>黑棋 胜率</dt>
                  <dd>{displayedWinrate.toFixed(1)}%</dd>
                </div>
                <div>
                  <dt>领先</dt>
                  <dd>{displayedScoreLead.toFixed(1)}</dd>
                </div>
                <div>
                  <dt>计算量</dt>
                  <dd>{formatVisits(displayedVisits)}</dd>
                </div>
                <div>
                  <dt>引擎</dt>
                  <dd>{isAnalysisEnabled ? "分析开启" : "分析暂停"}</dd>
                </div>
                <div>
                  <dt>下一手</dt>
                  <dd>{nextColor === "black" ? "黑棋" : "白棋"}</dd>
                </div>
              </dl>
              <p className="engine-state">复盘 / 可落子</p>
            </div>
          )}
        </aside>
        <div
          aria-label="调整左栏宽度"
          className="pane-resizer"
          role="separator"
          onMouseDown={(event) => beginResize("left", event.clientX)}
        />

        <section className="board-stage" aria-label="Go board">
          <BoardPlaceholder
            boardSize={boardSize}
            candidates={activeProblem ? activeProblem.candidateScores.map((candidate) => ({ ...candidate })) : activeCandidates}
            suggestedCandidates={activeProblem ? problemAiCandidates.filter((candidate) => !activeProblem.candidateScores.some((selected) => selected.moveName === candidate.moveName)) : []}
            coordinateLabelsVisible={coordinateLabelsVisible}
            moveNumberDisplay={moveNumberDisplay}
            pixelSize={boardPixelSize}
            stones={stones}
            variationBaseMoveNumber={displayedVariationBaseMoveNumber}
            actualNextMove={activeProblemActualMove}
            candidateClickSelectOnly={Boolean(activeProblem)}
            selectedCandidateRank={previewCandidateRank}
            onStoneClick={jumpToMove}
            onPointClick={updateProblemCandidateAtPoint}
            onCandidatePreview={setPreviewCandidateRank}
          />
        </section>
        <div
          aria-label="调整右栏宽度"
          className="pane-resizer"
          role="separator"
          onMouseDown={(event) => beginResize("right", event.clientX)}
        />

        <aside className={`side-panel side-panel-right ${candidateListVisible ? "" : "candidate-list-hidden"} ${isResearchMode ? "research-tree-mode" : ""}`}>
          {isResearchMode ? (
            <ResearchRightPane
              branchRows={branchRows}
              document={updateDocumentSource(researchDocument, currentSnapshot)}
              selectedNodeId={selectedGameNodeId}
              selectedBlockId={selectedResearchBlockId}
              onBranchNodeClick={jumpToGameNode}
              onClearResearchBlockSelection={clearResearchBlockSelection}
              onResearchBlockClick={showResearchBlockOnBoard}
              onResearchBlockMove={(blockId, targetBlockId) => setResearchDocument((document) => moveBlock(document, blockId, targetBlockId))}
            />
          ) : (
            <CandidatePanel
              baseStones={stones}
              boardSize={boardSize}
              candidates={activeProblem ? problemAiCandidates : activeCandidates}
              candidateListVisible={candidateListVisible}
              currentMoveNumber={currentMoveNumber}
              nextColor={nextColor}
              previewCandidate={previewCandidate}
              totalMoves={totalMoves}
              branchRows={branchRows}
              selectedNodeId={selectedGameNodeId}
              onCandidateListVisibleChange={setCandidateListVisible}
              onBranchNodeClick={jumpToGameNode}
              onPreviewCandidate={setPreviewCandidateRank}
              problemMoveNumbers={new Set(researchDocument.problemSet?.items.map((item) => item.moveNumber) ?? [])}
              onProblemClick={openProblemReview}
              problemReviewActive={Boolean(activeProblem)}
              problemSelectedMoveNames={new Set(activeProblem?.candidateScores.map((candidate) => candidate.moveName) ?? [])}
              onProblemCandidateToggle={toggleProblemCandidate}
              problemSelectedCandidates={activeProblem?.candidateScores ?? []}
              onProblemCandidateReorder={reorderProblemCandidate}
            />
          )}
        </aside>
      </section>
      <BottomToolbar
        isAutoAnalyzing={isAutoAnalyzing}
        canResumeAutoAnalysis={Boolean(autoAnalysisResume)}
        coordinateLabelsVisible={coordinateLabelsVisible}
        currentMoveNumber={currentMoveNumber}
        engineStatus={engineStatus}
        isAnalysisEnabled={isAnalysisEnabled}
        isAnalyzing={isAnalyzing || isAutoAnalyzing}
        moveNumberDisplay={moveNumberDisplay}
        totalMoves={navigationTotalMoves}
        statusText={lastAction}
        onAnalysisToggle={toggleAnalysis}
        onAutoAnalyze={() => {
          if (isAutoAnalyzing) {
            stopAutoAnalysis();
            return;
          }
          if (autoAnalysisResume) {
            void runAutoAnalysis(autoAnalysisResume, true);
            return;
          }
          setIsAutoAnalysisOpen(true);
        }}
        onDeleteBranch={deleteCurrentBranch}
        onFinishAutoAnalysis={finishAutoAnalysis}
        onJump={jumpToMove}
        onPromoteBranch={promoteCurrentBranch}
        onReturnToMainBranch={returnToMainBranch}
        onToggleCoordinates={toggleCoordinateLabels}
        onToggleMoveNumbers={toggleMoveNumberDisplay}
        t={t}
      />
      {activeProblem ? (
        <div className="problem-review-toolbar" aria-label="出题操作">
          <strong>出题 REVIEW · 第 {activeProblem.moveNumber} 手</strong>
          <span>胜率损失 {activeProblem.trigger.value.toFixed(1)}%</span>
          <button type="button" className={isEditingProblemCandidates ? "active" : ""} onClick={() => setIsEditingProblemCandidates((value) => !value)}>
            {isEditingProblemCandidates ? "完成选点" : "修改/增加选点"}
          </button>
          <button type="button" disabled={isSavingProblem} onClick={() => void saveReviewedProblem(activeProblem)}>
            {isSavingProblem ? "保存中…" : "保存题目"}
          </button>
          {problemSaveStatus ? <span className={problemSaveStatus.startsWith("保存失败") ? "problem-save-error" : "problem-save-status"}>{problemSaveStatus}</span> : null}
          <button type="button" onClick={() => { setActiveProblem(null); setIsEditingProblemCandidates(false); }}>关闭</button>
        </div>
      ) : null}
      <AutoAnalysisDialog
        currentMoveNumber={currentMoveNumber}
        isRunning={isAutoAnalyzing}
        open={isAutoAnalysisOpen}
        totalMoves={totalMoves}
        onClose={() => setIsAutoAnalysisOpen(false)}
        onStart={(settings) => {
          setIsAutoAnalysisOpen(false);
          void runAutoAnalysis(settings);
        }}
        onStop={stopAutoAnalysis}
      />
      <BatchAnalysisDialog
        fileCount={batchFilePaths.length}
        isRunning={isBatchAnalyzing}
        logs={batchJobLogs}
        open={isBatchAnalysisOpen}
        outputDirectory={batchOutputDirectory}
        onChooseFiles={chooseBatchFiles}
        onChooseOutputDirectory={chooseBatchOutputDirectory}
        onClose={() => setIsBatchAnalysisOpen(false)}
        onStart={(settings) => void runBatchAnalysis(settings)}
        onSuggestTargetPlayers={suggestBatchTargetPlayers}
        onStop={stopBatchAnalysis}
      />
      {isBatchAnalyzing && (
        <div className="batch-task-controls" aria-label="批量任务控制">
          <strong>{isBatchPaused ? "批量分析已暂停" : "批量分析运行中"}</strong>
          <button type="button" onClick={toggleBatchAnalysisPause}>{isBatchPaused ? "继续" : "暂停"}</button>
          <button type="button" onClick={() => setIsBatchConsoleVisible((visible) => !visible)}>
            {isBatchConsoleVisible ? "隐藏日志" : "显示日志"}
          </button>
          <button type="button" className="danger" onClick={stopBatchAnalysis}>终止</button>
        </div>
      )}
      {isBatchAnalyzing && isBatchConsoleVisible && (
        <BatchJobConsole
          isPaused={isBatchPaused}
          logs={batchJobLogs}
          onClose={() => setIsBatchConsoleVisible(false)}
          onPauseToggle={toggleBatchAnalysisPause}
          onStop={stopBatchAnalysis}
        />
      )}
      <BatchRunReportDialog report={batchRunReport} onClose={() => setBatchRunReport(null)} />
      <TianshuReportDialog
        open={isTianshuOpen}
        report={tianshuReport}
        onClose={() => setIsTianshuOpen(false)}
        t={t}
      />
      <SettingsDialog
        candidateDisplayLimit={candidateDisplayLimit}
        engineDiagnostics={engineDiagnostics}
        engineProfiles={engineProfiles}
        engineStatus={engineStatus}
        exportSettings={researchExportSettings}
        isAnalyzing={isAnalyzing}
        language={language}
        open={isSettingsOpen}
        profile={engineProfile}
        selectedEngineProfileIndex={selectedEngineProfileIndex}
        onAnalyze={analyzeCurrentPosition}
        onCandidateDisplayLimitChange={updateCandidateDisplayLimit}
        onClose={() => setIsSettingsOpen(false)}
        onExportSettingsChange={updateResearchExportSettings}
        onLanguageChange={updateLanguage}
        onAutoDetect={autoDetectEngine}
        onChoosePath={chooseEngineConfigPath}
        onDeleteProfile={deleteEngineProfile}
        onManualProfileAdd={addManualEngineProfile}
        onMoveProfile={moveEngineProfile}
        onProbe={probeCurrentEngine}
        onProfileChange={updateEngineProfile}
        onResetProfile={resetEngineProfile}
        onSaveProfile={saveCurrentEngineProfile}
        onSelectProfile={selectEngineProfile}
        onSetDefaultProfile={setCurrentEngineAsDefault}
        t={t}
      />
      <OgsDialog
        detail={ogsStatusDetail}
        isOpen={isOgsDialogOpen}
        sourceLabel={ogsSourceLabel}
        status={ogsStatus}
        onClose={() => setIsOgsDialogOpen(false)}
        onConnect={connectOgsUrl}
        onDisconnect={() => disconnectOgs("已断开 OGS。")}
      />
      <OgsBrowserDialog
        isOpen={isOgsBrowserOpen}
        onClose={() => setIsOgsBrowserOpen(false)}
        onOpenGame={(gameId) => {
          ogsConnectorRef.current?.connectGame(gameId);
          setIsOgsBrowserOpen(false);
        }}
        onOpenUrl={() => setIsOgsDialogOpen(true)}
        onOpenDemo={(demoId) => {
          ogsConnectorRef.current?.connectDemo(demoId);
          setIsOgsBrowserOpen(false);
        }}
      />
      <AboutDialog open={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
      <GameProgressPanel
        currentMoveNumber={currentMoveNumber}
        open={isGameProgressPanelOpen}
        totalMoves={sourceMainLineMoveCount || sourceMainLineMoves.length || moves.length}
        onClose={() => setIsGameProgressPanelOpen(false)}
        onInsert={insertGameProgress}
      />
    </main>
  );
}

function BatchRunReportDialog({ report, onClose }: { report: BatchRunReport | null; onClose: () => void }) {
  if (!report) return null;
  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="auto-analysis-dialog batch-run-report" role="dialog" aria-modal="true" aria-labelledby="batch-report-title">
        <div className="dialog-title-row">
          <h2 id="batch-report-title">{report.stopped ? "批量分析已终止" : "批量分析完成"}</h2>
          <button type="button" aria-label="关闭" onClick={onClose}>×</button>
        </div>
        <dl className="batch-report-grid">
          <div><dt>选择棋谱</dt><dd>{report.selectedFiles} 个</dd></div>
          <div><dt>生成 TSG</dt><dd>{report.completedFiles} 个</dd></div>
          <div><dt>跳过棋谱</dt><dd>{report.skippedFiles} 个</dd></div>
          <div><dt>分析回合</dt><dd>{report.analyzedMoves} 手</dd></div>
          <div><dt>出题标记</dt><dd>{report.problemCount} 个</dd></div>
          <div><dt>目标棋手</dt><dd>{report.targetPlayer || "全部棋手"}</dd></div>
        </dl>
        <div className="batch-report-output"><strong>TSG 输出目录</strong><span>{report.outputDirectory}</span></div>
        <div className="dialog-actions"><button type="button" onClick={onClose}>关闭</button></div>
      </section>
    </div>
  );
}

function BatchJobConsole({ isPaused, logs, onClose, onPauseToggle, onStop }: {
  isPaused: boolean;
  logs: string[];
  onClose: () => void;
  onPauseToggle: () => void;
  onStop: () => void;
}) {
  const [position, setPosition] = useState(() => ({
    x: Math.max(16, window.innerWidth - 576),
    y: Math.max(72, window.innerHeight - 440)
  }));
  const dragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const consoleRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const move = (event: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const width = consoleRef.current?.offsetWidth ?? 560;
      const height = consoleRef.current?.offsetHeight ?? 300;
      setPosition({
        x: Math.max(-width + 48, Math.min(window.innerWidth - 48, event.clientX - drag.offsetX)),
        y: Math.max(-height + 32, Math.min(window.innerHeight - 32, event.clientY - drag.offsetY))
      });
    };
    const end = () => { dragRef.current = null; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", end);
    };
  }, []);

  return (
    <section className="batch-job-console batch-job-console-floating" aria-label="Batch job console" ref={consoleRef} style={{ left: position.x, top: position.y }}>
      <div
        className="batch-job-console-title batch-job-console-drag-handle"
        onMouseDown={(event) => {
          const bounds = consoleRef.current?.getBoundingClientRect();
          dragRef.current = {
            offsetX: event.clientX - (bounds?.left ?? position.x),
            offsetY: event.clientY - (bounds?.top ?? position.y)
          };
        }}
      >
        <span>Job Console · {isPaused ? "批量分析已暂停" : "批量分析进行中"} · 拖动此处移动</span>
        <button
          type="button"
          className="batch-job-console-close"
          aria-label="关闭日志窗口"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={onClose}
        >×</button>
      </div>
      <pre>{logs.length > 0 ? logs.join("\n") : "等待批量任务日志..."}</pre>
      <div className="batch-job-console-actions">
        <button type="button" onClick={onPauseToggle}>{isPaused ? "继续" : "暂停"}</button>
        <button type="button" onClick={onStop}>终止批量任务</button>
      </div>
    </section>
  );
}

async function analyzeGameForBatch(params: {
  parsed: ReturnType<typeof parseGameRecord>;
  sourceContent: string;
  sourceFileName: string;
  settings: BatchAnalysisSettings;
  profile: EngineProfile;
  shouldStop: { current: boolean };
  shouldPause: { current: boolean };
  onProgress?: (progress: { candidates: EngineCandidateMove[]; moveNumber: number; point?: ReviewAnalysisPoint; status: string }) => void;
}): Promise<{ analyzed: number; document: ResearchDocument; problemCount: number }> {
  const { onProgress, parsed, profile, settings, shouldPause, shouldStop, sourceContent, sourceFileName } = params;
  const moves = parsed.moves;
  const startMove = Math.max(1, Math.min(moves.length, Math.min(settings.startMove, settings.endMove)));
  const endMove = Math.max(startMove, Math.min(moves.length, Math.max(settings.startMove, settings.endMove)));
  const targetVisits = settings.visitsPerMove > 0 ? settings.visitsPerMove : 0;
  const secondsPerMove = settings.visitsPerMove > 0 ? settings.secondsPerMove : Math.max(0.1, settings.secondsPerMove);
  const summary = createEmptyAutoAnalysisSummary();
  const points: ReviewAnalysisPoint[] = [];
  const problems: ProblemItem[] = [];
  let document = createResearchDocument({
    blackName: parsed.blackName,
    boardSize: parsed.boardSize,
    currentMoveNumber: moves.length,
    gameDate: parsed.gameDate,
    result: parsed.result,
    komi: parsed.komi,
    moves,
    rules: parsed.rules,
    sourceFileName,
    stones: buildBoardPosition(moves, parsed.boardSize, moves.length).stones,
    totalMoves: moves.length,
    whiteName: parsed.whiteName
  });
  document.mainSgf = sourceContent;
  document.gameTree = parsed.gameTree;
  const targetPlayer = settings.targetPlayer.trim();
  const targetColor: "black" | "white" | "none" | null = targetPlayer
    ? playerNameMatches(parsed.blackName, targetPlayer)
      ? "black"
      : playerNameMatches(parsed.whiteName, targetPlayer)
        ? "white"
        : "none"
    : null;
  if (targetColor === "none") {
    throw new Error(`目标棋手“${targetPlayer}”未匹配本局棋手：黑方“${parsed.blackName}”，白方“${parsed.whiteName}”`);
  }

  for (let moveNumber = startMove; moveNumber <= endMove; moveNumber += 1) {
    await waitWhileBatchPaused(shouldPause, shouldStop);
    if (shouldStop.current) {
      break;
    }
    const actualMove = moves[moveNumber - 1];
    if (!actualMove) {
      continue;
    }
    if ((actualMove.color === "black" && !settings.includeBlack) || (actualMove.color === "white" && !settings.includeWhite)) {
      continue;
    }
    let moveStartedAt = Date.now();
    const positionMoveNumber = moveNumber - 1;
    onProgress?.({ candidates: [], moveNumber, status: "正在启动引擎并等待候选点" });
    let result = await analyzePositionContinuous({
      boardSize: parsed.boardSize,
      komi: parsed.komi,
      moves: moves.slice(0, positionMoveNumber),
      nextColor: actualMove.color,
      profile
    });
    let best = result.candidates[0];
    onProgress?.({
      candidates: result.candidates,
      moveNumber,
      status: best ? `已返回 ${result.candidates.length} 个候选点` : "等待首批候选点"
    });
    while (!shouldStop.current && shouldContinueAutoAnalysisMove(moveStartedAt, secondsPerMove, targetVisits, best)) {
      moveStartedAt += await waitWhileBatchPaused(shouldPause, shouldStop);
      if (shouldStop.current) {
        break;
      }
      await waitForAutoAnalysisPoll(shouldStop);
      result = await analyzePositionContinuous({
        boardSize: parsed.boardSize,
        komi: parsed.komi,
        moves: moves.slice(0, positionMoveNumber),
        nextColor: actualMove.color,
        profile
      });
      best = result.candidates[0];
      onProgress?.({
        candidates: result.candidates,
        moveNumber,
        status: best
          ? targetVisits > 0
            ? `计算量 ${formatVisits(best.visits)}/${formatVisits(targetVisits)}`
            : `持续计算，候选 ${result.candidates.length}`
          : "等待首批候选点"
      });
      if (!best && result.status !== "waiting-for-candidates") {
        break;
      }
    }
    if (shouldStop.current || !best) {
      continue;
    }

    document = appendCandidateBlockForBatch(document, positionMoveNumber, result.candidates);
    points.push({
      moveNumber,
      scoreLead: best.scoreLead,
      visits: best.visits,
      winrate: toBlackWinrate(best.winrate, actualMove.color)
    });
    onProgress?.({
      candidates: result.candidates,
      moveNumber,
      point: points[points.length - 1],
      status: `第 ${moveNumber} 手分析完成`
    });

    const actualPoint = moveToGtpPoint(actualMove, parsed.boardSize);
    const statisticsCandidates = result.candidates.slice(0, DEFAULT_CANDIDATE_DISPLAY_LIMIT);
    const actualCandidateIndex = statisticsCandidates.findIndex((candidate) => candidate.moveName === actualPoint);
    const actualCandidate = actualCandidateIndex >= 0 ? result.candidates[actualCandidateIndex] : null;
    const bestVisits = Math.max(1, ...statisticsCandidates.map((candidate) => candidate.visits));
    const matchScore = actualCandidate ? actualCandidate.visits / bestVisits : 0;
    const winrateLoss = actualCandidate ? Math.max(0, best.winrate - actualCandidate.winrate) : null;
    const scoreLoss = actualCandidate ? calculateScoreLoss(actualMove.color, best, actualCandidate) : null;
    summary.analyzed += 1;
    summary.topMatches += actualCandidateIndex === 0 ? 1 : 0;
    summary.candidateMatches += actualCandidateIndex >= 0 ? 1 : 0;
    summary.matches += actualCandidateIndex >= 0 && actualCandidateIndex < MATCH_SETTINGS.bestNums && matchScore * 100 >= MATCH_SETTINGS.percentVisits ? 1 : 0;
    summary.totalMatchScore += matchScore;
    if (winrateLoss !== null) {
      summary.totalWinrateLoss += winrateLoss;
      summary.knownWinrateLosses += 1;
    }
    if (scoreLoss !== null) {
      summary.totalScoreLoss += scoreLoss;
      summary.knownScoreLosses += 1;
    }
    summary.details.push({
      actualMoveName: actualPoint,
      color: actualMove.color,
      isCandidate: actualCandidateIndex >= 0,
      isMatch: actualCandidateIndex >= 0 && actualCandidateIndex < MATCH_SETTINGS.bestNums && matchScore * 100 >= MATCH_SETTINGS.percentVisits,
      isTopMove: actualCandidateIndex === 0,
      matchScore,
      moveNumber,
      rank: actualCandidateIndex >= 0 ? actualCandidateIndex + 1 : null,
      scoreLoss,
      winrate: toBlackWinrate(best.winrate, actualMove.color),
      winrateLoss
    });

    const isTargetPlayerMove = targetColor === null || actualMove.color === targetColor;
    if (isTargetPlayerMove && winrateLoss !== null && winrateLoss >= settings.winrateLossThreshold) {
      problems.push(createProblemItem({
        actualMoveName: actualPoint,
        candidates: result.candidates,
        color: actualMove.color,
        engineName: profile.name,
        modelName: profile.modelPath ? profile.modelPath.split("/").pop() : undefined,
        moveNumber,
        threshold: settings.winrateLossThreshold,
        winrateLoss,
        candidateLimit: settings.candidateLimit
      }));
    }
  }

  if (settings.mode !== "problems") {
    document.analysis = buildResearchAnalysisSnapshot(summary, points, { startMove, endMove }, profile);
  }
  document.problemSet = createProblemSet(problems, settings);
  if (document.analysis && targetPlayer) {
    document.analysis = { ...document.analysis, targetPlayer };
  }
  document.analysisCompletion = createAnalysisCompletionMarker({
    analyzedMoves: summary.analyzed,
    endMove,
    parsed,
    profile,
    settings,
    shouldStop: shouldStop.current,
    sourceFileName,
    startMove
  });
  return { analyzed: summary.analyzed, document, problemCount: problems.length };
}

function GameProgressPanel({
  currentMoveNumber,
  open,
  totalMoves,
  onClose,
  onInsert
}: {
  currentMoveNumber: number;
  open: boolean;
  totalMoves: number;
  onClose: () => void;
  onInsert: (range: { startMoveNumber: number; endMoveNumber: number }) => void;
}) {
  const defaultEnd = Math.max(1, Math.min(totalMoves || 1, currentMoveNumber || totalMoves || 1));
  const defaultStart = Math.max(1, Math.min(defaultEnd, defaultEnd - 9));
  const [startMoveNumber, setStartMoveNumber] = useState(defaultStart);
  const [endMoveNumber, setEndMoveNumber] = useState(defaultEnd);

  useEffect(() => {
    if (!open) {
      return;
    }
    const nextEnd = Math.max(1, Math.min(totalMoves || 1, currentMoveNumber || totalMoves || 1));
    setStartMoveNumber(Math.max(1, Math.min(nextEnd, nextEnd - 9)));
    setEndMoveNumber(nextEnd);
  }, [currentMoveNumber, open, totalMoves]);

  if (!open) {
    return null;
  }

  const maxMove = Math.max(1, totalMoves);
  const normalizedStart = clampNumber(startMoveNumber, 1, maxMove, 1);
  const normalizedEnd = clampNumber(endMoveNumber, normalizedStart, maxMove, normalizedStart);

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="game-progress-dialog auto-analysis-dialog" role="dialog" aria-modal="true" aria-labelledby="game-progress-title">
        <div className="dialog-title-row">
          <h2 id="game-progress-title">插入棋谱</h2>
          <button type="button" aria-label="Close" onClick={onClose}>×</button>
        </div>
        <label>
          <span>开始手数</span>
          <input
            min={1}
            max={maxMove}
            type="number"
            value={startMoveNumber}
            onChange={(event) => setStartMoveNumber(Number(event.target.value))}
          />
        </label>
        <label>
          <span>结束手数</span>
          <input
            min={1}
            max={maxMove}
            type="number"
            value={endMoveNumber}
            onChange={(event) => setEndMoveNumber(Number(event.target.value))}
          />
        </label>
        <p className="dialog-hint">主分支共 {totalMoves} 手；导出图中的手数会从所选开始手重新标为 1。</p>
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>取消</button>
          <button type="button" onClick={() => onInsert({ startMoveNumber: normalizedStart, endMoveNumber: normalizedEnd })}>插入</button>
        </div>
      </section>
    </div>
  );
}

function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) {
    return null;
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="about-dialog" role="dialog" aria-modal="true" aria-labelledby="about-dialog-title">
        <div className="dialog-title-row">
          <h2 id="about-dialog-title">About TensuGo / 关于 TensuGo</h2>
          <button type="button" aria-label="Close" onClick={onClose}>×</button>
        </div>
        <div className="about-dialog-body">
          <h3>{appDisplayVersion()}</h3>
          <dl>
            <div>
              <dt>Build / Revision</dt>
              <dd>{APP_VERSION.patch}</dd>
            </div>
            <div>
              <dt>Product</dt>
              <dd>A Go research and review document editor powered by KataGo.</dd>
            </div>
            <div>
              <dt>Frontend</dt>
              <dd>React + TypeScript</dd>
            </div>
            <div>
              <dt>Desktop</dt>
              <dd>Tauri</dd>
            </div>
            <div>
              <dt>Engine</dt>
              <dd>KataGo</dd>
            </div>
            <div>
              <dt>Document format</dt>
              <dd>TSG</dd>
            </div>
          </dl>
          <p>© 2026 Xinyu Tu</p>
        </div>
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>Close</button>
        </div>
      </section>
    </div>
  );
}

function ResearchRightPane({
  branchRows,
  document,
  selectedNodeId,
  selectedBlockId,
  onBranchNodeClick,
  onClearResearchBlockSelection,
  onResearchBlockClick,
  onResearchBlockMove
}: {
  branchRows: ReturnType<typeof flattenBranchTree>;
  document: ResearchDocument;
  selectedNodeId: string;
  selectedBlockId: string | null;
  onBranchNodeClick: (nodeId: string) => void;
  onClearResearchBlockSelection: () => void;
  onResearchBlockClick: (blockId: string) => void;
  onResearchBlockMove: (blockId: string, targetBlockId: string) => void;
}) {
  const branchTreeRef = useRef<HTMLDivElement | null>(null);
  const [branchPanePercent, setBranchPanePercent] = useState(34);
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const researchMarkers = useMemo(() => buildResearchMarkersByMove(document), [document]);
  const blocks = document.sections.flatMap((section) => section.blocks).filter(isVisibleResearchBlock);

  useEffect(() => {
    const tree = branchTreeRef.current;
    const activeNode = tree?.querySelector<HTMLElement>(".branch-node.active");
    activeNode?.scrollIntoView({ block: "center", inline: "nearest" });
  }, [selectedNodeId, branchRows]);

  const beginVerticalResize = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const pane = event.currentTarget.parentElement;
    const rect = pane?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const handleMove = (moveEvent: MouseEvent) => {
      const nextPercent = ((moveEvent.clientY - rect.top) / rect.height) * 100;
      setBranchPanePercent(Math.max(22, Math.min(60, nextPercent)));
    };
    const handleUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  return (
    <div className="research-right-pane" style={{ "--research-tree-height": `${branchPanePercent}%` } as CSSProperties}>
      <div className="branch-tree research-branch-tree" aria-label="分支树" ref={branchTreeRef}>
        {branchRows.length === 0 ? (
          <div className="branch-tree-empty">空棋谱</div>
        ) : (
          branchRows.map((row) => (
            <button
              type="button"
              className={[
                "branch-node",
                row.nodeId === selectedNodeId ? "active" : "",
                row.isMainLine ? "main-line" : "side-line",
                row.isLeaf ? "leaf" : ""
              ].filter(Boolean).join(" ")}
              key={row.nodeId}
              onClick={() => onBranchNodeClick(row.nodeId)}
              style={{ "--branch-depth": row.depth } as CSSProperties}
              title={`第 ${row.moveNumber} 手`}
            >
              <span className={`branch-stone ${row.color}`} />
              <span className="branch-label">{row.label}</span>
              {document.problemSet?.items.some((item) => item.moveNumber === row.moveNumber) ? (
                <span className="branch-problem-marker" title="出题标记">题</span>
              ) : null}
              {researchMarkers.get(row.moveNumber)?.map((block) => (
                <span
                  aria-label="显示评论变化"
                  className="branch-comment-icon"
                  key={block.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    onResearchBlockClick(block.id);
                  }}
                  role="button"
                  tabIndex={0}
                  title={block.label}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      onResearchBlockClick(block.id);
                    }
                  }}
                >
                  文
                </span>
              ))}
            </button>
          ))
        )}
      </div>
      <div className="research-pane-splitter" aria-label="调整分支树高度" role="separator" onMouseDown={beginVerticalResize} />
      <div className="research-block-preview" aria-label="研究文档 blocks 顺序" onClick={onClearResearchBlockSelection}>
        <div className="research-block-preview-header">
          <strong>文档顺序</strong>
          <span>{blocks.length} blocks</span>
        </div>
        <div className="research-block-list">
          {blocks.length === 0 ? (
            <p className="research-block-empty">还没有 block</p>
          ) : (
            blocks.map((block, index) => (
              <button
                type="button"
                className={[
                  "research-block-item",
                  block.id === selectedBlockId ? "active" : "",
                  draggingBlockId === block.id ? "dragging" : ""
                ].filter(Boolean).join(" ")}
                draggable
                key={block.id}
                onClick={(event) => {
                  event.stopPropagation();
                  onResearchBlockClick(block.id);
                }}
                onDragStart={(event) => {
                  setDraggingBlockId(block.id);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", block.id);
                }}
                onDragEnd={() => setDraggingBlockId(null)}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const sourceBlockId = event.dataTransfer.getData("text/plain") || draggingBlockId;
                  setDraggingBlockId(null);
                  if (sourceBlockId && sourceBlockId !== block.id) {
                    onResearchBlockMove(sourceBlockId, block.id);
                  }
                }}
              >
                <span className="research-block-index">{index + 1}</span>
                <span className={`research-block-icon ${block.type}`}>
                  {block.type === "variation" || block.type === "game_progress" ? <span className="mini-board-icon" /> : <span className="mini-text-icon">文</span>}
                </span>
                <span className="research-block-copy">
                  <strong>{blockTypeLabel(block)}</strong>
                  <span>{blockSummary(block)}</span>
                  {block.type === "game_progress" ? (
                    <ResearchBlockMiniBoard
                      boardSize={block.boardSize}
                      sequence={block.sequence}
                      stones={block.position}
                    />
                  ) : null}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ResearchBlockMiniBoard({
  boardSize,
  sequence,
  stones
}: {
  boardSize: number;
  sequence: string[];
  stones: ReviewStone[];
}) {
  const labels = useMemo(() => {
    const nextLabels = new Map<string, number>();
    sequence.forEach((point, index) => {
      const parsed = gtpPointToBoardPoint(point, boardSize);
      if (parsed) {
        nextLabels.set(boardPointKey(parsed.x, parsed.y), index + 1);
      }
    });
    return nextLabels;
  }, [boardSize, sequence]);
  const visibleStones = stones.filter((stone) => labels.has(boardPointKey(stone.x, stone.y)));

  return (
    <span className="research-mini-board" aria-label="棋谱进展预览">
      {visibleStones.map((stone) => (
        <span
          className={`research-mini-stone ${stone.color}`}
          key={`${stone.moveNumber}-${stone.x}-${stone.y}`}
          style={{
            "--mini-x": `${(stone.x / Math.max(1, boardSize - 1)) * 100}%`,
            "--mini-y": `${(stone.y / Math.max(1, boardSize - 1)) * 100}%`
          } as CSSProperties}
        >
          {labels.get(boardPointKey(stone.x, stone.y))}
        </span>
      ))}
    </span>
  );
}

function blockTypeLabel(block: ResearchBlock): string {
  if (block.type === "variation") {
    return "变化图";
  }
  if (block.type === "game_progress") {
    return "棋谱进展";
  }
  if (block.type === "paragraph") {
    return "文字";
  }
  if (block.type === "quote") {
    return "引用";
  }
  if (block.type === "conclusion") {
    return "结论";
  }
  if (block.type === "heading") {
    return "标题";
  }
  return block.type;
}

function isVisibleResearchBlock(block: ResearchBlock): boolean {
  return block.type !== "candidate_moves" && block.type !== "ai_analysis";
}

function firstVisibleResearchBlockId(document: ResearchDocument): string | null {
  return document.sections.flatMap((section) => section.blocks).find(isVisibleResearchBlock)?.id ?? null;
}

function blockSummary(block: ResearchBlock): string {
  const text =
    block.type === "variation" ? block.caption || block.name :
    block.type === "game_progress" ? block.caption :
    block.type === "paragraph" || block.type === "conclusion" ? block.markdown :
    block.type === "quote" ? block.text :
    block.type === "heading" ? block.text :
    block.type === "board" ? block.caption ?? `第 ${block.moveNumber} 手局面` :
    "";
  return text.replace(/\s+/g, " ").trim().slice(0, 70) || "未填写";
}

function withVariationComment<T extends Extract<ResearchBlock, { type: "variation" }>>(block: T, markdown: string): T {
  return markdown ? { ...block, description: markdown } : block;
}

function isCompleteEngineProfile(profile: EngineProfile): boolean {
  if (profile.commandLine.trim()) {
    return true;
  }
  return Boolean(profile.executablePath.trim() && profile.modelPath.trim() && profile.configPath.trim());
}

function documentHasSavedAnalysis(document: ResearchDocument): boolean {
  if (document.analysis && document.analysis.analyzed > 0) {
    return true;
  }
  return document.sections
    .flatMap((section) => section.blocks)
    .some((block) => block.type === "candidate_moves" && block.candidates.length > 0);
}

function toolbarScaleForBoardSize(boardPixelSize: number): number {
  return clampNumber(boardPixelSize / 760, 0.9, 1.5, 1);
}

function findSavedCandidatesForMove(document: ResearchDocument, moveNumber: number): EngineCandidateMove[] {
  const blocks = document.sections.flatMap((section) => section.blocks);
  const currentMoveCandidates = blocks.find(
    (block): block is Extract<ResearchBlock, { type: "candidate_moves" }> =>
      block.type === "candidate_moves" && block.moveNumber === moveNumber && block.candidates.length > 0
  );
  if (currentMoveCandidates) {
    return currentMoveCandidates.candidates;
  }
  const analyzedMoveNumber = moveNumber + 1;
  const analysisDetail = document.analysis?.details.find(
    (detail) => detail.moveNumber === analyzedMoveNumber && detail.actualMoveName
  );
  if (!analysisDetail?.actualMoveName) {
    return [];
  }
  const analysisPoint = document.analysis?.points.find((point) => point.moveNumber === analyzedMoveNumber);
  return [
    {
      rank: analysisDetail.rank ?? 1,
      moveName: analysisDetail.actualMoveName,
      visits: analysisPoint?.visits ?? 0,
      winrate: analysisDetail.winrate,
      scoreLead: analysisPoint?.scoreLead ?? 0,
      pv: []
    }
  ];
}

function mergeStableCandidates(previous: EngineCandidateMove[], next: EngineCandidateMove[]): EngineCandidateMove[] {
  if (previous.length === 0) {
    return next;
  }
  const previousByMove = new Map(previous.map((candidate) => [candidate.moveName, candidate]));
  const nextMoveNames = new Set(next.map((candidate) => candidate.moveName));
  const merged = next.map((candidate) => {
    const previousCandidate = previousByMove.get(candidate.moveName);
    if (!previousCandidate) {
      return candidate;
    }
    return {
      ...candidate,
      visits: Math.max(previousCandidate.visits, candidate.visits)
    };
  });
  for (const candidate of previous) {
    if (!nextMoveNames.has(candidate.moveName)) {
      merged.push(candidate);
    }
  }
  return merged.sort((left, right) => left.rank - right.rank);
}

function filterCandidatesOnEmptyPoints(
  candidates: EngineCandidateMove[],
  stones: Array<{ x: number; y: number }>,
  boardSize: number
): EngineCandidateMove[] {
  if (candidates.length === 0 || stones.length === 0) {
    return candidates;
  }
  const occupiedPoints = new Set(stones.map((stone) => boardPointKey(stone.x, stone.y)));
  return candidates.filter((candidate) => {
    const point = gtpPointToBoardPoint(candidate.moveName, boardSize);
    return !point || !occupiedPoints.has(boardPointKey(point.x, point.y));
  });
}

function candidatePositionKey(boardSize: number, komi: number, moves: ReviewMove[]): string {
  const moveKey = moves.map((move) => `${move.color[0]}${move.x},${move.y}`).join(";");
  return `${boardSize}|${komi}|${moveKey}`;
}

function gtpPointToBoardPoint(point: string, boardSize: number): { x: number; y: number } | null {
  if (!point || point.toLowerCase() === "pass") {
    return null;
  }
  const match = /^([A-HJ-Z])(\d+)$/i.exec(point);
  if (!match) {
    return null;
  }
  const labels = "ABCDEFGHJKLMNOPQRSTUVWXYZ";
  const x = labels.indexOf(match[1].toUpperCase());
  const row = Number(match[2]);
  const y = boardSize - row;
  if (x < 0 || x >= boardSize || !Number.isInteger(row) || y < 0 || y >= boardSize) {
    return null;
  }
  return { x, y };
}

function boardPointKey(x: number, y: number): string {
  return `${x}:${y}`;
}

function buildResearchMarkersByMove(document: ResearchDocument): Map<number, Array<{ id: string; label: string }>> {
  const markers = new Map<number, Array<{ id: string; label: string }>>();
  for (const block of document.sections.flatMap((section) => section.blocks)) {
    const moveNumber =
      block.type === "variation" ? block.fromMoveNumber :
      block.type === "game_progress" ? block.endMoveNumber :
      block.type === "board" ? block.moveNumber :
      null;
    if (moveNumber === null) {
      continue;
    }
    const label =
      block.type === "variation" ? block.caption :
      block.type === "game_progress" ? block.caption :
      block.type === "board" ? block.caption ?? "局面评论" :
      "候选点评论";
    markers.set(moveNumber, [...(markers.get(moveNumber) ?? []), { id: block.id, label }]);
  }
  return markers;
}

function findCommentBlockIdAfterResearchBlock(document: ResearchDocument, blockId: string): string | null {
  const blocks = document.sections.flatMap((section) => section.blocks);
  const index = blocks.findIndex((block) => block.id === blockId);
  const next = index >= 0 ? blocks[index + 1] : null;
  return next && (next.type === "paragraph" || next.type === "conclusion") ? next.id : null;
}

function appendResearchVariationsToTree(baseTree: ReturnType<typeof createEmptyGameTree>, document: ResearchDocument) {
  let nextTree = baseTree;
  const blocks = document.sections.flatMap((section) => section.blocks);
  for (const block of blocks) {
    if (block.type !== "variation" || block.sequence.length === 0) {
      continue;
    }
    let parentNodeId = nodeIdAtMoveNumber(nextTree, findMainLineEndNodeId(nextTree), block.fromMoveNumber);
    for (let index = 0; index < block.sequence.length; index += 1) {
      const moveNumber = block.fromMoveNumber + index + 1;
      const move = gtpPointToMove(block.sequence[index], block.boardSize, moveNumber);
      if (!move) {
        continue;
      }
      const appended = appendMoveToGameTree(nextTree, parentNodeId, {
        color: move.color,
        point: { col: move.x, row: move.y }
      });
      nextTree = appended.tree;
      parentNodeId = appended.nodeId;
    }
  }
  return nextTree;
}

function TianshuReportDialog({
  open,
  report,
  onClose,
  t
}: {
  open: boolean;
  report: TianshuReport | null;
  onClose: () => void;
  t: Translator;
}) {
  if (!open || !report) {
    return null;
  }
  const analyzed = Math.max(1, report.analyzed);
  const blackStats = summarizeReportSide(report.details, "black");
  const whiteStats = summarizeReportSide(report.details, "white");
  const missed = Math.max(0, report.analyzed - report.candidateMatches);
  const matchRate = report.matches / analyzed;
  const candidateRate = report.candidateMatches / analyzed;
  const averageWinrateLoss = report.knownWinrateLosses > 0 ? report.totalWinrateLoss / report.knownWinrateLosses : null;
  const averageScoreLoss = report.knownScoreLosses > 0 ? report.totalScoreLoss / report.knownScoreLosses : null;
  const matchDegree = report.totalMatchScore / analyzed;
  const winrateBuckets = buildLossBuckets(report.details, "winrateLoss", [0.5, 1.5, 3, 6, 12]);
  const scoreBuckets = buildLossBuckets(
    report.details.filter((detail) => detail.scoreLoss !== null),
    "scoreLoss",
    [0.5, 1.5, 3, 6, 12]
  );

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="tianshu-report-report" role="dialog" aria-modal="true" aria-labelledby="tianshu-report-report-title">
        <div className="dialog-title-row">
          <h2 id="tianshu-report-report-title">{t("tianshuReport")}</h2>
          <button type="button" aria-label={t("close")} onClick={onClose}>×</button>
        </div>
        <div className="tianshu-report-report-meta">
          <span>{t("range")}：{t("moveCounterPrefix")} {report.startMove} - {report.endMove} {t("moveCounterSuffix")}</span>
          <span>{t("generated")}：{report.analyzedAt}</span>
        </div>
        <div className="tianshu-report-report-main">
          <div className="tianshu-report-side-card black">
            <h3>{t("black")}</h3>
            <ReportBar label={t("matchDegree")} value={formatFixed(blackStats.matchDegree * 100, 1)} percent={blackStats.matchDegree} />
            <ReportBar label={t("matchRate")} value={formatPercent(blackStats.matchRate)} percent={blackStats.matchRate} />
            <ReportBar label={t("topMoveRate")} value={formatPercent(blackStats.topRate)} percent={blackStats.topRate} />
            <ReportBar label="候选命中率" value={formatPercent(blackStats.candidateRate)} percent={blackStats.candidateRate} />
            <ReportBar label={t("averageScoreLoss")} value={formatOptionalNumber(blackStats.averageScoreLoss, "目")} percent={scaleLossBar(blackStats.averageScoreLoss)} />
            <ReportBar label={t("averageWinrateLoss")} value={formatOptionalNumber(blackStats.averageWinrateLoss, "%")} percent={scaleLossBar(blackStats.averageWinrateLoss)} />
          </div>
          <div className="tianshu-report-side-card white">
            <h3>{t("white")}</h3>
            <ReportBar label={t("matchDegree")} value={formatFixed(whiteStats.matchDegree * 100, 1)} percent={whiteStats.matchDegree} />
            <ReportBar label={t("matchRate")} value={formatPercent(whiteStats.matchRate)} percent={whiteStats.matchRate} />
            <ReportBar label={t("topMoveRate")} value={formatPercent(whiteStats.topRate)} percent={whiteStats.topRate} />
            <ReportBar label="候选命中率" value={formatPercent(whiteStats.candidateRate)} percent={whiteStats.candidateRate} />
            <ReportBar label={t("averageScoreLoss")} value={formatOptionalNumber(whiteStats.averageScoreLoss, "目")} percent={scaleLossBar(whiteStats.averageScoreLoss)} />
            <ReportBar label={t("averageWinrateLoss")} value={formatOptionalNumber(whiteStats.averageWinrateLoss, "%")} percent={scaleLossBar(whiteStats.averageWinrateLoss)} />
          </div>
          <div className="tianshu-report-loss-panel">
            <div className="tianshu-report-tabs">
              <span>{t("scoreLossStatsShort")}</span>
              <span>{t("winrateLossStatsShort")}</span>
            </div>
            <LossDistribution title={t("scoreLossStats")} buckets={scoreBuckets} />
            <LossDistribution title={t("winrateLossStats")} buckets={winrateBuckets} />
          </div>
        </div>
        <div className="tianshu-report-summary-grid">
          <ReportMetric label={t("analyzed")} value={`${report.analyzed} ${t("moveCounterSuffix")}`} />
          <ReportMetric label={t("matchDegree")} value={formatFixed(matchDegree * 100, 1)} />
          <ReportMetric label={t("matchRate")} value={formatPercent(matchRate)} />
          <ReportMetric label={t("topMoveHitRate")} value={formatPercent(report.topMatches / analyzed)} />
          <ReportMetric label="候选命中率" value={formatPercent(candidateRate)} />
          <ReportMetric label={t("missedCandidates")} value={`${missed} ${t("moveCounterSuffix")}`} />
          <ReportMetric label={t("averageScoreLoss")} value={formatOptionalNumber(averageScoreLoss, "目")} />
          <ReportMetric label={t("averageWinrateLoss")} value={formatOptionalNumber(averageWinrateLoss, "%")} />
          <ReportMetric label={t("totalWinrateLoss")} value={`${report.totalWinrateLoss.toFixed(1)}%`} />
        </div>
        <TianshuTrendChart details={report.details} startMove={report.startMove} endMove={report.endMove} t={t} />
        <div className="tianshu-report-footer">
          <span>{t("black")}：{t("matchRate")} {formatPercent(blackStats.matchRate)} {t("matchDegree")} {formatFixed(blackStats.matchDegree * 100, 1)}</span>
          <span>{t("white")}：{t("matchRate")} {formatPercent(whiteStats.matchRate)} {t("matchDegree")} {formatFixed(whiteStats.matchDegree * 100, 1)}</span>
          <span>统计条件：候选命中率按前 {DEFAULT_CANDIDATE_DISPLAY_LIMIT} 候选；吻合率按前 {MATCH_SETTINGS.bestNums} 候选且 visits 占比阈值 {MATCH_SETTINGS.percentVisits}%；全局统计；目数损失和胜率损失仅在实战手命中候选时统计。</span>
        </div>
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>{t("close")}</button>
        </div>
      </section>
    </div>
  );
}

function ReportBar({ label, percent, value }: { label: string; percent: number; value: string }) {
  const width = `${Math.max(0, Math.min(1, percent)) * 100}%`;
  return (
    <div className="tianshu-report-bar-row">
      <span>{label}</span>
      <div className="tianshu-report-bar-track">
        <div className="tianshu-report-bar-fill" style={{ width }} />
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function ReportMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="tianshu-report-report-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function LossDistribution({ buckets, title }: { buckets: LossBucket[]; title: string }) {
  const maxCount = Math.max(1, ...buckets.map((bucket) => bucket.count));
  return (
    <div className="tianshu-report-loss-distribution">
      <h4>{title}</h4>
      {buckets.map((bucket) => (
        <div className="tianshu-report-loss-row" key={bucket.label}>
          <span>{bucket.label}</span>
          <div>
            <i style={{ width: `${(bucket.count / maxCount) * 100}%` }} />
          </div>
          <strong>{bucket.count}</strong>
        </div>
      ))}
    </div>
  );
}

function TianshuTrendChart({
  details,
  endMove,
  startMove,
  t
}: {
  details: AutoAnalysisMoveDetail[];
  endMove: number;
  startMove: number;
  t: Translator;
}) {
  const width = 900;
  const height = 160;
  const chartLeft = 34;
  const chartRight = width - 12;
  const chartTop = 14;
  const chartBottom = height - 28;
  const span = Math.max(1, endMove - startMove);
  const points = details.map((detail) => {
    const x = chartLeft + ((detail.moveNumber - startMove) / span) * (chartRight - chartLeft);
    const y = chartBottom - (detail.winrate / 100) * (chartBottom - chartTop);
    return { ...detail, x, y };
  });
  const line = points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");

  return (
    <div className="tianshu-report-chart">
      <div className="tianshu-report-chart-tabs">
        <span>{t("trendMatch")}</span>
        <span>{t("segmentedMatch")}</span>
        <span>{t("winrateLossStatsShort")}</span>
        <span>{t("scoreLossStatsShort")}</span>
        <span>{t("matchTrend")}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t("trendMatch")}>
        {[25, 50, 75].map((tick) => {
          const y = chartBottom - (tick / 100) * (chartBottom - chartTop);
          return (
            <g key={tick}>
              <line className="tianshu-report-grid-line" x1={chartLeft} x2={chartRight} y1={y} y2={y} />
              <text x="8" y={y + 4}>{tick}</text>
            </g>
          );
        })}
        <line className="tianshu-report-axis" x1={chartLeft} x2={chartRight} y1={chartBottom} y2={chartBottom} />
        {line && <polyline className="tianshu-report-winrate-line" points={line} />}
        {points.map((point) => (
          <circle
            className={point.rank === 1 ? "tianshu-report-top-dot" : point.rank === null ? "tianshu-report-miss-dot" : "tianshu-report-candidate-dot"}
            cx={point.x}
            cy={point.y}
            key={`dot-${point.moveNumber}`}
            r="3.5"
          />
        ))}
        {[startMove, Math.round((startMove + endMove) / 2), endMove].map((move) => {
          const x = chartLeft + ((move - startMove) / span) * (chartRight - chartLeft);
          return <text className="tianshu-report-move-label" key={move} x={x - 8} y={height - 8}>{move}</text>;
        })}
      </svg>
    </div>
  );
}

async function readGameRecordFile(file: File): Promise<string> {
  if (!/\.gib$/i.test(file.name)) {
    return file.text();
  }

  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder("gb18030").decode(buffer);
  } catch {
    return new TextDecoder("utf-8").decode(buffer);
  }
}

async function chooseBrowserGameRecordFiles(): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".sgf,.gib,.tsg,.json,.txt,application/json,application/x-go-sgf,text/plain";
    input.style.position = "fixed";
    input.style.left = "-9999px";
    input.style.top = "0";
    document.body.appendChild(input);
    input.addEventListener(
      "change",
      () => {
        const files = Array.from(input.files ?? []);
        input.remove();
        resolve(files);
      },
      { once: true }
    );
    input.click();
  });
}

type BrowserDirectoryHandle = {
  name?: string;
};

type BrowserDirectoryPicker = () => Promise<BrowserDirectoryHandle>;

function getBrowserDirectoryPicker(): BrowserDirectoryPicker | null {
  const candidate = window as Window & {
    showDirectoryPicker?: BrowserDirectoryPicker;
  };
  return typeof candidate.showDirectoryPicker === "function" ? candidate.showDirectoryPicker.bind(window) : null;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function downloadTextFile(text: string, fileName: string, mimeType: string) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function fileStem(value: string): string {
  const stem = value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 48);
  return stem || "tensugo-research";
}

function loadResearchExportSettings(): ResearchExportSettings {
  try {
    return normalizeResearchExportSettings(JSON.parse(window.localStorage.getItem(RESEARCH_EXPORT_SETTINGS_KEY) ?? "{}"));
  } catch {
    return DEFAULT_RESEARCH_EXPORT_SETTINGS;
  }
}

function loadCandidateDisplayLimit(): number {
  try {
    const value = JSON.parse(window.localStorage.getItem(INTERFACE_SETTINGS_KEY) ?? "{}") as { candidateDisplayLimit?: number };
    return normalizeCandidateDisplayLimit(value.candidateDisplayLimit);
  } catch {
    return DEFAULT_CANDIDATE_DISPLAY_LIMIT;
  }
}

function loadEngineProfile(): EngineProfile {
  try {
    const value = JSON.parse(window.localStorage.getItem(ENGINE_PROFILE_STORAGE_KEY) ?? "null") as Partial<EngineProfile> | null;
    if (!value) {
      return DEFAULT_ENGINE_PROFILE;
    }
    return {
      ...DEFAULT_ENGINE_PROFILE,
      ...value,
      executablePath: value.executablePath ?? "",
      modelPath: value.modelPath ?? "",
      configPath: value.configPath ?? "",
      commandLine: value.commandLine ?? ""
    };
  } catch {
    return DEFAULT_ENGINE_PROFILE;
  }
}

function loadEngineProfiles(): EngineProfile[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(ENGINE_PROFILES_STORAGE_KEY) ?? "[]") as Partial<EngineProfile>[];
    const profiles = value.map(normalizeEngineProfile).filter((profile) => profile.executablePath || profile.modelPath || profile.configPath || profile.commandLine);
    const legacy = loadEngineProfile();
    return mergeEngineProfiles(profiles, legacy.executablePath || legacy.modelPath || legacy.configPath || legacy.commandLine ? [legacy] : []);
  } catch {
    return [];
  }
}

function normalizeEngineProfile(value: Partial<EngineProfile>): EngineProfile {
  return {
    ...DEFAULT_ENGINE_PROFILE,
    ...value,
    name: value.name || "用户 KataGo",
    executablePath: value.executablePath ?? "",
    modelPath: value.modelPath ?? "",
    configPath: value.configPath ?? "",
    commandLine: value.commandLine ?? "",
    exists: Boolean(value.exists),
    source: value.source
  };
}

function saveEngineProfiles(profiles: EngineProfile[]) {
  window.localStorage.setItem(ENGINE_PROFILES_STORAGE_KEY, JSON.stringify(profiles));
}

function mergeEngineProfiles(existing: EngineProfile[], incoming: EngineProfile[]): EngineProfile[] {
  const map = new Map<string, EngineProfile>();
  for (const profile of [...existing, ...incoming].map(normalizeEngineProfile)) {
    const key = engineProfileKey(profile);
    if (!key) {
      continue;
    }
    map.set(key, { ...map.get(key), ...profile });
  }
  return Array.from(map.values());
}

function loadHiddenEngineProfileKeys(): Set<string> {
  try {
    const value = JSON.parse(window.localStorage.getItem(HIDDEN_ENGINE_PROFILE_KEYS) ?? "[]") as string[];
    return new Set(value.filter(Boolean));
  } catch {
    return new Set();
  }
}

function saveHiddenEngineProfileKey(profileKey: string) {
  if (!profileKey) {
    return;
  }
  const keys = loadHiddenEngineProfileKeys();
  keys.add(profileKey);
  window.localStorage.setItem(HIDDEN_ENGINE_PROFILE_KEYS, JSON.stringify(Array.from(keys)));
}

function filterHiddenEngineProfiles(profiles: EngineProfile[]): EngineProfile[] {
  const hiddenKeys = loadHiddenEngineProfileKeys();
  return profiles.filter((profile) => !hiddenKeys.has(engineProfileKey(profile)) && !isObsoleteWindowsEngineProfile(profile) && !isTransientAutoDetectedProfile(profile));
}

function engineProfileKey(profile: EngineProfile): string {
  if (profile.commandLine.trim() && !profile.executablePath.trim()) {
    return `manual:${profile.commandLine.trim().toLowerCase()}`;
  }
  const parts = [normalizeEnginePath(profile.executablePath), normalizeEnginePath(profile.modelPath), normalizeEnginePath(profile.configPath)];
  return parts.some(Boolean) ? parts.join("|") : "";
}

function normalizeEnginePath(path: string): string {
  return path.trim().replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

function isProtectedEngineProfile(profile: EngineProfile): boolean {
  const source = (profile.source ?? "").toLowerCase();
  return source.includes("内置") || source.includes("bundled") || source.includes("known windows") || source.includes("windows 已知") || source.includes("windows known");
}

function isObsoleteWindowsEngineProfile(profile: EngineProfile): boolean {
  const text = `${profile.name}\n${profile.executablePath}\n${profile.modelPath}\n${profile.configPath}`.toLowerCase();
  return text.includes("lizzie kataGo tensorrt".toLowerCase()) || text.includes("katago_tensorrt");
}

function isTransientAutoDetectedProfile(profile: EngineProfile): boolean {
  const source = (profile.source ?? "").toLowerCase();
  return (source.includes("常见安装目录") && !profile.exists) || source === "path" || source.includes("dev 环境");
}

function normalizeCandidateDisplayLimit(value: unknown): number {
  return Math.round(clampNumber(typeof value === "number" ? value : undefined, 1, 12, DEFAULT_CANDIDATE_DISPLAY_LIMIT));
}

function normalizeResearchExportSettings(value: Partial<ResearchExportSettings>): ResearchExportSettings {
  const legacyMarginX = (value as Partial<ResearchExportSettings> & { pageMarginXMm?: number }).pageMarginXMm;
  const legacyMarginY = (value as Partial<ResearchExportSettings> & { pageMarginYMm?: number }).pageMarginYMm;
  return {
    format: value.format === "html" ? "html" : "pdf",
    layoutVersion: value.layoutVersion === "0.2" ? "0.2" : "0.1",
    pageSize: value.pageSize === "a4" ? "a4" : "letter",
    pageOrientation: value.pageOrientation === "landscape" ? "landscape" : "portrait",
    boardSizeMm: clampNumber(value.boardSizeMm, 60, 160, DEFAULT_RESEARCH_EXPORT_SETTINGS.boardSizeMm),
    pageMarginTopMm: clampNumber(value.pageMarginTopMm ?? legacyMarginY, 4, 30, DEFAULT_RESEARCH_EXPORT_SETTINGS.pageMarginTopMm),
    pageMarginRightMm: clampNumber(value.pageMarginRightMm ?? legacyMarginX, 4, 30, DEFAULT_RESEARCH_EXPORT_SETTINGS.pageMarginRightMm),
    pageMarginBottomMm: clampNumber(value.pageMarginBottomMm ?? legacyMarginY, 4, 30, DEFAULT_RESEARCH_EXPORT_SETTINGS.pageMarginBottomMm),
    pageMarginLeftMm: clampNumber(value.pageMarginLeftMm ?? legacyMarginX, 4, 30, DEFAULT_RESEARCH_EXPORT_SETTINGS.pageMarginLeftMm),
    boardEdgeMarginPx: clampNumber(value.boardEdgeMarginPx, 18, 80, DEFAULT_RESEARCH_EXPORT_SETTINGS.boardEdgeMarginPx),
    variationsPerPage: Math.round(clampNumber(value.variationsPerPage, 1, 4, DEFAULT_RESEARCH_EXPORT_SETTINGS.variationsPerPage)),
    rowGapMm: clampNumber(value.rowGapMm, 0, 20, DEFAULT_RESEARCH_EXPORT_SETTINGS.rowGapMm),
    columnGapMm: clampNumber(value.columnGapMm, 0, 20, DEFAULT_RESEARCH_EXPORT_SETTINGS.columnGapMm),
    documentFontSizePt: clampNumber(value.documentFontSizePt, 10, 18, DEFAULT_RESEARCH_EXPORT_SETTINGS.documentFontSizePt)
  };
}

function buildResearchAnalysisSnapshot(
  summary: AutoAnalysisSummary | null,
  points: ReviewAnalysisPoint[],
  range: { startMove: number; endMove: number } | null,
  engineProfile: EngineProfile | null
): ResearchDocument["analysis"] {
  if (!summary || summary.analyzed <= 0) {
    return undefined;
  }
  const lastPoint = points.length > 0 ? points[points.length - 1] : null;
  const lastDetail = summary.details.length > 0 ? summary.details[summary.details.length - 1] : null;
  return {
    analyzed: summary.analyzed,
    analyzedAt: new Date().toISOString(),
    candidateMatches: summary.candidateMatches,
    details: summary.details,
    endMove: range?.endMove ?? lastPoint?.moveNumber ?? lastDetail?.moveNumber ?? summary.analyzed,
    engineName: engineProfile?.name,
    knownScoreLosses: summary.knownScoreLosses,
    knownWinrateLosses: summary.knownWinrateLosses,
    matches: summary.matches,
    modelName: engineProfile?.modelPath ? engineProfile.modelPath.split("/").pop() : undefined,
    points,
    startMove: range?.startMove ?? points[0]?.moveNumber ?? summary.details[0]?.moveNumber ?? 1,
    topMatches: summary.topMatches,
    totalMatchScore: summary.totalMatchScore,
    totalScoreLoss: summary.totalScoreLoss,
    totalWinrateLoss: summary.totalWinrateLoss
  };
}

function createAnalysisCompletionMarker(params: {
  analyzedMoves: number;
  endMove: number;
  parsed: ReturnType<typeof parseGameRecord>;
  profile: EngineProfile;
  settings: BatchAnalysisSettings;
  shouldStop: boolean;
  sourceFileName: string;
  startMove: number;
}): ResearchAnalysisCompletion | undefined {
  const totalMoves = params.parsed.moves.length;
  const isFullRange =
    totalMoves > 0 &&
    params.startMove === 1 &&
    params.endMove === totalMoves &&
    params.settings.includeBlack &&
    params.settings.includeWhite &&
    !params.shouldStop &&
    params.analyzedMoves === totalMoves;
  if (!isFullRange) {
    return undefined;
  }
  return {
    version: 1,
    complete: true,
    completedAt: new Date().toISOString(),
    startMove: params.startMove,
    endMove: params.endMove,
    totalMoves,
    analyzedMoves: params.analyzedMoves,
    engineName: params.profile.name,
    modelName: params.profile.modelPath ? params.profile.modelPath.split("/").pop() : undefined,
    sourceFileName: params.sourceFileName
  };
}

function readTsgAnalysisCompletion(content: string): ResearchAnalysisCompletion | null {
  try {
    const record = JSON.parse(content) as Record<string, unknown>;
    const tensugo = record.tensugo && typeof record.tensugo === "object" ? record.tensugo as Record<string, unknown> : {};
    const completion = tensugo.analysisCompletion ?? record.analysisCompletion;
    if (!completion || typeof completion !== "object") {
      return null;
    }
    const marker = completion as Partial<ResearchAnalysisCompletion>;
    if (marker.complete !== true) {
      return null;
    }
    return {
      version: marker.version === 1 ? 1 : 1,
      complete: true,
      completedAt: typeof marker.completedAt === "string" ? marker.completedAt : "",
      startMove: typeof marker.startMove === "number" ? marker.startMove : 1,
      endMove: typeof marker.endMove === "number" ? marker.endMove : 0,
      totalMoves: typeof marker.totalMoves === "number" ? marker.totalMoves : 0,
      analyzedMoves: typeof marker.analyzedMoves === "number" ? marker.analyzedMoves : 0,
      engineName: typeof marker.engineName === "string" ? marker.engineName : undefined,
      modelName: typeof marker.modelName === "string" ? marker.modelName : undefined,
      sourceFileName: typeof marker.sourceFileName === "string" ? marker.sourceFileName : undefined
    };
  } catch {
    return null;
  }
}

async function readExistingTsgAnalysisCompletion(path: string): Promise<ResearchAnalysisCompletion | null> {
  try {
    return readTsgAnalysisCompletion(await readTextFile(path));
  } catch {
    return null;
  }
}

function appendCandidateBlockForBatch(
  document: ResearchDocument,
  moveNumber: number,
  candidates: EngineCandidateMove[]
): ResearchDocument {
  const block = createCandidateMovesBlock(moveNumber, candidates);
  if (!block) {
    return document;
  }
  const existingBlock = document.sections
    .flatMap((section) => section.blocks)
    .find((item) => item.type === "candidate_moves" && item.moveNumber === moveNumber);
  return existingBlock ? replaceBlock(document, existingBlock.id, block) : appendBlock(document, block);
}

function createProblemSet(items: ProblemItem[], settings: BatchAnalysisSettings): ProblemSet {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    settings: {
      winrateLossThreshold: settings.winrateLossThreshold,
      candidateLimit: settings.candidateLimit,
      ...(settings.targetPlayer ? { targetPlayer: settings.targetPlayer } : {})
    },
    items
  };
}

function playerNameMatches(recordName: string, targetName: string): boolean {
  const normalize = (value: string) => value.trim().replace(/\s*\([^)]*\)\s*$/, "");
  const record = normalize(recordName).toLocaleLowerCase();
  const target = normalize(targetName).toLocaleLowerCase();
  return target.length > 0 && (record.includes(target) || target.includes(record));
}

function createProblemItem(params: {
  actualMoveName: string;
  candidateLimit: number;
  candidates: EngineCandidateMove[];
  color: "black" | "white";
  engineName?: string;
  modelName?: string;
  moveNumber: number;
  threshold: number;
  winrateLoss: number;
}): ProblemItem {
  const scoredCandidates = params.candidates.slice(0, params.candidateLimit).map((candidate, index) => ({
    moveName: candidate.moveName,
    rank: candidate.rank,
    score: index === 0 ? 10 : index === 1 ? 9 : index === 2 ? 8 : index === 3 ? 7 : 5,
    visits: candidate.visits,
    winrate: candidate.winrate,
    scoreLead: candidate.scoreLead,
    pv: candidate.pv
  }));
  return {
    id: createLocalId("problem"),
    moveNumber: params.moveNumber,
    color: params.color,
    actualMoveName: params.actualMoveName,
    trigger: {
      type: "winrateLoss",
      threshold: params.threshold,
      value: params.winrateLoss
    },
    prompt: `第 ${params.moveNumber} 手，${params.color === "black" ? "黑棋" : "白棋"}请选择更好的下法。`,
    fullScoreMove: scoredCandidates[0]?.moveName ?? "",
    candidateScores: scoredCandidates,
    analysis: {
      engineName: params.engineName,
      modelName: params.modelName,
      generatedAt: new Date().toISOString(),
      candidates: params.candidates
    }
  };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, numberValue));
}

function baseName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

function joinPath(directory: string, fileName: string): string {
  const separator = directory.includes("\\") ? "\\" : "/";
  return `${directory.replace(/[\\/]+$/, "")}${separator}${fileName}`;
}

function directoryName(path: string): string {
  const separatorIndex = path.lastIndexOf("/");
  return separatorIndex > 0 ? path.slice(0, separatorIndex) : "";
}

async function waitForRemainingMoveTime(
  moveStartedAt: number,
  secondsPerMove: number,
  stopRef: { current: boolean }
): Promise<void> {
  const remainingMs = Math.max(0, secondsPerMove * 1000 - (Date.now() - moveStartedAt));
  const stopCheckMs = 100;
  let waitedMs = 0;
  while (!stopRef.current && waitedMs < remainingMs) {
    const nextWait = Math.min(stopCheckMs, remainingMs - waitedMs);
    await new Promise((resolve) => window.setTimeout(resolve, nextWait));
    waitedMs += nextWait;
  }
}

function shouldContinueAutoAnalysisMove(
  moveStartedAt: number,
  secondsPerMove: number,
  targetVisits: number,
  bestCandidate: EngineCandidateMove | undefined
): boolean {
  if (!bestCandidate) {
    return Date.now() - moveStartedAt < AUTO_ANALYSIS_CANDIDATE_TIMEOUT_MS;
  }
  if (targetVisits > 0) {
    return bestCandidate.visits < targetVisits;
  }
  return Date.now() - moveStartedAt < secondsPerMove * 1000;
}

async function waitForAutoAnalysisPoll(stopRef: { current: boolean }): Promise<void> {
  const pollMs = 250;
  let waitedMs = 0;
  while (!stopRef.current && waitedMs < pollMs) {
    const nextWait = Math.min(50, pollMs - waitedMs);
    await new Promise((resolve) => window.setTimeout(resolve, nextWait));
    waitedMs += nextWait;
  }
}

async function waitWhileBatchPaused(
  pauseRef: { current: boolean },
  stopRef: { current: boolean }
): Promise<number> {
  if (!pauseRef.current) return 0;
  const startedAt = Date.now();
  while (pauseRef.current && !stopRef.current) {
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }
  return Date.now() - startedAt;
}

async function yieldToUi(): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, 0));
}

function createEmptyAutoAnalysisSummary(): AutoAnalysisSummary {
  return {
    analyzed: 0,
    candidateMatches: 0,
    details: [],
    knownScoreLosses: 0,
    knownWinrateLosses: 0,
    matches: 0,
    topMatches: 0,
    totalScoreLoss: 0,
    totalMatchScore: 0,
    totalWinrateLoss: 0
  };
}

function calculateScoreLoss(
  color: ReviewMove["color"],
  best: EngineCandidateMove,
  actual: EngineCandidateMove
): number {
  const loss = color === "black"
    ? best.scoreLead - actual.scoreLead
    : actual.scoreLead - best.scoreLead;
  return Math.max(0, loss);
}

function summarizeReportSide(details: AutoAnalysisMoveDetail[], color: "black" | "white") {
  const sideDetails = details.filter((detail) => detail.color === color);
  const analyzed = Math.max(1, sideDetails.length);
  const scoreLosses = sideDetails.filter((detail) => detail.scoreLoss !== null);
  const winrateLosses = sideDetails.filter((detail) => detail.winrateLoss !== null);
  return {
    averageScoreLoss: scoreLosses.length > 0
      ? scoreLosses.reduce((total, detail) => total + (detail.scoreLoss ?? 0), 0) / scoreLosses.length
      : null,
    averageWinrateLoss: winrateLosses.length > 0
      ? winrateLosses.reduce((total, detail) => total + (detail.winrateLoss ?? 0), 0) / winrateLosses.length
      : null,
    candidateRate: sideDetails.filter((detail) => detail.rank !== null).length / analyzed,
    matchRate: sideDetails.filter((detail) => detail.isMatch).length / analyzed,
    matchDegree: sideDetails.reduce((total, detail) => total + detail.matchScore, 0) / analyzed,
    topRate: sideDetails.filter((detail) => detail.rank === 1).length / analyzed
  };
}

function buildLossBuckets(
  details: AutoAnalysisMoveDetail[],
  field: "scoreLoss" | "winrateLoss",
  thresholds: number[]
): LossBucket[] {
  const labels = [`<${thresholds[0]}`];
  for (let index = 1; index < thresholds.length; index += 1) {
    labels.push(`${thresholds[index - 1]}-${thresholds[index]}`);
  }
  labels.push(`>=${thresholds[thresholds.length - 1]}`);
  const counts = labels.map(() => 0);
  details.forEach((detail) => {
    const value = detail[field];
    if (value === null) {
      return;
    }
    const bucketIndex = thresholds.findIndex((threshold) => value < threshold);
    counts[bucketIndex >= 0 ? bucketIndex : counts.length - 1] += 1;
  });
  return labels.map((label, index) => ({ count: counts[index], label }));
}

function scaleLossBar(value: number | null): number {
  if (value === null) {
    return 0;
  }
  return Math.min(1, value / 12);
}

function formatFixed(value: number, digits: number): string {
  if (!Number.isFinite(value)) {
    return "0.0";
  }
  return value.toFixed(digits);
}

function formatOptionalNumber(value: number | null, suffix: string): string {
  if (value === null || !Number.isFinite(value)) {
    return "暂缺";
  }
  return `${value.toFixed(1)}${suffix}`;
}

function moveNumberDisplayLabel(mode: MoveNumberDisplayMode): string {
  if (mode === "all") {
    return "全部显示";
  }
  if (mode === "last10") {
    return "显示最后10手";
  }
  return "显示最后一手";
}

function createLocalId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function inferVariationBaseMoveNumber(moves: ReviewMove[], sourceMainLineMoves: ReviewMove[]): number | null {
  if (moves.length === 0 || sourceMainLineMoves.length === 0) {
    return null;
  }
  const maxSharedLength = Math.min(moves.length, sourceMainLineMoves.length);
  for (let index = 0; index < maxSharedLength; index += 1) {
    if (!sameMove(moves[index], sourceMainLineMoves[index])) {
      return index;
    }
  }
  if (moves.length > sourceMainLineMoves.length) {
    return sourceMainLineMoves.length;
  }
  if (moves.length < sourceMainLineMoves.length) {
    return null;
  }
  return null;
}

function movesMatchPrefix(moves: ReviewMove[], prefix: ReviewMove[], prefixLength: number): boolean {
  if (moves.length < prefixLength || prefix.length < prefixLength) {
    return false;
  }
  for (let index = 0; index < prefixLength; index += 1) {
    if (!sameMove(moves[index], prefix[index])) {
      return false;
    }
  }
  return true;
}

function extendMainLinePreservingBranches(
  tree: GameTree,
  previousMainLine: ReviewMove[],
  nextMainLine: ReviewMove[],
  boardSize: number,
  komi: number
): GameTree {
  if (tree.boardSize !== boardSize || !movesMatchPrefix(nextMainLine, previousMainLine, previousMainLine.length)) {
    return createGameTreeFromMoves(nextMainLine, boardSize, komi);
  }

  const existingMainLine = mainLineMovesFromTree(tree);
  if (nextMainLine.length < existingMainLine.length) {
    return createGameTreeFromMoves(nextMainLine, boardSize, komi);
  }
  if (!movesMatchPrefix(existingMainLine, previousMainLine, previousMainLine.length)) {
    return createGameTreeFromMoves(nextMainLine, boardSize, komi);
  }

  let nextTree = tree;
  let parentNodeId = findMainLineEndNodeId(nextTree);
  for (const move of nextMainLine.slice(existingMainLine.length)) {
    const result = appendMoveToGameTree(nextTree, parentNodeId, {
      color: move.color,
      point: { col: move.x, row: move.y }
    });
    nextTree = result.tree;
    parentNodeId = result.nodeId;
  }

  return {
    ...nextTree,
    boardSize,
    komi
  };
}

function sameMove(left: ReviewMove, right: ReviewMove): boolean {
  return left.color === right.color && left.x === right.x && left.y === right.y;
}

function summarizeEngineFailure(status: string, diagnostics: string): string {
  if (status === "engine-boot-timeout" || diagnostics.includes("GTP ready 信号")) {
    return "KataGo 启动超时（首次 OpenCL 调优可能需要几分钟）";
  }
  if (status === "engine-tuning-timeout" || diagnostics.includes("Performing autotuning")) {
    return "KataGo 首次 OpenCL 调优未完成";
  }
  if (diagnostics.includes("Error creating directory: KataGoData") || diagnostics.includes("无法创建 KataGo 运行目录")) {
    return "KataGo 运行目录不可写";
  }
  if (diagnostics.includes("CL_INVALID_VALUE") || diagnostics.includes("OpenCL error")) {
    return "KataGo OpenCL 初始化失败：CL_INVALID_VALUE";
  }
  if (status === "engine-crashed" || status === "engine-exited-during-boot" || status === "engine-exited-during-analysis") {
    return "KataGo 进程异常退出";
  }
  if (status === "no-candidates") {
    return "KataGo 没有输出候选点";
  }
  return diagnostics.split("\n").find((line) => line.trim().length > 0)?.trim() || status;
}

function hasEngineProblem(status: string): boolean {
  return /失败|异常|退出|不可写|未完成|没有输出|没有返回|不完整|未配置/.test(status);
}

function buildAnalysisDiagnostics(rawOutput: string, diagnostics: string): string {
  const sections = [];
  if (diagnostics.trim()) {
    sections.push(`stderr:\n${diagnostics.trim()}`);
  }
  if (rawOutput.trim()) {
    sections.push(`stdout:\n${summarizeEngineStdout(rawOutput)}`);
  }
  return sections.join("\n\n") || "KataGo 没有返回 stdout/stderr。";
}

function summarizeEngineStdout(rawOutput: string): string {
  const candidateBlocks = rawOutput.match(/\binfo move\b/g)?.length ?? 0;
  const protocolLines = rawOutput
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.includes("info move"));
  const lines = protocolLines.length > 0 ? protocolLines : ["GTP protocol replies received."];
  if (candidateBlocks > 0) {
    lines.push(`已隐藏 ${candidateBlocks} 段候选点明细；候选点请看棋盘和右侧列表。`);
  }
  return lines.slice(-40).join("\n");
}

function formatVisits(visits: number): string {
  if (visits >= 1000) {
    return `${(visits / 1000).toFixed(visits >= 10000 ? 0 : 1)}k`;
  }
  return String(visits);
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) {
    return "0.0%";
  }
  return `${(value * 100).toFixed(1)}%`;
}

function moveToGtpPoint(move: ReviewMove, boardSize: number): string {
  const labels = "ABCDEFGHJKLMNOPQRSTUVWXYZ";
  return `${labels[move.x]}${boardSize - move.y}`;
}

function gtpPointToMove(point: string, boardSize: number, moveNumber: number): ReviewMove | null {
  if (!point || point.toLowerCase() === "pass") {
    return null;
  }
  const match = /^([A-HJ-Z])(\d+)$/i.exec(point);
  if (!match) {
    return null;
  }
  const labels = "ABCDEFGHJKLMNOPQRSTUVWXYZ";
  const x = labels.indexOf(match[1].toUpperCase());
  const row = Number(match[2]);
  const y = boardSize - row;
  if (x < 0 || x >= boardSize || !Number.isInteger(row) || y < 0 || y >= boardSize) {
    return null;
  }
  return {
    color: moveNumber % 2 === 1 ? "black" : "white",
    moveNumber,
    x,
    y
  };
}

function buildAnalysisKey(boardSize: number, komi: number, moveNumber: number, moves: ReviewMove[]): string {
  const tail = moves.map((move) => `${move.moveNumber}:${move.color}:${move.x},${move.y}`).join("|");
  return `${boardSize}:${komi}:${moveNumber}:${tail}`;
}

function toBlackWinrate(winrate: number, nextColor: "black" | "white"): number {
  return nextColor === "black" ? winrate : 100 - winrate;
}

function upsertAnalysisPoint(points: ReviewAnalysisPoint[], nextPoint: ReviewAnalysisPoint): ReviewAnalysisPoint[] {
  const nextPoints = points.filter((point) => point.moveNumber !== nextPoint.moveNumber);
  nextPoints.push(nextPoint);
  nextPoints.sort((a, b) => a.moveNumber - b.moveNumber);
  return nextPoints;
}
