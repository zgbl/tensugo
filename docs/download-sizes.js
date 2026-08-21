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
    "TensuGo_0.7.50_x64_en-US.msi": 350 * 1024 * 1024,
    "TensuGo_0.7.50_x64-ui-only_en-US.msi": 5.4 * 1024 * 1024
  };

  function human(bytes) {
    if (!bytes || bytes <= 0) return "";
    var mb = bytes / (1024 * 1024);
    return (mb >= 100 ? Math.round(mb) : Math.round(mb * 10) / 10) + " MB";
  }

  function annotate(map) {
    links.forEach(function (a) {
      var name = (a.getAttribute("href") || "").split("/").pop();
      var size = map && map[name];
      if (!size) return;
      if (typeof size === "number") size = human(size);
      var span = a.querySelector(".file-size");
      if (!span) {
        span = document.createElement("span");
        span.className = "file-size";
        a.appendChild(span);
      }
      span.textContent = " (" + size + ")";
    });
  }

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
