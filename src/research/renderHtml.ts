import type { ResearchAnalysisSnapshot, ResearchBlock, ResearchDocument } from "./types";
import { buildBoardPosition } from "../game/boardRules";
import { mainLineMovesFromTree, type GameTree } from "../game/gameTree";
import type { ReviewMove } from "../game/sampleGame";
import { parseGameRecord } from "../sgf/parseSgf";
import { appDisplayVersion } from "../version";

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
  documentFontSizePt: number;
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
  columnGapMm: 4,
  documentFontSizePt: 13
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
  const blocks = document.sections.flatMap((section) => section.blocks);
  const flowHtml = renderFlowBlocks(blocks, document, sourceMoves, exportSettings);

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
    ${renderCoverPage(document)}
    <main class="document-flow">
      ${flowHtml || `<p class="empty-document">还没有正文内容。</p>`}
    </main>
    ${renderFinalTianshuReport(document.analysis)}
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
    ${renderFinalTianshuReport(document.analysis)}
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
  const flowItems = buildFlowItems(blocks, sourceMoves);
  const pages = paginateFlowItems(flowItems, exportSettings);
  const html: string[] = [];
  for (const page of pages) {
    html.push(`<section class="pdf-page dynamic-page board-size-${page.size.name}">
      ${page.items.map((item) => renderFlowItem(item, exportSettings, page.size.mm)).join("\n")}
    </section>`);
  }
  if (!html.length && document.sections[0]?.blocks.length) {
    return `<p class="empty-document">当前文档没有可导出的正文块。</p>`;
  }
  return html.join("\n");
}

type FlowItem =
  | { type: "variation"; entry: VariationEntry }
  | { type: "game_progress"; block: Extract<ResearchBlock, { type: "game_progress" }> }
  | { type: "text"; block: Extract<ResearchBlock, { type: "paragraph" | "conclusion" | "quote" }> }
  | { type: "heading"; block: Extract<ResearchBlock, { type: "heading" }> };

type VariationEntry = {
  variation: Extract<ResearchBlock, { type: "variation" }>;
  comment: ResearchBlock | null;
  stones: ReviewMove[];
};

type PageBoardSize = { name: "large" | "medium" | "small"; mm: number };

function buildFlowItems(blocks: ResearchBlock[], sourceMoves: ReviewMove[]): FlowItem[] {
  const items: FlowItem[] = [];
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (block.type === "variation") {
      const nextBlock = blocks[index + 1];
      const pairedComment = isVariationCommentBlock(nextBlock) ? nextBlock : null;
      items.push({ type: "variation", entry: buildVariationEntry(block, pairedComment, sourceMoves) });
      if (pairedComment) {
        index += 1;
      }
      continue;
    }
    if (block.type === "game_progress") {
      items.push({ type: "game_progress", block });
      continue;
    }
    if (isCommentBlock(block) && block.type !== "quote") {
      items.push({ type: "text", block });
      continue;
    }
    if (block.type === "heading") {
      items.push({ type: "heading", block });
      continue;
    }
    if (block.type === "quote") {
      items.push({ type: "text", block });
    }
  }
  return items;
}

function isCommentBlock(block: ResearchBlock | undefined): block is Extract<ResearchBlock, { type: "paragraph" | "conclusion" | "quote" }> {
  if (!block) {
    return false;
  }
  if (block.type === "paragraph" || block.type === "conclusion") {
    return block.markdown.trim().length > 0;
  }
  return block.type === "quote" && block.text.trim().length > 0;
}

function isVariationCommentBlock(block: ResearchBlock | undefined): block is Extract<ResearchBlock, { type: "paragraph" | "conclusion" | "quote" }> {
  if (!isCommentBlock(block)) {
    return false;
  }
  return !(block.type === "paragraph" && block.title === "pure_text");
}

