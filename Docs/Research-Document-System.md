# TensuGo 围棋研究文档系统设计

## 1. 产品定位总结

TensuGo 的研究文档系统不是 SGF 查看器，也不是另一个 Lizzie / KaTrain。它的定位是“围棋研究文档编辑器”：用户一边复盘、一边插入棋盘局面、AI 分析、变化图和文字讲解，最终形成可保存、可导出、可发布的研究文章。

核心价值：

- 把“分析棋”升级为“沉淀研究成果”。
- 用 `.brg` 承载文章结构、棋盘状态、变化、AI 结果和资源。
- 桌面端负责深度编辑和离线研究，网站端负责阅读、传播、评论、收藏和 Fork。
- PDF/HTML/长图导出面向微信群、朋友圈、公众号和邮件传播。

## 2. 核心功能列表

- 打开 SGF/GIB，读取主线、贴目、规则、对局双方和结果。
- 在任意手数生成 board block，固化当前局面、标记和说明。
- 编写 Markdown 讲解，按 section/block 组织文章。
- 插入 KataGo 推荐点、胜率、目差、PV 和候选点表格。
- 从候选 PV 生成 variation block。
- 对实战、AI 推荐、人类常见下法、错误变化做 comparison block。
- 保留并编辑完整棋谱分支树：导入 SGF 后不能只保留线性主线，用户必须能在分支树中跳到任意节点、设为主分支、删除分支。
- 保存为 `.brg.json`，后续升级为 zip-based `.brg`。
- 预览整篇研究文章。
- 导出 HTML，再用浏览器/Playwright 导出 PDF。
- 网站端上传 `.brg` 后渲染为可交互文章。

## 3. `.brg` JSON Schema 草案

当前 MVP 的 TypeScript 类型和 JSON Schema 草案在：

- [src/research/types.ts](/Users/tuxy/Codes/KataGo/TensuGo/src/research/types.ts)
- [src/research/document.ts](/Users/tuxy/Codes/KataGo/TensuGo/src/research/document.ts)

顶层字段：

- `brgVersion`: 文档格式版本，当前为 `0.1`。
- `id`, `title`, `subtitle`, `author`, `createdAt`, `updatedAt`
- `sourceGame`: `fileName`, `boardSize`, `komi`, `rules`, `players`, `result`, `totalMoves`
- `tags`, `thumbnail`, `mainSgf`, `assets`, `sections`

核心 block 类型：

- `heading`
- `paragraph`
- `board`
- `variation`
- `ai_analysis`
- `candidate_moves`
- `comparison`
- `image`
- `quote`
- `conclusion`

board block 支持：

- `moveNumber`
- `position`
- `showCoordinates`
- `showLastMove`
- `markers`
- `arrows`
- `caption`

variation block 支持：

- `fromMoveNumber`
- `sequence`
- `name`
- `caption`
- `description`
- `compact`
- `interactive`
- `showPv`

ai_analysis block 支持：

- `engineName`
- `modelName`
- `visits`
- `winrate`
- `scoreLead`
- `policy`
- `pv`
- `candidateMoves`
- `ownershipMap`
- `timestamp`

## 4. `.brg` 示例文件

