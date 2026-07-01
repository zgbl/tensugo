# Windows KataGo Engine Setup

TensuGo keeps the known Lizzie KataGo package as the default Windows engine. New engines are added by the user from Settings -> Engine.

## Recommended Flow

1. Download and unzip a KataGo Windows package.
2. Download a model file, for example `kata1-*.bin.gz`.
3. Open TensuGo Settings -> Engine.
4. Use Engine Path to browse to `katago.exe`.
5. TensuGo will try to find:
   - `default_gtp.cfg` near the engine
   - model files in nearby `models`, `weights`, or `Weights` folders
6. If the model was not found, use Model Path to browse to the `.bin.gz` file.
7. Click Test Engine.

## GTX 1080 Notes

For GTX 1080, do not use TensorRT as the first choice. Use CUDA or OpenCL.

OpenCL is usually the easiest setup because it depends mostly on the NVIDIA display driver.

CUDA builds can be faster, but they need matching CUDA/cuDNN runtime DLLs. A package named like `cuda12.5-cudnn8.9.7` expects CUDA 12.x and cuDNN 8 runtime DLLs to be available.

## Common Failure: 0xc0000135

If Test Engine shows:

```text
version exit status: exit code: 0xc0000135
```

Windows could not load a required DLL before KataGo could print any log.

For CUDA 12.x builds, common missing DLLs are:

- `cudart64_12.dll`
- `cublas64_12.dll`
- `cudnn64_8.dll`

This means the engine path, model path, and config path can all be correct, while startup still fails because Windows could not load one or more required runtime DLLs.

Possible missing runtime libraries include:

- `vcruntime140.dll`
- `msvcp140.dll`
- `cudart64_12.dll`
- `cublas64_12.dll`
- `cublasLt64_12.dll`
- `cudnn64_8.dll`

These are possible missing libraries, not a confirmed list.

Fix options:

- Verify the Microsoft Visual C++ Runtime.
- If using a CUDA build, verify the CUDA runtime.
- If using a CUDA build, verify the cuDNN libraries.
- To identify the exact missing DLL, open `katago.exe` using Dependencies.exe, the modern Dependency Walker.

## Command Line Check

Run this from the folder containing `katago.exe`:

```powershell
.\katago.exe version
```

Then test GTP:

```powershell
.\katago.exe gtp -model "E:\Codes\TensuGo\Weights\kata1-b28c512nbt-s13255194368-d5935380940.bin.gz" -config ".\default_gtp.cfg"
```

If `version` fails, TensuGo cannot start that engine either. Fix the runtime first, then return to TensuGo and click Test Engine again.
