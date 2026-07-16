# Bundled KataGo Resources

This directory is reserved for future release bundles that include KataGo and a model.

Expected layout:

```text
katago/
  katago            # macOS/Linux executable, or katago.exe on Windows
  configs/
    default_gtp.cfg
    human/
      gtp_human*_search_example.cfg
  models/
    model.bin.gz
    human/
      b18c384nbt-humanv0.bin.gz
```

The Human SL model is copied into the local project resource tree for packaging and
development, but remains ignored by Git because it is large. Human configuration
templates are tracked and are resolved from the bundled resource directory at runtime.
