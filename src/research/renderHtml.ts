import type { ResearchAnalysisSnapshot, ResearchBlock, ResearchDocument } from "./types";
import { buildBoardPosition } from "../game/boardRules";
import { mainLineMovesFromTree, type GameTree } from "../game/gameTree";
import type { ReviewMove } from "../game/sampleGame";
import { parseGameRecord } from "../sgf/parseSgf";

export type ExportFormat = "pdf" | "html";
export type ExportLayoutVersion = "0.1" | "0.2";
export type ExportPageSize = "letter" | "a4";
export type ExportPageOrientation = "portrait" | "landscape";

export type ResearchExportSettings = {
  format: ExportFormat;
  layoutVersion: ExportLayoutVersion;
  pageSize: ExportPageSize;
  pageOrientation: ExportPageOrientation;
  boardSizeMm: number;
  pageMarginTopMm: number;
  pageMarginRightMm: number;
  pageMarginBottomMm: number;
  pageMarginLeftMm: number;
  boardEdgeMarginPx: number;
  variationsPerPage: number;
  rowGapMm: number;
  columnGapMm: number;
};

export const DEFAULT_RESEARCH_EXPORT_SETTINGS: ResearchExportSettings = {
  format: "pdf",
  layoutVersion: "0.1",
  pageSize: "letter",
  pageOrientation: "portrait",
  boardSizeMm: 115,
  pageMarginTopMm: 10,
  pageMarginRightMm: 10,
  pageMarginBottomMm: 10,
  pageMarginLeftMm: 10,
  boardEdgeMarginPx: 26,
  variationsPerPage: 2,
  rowGapMm: 3,
  columnGapMm: 4
};

export function renderResearchDocumentHtml(
  document: ResearchDocument,
  activeGameTree?: GameTree,
  exportSettings: ResearchExportSettings = DEFAULT_RESEARCH_EXPORT_SETTINGS
): string {
  if (exportSettings.layoutVersion === "0.2") {
    return renderResearchDocumentHtmlV2(document, activeGameTree, exportSettings);
  }
  const sourceMoves = resolveSourceMoves(document, activeGameTree);
  const entries = buildVariationEntries(document, sourceMoves);
  const pages = chunk(entries, exportSettings.variationsPerPage)
    .map((pageEntries) => `
      <section class="pdf-page">
        ${pageEntries.map((entry) => renderVariationEntry(entry, exportSettings)).join("\n")}
      </section>
    `)
    .join("\n");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(document.title)}</title>
  <meta name="description" content="${escapeAttr(document.subtitle ?? document.title)}" />
  <style>${articleCss(exportSettings)}</style>
</head>
<body>
  <article class="research-article">
    <header class="article-header">
      <h1>${escapeHtml(document.title)}</h1>
      <p>${escapeHtml(document.sourceGame.players.black)} vs ${escapeHtml(document.sourceGame.players.white)} · ${escapeHtml(document.sourceGame.fileName)} · 作者：${escapeHtml(document.author || "未填写")}</p>
    </header>
    ${entries.length > 0 ? pages : `<section class="pdf-page empty-page"><p>还没有可导出的变化图。</p></section>`}
  </article>
</body>
</html>`;
}

function renderResearchDocumentHtmlV2(
  document: ResearchDocument,
  activeGameTree: GameTree | undefined,
  exportSettings: ResearchExportSettings
): string {
  const sourceMoves = resolveSourceMoves(document, activeGameTree);
  const blocks = document.sections.flatMap((section) => section.blocks);
  const flowHtml = renderFlowBlocks(blocks, document, sourceMoves, exportSettings);
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(document.title)}</title>
  <meta name="description" content="${escapeAttr(document.subtitle ?? document.title)}" />
  <style>${articleCss(exportSettings)}${articleCssV2(exportSettings)}</style>
</head>
<body>
  <article class="research-article layout-v2">
    ${renderCoverPage(document)}
    <main class="document-flow">
      ${flowHtml || `<p class="empty-document">还没有正文内容。</p>`}
    </main>
  </article>
</body>
</html>`;
}

