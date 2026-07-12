import { boardIndexToLabel } from "../game/coordinates";
import type { CSSProperties, MouseEvent } from "react";
import type { EngineCandidateMove } from "../engine/types";
import type { ReviewStone } from "../game/sampleGame";

type BoardPlaceholderProps = {
  boardSize: number;
  candidates: EngineCandidateMove[];
  coordinateLabelsVisible: boolean;
  moveNumberDisplay: MoveNumberDisplayMode;
  pixelSize: number;
  stones: ReviewStone[];
  variationBaseMoveNumber?: number | null;
  onStoneClick: (moveNumber: number) => void;
  onPointClick: (x: number, y: number) => void;
  onCandidatePreview: (rank: number | null) => void;
  actualNextMove?: ReviewStone | null;
  candidateClickSelectOnly?: boolean;
  selectedCandidateRank?: number | null;
  suggestedCandidates?: EngineCandidateMove[];
};

export type MoveNumberDisplayMode = "all" | "last10" | "last1";

export function BoardPlaceholder({
  boardSize,
  candidates,
  coordinateLabelsVisible,
  moveNumberDisplay,
  pixelSize,
  stones,
  variationBaseMoveNumber = null,
  onStoneClick,
  onPointClick,
  onCandidatePreview,
  actualNextMove = null,
  candidateClickSelectOnly = false,
  selectedCandidateRank = null,
  suggestedCandidates = []
}: BoardPlaceholderProps) {
  const lines = Array.from({ length: boardSize }, (_, index) => index);
  const displayedCurrentMoveNumber = currentMoveNumber(stones);
  const rowGridStyle = { gridTemplateColumns: `repeat(${boardSize}, 1fr)` };
  const colGridStyle = { gridTemplateRows: `repeat(${boardSize}, 1fr)` };
  const candidateBubbleSize = Math.max(20, Math.min(42, pixelSize * 0.056));
  const candidateFontSize = Math.max(7, Math.min(14, candidateBubbleSize * 0.34));
  const candidateRankOffset = Math.max(2, candidateBubbleSize * 0.13);
  const occupiedPoints = new Set(stones.map((stone) => boardPointKey(stone.x, stone.y)));
  const candidatePoints = candidates
    .map((candidate) => ({
      candidate,
      point: gtpPointToBoardPoint(candidate.moveName, boardSize)
    }))
    .filter((item): item is { candidate: EngineCandidateMove; point: { x: number; y: number } } => {
      if (!item.point) {
        return false;
      }
      if (actualNextMove && item.point.x === actualNextMove.x && item.point.y === actualNextMove.y) {
        return false;
      }
      return !occupiedPoints.has(boardPointKey(item.point.x, item.point.y));
    });
  const suggestedPoints = suggestedCandidates
    .map((candidate) => ({ candidate, point: gtpPointToBoardPoint(candidate.moveName, boardSize) }))
    .filter((item): item is { candidate: EngineCandidateMove; point: { x: number; y: number } } => {
      if (!item.point || occupiedPoints.has(boardPointKey(item.point.x, item.point.y))) return false;
      return !actualNextMove || item.point.x !== actualNextMove.x || item.point.y !== actualNextMove.y;
    });
  const starPoints = [3, 9, 15].flatMap((y) => [3, 9, 15].map((x) => ({ y, x })));
  const pointStyle = (x: number, y: number) =>
    ({
      left: `${(x / (boardSize - 1)) * 100}%`,
      top: `${(y / (boardSize - 1)) * 100}%`
    }) as CSSProperties;
  const horizontalLineStyle = (y: number) =>
    ({
      top: `${(y / (boardSize - 1)) * 100}%`
    }) as CSSProperties;
  const verticalLineStyle = (x: number) =>
    ({
      left: `${(x / (boardSize - 1)) * 100}%`
    }) as CSSProperties;
  const handleBoardClick = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.round(((event.clientX - rect.left) / rect.width) * (boardSize - 1));
    const y = Math.round(((event.clientY - rect.top) / rect.height) * (boardSize - 1));
    onPointClick(x, y);
  };

  return (
    <div
      className={`board-wrap ${coordinateLabelsVisible ? "" : "coordinates-hidden"}`}
      style={{
        "--board-pixel-size": `${pixelSize}px`,
        "--candidate-bubble-size": `${candidateBubbleSize}px`,
        "--candidate-font-size": `${candidateFontSize}px`,
        "--candidate-rank-offset": `${candidateRankOffset}px`
      } as CSSProperties}
    >
      {coordinateLabelsVisible && (
        <>
          <div className="coord-row coord-row-top" style={rowGridStyle}>
            {lines.map((col) => (
              <span key={col}>{boardIndexToLabel(col)}</span>
            ))}
          </div>
          <div className="coord-col coord-col-left" style={colGridStyle}>
            {lines.map((row) => (
              <span key={row}>{boardSize - row}</span>
            ))}
          </div>
        </>
      )}
      <div className="board-placeholder">
        <div className="board-plane" onClick={handleBoardClick}>
          {lines.map((line) => (
            <span className="grid-line horizontal" key={`h-${line}`} style={horizontalLineStyle(line)} />
          ))}
          {lines.map((line) => (
            <span className="grid-line vertical" key={`v-${line}`} style={verticalLineStyle(line)} />
          ))}
          {starPoints.map((point) => (
            <i
              className="star-point"
              key={`${point.y}-${point.x}`}
              style={pointStyle(point.x, point.y)}
            />
          ))}
          {stones.map((stone) => (
            <span
              role="button"
              tabIndex={0}
              className={`stone ${stone.color} ${stone.isLast && !shouldShowStoneLabel(stone, variationBaseMoveNumber, moveNumberDisplay, displayedCurrentMoveNumber)
                  ? "last-move"
                  : ""
                }`}
              key={stone.moveNumber}
              style={pointStyle(stone.x, stone.y)}
              onClick={(event) => {
                event.stopPropagation();
                onStoneClick(stone.moveNumber);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onStoneClick(stone.moveNumber);
                }
              }}
              aria-label={`Jump to move ${stone.moveNumber}`}
            >
              {stoneLabel(stone, variationBaseMoveNumber, moveNumberDisplay, displayedCurrentMoveNumber)}
            </span>
          ))}
          {candidatePoints.map(({ candidate, point }) => (
            <b
              role="button"
              tabIndex={0}
              className={`candidate-bubble ${candidate.rank === 1 ? "best" : ""} ${candidate.rank === selectedCandidateRank ? "selected" : ""}`}
              key={candidate.moveName}
              style={pointStyle(point.x, point.y)}
              onClick={(event) => {
                event.stopPropagation();
                if (candidateClickSelectOnly) onCandidatePreview(candidate.rank);
                else onPointClick(point.x, point.y);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onPointClick(point.x, point.y);
                }
              }}
              onMouseEnter={() => onCandidatePreview(candidate.rank)}
              aria-label={`Play candidate ${candidate.moveName}`}
            >
              <em>{candidate.rank}</em>
              <span>{candidate.winrate.toFixed(1)}</span>
              <span>{formatVisits(candidate.visits)}</span>
            </b>
          ))}
          {suggestedPoints.map(({ candidate, point }) => (
            <button
              type="button"
              className="candidate-suggestion-ring"
              key={`suggested-${candidate.moveName}`}
              style={pointStyle(point.x, point.y)}
              onClick={(event) => {
                event.stopPropagation();
                onCandidatePreview(candidate.rank);
              }}
              title={`AI 待选 ${candidate.moveName}`}
            >{candidate.rank}</button>
          ))}
          {actualNextMove ? (
            <span aria-label="实战下一手" className="actual-next-move" style={pointStyle(actualNextMove.x, actualNextMove.y)} />
          ) : null}
        </div>
      </div>
      {coordinateLabelsVisible && (
        <>
          <div className="coord-row coord-row-bottom" style={rowGridStyle}>
            {lines.map((col) => (
              <span key={col}>{boardIndexToLabel(col)}</span>
            ))}
          </div>
          <div className="coord-col coord-col-right" style={colGridStyle}>
            {lines.map((row) => (
              <span key={row}>{boardSize - row}</span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function stoneLabel(
  stone: ReviewStone,
  variationBaseMoveNumber: number | null,
  moveNumberDisplay: MoveNumberDisplayMode,
  currentMoveNumber: number
): string | number {
  if (hasVariationLabel(stone, variationBaseMoveNumber)) {
    return stone.moveNumber - variationBaseMoveNumber;
  }
  if (moveNumberDisplay === "all") {
    return stone.moveNumber;
  }
  if (moveNumberDisplay === "last10" && stone.moveNumber > currentMoveNumber - 10) {
    return stone.moveNumber;
  }
  if (moveNumberDisplay === "last1" && stone.moveNumber === currentMoveNumber) {
    return stone.moveNumber;
  }
  return "";
}

function shouldShowStoneLabel(
  stone: ReviewStone,
  variationBaseMoveNumber: number | null,
  moveNumberDisplay: MoveNumberDisplayMode,
  currentMoveNumber: number
): boolean {
  return stoneLabel(stone, variationBaseMoveNumber, moveNumberDisplay, currentMoveNumber) !== "";
}

function currentMoveNumber(stones: ReviewStone[]): number {
  return stones.reduce((maxMove, stone) => Math.max(maxMove, stone.moveNumber), 0);
}

function hasVariationLabel(stone: ReviewStone, variationBaseMoveNumber: number | null): variationBaseMoveNumber is number {
  return variationBaseMoveNumber !== null && stone.moveNumber > variationBaseMoveNumber;
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

function boardPointKey(x: number, y: number): string {
  return `${x}:${y}`;
}

function formatVisits(visits: number): string {
  if (visits >= 1000) {
    return `${(visits / 1000).toFixed(visits >= 10000 ? 0 : 1)}k`;
  }
  return String(visits);
}