function renderFlowItem(item: FlowItem, exportSettings: ResearchExportSettings, pageBoardSizeMm: number): string {
  if (item.type === "variation") {
    return renderVariationEntry(item.entry, exportSettings, pageBoardSizeMm);
  }
  if (item.type === "game_progress") {
    return renderGameProgressBlock(item.block, exportSettings, pageBoardSizeMm);
  }
  if (item.type === "heading") {
    return `<h${item.block.level} class="doc-heading">${escapeHtml(item.block.text)}</h${item.block.level}>`;
  }
  if (item.block.type === "quote") {
    return `<section class="text-block"><blockquote>${escapeHtml(item.block.text)}</blockquote></section>`;
  }
  return `<section class="text-block">${renderMarkdown(item.block.markdown)}</section>`;
}

function paginateFlowItems(
  items: FlowItem[],
  exportSettings: ResearchExportSettings
): Array<{ size: PageBoardSize; items: FlowItem[] }> {
  const pages: Array<{ size: PageBoardSize; items: FlowItem[] }> = [];
  const boardSizes = getPageBoardSizes(exportSettings);
  let index = 0;
  while (index < items.length) {
    let end = index + 1;
    let bestFit = choosePageBoardSize(items.slice(index, end), boardSizes, exportSettings);
    if (!bestFit) {
      pages.push({ size: boardSizes[boardSizes.length - 1], items: [items[index]] });
      index += 1;
      continue;
    }
    while (end < items.length) {
      const nextItems = items.slice(index, end + 1);
      const nextFit = choosePageBoardSize(nextItems, boardSizes, exportSettings);
      if (!nextFit) {
        break;
      }
      bestFit = nextFit;
      end += 1;
    }
    pages.push({ size: bestFit, items: items.slice(index, end) });
    index = end;
  }
  return pages;
}

function getPageBoardSizes(exportSettings: ResearchExportSettings): PageBoardSize[] {
  return [
    { name: "large", mm: exportSettings.boardSizeMm },
    { name: "medium", mm: Math.round(exportSettings.boardSizeMm * 0.84) },
    { name: "small", mm: Math.round(exportSettings.boardSizeMm * 0.74) }
  ];
}

function choosePageBoardSize(
  items: FlowItem[],
  boardSizes: PageBoardSize[],
  exportSettings: ResearchExportSettings
): PageBoardSize | null {
  const contentHeightMm = getPageContentHeightMm(exportSettings);
  return boardSizes.find((size) => estimatePageHeightMm(items, size.mm, exportSettings) <= contentHeightMm) ?? null;
}

function getPageContentHeightMm(exportSettings: ResearchExportSettings): number {
  const portraitHeight = exportSettings.pageSize === "a4" ? 297 : 279.4;
  const portraitWidth = exportSettings.pageSize === "a4" ? 210 : 215.9;
  const paperHeight = exportSettings.pageOrientation === "landscape" ? portraitWidth : portraitHeight;
  return Math.max(80, paperHeight - exportSettings.pageMarginTopMm - exportSettings.pageMarginBottomMm);
}

function estimatePageHeightMm(items: FlowItem[], boardSizeMm: number, exportSettings: ResearchExportSettings): number {
  return items.reduce((total, item, index) => {
    const gap = index === 0 ? 0 : exportSettings.rowGapMm;
    return total + gap + estimateFlowItemHeightMm(item, boardSizeMm, exportSettings);
  }, 0);
}

function estimateFlowItemHeightMm(item: FlowItem, boardSizeMm: number, exportSettings: ResearchExportSettings): number {
  if (item.type === "variation") {
    const captionHeightMm = item.entry.variation.caption || item.entry.variation.name ? 4 : 0;
    const titleHeightMm = item.entry.comment ? estimateCommentHeightMm(item.entry.comment) : 0;
    return boardSizeMm + captionHeightMm + Math.min(18, titleHeightMm) + exportSettings.rowGapMm;
  }
  if (item.type === "game_progress") {
    return boardSizeMm + 5 + exportSettings.rowGapMm;
  }
  if (item.type === "heading") {
    return item.block.level === 1 ? 10 : item.block.level === 2 ? 8 : 6;
  }
  return estimateCommentHeightMm(item.block);
}

