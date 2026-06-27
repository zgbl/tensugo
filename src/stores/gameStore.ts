import { createEmptyGameTree } from "../game/gameTree";

const initialGame = createEmptyGameTree();

export function useGameStore() {
  return {
    boardSize: initialGame.boardSize,
    komi: initialGame.komi,
    currentMoveNumber: 0
  };
}