function renderFlowBlocks(
  blocks: ResearchBlock[],
  document: ResearchDocument,
  sourceMoves: ReviewMove[],
  exportSettings: ResearchExportSettings
): string {
  const html: string[] = [];
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (block.type === "variation") {
      const next = blocks[index + 1];
      const comment = next && (next.type === "paragraph" || next.type === "conclusion" || next.type === "quote") ? next : null;
      html.push(renderVariationEntry(buildVariationEntry(block, comment, sourceMoves), exportSettings));
      if (comment) {
        index += 1;
      }
      continue;
    }
    if (block.type === "paragraph" || block.type === "conclusion") {
      if (block.markdown.trim()) {
        html.push(`<section class="text-block">${renderMarkdown(block.markdown)}</section>`);
      }
      continue;
    }
    if (block.type === "heading") {
      html.push(`<h${block.level} class="doc-heading">${escapeHtml(block.text)}</h${block.level}>`);
      continue;
    }
    if (block.type === "quote") {
      html.push(`<section class="text-block"><blockquote>${escapeHtml(block.text)}</blockquote></section>`);
    }
  }
  if (!html.length && document.sections[0]?.blocks.length) {
    return `<p class="empty-document">当前文档没有可导出的正文块。</p>`;
  }
  return html.join("\n");
}

function buildVariationEntries(
  document: ResearchDocument,
  sourceMoves: ReviewMove[]
): Array<{ variation: Extract<ResearchBlock, { type: "variation" }>; comment: ResearchBlock | null; stones: ReviewMove[] }> {
  const blocks = document.sections.flatMap((section) => section.blocks);
  const fallbackComment =
    blocks.find((block) => block.type === "paragraph" || block.type === "conclusion" || block.type === "quote") ?? null;
  return blocks
    .map((block, index) => {
      if (block.type !== "variation") {
        return null;
      }
      const next = blocks[index + 1];
      const comment = next && (next.type === "paragraph" || next.type === "conclusion" || next.type === "quote") ? next : fallbackComment;
      return buildVariationEntry(block, comment, sourceMoves);
    })
    .filter(Boolean) as Array<{ variation: Extract<ResearchBlock, { type: "variation" }>; comment: ResearchBlock | null; stones: ReviewMove[] }>;
}

function buildVariationEntry(
  block: Extract<ResearchBlock, { type: "variation" }>,
  comment: ResearchBlock | null,
  sourceMoves: ReviewMove[]
): { variation: Extract<ResearchBlock, { type: "variation" }>; comment: ResearchBlock | null; stones: ReviewMove[] } {
  const variationMoves = block.sequence
    .map((point, offset) => gtpPointToMove(point, block.boardSize, block.fromMoveNumber + offset + 1))
    .filter((move): move is ReviewMove => Boolean(move));
  const allMoves = [...sourceMoves.slice(0, block.fromMoveNumber), ...variationMoves];
  return { variation: block, comment, stones: buildBoardPosition(allMoves, block.boardSize, allMoves.length).stones };
}

function renderVariationEntry(
  entry: { variation: Extract<ResearchBlock, { type: "variation" }>; comment: ResearchBlock | null; stones: ReviewMove[] },
  exportSettings: ResearchExportSettings
): string {
  const comment = renderComment(entry.comment);
  return `<section class="variation-row">
    <div class="board-column">
      ${renderBoardSvg(entry.variation.boardSize, entry.stones, entry.variation.sequence, exportSettings)}
      <p class="caption">${escapeHtml(entry.variation.caption || entry.variation.name)}</p>
    </div>
    <div class="comment-column">
      ${comment || "<p>未填写评论。</p>"}
    </div>
  </section>`;
}

function renderComment(block: ResearchBlock | null): string {
  if (!block) {
    return "";
  }
  if (block.type === "paragraph" || block.type === "conclusion") {
    return renderMarkdown(block.markdown);
  }
  if (block.type === "quote") {
    return `<blockquote>${escapeHtml(block.text)}</blockquote>`;
  }
  return "";
}

function renderCoverPage(document: ResearchDocument): string {
  return `<section class="cover-page">
    <header class="cover-header">
      <p class="kicker">TensuGo Research Document</p>
      <h1>${escapeHtml(document.title)}</h1>
      <p>${escapeHtml(document.sourceGame.players.black)} vs ${escapeHtml(document.sourceGame.players.white)} · ${escapeHtml(document.sourceGame.fileName)} · 作者：${escapeHtml(document.author || "未填写")}</p>
    </header>
    <section class="cover-meta">
      <span>棋盘：${document.sourceGame.boardSize} 路</span>
      <span>规则：${escapeHtml(document.sourceGame.rules)}</span>
      <span>贴目：${document.sourceGame.komi}</span>
      <span>日期：${escapeHtml(document.sourceGame.gameDate ?? "未填写")}</span>
      <span>总手数：${document.sourceGame.totalMoves}</span>
      <span>版式：0.2</span>
    </section>
    ${renderExecutiveSummary(document.analysis)}
    ${renderWinrateChart(document.analysis)}
  </section>`;
}

