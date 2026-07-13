# TensuGo 出题数据设计

## 模式

主工具栏使用一个下拉列表切换四种模式：`复盘`、`写棋评`、`出题`、`做题`。出题模式从当前棋盘局面和当前 AI 候选创建题目；做题模式消费 TSG 中已有的题目标记，完整答题交互在后续阶段实现。

## TSG 存储

题目保存在 TSG 顶层扩展 `tensugo.problemSet` 中。TSG 本身已经保存原始 SGF/棋谱和完整 game tree，所以题目用 `moveNumber` 链接到“该手落下之前”的出题局面，不重复复制整盘棋。

一个源棋谱只维护一个 TSG 研究文档，由该棋谱创建的所有题目都追加或更新在同一 `problemSet.items[]` 中。桌面端打开 TSG 时必须保留真实磁盘路径；保存题目优先原位写回该路径，不弹“另存为”。只有当前文档尚无 TSG 路径时才执行一次保存对话框，并记住新路径供后续题目复用。

局面导航是出题草稿的生命周期边界。手数、分支或棋盘落子发生变化时，必须清空当前题目、AI 待选候选、候选编辑状态和保存提示，防止上一局面的候选点污染新局面。

```json
{
  "tensugo": {
    "problemSet": {
      "version": 1,
      "items": [{
        "id": "problem-...",
        "moveNumber": 86,
        "color": "white",
        "sourceNodeId": "node-...",
        "positionMoves": [],
        "positionHash": "5e0d3c2a...",
        "positionHashAlgorithm": "fnv1a64-board-v1",
        "trigger": { "type": "manual" },
        "prompt": "第 86 手，白棋请选择最佳下法。",
        "fullScoreMove": "Q10",
        "candidateScores": [
          { "moveName": "Q10", "rank": 1, "score": 10, "visits": 3200, "winrate": 58.2, "scoreLead": 2.1, "pv": ["Q10", "R10"] },
          { "moveName": "P9", "rank": 2, "score": 8, "visits": 1800, "winrate": 55.1, "scoreLead": 1.3, "pv": ["P9", "Q10"] }
        ],
        "analysis": {
          "generatedAt": "...",
          "candidates": []
        }
      }]
    }
  }
}
```

- `moveNumber`：待解答的手数；出题局面通常是原棋谱的前 `moveNumber - 1` 手。
- `sourceNodeId`：链接 TSG game tree 中的精确局面节点，支持原主线和已有分支。
- `positionMoves`：出题时的局面快照，保证数据库和脱离原棋谱的处理仍能还原题面。
- `positionHash`：棋盘路数、下一手颜色和提子处理后的交叉点棋子集合的稳定哈希。相同最终局面即使落子顺序或贴目设置不同也会触发重复提醒。
- `fullScoreMove`：创建题目时的 AI 第一候选，固定为满分答案。
- `candidateScores`：AI 候选和人工加入/筛选后的候选；每项独立保存分数及分析数据。
- `analysis.candidates`：创建题目时的完整 AI 候选快照，供以后重新挑选答案。

## PostgreSQL 存储

专用表为 `go_problems`。常用查询字段结构化保存，同时 `payload` 保留完整题目对象，保证 TSG 与数据库可以无损往返。

| 字段 | 含义 |
| --- | --- |
| `id` | 与 TSG 题目相同的稳定 ID |
| `source_file_name` | 原棋谱/TSG 文件名 |
| `move_number` | 待解答手数 |
| `board_size` | 棋盘路数 |
| `color` | 答题方 |
| `full_score_move` | AI 第一候选、满分答案 |
| `position_hash` | 局面查重校验值，并建立查询索引 |
| `source_position` | 出题前的落子序列 JSONB |
| `actual_move` | 原棋谱实战下一手 JSONB，可为空 |
| `candidate_scores` | 入选候选及各自分数 JSONB |
| `payload` | 完整题目 JSONB |

保存同一 `id` 时执行 upsert，保留创建时间并更新内容与 `updated_at`。

## 查重与出题界面

创建题目前先检查当前 TSG 的 `problemSet.items[].positionHash`，桌面版再查询 PostgreSQL `go_problems.position_hash`。命中时必须提醒用户已有题目，并由用户决定取消或继续，不静默创建重复局面。

进入出题模式后，右栏第三段不显示 PV 小棋盘，改为“题目选点”区。这里显示已入选答案、每项评分、局面哈希，以及增加候选点、删除候选点、保存题目和关闭草稿操作。出题操作不得用浮动条覆盖主棋盘。
