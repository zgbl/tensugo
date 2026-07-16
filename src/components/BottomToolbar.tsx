import type { MoveNumberDisplayMode } from "../board/BoardPlaceholder";
import { isTauriRuntime } from "../engine/tauriEngine";
import type { Translator } from "../i18n";

function navigation(t: Translator) {
  return [
  {
    key: "first", title: t("navFirst"), icon: (
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 2L4 12L22 22ZM2 2h3v20H2Z" /></svg>
    )
  },
  {
    key: "back10", title: t("navBack10"), icon: (
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 2L6 12L18 22ZM11 2L1 12L11 22Z" /></svg>
    )
  },
  {
    key: "back1", title: t("navBack1"), icon: (
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2L2 12L20 22Z" /></svg>
    )
  },
  {
    key: "next1", title: t("navNext1"), icon: (
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 2L22 12L4 22Z" /></svg>
    )
  },
  {
    key: "next10", title: t("navNext10"), icon: (
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 2L18 12L6 22ZM13 2L23 12L13 22Z" /></svg>
    )
  },
  {
    key: "last", title: t("navLast"), icon: (
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 2L17 12L3 22ZM19 2h3v20h-3Z" /></svg>
    )
  }
  ];
}

type BottomToolbarProps = {
  isAutoAnalyzing: boolean;
  canResumeAutoAnalysis: boolean;
  coordinateLabelsVisible: boolean;
  currentMoveNumber: number;
  engineStatus: string;
  isAnalysisEnabled: boolean;
  isAnalyzing: boolean;
  moveNumberDisplay: MoveNumberDisplayMode;
  totalMoves: number;
  statusText: string;
  onAnalysisToggle: () => void;
  onAutoAnalyze: () => void;
  onDeleteBranch: () => void;
  onFinishAutoAnalysis: () => void;
  onJump: (moveNumber: number) => void;
  onPromoteBranch: () => void;
  onReturnToMainBranch: () => void;
  onToggleCoordinates: () => void;
  onToggleMoveNumbers: () => void;
  t: Translator;
};

export function BottomToolbar({
  isAutoAnalyzing,
  canResumeAutoAnalysis,
  coordinateLabelsVisible,
  currentMoveNumber,
  engineStatus,
  isAnalysisEnabled,
  isAnalyzing,
  moveNumberDisplay,
  totalMoves,
  statusText,
  onAnalysisToggle,
  onAutoAnalyze,
  onDeleteBranch,
  onFinishAutoAnalysis,
  onJump,
  onPromoteBranch,
  onReturnToMainBranch,
  onToggleCoordinates,
  onToggleMoveNumbers,
  t
}: BottomToolbarProps) {
  const actions: Record<string, () => void> = {
    first: () => onJump(0),
    back10: () => onJump(currentMoveNumber - 10),
    back1: () => onJump(currentMoveNumber - 1),
    next1: () => onJump(currentMoveNumber + 1),
    next10: () => onJump(currentMoveNumber + 10),
    last: () => onJump(totalMoves)
  };

  const handleAnalysisToggle = () => {
    if (!isTauriRuntime()) {
      alert(t("noDesktopAnalysis"));
      return;
    }
    onAnalysisToggle();
  };

  return (
    <footer className="bottom-toolbar" aria-label="Board and analysis controls">
      <div className="toolbar-group toolbar-group-status">
        <span className="move-counter">{t("moveCounterPrefix")} {currentMoveNumber} {t("moveCounterMiddle")} {totalMoves} {t("moveCounterSuffix")}</span>
        <span className={`engine-toolbar-state ${isAnalyzing ? "running" : ""}`}>
          {isAnalyzing ? t("aiAnalyzing") : engineStatus}
        </span>
        <span className="toolbar-status">{statusText}</span>
      </div>
    </footer>
  );
}

export function BoardNavigationToolbar({ currentMoveNumber, totalMoves, onJump, t, coordinateLabelsVisible, moveNumberDisplay, onToggleCoordinates, onToggleMoveNumbers }: Pick<BottomToolbarProps, "currentMoveNumber" | "totalMoves" | "onJump" | "t" | "coordinateLabelsVisible" | "moveNumberDisplay" | "onToggleCoordinates" | "onToggleMoveNumbers">) {
  const actions: Record<string, () => void> = {
    first: () => onJump(0), back10: () => onJump(currentMoveNumber - 10), back1: () => onJump(currentMoveNumber - 1),
    next1: () => onJump(currentMoveNumber + 1), next10: () => onJump(currentMoveNumber + 10), last: () => onJump(totalMoves)
  };
  return <div className="board-navigation-toolbar" aria-label="棋盘操作">
    {navigation(t).map((item) => <button type="button" key={item.key} className="nav-button nav-button-wide" title={item.title} aria-label={item.title} onClick={actions[item.key]}>{item.icon}</button>)}
    <button type="button" className="toolbar-icon-button board-view-button" title={t("scoreJudgement")} aria-label={t("scoreJudgement")}><span className="toolbar-symbol" aria-hidden="true">⚖</span></button>
    <button type="button" className="view-toggle-button board-view-button" title={`${t("moveNumbers")}：${moveNumberDisplayLabel(moveNumberDisplay, t)}`} aria-label={`${t("moveNumbers")}：${moveNumberDisplayLabel(moveNumberDisplay, t)}`} onClick={onToggleMoveNumbers}><span className="toolbar-symbol" aria-hidden="true">#</span>{t("moveNumbers")}：{moveNumberDisplayLabel(moveNumberDisplay, t)}</button>
    <button type="button" className={`view-toggle-button board-view-button ${coordinateLabelsVisible ? "active-command" : ""}`} title={`${t("coordinates")}：${coordinateLabelsVisible ? t("visible") : t("hidden")}`} aria-label={`${t("coordinates")}：${coordinateLabelsVisible ? t("visible") : t("hidden")}`} onClick={onToggleCoordinates}><span className="toolbar-symbol" aria-hidden="true">⌗</span>{t("coordinates")}：{coordinateLabelsVisible ? t("visible") : t("hidden")}</button>
  </div>;
}

function moveNumberDisplayLabel(mode: MoveNumberDisplayMode, t: Translator): string {
  if (mode === "all") {
    return t("all");
  }
  if (mode === "last10") {
    return t("last10");
  }
  return t("last");
}
