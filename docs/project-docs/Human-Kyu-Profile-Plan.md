# Human SL 拟人棋力档位与校准

当前 UI 支持：`20K、15K、10K、8K、6K、4K、2K、1D、3D、5D、7D、9D`。

KataGo Human SL 官方 Profile 的可用范围是 `preaz_20k` 到 `preaz_9d`，因此不能生成 `25K` 或 `30K` 这种超出模型训练范围的档位。

低段位档位必须区分两种配置策略：

1. **弱棋配置**：`15K/20K` 使用低 Visits、关闭 KataGo 强搜索纠错，尽量接近 Human SL 原始策略。
2. **搜索增强配置**：`2K–10K` 以及高段位配置可以使用搜索，但 `maxVisits`、`humanSLChosenMovePiklLambda`、`humanSLCpuctPermanent` 会显著改变实际棋力，不能只看 `humanSLProfile` 名称。

| UI 档位 | 配置文件 | `humanSLProfile` |
| --- | --- | --- |
| 2K | `gtp_human2k_search_example.cfg` | `preaz_2k` |
| 4K | `gtp_human4k_search_example.cfg` | `preaz_4k` |
| 6K | `gtp_human6k_search_example.cfg` | `preaz_6k` |
| 8K | `gtp_human8k_search_example.cfg` | `preaz_8k` |
| 10K | `gtp_human10k_search_example.cfg` | `preaz_10k` |
| 15K | `gtp_human15k_search_example.cfg` | `preaz_15k` |
| 20K | `gtp_human20k_search_example.cfg` | `preaz_20k` |

所有配置都必须通过 `-human-model b18c384nbt-humanv0.bin.gz` 启动。普通 Profile 不能直接切换成拟人 Profile，程序必须同时补齐 `humanModelPath`、`humanConfigPath` 和 `engineMode=human`。

## 当前实测校准假设

用户实测：强 AI 让 3D 四子，3D 拟人仍获胜。当前产品暂按以下工作换算使用，但这不是官方等级认证：

| Human Profile | 当前产品工作换算 |
| --- | --- |
| 3D | 约职业 9P |
| 1D | 约业余 8D |
| 1K | 约业余 7D |

这说明 Profile 名称与实际对局棋力存在严重偏差，尤其是使用搜索增强配置时。所有后续比较必须记录：主模型、Human Model、配置文件、Visits/秒数、让子、贴目和对手 Profile。

## 结论

当前偏差更可能来自 KataGo Human SL 的“人类策略 + KataGo 搜索”设计，而不是单纯 UI 没有传入 Profile：官方文档也明确说明，搜索通常会显著强于被模仿的段位。其他网站也观察到类似现象，进一步支持这是引擎标准偏差；但在正式定标前仍应使用固定主模型、固定计算量、互换黑白、至少多盘对局验证。