function renderExecutiveSummary(analysis: ResearchAnalysisSnapshot | undefined): string {
  const analyzed = analysis ? Math.max(1, analysis.analyzed) : 1;
  const averageWinrateLoss = analysis ? analysis.totalWinrateLoss / analyzed : null;
  const averageScoreLoss = analysis && analysis.knownScoreLosses > 0 ? analysis.totalScoreLoss / analysis.knownScoreLosses : null;
  const candidateRate = analysis ? analysis.candidateMatches / analyzed : null;
  const topRate = analysis ? analysis.topMatches / analyzed : null;
  const matchDegree = analysis ? analysis.totalMatchScore / analyzed : null;
  const worst = analysis?.details.reduce<ResearchAnalysisSnapshot["details"][number] | null>(
    (current, detail) => (!current || detail.winrateLoss > current.winrateLoss ? detail : current),
    null
  );
  return `<section class="executive-summary">
    <h2>天书报告</h2>
    <div class="summary-grid">
      ${summaryMetric("AI 总体评价", renderStars(matchDegree))}
      ${summaryMetric("吻合度", percentText(matchDegree))}
      ${summaryMetric("Top Move 命中率", percentText(topRate))}
      ${summaryMetric("Candidate 命中率", percentText(candidateRate))}
      ${summaryMetric("平均胜率损失", averageWinrateLoss === null ? "—" : `${averageWinrateLoss.toFixed(1)}%`)}
      ${summaryMetric("平均 Score Loss", averageScoreLoss === null ? "—" : averageScoreLoss.toFixed(1))}
      ${summaryMetric("最大失误", worst ? `第 ${worst.moveNumber} 手 / ${worst.winrateLoss.toFixed(1)}%` : "—")}
      ${summaryMetric("AI Engine", escapeHtml(analysis?.engineName ?? "—"))}
      ${summaryMetric("KataGo Model", escapeHtml(analysis?.modelName ?? "—"))}
      ${summaryMetric("分析范围", analysis ? `第 ${analysis.startMove}-${analysis.endMove} 手` : "—")}
    </div>
  </section>`;
}

function renderWinrateChart(analysis: ResearchAnalysisSnapshot | undefined): string {
  const width = 760;
  const height = 170;
  const left = 34;
  const right = width - 12;
  const top = 14;
  const bottom = height - 28;
  const points = analysis?.points ?? [];
  const startMove = analysis?.startMove ?? 1;
  const lastPoint = points.length > 0 ? points[points.length - 1] : null;
  const endMove = analysis?.endMove ?? Math.max(startMove + 1, lastPoint?.moveNumber ?? 1);
  const span = Math.max(1, endMove - startMove);
  const plotted = points.map((point) => ({
    ...point,
    x: left + ((point.moveNumber - startMove) / span) * (right - left),
    y: bottom - (point.winrate / 100) * (bottom - top)
  }));
  const polyline = plotted.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  return `<section class="winrate-report">
    <h2>胜率变化图</h2>
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="胜率变化图">
      ${[25, 50, 75].map((tick) => {
        const y = bottom - (tick / 100) * (bottom - top);
        return `<g><line class="chart-grid" x1="${left}" x2="${right}" y1="${y}" y2="${y}" /><text x="7" y="${y + 4}">${tick}</text></g>`;
      }).join("")}
      <line class="chart-axis" x1="${left}" x2="${right}" y1="${bottom}" y2="${bottom}" />
      ${polyline ? `<polyline class="winrate-line" points="${polyline}" />` : `<text class="chart-empty" x="${width / 2}" y="${height / 2}" text-anchor="middle">尚未保存自动分析数据</text>`}
      ${plotted.map((point) => `<circle class="winrate-dot" cx="${point.x}" cy="${point.y}" r="2.8" />`).join("")}
    </svg>
  </section>`;
}

function summaryMetric(label: string, value: string): string {
  return `<div><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`;
}

function percentText(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "—" : `${(value * 100).toFixed(1)}%`;
}

function renderStars(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }
  const count = Math.max(1, Math.min(5, Math.round(value * 5)));
  return `${"★".repeat(count)}${"☆".repeat(5 - count)}`;
}

