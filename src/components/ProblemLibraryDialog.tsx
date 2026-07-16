import type { ProblemLibraryItem } from "../engine/tauriEngine";
import type { SolvableProblemType } from "../problems/problemType";

type Props = {
  error: string;
  loading: boolean;
  open: boolean;
  problems: ProblemLibraryItem[];
  onClose: () => void;
  onOpenRange: (startIndex: number, endIndex: number) => void;
  problemType: SolvableProblemType;
  onProblemTypeChange: (problemType: SolvableProblemType) => void;
};

export function ProblemLibraryDialog({ error, loading, open, problems, onClose, onOpenRange, problemType, onProblemTypeChange }: Props) {
  if (!open) return null;
  const count = problems.length;
  return (
    <div className="dialog-backdrop" role="presentation">
      <form className="problem-library-dialog" onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const start = Math.max(1, Math.min(count, Number(form.get("start")) || 1));
        const end = Math.max(start, Math.min(count, Number(form.get("end")) || count));
        onOpenRange(start - 1, end - 1);
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
            <div className="problem-library-row" role="listitem" key={problem.id}>
              <b>{index + 1}</b><code>{problem.id}</code>
              <span>{problem.sourceFileName || "未命名棋谱"} · 第 {problem.moveNumber} 手</span>
            </div>
          ))}
          {!loading && count === 0 ? <p>数据库中还没有题目。</p> : null}
        </div>
        <footer className="problem-library-range">
          <label>从 <input name="start" type="number" min="1" max={Math.max(1, count)} defaultValue="1" /></label>
          <label>到 <input key={count} name="end" type="number" min="1" max={Math.max(1, count)} defaultValue={Math.max(1, count)} /></label>
          <button type="submit" disabled={loading || count === 0}>打开范围</button>
        </footer>
      </form>
    </div>
  );
}
