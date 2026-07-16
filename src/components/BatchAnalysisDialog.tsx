import { useEffect, useRef, useState } from "react";

export type BatchAnalysisMode = "analysis" | "problems" | "both";

export type BatchAnalysisSettings = {
  candidateLimit: number;
  endMove: number;
  includeBlack: boolean;
  includeWhite: boolean;
  mode: BatchAnalysisMode;
  secondsPerMove: number;
  startMove: number;
  visitsPerMove: number;
  winrateLossThreshold: number;
  targetPlayer: string;
  maxProblemsPerGame: number;
  problemType: "A" | "B";
  problemCreator: string;
  problemCollection: string;
};

type BatchAnalysisDialogProps = {
  fileCount: number;
  isRunning: boolean;
  logs: string[];
  open: boolean;
  outputDirectory: string | null;
  onChooseFiles: () => void;
  onChooseOutputDirectory: () => void;
  onClose: () => void;
  onStart: (settings: BatchAnalysisSettings) => void;
  onSuggestTargetPlayers: () => Promise<string[]>;
  onStop: () => void;
};

export function BatchAnalysisDialog({
  fileCount,
  isRunning,
  logs,
  open,
  outputDirectory,
  onChooseFiles,
  onChooseOutputDirectory,
  onClose,
  onStart,
  onSuggestTargetPlayers,
  onStop
}: BatchAnalysisDialogProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const consoleRef = useRef<HTMLPreElement | null>(null);
  const [pickerStatus, setPickerStatus] = useState("");
  const [targetSuggestionLoading, setTargetSuggestionLoading] = useState(false);
  const targetSuggestionAttemptedRef = useRef(false);
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs]);
  useEffect(() => {
    targetSuggestionAttemptedRef.current = false;
    const input = formRef.current?.elements.namedItem("targetPlayer");
    if (input instanceof HTMLInputElement) {
      input.value = "";
    }
  }, [fileCount]);
  if (!open) {
    return null;
  }

  const startBatch = () => {
    if (!formRef.current) {
      setPickerStatus("启动失败：表单尚未就绪。");
      return;
    }
    if (fileCount <= 0) {
      setPickerStatus("请先选择棋谱。");
      return;
    }
    if (!outputDirectory) {
      setPickerStatus("请先选择输出目录。");
      return;
    }
    const data = new FormData(formRef.current);
    const mode = String(data.get("mode") ?? "both") as BatchAnalysisMode;
    setPickerStatus("已触发开始批量任务...");
    onStart({
      mode,
      startMove: Math.max(1, Math.floor(Number(data.get("startMove")) || 1)),
      endMove: Math.max(1, Math.floor(Number(data.get("endMove")) || 999)),
      secondsPerMove: Math.max(0, Number(data.get("secondsPerMove")) || 0),
      visitsPerMove: Math.max(0, Math.floor(Number(data.get("visitsPerMove")) || 0)),
      includeBlack: data.get("includeBlack") === "on",
      includeWhite: data.get("includeWhite") === "on",
      winrateLossThreshold: Math.max(0, Number(data.get("winrateLossThreshold")) || 2),
      candidateLimit: Math.max(1, Math.floor(Number(data.get("candidateLimit")) || 8)),
      targetPlayer: String(data.get("targetPlayer") ?? "").trim(),
      maxProblemsPerGame: Math.max(1, Math.floor(Number(data.get("maxProblemsPerGame")) || 10)),
      problemType: String(data.get("problemType") ?? "B") === "A" ? "A" : "B",
      problemCreator: String(data.get("problemCreator") ?? "").trim(),
      problemCollection: String(data.get("problemCollection") ?? "").trim()
    });
  };

  const suggestTargetPlayer = async () => {
    if (targetSuggestionAttemptedRef.current || targetSuggestionLoading || !formRef.current) {
      return;
    }
    targetSuggestionAttemptedRef.current = true;
    setTargetSuggestionLoading(true);
    try {
      const names = await onSuggestTargetPlayers();
      if (names.length === 0) {
        setPickerStatus("暂未找到前两个棋谱共同出现的棋手名。");
        return;
      }
      const name = names.length === 1 ? names[0] : names.join("、");
      if (window.confirm(`前两个棋谱共同出现的棋手：${name}\n是否填入目标棋手？`)) {
        const input = formRef.current.elements.namedItem("targetPlayer");
        if (input instanceof HTMLInputElement) {
          input.value = names[0];
        }
        setPickerStatus(`已填入目标棋手：${names[0]}`);
      }
    } finally {
      setTargetSuggestionLoading(false);
    }
  };

  return (
    <div className="dialog-backdrop" role="presentation">
      <form className="auto-analysis-dialog batch-analysis-dialog" noValidate ref={formRef} onSubmit={(event) => event.preventDefault()}>
        <div className="dialog-title-row">
          <h2>批量分析 / 批量出题</h2>
          <button type="button" aria-label="关闭" onClick={onClose}>×</button>
        </div>
        <div className="batch-picker-row">
          <input
            type="button"
            value="选择棋谱"
            disabled={isRunning}
            onClick={() => {
              setPickerStatus("已触发选择棋谱...");
              onChooseFiles();
            }}
          />
          <span>{fileCount > 0 ? `已选 ${fileCount} 个棋谱` : "未选择棋谱"}</span>
        </div>
        <div className="batch-picker-row">
          <input
            type="button"
            value="输出目录"
            disabled={isRunning}
            onClick={() => {
              setPickerStatus("已触发输出目录选择...");
              onChooseOutputDirectory();
            }}
          />
          <span title={outputDirectory ?? ""}>{outputDirectory ?? "未选择输出目录"}</span>
        </div>
        <label>
          <span>任务模式</span>
          <select name="mode" defaultValue="both">
            <option value="both">分析并出题</option>
            <option value="analysis">只批量分析</option>
            <option value="problems">只批量出题</option>
          </select>
        </label>
        <label>
          <span>开始手数</span>
          <input name="startMove" type="number" min="1" defaultValue="1" />
        </label>
        <label>
          <span>结束手数</span>
          <input name="endMove" type="number" min="1" defaultValue="999" />
        </label>
        <label>
          <span>每手时间(秒)</span>
          <input name="secondsPerMove" type="number" min="0" step="0.5" defaultValue="1" />
        </label>
        <label>
          <span>每手总计算量 PO</span>
          <input name="visitsPerMove" type="number" min="0" step="1" placeholder="优先使用 PO" />
        </label>
        <label>
          <span>出题阈值(胜率损失%)</span>
          <input name="winrateLossThreshold" type="number" min="0" step="0.5" defaultValue="2" />
        </label>
        <label>
          <span>目标棋手</span>
          <input
            name="targetPlayer"
            type="text"
            placeholder="点击自动识别，或输入棋手名的一部分"
            onFocus={() => void suggestTargetPlayer()}
          />
        </label>
        <label>
          <span>候选评分数</span>
          <input name="candidateLimit" type="number" min="1" max="12" step="1" defaultValue="8" />
        </label>
        <label>
          <span>自动出题类型</span>
          <select name="problemType" defaultValue="B"><option value="B">B 型（5 个候选）</option><option value="A">A 型（自由落子）</option></select>
        </label>
        <label>
          <span>每谱最多出题</span>
          <input name="maxProblemsPerGame" type="number" min="1" max="100" step="1" defaultValue="10" />
        </label>
        <label>
          <span>题目制作者</span>
          <input name="problemCreator" type="text" placeholder="例如 tuxy" />
        </label>
        <label>
          <span>所属题集</span>
          <input name="problemCollection" type="text" placeholder="可选，例如 野狐7D错题集" />
        </label>
        <label className="checkbox-row">
          <span>分析黑棋</span>
          <input name="includeBlack" type="checkbox" defaultChecked />
        </label>
        <label className="checkbox-row">
          <span>分析白棋</span>
          <input name="includeWhite" type="checkbox" defaultChecked />
        </label>
        <p className="dialog-hint batch-picker-status">
          {pickerStatus || "先选择棋谱和输出目录；点击开始批量任务后才会分析并生成 TSG。"}
        </p>
        <p className="dialog-hint">出题按胜率损失从大到小截取每谱上限；B 型继续执行拟人候选、强 AI 深度复核及胜率损失评分。</p>
        <section className="batch-job-console" aria-label="Batch job console">
          <div className="batch-job-console-title">Job Console</div>
          <pre ref={consoleRef}>{logs.length > 0 ? logs.join("\n") : "等待开始批量任务..."}</pre>
        </section>
        <div className="dialog-actions">
          <input type="button" disabled={isRunning} onClick={startBatch} value="开始批量任务" />
          <button type="button" onClick={onStop} disabled={!isRunning}>终止</button>
        </div>
      </form>
    </div>
  );
}
