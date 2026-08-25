# TensuGo V0.7.55

> Released 2026-08-24 · Windows x64 / macOS Apple Silicon

V0.7.55 rounds out the review workflow that shipped through the 0.7.x series and
hardens the platform side. If you have not updated since 0.7.50, you get all of
the headline features below; returning users will notice the platform fixes and
localization polish.

## What's new

- **Problem creation & solving.** Create problems straight from reviewed
  positions (A/B problem types, automatic problem marks) and solve them by
  target level, with rankings.
- **Engine: dual-mode configuration with memory monitoring.** Run the engine in
  normal or human-style ("拟人") mode. Human-style profiles expose configurable
  candidate counts and level offsets; both modes now report memory usage.
- **Batch analysis console.** Queue and run analysis across many positions at
  once instead of clicking through one at a time.
- **Richer research documents.** Board-screenshot cropping, variation / PV
  study, and export to PDF or a packed single-file HTML — plus a standalone
  preview window before you save or share.
- **Shortcut panel.** Quick reference for the most-used keyboard shortcuts.
- **Localization.** Japanese and Korean interfaces completed across the app and
  site.

## Fixes & notes

- **macOS memory behavior (FAQ).** On macOS, freed memory is not immediately
  returned to the system — it stays in compressed/cached pages until memory
  pressure reclaims it. This is native macOS behavior, not a leak in TensuGo.
  Because AI analysis allocates a large block at once, Activity Monitor can keep
  showing high usage after analysis finishes. The memory is fully reclaimed when
  the process exits, so quit TensuGo (Cmd+Q) when you are done, and do not leave
  a long-running analysis unattended.
- Download and analytics infrastructure fixes (accurate per-platform version
  tracking, device/OS classification) to keep the public download page reliable.
- Windows 32-bit and Intel Mac installers remain out of scope.

## Download

- Windows x64 (with/without bundled KataGo engine): tensugo.com/download/latest/windows-x64/
- macOS Apple Silicon: tensugo.com/download/latest/macos-apple-silicon/

---

## 中文版

# TensuGo V0.7.55

> 发布于 2026-08-24 · Windows x64 / macOS Apple Silicon

V0.7.55 让 0.7.x 系列打磨出的复盘工作流更完整，并对平台侧做了加固。
如果还在 0.7.50，升级后即可使用下面全部重点功能；已升级的用户会看到平台修复与多语言完善。

## 主要更新

- **从复盘出题、按级别做题。** 直接在当前复盘局面创建题目（A/B 题型、自动出题标记），
  按目标级别做题并支持排名。
- **引擎：普通/拟人双模式 + 内存监控。** 支持普通与拟人两种引擎配置；拟人模式可调候选数与
  级别偏移，两种模式都展示内存占用。
- **批量分析控制台。** 一次把多个局面加入队列批量分析，不用逐个点击。
- **更丰富的研究文档。** 棋盘截图裁剪、变化图 / PV 研究，支持导出 PDF 或打包单文件 HTML，
  保存或分享前可独立预览。
- **快捷键面板。** 快速查看常用快捷键。
- **本地化。** 日文、韩文界面在应用与官网内均已完成。

## 修复与说明

- **macOS 内存占用说明（FAQ）。** macOS 释放的内存不会立刻归还给系统，而是先保留在压缩/
  缓存页中，等系统内存有压力时才回收——这是 macOS 原生行为，并非 TensuGo 泄漏。由于 AI
  分析会一次性分配较多内存，"不立即归还"会更明显，活动监视器可能一直显示高占用。进程退出后
  内存会被完整回收、占用立刻下降，所以用完请退出 TensuGo（Cmd+Q），人离开时不要长时间挂着
  AI 分析。
- 下载与统计基础设施修复（按平台准确记录版本、设备/系统分类），保证公开下载页稳定可靠。
- 暂不提供 Windows 32 位与 Intel Mac 安装包。

## 下载

- Windows x64（含/不含内置 KataGo 引擎）：tensugo.com/download/latest/windows-x64/
- macOS Apple Silicon：tensugo.com/download/latest/macos-apple-silicon/
