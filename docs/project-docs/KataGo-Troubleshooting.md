# KataGo Troubleshooting

This document records how to debug local KataGo engine startup for TensuGo.

## Current Symptom

In TensuGo, clicking `AI分析` shows:

```text
KataGo 进程异常退出
```

or:

```text
KataGo OpenCL 初始化失败：CL_INVALID_VALUE
```

or:

```text
Error creating directory: KataGoData
```

This means the button did trigger the engine path. The engine process started, but exited before returning candidate moves.

`Error creating directory: KataGoData` means KataGo was launched from a directory where the app could not create its relative `homeDataDir`. TensuGo now launches KataGo from:

```text
~/Library/Application Support/TensuGo/KataGoRuntime
```

so the relative `KataGoData` directory should be writable there.

When KataGo is working, the UI should show real candidate points, visits/playouts, winrate, score lead, and PV. The Release v0.1 analysis path uses a persistent KataGo session for short repeated analysis requests, but it is not yet a full legacy-style streaming engine with continuous PO/visits updates. Even the short request path must return candidates before anything can be displayed.

## Current Default Command

TensuGo currently seeds this default engine configuration:

```bash
/opt/homebrew/bin/katago gtp \
  -model "/opt/homebrew/share/katago/g170e-b20c256x2-s5303129600-d1228401921.bin.gz" \
  -config "/Users/tuxy/App/KataGo/Config/winConfigs/default_gtp.cfg"
```

The files exist, and:

```bash
katago version
```

returns:

```text
KataGo v1.14.1
Using OpenCL backend
```

So the executable exists and can launch in version mode.

## Reproduce Outside TensuGo

Run this in Terminal:

```bash
printf 'boardsize 19\nkomi 7.5\nclear_board\nkata-analyze B 20\n' | \
  /opt/homebrew/bin/katago gtp \
    -model "/opt/homebrew/share/katago/g170e-b20c256x2-s5303129600-d1228401921.bin.gz" \
    -config "/Users/tuxy/App/KataGo/Config/winConfigs/default_gtp.cfg"
```

Current observed failure:

```text
Found OpenCL Platform 0: Apple ...
libc++abi: terminating due to uncaught exception of type StringError:
OpenCL error ... CL_INVALID_VALUE
```

Another observed failure before fixing the runtime directory:

```text
libc++abi: terminating due to uncaught exception of type StringError:
Error creating directory: KataGoData
```

This confirms the failure is in KataGo/OpenCL initialization, not in the React button.

## What This Error Usually Means

`CL_INVALID_VALUE` during KataGo OpenCL initialization usually means the OpenCL backend cannot create or use the selected neural-net buffer/kernel on this macOS/GPU/OpenCL combination.

Possible causes:

- Homebrew KataGo was built with OpenCL backend, but the current macOS/OpenCL driver path is not compatible.
- OpenCL tuning data is stale or incompatible.
- Config expects OpenCL behavior that no longer works on this machine.
- The selected binary/backend is not the same one the old Java package successfully used.
- A CPU/Eigen or Metal build may be needed instead of OpenCL.

## Things Already Tried

Changing the working directory did not fix it:

- `/Users/tuxy/Codes/tensugo/desktop`
- `/Users/tuxy/App/KataGo/202306Mac64/Macosx(amd64)`
- `/Users/tuxy/App/KataGo/Config/winConfigs`

Disabling common OpenCL toggles did not fix it:

```bash
-override-config openclUseFP16=false
-override-config openclUseNHWC=false
```

The other bundled file:

```text
/Users/tuxy/App/KataGo/katago-v1/katago
```

is a Linux ELF executable, not a macOS binary, so it cannot run on this Mac.

## Next Checks

1. Find or install a non-OpenCL KataGo build for this Mac.

Useful target backends:

- CPU/Eigen backend, slower but good for debugging.
- Metal backend, if available for the installed KataGo version.
- A newer macOS arm64 KataGo release that works with current macOS GPU stack.

2. Test the candidate binary from Terminal before wiring it into TensuGo.

The minimum passing test is:

```bash
printf 'boardsize 19\nkomi 7.5\nclear_board\nkata-analyze B 20\n' | \
  /path/to/katago gtp \
    -model "/path/to/model.bin.gz" \
    -config "/path/to/default_gtp.cfg"
```

Expected success:

```text
info move ... visits ... winrate ... scoreLead ... pv ...
```

3. Once Terminal returns `info move` lines, update TensuGo:

Open `设置 -> 引擎`, replace the executable/config/model paths if needed, then click `测试`.

## Current TensuGo Limitation

TensuGo currently starts a short-lived KataGo process per analysis request and kills it after a short wait. This is enough to prove the command and parse candidate output, but not enough for legacy-style continuous PO jumping.

Required future work:

- Keep KataGo as a persistent process.
- Stream stdout lines into the UI.
- Update visits/playouts continuously.
- Stop/restart analysis cleanly when the move changes.
- Store analysis per game node.

Until the Terminal test returns `info move` lines, no UI implementation can display real candidates.
