import type { EngineProfile } from "../engine/types";

type EngineConfigPanelProps = {
  diagnostics: string;
  engineStatus: string;
  isAnalyzing: boolean;
  onAnalyze: () => void;
  onAutoDetect: () => void;
  onChoosePath: (kind: "engine" | "model" | "config") => void;
  onProfileChange: (profile: EngineProfile) => void;
  onProbe: () => void;
  onResetProfile: () => void;
  profile: EngineProfile | null;
};

export function EngineConfigPanel({
  diagnostics,
  engineStatus,
  isAnalyzing,
  onAnalyze,
  onAutoDetect,
  onChoosePath,
  onProfileChange,
  onProbe,
  onResetProfile,
  profile
}: EngineConfigPanelProps) {
  const updateProfile = (patch: Partial<EngineProfile>) => {
    const base = profile ?? {
      name: "本机 KataGo",
      executablePath: "katago",
      modelPath: "",
      configPath: "",
      commandLine: "",
      exists: false
    };
    onProfileChange({ ...base, ...patch });
  };

  return (
    <div className="engine-config-panel">
      <h2>引擎配置</h2>
      <div className="engine-status-card">
        <span>当前状态</span>
        <strong>{engineStatus}</strong>
        <small>{profile?.source ?? "未配置"}</small>
      </div>
      <label>
        <span>名称</span>
        <input
          className="panel-input"
          value={profile?.name ?? ""}
          onChange={(event) => updateProfile({ name: event.target.value })}
        />
      </label>
      <label>
        <span>Engine Path</span>
        <div className="path-input-row">
          <input
            className="panel-input"
            value={profile?.executablePath ?? ""}
            onChange={(event) => updateProfile({ executablePath: event.target.value, source: "用户配置" })}
          />
          <button type="button" onClick={() => onChoosePath("engine")}>选择</button>
        </div>
      </label>
      <label>
        <span>Model Path</span>
        <div className="path-input-row">
          <input
            className="panel-input"
            value={profile?.modelPath ?? ""}
            onChange={(event) => updateProfile({ modelPath: event.target.value, source: "用户配置" })}
          />
          <button type="button" onClick={() => onChoosePath("model")}>选择</button>
        </div>
      </label>
      <label>
        <span>配置</span>
        <input
          className="panel-input"
          value={profile?.configPath ?? ""}
          onChange={(event) => updateProfile({ configPath: event.target.value })}
        />
      </label>
      <div className="engine-config-actions">
        <button type="button" onClick={onAutoDetect}>Auto Detect</button>
        <button type="button" onClick={onProbe}>Test Engine</button>
        <button type="button" onClick={() => onChoosePath("config")}>Choose Config</button>
        <button type="button" onClick={onResetProfile}>Reset to Default</button>
        <button type="button" onClick={onAnalyze} disabled={isAnalyzing}>
          {isAnalyzing ? "分析中" : "分析当前局面"}
        </button>
      </div>
      <details className="engine-diagnostics" open>
        <summary>诊断</summary>
        <pre>{diagnostics}</pre>
      </details>
    </div>
  );
}
