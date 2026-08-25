/* TensuGo download pages: fetch real artifact sizes from the GitHub release
 * API and show them next to each download button ("With Engine / Without
 * Engine"). If the API is unreachable it falls back to known sizes so the
 * buttons are never empty.
 */
(function () {
  "use strict";

  var links = Array.prototype.slice.call(document.querySelectorAll('a[href*="releases/download/"]'));
  if (!links.length) return;

  // Known sizes as a fallback (bytes) when the GitHub API is unavailable.
  var fallbackBytes = {
    "TensuGo_0.7.55_x64_en-US.msi": 350 * 1024 * 1024,
    "TensuGo_0.7.55_x64-ui-only_en-US.msi": 5.4 * 1024 * 1024
  };

  function human(bytes) {
    if (!bytes || bytes <= 0) return "";
    var mb = bytes / (1024 * 1024);
    return (mb >= 100 ? Math.round(mb) : Math.round(mb * 10) / 10) + " MB";
  }

  // Remember what we last rendered: the i18n engine rewrites the buttons'
  // textContent when it applies a language (on load and on every language
  // switch), which removes the size span. We re-attach it afterwards.
  var lastMap = null;

  // The i18n dictionary already includes a static "(… MB)" marker on the
  // Windows buttons so a size is always visible immediately. This function
  // only replaces that marker with the real value from the GitHub API (or the
  // fallback) and appends a marker for buttons that have none (e.g. macOS).
  function annotate(map) {
    if (map) lastMap = map;
    map = lastMap;
    if (!map) return;
    links.forEach(function (a) {
      var name = (a.getAttribute("href") || "").split("/").pop();
      var size = map && map[name];
      if (typeof size === "number") size = human(size);
      var textNode = null;
      for (var i = 0; i < a.childNodes.length; i += 1) {
        if (a.childNodes[i].nodeType === 3) { textNode = a.childNodes[i]; break; }
      }
      if (!textNode) return;
      var text = textNode.textContent.replace(/\s*\(\s*[\d.]+\s*MB\s*\)\s*$/, "");
      textNode.textContent = text + (size ? " (" + size + ")" : "");
    });
  }

  // Re-apply the sizes after any language change wipes the button text.
  document.addEventListener("tensugo:languagechange", function () {
    // Run after the i18n engine has finished rewriting the nodes.
    setTimeout(function () { annotate(null); }, 0);
  });

  // Show the fallback right away so the size is never missing while the
  // GitHub API request is in flight; real values overwrite it when they land.
  annotate(fallbackBytes);

  var first = links[0].getAttribute("href") || "";
  var tagMatch = first.match(/releases\/download\/([^/]+)\//);
  var tag = tagMatch ? tagMatch[1] : null;
  if (!tag) { annotate(fallbackBytes); return; }

  var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  var timer = controller ? setTimeout(function () { controller.abort(); annotate(fallbackBytes); }, 8000) : null;

  fetch("https://api.github.com/repos/zgbl/tensugo/releases/tags/" + encodeURIComponent(tag), {
    headers: { Accept: "application/vnd.github+json" },
    signal: controller ? controller.signal : undefined
  })
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(function (data) {
      var map = {};
      (data.assets || []).forEach(function (asset) { map[asset.name] = human(asset.size); });
      annotate(map);
    })
    .catch(function () { annotate(fallbackBytes); })
    .finally(function () { if (timer) clearTimeout(timer); });
})();
