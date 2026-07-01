import { useEffect, useRef } from "react";
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
  onDeleteProfile: (profileKey: string) => void;
  onMoveProfile: (profileKey: string, direction: "up" | "down") => void;
  onResetProfile: () => void;
  onSaveProfile: () => void;
  onSelectProfile: (profileKey: string) => void;
  onSetDefaultProfile: () => void;
  profile: EngineProfile | null;
  profiles: EngineProfile[];
};

export function EngineConfigPanel({
  diagnostics,
  engineStatus,
  isAnalyzing,
  onAnalyze,
  onAutoDetect,
  onChoosePath,
  onDeleteProfile,
  onMoveProfile,
  onProfileChange,
  onProbe,
  onResetProfile,
  onSaveProfile,
  onSelectProfile,
  onSetDefaultProfile,
  profile,
  profiles
}: EngineConfigPanelProps) {
  const diagnosticsRef = useRef<HTMLPreElement | null>(null);
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
  const selectedKey = profile ? engineProfileKey(profile) : "";
  const selectedProfile = profiles.find((item) => engineProfileKey(item) === selectedKey);
  const selectedIndex = profiles.findIndex((item) => engineProfileKey(item) === selectedKey);
  const selectedLocked = selectedProfile ? isProtectedEngineProfile(selectedProfile) : true;

  useEffect(() => {
    const element = diagnosticsRef.current;
    if (!element) {
      return;
    }
    element.scrollTop = element.scrollHeight;
  }, [diagnostics]);

  return (
    <div className="engine-config-panel">
      <h2>引擎配置</h2>
      <section className="engine-profile-list" aria-label="已配置引擎">
        <div className="engine-profile-list-header">
          <strong>已配置引擎</strong>
          <div className="engine-profile-list-tools">
            <button
              type="button"
              disabled={!selectedKey || selectedIndex <= 0}
              onClick={() => onMoveProfile(selectedKey, "up")}
            >
              上移
            </button>
            <button
              type="button"
              disabled={!selectedKey || selectedIndex < 0 || selectedIndex >= profiles.length - 1}
              onClick={() => onMoveProfile(selectedKey, "down")}
            >
              下移
            </button>
            <button
              type="button"
              disabled={!selectedKey || selectedLocked}
              title={selectedLocked ? "内置默认引擎不可删除" : "删除当前高亮引擎配置"}
              onClick={() => onDeleteProfile(selectedKey)}
            >
              删除
            </button>
          </div>
        </div>
        <div className="engine-profile-table-wrap">
          <table className="engine-profile-table">
            <thead>
              <tr>
                <th>名称</th>
                <th>来源</th>
                <th>状态</th>
                <th>模型</th>
              </tr>
            </thead>
            <tbody>
              {profiles.length === 0 ? (
                <tr>
                  <td colSpan={4}>尚未保存引擎。Auto Detect 会保留可用默认引擎，手动配置请保存到列表。</td>
                </tr>
              ) : (
                profiles.map((item) => {
                  const key = engineProfileKey(item);
                  const selected = profile ? engineProfileKey(profile) === key : false;
                  const locked = isProtectedEngineProfile(item);
                  return (
                    <tr className={selected ? "active" : ""} key={key} onClick={() => onSelectProfile(key)}>
                      <td>{item.name}</td>
                      <td>{item.source ?? "用户配置"}</td>
                      <td>{locked ? "内置保底" : item.exists ? "可用" : "待测试"}</td>
                      <td>{fileName(item.modelPath)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
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
        <button type="button" onClick={onSaveProfile}>保存到列表</button>
        <button type="button" onClick={onSetDefaultProfile}>设为默认</button>
        <button type="button" onClick={onResetProfile}>Reset to Default</button>
        <button type="button" onClick={onAnalyze} disabled={isAnalyzing}>
          {isAnalyzing ? "分析中" : "分析当前局面"}
        </button>
      </div>
      <details className="engine-diagnostics" open>
        <summary>诊断</summary>
        <pre ref={diagnosticsRef}>{diagnostics}</pre>
      </details>
    </div>
  );
}

function engineProfileKey(profile: EngineProfile): string {
  return [profile.executablePath, profile.modelPath, profile.configPath].join("|");
}

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? "";
}

function isProtectedEngineProfile(profile: EngineProfile): boolean {
  const source = (profile.source ?? "").toLowerCase();
  return source.includes("bundled") || source.includes("内置") || source.includes("known windows") || source.includes("已知");
}
