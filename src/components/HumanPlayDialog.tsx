import { useEffect, useState } from "react";
import { HUMAN_ENGINE_LEVELS } from "../engine/humanEngineLevels";
import type { EngineMode, EngineProfile, HumanEngineLevel } from "../engine/types";
import type { HumanPlaySettings, PlayMode } from "../play/types";

type HumanPlayDialogProps = {
  engineAvailable: boolean;
  engineMode: EngineMode;
  engineName: string;
  engineProfiles: EngineProfile[];
  humanLevel: HumanEngineLevel;
  initialPlayMode: PlayMode;
  open: boolean;
  onClose: () => void;
  onStart: (settings: HumanPlaySettings) => void;
};

export function HumanPlayDialog({
  engineAvailable,
  engineMode,
  engineName,
  engineProfiles,
  humanLevel,
  initialPlayMode,
  open,
  onClose,
  onStart
}: HumanPlayDialogProps) {
  const [settings, setSettings] = useState<HumanPlaySettings>({
    handicap: 0,
    humanColor: "black",
    komi: 7.5,
    maxTimeSeconds: 5,
    maxVisits: 400,
    searchLimit: "time"
    ,playMode: initialPlayMode,
    humanOpponentEngineMode: engineMode,
    humanOpponentLevel: humanLevel,
    blackProfileId: engineProfiles[0]?.profileId ?? engineProfiles[0]?.name ?? "",
    whiteProfileId: engineProfiles[0]?.profileId ?? engineProfiles[0]?.name ?? "",
    blackEngineMode: "human",
    whiteEngineMode: "human",
    blackHumanLevel: undefined,
    whiteHumanLevel: undefined
  });

  useEffect(() => {
    if (open) {
      setSettings((current) => ({
        ...current,
        playMode: initialPlayMode,
        humanOpponentEngineMode: engineMode,
        humanOpponentLevel: humanLevel
      }));
    }
  }, [engineMode, humanLevel, initialPlayMode, open]);

  if (!open) return null;

  const isEngineMatch = settings.playMode === "engine-vs-engine";
  const dialogTitle = isEngineMatch ? "机机对弈" : "人机对弈";

  return (
    <div className="human-play-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="human-play-dialog" role="dialog" aria-modal="true" aria-label={`${dialogTitle}设置`} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><strong>{dialogTitle}</strong><span>19 路 · 日本规则</span></div>
          <button type="button" onClick={onClose}>关闭</button>
        </header>
        <div className="human-play-engine-summary">
          <span>当前引擎</span><strong>{engineName}</strong>
        </div>
        <div className="human-play-form">
          <label className="human-play-mode-field">
            <span>对弈方式</span>
            <select value={settings.playMode} onChange={(event) => setSettings((current) => ({ ...current, playMode: event.target.value as PlayMode }))}>
              <option value="human-vs-engine">人机对弈</option>
              <option value="engine-vs-engine">机机对弈</option>
            </select>
          </label>
          {settings.playMode === "engine-vs-engine" ? (
            <>
              <label className="human-play-black-engine-field"><span>黑方引擎</span><select value={settings.blackProfileId} onChange={(event) => setSettings((current) => ({ ...current, blackProfileId: event.target.value }))}>{engineProfiles.map((profile) => <option key={profile.profileId ?? profile.name} value={profile.profileId ?? profile.name}>{profile.name}</option>)}</select></label>
              <label><span>白方引擎</span><select value={settings.whiteProfileId} onChange={(event) => setSettings((current) => ({ ...current, whiteProfileId: event.target.value }))}>{engineProfiles.map((profile) => <option key={profile.profileId ?? profile.name} value={profile.profileId ?? profile.name}>{profile.name}</option>)}</select></label>
              <label><span>黑方类型</span><select value={settings.blackEngineMode} onChange={(event) => setSettings((current) => ({ ...current, blackEngineMode: event.target.value as EngineMode, blackHumanLevel: event.target.value === "human" ? current.blackHumanLevel ?? "10k" : undefined }))}><option value="human">拟人引擎</option><option value="normal">正常引擎</option></select></label>
              <label><span>白方类型</span><select value={settings.whiteEngineMode} onChange={(event) => setSettings((current) => ({ ...current, whiteEngineMode: event.target.value as EngineMode, whiteHumanLevel: event.target.value === "human" ? current.whiteHumanLevel ?? "10k" : undefined }))}><option value="human">拟人引擎</option><option value="normal">正常引擎</option></select></label>
              <label><span>黑方棋力</span><select value={settings.blackHumanLevel ?? ""} disabled={settings.blackEngineMode !== "human"} onChange={(event) => setSettings((current) => ({ ...current, blackHumanLevel: event.target.value ? event.target.value as HumanEngineLevel : undefined }))}><option value="">—</option>{HUMAN_ENGINE_LEVELS.map((level) => <option key={level} value={level}>{level.toUpperCase()}</option>)}</select></label>
              <label><span>白方棋力</span><select value={settings.whiteHumanLevel ?? ""} disabled={settings.whiteEngineMode !== "human"} onChange={(event) => setSettings((current) => ({ ...current, whiteHumanLevel: event.target.value ? event.target.value as HumanEngineLevel : undefined }))}><option value="">—</option>{HUMAN_ENGINE_LEVELS.map((level) => <option key={level} value={level}>{level.toUpperCase()}</option>)}</select></label>
            </>
          ) : null}
          {settings.playMode === "human-vs-engine" ? <>
            <label className="human-play-engine-mode-field">
              <span>引擎类型</span>
              <select value={settings.humanOpponentEngineMode ?? "normal"} onChange={(event) => setSettings((current) => ({
                ...current,
                humanOpponentEngineMode: event.target.value as EngineMode,
                humanOpponentLevel: event.target.value === "human" ? current.humanOpponentLevel ?? humanLevel : undefined
              }))}>
                <option value="human">拟人引擎</option>
                <option value="normal">正常引擎</option>
              </select>
            </label>
            <label>
              <span>拟人棋力</span>
              <select value={settings.humanOpponentLevel ?? ""} disabled={settings.humanOpponentEngineMode !== "human"} onChange={(event) => setSettings((current) => ({ ...current, humanOpponentLevel: event.target.value as HumanEngineLevel }))}>
                {HUMAN_ENGINE_LEVELS.map((level) => <option key={level} value={level}>{level.toUpperCase()}</option>)}
              </select>
            </label>
          </> : null}
          {!isEngineMatch ? (
            <label>
              <span>你执</span>
              <select value={settings.humanColor} onChange={(event) => setSettings((current) => ({ ...current, humanColor: event.target.value as "black" | "white" }))}>
                <option value="black">黑棋</option>
                <option value="white">白棋</option>
              </select>
            </label>
          ) : null}
          <label>
            <span>让子</span>
            <select value={settings.handicap} onChange={(event) => {
              const handicap = Number(event.target.value);
              setSettings((current) => ({
                ...current,
                handicap,
                komi: handicap >= 2 && current.handicap === 0 && current.komi === 7.5
                  ? 0.5
                  : handicap === 0 && current.handicap >= 2 && current.komi === 0.5 ? 7.5 : current.komi
              }));
            }}>
              <option value={0}>分先</option>
              {[2, 3, 4, 5, 6, 7, 8, 9].map((value) => <option key={value} value={value}>黑棋 {value} 子</option>)}
            </select>
          </label>
          <label>
            <span>贴目</span>
            <input type="number" step="0.5" value={settings.komi} onChange={(event) => setSettings((current) => ({ ...current, komi: Number(event.target.value) }))} />
          </label>
          <label>
            <span>思考限制</span>
            <select value={settings.searchLimit} onChange={(event) => setSettings((current) => ({ ...current, searchLimit: event.target.value as "time" | "visits" }))}>
              <option value="time">每手秒数</option>
              <option value="visits">每手 Visits</option>
            </select>
          </label>
          <label>
            <span>{settings.searchLimit === "time" ? "每手秒数" : "每手 Visits"}</span>
            {settings.searchLimit === "time" ? (
              <input type="number" min="0.1" max="600" step="0.5" value={settings.maxTimeSeconds} onChange={(event) => setSettings((current) => ({ ...current, maxTimeSeconds: Number(event.target.value) }))} />
            ) : (
              <input type="number" min="1" max="1000000" step="50" value={settings.maxVisits} onChange={(event) => setSettings((current) => ({ ...current, maxVisits: Number(event.target.value) }))} />
            )}
          </label>
        </div>
        <p>{settings.handicap >= 2 ? "让子作为棋盘初始设置，摆好后白棋先行。" : "分先对局，黑棋先行。"}</p>
        <button className="human-play-start" type="button" disabled={!engineAvailable} onClick={() => onStart(settings)}>
          {engineAvailable ? "开始对弈" : "请先完成引擎配置"}
        </button>
      </section>
    </div>
  );
}
