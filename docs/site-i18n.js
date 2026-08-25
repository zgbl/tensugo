/* TensuGo site i18n
 *
 * Shared language engine for the tensugo.com static site, mirroring the
 * desktop app's i18n approach (src/i18n.ts): every visible string lives in
 * a dictionary, the language defaults to the user's region/OS language and
 * the user's explicit choice is persisted.
 *
 * Resolution order on dynamic pages:
 *   1. persisted choice (localStorage tensugo.site.language)
 *   2. ?lang= URL parameter (carried forward by homepage download links)
 *   3. browser / OS language (navigator.languages)
 *   4. default: en
 *
 * Dynamic pages opt in with <html lang="en" data-tensugo-i18n> and mark
 * their text nodes with data-i18n / data-i18n-html / data-i18n-attr.
 * Static pages (home, docs) do not opt in: their content is already
 * translated per page, so the engine only persists switcher choices and
 * enriches download links with the page's own language.
 */
(function () {
  "use strict";

  var LANG_KEY = "tensugo.site.language";
  var SUPPORTED = ["en", "zh", "ja", "ko"];
  var DEFAULT = "en";

  var dicts = {
    en: {
      dlKicker: "Latest Download",
      winPageTitle: "Download the latest TensuGo for Windows x64",
      winMetaDesc: "Download the latest TensuGo for Windows x64. Choose the installer with or without the bundled KataGo engine.",
      winTitle: "Download the latest TensuGo for Windows x64",
      winRelease: "Current release: <strong>V0.7.55</strong> · Updated 2026-08-24",
      winChoose: "Choose the installer with or without the bundled KataGo engine.",
      winEngineNote: "The MSI with Engine bundles the KataGo OpenCL engine, so analysis works right after installation.",
      winBtnWith: "Download Windows MSI with Engine (350 MB)",
      winBtnWithout: "Download Windows MSI without Engine (5.4 MB)",
      macPageTitle: "Download the latest TensuGo for macOS Apple Silicon",
      macMetaDesc: "Download the latest TensuGo for macOS Apple Silicon (M-series).",
      macTitle: "Download the latest TensuGo for macOS Apple Silicon",
      macRelease: "Current release: <strong>V0.7.55</strong> · Updated 2026-08-24",
      macInstall: "Apple Silicon (M-series) build. KataGo is installed separately via Homebrew.",
      macFallback: "If the download does not start, use the button below.",
      macBtn: "Download macOS DMG",
      redirWinPageTitle: "Redirecting to the latest TensuGo for Windows x64",
      redirWinMetaDesc: "This stable link points to the latest TensuGo Windows x64 download.",
      redirWinTitle: "Redirecting to the latest TensuGo for Windows x64",
      redirWinNote: "This stable link now points to the latest Windows x64 download.",
      redirWinBtn: "Continue to latest Windows MSI",
      redirMacPageTitle: "Redirecting to the latest TensuGo for macOS Apple Silicon",
      redirMacMetaDesc: "This stable link points to the latest TensuGo macOS Apple Silicon download.",
      redirMacTitle: "Redirecting to the latest TensuGo for macOS Apple Silicon",
      redirMacNote: "This stable link now points to the latest macOS Apple Silicon download.",
      redirMacBtn: "Continue to latest macOS DMG"
    },
    zh: {
      dlKicker: "最新下载",
      winPageTitle: "下载最新版 TensuGo（Windows x64）",
      winMetaDesc: "下载最新版 TensuGo（Windows x64），可选择带内置 KataGo 引擎或不带引擎的安装包。",
      winTitle: "下载最新版 TensuGo（Windows x64）",
      winRelease: "4",
      winChoose: "选择带内置 KataGo 引擎或不带引擎的安装包。",
      winEngineNote: "含引擎版安装包自带 KataGo OpenCL 引擎，安装完成后即可开始分析。",
      winBtnWith: "下载 Windows MSI（含引擎）（350 MB）",
      winBtnWithout: "下载 Windows MSI（不含引擎）（5.4 MB）",
      macPageTitle: "下载最新版 TensuGo（macOS Apple Silicon）",
      macMetaDesc: "下载最新版 TensuGo（macOS Apple Silicon，M 系列芯片）。",
      macTitle: "下载最新版 TensuGo（macOS Apple Silicon）",
      macRelease: "当前版本：<strong>V0.7.55</strong> · 更新于 2026-08-24",
      macInstall: "Apple Silicon（M 系列）版本。KataGo 需通过 Homebrew 单独安装。",
      macFallback: "如果下载没有自动开始，请使用下面的按钮。",
      macBtn: "下载 macOS DMG",
      redirWinPageTitle: "正在跳转到最新版 TensuGo（Windows x64）",
      redirWinMetaDesc: "此稳定链接指向最新版 TensuGo Windows x64 的下载。",
      redirWinTitle: "正在跳转到最新版 TensuGo（Windows x64）",
      redirWinNote: "此稳定链接现在指向最新的 Windows x64 下载页面。",
      redirWinBtn: "前往下载最新 Windows MSI",
      redirMacPageTitle: "正在跳转到最新版 TensuGo（macOS Apple Silicon）",
      redirMacMetaDesc: "此稳定链接指向最新版 TensuGo macOS Apple Silicon 的下载。",
      redirMacTitle: "正在跳转到最新版 TensuGo（macOS Apple Silicon）",
      redirMacNote: "此稳定链接现在指向最新的 macOS Apple Silicon 下载页面。",
      redirMacBtn: "前往下载最新 macOS DMG"
    },
    ja: {
      dlKicker: "最新ダウンロード",
      winPageTitle: "最新の TensuGo（Windows x64）をダウンロード",
      winMetaDesc: "最新の TensuGo（Windows x64）をダウンロード。KataGo エンジン同梱版・非同梱版のどちらかを選べます。",
      winTitle: "最新の TensuGo（Windows x64）をダウンロード",
      winRelease: "現在のリリース：<strong>V0.7.55</strong> · 更新日 2026-08-24",
      winChoose: "KataGo エンジン同梱版・非同梱版のどちらかを選べます。",
      winEngineNote: "エンジン同梱版には KataGo OpenCL エンジンが含まれており、インストール後すぐに分析できます。",
      winBtnWith: "Windows MSI（エンジン同梱）をダウンロード（350 MB）",
      winBtnWithout: "Windows MSI（エンジンなし）をダウンロード（5.4 MB）",
      macPageTitle: "最新の TensuGo（macOS Apple Silicon）をダウンロード",
      macMetaDesc: "最新の TensuGo（macOS Apple Silicon、M シリーズ）をダウンロード。",
      macTitle: "最新の TensuGo（macOS Apple Silicon）をダウンロード",
      macRelease: "現在のリリース：<strong>V0.7.55</strong> · 更新日 2026-08-24",
      macInstall: "Apple Silicon（M シリーズ）版。KataGo は Homebrew で別途インストールしてください。",
      macFallback: "ダウンロードが始まらない場合は、下のボタンを使ってください。",
      macBtn: "macOS DMG をダウンロード",
      redirWinPageTitle: "最新の TensuGo（Windows x64）へリダイレクト中",
      redirWinMetaDesc: "この安定リンクは最新の TensuGo Windows x64 のダウンロードへ移動します。",
      redirWinTitle: "最新の TensuGo（Windows x64）へリダイレクト中",
      redirWinNote: "この安定リンクは最新の Windows x64 のダウンロードページへ移動しました。",
      redirWinBtn: "最新の Windows MSI へ",
      redirMacPageTitle: "最新の TensuGo（macOS Apple Silicon）へリダイレクト中",
      redirMacMetaDesc: "この安定リンクは最新の TensuGo macOS Apple Silicon のダウンロードへ移動します。",
      redirMacTitle: "最新の TensuGo（macOS Apple Silicon）へリダイレクト中",
      redirMacNote: "この安定リンクは最新の macOS Apple Silicon のダウンロードページへ移動しました。",
      redirMacBtn: "最新の macOS DMG へ"
    },
    ko: {
      dlKicker: "최신 다운로드",
      winPageTitle: "최신 TensuGo (Windows x64) 다운로드",
      winMetaDesc: "최신 TensuGo (Windows x64)를 다운로드하세요. KataGo 엔진 포함/미포함 설치 프로그램을 선택할 수 있습니다.",
      winTitle: "최신 TensuGo (Windows x64) 다운로드",
      winRelease: "현재 릴리스: <strong>V0.7.55</strong> · 업데이트 2026-08-24",
      winChoose: "KataGo 엔진 포함 또는 미포함 설치 프로그램을 선택하세요.",
      winEngineNote: "엔진 포함 버전에는 KataGo OpenCL 엔진이 들어 있어 설치 후 바로 분석할 수 있습니다.",
      winBtnWith: "Windows MSI (엔진 포함) 다운로드 (350 MB)",
      winBtnWithout: "Windows MSI (엔진 미포함) 다운로드 (5.4 MB)",
      macPageTitle: "최신 TensuGo (macOS Apple Silicon) 다운로드",
      macMetaDesc: "최신 TensuGo (macOS Apple Silicon, M 시리즈)를 다운로드하세요.",
      macTitle: "최신 TensuGo (macOS Apple Silicon) 다운로드",
      macRelease: "현재 릴리스: <strong>V0.7.55</strong> · 업데이트 2026-08-24",
      macInstall: "Apple Silicon(M 시리즈) 버전. KataGo는 Homebrew로 별도 설치하세요.",
      macFallback: "다운로드가 시작되지 않으면 아래 버튼을 사용하세요.",
      macBtn: "macOS DMG 다운로드",
      redirWinPageTitle: "최신 TensuGo (Windows x64)로 이동 중",
      redirWinMetaDesc: "이 안정 링크는 최신 TensuGo Windows x64 다운로드로 연결됩니다.",
      redirWinTitle: "최신 TensuGo (Windows x64)로 이동 중",
      redirWinNote: "이 안정 링크는 이제 최신 Windows x64 다운로드 페이지로 연결됩니다.",
      redirWinBtn: "최신 Windows MSI로 이동",
      redirMacPageTitle: "최신 TensuGo (macOS Apple Silicon)로 이동 중",
      redirMacMetaDesc: "이 안정 링크는 최신 TensuGo macOS Apple Silicon 다운로드로 연결됩니다.",
      redirMacTitle: "최신 TensuGo (macOS Apple Silicon)로 이동 중",
      redirMacNote: "이 안정 링크는 이제 최신 macOS Apple Silicon 다운로드 페이지로 연결됩니다.",
      redirMacBtn: "최신 macOS DMG로 이동"
    }
  };

  function normalize(lang) {
    var base = String(lang || "").toLowerCase().slice(0, 2);
    return SUPPORTED.indexOf(base) >= 0 ? base : null;
  }

  function storedLanguage() {
    try {
      return normalize(localStorage.getItem(LANG_KEY));
    } catch (e) {
      return null;
    }
  }

  function urlLanguage() {
    try {
      var match = location.search.match(/[?&]lang=([a-zA-Z-]+)/);
      return match ? normalize(match[1]) : null;
    } catch (e) {
      return null;
    }
  }

  function browserLanguage() {
    var langs = [];
    try {
      langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
    } catch (e) {
      langs = [navigator.language];
    }
    for (var i = 0; i < langs.length; i += 1) {
      var normalized = normalize(langs[i]);
      if (normalized) return normalized;
    }
    return null;
  }

  function resolveLanguage() {
    // The URL parameter carries the language of the page the user came from
    // (homepage download links append ?lang=), so it must win over any
    // previously persisted choice: clicking "Download" on the Chinese
    // homepage must always open the Chinese download page.
    return urlLanguage() || storedLanguage() || browserLanguage() || DEFAULT;
  }

  function dictionary(lang) {
    return dicts[lang] || dicts[DEFAULT];
  }

  function translate(lang, key) {
    var dict = dictionary(lang);
    return key in dict ? dict[key] : key;
  }

  function applyLanguage(lang) {
    current = lang;
    var dict = dictionary(lang);
    document.documentElement.lang = lang;

    var htmlNodes = document.querySelectorAll("[data-i18n-html]");
    for (var i = 0; i < htmlNodes.length; i += 1) {
      var key = htmlNodes[i].getAttribute("data-i18n-html");
      htmlNodes[i].innerHTML = key in dict ? dict[key] : "";
    }

    var textNodes = document.querySelectorAll("[data-i18n]");
    for (var j = 0; j < textNodes.length; j += 1) {
      var textKey = textNodes[j].getAttribute("data-i18n");
      textNodes[j].textContent = textKey in dict ? dict[textKey] : "";
    }

    var attrNodes = document.querySelectorAll("[data-i18n-attr]");
    for (var k = 0; k < attrNodes.length; k += 1) {
      var pairs = attrNodes[k].getAttribute("data-i18n-attr").split(";");
      for (var p = 0; p < pairs.length; p += 1) {
        var sep = pairs[p].indexOf(":");
        if (sep < 0) continue;
        var attrName = pairs[p].slice(0, sep).trim();
        var attrKey = pairs[p].slice(sep + 1).trim();
        attrNodes[k].setAttribute(attrName, attrKey in dict ? dict[attrKey] : "");
      }
    }

    document.dispatchEvent(new CustomEvent("tensugo:languagechange", { bubbles: true, detail: { language: lang } }));
  }

  function persist(lang) {
    var normalized = normalize(lang) || DEFAULT;
    try {
      localStorage.setItem(LANG_KEY, normalized);
    } catch (e) { /* storage unavailable; the choice just won't persist */ }
    return normalized;
  }

  // Keep the URL in sync with the chosen language so a refresh or a shared
  // link stays in the same language as the page.
  function syncUrlLanguage(lang) {
    try {
      var url = new URL(location.href);
      if (lang === DEFAULT) url.searchParams.delete("lang");
      else url.searchParams.set("lang", lang);
      history.replaceState(null, "", url.toString());
    } catch (e) { /* ignore */ }
  }

  function setLanguage(lang) {
    var normalized = persist(lang);
    syncUrlLanguage(normalized);
    if (dynamic) applyLanguage(normalized);
    return normalized;
  }

  // Static pages carry their own language in <html lang>. Pass it along to
  // the dynamic download pages so "Download" from a localized homepage lands
  // on a download page in the same language.
  function enrichDownloadLinks() {
    if (/\/download\//.test(location.pathname)) return;
    var pageLanguage = normalize(document.documentElement.lang) || DEFAULT;
    var links = document.querySelectorAll('a[href*="/download/latest/"]');
    for (var i = 0; i < links.length; i += 1) {
      try {
        var url = new URL(links[i].href);
        if (!url.searchParams.has("lang")) url.searchParams.set("lang", pageLanguage);
        links[i].href = url.toString();
      } catch (e) { /* ignore malformed links */ }
    }
  }

  // This script is loaded in <head> without defer so the resolved language is
  // available synchronously to site-nav.js. The DOM, however, does not exist
  // yet at that point, so anything that touches elements must wait for
  // DOMContentLoaded - otherwise applyLanguage() and enrichDownloadLinks()
  // silently match zero nodes.
  function whenReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  var dynamic = document.documentElement.hasAttribute("data-tensugo-i18n");
  var current = dynamic ? resolveLanguage() : (normalize(document.documentElement.lang) || DEFAULT);

  // <title> and <html lang> can be set immediately; the rest waits for the DOM.
  document.documentElement.lang = current;
  if (dynamic) whenReady(function () { applyLanguage(current); });

  window.TensugoI18n = {
    LANG_KEY: LANG_KEY,
    SUPPORTED: SUPPORTED,
    DEFAULT: DEFAULT,
    normalize: normalize,
    resolveLanguage: resolveLanguage,
    getLanguage: function () { return current; },
    setLanguage: setLanguage,
    persist: persist,
    applyLanguage: applyLanguage,
    translate: translate,
    isDynamicPage: function () { return dynamic; }
  };

  whenReady(enrichDownloadLinks);
})();
