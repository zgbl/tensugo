import { useEffect, useState } from "react";
import type { ProblemLibraryItem } from "../engine/tauriEngine";
import type { SolvableProblemType } from "../problems/problemType";

type Props = {
  error: string;
  loading: boolean;
  open: boolean;
  problems: ProblemLibraryItem[];
  onClose: () => void;
  onOpenRange: (startIndex: number, endIndex: number) => void;
  onOpenRandom: (count: number) => void;
  problemType: SolvableProblemType;
  onProblemTypeChange: (problemType: SolvableProblemType) => void;
};

export function ProblemLibraryDialog({ error, loading, open, problems, onClose, onOpenRange, onOpenRandom, problemType, onProblemTypeChange }: Props) {
  const count = problems.length;
  const [start, setStart] = useState(1);
  const [end, setEnd] = useState(Math.max(1, count));
  const [randomCount, setRandomCount] = useState(Math.min(30, Math.max(1, count)));
  useEffect(() => {
    if (!open) return;
    setStart(1);
    setEnd(Math.max(1, count));
    setRandomCount(Math.min(30, Math.max(1, count)));
  }, [count, open, problemType]);
  if (!open) return null;
  const normalizedStart = Math.max(1, Math.min(count || 1, start));
  const normalizedEnd = Math.max(normalizedStart, Math.min(count || 1, end));
  return (
    <div className="dialog-backdrop" role="presentation">
      <form className="problem-library-dialog" onSubmit={(event) => {
        event.preventDefault();
        onOpenRange(normalizedStart - 1, normalizedEnd - 1);
      }}>
        <header className="problem-library-title">
          <div><h2>题库</h2><span>{loading ? "读取中…" : `${count} 道题`}</span></div>
          <button type="button" onClick={onClose} aria-label="关闭题库">×</button>
        </header>
        <div className="problem-library-type" role="group" aria-label="做题类型">
          <button type="button" className={problemType === "A" ? "active" : ""} onClick={() => onProblemTypeChange("A")}><b>A 型题</b><span>自由落子，无提示</span></button>
          <button type="button" className={problemType === "B" ? "active" : ""} onClick={() => onProblemTypeChange("B")}><b>B 型题</b><span>显示 5 个候选</span></button>
        </div>
        {error ? <p className="problem-library-error">{error}</p> : null}
        <div className="problem-library-list" role="list">
          {problems.map((problem, index) => (
            <button
              className={`problem-library-row ${index + 1 >= normalizedStart && index + 1 <= normalizedEnd ? "selected" : ""}`}
              type="button"
              role="listitem"
              key={problem.id}
              onClick={(event) => {
                const row = index + 1;
                if (event.shiftKey) {
                  setStart(Math.min(normalizedStart, row));
                  setEnd(Math.max(normalizedEnd, row));
                } else {
                  setStart(row);
                  setEnd(row);
                }
              }}
            >
              <b>{index + 1}</b><code>{problem.id}</code>
              <span>{problem.sourceFileName || "未命名棋谱"} · 第 {problem.moveNumber} 手</span>
            </button>
          ))}
          {!loading && count === 0 ? <p>数据库中还没有题目。</p> : null}
        </div>
        <footer className="problem-library-range">
          <span className="problem-library-selection">已选 {count > 0 ? normalizedEnd - normalizedStart + 1 : 0} 题</span>
          <button type="button" className="secondary" disabled={count === 0} onClick={() => { setStart(1); setEnd(Math.max(1, count)); }}>全部</button>
          <label>从 <input name="start" type="number" min="1" max={Math.max(1, count)} value={normalizedStart} onChange={(event) => setStart(Number(event.target.value) || 1)} /></label>
          <label>到 <input name="end" type="number" min={normalizedStart} max={Math.max(1, count)} value={normalizedEnd} onChange={(event) => setEnd(Number(event.target.value) || normalizedStart)} /></label>
          <button type="submit" disabled={loading || count === 0}>开始做题</button>
          <span className="problem-library-random-label">随机抽取</span>
          <input aria-label="随机抽题数量" className="problem-library-random-count" type="number" min="1" max={Math.max(1, count)} value={Math.min(Math.max(1, randomCount), Math.max(1, count))} onChange={(event) => setRandomCount(Number(event.target.value) || 1)} />
          <button className="random" type="button" disabled={loading || count === 0} onClick={() => onOpenRandom(Math.min(Math.max(1, randomCount), count))}>随机开始</button>
        </footer>
      </form>
    </div>
  );
}