```json
{
  "brgVersion": "0.1",
  "id": "brg_example_001",
  "title": "小目夹击后的方向研究",
  "subtitle": "黑 37 后的右边战斗",
  "author": "TensuGo User",
  "createdAt": "2026-06-24T12:00:00.000Z",
  "updatedAt": "2026-06-24T12:30:00.000Z",
  "sourceGame": {
    "fileName": "example.sgf",
    "boardSize": 19,
    "komi": 7.5,
    "rules": "中国",
    "players": { "black": "黑棋", "white": "白棋" },
    "result": "B+R",
    "totalMoves": 187
  },
  "tags": ["定式", "中盘", "AI研究"],
  "thumbnail": "asset_thumb_001",
  "mainSgf": "(;GM[1]FF[4]SZ[19]KM[7.5];B[pd];W[dd])",
  "assets": [
    {
      "id": "asset_thumb_001",
      "type": "thumbnail",
      "name": "cover.png",
      "mimeType": "image/png",
      "uri": "assets/cover.png"
    }
  ],
  "sections": [
    {
      "id": "sec_opening",
      "title": "右边战斗",
      "blocks": [
        {
          "id": "blk_title",
          "type": "heading",
          "level": 1,
          "text": "黑 37 的方向选择",
          "createdAt": "2026-06-24T12:00:00.000Z",
          "updatedAt": "2026-06-24T12:00:00.000Z"
        },
        {
          "id": "blk_text",
          "type": "paragraph",
          "markdown": "黑棋此处重点不是局部吃子，而是压缩白棋右边的发展。",
          "createdAt": "2026-06-24T12:02:00.000Z",
          "updatedAt": "2026-06-24T12:02:00.000Z"
        },
        {
          "id": "blk_board",
          "type": "board",
          "title": "第 37 手局面",
          "moveNumber": 37,
          "boardSize": 19,
          "position": [
            { "moveNumber": 1, "color": "black", "x": 16, "y": 16, "isLast": false },
            { "moveNumber": 2, "color": "white", "x": 3, "y": 3, "isLast": false },
            { "moveNumber": 37, "color": "black", "x": 15, "y": 12, "isLast": true }
          ],
          "showCoordinates": true,
          "showLastMove": true,
          "markers": [
            { "id": "m1", "x": 15, "y": 12, "shape": "circle", "color": "#d84b57" },
            { "id": "m2", "x": 14, "y": 10, "shape": "label", "text": "要点" }
          ],
          "arrows": [
            { "id": "a1", "from": { "x": 15, "y": 12 }, "to": { "x": 16, "y": 10 }, "color": "#087f8c" }
          ],
          "caption": "黑 37 后，右边白棋尚未安定。",
          "createdAt": "2026-06-24T12:03:00.000Z",
          "updatedAt": "2026-06-24T12:03:00.000Z"
        },
        {
          "id": "blk_ai",
          "type": "ai_analysis",
          "engineName": "KataGo",
          "modelName": "kata1-b18",
          "visits": 8000,
          "winrate": 56.2,
          "scoreLead": 2.4,
          "policy": 0.18,
          "pv": ["Q10", "R10", "Q9", "P9"],
          "candidateMoves": [
            { "rank": 1, "moveName": "Q10", "visits": 4200, "winrate": 56.2, "scoreLead": 2.4, "pv": ["Q10", "R10", "Q9"] },
            { "rank": 2, "moveName": "P9", "visits": 2100, "winrate": 54.8, "scoreLead": 1.8, "pv": ["P9", "Q10"] }
          ],
          "timestamp": "2026-06-24T12:04:00.000Z",
          "createdAt": "2026-06-24T12:04:00.000Z",
          "updatedAt": "2026-06-24T12:04:00.000Z"
        },
        {
          "id": "blk_variation",
          "type": "variation",
          "fromMoveNumber": 37,
          "name": "AI 推荐：Q10 压迫",
          "caption": "黑先在右边压迫白棋",
          "description": "Q10 是兼顾攻击和实地的方向。",
          "sequence": ["Q10", "R10", "Q9", "P9"],
          "compact": false,
          "interactive": true,
          "showPv": true,
          "createdAt": "2026-06-24T12:05:00.000Z",
          "updatedAt": "2026-06-24T12:05:00.000Z"
        }
      ]
    }
  ]
}
```

## 5. 桌面端 UI 设计

当前 MVP 已在 App 中接入研究文档面板：

- 左侧：文档标题、常驻棋评 textarea、插入变化、保存、导出 PDF。
- 中间：主棋盘和当前局面。
- 右侧：完整分支树；有评论/变化的手数显示文本图标。
- 底部：现有引擎、导航、自动分析控制。

推荐完整编辑流程：

1. 打开 SGF/GIB。
2. 跳到关键手数。
3. 在常驻 textarea 中写棋评正文。
4. 摆出手动变化，或选择当前 AI/PV 变化。
5. 点“插入变化”，生成 variation block。
6. 点右侧分支树中的文本图标，主棋盘跳转到对应评论变化。
7. 保存 `.brg`，或导出 PDF。

分支树要求：

- 右侧分支树是完整棋谱 game tree 的导航器，不是简单手数列表。
- 主线必须连续向下显示，长棋谱靠垂直滚动查看。
- 不能为了显示长主线而向右拐弯排版；右侧横向空间只用于显示同一分歧点上的分支。
- 点击任意节点，主棋盘跳到该 game-tree node。
- 当前节点必须高亮；主线节点和分支节点要有明确视觉差异。
- `设为主分支`：把当前变化提升为主线，原主线保留为分支。
- `删除分支`：删除当前变化子树，必须有确认；不能误删主线其它兄弟分支。
- 导入 OGS 等 SGF 时，可能出现“每一步都是单子树”的编码方式；解析层必须保留完整树，UI 层允许用户修正哪条是主分支。
- 写棋评时手动摆变化，应落到真实分支节点里；保存变化/插入 variation block 时引用 game-tree 节点或分支路径，而不是只保存被截断后的线性 moves。

撤销/重做推荐：

- MVP 阶段使用 React state history，记录 document 的 patch 或快照。
- 正式版本使用 command pattern：`insertBlock`, `updateBlock`, `removeBlock`, `moveBlock`, `updateAnnotation`。
- 每次操作先生成新对象，再原子替换 document，避免半写入。

避免 JSON 损坏：

- 保存时写临时文件，再 rename。
- 打开时先 JSON parse，再 schema validate。
- 保留最近自动保存版本：`filename.brg.autosave.json`。
- 文档内 `brgVersion` 明确，升级时走 migration。

## 6. 网站端发布设计

网站端建议使用 React / Next.js，和桌面端共用 TypeScript 类型、棋盘组件、文档 renderer。

组件：

