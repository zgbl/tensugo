# TensuGo GitHub Pages

This directory contains the static product homepage for `tensugo.com`.

Project documentation has been moved to `project-docs/` so the Pages root stays focused on website files.

The English homepage lives at `index.html`; the Chinese homepage lives at `cn/index.html`.

GitHub Pages setup:

1. Open the repository settings on GitHub.
2. Go to `Pages`.
3. Choose `GitHub Actions` as the source.
4. Push to `main`, or run the `Deploy Pages` workflow manually.
5. Set the custom domain to `tensugo.com`.

The page is intentionally static: `index.html`, `styles.css`, `CNAME`, and image assets. It does not affect the Tauri app build.
