# TensuGo Research Document & PDF 导出设计

Version: 1.1

Status: Draft

---

# 1. 设计目标

TensuGo 导出的文档不仅用于打印，更用于：

- AI 棋局研究
- 围棋教学
- 比赛复盘
- 围棋教材
- 分享交流
- 收藏打印

因此：

> 用户写的是围棋内容，而不是 PDF 页面。

PDF 只是最终输出格式之一。

---

# 2. V1 设计目标

V1 不追求 Notion 式自由排版。

采用成熟、稳定的 Word 风格文档设计。

目标：

- 专业
- 美观
- 自动排版
- 易于阅读

用户无需关心页面布局。

---

# 3. 设计原则

## 内容优先

用户只负责：

- 写文字
- 插入变化
- 插入棋盘

不要关心：

- 图片放左还是右
- 是否跨页
- 页面留白
- 页面布局

全部由排版引擎自动完成。

---

## 自动排版

导出系统负责：

- 自动分页
- 自动布局
- 自动页码
- 自动页眉页脚

用户不需要手工调整。

---

## 专业出版风格

目标参考：

- 围棋天地
- 日本棋院教材
- AI 研究报告

而不是：

浏览器网页直接打印。

---

# 4. 文档整体结构

第一页：

```
标题

↓

比赛信息

↓

天书报告

↓

胜率变化图

↓

正文开始
```

后续：

```
Paragraph

↓

Variation

↓

Paragraph

↓

Variation

↓

Paragraph
```

---

# 5. 封面信息

第一页建议包含：

- 标题
- 双方
- 日期
- 作者
- 棋盘规格
- 规则
- AI Engine
- KataGo Model

以后：

Logo

---

# 6. 天书报告（Executive Summary）

第一页必须包含。

目的：

一分钟了解整盘棋。

建议内容：

## AI总体评价

★★★★★

## 吻合率

87%

## Top Move 命中率

75%

## Candidate 命中率

93%

## 平均胜率损失

2.1%

## 平均 Score Loss

0.6

## 最大失误

Move 87

Winrate Loss 18%

## AI Engine

KataGo

## KataGo Model

...

## 分析耗时

...

以后加入：

- Opening Accuracy
- Middle Game Accuracy
- Endgame Accuracy
- Heat Map
- Mistake Distribution

---

# 7. 胜率变化图

第一页建议放置。

例如：

```
Winrate Graph

────────────────────────

\
 \
  \
   \____

────────────────────────
```

以后增加：

- Score Lead 曲线
- Ownership 曲线

---

# 8. 正文

正文由多个内容块组成。

V1：

支持：

- Paragraph（纯文字）
- Variation（变化图）

以后：

- AI Report
- Table
- Image
- Quote

---

# 9. Variation 布局

建议：

```
变化 3

┌──────────────┬──────────────┐

棋盘              评论

└──────────────┴──────────────┘
```

原则：

棋盘固定尺寸。

评论自动增长。

---

# 10. 纯文字与棋谱混排

这是整个 PDF 最重要的问题。

原则：

不要为了固定布局产生大片留白。

例如：

```
Paragraph

↓

Variation

↓

Paragraph
```

评论结束以后，

正文继续。

不要因为棋盘高度固定而产生大片空白。

评论允许超过棋盘高度。

正文保持自然阅读。

---

# 11. 单栏还是双栏

V1：

正文统一采用单栏。

原因：

- 阅读舒适
- 棋盘较宽
- 教学效果最好

未来：

附录可以双栏。

变化索引可以双栏。

---

# 12. 页面元素

页眉：

```
TensuGo Research Document

标题
```

页脚：

```
Page X / N
```

以后：

Logo

日期

二维码

---

# 13. 导出设置

V1 只开放最重要参数。

## 页面

- A4
- Letter

## 页面方向

- Portrait
- Landscape

## 页边距

- Left
- Right
- Top
- Bottom

(mm)

## 棋盘

棋盘大小(mm)

## 每页变化数量

2

3

4

## 输出格式

- PDF
- HTML

其它参数采用默认值。

---

# 14. HTML 与 PDF

HTML：

用于预览。

PDF：

用于打印。

目标：

HTML 与 PDF 布局尽量保持一致。

避免：

HTML 很漂亮，

PDF 完全不同。

---

# 15. V1 暂不实现

暂不支持：

- Block Editor
- 自由拖拽
- 双栏正文
- 自定义模板
- 自定义 CSS
- PDF Bookmark
- 自动目录
- EPUB
- Markdown 导出

统一放入 V2。

---

# 16. V2 展望

未来升级为真正的 Research Document。

支持：

- Block Editor（类似 Notion）
- AI Report Block
- Chart Block
- Table Block
- Image Block
- 自定义模板
- 多栏排版
- EPUB
- Markdown
- PDF
- HTML

---

# 17. V1 成功标准

用户编辑文档时：

只需要：

- 写文字
- 插变化
- 写评论

完全不用考虑：

- 排版
- 分页
- 页面布局

导出的 PDF：

可以直接发送、打印、分享。

无需再进入 Word 调整格式。

最终目标：

> 让 TensuGo 导出的文档达到专业围棋研究报告的质量。