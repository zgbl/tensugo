# 项目 Skills 说明

这个目录存放 **项目级 Claude Code Skills**。Skill 是可按需加载的"能力包"，
Claude Code 会根据每个 `SKILL.md` 的 `description` 自动判断何时调用它，
而不是把所有内容一次性塞进上下文。

## 标准结构（三层渐进加载）

```
skill-name/
├── SKILL.md          (必需)
│   ├── YAML frontmatter: name + description
│   └── Markdown 正文：使用说明、流程、约定
├── scripts/           (可选) 可直接执行的脚本，确定性/重复性任务
├── references/        (可选) 按需加载的详细文档（协议细节、API 文档等）
└── assets/            (可选) 输出时会用到的模板、素材文件
```

- **第一层**：`name` + `description`（永远在上下文里，要简短、覆盖触发场景）
- **第二层**：`SKILL.md` 正文（命中后才加载，建议 < 500 行）
- **第三层**：`scripts/` `references/` `assets/`（按需加载，体量不限）

## 命名与触发建议

- `description` 要同时写清楚 **这个 skill 是做什么的** 和 **什么场景下应该用它**，
  可以适当"啰嗦"一点，多列几个触发关键词，避免漏触发。
- 一个 skill 只聚焦一个领域；如果正文超过 500 行，拆分到 `references/` 里，
  并在 SKILL.md 里写清楚"什么时候去读哪个参考文件"。
- 跨子领域（比如多种协议/多种引擎版本）时，按 variant 拆分 reference 文件，
  而不是全塞进一个 SKILL.md。

## 本项目当前的 Skills

下面这些目录按 TensuGo 项目的主要知识领域拆分。每个 `SKILL.md`
保留触发说明和核心流程，详细 MVP 范围放在各自 `references/` 中：

| Skill | 用途 |
|---|---|
| `architecture/` | 系统架构、模块边界、状态流、Mermaid 图和实施阶段 |
| `katago-protocol/` | KataGo 引擎通信协议（GTP / Analysis Engine JSON API） |
| `sgf-format/` | SGF 棋谱格式的读写与项目内约定 |
| `go-board-ui/` | 棋盘渲染、坐标系统、胜率/势力图等可视化约定 |
| `visual-design/` | UI 视觉方向、主题、布局密度、截图参考与视觉 QA |
| `project-conventions/` | 项目技术栈、目录结构、构建与代码风格约定 |

> 提示：如果只是想让 Claude Code 在**每次对话**都自动了解项目背景
> （技术栈、构建命令等），那是 `CLAUDE.md`（项目根目录）该做的事，
> 和这里的按需加载 Skill 是互补关系，不冲突。需要的话我也可以帮你建一份。
