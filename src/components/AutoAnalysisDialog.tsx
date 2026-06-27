import { useRef } from "react";

export type AutoAnalysisSettings = {
  endMove: number;
  includeBlack: boolean;
  includeWhite: boolean;
  secondsPerMove: number;
  startMove: number;
  visitsPerMove: number;
};

type AutoAnalysisDialogProps = {
  currentMoveNumber: number;
  isRunning: boolean;
  open: boolean;
  totalMoves: number;
  onClose: () => void;
  onStart: (settings: AutoAnalysisSettings) => void;
  onStop: () => void;
};

export function AutoAnalysisDialog({
  currentMoveNumber,
  isRunning,
  open,
  totalMoves,
  onClose,
  onStart,
  onStop
}: AutoAnalysisDialogProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  if (!open) {
    return null;
  }

  const defaultStart = Math.max(1, currentMoveNumber || 1);
  const startAnalysis = () => {
    if (!formRef.current) {
      return;
    }
    const data = new FormData(formRef.current);
    onStart({
      startMove: clampMove(Number(data.get("startMove")) || defaultStart, totalMoves),
      endMove: clampMove(Number(data.get("endMove")) || totalMoves, totalMoves),
      secondsPerMove: Math.max(0, Number(data.get("secondsPerMove")) || 0),
      visitsPerMove: Math.max(0, Math.floor(Number(data.get("visitsPerMove")) || 0)),
      includeBlack: data.get("includeBlack") === "on",
      includeWhite: data.get("includeWhite") === "on"
    });
  };

  return (
    <div className="dialog-backdrop" role="presentation">
      <form className="auto-analysis-dialog" noValidate ref={formRef} onSubmit={(event) => event.preventDefault()}>
        <div className="dialog-title-row">
          <h2>自动分析设置</h2>
          <button type="button" aria-label="关闭" onClick={onClose}>×</button>
        </div>
        <label>
          <span>开始手数</span>
          <input name="startMove" type="number" min="1" max={totalMoves} defaultValue={defaultStart} />
        </label>
        <label>
          <span>结束手数</span>
          <input name="endMove" type="number" min="1" max={totalMoves} defaultValue={totalMoves} />
        </label>
        <label>
          <span>每手时间(秒)</span>
          <input name="secondsPerMove" type="number" min="0" step="0.5" defaultValue="1" />
        </label>
        <label>
          <span>每手总计算量 PO</span>
          <input name="visitsPerMove" type="number" min="0" step="1" placeholder="优先使用 PO" />
        </label>
        <label className="checkbox-row">
          <span>分析黑棋</span>
          <input name="includeBlack" type="checkbox" defaultChecked />
        </label>
        <label className="checkbox-row">
          <span>分析白棋</span>
          <input name="includeWhite" type="checkbox" defaultChecked />
        </label>
        <p className="dialog-hint">填 PO 时优先按 PO 分析；未填 PO 时按每手秒数换算为分析量。</p>
        <div className="dialog-actions">
          <button type="button" disabled={isRunning} onClick={startAnalysis}>开始分析</button>
          <button type="button" onClick={onStop} disabled={!isRunning}>终止分析</button>
        </div>
      </form>
    </div>
  );
}

function clampMove(moveNumber: number, totalMoves: number): number {
  return Math.max(1, Math.min(totalMoves, Math.floor(moveNumber)));
}
