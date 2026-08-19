# TensuGo GitHub Pages

This directory contains the static product homepage for `tensugo.com`.

Project documentation has been moved to `project-docs/` so the Pages root stays focused on website files.

The English homepage lives at `index.html`; the Chinese homepage lives at `cn/index.html`, the Japanese homepage at `ja/index.html`, and the Korean homepage at `ko/index.html`.

Languages on the site:

- The four homepages are static pages in their own language, with a language switcher in the shared nav (`site-nav.js`). Choosing a language there persists the choice in `localStorage` (`tensugo.site.language`).
- The download pages (`download/**`) are dynamic: `site-i18n.js` renders all text from a four-language dictionary via `data-i18n` attributes (no hardcoded copy). The language defaults to the user's region/OS language (`navigator.languages`), then falls back to English; an explicit user choice persists and wins. Homepage download links carry `?lang=` so a localized homepage leads to a download page in the same language.

GitHub Pages setup:

1. Open the repository settings on GitHub.
2. Go to `Pages`.
3. Choose `GitHub Actions` as the source.
4. Push to `main`, or run the `Deploy Pages` workflow manually.
5. Set the custom domain to `tensugo.com`.

The page is intentionally static: `index.html`, `styles.css`, `CNAME`, and image assets. It does not affect the Tauri app build.
