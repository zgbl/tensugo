# TensuGo User Guide

TensuGo 是一个围棋棋谱复盘和 KataGo 辅助分析工具。当前发布重点支持：

- Windows 64 位
- Mac Apple Silicon（M1/M2/M3/M4）

暂不提供 Windows 32 位和 Intel Mac 安装包。

## 安装 TensuGo

### Windows 64 位

1. 打开 GitHub Releases。
2. 下载 Windows x64 安装包。
3. 运行安装程序。
4. 第一次打开后进入 `设置 > 引擎`，确认 KataGo 引擎状态。

Windows 版会按当前发布策略提供适合 Windows 的引擎安装/配置流程。不要使用旧的内置整合包说明。

### Mac Apple Silicon

1. 打开 GitHub Releases。
2. 下载 Mac Apple Silicon 安装包。
3. 安装并打开 TensuGo。
4. 安装 KataGo 引擎：

```bash
brew install katago
```

5. 打开 TensuGo 的 `设置 > 引擎`。
6. 点击 `Auto Detect`。
7. 选择检测到的 Homebrew KataGo 配置。
8. 点击 `Test Engine` 验证引擎可以启动。
9. 点击 `设为默认`。

Mac 版当前不把 KataGo 引擎和模型打进安装包。用户需要自己通过 Homebrew 安装 KataGo，TensuGo 负责自动检测和配置。

## KataGo 引擎配置

进入 `设置 > 引擎` 后，可以看到引擎列表和当前选中配置。

常用按钮：

- `Auto Detect`：手动扫描系统里的 KataGo、模型和配置文件。
- `Test Engine`：测试当前配置是否能启动。
- `选择`：手动选择 Engine 或 Model。
- `Choose Config`：手动选择 KataGo GTP 配置文件。
- `保存到列表`：把当前填写的配置保存为一个引擎配置。
- `设为默认`：把当前配置设为默认分析引擎。
- `删除`：删除当前高亮的配置行。
- `Reset to Default`：清空当前默认配置，不会自动扫描系统路径。

TensuGo 启动时不会自动扫描系统路径。只有点击 `Auto Detect` 才会扫描。

## Mac KataGo 安装说明

推荐方式是 Homebrew：

```bash
brew install katago
```

安装完成后，常见路径类似：

- Engine: `/opt/homebrew/bin/katago`
- Model: `/opt/homebrew/share/katago/...bin.gz`
- Config: `/opt/homebrew/share/katago/configs/gtp_example.cfg`

如果 `Auto Detect` 找到了多个配置，优先选择 Homebrew 路径下可用的一项，然后点击 `Test Engine`。

## Windows KataGo 安装说明

Windows 版只支持 64 位安装包。当前发布流程以 Windows x64 为目标，不提供 Windows 32 位版本。

Windows 引擎安装和配置以后续 release 内说明为准。安装后进入 `设置 > 引擎`：

1. 点击 `Auto Detect`。
2. 如果发现可用引擎，选中后点击 `Test Engine`。
3. 测试通过后点击 `设为默认`。
4. 如果自动检测失败，可以手动选择 Engine、Model、Config。

## 高级：手工命令配置

如果 KataGo 启动方式有特殊参数，或者你想完全控制启动命令，可以使用 `手工命令`。

示例：

```bash
/opt/homebrew/bin/katago gtp -model /path/to/model.bin.gz -config /path/to/gtp.cfg
```

填写后点击 `添加手工配置`。这个手工命令不会被 `Auto Detect` 自动填充，也不会和普通 Engine Path / Model Path / Config 输入混用。

## 常见问题

### Mac 上 Auto Detect 找不到 KataGo

先确认 Homebrew 安装成功：

```bash
katago version
```

如果命令不存在，重新安装：

```bash
brew install katago
```

然后回到 TensuGo，点击 `Auto Detect`。

### 引擎测试失败

检查三项：

- Engine Path 指向 `katago`
- Model Path 指向 `.bin.gz` 或 KataGo 支持的模型文件
- Config 指向 GTP 配置文件

Mac Homebrew 安装时，优先使用 `gtp_example.cfg` 或可用的 GTP 配置。

### 删除配置后又出现

TensuGo 启动时不会自动扫描。只有你点击 `Auto Detect` 后，系统里的候选引擎才可能重新出现在列表中。

