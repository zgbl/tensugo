(function () {
  "use strict";
  var endpoint = "https://forum.tensugo.com/api/analytics/events";
  var anonymousKey = "tensugo.analytics.anonymousId";
  var sessionKey = "tensugo.analytics.sessionId";
  var anonymousId = localStorage.getItem(anonymousKey) || crypto.randomUUID();
  var sessionId = sessionStorage.getItem(sessionKey) || crypto.randomUUID();
  localStorage.setItem(anonymousKey, anonymousId);
  sessionStorage.setItem(sessionKey, sessionId);

  function safeReferrerHost() {
    try { return document.referrer ? new URL(document.referrer).hostname : null; } catch (_) { return null; }
  }

  /* ---------------------------------------------------------------------
   * Device / OS classification.
   * The download UX is intentionally unchanged: phones and tablets still see
   * and can click the Windows / macOS buttons. We only *label* the click so
   * "mobile download curiosity" is not mistaken for a failed desktop
   * activation (a phone visitor can never produce a desktop first_open).
   * ------------------------------------------------------------------- */
  function deviceInfo() {
    var ua = navigator.userAgent || "";
    var uaData = navigator.userAgentData || null;
    var maxTouch = navigator.maxTouchPoints || 0;
    var touch = maxTouch > 0 || "ontouchstart" in window;

    var os = "unknown";
    if (/Android/i.test(ua)) os = "android";
    else if (/iPhone|iPod/i.test(ua)) os = "ios";
    else if (/iPad/i.test(ua)) os = "ipados";
    // iPadOS 13+ reports itself as "Macintosh"; touch points give it away.
    else if (/Macintosh/i.test(ua) && maxTouch > 1) os = "ipados";
    else if (/Mac OS X|Macintosh/i.test(ua)) os = "macos";
    else if (/Windows/i.test(ua)) os = "windows";
    else if (/CrOS/i.test(ua)) os = "chromeos";
    else if (/Linux/i.test(ua)) os = "linux";

    var type;
    if (uaData && typeof uaData.mobile === "boolean" && !/iPad/i.test(ua) && os !== "ipados") {
      type = uaData.mobile ? "mobile" : "desktop";
    } else if (os === "ipados") {
      type = "tablet";
    } else if (os === "android") {
      type = /Mobile/i.test(ua) ? "mobile" : "tablet";
    } else if (os === "ios") {
      type = "mobile";
    } else if (touch && Math.min(screen.width, screen.height) < 820 && (os === "unknown" || os === "linux")) {
      type = "tablet";
    } else {
      type = "desktop";
    }

    // A desktop OS is a necessary condition for a later desktop first_open.
    var installable = (type === "desktop") && (os === "windows" || os === "macos" || os === "linux");

    return {
      deviceType: type,
      os: os,
      touch: touch,
      installCapable: installable,
      viewportWidth: window.innerWidth || null,
      screenWidth: screen.width || null
    };
  }

  var device = deviceInfo();

  /* First-touch attribution: the download pages carry no utm_* parameters,
   * so remember the first campaign/referrer we saw for this browser and
   * replay it on every later event. */
  var attributionKey = "tensugo.analytics.firstTouch";

  function firstTouch() {
    var query = new URLSearchParams(location.search);
    var stored = null;
    try { stored = JSON.parse(localStorage.getItem(attributionKey) || "null"); } catch (_) { stored = null; }
    var current = {
      utmSource: query.get("utm_source"),
      utmMedium: query.get("utm_medium"),
      utmCampaign: query.get("utm_campaign"),
      utmContent: query.get("utm_content"),
      utmTerm: query.get("utm_term"),
      referrerHost: safeReferrerHost(),
      landingPath: location.pathname,
      at: new Date().toISOString()
    };
    var hasSignal = current.utmSource || current.utmMedium || current.utmCampaign || current.referrerHost;
    if (!stored && hasSignal) {
      try { localStorage.setItem(attributionKey, JSON.stringify(current)); } catch (_) {}
      return current;
    }
    return stored || current;
  }

  var attribution = firstTouch();

  function track(eventName, properties, fields) {
    var query = new URLSearchParams(location.search);
    var payload = Object.assign({
      id: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
      source: "homepage",
      eventName: eventName,
      anonymousId: anonymousId,
      sessionId: sessionId,
      platform: "web",
      locale: document.documentElement.lang || navigator.language,
      referrerHost: safeReferrerHost(),
      utmSource: query.get("utm_source") || attribution.utmSource || null,
      utmMedium: query.get("utm_medium") || attribution.utmMedium || null,
      utmCampaign: query.get("utm_campaign") || attribution.utmCampaign || null,
      properties: Object.assign({
        deviceType: device.deviceType,
        os: device.os,
        touch: device.touch,
        installCapable: device.installCapable,
        viewportWidth: device.viewportWidth,
        screenWidth: device.screenWidth,
        firstTouchUtmSource: attribution.utmSource || null,
        firstTouchUtmMedium: attribution.utmMedium || null,
        firstTouchUtmCampaign: attribution.utmCampaign || null,
        firstTouchUtmContent: attribution.utmContent || null,
        firstTouchUtmTerm: attribution.utmTerm || null,
        firstTouchReferrerHost: attribution.referrerHost || null,
        firstTouchLandingPath: attribution.landingPath || null,
        referrerHost: safeReferrerHost(),
        pageLanguage: document.documentElement.lang || null
      }, properties || {})
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

  function versionFromReleaseUrl(url) {
    var match = String(url || "").match(/\/releases\/download\/V?([^/]+)\//i);
    return match ? match[1] : null;
  }

  function downloadVersion(platform, anchor) {
    var directVersion = versionFromReleaseUrl(anchor && anchor.href);
    if (directVersion) return directVersion;
    var links = document.querySelectorAll("a[href]");
    for (var i = 0; i < links.length; i += 1) {
      var href = links[i].href || "";
      if (href.indexOf(platform) >= 0) {
        var version = versionFromReleaseUrl(href);
        if (version) return version;
      }
    }
    return null;
  }

  var downloadMatch = location.pathname.match(/\/download\/latest\/(windows-x64|macos-apple-silicon)\/?$/);
  track("page_view", { page: downloadMatch ? "download_redirect" : location.pathname.indexOf("/cn/") >= 0 ? "home_cn" : "home" });
  if (downloadMatch) {
    var redirectPlatform = downloadMatch[1];
    track("download_clicked", {
      placement: "download_redirect",
      stage: "redirect",
      intent: device.installCapable ? "desktop_download_intent" : "mobile_download_curiosity"
    }, {
      appVersion: downloadVersion(redirectPlatform),
      platform: redirectPlatform
    });
  }

  document.addEventListener("click", function (event) {
    var anchor = event.target.closest("a");
    if (!anchor) return;
    var href = anchor.href || "";
    if (href.indexOf("/download/") >= 0) {
      // The final GitHub release links (.msi / .dmg) also contain "/download/"
      // but no platform slug, so classify by file extension first.
      var isAsset = /releases\/download\//.test(href);
      var platform = /windows|\.msi(\?|$)/i.test(href) ? "windows-x64" : "macos-apple-silicon";
      track("download_clicked", {
        placement: isAsset
          ? "download_page_asset"
          : anchor.closest(".hero-actions") ? "hero" : "download_section",
        stage: isAsset ? "asset" : "intent",
        intent: device.installCapable ? "desktop_download_intent" : "mobile_download_curiosity",
        assetName: isAsset ? href.split("/").pop() : null
      }, {
        appVersion: downloadVersion(platform, anchor),
        platform: platform
      });
    } else if (href.indexOf("forum.tensugo.com") >= 0) track("forum_clicked");
    else if (href.indexOf("github.com") >= 0) track("github_clicked");
    else if (href.indexOf("User-Guide") >= 0) track("docs_clicked");
  }, { capture: true });
})();