- `ResearchArticle`: 读取 `.brg` 并渲染整篇文章。
- `BoardBlock`: 渲染静态/交互棋盘。
- `VariationBlock`: 支持播放变化、跳转手数。
- `AIAnalysisBlock`: 显示胜率、目差、PV。
- `CandidateMovesBlock`: 候选点表格。
- `ComparisonBlock`: 多变化横向对比。
- `MarkdownBlock`: 正文讲解。
- `ExportButton`: 导出 HTML/PDF/图片。
- `ShareButton`: 分享链接、二维码。

SEO：

- 标题、作者、摘要、标签生成 meta tags。
- 公开文章使用 Next.js SSG/ISR 生成静态 HTML。
- 棋盘 SVG 首屏可直接出现在 HTML 中，搜索引擎能读取正文。
- 私密文章走鉴权 API，不生成公开静态页。

Fork / Remix：

- 在线文章保留原始 `.brg`。
- Fork 生成新 document id，保留 `forkedFrom` 和原作者信息。
- 评论、收藏、浏览量属于网站业务表，不写回 `.brg`。

## 7. PDF 导出设计

推荐早期采用 HTML -> PDF。

方案 A：HTML -> PDF

- 使用共享 renderer 输出 print CSS。
- Playwright/Puppeteer 调 Chromium 生成 PDF。
- 棋盘用 SVG，不用截图，缩放和打印清晰。
- 分页由 CSS 控制：`@page`, `break-inside: avoid`, section page break。
- 长变化图拆成多个 figure，或者以表格/PV 列表辅助展示。
- 微信传播版使用 A4、较窄页边距、清晰标题页、页脚二维码。

优点：

- 和网站渲染共用组件。
- 排版迭代快。
- SVG 棋盘清晰。
- 易于同时导出 HTML 和长图。

缺点：

- 复杂分页需要反复调 CSS。
- 浏览器打印细节受 Chromium 版本影响。

方案 B：Native PDF

- 使用 PDF 库直接绘制文字、线条、棋子和图片。
- 适合高度定制讲义、严格分页和出版级排版。

优点：

- 输出稳定、控制力强。
- 可精确处理页眉页脚、目录和二维码。

缺点：

- 重写渲染逻辑，无法直接复用网页组件。
- 开发成本高，文字换行、中文字体、分页复杂。

长图 PNG：

- HTML renderer 输出一页长文章。
- Playwright 截整页图，适合朋友圈/公众号预览。
- 棋盘仍使用 SVG，可在截图前按设备像素比放大。

## 8. 技术架构推荐

推荐：桌面端 Tauri + React，网站端 Next.js，共享 TypeScript packages。

Qt/PySide：

- 桌面原生强，但 Web 组件复用弱。
- PDF/native 绘制可控，但网页发布要重写。

Electron：

- Web 组件复用最好，PDF 导出方便。
- 包体大、资源占用高。

Tauri：

- 当前 TensuGo 已采用 Tauri。
- 包体小，React 组件可复用到网站。
- 通过 Rust/Tauri commands 做文件保存、引擎和系统能力。
- HTML -> PDF 可以调用浏览器或内置 WebView/Chromium 辅助流程。

推荐代码结构：

```text
packages/
  core/              # game tree, SGF/GIB, rules, coordinates
  board/             # React 棋盘、SVG 棋盘、标注层
  document-schema/   # BRG types, schema, validation, migrations
  renderer/          # BRG -> React/HTML/Markdown
  pdf-export/        # HTML -> PDF, long PNG export
apps/
  desktop/           # Tauri + React 编辑器
  web/               # Next.js 发布站
```

当前仓库还不是 monorepo，MVP 先放在 `src/research`，稳定后再抽 package。

## 9. MVP 开发计划

Week 1:

- `.brg` schema/type。
- SGF/GIB 到 internal move list。
- board block 的局面固化。
- SVG 棋盘导出。

Week 2:

- block editor。
- board/paragraph/variation block。
- save/load `.brg.json`。
- 文档 block 与主棋盘联动。

Week 3:

- HTML renderer。
- print CSS。
- Playwright PDF export。
- PDF 标题页、目录、页码、页脚二维码。

Week 4:

- 示例研究文档。
- 网站 demo。
- 样式 polish。
- 自动保存、撤销/重做、错误恢复。

MVP 不做：

- 用户系统
- 评论区
- Fork
- 云同步
- 协作编辑
- 权限系统
- 视频导出
- 复杂排版

## 10. 后续商业化方向

- 高级 PDF 模板：讲义、公众号、课程资料。
- AI 辅助写作：自动总结关键手、生成标题、生成结论。
- 云端研究库：公开/私密文章、收藏、标签、搜索。
- Fork / Remix：围棋研究社区化。
- 课程包：教师发布专题研究，学生交作业和评论。
- 俱乐部/道场版本：成员管理、题库、研究合集。
- 高级引擎缓存：多模型对比、历史复算、批量自动分析。
- 付费发布页：个人主页、专栏、打赏、订阅。
