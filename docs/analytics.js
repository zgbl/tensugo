(function () {
  "use strict";
  var endpoint = "https://forum.tensugo.com/api/analytics/events";
  var anonymousKey = "tensugo.analytics.anonymousId";
  var sessionKey = "tensugo.analytics.sessionId";
  var downloadVersions = {
    "windows-x64": "0.6.18",
    "macos-apple-silicon": "0.5.87"
  };
  var anonymousId = localStorage.getItem(anonymousKey) || crypto.randomUUID();
  var sessionId = sessionStorage.getItem(sessionKey) || crypto.randomUUID();
  localStorage.setItem(anonymousKey, anonymousId);
  sessionStorage.setItem(sessionKey, sessionId);

  function safeReferrerHost() {
    try { return document.referrer ? new URL(document.referrer).hostname : null; } catch (_) { return null; }
  }

  function track(eventName, properties, fields) {
    var query = new URLSearchParams(location.search);
    var payload = Object.assign({
      id: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
      source: "homepage",
      eventName: eventName,
      anonymousId: anonymousId,
      sessionId: sessionId,
      locale: document.documentElement.lang || navigator.language,
      referrerHost: safeReferrerHost(),
      utmSource: query.get("utm_source"),
      utmMedium: query.get("utm_medium"),
      utmCampaign: query.get("utm_campaign"),
      properties: properties || {}
    }, fields || {});
    payload = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      // text/plain is CORS-safelisted, so the cross-origin beacon is sent
      // immediately without an OPTIONS preflight that navigation can cancel.
      navigator.sendBeacon(endpoint, new Blob([payload], { type: "text/plain;charset=UTF-8" }));
    } else {
      fetch(endpoint, { method: "POST", headers: { "content-type": "text/plain;charset=UTF-8" }, body: payload, keepalive: true }).catch(function () {});
    }
  }

  var downloadMatch = location.pathname.match(/\/download\/latest\/(windows-x64|macos-apple-silicon)\/?$/);
  track("page_view", { page: downloadMatch ? "download_redirect" : location.pathname.indexOf("/cn/") >= 0 ? "home_cn" : "home" });
  if (downloadMatch) {
    track("download_clicked", {
      placement: "download_redirect",
      stage: "redirect"
    }, {
      appVersion: downloadVersions[downloadMatch[1]],
      platform: downloadMatch[1]
    });
  }

  document.addEventListener("click", function (event) {
    var anchor = event.target.closest("a");
    if (!anchor) return;
    var href = anchor.href || "";
    if (href.indexOf("/download/") >= 0) {
      var platform = href.indexOf("windows") >= 0 ? "windows-x64" : "macos-apple-silicon";
      track("download_clicked", {
        placement: anchor.closest(".hero-actions") ? "hero" : "download_section",
        stage: "intent"
      }, {
        appVersion: downloadVersions[platform],
        platform: platform
      });
    } else if (href.indexOf("forum.tensugo.com") >= 0) track("forum_clicked");
    else if (href.indexOf("github.com") >= 0) track("github_clicked");
    else if (href.indexOf("User-Guide") >= 0) track("docs_clicked");
  }, { capture: true });
})();
