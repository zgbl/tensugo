import { useRef, useState, type CSSProperties } from "react";
import { EngineConfigPanel } from "./EngineConfigPanel";
import type { EngineMode, EngineProfile, HumanEngineLevel } from "../engine/types";
import { LANGUAGE_OPTIONS, type AppLanguage, type Translator } from "../i18n";
import type { ResearchExportSettings } from "../research/renderHtml";
import type { CandidateBubbleLines } from "../board/BoardPlaceholder";

type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

type SettingsDialogProps = {
  candidateBubbleLines: CandidateBubbleLines;
  candidateDisplayLimit: number;
  problemThresholdSettings: {
    winrateLossThreshold: number | null;
    scoreLossThreshold: number | null;
    thresholdCombination: "and" | "or";
    problemType: "A" | "B";
    candidateCount: number;
    humanLevelOffset: number;
    humanCandidateCount: number;
  };
  engineDiagnostics: string;
  engineProfiles: EngineProfile[];
  engineStatus: string;
  exportSettings: ResearchExportSettings;
  isAnalyzing: boolean;
  language: AppLanguage;
  selectedEngineProfileIndex: number;
  onAnalyze: () => void;
  onClose: () => void;
  onCandidateBubbleLinesChange: (value: CandidateBubbleLines) => void;
  onCandidateDisplayLimitChange: (value: number) => void;
  onProblemThresholdSettingsChange: (value: SettingsDialogProps["problemThresholdSettings"]) => void;
  onExportSettingsChange: (patch: Partial<ResearchExportSettings>) => void;
  onLanguageChange: (language: AppLanguage) => void;
  onAutoDetect: () => void;
  onChoosePath: (kind: "engine" | "model" | "config" | "human-model" | "human-config") => void;
  onEngineModeChange: (mode: EngineMode) => void;
  onHumanLevelChange: (level: HumanEngineLevel) => void;
  onDeleteProfile: (profileIndex: number) => void;
  onManualProfileAdd: (commandLine: string) => void;
  onMoveProfile: (profileIndex: number, direction: "up" | "down") => void;
  onProbe: () => void;
  onProfileChange: (profile: EngineProfile) => void;
  onResetProfile: () => void;
  onCreateProfile: () => void;
  onUpdateProfile: (profileIndex: number) => void;
  onSelectProfile: (profileIndex: number) => void;
  onSetDefaultProfile: () => void;
  open: boolean;
  profile: EngineProfile | null;
  t: Translator;
};

