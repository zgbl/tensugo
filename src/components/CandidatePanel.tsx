import { useEffect, useRef, type CSSProperties, type MouseEvent } from "react";
import type { EngineCandidateMove, ReviewAnalysisPoint } from "../engine/types";
import { buildBoardPosition } from "../game/boardRules";
import type { BranchTreeRow, StoneColor } from "../game/gameTree";
import type { ReviewStone } from "../game/sampleGame";

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
  totalMoves: number;
  branchRows: BranchTreeRow[];
  selectedNodeId: string;
  onCandidateListVisibleChange: (visible: boolean) => void;
  onBranchNodeClick: (nodeId: string) => void;
  onPreviewCandidate: (rank: number | null) => void;
};

export function CandidatePanel({
  baseStones,
  boardSize,
  candidates,
  candidateListVisible,
  currentMoveNumber,
  nextColor,
  previewCandidate,
  totalMoves: _totalMoves,
  branchRows,
  selectedNodeId,
  onCandidateListVisibleChange,
  onBranchNodeClick,
  onPreviewCandidate
}: CandidatePanelProps) {
  const branchTreeRef = useRef<HTMLDivElement | null>(null);
  const hasCandidates = candidates.length > 0;
  const sourceRows = hasCandidates ? candidates : null;
  const rows = sourceRows
    ? sourceRows.map((candidate) => ({
        rank: candidate.rank,
        move: candidate.moveName,
        winrate: candidate.winrate.toFixed(1),
        visits: formatVisits(candidate.visits),
        delta: "-",
        scoreLead: candidate.scoreLead.toFixed(1),
        pv: candidate.pv
      }))
    : placeholderRows.map((row) => ({ ...row, pv: [] as string[] }));
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
            <table className="candidate-table">
              <thead>
                <tr>
                  <th>序号</th>
                  <th>点位</th>
                  <th>胜率</th>
                  <th>计算量</th>
                  <th>占比</th>
                  <th>目差</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.move}
                    className={preview?.rank === row.rank ? "selected" : ""}
                    onMouseEnter={hasCandidates ? () => onPreviewCandidate(row.rank) : undefined}
                    onFocus={hasCandidates ? () => onPreviewCandidate(row.rank) : undefined}
                  >
                    <td>{row.rank}</td>
                    <td>{row.move}</td>
                    <td>{row.winrate}</td>
                    <td>{row.visits}</td>
                    <td>{row.delta}</td>
                    <td>{row.scoreLead}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
      <div className="panel-section branch-section">
        <h2>变化图 / PV</h2>
        <div className="pv-line">{preview?.pv.length ? preview.pv.join(" ") : "暂无变化"}</div>
        <div className="mini-board">
          <div className="mini-board-plane">
            {miniLines.map((line) => (
              <span
                className="mini-grid-line horizontal"
                key={`mini-h-${line}`}
                style={{ top: `${(line / (boardSize - 1)) * 100}%` }}
              />
            ))}
            {miniLines.map((line) => (
              <span
                className="mini-grid-line vertical"
                key={`mini-v-${line}`}
                style={{ left: `${(line / (boardSize - 1)) * 100}%` }}
              />
            ))}
            {pvStones.map((stone) => (
              <span
                key={`${stone.moveNumber}-${stone.x}-${stone.y}`}
                className={`mini-stone ${stone.color} ${stone.isPv ? "pv-stone" : ""}`}
                style={miniPointStyle(stone.x, stone.y)}
              >
                {stone.pvIndex ?? ""}
              </span>
            ))}
          </div>
        </div>
      </div>
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
  const width = 300;
  const height = 104;
  const paddingX = 12;
  const paddingY = 12;
  const usableWidth = width - paddingX * 2;
  const usableHeight = height - paddingY * 2;
  const moveMax = Math.max(1, totalMoves);
  const dedupedPoints = Array.from(
    points
      .filter((point) => point.moveNumber >= 0 && point.moveNumber <= moveMax)
      .reduce((byMove, point) => byMove.set(point.moveNumber, point), new Map<number, ReviewAnalysisPoint>())
      .values()
  ).sort((a, b) => a.moveNumber - b.moveNumber);
  const plotPoints = dedupedPoints.map((point) => ({
      ...point,
      x: paddingX + (point.moveNumber / moveMax) * usableWidth,
      y: paddingY + ((100 - point.winrate) / 100) * usableHeight
    }));
  const path = plotPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");
  const currentX = paddingX + (Math.max(0, Math.min(moveMax, currentMoveNumber)) / moveMax) * usableWidth;
  const currentPoint = plotPoints.find((point) => point.moveNumber === currentMoveNumber);
  const latestPoint = dedupedPoints.find((point) => point.moveNumber === currentMoveNumber) ?? dedupedPoints.at(-1);
  const visibleDots = plotPoints.filter((point, index) => {
    if (point.moveNumber === currentMoveNumber || index === 0 || index === plotPoints.length - 1) {
      return true;
    }
    return plotPoints.length <= 90 || index % Math.ceil(plotPoints.length / 45) === 0;
  });

  const handleClick = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    onJump(Math.round(ratio * moveMax));
  };

  return (
    <div className="review-graph">
      <svg viewBox={`0 0 ${width} ${height}`} role="button" tabIndex={0} onClick={handleClick}>
        <rect className="graph-plot-bg" x={paddingX} y={paddingY} width={usableWidth} height={usableHeight} rx="3" />
        {[25, 50, 75].map((tick) => {
          const y = paddingY + ((100 - tick) / 100) * usableHeight;
          return (
            <line
              className={tick === 50 ? "graph-grid graph-mid" : "graph-grid"}
              key={tick}
              x1={paddingX}
              y1={y}
              x2={width - paddingX}
              y2={y}
            />
          );
        })}
        {[0.25, 0.5, 0.75].map((ratio) => {
          const x = paddingX + ratio * usableWidth;
          return <line className="graph-grid graph-vertical" key={ratio} x1={x} y1={paddingY} x2={x} y2={height - paddingY} />;
        })}
        {path ? <path className="graph-winrate-line" d={path} /> : null}
        {visibleDots.map((point) => (
          <circle
            className={point.moveNumber === currentMoveNumber ? "graph-point current" : "graph-point"}
            cx={point.x}
            cy={point.y}
            key={point.moveNumber}
            r={point.moveNumber === currentMoveNumber ? 3.8 : 2.1}
          />
        ))}
        <line className="graph-current-line" x1={currentX} y1={paddingY} x2={currentX} y2={height - paddingY} />
        {currentPoint ? <circle className="graph-current-ring" cx={currentPoint.x} cy={currentPoint.y} r="5.2" /> : null}
      </svg>
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
