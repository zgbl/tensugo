# Bundled KataGo Resources

This directory is reserved for future release bundles that include KataGo and a model.

Expected layout:

```text
katago/
  katago            # macOS/Linux executable, or katago.exe on Windows
  configs/
    default_gtp.cfg
  models/
    model.bin.gz
```

Large engine/model files are intentionally ignored by Git. Add them only in release
build jobs or local packaging workspaces.
