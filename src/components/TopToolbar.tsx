import { useRef } from "react";
import type { Translator } from "../i18n";

type TopToolbarProps = {
  title: string;
  isResearchMode: boolean;
  komi: number;
  showVariationNumbers: boolean;
  onAddVariation: () => void;
  onExportPdf: () => void;
  onKomiChange: (value: number) => void;
  onOpenAutoAnalysis: () => void;
  onOpenFile: (file: File) => void;
  onNewGame: () => void;
  onOpenSettings: () => void;
  onOpenTianshuReport: () => void;
  onResearchModeChange: (enabled: boolean) => void;
  onSaveResearch: () => void;
  onShowVariationNumbersChange: (enabled: boolean) => void;
  onToggleAnalysis: () => void;
  t: Translator;
};

const tools = ["新", "开", "存", "↶", "↷", "◀", "●", "○", "↔", "坐", "候", "主"];

export function TopToolbar({
  title,
  isResearchMode,
  komi,
  showVariationNumbers,
  onAddVariation,
  onExportPdf,
  onKomiChange,
  onOpenAutoAnalysis,
  onOpenFile,
  onNewGame,
  onOpenSettings,
  onOpenTianshuReport,
  onResearchModeChange,
  onSaveResearch,
  onShowVariationNumbersChange,
  onToggleAnalysis,
  t
}: TopToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleKomiChange = (value: string) => {
    const nextKomi = Number(value);
    if (Number.isFinite(nextKomi)) {
      onKomiChange(nextKomi);
    }
  };

  return (
    <header className="top-region">
      <div className="menu-bar">
        <strong>{title}</strong>
        <Menu label={t("menuFile")} items={[
          { label: t("newBoard"), action: onNewGame },
          { label: t("openDocument"), action: () => fileInputRef.current?.click() },
          { label: t("saveBrg"), action: onSaveResearch },
          { label: t("export"), action: onExportPdf }
        ]} />
        <Menu label={t("menuView")} items={[
          { label: showVariationNumbers ? t("hideVariationNumbers") : t("showVariationNumbers"), action: () => onShowVariationNumbersChange(!showVariationNumbers) },
          { label: isResearchMode ? t("switchToReviewMode") : t("switchToResearchMode"), action: () => onResearchModeChange(!isResearchMode) }
        ]} />
        <Menu label={t("menuAnalysis")} items={[
          { label: t("aiAnalyzePause"), action: onToggleAnalysis },
          { label: t("autoAnalysis"), action: onOpenAutoAnalysis },
          { label: t("tianshuReport"), action: onOpenTianshuReport },
          { label: t("engineSettings"), action: onOpenSettings }
        ]} />
        <Menu label={t("menuEdit")} items={[
          { label: t("insertVariation"), action: onAddVariation }
        ]} />
        <Menu label={t("menuSettings")} items={[
          { label: t("preferences"), action: onOpenSettings }
        ]} />
      </div>
      <div className="top-toolbar">
        <nav className="tool-button-group" aria-label="Primary commands">
          {tools.map((tool) => (
            <button
              type="button"
              key={tool}
              className="tool-button"
              onClick={
                tool === "开"
                  ? () => fileInputRef.current?.click()
                  : tool === "新"
                    ? onNewGame
                    : tool === "存"
                      ? onSaveResearch
                    : undefined
              }
            >
              {tool}
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
          <label>{t("komi")} <input type="number" step="0.5" value={komi} onChange={(event) => handleKomiChange(event.target.value)} /></label>
          <button
            type="button"
            className={`toolbar-toggle ${showVariationNumbers ? "active" : ""}`}
            onClick={() => onShowVariationNumbersChange(!showVariationNumbers)}
            title={showVariationNumbers ? t("showVariationNumbers") : t("hideVariationNumbers")}
          >
            {t("branchNumbers")}
          </button>
          <button type="button" className="toolbar-toggle" onClick={onOpenTianshuReport}>
            {t("tianshuReport")}
          </button>
          <div className="mode-switch" aria-label={t("menuView")}>
            <button
              type="button"
              className={!isResearchMode ? "active" : ""}
              onClick={() => onResearchModeChange(false)}
            >
              {t("reviewMode")}
            </button>
            <button
              type="button"
              className={isResearchMode ? "active" : ""}
              onClick={() => onResearchModeChange(true)}
            >
              {t("researchMode")}
            </button>
          </div>
          <label><input type="checkbox" defaultChecked /> {t("countStones")}</label>
          <label>{t("aggressiveness")} <input value="0" readOnly /></label>
          <label>{t("breadth")} <input value="0.04" readOnly /></label>
          <label><input type="checkbox" defaultChecked /> {t("candidates")}</label>
          <label><input type="checkbox" defaultChecked /> {t("black")}</label>
          <label><input type="checkbox" defaultChecked /> {t("white")}</label>
        </div>
      </div>
    </header>
  );
}

function Menu({ label, items }: { label: string; items: Array<{ label: string; action: () => void }> }) {
  return (
    <div className="menu-root">
      <button type="button" className="menu-button">{label}</button>
      <div className="menu-popover">
        {items.map((item) => (
          <button type="button" key={item.label} onClick={item.action}>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
