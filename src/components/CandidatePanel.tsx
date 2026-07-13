import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import type { EngineCandidateMove, ReviewAnalysisPoint } from "../engine/types";
import { buildBoardPosition } from "../game/boardRules";
import type { BranchTreeRow, StoneColor } from "../game/gameTree";
import type { ReviewStone } from "../game/sampleGame";
import type { ProblemCandidateScore } from "../research/types";

const placeholderRows = [
  { rank: 1, move: "T2", winrate: "72.0", visits: "123k", delta: "90.6", scoreLead: "3.4" },
  { rank: 2, move: "Q11", winrate: "64.4", visits: "3.7k", delta: "2.7", scoreLead: "2.3" },
  { rank: 3, move: "R11", winrate: "65.2", visits: "3.4k", delta: "2.5", scoreLead: "2.4" },
  { rank: 4, move: "K3", winrate: "63.0", visits: "2.6k", delta: "1.9", scoreLead: "2.0" },
  { rank: 5, move: "O12", winrate: "62.6", visits: "1.4k", delta: "1.0", scoreLead: "1.8" },
  { rank: 6, move: "P16", winrate: "64.5", visits: "736", delta: "0.5", scoreLead: "2.1" },
  { rank: 7, move: "N11", winrate: "62.1", visits: "477", delta: "0.4", scoreLead: "1.9" },
  { rank: 8, move: "J4", winrate: "53.0", visits: "162", delta: "0.1", scoreLead: "0.7" },
  { rank: 9, move: "K4", winrate: "50.5", visits: "85", delta: "0.1", scoreLead: "0.4" }
];

type CandidatePanelProps = {
  baseStones: ReviewStone[];
  boardSize: number;
  candidates: EngineCandidateMove[];
  candidateListVisible: boolean;
  currentMoveNumber: number;
  nextColor: StoneColor;
  previewCandidate: EngineCandidateMove | null;
  problemCreateMode: boolean;
  problemEditorActive: boolean;
  problemPositionHash: string | null;
  problemSaveStatus: string;
  problemSaving: boolean;
  totalMoves: number;
  branchRows: BranchTreeRow[];
  selectedNodeId: string;
  onCandidateListVisibleChange: (visible: boolean) => void;
  onBranchNodeClick: (nodeId: string) => void;
  onPreviewCandidate: (rank: number | null) => void;
  onCreateProblem: () => void;
  onProblemClose: () => void;
  problemMoveNumbers: Set<number>;
  problemFullScoreMove: string | null;
  onProblemClick: (moveNumber: number) => void;
  problemSelectedMoveNames: Set<string>;
  onProblemCandidateToggle: (moveName: string) => void;
  onProblemCandidateScoreChange: (moveName: string, score: number) => void;
  onProblemEditorActiveChange: (active: boolean) => void;
  onProblemSave: () => void;
  problemReviewActive: boolean;
  problemSelectedCandidates: ProblemCandidateScore[];
  onProblemCandidateReorder: (fromIndex: number, toIndex: number) => void;
};