export function SettingsDialog({
  candidateBubbleLines,
  candidateDisplayLimit,
  problemThresholdSettings,
  engineDiagnostics,
  engineProfiles,
  engineStatus,
  exportSettings,
  isAnalyzing,
  language,
  selectedEngineProfileIndex,
  onAnalyze,
  onClose,
  onCandidateBubbleLinesChange,
  onCandidateDisplayLimitChange,
  onProblemThresholdSettingsChange,
  onExportSettingsChange,
  onLanguageChange,
  onAutoDetect,
  onChoosePath,
  onEngineModeChange,
  onHumanLevelChange,
  onDeleteProfile,
  onManualProfileAdd,
  onMoveProfile,
  onProbe,
  onProfileChange,
  onResetProfile,
  onCreateProfile,
  onSelectProfile,
  onSetDefaultProfile,
  onUpdateProfile,
  open,
  profile,
  t
}: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<"engine" | "export" | "interface" | "analysis" | "problem" | "language">("engine");
  const [dialogOffset, setDialogOffset] = useState({ x: 0, y: 0 });
  const [dialogSize, setDialogSize] = useState({ height: 780, width: 980 });
  const dragStartRef = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null);
  const resizeStartRef = useRef<{
    direction: ResizeDirection;
    height: number;
    pointerX: number;
    pointerY: number;
    width: number;
    x: number;
    y: number;
  } | null>(null);

  const startDrag = (event: React.MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("button")) {
      return;
    }
    dragStartRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      x: dialogOffset.x,
      y: dialogOffset.y
    };
    const handleMove = (moveEvent: MouseEvent) => {
      const start = dragStartRef.current;
      if (!start) {
        return;
      }
      setDialogOffset({
        x: start.x + moveEvent.clientX - start.pointerX,
        y: start.y + moveEvent.clientY - start.pointerY
      });
    };
    const handleUp = () => {
      dragStartRef.current = null;
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  const startResize = (direction: ResizeDirection, event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    resizeStartRef.current = {
      direction,
      height: dialogSize.height,
      pointerX: event.clientX,
      pointerY: event.clientY,
      width: dialogSize.width,
      x: dialogOffset.x,
      y: dialogOffset.y
    };
    const handleMove = (moveEvent: MouseEvent) => {
      const start = resizeStartRef.current;
      if (!start) {
        return;
      }
      const dx = moveEvent.clientX - start.pointerX;
      const dy = moveEvent.clientY - start.pointerY;
      const resizeLeft = start.direction.includes("w");
      const resizeRight = start.direction.includes("e");
      const resizeTop = start.direction.includes("n");
      const resizeBottom = start.direction.includes("s");
      const nextWidth = clamp(start.width + (resizeRight ? dx : 0) - (resizeLeft ? dx : 0), 620, window.innerWidth - 24);
      const nextHeight = clamp(start.height + (resizeBottom ? dy : 0) - (resizeTop ? dy : 0), 420, window.innerHeight - 24);
      setDialogSize({ height: nextHeight, width: nextWidth });
      setDialogOffset({
        x: resizeLeft ? start.x + start.width - nextWidth : start.x,
        y: resizeTop ? start.y + start.height - nextHeight : start.y
      });
    };
    const handleUp = () => {
      resizeStartRef.current = null;
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  const dialogStyle: CSSProperties = {
    height: dialogSize.height,
    transform: `translate(${dialogOffset.x}px, ${dialogOffset.y}px)`,
    width: dialogSize.width
  };

  if (!open) {
    return null;
  }

  return (
    <div className="settings-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-label={t("settings")}
        aria-modal="true"
        className="settings-dialog"
        role="dialog"
        style={dialogStyle}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="settings-dialog-header" onMouseDown={startDrag}>
          <h2>{t("settings")}</h2>
          <button type="button" onClick={onClose}>{t("close")}</button>
        </header>
        <div className="settings-dialog-body">
          <nav className="settings-tabs" aria-label={t("settings")}>
            <button type="button" className={activeTab === "engine" ? "active" : ""} onClick={() => setActiveTab("engine")}>{t("engine")}</button>
            <button type="button" className={activeTab === "export" ? "active" : ""} onClick={() => setActiveTab("export")}>{t("exportSettings")}</button>
            <button type="button" className={activeTab === "interface" ? "active" : ""} onClick={() => setActiveTab("interface")}>{t("interface")}</button>
            <button type="button" className={activeTab === "language" ? "active" : ""} onClick={() => setActiveTab("language")}>{t("language")}</button>
            <button type="button" className={activeTab === "analysis" ? "active" : ""} onClick={() => setActiveTab("analysis")}>{t("menuAnalysis")}</button>
            <button type="button" className={activeTab === "problem" ? "active" : ""} onClick={() => setActiveTab("problem")}>出题</button>
            <button type="button" disabled>{t("gameRecord")}</button>
          </nav>
          {activeTab === "engine" ? (
            <EngineConfigPanel
              diagnostics={engineDiagnostics}
              engineStatus={engineStatus}
              profiles={engineProfiles}
              selectedProfileIndex={selectedEngineProfileIndex}
              isAnalyzing={isAnalyzing}
              profile={profile}
              onAnalyze={onAnalyze}
              onAutoDetect={onAutoDetect}
              onChoosePath={onChoosePath}
              onEngineModeChange={onEngineModeChange}
              onHumanLevelChange={onHumanLevelChange}
              onDeleteProfile={onDeleteProfile}
              onManualProfileAdd={onManualProfileAdd}
              onMoveProfile={onMoveProfile}
              onProbe={onProbe}
              onProfileChange={onProfileChange}
              onResetProfile={onResetProfile}
              onCreateProfile={onCreateProfile}
              onSelectProfile={onSelectProfile}
              onSetDefaultProfile={onSetDefaultProfile}
              onUpdateProfile={onUpdateProfile}
            />
          ) : activeTab === "export" ? (
            <ExportSettingsPanel settings={exportSettings} onChange={onExportSettingsChange} t={t} />
          ) : activeTab === "interface" ? (
            <InterfaceSettingsPanel
              candidateBubbleLines={candidateBubbleLines}
              candidateDisplayLimit={candidateDisplayLimit}
              exportSettings={exportSettings}
              onCandidateBubbleLinesChange={onCandidateBubbleLinesChange}
              onCandidateDisplayLimitChange={onCandidateDisplayLimitChange}
              onExportSettingsChange={onExportSettingsChange}
            />
          ) : activeTab === "analysis" ? (
            <AnalysisSettingsPanel settings={problemThresholdSettings} onChange={onProblemThresholdSettingsChange} />
          ) : activeTab === "problem" ? (
            <ProblemSettingsPanel settings={problemThresholdSettings} onChange={onProblemThresholdSettingsChange} />
          ) : (
            <LanguageSettingsPanel language={language} onChange={onLanguageChange} t={t} />
          )}
        </div>
        {(["n", "s", "e", "w", "ne", "nw", "se", "sw"] as ResizeDirection[]).map((direction) => (
          <div
            aria-label={`调整窗口大小 ${direction}`}
            className={`settings-dialog-resize-handle resize-${direction}`}
            key={direction}
            onMouseDown={(event) => startResize(direction, event)}
            role="presentation"
          />
        ))}
      </section>
    </div>
  );
}

function ProblemSettingsPanel({ settings, onChange }: {
  settings: SettingsDialogProps["problemThresholdSettings"];
  onChange: SettingsDialogProps["onProblemThresholdSettingsChange"];
}) {
  return <section className="export-settings-panel">
    <h2>出题</h2>
    <p>A 型题隐藏候选点并按 AI 排名评分；B 型题显示候选点，并混合实战、强 AI 与拟人 AI 的选点。</p>
    <div className="export-setting-grid">
      <label>默认题型<select value={settings.problemType} onChange={e => onChange({ ...settings, problemType: e.target.value === "A" ? "A" : "B" })}><option value="A">A 型：自由落子</option><option value="B">B 型：显示候选点</option></select></label>
      <label>B 型候选点数量<input type="number" min="3" max="12" step="1" value={settings.candidateCount} onChange={e => onChange({ ...settings, candidateCount: Math.max(3, Math.min(12, Number(e.target.value) || 5)) })} /></label>
      <label>拟人引擎棋力偏移<input type="number" min="-20" max="10" step="1" value={settings.humanLevelOffset} onChange={e => onChange({ ...settings, humanLevelOffset: Math.max(-20, Math.min(10, Number(e.target.value) || 0)) })} /><small>-5 表示题目级别 7D 时使用拟人 2D。</small></label>
      <label>拟人候选数量<input type="number" min="0" max="5" step="1" value={settings.humanCandidateCount} onChange={e => onChange({ ...settings, humanCandidateCount: Math.max(0, Math.min(5, Number(e.target.value) || 0)) })} /></label>
    </div>
  </section>;
}

function AnalysisSettingsPanel({ settings, onChange }: {
  settings: SettingsDialogProps["problemThresholdSettings"];
  onChange: SettingsDialogProps["onProblemThresholdSettingsChange"];
}) {
  return <section className="export-settings-panel">
    <h2>分析</h2>
    <p>自动分析完成后，切换到“出题”模式会按以下条件生成缺失的出题标记。留空表示不启用该条件。</p>
    <div className="export-setting-grid">
      <label>胜率损失阈值（%）<input type="number" min="0" step="0.1" value={settings.winrateLossThreshold ?? ""} onChange={e => onChange({ ...settings, winrateLossThreshold: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })} /></label>
      <label>目差损失阈值（目）<input type="number" min="0" step="0.1" value={settings.scoreLossThreshold ?? ""} onChange={e => onChange({ ...settings, scoreLossThreshold: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })} /></label>
      <label>多个条件的关系<select value={settings.thresholdCombination} onChange={e => onChange({ ...settings, thresholdCombination: e.target.value === "and" ? "and" : "or" })}><option value="or">OR：满足任一条件</option><option value="and">AND：同时满足</option></select></label>
    </div>
  </section>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function InterfaceSettingsPanel({
  candidateBubbleLines,
  candidateDisplayLimit,
  exportSettings,
  onCandidateBubbleLinesChange,
  onCandidateDisplayLimitChange,
  onExportSettingsChange
}: {
  candidateBubbleLines: CandidateBubbleLines;
  candidateDisplayLimit: number;
  exportSettings: ResearchExportSettings;
  onCandidateBubbleLinesChange: (value: CandidateBubbleLines) => void;
  onCandidateDisplayLimitChange: (value: number) => void;
  onExportSettingsChange: (patch: Partial<ResearchExportSettings>) => void;
}) {
  return (
    <section className="export-settings-panel">
      <h2>界面</h2>
      <div className="export-setting-grid">
        <label>
          候选点气泡显示
          <select
            value={candidateBubbleLines}
            onChange={(event) => onCandidateBubbleLinesChange(event.target.value === "3" ? 3 : 2)}
          >
            <option value={2}>两行：胜率 / 计算量</option>
            <option value={3}>三行：胜率 / 计算量 / 目差</option>
          </select>
        </label>
        <label>
          棋盘候选点数量
          <input
            type="number"
            min="1"
            max="12"
            step="1"
            value={candidateDisplayLimit}
            onChange={(event) => onCandidateDisplayLimitChange(Number(event.target.value))}
          />
        </label>
        <label>
          PDF 正文字体
          <input
            type="number"
            min="10"
            max="18"
            step="1"
            value={exportSettings.documentFontSizePt}
            onChange={(event) => onExportSettingsChange({ documentFontSizePt: Number(event.target.value) })}
          />
        </label>
      </div>
    </section>
  );
}

function ExportSettingsPanel({
  settings,
  onChange,
  t
}: {
  settings: ResearchExportSettings;
  onChange: (patch: Partial<ResearchExportSettings>) => void;
  t: Translator;
}) {
  const updateNumber = (key: keyof ResearchExportSettings, value: string) => {
    onChange({ [key]: Number(value) } as Partial<ResearchExportSettings>);
  };

  return (
    <section className="export-settings-panel">
      <h2>{t("exportSettingsTitle")}</h2>
      <div className="export-setting-grid">
        <label>
          {t("layoutVersion")}
          <select value={settings.layoutVersion} onChange={(event) => onChange({ layoutVersion: event.target.value === "0.2" ? "0.2" : "0.1" })}>
            <option value="0.1">{t("currentLayout")}</option>
            <option value="0.2">{t("reportLayout")}</option>
          </select>
        </label>
        <label>
          {t("outputFormat")}
          <select value={settings.format} onChange={(event) => onChange({ format: event.target.value === "html" ? "html" : "pdf" })}>
            <option value="pdf">PDF</option>
            <option value="html">HTML</option>
          </select>
        </label>
        <label>
          {t("page")}
          <select value={settings.pageSize} onChange={(event) => onChange({ pageSize: event.target.value === "a4" ? "a4" : "letter" })}>
            <option value="letter">Letter</option>
            <option value="a4">A4</option>
          </select>
        </label>
        <label>
          {t("orientation")}
          <select value={settings.pageOrientation} onChange={(event) => onChange({ pageOrientation: event.target.value === "landscape" ? "landscape" : "portrait" })}>
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
        </label>
        <label>
          {t("boardSizeMm")}
          <input type="number" min="60" max="160" step="1" value={settings.boardSizeMm} onChange={(event) => updateNumber("boardSizeMm", event.target.value)} />
        </label>
        <label>
          {t("marginTopMm")}
          <input type="number" min="4" max="30" step="1" value={settings.pageMarginTopMm} onChange={(event) => updateNumber("pageMarginTopMm", event.target.value)} />
        </label>
        <label>
          {t("marginRightMm")}
          <input type="number" min="4" max="30" step="1" value={settings.pageMarginRightMm} onChange={(event) => updateNumber("pageMarginRightMm", event.target.value)} />
        </label>
        <label>
          {t("marginBottomMm")}
          <input type="number" min="4" max="30" step="1" value={settings.pageMarginBottomMm} onChange={(event) => updateNumber("pageMarginBottomMm", event.target.value)} />
        </label>
        <label>
          {t("marginLeftMm")}
          <input type="number" min="4" max="30" step="1" value={settings.pageMarginLeftMm} onChange={(event) => updateNumber("pageMarginLeftMm", event.target.value)} />
        </label>
        <label>
          {t("boardEdgeMarginPx")}
          <input type="number" min="18" max="80" step="1" value={settings.boardEdgeMarginPx} onChange={(event) => updateNumber("boardEdgeMarginPx", event.target.value)} />
        </label>
        <label>
          {t("variationsPerPage")}
          <select value={settings.variationsPerPage} onChange={(event) => updateNumber("variationsPerPage", event.target.value)}>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
          </select>
        </label>
        <label>
          {t("rowGapMm")}
          <input type="number" min="0" max="20" step="1" value={settings.rowGapMm} onChange={(event) => updateNumber("rowGapMm", event.target.value)} />
        </label>
        <label>
          {t("columnGapMm")}
          <input type="number" min="0" max="20" step="1" value={settings.columnGapMm} onChange={(event) => updateNumber("columnGapMm", event.target.value)} />
        </label>
      </div>
    </section>
  );
}

function LanguageSettingsPanel({
  language,
  onChange,
  t
}: {
  language: AppLanguage;
  onChange: (language: AppLanguage) => void;
  t: Translator;
}) {
  return (
    <section className="export-settings-panel">
      <h2>{t("language")}</h2>
      <div className="export-setting-grid">
        <label>
          {t("language")}
          <select value={language} onChange={(event) => onChange(event.target.value as AppLanguage)}>
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
