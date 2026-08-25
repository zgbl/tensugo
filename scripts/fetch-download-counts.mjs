#!/usr/bin/env node
// 每天拉取 GitHub release 各安装包的官方真实下载数（download_count），
// 追加到 docs/download-counts.json 形成按天的时间序列。
// download_count 只在 CDN 真正下发文件时 +1，点链接不计，故代表「下载完成」。
//
// 用法:
//   node scripts/fetch-download-counts.mjs [--repo zgbl/tensugo] [--tag V0.7.55]
//                                         [--file docs/download-counts.json] [--version-prefix 0.7.55]
//                                         [--analytics-endpoint <url>]
// 认证: 可选，设置环境变量 GITHUB_TOKEN 可提高配额（公开仓库每天一次不需要）。
// 统计上报: 提供 --analytics-endpoint 或环境变量 ANALYTICS_ENDPOINT 时，会把当天
//           download_count 快照作为新事件 "download_completed"（source=github）
//           发到统计后台，便于与已有的 "download_clicked"（点击）并排对比。
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};

const REPO = opt("--repo", "zgbl/tensugo");
const TAG = opt("--tag", "V0.7.55");
const FILE = resolve(opt("--file", "docs/download-counts.json"));
const PREFIX = opt("--version-prefix", "0.7.55");
const ENDPOINT = opt("--analytics-endpoint", process.env.ANALYTICS_ENDPOINT || "");
// --compat: 后台还没给 download_completed 加白名单时，用已接受的 download_clicked +
//           placement=github_daily_snapshot 上报，方便先筛出来对比（记得过滤，避免混入真实点击）。
const COMPAT = args.includes("--compat");
const TOKEN = process.env.GITHUB_TOKEN || "";

const headers = { Accept: "application/vnd.github+json", "User-Agent": "tensugo-dl-counter" };
if (TOKEN) headers.Authorization = "Bearer " + TOKEN;

const url = "https://api.github.com/repos/" + REPO + "/releases/tags/" + encodeURIComponent(TAG);
const res = await fetch(url, { headers });
if (!res.ok) {
  console.error("GitHub API error " + res.status + ": " + res.statusText);
  process.exit(1);
}
const release = await res.json();

// 只记录本版本对应的安装包，过滤掉旧版本残留的资产
const counts = {};
for (const a of release.assets || []) {
  if (a.name.includes(PREFIX)) counts[a.name] = a.download_count;
}

const today = new Date().toISOString().slice(0, 10);

let data = null;
if (existsSync(FILE)) {
  try { data = JSON.parse(readFileSync(FILE, "utf8")); } catch (_) { data = null; }
}
if (!data || !Array.isArray(data.days)) {
  data = { repo: REPO, tag: TAG, days: [] };
}
data.repo = REPO;
data.tag = TAG;
data.updatedAt = new Date().toISOString();

const row = { date: today, counts };
const idx = data.days.findIndex((d) => d.date === today);
if (idx >= 0) data.days[idx] = row;
else data.days.push(row);

writeFileSync(FILE, JSON.stringify(data, null, 2) + "\n");

// ---- 人类可读摘要 ----
console.log("# " + TAG + " · " + today);
let total = 0;
for (const [name, c] of Object.entries(counts)) {
  console.log("  " + name + ": " + c);
  total += c;
}
console.log("total: " + total);

if (data.days.length > 1) {
  const prev = data.days[data.days.length - 2].counts;
  const inc = {};
  for (const k of Object.keys(counts)) inc[k] = counts[k] - (prev[k] || 0);
  console.log("vs previous day:");
  for (const [k, v] of Object.entries(inc)) console.log("  " + k + ": +" + v);
}

// ---- 作为新统计点上报：download_completed（source=github）----
// 与 analytics.js 里的 "download_clicked"（浏览器点击）分开，便于并排对比。
if (ENDPOINT) {
  const { randomUUID } = await import("node:crypto");
  const id = randomUUID();
  const occurredAt = new Date().toISOString();
  let payload;
  if (COMPAT) {
    // 后台白名单尚未加 download_completed 时的兼容模式：
    // 用已接受的 download_clicked/homepage，靠 placement=github_daily_snapshot 区分，便于筛选。
    payload = JSON.stringify({
      id, occurredAt, source: "homepage", eventName: "download_clicked",
      anonymousId: "server-daily", sessionId: "github-snapshot", platform: "web", locale: "en",
      referrerHost: null, utmSource: null, utmMedium: null, utmCampaign: null,
      properties: {
        placement: "github_daily_snapshot", stage: "snapshot", intent: "server_snapshot",
        deviceType: "server", os: "server", touch: false, installCapable: false,
        viewportWidth: null, screenWidth: null,
        firstTouchUtmSource: null, firstTouchUtmMedium: null, firstTouchUtmCampaign: null,
        firstTouchUtmContent: null, firstTouchUtmTerm: null,
        firstTouchReferrerHost: null, firstTouchLandingPath: null, referrerHost: null, pageLanguage: null,
        snapshot: true, tag: TAG, total: total, counts: counts
      }
    });
  } else {
    payload = JSON.stringify({
      id, occurredAt,
      source: "github",
      eventName: "download_completed",
      anonymousId: "server-daily",
      sessionId: "github-snapshot",
      platform: "server",
      locale: "en",
      properties: { tag: TAG, total: total, counts: counts }
    });
  }
  const resp = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "text/plain;charset=UTF-8" },
    body: payload
  });
  if (resp.ok) {
    console.log("analytics: download_completed posted -> " + resp.status);
  } else {
    const body = (await resp.text()).slice(0, 200);
    console.error("analytics: POST failed -> " + resp.status + " " + resp.statusText);
    if (body) console.error("analytics: backend says: " + body);
    if (resp.status === 400 && body.includes("Unknown analytics source or event")) {
      console.error("hint: the analytics backend whitelists source/event pairs. To record this");
      console.error("      as a first-class event, whitelist { source: 'github', event: 'download_completed' }");
      console.error("      on the forum backend, or use --compat to post under download_clicked (filterable).");
    }
    process.exitCode = 1;
  }
} else {
  console.log("analytics: no --analytics-endpoint, skipping upload");
}
