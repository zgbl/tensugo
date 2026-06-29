# TSG (TensuGo Study) 1.0 文件格式设计规范 (Draft)

## 一、 设计定位

**SGF/GIB 负责记录棋谱，TSG 负责记录棋评/研究成果。**

TSG (TensuGo Study) 不是为了取代 SGF/GIB 棋谱格式，而是建立在其之上，为“围棋研究文档/棋评”提供一种结构化、可长期保存、易于编辑、渲染和导出的标准化 JSON 文档格式。

在 TensuGo 中，用户通过浏览棋谱、调用 AI 分析、添加局面标记与讲解，最终保存生成一个 `.tsg` 文件。

---

## 二、 设计原则

1. **简单易用 (MVP 优先)**：1.0 专注于实现“一盘棋 + 一篇线性棋评”的核心场景，不引入复杂的节点树分支操作（留给 2.0 解决）。
2. **编辑器亲和**：数据结构直接贴合前端的编辑操作（添加标题、编写段落、插入局面、保存 AI 分析、展示变化图）。
3. **未来兼容性**：保留可扩展字段，便于 2.0 升级到完整的 GameTree、Diagram 库及 AI 缓存等架构，不造成破坏性变更。

---

## 三、 顶层数据结构

TSG 1.0 文件采用 JSON 格式，顶层结构定义如下：

```json
{
  "format": "TSG",
  "version": 1",
  "meta": {
    "title": "黑51手后的右边攻防研究",
    "author": "Xinyu Tu",
    "createdAt": "2026-06-26T18:00:00Z",
    "updatedAt": "2026-06-26T18:30:00Z",
    "description": "探讨在实战黑51手夹击后，白棋的正确应对方式及AI推荐的变化。"
  },
  "source": {
    "format": "sgf",
    "fileName": "example.sgf",
    "content": "(;GM[1]FF[4]SZ[19]KM[7.5];B[pd]...)"
  },
  "gameInfo": {
    "boardSize": 19,
    "rules": "Chinese",
    "komi": 7.5,
    "players": {
      "black": { "name": "wzw858", "rank": "7段" },
      "white": { "name": "zgbl1234", "rank": "7段" }
    },
    "result": "B+R"
  },
  "blocks": []
}
```

### 字段说明

- **format**: 固定为 `"brg"`。
- **version**: 当前版本为 `"1.0"`。
- **meta**: 文档的元信息（标题、作者、创建/更新时间、简介）。
- **source**: 原始棋谱备份，包括原始格式 (`sgf` 或 `gib`)、文件名以及棋谱的完整文本内容（使 TSG 文件独立于外部棋谱文件，支持随时重载）。
- **gameInfo**: 对局的基本配置（棋盘大小、规则、贴目、棋手信息及结果），方便程序快速读取。
- **blocks**: 线性排列的棋评内容块列表。

---

## 四、 Block 块模型 (TSG 1.0)

TSG 1.0 的内容组织是线性的 Block 列表，这降低了 Notion 式编辑器的实现门槛。支持以下五种核心 Block。

### 1. Heading Block (标题块)
用于对文章内容进行分段与结构化。
```json
{
  "id": "blk_heading_1",
  "type": "heading",
  "level": 1,
  "text": "一、右边战局的关键分歧点"
}
```

### 2. Paragraph Block (正文/段落块)
支持富文本 Markdown 格式的讲解段落。
```json
{
  "id": "blk_para_1",
  "type": "paragraph",
  "markdown": "实战进行到 **黑51** 时，白棋在右上角的处理显得过于局促。根据 **KataGo** 的计算，此时在右边脱先是更好的选择。"
}
```

### 3. Board Block (局面图块)
保存某一特定手数的棋盘静态快照，支持在其上加盖标注或画线。
```json
{
  "id": "blk_board_1",
  "type": "board",
  "moveNumber": 51,
  "caption": "图1：实战至黑51",
  "showCoordinates": true,
  "showLastMove": true,
  "marks": [
    {
      "id": "m1",
      "type": "circle",
      "pos": [15, 3]
    },
    {
      "id": "m2",
      "type": "label",
      "pos": [16, 4],
      "text": "A"
    }
  ]
}
```
- **坐标系标准**：1.0 内部存储统一采用 **0-indexed 整数数组 `[col, row]`**（如 `[16, 4]`），左上角为 `[0, 0]`，右下角为 `[18, 18]`。显示层（如 "D4"、"Q10" 等）由渲染器根据坐标与棋盘大小进行实时转换。
- **marks（标注）类型**：
  - `circle` (圆圈)
  - `triangle` (三角)
  - `square` (方块)
  - `cross` (叉号)
  - `label` (文字标签，包含 `text` 字段)