function estimateCommentHeightMm(block: ResearchBlock): number {
  const text =
    block.type === "paragraph" || block.type === "conclusion"
      ? block.markdown
      : block.type === "quote"
        ? block.text
        : "";
  const textLength = normalizedTextLength(text);
  const charsPerLine = 38;
  const estimatedLineCount = Math.max(1, Math.ceil(textLength / charsPerLine));
  const baseParagraphMarginMm = 2.5;
  const lineHeightMm = 4.7;
  return baseParagraphMarginMm + estimatedLineCount * lineHeightMm;
}

function normalizedTextLength(text: string): number {
  return text.replace(/[#*_`>\-[\]()]/g, "").replace(/\s+/g, "").length;
}

function buildVariationEntry(
  block: Extract<ResearchBlock, { type: "variation" }>,
  comment: ResearchBlock | null,
  sourceMoves: ReviewMove[]
): VariationEntry {
  const variationMoves = block.sequence
    .map((point, offset) => gtpPointToMove(point, block.boardSize, block.fromMoveNumber + offset + 1))
    .filter((move): move is ReviewMove => Boolean(move));
  const allMoves = [...sourceMoves.slice(0, block.fromMoveNumber), ...variationMoves];
  return { variation: block, comment, stones: buildBoardPosition(allMoves, block.boardSize, allMoves.length).stones };
}

function renderVariationEntry(
  entry: VariationEntry,
  exportSettings: ResearchExportSettings,
  pageBoardSizeMm: number
): string {
  const comment = renderComment(entry.comment) || renderVariationDescription(entry.variation);
  return `<section class="variation-block">
    <div class="variation-board-wrap">
    <div class="board-column">
      ${renderBoardSvg(entry.variation.boardSize, entry.stones, entry.variation.sequence, exportSettings, pageBoardSizeMm)}
      <p class="caption">${escapeHtml(entry.variation.caption || entry.variation.name)}</p>
    </div>
    <div class="comment-column">
      ${comment || "<p>未填写评论。</p>"}
    </div>
    </div>
  </section>`;
}

function renderGameProgressBlock(
  block: Extract<ResearchBlock, { type: "game_progress" }>,
  exportSettings: ResearchExportSettings,
  pageBoardSizeMm: number
): string {
  return `<section class="variation-block game-progress-block">
    <div class="variation-board-wrap">
      <div class="board-column">
        ${renderBoardSvg(block.boardSize, block.position, block.sequence, exportSettings, pageBoardSizeMm)}
        <p class="caption">${escapeHtml(block.caption)}</p>
      </div>
      <div class="comment-column">
        <p>主分支第 ${block.startMoveNumber}-${block.endMoveNumber} 手，图中编号从 1 开始。</p>
      </div>
    </div>
  </section>`;
}

function renderVariationDescription(block: Extract<ResearchBlock, { type: "variation" }>): string {
  const text = block.description.trim();
  if (!text || text === block.sequence.join(" ")) {
    return "";
  }
  return renderMarkdown(text);
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
    </header>
    <section class="cover-meta">
      ${metaItem("黑方", document.sourceGame.players.black)}
      ${metaItem("白方", document.sourceGame.players.white)}
      ${metaItem("日期", document.sourceGame.gameDate)}
      ${metaItem("来源文件名", document.sourceGame.fileName)}
      ${metaItem("规则", document.sourceGame.rules)}
      ${metaItem("贴目", String(document.sourceGame.komi))}
      ${metaItem("棋盘大小", `${document.sourceGame.boardSize} 路`)}
      ${metaItem("结果", document.sourceGame.result)}
      ${metaItem("作者", document.author)}
      ${metaItem("createdBy", appDisplayVersion())}
    </section>
  </section>`;
}

function metaItem(label: string, value: string | undefined): string {
  return `<div class="meta-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "未填写")}</strong></div>`;
}

function renderExecutiveSummary(analysis: ResearchAnalysisSnapshot | undefined, includeTitle = true): string {
  const analyzed = analysis ? Math.max(1, analysis.analyzed) : 1;
  const averageWinrateLoss = analysis ? analysis.totalWinrateLoss / analyzed : null;
  const averageScoreLoss = analysis && analysis.knownScoreLosses > 0 ? analysis.totalScoreLoss / analysis.knownScoreLosses : null;
  const matchRate = analysis ? (analysis.matches ?? analysis.details.filter((detail) => detail.isMatch).length) / analyzed : null;
  const candidateRate = analysis ? analysis.candidateMatches / analyzed : null;
  const topRate = analysis ? analysis.topMatches / analyzed : null;
  const matchDegree = analysis ? analysis.totalMatchScore / analyzed : null;
  const worst = analysis?.details.reduce<ResearchAnalysisSnapshot["details"][number] | null>(
    (current, detail) => (!current || detail.winrateLoss > current.winrateLoss ? detail : current),
    null
  );
  return `<section class="executive-summary">
    ${includeTitle ? "<h2>天书报告</h2>" : ""}
    <div class="summary-grid">
      ${summaryMetric("AI 总体评价", renderStars(matchDegree))}
      ${summaryMetric("吻合度", percentText(matchDegree))}
      ${summaryMetric("吻合率", percentText(matchRate))}
      ${summaryMetric("最佳一选率 / Top Move 命中率", percentText(topRate))}
      ${summaryMetric("候选命中率", percentText(candidateRate))}
      ${summaryMetric("平均胜率损失", averageWinrateLoss === null ? "—" : `${averageWinrateLoss.toFixed(1)}%`)}
      ${summaryMetric("平均目差损失", averageScoreLoss === null ? "—" : averageScoreLoss.toFixed(1))}
      ${summaryMetric("最大失误", worst ? `第 ${worst.moveNumber} 手 / ${worst.winrateLoss.toFixed(1)}%` : "—")}
      ${summaryMetric("AI Engine", escapeHtml(analysis?.engineName ?? "—"))}
      ${summaryMetric("KataGo Model", escapeHtml(analysis?.modelName ?? "—"))}
      ${summaryMetric("分析范围", analysis ? `第 ${analysis.startMove}-${analysis.endMove} 手` : "—")}
      ${summaryMetric("统计条件", `前 3 候选；visits 占比 ≥20%；全局统计；目数损失仅在实战手命中候选时统计`)}
    </div>
  </section>`;
}

function renderFinalTianshuReport(analysis: ResearchAnalysisSnapshot | undefined): string {
  if (!analysis || analysis.analyzed <= 0) {
    return `<section class="final-report-page"><h2>天书报告</h2><p>暂无天书报告，请先完成 AI 分析。</p></section>`;
  }
  return `<section class="final-report-page">
    <h2>天书报告</h2>
    ${renderWinrateChart(analysis)}
    ${renderExecutiveSummary(analysis, false)}
  </section>`;
}

function renderWinrateChart(analysis: ResearchAnalysisSnapshot | undefined): string {
  const width = 900;
  const height = 160;
  const left = 34;
  const right = width - 12;
  const top = 14;
  const bottom = height - 28;
  const points = (analysis?.details.length ? analysis.details : analysis?.points) ?? [];
  const startMove = analysis?.startMove ?? 1;
  const lastPoint = points.length > 0 ? points[points.length - 1] : null;
  const endMove = analysis?.endMove ?? Math.max(startMove + 1, lastPoint?.moveNumber ?? 1);
  const span = Math.max(1, endMove - startMove);
  const plotted = points.map((point) => ({
    ...point,
    x: left + ((point.moveNumber - startMove) / span) * (right - left),
    y: bottom - (point.winrate / 100) * (bottom - top)
  }));
  const lineSegments = splitContinuousChartSegments(plotted)
    .map((segment) => segment.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" "))
    .filter(Boolean);
  const analyzed = analysis ? Math.max(1, analysis.analyzed) : 1;
  const matchRate = analysis ? (analysis.matches ?? analysis.details.filter((detail) => detail.isMatch).length) / analyzed : null;
  const matchDegree = analysis ? analysis.totalMatchScore / analyzed : null;
  const averageWinrateLoss = analysis ? analysis.totalWinrateLoss / analyzed : null;
  return `<section class="winrate-report">
    <h2>胜率变化图</h2>
    <div class="tianshu-report-chart-tabs">
      <span>胜率吻合</span>
      <span>分段吻合度</span>
      <span>胜率损失统计</span>
      <span>目数损失</span>
      <span>吻合度走势</span>
    </div>
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="胜率变化图">
      ${[25, 50, 75].map((tick) => {
    const y = bottom - (tick / 100) * (bottom - top);
    return `<g><line class="tianshu-report-grid-line" x1="${left}" x2="${right}" y1="${y}" y2="${y}" /><text x="8" y="${y + 4}">${tick}</text></g>`;
  }).join("")}
      <line class="tianshu-report-axis" x1="${left}" x2="${right}" y1="${bottom}" y2="${bottom}" />
      ${plotted.map((point) => `<rect class="${chartBarClass(point)}" height="${Math.max(0, bottom - point.y).toFixed(1)}" width="6" x="${(point.x - 3).toFixed(1)}" y="${point.y.toFixed(1)}" />`).join("")}
      ${lineSegments.length ? lineSegments.map((line) => `<polyline class="tianshu-report-winrate-line" points="${line}" />`).join("") : `<text class="chart-empty" x="${width / 2}" y="${height / 2}" text-anchor="middle">尚未保存自动分析数据</text>`}
      ${plotted.map((point) => `<circle class="${chartDotClass(point)}" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="3.5" />`).join("")}
      ${[startMove, Math.round((startMove + endMove) / 2), endMove].map((move) => {
    const x = left + ((move - startMove) / span) * (right - left);
    return `<text class="tianshu-report-move-label" x="${(x - 8).toFixed(1)}" y="${height - 8}">${move}</text>`;
  }).join("")}
    </svg>
    <p class="winrate-chart-footnote">分析范围：第 ${startMove}-${endMove} 手；吻合率 ${percentText(matchRate)}；吻合度 ${percentText(matchDegree)}；平均胜率损失 ${averageWinrateLoss === null ? "—" : `${averageWinrateLoss.toFixed(1)}%`}。</p>
  </section>`;
}

function splitContinuousChartSegments<T extends { moveNumber: number }>(points: T[]): T[][] {
  const segments: T[][] = [];
  for (const point of points) {
    const current = segments[segments.length - 1];
    if (!current || current.length === 0 || point.moveNumber !== current[current.length - 1].moveNumber + 1) {
      segments.push([point]);
    } else {
      current.push(point);
    }
  }
  return segments;
}

function chartBarClass(point: { moveNumber: number }): string {
  const rank = "rank" in point ? point.rank : undefined;
  return rank === null ? "tianshu-report-miss-bar" : "tianshu-report-hit-bar";
}

function chartDotClass(point: { moveNumber: number }): string {
  const rank = "rank" in point ? point.rank : undefined;
  if (rank === 1) {
    return "tianshu-report-top-dot";
  }
  if (rank === null) {
    return "tianshu-report-miss-dot";
  }
  return "tianshu-report-candidate-dot";
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
  exportSettings: ResearchExportSettings,
  pageBoardSizeMm: number
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
  return `<svg class="go-board-svg" style="max-height:${pageBoardSizeMm}mm;max-width:${pageBoardSizeMm}mm;" viewBox="0 0 ${size} ${size}" role="img" aria-label="变化图">
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
  .pdf-page { break-after: page; }
  .pdf-page:last-child { break-after: auto; }
  /* .variation-row 故意不用 display:grid/flex：Chromium 打印分页对这两种布局
     的 break-inside:avoid 支持长期不可靠（子元素放不下时整个容器会被推到下
     一页），改用 float 布局可以正确参与分页计算。 */
  .variation-block { break-inside: auto; margin: 0 0 ${exportSettings.rowGapMm}mm; page-break-inside: auto; }
  .variation-board-wrap { break-inside: avoid; overflow: hidden; page-break-inside: avoid; }
  .board-column { box-sizing: border-box; float: left; width: 64%; }
  .comment-column { box-sizing: border-box; float: left; width: 36%; }
  .go-board-svg { display: block; height: auto; margin: 0 auto; max-height: ${exportSettings.boardSizeMm}mm; max-width: ${exportSettings.boardSizeMm}mm; width: 100%; }
  .go-board-svg line { stroke: rgba(83, 57, 29, .8); stroke-width: 1.2; }
  .go-board-svg .star { fill: #1d1b18; }
  .go-board-svg text { font: 700 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; pointer-events: none; }
  .go-board-svg .coord { fill: #283036; font-size: 12px; font-weight: 700; }
  .caption { color: #5e6d70; font-size: 9px; line-height: 1.15; margin: .8mm 0 0; text-align: center; }
  .comment-column { border-left: 1px solid #d9e3e1; font-size: ${Math.max(10, exportSettings.documentFontSizePt - 1)}pt; line-height: 1.45; padding-left: ${exportSettings.columnGapMm}mm; }
  .comment-column p { margin: 0 0 2.5mm; }
  .document-flow .text-block { font-size: ${exportSettings.documentFontSizePt}pt; line-height: 1.55; margin: 0 0 1mm; }
  .document-flow .text-block p { margin: 0 0 1.5mm; orphans: 2; widows: 2; }
  .empty-document { color: #7a898c; font-size: 12px; }
  blockquote { border-left: 3px solid #b7c8c5; color: #46575b; margin: 0; padding-left: 3mm; }
  .empty-page { align-items: center; display: flex; justify-content: center; }
  .cover-page { break-after: page; display: grid; gap: 4mm; }
  .cover-header { border-bottom: 1px solid #d6e0de; padding-bottom: 3mm; }
  .cover-header .kicker { color: #087f8c; font-size: 9px; font-weight: 800; margin: 0 0 1.5mm; text-transform: uppercase; }
  .cover-header h1 { font-size: 24px; line-height: 1.15; margin: 0; }
  .cover-meta { display: grid; gap: 1.5mm 4mm; grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .meta-item { border: 1px solid #d9e3e1; padding: 2mm; }
  .meta-item span { color: #667477; display: block; font-size: 8.5px; margin-bottom: 1mm; }
  .meta-item strong { color: #1f2a2d; display: block; font-size: 11px; overflow-wrap: anywhere; }
  .final-report-page { break-before: page; }
  .final-report-page h2 { font-size: 16px; margin: 0 0 4mm; }
  .executive-summary, .winrate-report { break-inside: avoid; }
  .executive-summary h2, .winrate-report h2 { font-size: 14px; margin: 0 0 2mm; }
  .summary-grid { display: grid; gap: 2mm; grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .summary-grid div { border: 1px solid #d9e3e1; min-height: 15mm; padding: 2mm; }
  .summary-grid span { color: #667477; display: block; font-size: 8.5px; margin-bottom: 1.5mm; }
  .summary-grid strong { color: #1f2a2d; display: block; font-size: 12px; overflow-wrap: anywhere; }
  .winrate-report svg { background: #9f9f9f; border: 1px solid #7d8589; display: block; height: 52mm; width: 100%; }
  .tianshu-report-chart-tabs { display: flex; flex-wrap: wrap; gap: 1.5mm; margin: 0 0 1.5mm; }
  .tianshu-report-chart-tabs span { background: #edf4f5; border: 1px solid #c7d7dc; color: #28363b; font-size: 8.5px; font-weight: 700; padding: 1mm 1.8mm; }
  .tianshu-report-grid-line { stroke: rgba(255, 255, 255, 0.9); stroke-dasharray: 4 5; stroke-width: 1; }
  .tianshu-report-axis { stroke: rgba(255, 255, 255, 0.7); stroke-width: 1; }
  .winrate-report svg text { fill: #ffffff; font-size: 11px; font-weight: 600; }
  .tianshu-report-move-label { fill: #ffffff; }
  .tianshu-report-hit-bar { fill: rgba(62, 198, 83, 0.72); }
  .tianshu-report-miss-bar { fill: rgba(81, 91, 210, 0.72); }
  .tianshu-report-winrate-line { fill: none; stroke: #22d7df; stroke-linecap: round; stroke-linejoin: round; stroke-width: 3; }
  .tianshu-report-top-dot { fill: #ff41d8; }
  .tianshu-report-candidate-dot { fill: #fee053; }
  .tianshu-report-miss-dot { fill: #d84b57; }
  .winrate-chart-footnote { color: #425156; font-size: 9.5px; font-weight: 700; margin: 1.5mm 0 3mm; }
  .chart-empty { fill: #879498; font: 700 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
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
  .meta-item { border: 1px solid #d9e3e1; padding: 2mm; }
  .meta-item span { color: #667477; display: block; font-size: 8.5px; margin-bottom: 1mm; }
  .meta-item strong { color: #1f2a2d; display: block; font-size: 11px; overflow-wrap: anywhere; }
  .executive-summary, .winrate-report { break-inside: avoid; }
  .executive-summary h2, .winrate-report h2 { font-size: 14px; margin: 0 0 2mm; }
  .summary-grid { display: grid; gap: 2mm; grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .summary-grid div { border: 1px solid #d9e3e1; min-height: 15mm; padding: 2mm; }
  .summary-grid span { color: #667477; display: block; font-size: 8.5px; margin-bottom: 1.5mm; }
  .summary-grid strong { color: #1f2a2d; display: block; font-size: 12px; overflow-wrap: anywhere; }
  .winrate-report svg { background: #9f9f9f; border: 1px solid #7d8589; display: block; height: 52mm; width: 100%; }
  .tianshu-report-chart-tabs { display: flex; flex-wrap: wrap; gap: 1.5mm; margin: 0 0 1.5mm; }
  .tianshu-report-chart-tabs span { background: #edf4f5; border: 1px solid #c7d7dc; color: #28363b; font-size: 8.5px; font-weight: 700; padding: 1mm 1.8mm; }
  .tianshu-report-grid-line { stroke: rgba(255, 255, 255, 0.9); stroke-dasharray: 4 5; stroke-width: 1; }
  .tianshu-report-axis { stroke: rgba(255, 255, 255, 0.7); stroke-width: 1; }
  .winrate-report svg text { fill: #ffffff; font-size: 11px; font-weight: 600; }
  .tianshu-report-move-label { fill: #ffffff; }
  .tianshu-report-hit-bar { fill: rgba(62, 198, 83, 0.72); }
  .tianshu-report-miss-bar { fill: rgba(81, 91, 210, 0.72); }
  .tianshu-report-winrate-line { fill: none; stroke: #22d7df; stroke-linecap: round; stroke-linejoin: round; stroke-width: 3; }
  .tianshu-report-top-dot { fill: #ff41d8; }
  .tianshu-report-candidate-dot { fill: #fee053; }
  .tianshu-report-miss-dot { fill: #d84b57; }
  .winrate-chart-footnote { color: #425156; font-size: 9.5px; font-weight: 700; margin: 1.5mm 0 3mm; }
  .chart-empty { fill: #879498; font: 700 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  .document-flow { column-count: 1; }
  .document-flow .text-block { font-size: ${exportSettings.documentFontSizePt}pt; line-height: 1.55; margin: 0 0 2mm; }
  .document-flow .text-block p { margin: 0 0 2.5mm; orphans: 2; widows: 2; }
  .document-flow .variation-block + .text-block { margin-top: -1mm; }
  .empty-document { color: #7a898c; font-size: 12px; }
  .final-report-page { break-before: page; }
  .final-report-page h2 { font-size: 16px; margin: 0 0 4mm; }
  `;
}
