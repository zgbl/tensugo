import { useRef } from "react";
import { HUMAN_ENGINE_LEVELS } from "../engine/humanEngineLevels";
import type { EngineMode, HumanEngineLevel } from "../engine/types";
import type { Translator } from "../i18n";
import type { OgsConnectionStatus } from "../ogs/types";

type TopToolbarProps = {
  appMode: AppMode;
  engineMode: EngineMode;
  humanEngineAvailable: boolean;
  humanEngineLevel: HumanEngineLevel;
  boardPixelSize: number;
  hasSavedAnalysis: boolean;
  title: string;
  komi: number;
  ogsDetail?: string;
  ogsSourceLabel?: string;
  ogsStatus: OgsConnectionStatus;
  showSavedAnalysis: boolean;
  showVariationNumbers: boolean;
  onAddVariation: () => void;
  onExportPdf: () => void;
  onKomiChange: (value: number) => void;
  onOpenAutoAnalysis: () => void;
  onOpenBatchAnalysis: () => void;
  onOpenAbout: () => void;
  onOpenDocument?: () => void;
  onOpenFile: (file: File) => void;
  onOpenOgsBrowser: () => void;
  onOpenOgsUrl: () => void;
  onOgsDisconnect: () => void;
  onOgsRefresh: () => void;
  onNewGame: () => void;
  onOpenSettings: () => void;
  onOpenTianshuReport: () => void;
  onAppModeChange: (mode: AppMode) => void;
  onEngineModeChange: (mode: EngineMode) => void;
  onHumanLevelChange: (level: HumanEngineLevel) => void;
  onOpenHumanPlay: () => void;
  onSaveResearch: () => void;
  onShowVariationNumbersChange: (enabled: boolean) => void;
  onToggleSavedAnalysis: () => void;
  onToggleAnalysis: () => void;
  isAnalysisEnabled: boolean;
  isAutoAnalyzing: boolean;
  canResumeAutoAnalysis: boolean;
  onAutoAnalyze: () => void;
  onFinishAutoAnalysis: () => void;
  onPromoteBranch: () => void;
  onReturnToMainBranch: () => void;
  onDeleteBranch: () => void;
  t: Translator;
};

export type AppMode = "review" | "research" | "problem-create" | "problem-solve";

const tools = [
  { key: "new", title: "New", icon: <NewIcon /> },
  { key: "open", title: "Open", icon: <OpenIcon /> },
  { key: "save", title: "Save", icon: <SaveIcon /> },
  { key: "undo", title: "Undo", text: "↶" },
  { key: "redo", title: "Redo", text: "↷" },
  { key: "previous", title: "Previous", text: "◀" },
  { key: "black", title: "Black", text: "●" },
  { key: "white", title: "White", text: "○" },
  { key: "swap", title: "Swap", text: "↔" }
] as const;