function renderBoardSvg(
  boardSize: number,
  stones: { x: number; y: number; color: string; moveNumber: number; isLast?: boolean }[],
  sequence: string[],
  exportSettings: ResearchExportSettings
): string {
  const size = 640;
  const boardMargin = exportSettings.boardEdgeMarginPx;
  const coordMargin = 14;
  const gridStart = boardMargin;
  const gridEnd = size - boardMargin;
  const step = (gridEnd - gridStart) / (boardSize - 1);
  const starIndexes = boardSize === 19 ? [3, 9, 15] : boardSize === 13 ? [3, 6, 9] : [2, 4, 6];
  const lines = Array.from({ length: boardSize }, (_, index) => index);
  const point = (index: number) => gridStart + index * step;
  const coordLabels = "ABCDEFGHJKLMNOPQRSTUVWXYZ".slice(0, boardSize).split("");
  const labels = buildVariationLabels(sequence, boardSize);
  return `<svg class="go-board-svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="变化图">
    <rect width="${size}" height="${size}" rx="8" fill="#d9aa67" />
    ${lines.map((line) => `<line x1="${point(0)}" y1="${point(line)}" x2="${point(boardSize - 1)}" y2="${point(line)}" />`).join("")}
    ${lines.map((line) => `<line x1="${point(line)}" y1="${point(0)}" x2="${point(line)}" y2="${point(boardSize - 1)}" />`).join("")}
    ${coordLabels.map((label, index) => `<text class="coord" x="${point(index)}" y="${gridEnd + coordMargin}" text-anchor="middle">${label}</text>`).join("")}
    ${coordLabels.map((label, index) => `<text class="coord" x="${point(index)}" y="${gridStart - coordMargin + 5}" text-anchor="middle">${label}</text>`).join("")}
    ${lines.map((line) => `<text class="coord" x="${gridStart - coordMargin}" y="${point(line) + 5}" text-anchor="middle">${boardSize - line}</text>`).join("")}
    ${lines.map((line) => `<text class="coord" x="${gridEnd + coordMargin}" y="${point(line) + 5}" text-anchor="middle">${boardSize - line}</text>`).join("")}
    ${starIndexes
      .flatMap((y) => starIndexes.map((x) => `<circle class="star" cx="${point(x)}" cy="${point(y)}" r="4" />`))
      .join("")}
    ${stones
      .map((stone) => {
        const fill = stone.color === "black" ? "#111719" : "#f8faf7";
        const stroke = stone.color === "black" ? "#000" : "#aeb9b5";
        const label = labels.get(`${stone.x},${stone.y}`);
        const labelFill = stone.color === "black" ? "#ffffff" : "#14191b";
        return `<g><circle class="stone ${stone.color}" cx="${point(stone.x)}" cy="${point(stone.y)}" r="${step * 0.43}" fill="${fill}" stroke="${stroke}" />${label ? `<text x="${point(stone.x)}" y="${point(stone.y) + 4}" text-anchor="middle" fill="${labelFill}">${label}</text>` : ""
          }</g>`;
      })
      .join("")}
  </svg>`;
}

function renderMarkdown(markdown: string): string {
  return markdown
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function buildVariationLabels(sequence: string[], boardSize: number): Map<string, number> {
  const labels = new Map<string, number>();
  sequence.forEach((point, index) => {
    const parsed = gtpPointToTuple(point, boardSize);
    if (parsed) {
      labels.set(`${parsed[0]},${parsed[1]}`, index + 1);
    }
  });
  return labels;
}

function gtpPointToTuple(point: string, boardSize: number): [number, number] | null {
  const match = /^([A-HJ-Z])(\d+)$/i.exec(point);
  if (!match) {
    return null;
  }
  const labels = "ABCDEFGHJKLMNOPQRSTUVWXYZ";
  const x = labels.indexOf(match[1].toUpperCase());
  const row = Number(match[2]);
  const y = boardSize - row;
  return x >= 0 && x < boardSize && y >= 0 && y < boardSize ? [x, y] : null;
}

function gtpPointToMove(point: string, boardSize: number, moveNumber: number): ReviewMove | null {
  const parsed = gtpPointToTuple(point, boardSize);
  if (!parsed) {
    return null;
  }
  return {
    color: moveNumber % 2 === 1 ? "black" : "white",
    moveNumber,
    x: parsed[0],
    y: parsed[1]
  };
}

function resolveSourceMoves(document: ResearchDocument, activeGameTree?: GameTree): ReviewMove[] {
  const tree = activeGameTree ?? document.gameTree;
  if (tree) {
    return mainLineMovesFromTree(tree);
  }
  if (document.mainSgf) {
    try {
      return parseGameRecord(document.mainSgf, document.sourceGame.fileName).moves;
    } catch {
      return [];
    }
  }
  return [];
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return entities[char];
  });
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}

