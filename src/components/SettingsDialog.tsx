import { useState } from "react";
import { EngineConfigPanel } from "./EngineConfigPanel";
import type { EngineProfile } from "../engine/types";
import { LANGUAGE_OPTIONS, type AppLanguage, type Translator } from "../i18n";
import type { ResearchExportSettings } from "../research/renderHtml";

type SettingsDialogProps = {
  candidateDisplayLimit: number;
  engineDiagnostics: string;
  engineStatus: string;
  exportSettings: ResearchExportSettings;
  isAnalyzing: boolean;
  language: AppLanguage;
  onAnalyze: () => void;
  onClose: () => void;
  onCandidateDisplayLimitChange: (value: number) => void;
  onExportSettingsChange: (patch: Partial<ResearchExportSettings>) => void;
  onLanguageChange: (language: AppLanguage) => void;
  onAutoDetect: () => void;
  onChoosePath: (kind: "engine" | "model" | "config") => void;
  onProbe: () => void;
  onProfileChange: (profile: EngineProfile) => void;
  onResetProfile: () => void;
  open: boolean;
  profile: EngineProfile | null;
  t: Translator;
};

export function SettingsDialog({
  candidateDisplayLimit,
  engineDiagnostics,
  engineStatus,
  exportSettings,
  isAnalyzing,
  language,
  onAnalyze,
  onClose,
  onCandidateDisplayLimitChange,
  onExportSettingsChange,
  onLanguageChange,
  onAutoDetect,
  onChoosePath,
  onProbe,
  onProfileChange,
  onResetProfile,
  open,
  profile,
  t
}: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<"engine" | "export" | "interface" | "language">("engine");

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
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="settings-dialog-header">
          <h2>{t("settings")}</h2>
          <button type="button" onClick={onClose}>{t("close")}</button>
        </header>
        <div className="settings-dialog-body">
          <nav className="settings-tabs" aria-label={t("settings")}>
            <button type="button" className={activeTab === "engine" ? "active" : ""} onClick={() => setActiveTab("engine")}>{t("engine")}</button>
            <button type="button" className={activeTab === "export" ? "active" : ""} onClick={() => setActiveTab("export")}>{t("exportSettings")}</button>
            <button type="button" className={activeTab === "interface" ? "active" : ""} onClick={() => setActiveTab("interface")}>{t("interface")}</button>
            <button type="button" className={activeTab === "language" ? "active" : ""} onClick={() => setActiveTab("language")}>{t("language")}</button>
            <button type="button" disabled>{t("menuAnalysis")}</button>
            <button type="button" disabled>{t("gameRecord")}</button>
          </nav>
          {activeTab === "engine" ? (
            <EngineConfigPanel
              diagnostics={engineDiagnostics}
              engineStatus={engineStatus}
              isAnalyzing={isAnalyzing}
              profile={profile}
              onAnalyze={onAnalyze}
              onAutoDetect={onAutoDetect}
              onChoosePath={onChoosePath}
              onProbe={onProbe}
              onProfileChange={onProfileChange}
              onResetProfile={onResetProfile}
            />
          ) : activeTab === "export" ? (
            <ExportSettingsPanel settings={exportSettings} onChange={onExportSettingsChange} t={t} />
          ) : activeTab === "interface" ? (
            <InterfaceSettingsPanel
              candidateDisplayLimit={candidateDisplayLimit}
              onCandidateDisplayLimitChange={onCandidateDisplayLimitChange}
            />
          ) : (
            <LanguageSettingsPanel language={language} onChange={onLanguageChange} t={t} />
          )}
        </div>
      </section>
    </div>
  );
}

function InterfaceSettingsPanel({
  candidateDisplayLimit,
  onCandidateDisplayLimitChange
}: {
  candidateDisplayLimit: number;
  onCandidateDisplayLimitChange: (value: number) => void;
}) {
  return (
    <section className="export-settings-panel">
      <h2>界面</h2>
      <div className="export-setting-grid">
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
