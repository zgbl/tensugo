export type OgsRankValue = {
  label: string;
  value: number;
};

const DAN_BASE = 30;
const PRO_BASE = 37;

export function parseOgsRank(input: number | string | undefined | null): OgsRankValue | null {
  if (input === null || typeof input === "undefined") {
    return null;
  }
  if (typeof input === "number" && Number.isFinite(input)) {
    return { label: formatOgsRank(input), value: input };
  }

  const trimmed = String(input).trim().toLowerCase();
  const match = trimmed.match(/^(\d+)\s*(k|kyu|d|dan|p|pro)$/);
  if (!match) {
    const numeric = Number(trimmed);
    return Number.isFinite(numeric) ? { label: formatOgsRank(numeric), value: numeric } : null;
  }

  const amount = Number(match[1]);
  const unit = match[2];
  if (unit === "k" || unit === "kyu") {
    return { label: `${amount}k`, value: 30 - amount };
  }
  if (unit === "d" || unit === "dan") {
    return { label: `${amount}d`, value: DAN_BASE + amount - 1 };
  }
  return { label: `${amount}p`, value: PRO_BASE + amount };
}

export function formatOgsRank(rank: number | undefined | null): string {
  if (rank === null || typeof rank === "undefined" || !Number.isFinite(rank)) {
    return "-";
  }
  if (rank >= PRO_BASE) {
    return `${Math.max(1, Math.round(rank - PRO_BASE))}p`;
  }
  if (rank >= DAN_BASE) {
    return `${Math.max(1, Math.round(rank - DAN_BASE + 1))}d`;
  }
  return `${Math.max(1, Math.round(30 - rank))}k`;
}

export function compareRank(left: number | undefined | null, right: number | undefined | null): number {
  const leftRank = parseOgsRank(left);
  const rightRank = parseOgsRank(right);
  if (!leftRank && !rightRank) {
    return 0;
  }
  if (!leftRank) {
    return -1;
  }
  if (!rightRank) {
    return 1;
  }
  return leftRank.value - rightRank.value;
}

export function filterByRankRange(rank: number | undefined | null, minRank?: string, maxRank?: string): boolean {
  const parsedRank = parseOgsRank(rank);
  if (!parsedRank) {
    return false;
  }
  const min = parseOgsRank(minRank);
  const max = parseOgsRank(maxRank);
  if (min && parsedRank.value < min.value) {
    return false;
  }
  if (max && parsedRank.value > max.value) {
    return false;
  }
  return true;
}
