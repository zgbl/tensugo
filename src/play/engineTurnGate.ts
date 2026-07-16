import type { StoneColor } from "../game/gameTree";

export type EngineTurnTicket = {
  color: StoneColor;
  id: number;
  moveCount: number;
  sessionId: string;
};

export type EngineTurnGate = {
  active: EngineTurnTicket | null;
  sequence: number;
};

export function createEngineTurnGate(): EngineTurnGate {
  return { active: null, sequence: 0 };
}

export function claimEngineTurn(
  gate: EngineTurnGate,
  sessionId: string,
  moveCount: number,
  color: StoneColor
): EngineTurnTicket | null {
  if (gate.active) return null;
  const ticket = { color, id: gate.sequence + 1, moveCount, sessionId };
  gate.sequence = ticket.id;
  gate.active = ticket;
  return ticket;
}

export function engineTurnIsCurrent(
  gate: EngineTurnGate,
  ticket: EngineTurnTicket,
  sessionId: string,
  moveCount: number,
  color: StoneColor
): boolean {
  return gate.active?.id === ticket.id
    && ticket.sessionId === sessionId
    && ticket.moveCount === moveCount
    && ticket.color === color;
}

export function releaseEngineTurn(gate: EngineTurnGate, ticket?: EngineTurnTicket): boolean {
  if (ticket && gate.active?.id !== ticket.id) return false;
  const hadActiveTurn = gate.active !== null;
  gate.active = null;
  return hadActiveTurn;
}
