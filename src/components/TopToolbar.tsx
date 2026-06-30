import { useRef } from "react";
import type { Translator } from "../i18n";

type TopToolbarProps = {
  boardPixelSize: number;
  hasSavedAnalysis: boolean;
  title: string;
  isResearchMode: boolean;
  komi: number;
  showSavedAnalysis: boolean;
  showVariationNumbers: boolean;
  onAddVariation: () => void;
  onExportPdf: () => void;
  onKomiChange: (value: number) => void;
  onOpenAutoAnalysis: () => void;
  onOpenAbout: () => void;
  onOpenFile: (file: File) => void;
  onNewGame: () => void;
  onOpenSettings: () => void;
  onOpenTianshuReport: () => void;
  onResearchModeChange: (enabled: boolean) => void;
  onSaveResearch: () => void;
  onShowVariationNumbersChange: (enabled: boolean) => void;
  onToggleSavedAnalysis: () => void;
  onToggleAnalysis: () => void;
  t: Translator;
};

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
  boardPixelSize: _boardPixelSize,
  hasSavedAnalysis,
  title,
  isResearchMode,
  komi,
  showSavedAnalysis,
  showVariationNumbers,
  onAddVariation,
  onExportPdf,
  onKomiChange,
  onOpenAutoAnalysis,
  onOpenAbout,
  onOpenFile,
  onNewGame,
  onOpenSettings,
  onOpenTianshuReport,
  onResearchModeChange,
  onSaveResearch,
  onShowVariationNumbersChange,
  onToggleSavedAnalysis,
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
          { label: "导出PDF", action: onExportPdf }
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
                  ? () => fileInputRef.current?.click()
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
          <label className="tsg-analysis-toggle">
            <input
              type="checkbox"
              checked={showSavedAnalysis}
              disabled={!hasSavedAnalysis}
              onChange={onToggleSavedAnalysis}
            /> TSG分析
          </label>
        </div>
      </div>
    </header>
  );
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
