import type { EngineProfile } from "../engine/types";

type EngineConfigPanelProps = {
  diagnostics: string;
  engineStatus: string;
  isAnalyzing: boolean;
  onAnalyze: () => void;
  onProfileChange: (profile: EngineProfile) => void;
  onProbe: () => void;
  profile: EngineProfile | null;
};

export function EngineConfigPanel({
  diagnostics,
  engineStatus,
  isAnalyzing,
  onAnalyze,
  onProfileChange,
  onProbe,
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
  const terminalCommand = profile
    ? `printf 'boardsize 19\\nkomi 7.5\\nclear_board\\nkata-analyze B 20\\n' | ${profile.executablePath} gtp -model "${profile.modelPath}" -config "${profile.configPath}"`
    : "";

  return (
    <div className="engine-config-panel">
      <h2>引擎配置</h2>
      <div className="engine-status-line">{engineStatus}</div>
      <label>
        <span>名称</span>
        <input
          className="panel-input"
          value={profile?.name ?? ""}
          onChange={(event) => updateProfile({ name: event.target.value })}
        />
      </label>
      <label>
        <span>程序</span>
        <input
          className="panel-input"
          value={profile?.executablePath ?? ""}
          onChange={(event) => updateProfile({ executablePath: event.target.value })}
        />
      </label>
      <label>
        <span>模型</span>
        <input
          className="panel-input"
          value={profile?.modelPath ?? ""}
          onChange={(event) => updateProfile({ modelPath: event.target.value })}
        />
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
        <button type="button" onClick={onProbe}>测试</button>
        <button type="button" onClick={onAnalyze} disabled={isAnalyzing}>
          {isAnalyzing ? "分析中" : "分析当前局面"}
        </button>
      </div>
      <details className="engine-diagnostics" open>
        <summary>诊断 / 终端复现</summary>
        <p>如果这里出现 OpenCL / CL_INVALID_VALUE，说明 KataGo 本身启动分析时崩溃，需要换可用后端或配置。</p>
        {terminalCommand ? (
          <>
            <span className="diagnostic-label">终端复现命令</span>
            <pre>{terminalCommand}</pre>
          </>
        ) : null}
        <span className="diagnostic-label">最近一次 stdout / stderr</span>
        <pre>{diagnostics}</pre>
      </details>
    </div>
  );
}
