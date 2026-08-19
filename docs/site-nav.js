(() => {
  const header = document.querySelector("[data-tensugo-nav]");
  if (!header) return;

  const i18n = window.TensugoI18n || null;
  const dynamic = !!i18n && i18n.isDynamicPage();

  // Relative depth from the Pages root, used for asset paths only.
  const pagePath = window.location.pathname;
  const depth = pagePath.split("/").filter(Boolean).length - (pagePath.endsWith("/") ? 0 : 1);
  const root = depth <= 0 ? "./" : Array(depth).fill("..").join("/") + "/";

  // Canonical site URLs. The site is served from www.tensugo.com (CNAME).
  // The internal language code for Chinese is "zh" (shared with the desktop
  // app), but the site's homepage for Chinese lives at /cn — never /zh.
  const SITE_ROOT = "https://www.tensugo.com";
  const pathFor = { en: "", zh: "cn", ja: "ja", ko: "ko" };

  function homepageUrl(language) {
    const segment = pathFor[language] || "";
    return segment ? `${SITE_ROOT}/${segment}` : `${SITE_ROOT}/`;
  }

  const copies = {
    en: { home: "Home", docs: "Docs", download: "Download", forum: "Forum", language: "Language", aria: "Site navigation", homeAria: "TensuGo home", doc: "project-docs/Product-and-AI-Analysis-Guide.html" },
    zh: { home: "主页", docs: "文档", download: "下载", forum: "论坛", language: "语言", aria: "网站导航", homeAria: "天书阁首页", doc: "project-docs/Product-and-AI-Analysis-Guide-zh.html" },
    ja: { home: "ホーム", docs: "ガイド", download: "ダウンロード", forum: "フォーラム", language: "言語", aria: "サイトナビゲーション", homeAria: "TensuGo ホーム", doc: "project-docs/User-Guide-ja.html" },
    ko: { home: "홈", docs: "가이드", download: "다운로드", forum: "포럼", language: "언어", aria: "사이트 탐색", homeAria: "TensuGo 홈", doc: "project-docs/User-Guide-ko.html" }
  };

  const options = [
    { code: "en", label: "English" },
    { code: "zh", label: "中文" },
    { code: "ja", label: "日本語" },
    { code: "ko", label: "한국어" }
  ];

  function currentLanguage() {
    return i18n ? i18n.getLanguage() : (document.documentElement.lang || "en").slice(0, 2);
  }

  function render() {
    const language = currentLanguage();
    const text = copies[language] || copies.en;
    const languageHome = homepageUrl(language);

    const languageOptions = options
      .map((option) => {
        const href = dynamic ? "#" : homepageUrl(option.code);
        const active = option.code === language ? ' class="active"' : "";
        return `<a href="${href}" data-tensugo-lang="${option.code}"${active}>${option.label}</a>`;
      })
      .join("");

    header.setAttribute("aria-label", "TensuGo");
    header.innerHTML = `
    <a class="brand" href="${languageHome}" aria-label="${text.homeAria}">
      <img class="brand-logo" src="${root}assets/tensugo-logo.png" alt="TensuGo" />
    </a>
    <nav class="nav" aria-label="${text.aria}">
      <a href="${languageHome}">${text.home}</a>
      <a href="${languageHome}#download">${text.download}</a>
      <a href="${SITE_ROOT}/${text.doc}">${text.docs}</a>
      <a href="https://forum.tensugo.com/">${text.forum}</a>
      <details class="language-switcher">
        <summary>${text.language}</summary>
        <div class="language-options">${languageOptions}</div>
      </details>
    </nav>`;
  }

  // One delegated listener survives the header being re-rendered on language change.
  header.addEventListener("click", (event) => {
    const target = event.target.closest("[data-tensugo-lang]");
    if (!target || !i18n) return;
    const code = target.getAttribute("data-tensugo-lang");
    if (dynamic) {
      event.preventDefault();
      i18n.setLanguage(code);
    } else {
      // Remember the choice before navigating to the language homepage so
      // the download pages can inherit it.
      i18n.persist(code);
    }
  });

  if (dynamic && i18n) {
    window.addEventListener("tensugo:languagechange", render);
  }

  render();
})();