function articleCss(exportSettings: ResearchExportSettings): string {
  return `
  @page { size: ${exportSettings.pageSize} ${exportSettings.pageOrientation}; margin: ${exportSettings.pageMarginTopMm}mm ${exportSettings.pageMarginRightMm}mm ${exportSettings.pageMarginBottomMm}mm ${exportSettings.pageMarginLeftMm}mm; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #fff; color: #1f2a2d; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  .research-article { background: #fff; margin: 0; }
  .article-header { margin: 0 0 3mm; }
  h1 { font-size: 18px; line-height: 1.2; margin: 0; }
  .article-header p { color: #5f6e71; font-size: 10px; margin: 1mm 0 0; }
  .pdf-page { break-after: page; display: grid; gap: ${exportSettings.rowGapMm}mm; grid-template-rows: repeat(2, auto); }
  .pdf-page:last-child { break-after: auto; }
  .variation-row { align-items: start; break-inside: avoid; display: grid; gap: ${exportSettings.columnGapMm}mm; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); min-height: 0; }
  .board-column, .comment-column { min-width: 0; }
  .go-board-svg { display: block; height: auto; margin: 0 auto; max-height: ${exportSettings.boardSizeMm}mm; max-width: ${exportSettings.boardSizeMm}mm; width: 100%; }
  .go-board-svg line { stroke: rgba(83, 57, 29, .8); stroke-width: 1.2; }
  .go-board-svg .star { fill: #1d1b18; }
  .go-board-svg text { font: 700 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; pointer-events: none; }
  .go-board-svg .coord { fill: #283036; font-size: 12px; font-weight: 700; }
  .caption { color: #5e6d70; font-size: 9px; line-height: 1.15; margin: .8mm 0 0; text-align: center; }
  .comment-column { border-left: 1px solid #d9e3e1; font-size: 10.5px; line-height: 1.45; padding-left: 4mm; }
  .comment-column p { margin: 0 0 2.5mm; }
  blockquote { border-left: 3px solid #b7c8c5; color: #46575b; margin: 0; padding-left: 3mm; }
  .empty-page { align-items: center; display: flex; justify-content: center; }
`;
}

function articleCssV2(exportSettings: ResearchExportSettings): string {
  return `
  .layout-v2 { counter-reset: page; font-size: 10.5px; line-height: 1.5; }
  .layout-v2 .cover-page { break-after: page; display: grid; gap: 4mm; min-height: 0; }
  .cover-header { border-bottom: 1px solid #d6e0de; padding-bottom: 3mm; }
  .cover-header .kicker { color: #087f8c; font-size: 9px; font-weight: 800; letter-spacing: .04em; margin: 0 0 1.5mm; text-transform: uppercase; }
  .cover-header h1 { font-size: 24px; line-height: 1.15; margin: 0 0 2mm; }
  .cover-header p { color: #526165; font-size: 10px; margin: 0; }
  .cover-meta { display: grid; gap: 1.5mm 4mm; grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .cover-meta span { border-bottom: 1px solid #e0e8e6; color: #354246; padding-bottom: 1mm; }
  .executive-summary, .winrate-report { break-inside: avoid; }
  .executive-summary h2, .winrate-report h2 { font-size: 14px; margin: 0 0 2mm; }
  .summary-grid { display: grid; gap: 2mm; grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .summary-grid div { border: 1px solid #d9e3e1; min-height: 15mm; padding: 2mm; }
  .summary-grid span { color: #667477; display: block; font-size: 8.5px; margin-bottom: 1.5mm; }
  .summary-grid strong { color: #1f2a2d; display: block; font-size: 12px; overflow-wrap: anywhere; }
  .winrate-report svg { border: 1px solid #d9e3e1; display: block; height: 38mm; width: 100%; }
  .chart-grid { stroke: #d8e2e0; stroke-width: 1; }
  .chart-axis { stroke: #6a787b; stroke-width: 1.2; }
  .winrate-line { fill: none; stroke: #087f8c; stroke-linejoin: round; stroke-width: 2.2; }
  .winrate-dot { fill: #087f8c; }
  .chart-empty { fill: #879498; font: 700 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  .document-flow { column-count: 1; }
  .document-flow .text-block { margin: 0 0 3mm; }
  .document-flow .text-block p { margin: 0 0 2.5mm; orphans: 2; widows: 2; }
  .document-flow .variation-row { break-inside: avoid; margin: 0 0 ${exportSettings.rowGapMm}mm; page-break-inside: avoid; }
  .document-flow .variation-row + .text-block { margin-top: -1mm; }
  .empty-document { color: #7a898c; font-size: 12px; }
  `;
}
