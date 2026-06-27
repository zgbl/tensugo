const SGF_LETTERS = "abcdefghijklmnopqrstuvwxyz";
const BOARD_LETTERS = "ABCDEFGHJKLMNOPQRSTUVWXYZ";

export type BoardPoint = {
  row: number;
  col: number;
};

export function boardIndexToLabel(index: number): string {
  return BOARD_LETTERS[index] ?? "?";
}

export function pointToSgf(point: BoardPoint): string {
  return `${SGF_LETTERS[point.col] ?? ""}${SGF_LETTERS[point.row] ?? ""}`;
}

export function sgfToPoint(value: string): BoardPoint | null {
  if (value.length !== 2) {
    return null;
  }

  const col = SGF_LETTERS.indexOf(value[0]);
  const row = SGF_LETTERS.indexOf(value[1]);

  if (col < 0 || row < 0) {
    return null;
  }

  return { row, col };
}