export function TopToolbar({
  appMode,
  engineMode,
  humanEngineAvailable,
  humanEngineLevel,
  boardPixelSize: _boardPixelSize,
  hasSavedAnalysis,
  title,
  komi,
  ogsDetail,
  ogsSourceLabel,
  ogsStatus,
  showSavedAnalysis,
  showVariationNumbers,
  onAddVariation,
  onExportPdf,
  onKomiChange,
  onOpenAutoAnalysis,
  onOpenBatchAnalysis,
  onOpenAbout,
  onOpenDocument,
  onOpenFile,
  onOpenOgsBrowser,
  onOpenOgsUrl,
  onOgsDisconnect,
  onOgsRefresh,
  onNewGame,
  onOpenSettings,
  onOpenTianshuReport,
  onAppModeChange,
  onEngineModeChange,
  onHumanLevelChange,
  onOpenHumanPlay,
  onSaveResearch,
  onShowVariationNumbersChange,
  onToggleSavedAnalysis,
  onToggleAnalysis,
  isAnalysisEnabled,
  isAutoAnalyzing,
  canResumeAutoAnalysis,
  onAutoAnalyze,
  onFinishAutoAnalysis,
  onPromoteBranch,
  onReturnToMainBranch,
  onDeleteBranch,
  t
}: TopToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const openDocument = onOpenDocument ?? (() => fileInputRef.current?.click());
  const handleKomiChange = (value: string) => {
    const nextKomi = Number(value);
    if (Number.isFinite(nextKomi)) {
      onKomiChange(nextKomi);
    }
  };

  return (
    <header className={`top-region ${appMode === "problem-solve" ? "problem-solve-top-region" : ""}`}>
      <div className="menu-bar">
        <strong>{title}</strong>
        <Menu label={t("menuFile")} items={[
          { label: t("newBoard"), action: onNewGame },
          { label: t("openDocument"), action: openDocument },
          { label: t("saveBrg"), action: onSaveResearch },
          { label: "导出PDF", action: onExportPdf }
        ]} />
        <Menu label="观战" items={[
          { label: "OGS...", action: onOpenOgsBrowser },
          { separator: true },
          { label: "Open OGS URL...", action: onOpenOgsUrl },
          { label: "Recent OGS", action: () => undefined },
          { separator: true },
          { label: "Fox（未来）", action: () => undefined },
          { label: "弈客（未来）", action: () => undefined },
          { label: "KGS（未来）", action: () => undefined }
        ]} />
        <Menu label={t("menuView")} items={[
          { label: showVariationNumbers ? t("hideVariationNumbers") : t("showVariationNumbers"), action: () => onShowVariationNumbersChange(!showVariationNumbers) },
          { label: t("reviewMode"), action: () => onAppModeChange("review") },
          { label: t("researchMode"), action: () => onAppModeChange("research") },
          { label: "出题", action: () => onAppModeChange("problem-create") },
          { label: "做题", action: () => onAppModeChange("problem-solve") }
        ]} />
        <Menu label={t("menuAnalysis")} items={[
          { label: t("aiAnalyzePause"), action: onToggleAnalysis },
          { label: t("autoAnalysis"), action: onOpenAutoAnalysis },
          { label: "批量分析 / 出题", action: onOpenBatchAnalysis },
          { label: t("tianshuReport"), action: onOpenTianshuReport },
          { label: t("engineSettings"), action: onOpenSettings }
        ]} />
        <Menu label="对弈" items={[
          { label: "人机对弈...", action: onOpenHumanPlay }
        ]} />
        <Menu label={t("menuEdit")} items={[
          { label: t("insertVariation"), action: onAddVariation }
        ]} />
        <Menu label={t("menuSettings")} items={[
          { label: t("preferences"), action: onOpenSettings }
        ]} />
        <Menu label="Help" items={[
          { label: "About TensuGo / 关于 TensuGo", action: onOpenAbout }
        ]} />
      </div>
      <div className="top-toolbar">
        <nav className="tool-button-group" aria-label="Primary commands">
          {tools.map((tool) => (
            <button
              type="button"
              key={tool.key}
              className={`tool-button ${"icon" in tool ? "tool-button-icon" : ""}`}
              onClick={
                tool.key === "open"
                  ? openDocument
                  : tool.key === "new"
                    ? onNewGame
                    : tool.key === "save"
                      ? onSaveResearch
                    : undefined
              }
              title={tool.title}
              aria-label={tool.title}
            >
              {"icon" in tool ? tool.icon : tool.text}
            </button>
          ))}
          <input
            ref={fileInputRef}
            className="file-input"
            type="file"
            accept=".sgf,.gib,.tsg,.brg,.json,.brg.json,.txt,application/json,application/x-go-sgf,text/plain"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                onOpenFile(file);
              }
              event.currentTarget.value = "";
            }}
          />
        </nav>
        <div className="parameter-strip">
          <div className="toolbar-group top-action-group" aria-label="Analysis and branch controls">
            <CompactAction icon="↔" label={t("sync")} />
            <CompactAction icon={isAnalysisEnabled ? "Ⅱ" : "AI"} label={isAnalysisEnabled ? t("pauseAnalysis") : t("aiAnalysis")} onClick={onToggleAnalysis} />
            <CompactAction icon="⟳" label={isAutoAnalyzing ? t("pauseAnalysis") : canResumeAutoAnalysis ? t("continueAnalysis") : t("autoAnalysis")} onClick={onAutoAnalyze} />
            {(isAutoAnalyzing || canResumeAutoAnalysis) ? <CompactAction icon="✓" label={t("finishAnalysis")} onClick={onFinishAutoAnalysis} /> : null}
            <CompactAction icon="◉" label={t("pureNetwork")} />
            <CompactAction icon="★" label={t("setMainBranch")} onClick={onPromoteBranch} />
            <CompactAction icon="↩" label={t("returnMainBranch")} onClick={onReturnToMainBranch} />
            <CompactAction icon="⌫" label={t("delete")} onClick={onDeleteBranch} />
            <CompactAction icon="⌖" label={t("jump")} />
          </div>
          <label>{t("komi")} <input type="number" step="0.5" value={komi} onChange={(event) => handleKomiChange(event.target.value)} /></label>
          <button
            type="button"
            className={`toolbar-toggle toolbar-icon-only ${showVariationNumbers ? "active" : ""}`}
            onClick={() => onShowVariationNumbersChange(!showVariationNumbers)}
            title={showVariationNumbers ? t("showVariationNumbers") : t("hideVariationNumbers")}
          >
            <span className="toolbar-symbol" aria-hidden="true">⑂</span><span className="toolbar-label">{t("branchNumbers")}</span>
          </button>
          <button type="button" className="toolbar-toggle toolbar-icon-only" onClick={onOpenTianshuReport} title={t("tianshuReport")} aria-label={t("tianshuReport")}>
            <span className="toolbar-symbol" aria-hidden="true">▤</span><span className="toolbar-label">{t("tianshuReport")}</span>
          </button>
          <label className="mode-select-label app-mode-select">
            模式
            <select value={appMode} onChange={(event) => onAppModeChange(event.target.value as AppMode)}>
              <option value="review">{t("reviewMode")}</option>
              <option value="research">{t("researchMode")}</option>
              <option value="problem-create">出题</option>
              <option value="problem-solve">做题</option>
            </select>
          </label>
          <label className="mode-select-label engine-mode-select" title={humanEngineAvailable ? "切换正常分析或拟人分析" : "请先在设置中配置 Human Model 和 Human 配置"}>
            引擎
            <select value={engineMode} onChange={(event) => onEngineModeChange(event.target.value as EngineMode)}>
              <option value="normal">正常</option>
              <option value="human" disabled={!humanEngineAvailable}>拟人</option>
            </select>
          </label>
          {engineMode === "human" ? (
            <label className="mode-select-label" title="拟人引擎棋力档位">
              棋力
              <select value={humanEngineLevel} onChange={(event) => onHumanLevelChange(event.target.value as HumanEngineLevel)}>
                {HUMAN_ENGINE_LEVELS.map((level) => <option key={level} value={level}>{level.toUpperCase()}</option>)}
              </select>
            </label>
          ) : null}
          <button type="button" className="toolbar-toggle toolbar-icon-only" onClick={onOpenHumanPlay} title="人机对弈" aria-label="人机对弈">
            <span className="toolbar-symbol" aria-hidden="true">⚔</span><span className="toolbar-label">人机对弈</span>
          </button>
          <label><input type="checkbox" defaultChecked /> {t("countStones")}</label>
          <label>{t("aggressiveness")} <input value="0" readOnly /></label>
          <label>{t("breadth")} <input value="0.04" readOnly /></label>
          <label><input type="checkbox" defaultChecked /> {t("candidates")}</label>
          <label><input type="checkbox" defaultChecked /> {t("black")}</label>
          <label><input type="checkbox" defaultChecked /> {t("white")}</label>
          <label className="tsg-analysis-toggle">
            <input
              type="checkbox"
              checked={showSavedAnalysis}
              disabled={!hasSavedAnalysis}
              onChange={onToggleSavedAnalysis}
            /> TSG分析
          </label>
          {ogsSourceLabel ? (
            <div className={`ogs-toolbar-status ogs-toolbar-status-${ogsStatus}`} title={ogsDetail ?? ogsStatus}>
              <strong>{ogsSourceLabel}</strong>
              <span>{ogsStatus}</span>
              <button type="button" title="Refresh OGS" onClick={onOgsRefresh} aria-label="Refresh OGS">↻</button>
              <button type="button" title="Disconnect OGS" onClick={onOgsDisconnect} aria-label="Disconnect OGS">×</button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function CompactAction({ icon, label, onClick }: { icon: string; label: string; onClick?: () => void }) {
  return <button type="button" className="toolbar-toggle toolbar-icon-only top-action-button" title={label} aria-label={label} onClick={onClick}><span className="toolbar-symbol" aria-hidden="true">{icon}</span></button>;
}

function NewIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 3.5h8.4L19 8.1v12.4H6V3.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M14 3.8V8h4.2M12.5 11v6M9.5 14h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function OpenIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.8 19.5h16.4V8.7H11L9.2 5.5H3.8v14Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 11.2h14.5l-1.7 8.3H3.8L5 11.2Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 4h12.2L20 6.8V20H5V4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 4.5v5h8v-5M8.2 20v-6.2h7.6V20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

type MenuItem = { label: string; action: () => void } | { separator: true };

function Menu({ label, items }: { label: string; items: MenuItem[] }) {
  return (
    <div className="menu-root">
      <button type="button" className="menu-button" title={label} aria-label={label}>{label}</button>
      <div className="menu-popover">
        {items.map((item, index) =>
          "separator" in item ? (
            <div className="menu-separator" key={`separator-${index}`} />
          ) : (
            <button type="button" key={item.label} title={item.label} aria-label={item.label} onClick={item.action}>
              {item.label}
            </button>
          )
        )}
      </div>
    </div>
  );
}
