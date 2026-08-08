(() => {
  const header = document.querySelector("[data-tensugo-nav]");
  if (!header) return;

  const language = (document.documentElement.lang || "en").slice(0, 2);
  const pagePath = window.location.pathname;
  const inNestedDirectory = /\/(cn|ja|ko|project-docs)\//.test(pagePath);
  const root = inNestedDirectory ? "../" : "./";
  const copy = {
    en: { home: "Home", docs: "Docs", download: "Download", forum: "Forum", language: "Language", aria: "Site navigation", homeAria: "TensuGo home", doc: "project-docs/Product-and-AI-Analysis-Guide.html" },
    zh: { home: "主页", docs: "文档", download: "下载", forum: "论坛", language: "语言", aria: "网站导航", homeAria: "天书阁首页", doc: "project-docs/Product-and-AI-Analysis-Guide-zh.html" },
    ja: { home: "ホーム", docs: "ガイド", download: "ダウンロード", forum: "フォーラム", language: "言語", aria: "サイトナビゲーション", homeAria: "TensuGo ホーム", doc: "project-docs/User-Guide-ja.html" },
    ko: { home: "홈", docs: "가이드", download: "다운로드", forum: "포럼", language: "언어", aria: "사이트 탐색", homeAria: "TensuGo 홈", doc: "project-docs/User-Guide-ko.html" }
  }[language] || null;
  const text = copy || { home: "Home", docs: "Docs", download: "Download", forum: "Forum", language: "Language", aria: "Site navigation", homeAria: "TensuGo home", doc: "project-docs/Product-and-AI-Analysis-Guide.html" };
  const languageHome = language === "en" ? root : `${root}${language}/`;

  header.setAttribute("aria-label", "TensuGo");
  header.innerHTML = `
    <a class="brand" href="${languageHome}" aria-label="${text.homeAria}">
      <img class="brand-logo" src="${root}assets/tensugo-logo.png" alt="TensuGo" />
    </a>
    <nav class="nav" aria-label="${text.aria}">
      <a href="${languageHome}">${text.home}</a>
      <a href="${languageHome}#download">${text.download}</a>
      <a href="${root}${text.doc}">${text.docs}</a>
      <a href="https://forum.tensugo.com/">${text.forum}</a>
      <details class="language-switcher">
        <summary>${text.language}</summary>
        <div class="language-options">
          <a href="${root}">English</a><a href="${root}cn/">中文</a><a href="${root}ja/">日本語</a><a href="${root}ko/">한국어</a>
        </div>
      </details>
    </nav>`;
})();
