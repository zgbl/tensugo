# 拟人引擎重大功能更新设计记录

日期：2026-07-15

## 1. 本次功能更新

TensuGo Desktop 已从单一 AI 对弈扩展为可比较的双引擎对弈：黑方和白方分别选择 Engine Profile、正常/拟人模式和拟人段位；后端为黑白双方维护独立的 KataGo 常驻进程，避免每手切换 Profile 时重新加载模型。

机机对弈的目标不是简单演示，而是为拟人 Profile 做可重复的实力校准。对局记录必须保留双方 Profile、Human Model、配置文件、主模型、搜索限制、让子和贴目。

## 2. 当前实测结论

实测中，强 AI 让 3D 拟人四子，3D 拟人仍然获胜。当前产品暂采用工作假设：

| Profile | 工作换算 | 状态 |
| --- | --- | --- |
| 3D | 约职业 9P | 待多盘验证 |
| 1D | 约业余 8D | 待多盘验证 |
| 1K | 约业余 7D | 待多盘验证 |

这不是 KataGo 官方等级换算，也不是正式棋力认证。它只用于当前产品的 Profile 选择和对局实验。

## 3. 为什么 Profile 会比名称强很多

Human SL Profile 描述的是“模仿哪一类人类棋谱的策略分布”，不是最终棋力上限。启用 KataGo 搜索后，搜索会过滤明显坏棋、补足战术计算，并利用主模型评估，因此实际强度可能远高于 `preaz_3d`、`preaz_1d` 等名称。

目前的证据更支持“引擎设计带来的标准偏差”，而不是单纯设置错误：其他网站使用相同拟人引擎也有类似体验。但仍必须通过双引擎固定条件对局排除配置问题。

校准实验要求：固定主模型和 Human Model；固定每手时间或 Visits；黑白互换；每组至少多盘；保存 KataGo stderr、启动参数和 config；比较胜率、平均目差、认输手数和异常停手。

## 4. Profile 配置规则

KataGo Human SL 官方可用范围为 `preaz_20k` 到 `preaz_9d`。因此 `25K`、`30K` 不是有效官方 Profile，不能通过简单改名生成。

弱棋配置和搜索增强配置必须分开：

- 弱棋：低 `maxVisits`，较大的 `humanSLChosenMovePiklLambda`，较低的 `humanSLCpuctPermanent`，避免主 KataGo 把坏棋全部纠正掉。
- 搜索增强：更高 Visits、较小 Lambda、较大的探索参数；它更强，但不再代表对应 Profile 的原始棋力。

## 5. 资源和打包策略

当前拟人 `.cfg` 和 Human Model 位于项目目录外，只存在于本机。这会造成：

- 不会进入 GitHub；
- 新机器无法复现配置；
- macOS 和 Windows 打包时没有统一资源；
- 配置中的绝对路径不能跨平台使用；
- Human Model 权重很大，不适合直接塞进 Git 仓库。

推荐拆分：

1. 将所有 `.cfg`、Profile 元数据和默认参数放入项目：`desktop/src-tauri/resources/katago/configs/human/`，配置使用相对资源名，不写用户绝对路径。
2. 不把大模型权重直接提交 Git；提供下载地址、版本校验和首次启动下载/导入流程，保存到用户数据目录。
3. KataGo 可执行文件按平台分别提供或自动检测：macOS Apple Silicon、Windows x64 等不能共用一个二进制。
4. 启动时将项目内模板配置复制到运行时目录，注入当前平台的 `modelPath`、`humanModelPath` 和日志目录。
5. GitHub 版本必须包含 Profile 清单、配置模板、模型版本和 SHA-256；发布包可以附带配置，但权重按许可证和体积决定是否单独下载。

这样 Windows 不需要同步 macOS 的绝对路径，也不会因为本机目录外文件没有提交而出现“UI 有档位、实际配置不存在”的问题。