export function CandidatePanel({
  baseStones,
  boardSize,
  candidates,
  candidateListVisible,
  currentMoveNumber,
  nextColor,
  previewCandidate,
  problemCreateMode,
  problemEditorActive,
  problemPositionHash,
  problemSaveStatus,
  problemSaving,
  totalMoves: _totalMoves,
  branchRows,
  selectedNodeId,
  onCandidateListVisibleChange,
  onBranchNodeClick,
  onPreviewCandidate,
  onCreateProblem,
  onProblemClose,
  problemMoveNumbers,
  problemFullScoreMove,
  onProblemClick,
  problemSelectedMoveNames,
  onProblemCandidateToggle,
  onProblemCandidateScoreChange,
  onProblemEditorActiveChange,
  onProblemSave,
  problemReviewActive,
  problemSelectedCandidates,
  onProblemCandidateReorder
}: CandidatePanelProps) {
  const branchTreeRef = useRef<HTMLDivElement | null>(null);
  const [selectedProblemMoveName, setSelectedProblemMoveName] = useState<string | null>(null);
  const hasCandidates = candidates.length > 0;
  const sourceRows = hasCandidates ? (problemReviewActive ? candidates.filter((candidate) => !problemSelectedMoveNames.has(candidate.moveName)) : candidates) : null;
  const bestWinrate = candidates[0]?.winrate ?? 0;
  const rows = sourceRows
    ? sourceRows.map((candidate) => ({
        rank: candidate.rank,
        move: candidate.moveName,
        winrate: candidate.winrate.toFixed(1),
        visits: formatVisits(candidate.visits),
        delta: "-",
        scoreLead: candidate.scoreLead.toFixed(1),
        winrateLoss: candidate.visits > 0 ? `${Math.max(0, bestWinrate - candidate.winrate).toFixed(1)}%` : "待评估",
        pv: candidate.pv
      }))
    : placeholderRows.map((row) => ({ ...row, pv: [] as string[], winrateLoss: "-" }));
  const miniLines = Array.from({ length: boardSize }, (_, index) => index);
  const preview = previewCandidate ?? candidates[0] ?? null;
  const pvStones = preview
    ? buildPvStones(baseStones, boardSize, currentMoveNumber, nextColor, preview)
    : [];
  const miniPointStyle = (x: number, y: number) => ({
    left: `${(x / (boardSize - 1)) * 100}%`,
    top: `${(y / (boardSize - 1)) * 100}%`
  });

  useEffect(() => {
    const tree = branchTreeRef.current;
    const activeNode = tree?.querySelector<HTMLElement>(".branch-node.active");
    activeNode?.scrollIntoView({ block: "center", inline: "nearest" });
  }, [selectedNodeId, branchRows]);

  useEffect(() => {
    if (selectedProblemMoveName && !problemSelectedMoveNames.has(selectedProblemMoveName)) {
      setSelectedProblemMoveName(null);
    }
  }, [problemSelectedMoveNames, selectedProblemMoveName]);

  return (
    <>
      <div className="branch-tree" aria-label="分支树" ref={branchTreeRef}>
        {branchRows.length === 0 ? (
          <div className="branch-tree-empty">空棋谱</div>
        ) : (
          branchRows.map((row) => (
            <button
              type="button"
              className={[
                "branch-node",
                row.nodeId === selectedNodeId ? "active" : "",
                row.isMainLine ? "main-line" : "side-line",
                row.isLeaf ? "leaf" : ""
              ].filter(Boolean).join(" ")}
              key={row.nodeId}
              onClick={() => onBranchNodeClick(row.nodeId)}
              style={{ "--branch-depth": row.depth } as CSSProperties}
              title={`第 ${row.moveNumber} 手`}
            >
              <span className={`branch-stone ${row.color}`} />
              <span className="branch-label">{row.label}</span>
              {problemMoveNumbers.has(row.moveNumber) ? (
                <span
                  className="branch-problem-marker"
                  title="打开出题 REVIEW"
                  onClick={(event) => {
                    event.stopPropagation();
                    onProblemClick(row.moveNumber);
                  }}
                >题</span>
              ) : null}
            </button>
          ))
        )}
      </div>
      <div className={candidateListVisible ? "panel-section candidate-section" : "panel-section candidate-section collapsed"}>
        <div className="panel-heading-row">
          <h2>候选点</h2>
          <button type="button" onClick={() => onCandidateListVisibleChange(!candidateListVisible)}>
            {candidateListVisible ? "隐藏" : "显示"}
          </button>
        </div>
        {candidateListVisible ? (
          <div className="candidate-table-wrap">
            {problemReviewActive && !problemCreateMode ? (
              <section className="problem-selected-section">
                <h3>已选入题 · 拖拽排序</h3>
                <div className="problem-selected-chips">
                  {problemSelectedCandidates.map((candidate, index) => (
                    <span
                      className="problem-selected-chip"
                      draggable
                      key={candidate.moveName}
                      onDragStart={(event) => event.dataTransfer.setData("text/plain", String(index))}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        onProblemCandidateReorder(Number(event.dataTransfer.getData("text/plain")), index);
                      }}
                    >
                      <b>{index + 1}</b> {candidate.moveName}
                      <label>
                        分数
                        <input
                          aria-label={`${candidate.moveName} 分数`}
                          type="number"
                          min="0"
                          max="10"
                          step="1"
                          value={candidate.score}
                          disabled={candidate.moveName === problemFullScoreMove}
                          onChange={(event) => onProblemCandidateScoreChange(candidate.moveName, Number(event.target.value))}
                        />
                      </label>
                      <button type="button" aria-label={`删除 ${candidate.moveName}`} onClick={() => onProblemCandidateToggle(candidate.moveName)}>×</button>
                    </span>
                  ))}
                  {problemSelectedCandidates.length === 0 ? <em>尚未选择入题点</em> : null}
                </div>
              </section>
            ) : null}
            {problemReviewActive ? <h3 className="problem-candidate-heading">AI 待选候选</h3> : null}
            <table className="candidate-table">
              <thead>
                <tr>
                  <th>序号</th>
                  <th>点位</th>
                  <th>胜率</th>
                  <th>胜损</th>
                  <th>计算量</th>
                  <th>占比</th>
                  <th>目差</th>
                  {problemReviewActive ? <th>操作</th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.move}
                    className={preview?.rank === row.rank ? "selected" : ""}
                    onMouseEnter={hasCandidates ? () => onPreviewCandidate(row.rank) : undefined}
                    onFocus={hasCandidates ? () => onPreviewCandidate(row.rank) : undefined}
                    onClick={hasCandidates ? () => onPreviewCandidate(row.rank) : undefined}
                  >
                    <td>{row.rank}</td>
                    <td>{row.move}</td>
                    <td>{row.winrate}</td>
                    <td>{row.winrateLoss}</td>
                    <td>{row.visits}</td>
                    <td>{row.delta}</td>
                    <td>{row.scoreLead}</td>
                    {problemReviewActive ? (
                      <td>
                        <button type="button" className="problem-candidate-toggle" onClick={() => onProblemCandidateToggle(row.move)}>
                          加入
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
      {problemCreateMode ? (
        <div className="panel-section problem-editor-section">
          <div className="problem-editor-heading">
            <h2>题目选点</h2>
            <span>第 {currentMoveNumber + 1} 手</span>
          </div>
          {problemReviewActive ? (
            <>
              <div className="problem-selected-list">
                {problemSelectedCandidates.map((candidate, index) => (
                  <div
                    className={`problem-selected-row ${selectedProblemMoveName === candidate.moveName ? "selected" : ""}`}
                    key={candidate.moveName}
                    onClick={() => setSelectedProblemMoveName(candidate.moveName)}
                  >
                    <b>{index + 1}</b>
                    <strong>{candidate.moveName}</strong>
                    {candidate.moveName === problemFullScoreMove ? <em>正确答案</em> : null}
                    <label onClick={(event) => event.stopPropagation()}>
                      分数
                      <input
                        aria-label={`${candidate.moveName} 分数`}
                        type="number"
                        min="0"
                        max="10"
                        step="1"
                        value={candidate.score}
                        disabled={candidate.moveName === problemFullScoreMove}
                        onChange={(event) => onProblemCandidateScoreChange(candidate.moveName, Number(event.target.value))}
                      />
                    </label>
                  </div>
                ))}
                {problemSelectedCandidates.length === 0 ? <p>尚未选择题目选点。</p> : null}
              </div>
              <div className="problem-position-hash" title={problemPositionHash ?? ""}>局面校验：{problemPositionHash ?? "未生成"}</div>
              <div className="problem-editor-actions">
                <button type="button" className={problemEditorActive ? "active" : ""} onClick={() => onProblemEditorActiveChange(true)}>增加候选点</button>
                <button
                  type="button"
                  disabled={!selectedProblemMoveName || selectedProblemMoveName === problemFullScoreMove}
                  onClick={() => {
                    if (selectedProblemMoveName) {
                      onProblemCandidateToggle(selectedProblemMoveName);
                      setSelectedProblemMoveName(null);
                    }
                  }}
                >删除候选点</button>
                <button type="button" disabled={problemSaving} onClick={onProblemSave}>{problemSaving ? "保存中…" : "保存题目"}</button>
                <button type="button" onClick={onProblemClose}>关闭草稿</button>
              </div>
              {problemEditorActive ? <p className="problem-editor-hint">在上方候选点列表点击“加入”，也可以直接点击棋盘交叉点增加候选。</p> : null}
              {problemSaveStatus ? <p className={problemSaveStatus.startsWith("保存失败") ? "problem-save-error" : "problem-save-status"}>{problemSaveStatus}</p> : null}
            </>
          ) : (
            <div className="problem-create-empty">
              <p>出题模式 · 当前第 {currentMoveNumber} 手局面</p>
              <p>{candidates.length > 0 ? `AI 候选 ${candidates.length} 个` : "请先开启 AI 分析，等待候选点。"}</p>
              <button type="button" disabled={candidates.length === 0} onClick={onCreateProblem}>用当前局面创建题目</button>
            </div>
          )}
        </div>
      ) : (
        <div className="panel-section branch-section">
          <h2>变化图 / PV</h2>
          <div className="pv-line">{preview?.pv.length ? preview.pv.join(" ") : "暂无变化"}</div>
          <div className="mini-board">
            <div className="mini-board-plane">
              {miniLines.map((line) => <span className="mini-grid-line horizontal" key={`mini-h-${line}`} style={{ top: `${(line / (boardSize - 1)) * 100}%` }} />)}
              {miniLines.map((line) => <span className="mini-grid-line vertical" key={`mini-v-${line}`} style={{ left: `${(line / (boardSize - 1)) * 100}%` }} />)}
              {pvStones.map((stone) => (
                <span key={`${stone.moveNumber}-${stone.x}-${stone.y}`} className={`mini-stone ${stone.color} ${stone.isPv ? "pv-stone" : ""}`} style={miniPointStyle(stone.x, stone.y)}>{stone.pvIndex ?? ""}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

type ReviewGraphProps = {
  currentMoveNumber: number;
  points: ReviewAnalysisPoint[];
  totalMoves: number;
  onJump: (moveNumber: number) => void;
};

export function ReviewGraph({ currentMoveNumber, points, totalMoves, onJump }: ReviewGraphProps) {
  const [hoveredPoint, setHoveredPoint] = useState<(ReviewAnalysisPoint & { x: number; y: number }) | null>(null);
  const width = 300;
  const height = 116;
  const paddingLeft = 25;
  const paddingRight = 10;
  const paddingTop = 10;
  const paddingBottom = 22;
  const usableWidth = width - paddingLeft - paddingRight;
  const usableHeight = height - paddingTop - paddingBottom;
  const moveMax = Math.max(1, totalMoves);
  const dedupedPoints = Array.from(
    points
      .filter(
        (point) =>
          point.moveNumber >= 0 &&
          point.moveNumber <= moveMax &&
          Number.isFinite(point.winrate) &&
          Number.isFinite(point.scoreLead) &&
          Number.isFinite(point.visits) &&
          point.visits > 0
      )
      .reduce((byMove, point) => byMove.set(point.moveNumber, point), new Map<number, ReviewAnalysisPoint>())
      .values()
  ).sort((a, b) => a.moveNumber - b.moveNumber);
  const plotPoints = dedupedPoints.map((point) => ({
      ...point,
      x: paddingLeft + (point.moveNumber / moveMax) * usableWidth,
      y: paddingTop + ((100 - point.winrate) / 100) * usableHeight
    }));
  const path = plotPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");
  const currentX = paddingLeft + (Math.max(0, Math.min(moveMax, currentMoveNumber)) / moveMax) * usableWidth;
  const currentPoint = plotPoints.find((point) => point.moveNumber === currentMoveNumber);
  const latestPoint = dedupedPoints.find((point) => point.moveNumber === currentMoveNumber) ?? dedupedPoints.at(-1);
  const pointForEvent = (event: MouseEvent<SVGSVGElement>) => {
    if (plotPoints.length === 0) return null;
    const rect = event.currentTarget.getBoundingClientRect();
    const targetX = paddingLeft + Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * usableWidth;
    return plotPoints.reduce((closest, point) => Math.abs(point.x - targetX) < Math.abs(closest.x - targetX) ? point : closest);
  };

  const handleClick = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    onJump(Math.round(ratio * moveMax));
  };

  return (
    <div className="review-graph">
      <div className="review-graph-head">
        <span className="review-graph-title"><i className="graph-legend-black" />黑方胜率</span>
        <span className="review-graph-scale">优势区间 50% 以上</span>
      </div>
      <svg preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`} role="button" tabIndex={0} onClick={handleClick} onMouseMove={(event) => setHoveredPoint(pointForEvent(event))} onMouseLeave={() => setHoveredPoint(null)} aria-label="黑方胜率变化图，悬停查看胜率和目差">
        <rect className="graph-plot-bg" x={paddingLeft} y={paddingTop} width={usableWidth} height={usableHeight} rx="3" />
        {[0, 50, 100].map((tick) => {
          const y = paddingTop + ((100 - tick) / 100) * usableHeight;
          return (
            <g key={tick}>
              <line className={tick === 50 ? "graph-grid graph-mid" : "graph-grid"} x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} />
              <text className="graph-axis-label" x={paddingLeft - 5} y={y + 3} textAnchor="end">{tick}</text>
            </g>
          );
        })}
        {[0.25, 0.5, 0.75].map((ratio) => {
          const x = paddingLeft + ratio * usableWidth;
          return <line className="graph-grid graph-vertical" key={ratio} x1={x} y1={paddingTop} x2={x} y2={height - paddingBottom} />;
        })}
        {path ? <path className="graph-winrate-line" d={path} /> : null}
        <line className="graph-current-line" x1={currentX} y1={paddingTop} x2={currentX} y2={height - paddingBottom} />
        {currentPoint ? <circle className="graph-current-ring" cx={currentPoint.x} cy={currentPoint.y} r="5.2" /> : null}
        {hoveredPoint ? (
          <g className="graph-hover">
            <line className="graph-hover-line" x1={hoveredPoint.x} y1={paddingTop} x2={hoveredPoint.x} y2={height - paddingBottom} />
            <circle className="graph-hover-point" cx={hoveredPoint.x} cy={hoveredPoint.y} r="4.2" />
          </g>
        ) : null}
      </svg>
      {hoveredPoint ? (
        <div
          className="graph-tooltip-html"
          style={{
            left: `${(hoveredPoint.x / width) * 100}%`,
            top: `${((hoveredPoint.y < 38 ? hoveredPoint.y + 8 : hoveredPoint.y - 34) / height) * 100}%`
          }}
        >
          <span>第 {hoveredPoint.moveNumber} 手</span>
          <span>黑 {hoveredPoint.winrate.toFixed(1)}% · {hoveredPoint.scoreLead.toFixed(1)}目</span>
        </div>
      ) : null}
      <div className="review-graph-meta">
        <span>第 {currentMoveNumber} / {totalMoves} 手</span>
        <span>
          {latestPoint
            ? `黑 ${latestPoint.winrate.toFixed(1)}% / ${latestPoint.scoreLead.toFixed(1)}目`
            : "等待分析点"}
        </span>
      </div>
    </div>
  );
}

type MiniStone = ReviewStone & {
  isPv?: boolean;
  pvIndex?: number;
};

function buildPvStones(
  baseStones: ReviewStone[],
  boardSize: number,
  currentMoveNumber: number,
  nextColor: StoneColor,
  candidate: EngineCandidateMove
): MiniStone[] {
  const baseMoves = baseStones.map(({ color, moveNumber, x, y }) => ({ color, moveNumber, x, y }));
  const pvMoves = candidate.pv
    .map((moveName, index) => {
      const point = gtpPointToBoardPoint(moveName, boardSize);
      if (!point) {
        return null;
      }
      return {
        color: index % 2 === 0 ? nextColor : opposite(nextColor),
        moveNumber: currentMoveNumber + index + 1,
        pvIndex: index + 1,
        x: point.x,
        y: point.y
      };
    })
    .filter((move): move is { color: StoneColor; moveNumber: number; pvIndex: number; x: number; y: number } =>
      Boolean(move)
    );
  const position = buildBoardPosition([...baseMoves, ...pvMoves], boardSize, currentMoveNumber + pvMoves.length);
  const pvIndexByMoveNumber = new Map(pvMoves.map((move) => [move.moveNumber, move.pvIndex]));

  return position.stones.map((stone) => ({
    ...stone,
    isPv: pvIndexByMoveNumber.has(stone.moveNumber),
    pvIndex: pvIndexByMoveNumber.get(stone.moveNumber)
  }));
}

function gtpPointToBoardPoint(point: string, boardSize: number): { x: number; y: number } | null {
  if (!point || point.toLowerCase() === "pass") {
    return null;
  }
  const match = /^([A-HJ-Z])(\d+)$/i.exec(point);
  if (!match) {
    return null;
  }
  const labels = "ABCDEFGHJKLMNOPQRSTUVWXYZ";
  const x = labels.indexOf(match[1].toUpperCase());
  const row = Number(match[2]);
  const y = boardSize - row;
  if (x < 0 || x >= boardSize || !Number.isInteger(row) || y < 0 || y >= boardSize) {
    return null;
  }
  return { x, y };
}

function opposite(color: StoneColor): StoneColor {
  return color === "black" ? "white" : "black";
}

function formatVisits(visits: number): string {
  if (visits >= 1000) {
    return `${(visits / 1000).toFixed(1)}k`;
  }
  return visits.toString();
}
