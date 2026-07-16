import type { ProblemItem } from "../research/types";
import type { SolvableProblemType } from "../problems/problemType";

export type ProblemSolveAnswer = { moveName: string; score: number };
export const PROBLEM_TAGS = ["中盘", "定式", "对杀", "死活", "收气", "官子", "打入", "做活", "手筋"] as const;

type Props = {
  answers: Record<string, ProblemSolveAnswer>;
  currentIndex: number;
  problem: ProblemItem;
  queueLength: number;
  selectedRank: number | null;
  selectedMoveName: string | null;
  problemType: SolvableProblemType;
  reviewMode: boolean;
  onSelect: (rank: number) => void;
  onSubmit: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onOpenLibrary: () => void;
  onReview: () => void;
  onBackToResult: () => void;
  onChooseMore: () => void;
  onExitSolve: () => void;
  onTag: (tag: string) => void;
  taggedTags: ReadonlySet<string>;
};

export function ProblemSolvePanel({ answers, currentIndex, problem, queueLength, selectedRank, selectedMoveName, problemType, reviewMode, onSelect, onSubmit, onPrevious, onNext, onOpenLibrary, onReview, onBackToResult, onChooseMore, onExitSolve, onTag, taggedTags }: Props) {
  const currentAnswer = answers[problem.id];
  const allFinished = queueLength > 0 && Object.keys(answers).length >= queueLength;
  const answerValues = Object.values(answers);
  const totalScore = answerValues.reduce((sum, answer) => sum + answer.score, 0);
  const full = answerValues.filter((answer) => answer.score === 10).length;
  const partial = answerValues.filter((answer) => answer.score > 0 && answer.score < 10).length;
  const wrong = answerValues.filter((answer) => answer.score === 0).length;
  return (
    <div className="problem-solve-panel">
      <header>
        <div><small>做题进度</small><h2>{currentIndex + 1} / {queueLength}</h2></div>
        <button type="button" onClick={onOpenLibrary}>题目列表</button>
      </header>
      <section className="problem-solve-prompt">
        <strong>{reviewMode ? "本题复盘" : `${problemType} 型 · ${problem.color === "black" ? "黑先" : "白先"}`}</strong>
        <span>{reviewMode ? "棋盘和下表显示题目保存的 AI 评分" : problem.prompt || "请选择最佳下一手"}</span>
      </section>
      {reviewMode ? <section className="problem-answer-review">
        <div className="problem-review-heading"><strong>候选点 AI 评分</strong><button type="button" onClick={onBackToResult}>返回答题结果</button></div>
        <div className="problem-review-table">
          {problem.candidateScores.map((candidate, index) => {
            const winrate = candidate.evaluatedWinrate ?? candidate.winrate;
            const visits = candidate.evaluationVisits ?? candidate.visits;
            return <div className={`${candidate.moveName === problem.fullScoreMove ? "correct" : ""} ${candidate.moveName === currentAnswer?.moveName ? "chosen" : ""}`} key={candidate.moveName}>
              <b>{String.fromCharCode(65 + index)}</b>
              <strong>{candidate.moveName}</strong>
              <span>{candidate.score}/10 分</span>
              <span>胜率 {winrate.toFixed(1)}%</span>
              <span>损失 {(candidate.winrateLoss ?? Math.max(0, (problem.candidateScores[0]?.winrate ?? winrate) - winrate)).toFixed(1)}%</span>
              <span>{visits.toLocaleString()} visits</span>
            </div>;
          })}
        </div>
      </section> : problemType === "B" ? <fieldset disabled={Boolean(currentAnswer)}>
        <legend>选择答案</legend>
        {problem.candidateScores.slice(0, 5).map((candidate, index) => (
          <label className={selectedRank === candidate.rank ? "selected" : ""} key={candidate.moveName}>
            <input type="radio" name="problem-answer" checked={selectedRank === candidate.rank} onChange={() => onSelect(candidate.rank)} />
            <b>{String.fromCharCode(65 + index)}</b><span>{candidate.moveName}</span>
          </label>
        ))}
      </fieldset> : <section className="problem-free-answer">
        <strong>请直接在棋盘上落子</strong>
        <span>{selectedMoveName ? `已选择 ${selectedMoveName}` : "题面不显示任何候选提示"}</span>
      </section>}
      {!currentAnswer ? (
        <button className="problem-submit-answer" type="button" disabled={problemType === "A" ? !selectedMoveName : selectedRank === null} onClick={onSubmit}>提交答案</button>
      ) : (
        <div className={`problem-answer-feedback ${currentAnswer.score === 10 ? "full" : ""}`}>
          <strong>本题 {currentAnswer.score} / 10 分</strong>
          <span>你的答案 {currentAnswer.moveName}</span>
          <span>正确答案 {problem.fullScoreMove}</span>
          <button className="problem-review-answer" type="button" onClick={onReview}>复盘本题 · 查看 AI 评分</button>
        </div>
      )}
      {currentAnswer ? <section className="problem-tag-picker">
        <strong>标记题目</strong>
        <div>
          {PROBLEM_TAGS.map((tag) => <button className={taggedTags.has(tag) ? "selected" : ""} disabled={taggedTags.has(tag)} key={tag} onClick={() => onTag(tag)} type="button">{tag}</button>)}
        </div>
      </section> : null}
      <nav>
        <button type="button" disabled={currentIndex <= 0} onClick={onPrevious}>上一题</button>
        <button type="button" disabled={!currentAnswer || currentIndex >= queueLength - 1} onClick={onNext}>下一题</button>
      </nav>
      {allFinished ? (
        <section className="problem-score-summary">
          <small>全部完成</small>
          <strong>{totalScore} / {queueLength * 10} 分</strong>
          <span>满分 {full} · 部分分 {partial} · 0 分 {wrong}</span>
          <div className="problem-finish-actions">
            <button type="button" onClick={onChooseMore}>重新选题</button>
            <button type="button" onClick={onExitSolve}>结束做题，返回复盘</button>
          </div>
        </section>
      ) : <p className="problem-answer-hint">{problemType === "A" ? "在棋盘任意合法空点作答。" : "也可以直接点击棋盘上的 A–E。"}</p>}
    </div>
  );
}