### 4. AI Block (AI 分析块)
固化 KataGo 在某一局面的分析成果，包含胜率、目差、推荐候选点及其参考变化图（PV）。
```json
{
  "id": "blk_ai_1",
  "type": "ai",
  "engine": "KataGo",
  "moveNumber": 51,
  "winrate": 53.2,
  "scoreLead": 1.4,
  "visits": 3000,
  "candidates": [
    {
      "move": [16, 2],
      "winrate": 53.2,
      "scoreLead": 1.4,
      "visits": 1850,
      "pv": [[16, 2], [15, 2], [16, 3]]
    },
    {
      "move": [13, 2],
      "winrate": 49.8,
      "scoreLead": -0.2,
      "visits": 1150,
      "pv": [[13, 2], [13, 3]]
    }
  ]
}
```

### 5. Variation Block (变化图块)
用来记录 AI 的推荐变化或作者自己摆的变化。变化图只用于展示，不会污染原始棋谱的主线。
```json
{
  "id": "blk_var_1",
  "type": "variation",
  "caption": "图2：AI 推荐右上角脱先变化",
  "baseMoveNumber": 51,
  "firstMoveLabel": 1,
  "moves": [
    { "color": "W", "pos": [16, 2] },
    { "color": "B", "pos": [15, 2] },
    { "color": "W", "pos": [16, 3] }
  ]
}
```
- **baseMoveNumber**: 表示该变化基于哪一手棋的局面展开。
- **firstMoveLabel**: 变化图内的首步落子序号标识，默认从 1 开始。

---

## 五、 TypeScript 类型定义 (Types)

```typescript
export interface TSGDocument {
  format: "TSG";
  version: 1;
  createdBy: "TensuGo 1.0";
  meta: TSGMeta;
  source: TSGSource;
  gameInfo: TSGGameInfo;
  blocks: TSGBlock[];
}

export interface TSGMeta {
  title: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  description?: string;
  tags?: string[];
}

export interface TSGSource {
  format: "sgf" | "gib";
  fileName: string;
  content: string; // 完整棋谱文本
}

export interface TSGGameInfo {
  boardSize: number;
  rules: string;
  komi: number;
  players: {
    black: { name: string; rank?: string };
    white: { name: string; rank?: string };
  };
  result?: string;
}

export type TSGBlock =
  | HeadingBlock
  | ParagraphBlock
  | BoardBlock
  | AiBlock
  | VariationBlock;

export interface HeadingBlock {
  id: string;
  type: "heading";
  level: 1 | 2 | 3;
  text: string;
}

export interface ParagraphBlock {
  id: string;
  type: "paragraph";
  markdown: string;
}

export interface BoardBlock {
  id: string;
  type: "board";
  moveNumber: number;
  caption?: string;
  showCoordinates?: boolean;
  showLastMove?: boolean;
  marks?: BoardMarker[];
}

export interface BoardMarker {
  id: string;
  type: "circle" | "triangle" | "square" | "cross" | "label";
  pos: [number, number]; // 0-indexed [col, row]
  text?: string; // type 为 label 时使用
}

export interface AiBlock {
  id: string;
  type: "ai";
  engine: "KataGo" | string;
  moveNumber: number;
  winrate: number;
  scoreLead: number;
  visits: number;
  candidates: AiCandidate[];
}

export interface AiCandidate {
  move: [number, number];
  winrate: number;
  scoreLead: number;
  visits: number;
  pv: Array<[number, number]>;
}

export interface VariationBlock {
  id: string;
  type: "variation";
  caption?: string;
  baseMoveNumber: number;
  firstMoveLabel?: number;
  moves: Array<{
    color: "B" | "W";
    pos: [number, number];
  }>;
}
```

---

## 六、 2.0 兼容与平滑演进策略

TSG 1.0 的设计保留了向 2.0 迁移的最佳兼容性路径：

1. **从线性 Blocks 到复合 Sections**：1.0 直接将 `blocks` 铺平在顶层。2.0 升级时，只需在顶层引入 `sections: []` 数组，每个 section 包含 `blocks: []`，而 1.0 现有的 `blocks` 默认转换为第 0 个默认 Section 即可。
2. **AI Cache 的独立外置**：如果在 2.0 中需要对全局多步棋的 AI 数据做持久化分析缓存，可以在顶层添加 `analysisCache: []`。1.0 的 Block-level 局部 AI 数据无需修改，可以直接共存。
3. **引入 GameTree 替换 Source 纯文本**：2.0 可以增设 `gameTree: {}` 对象来记录带有复杂嵌套变化的分支树。1.0 的 `source` 文本在升级为 2.0 客户端时，可由客户端内置的 SGF 解析器重新将其转为 `gameTree`。
4. **资源文件整合**：2.0 在引入图片、多媒体附件后，可通过顶层 `assets: []` 声明引用。同时，`.tsg` 可以从单 JSON 升级为类似 EPUB 的 Zip 包压缩格式（包含 `.tsg` 主文档与 `assets/` 资源目录），对 1.0 文件只读兼容。
