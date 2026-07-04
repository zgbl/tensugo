import { useState } from "react";
import type { OgsConnectionStatus } from "../ogs/types";

type OgsDialogProps = {
  detail?: string;
  isOpen: boolean;
  onClose: () => void;
  onConnect: (url: string) => void;
  onDisconnect: () => void;
  sourceLabel?: string;
  status: OgsConnectionStatus;
};

const statusLabels: Record<OgsConnectionStatus, string> = {
  connected: "Connected",
  connecting: "Connecting",
  disconnected: "Disconnected",
  error: "Error",
  idle: "Disconnected",
  syncing: "Syncing",
  unsupported: "Not supported"
};

export function OgsDialog({
  detail,
  isOpen,
  onClose,
  onConnect,
  onDisconnect,
  sourceLabel,
  status
}: OgsDialogProps) {
  const [url, setUrl] = useState("");
  if (!isOpen) {
    return null;
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="auto-analysis-dialog ogs-dialog" role="dialog" aria-modal="true" aria-labelledby="ogs-dialog-title">
        <header className="dialog-title-row">
          <div>
            <h2 id="ogs-dialog-title">Open OGS URL</h2>
            <p>只读连接公开 OGS review；不登录、不评论、不调用 OGS AI。</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="dialog-body">
          <label>
            <span>OGS URL</span>
            <input
              type="url"
              placeholder="https://online-go.com/demo/1730972"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
          </label>
          <div className={`ogs-status ogs-status-${status}`}>
            <strong>{statusLabels[status]}</strong>
            <span>{sourceLabel ?? "No OGS source connected"}</span>
            {detail ? <small>{detail}</small> : null}
          </div>
          <p className="dialog-note">
            当前 MVP 支持 public review/demo。game/live URL 会先识别并提示 coming soon。
          </p>
        </div>
        <footer className="dialog-actions">
          <button type="button" onClick={onDisconnect}>Disconnect</button>
          <button type="button" onClick={() => onConnect(url)}>Connect</button>
        </footer>
      </section>
    </div>
  );
}
