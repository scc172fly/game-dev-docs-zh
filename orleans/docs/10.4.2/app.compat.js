"use strict";
(() => {
  var _a;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = (value) => String(value != null ? value : "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const nf = new Intl.NumberFormat("zh-CN");
  const state = { catalog: null, pages: [], byPath: /* @__PURE__ */ new Map(), byId: /* @__PURE__ */ new Map(), groups: /* @__PURE__ */ new Map(), mode: "zh", route: "/", page: null, loadId: 0, searchResults: [], searchSelected: 0, searchIndex: null, searchLoading: false, observer: null, indexPage: 0 };
  const appBaseUrl = new URL(".", ((_a = document.currentScript) == null ? void 0 : _a.src) || document.baseURI);
  function loadData(key) {
    var _a2;
    if (!((_a2 = window.OrleansData) == null ? void 0 : _a2.load)) return Promise.reject(new Error("\u6570\u636E\u52A0\u8F7D\u5668\u672A\u627E\u5230\u3002\u8BF7\u5B8C\u6574\u89E3\u538B\u6587\u6863\u5305\uFF0C\u5E76\u4FDD\u6301 index.html\u3001data-loader.js\u3001data \u548C assets \u7684\u76F8\u5BF9\u4F4D\u7F6E\u3002"));
    return window.OrleansData.load(key);
  }
  const storage = { get(k) {
    try {
      return localStorage.getItem(k);
    } catch (e) {
      return null;
    }
  }, set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch (e) {
    }
  } };
  state.mode = ["zh", "compare", "en"].includes(storage.get("orleans-mode")) ? storage.get("orleans-mode") : "zh";
  const navStorageKey = "orleans-nav-groups-v1";
  const navExpansion = (() => {
    try {
      const saved = JSON.parse(storage.get(navStorageKey));
      if ((saved == null ? void 0 : saved.version) === 1 && saved.groups && typeof saved.groups === "object" && !Array.isArray(saved.groups)) return new Map(Object.entries(saved.groups).filter(([, open]) => typeof open === "boolean"));
    } catch (e) {
    }
    return /* @__PURE__ */ new Map();
  })();
  let navHasNavigated = false;
  const canonical = (raw) => {
    let p = String(raw || "/").replace(/^https?:\/\/dotnet\.github\.io/, "").replace(/^\/orleans(?=\/|$)/, "").replace(/\.md$/, "/").split("?")[0];
    if (!p.startsWith("/")) p = "/" + p;
    if (!p.endsWith("/")) p += "/";
    return p.replace(/\/{2,}/g, "/");
  };
  const link = (p, anchor = "") => "#" + canonical(p) + (anchor ? "::" + encodeURIComponent(anchor) : "");
  const currentTitle = (p) => state.mode === "en" ? p.title || p.titleZh || p.path : p.titleZh || p.title || p.path;
  const isApi = (p) => /\/api\/csharp\//.test(p.path) || /api|member|type|package/.test(p.kind || "");
  const isPackage = (p) => /api-package|^package$/.test(p.kind || "") || /^\/docs\/api\/csharp\//.test(p.path) && p.path.split("/").filter(Boolean).length <= 4;
  const groupNames = { "docs": "\u6587\u6863\u603B\u89C8", "get-started": "\u5F00\u59CB\u4F7F\u7528", "getting-started": "\u5F00\u59CB\u4F7F\u7528", "grains": "Grain \u5F00\u53D1", "host": "\u6258\u7BA1\u4E0E\u914D\u7F6E", "configuration-guide": "\u914D\u7F6E\u6307\u5357", "monitoring": "\u53EF\u89C2\u6D4B\u6027", "deployment": "\u90E8\u7F72\u4E0E\u8FD0\u7EF4", "streaming": "\u6D41\u5904\u7406", "security": "\u5B89\u5168", "implementation": "\u8FD0\u884C\u65F6\u67B6\u6784", "tutorials-and-samples": "\u6559\u7A0B\u4E0E\u793A\u4F8B", "how-to": "\u64CD\u4F5C\u6307\u5357", "diagnostics": "\u5206\u6790\u5668\u8BCA\u65AD", "resources": "\u53C2\u8003\u8D44\u6599", "api": "C# API \u53C2\u8003", "api-packages": "API \u5305", "samples": "\u793A\u4F8B", "contributing": "\u53C2\u4E0E\u8D21\u732E", "overview": "\u6982\u89C8", "migration": "\u8FC1\u79FB\u6307\u5357" };
  function groupOf(p) {
    return p.group || (isApi(p) ? "api-packages" : p.path.split("/").filter(Boolean)[1] || "docs");
  }
  function groupLabel(id) {
    const v = state.groups.get(id);
    return (typeof v === "string" ? v : (v == null ? void 0 : v.label) || (v == null ? void 0 : v.titleZh) || (v == null ? void 0 : v.title)) || groupNames[id] || id;
  }
  function sourceDate() {
    var _a2, _b, _c, _d;
    const d = ((_b = (_a2 = state.catalog) == null ? void 0 : _a2.meta) == null ? void 0 : _b.snapshot) || ((_d = (_c = state.catalog) == null ? void 0 : _c.meta) == null ? void 0 : _d.snapshotDate) || "";
    return String(d).replace(/(\d)T(?=\d)/g, "$1 ").replace(/\.\d+Z$/, " UTC");
  }
  function documentationVersion() {
    var _a2, _b, _c;
    const m = ((_a2 = state.catalog) == null ? void 0 : _a2.meta) || {}, v = m.documentationVersion || ((_b = state.catalog) == null ? void 0 : _b.documentationVersion) || {};
    const sourceBranch = String(v.sourceBranch || ""), sourceCommit = String(v.sourceCommit || m.sourceCommit || "");
    const reference = [sourceBranch, sourceCommit.slice(0, 7)].filter(Boolean).join("@");
    const date = ((_c = sourceDate().match(/^\d{4}-\d{2}-\d{2}/)) == null ? void 0 : _c[0]) || "";
    return { ...v, label: v.label || "\u5B98\u65B9\u6587\u6863\u5FEB\u7167", summary: v.summary || "\u672C\u8BD1\u7AD9\u4F9D\u636E\u5B98\u65B9\u6587\u6863\u5FEB\u7167\u5236\u4F5C\u3002\u5177\u4F53\u7248\u672C\u4EE5\u5404\u9875\u9762\u548C\u6765\u6E90\u8BB0\u5F55\u4E3A\u51C6\u3002", sourceBranch, sourceCommit, reference: [reference, date].filter(Boolean).join(" \xB7 ") };
  }
  function updateVersionHeader() {
    const v = documentationVersion(), label = $("#documentation-version-label"), reference = $("#documentation-version-ref"), entry = $("#documentation-version");
    if (label) label.textContent = v.label;
    if (reference) reference.textContent = v.reference || "\u67E5\u770B\u7248\u672C\u4E0E\u5FEB\u7167\u8BF4\u660E";
    if (entry) {
      entry.title = v.summary;
      entry.setAttribute("aria-label", "".concat(v.label, "\uFF0C").concat(v.reference, "\uFF0C\u67E5\u770B\u7248\u672C\u4E0E\u5FEB\u7167\u8BF4\u660E"));
    }
    const release = $("#repository-release"), latest = v.latestRepositoryRelease;
    if (release) {
      const valid = latest && /^https:\/\/github\.com\/dotnet\/orleans\/releases\/tag\//.test(latest.sourceUrl || "");
      release.hidden = !valid;
      if (valid) {
        release.href = latest.sourceUrl;
        release.textContent = "\u6700\u65B0 ".concat(latest.tag || latest.version);
        release.title = "\u5B98\u65B9\u4ED3\u5E93\u6700\u65B0 Release\uFF1B\u53D1\u5E03\u4E8E ".concat(latest.publishedDate || "\u672A\u63D0\u4F9B", "\uFF0C\u6838\u9A8C\u4E8E ").concat(latest.checkedDate || "\u672A\u63D0\u4F9B", "\u3002\u6587\u6863\u4F9D\u636E\u4ECD\u4E3A ").concat(v.label, "\u3002");
        release.setAttribute("aria-label", release.textContent + "\uFF0C\u6253\u5F00\u5B98\u65B9\u4ED3\u5E93 Release");
      }
    }
  }
  function versionSummary(home = false) {
    const v = documentationVersion();
    if (!home) return '<details class="version-summary version-summary-compact" aria-label="\u6587\u6863\u7248\u672C\u8BF4\u660E"><summary><span class="version-summary-label">'.concat(esc(v.label), "</span>").concat(v.reference ? " <code>".concat(esc(v.reference), "</code>") : "", '<span class="version-summary-toggle">\u7248\u672C\u8BF4\u660E</span></summary><p>').concat(esc(v.summary), "</p></details>");
    return '<section class="version-summary'.concat(home ? " version-summary-home" : "", '" aria-label="\u6587\u6863\u7248\u672C\u8BF4\u660E"><div class="version-summary-heading"><a href="#/__audit/::audit-source">').concat(esc(v.label), "</a>").concat(v.reference ? "<code>".concat(esc(v.reference), "</code>") : "", "</div><p>").concat(esc(v.summary), "</p></section>");
  }
  function versionAuditRows() {
    const v = documentationVersion(), rows = [["\u6587\u6863\u4F9D\u636E", v.label, v.scope], ["\u9002\u7528\u7248\u672C\u8BF4\u660E", v.summary], ["\u6E90\u7801\u5206\u652F", v.sourceBranch || "\u672A\u63D0\u4F9B"], ["\u6E90\u7801\u63D0\u4EA4", v.sourceCommit || "\u672A\u63D0\u4F9B"], ["\u5FEB\u7167\u65F6\u95F4", sourceDate() || "\u672A\u63D0\u4F9B"]];
    const latest = v.latestRepositoryRelease;
    if (latest) {
      rows.push(["\u5B98\u65B9\u4ED3\u5E93\u6700\u65B0 Release", latest.tag || latest.version, "\u53D1\u5E03\u4E8E ".concat(latest.publishedDate || "\u672A\u63D0\u4F9B", "\uFF1B\u8FD9\u662F\u4ED3\u5E93 Release \u4FE1\u606F\uFF0C\u6587\u6863\u4F9D\u636E\u4ECD\u4E3A ").concat(v.label, "\u3002"), latest.sourceUrl]);
      rows.push(["\u6700\u65B0 Release \u6838\u9A8C\u65E5\u671F", latest.checkedDate || "\u672A\u63D0\u4F9B"]);
    }
    const packageKey = v.exampleProjectPackageVersion ? "exampleProjectPackageVersion" : v.quickstartPackageVersion ? "quickstartPackageVersion" : "baselinePackageVersion";
    if (v[packageKey]) rows.push([packageKey === "exampleProjectPackageVersion" ? "\u6587\u6863\u793A\u4F8B\u5305\u7248\u672C" : "\u5FEB\u901F\u5165\u95E8\u793A\u4F8B\u5305\u7248\u672C", v[packageKey], v[packageKey + "Scope"]]);
    for (const [key, label] of [["sourceVersionPrefix", "\u6E90\u7801\u9ED8\u8BA4\u7248\u672C\u524D\u7F00"], ["apiVersions", "API \u9875\u9762\u6807\u6CE8\u7248\u672C"], ["additionalMentionedVersions", "\u8FC1\u79FB\u6587\u6863\u6D89\u53CA\u7248\u672C"]]) {
      if (v[key]) rows.push([label, Array.isArray(v[key]) ? v[key].join("\u3001") : v[key], v[key + "Scope"]]);
    }
    return rows.map(([label, value, note, url]) => "<tr><td>".concat(esc(label), "</td><td>").concat(url && /^https:\/\/github\.com\/dotnet\/orleans\/releases\/tag\//.test(url) ? '<a href="'.concat(esc(url), '" target="_blank" rel="noopener noreferrer">').concat(esc(value), "</a>") : label === "\u6E90\u7801\u63D0\u4EA4" && /^[a-f\d]{7,40}$/i.test(value) ? '<a class="source-hash" href="https://github.com/dotnet/orleans/commit/'.concat(esc(value), '" target="_blank" rel="noopener noreferrer">').concat(esc(value), "</a>") : esc(value)).concat(note ? '<small class="version-scope">'.concat(esc(note), "</small>") : "", "</td></tr>")).join("");
  }
  function statusInfo(page) {
    const s = String(page.status || "").toLowerCase();
    if (s === "machine-draft") return { label: "\u4E2D\u6587\u521D\u7A3F \xB7 \u5F85\u590D\u5BA1", className: "pending" };
    if (s === "reviewed" || s === "human-reviewed" || s === "semantic-reviewed") return { label: "\u8BD1\u6587\u5DF2\u590D\u5BA1", className: "reviewed" };
    if (["translated", "machine", "machine-translated", "draft", "translated-unreviewed", "translation-reviewed"].includes(s)) return { label: s === "translation-reviewed" ? "\u8BD1\u6587\u5DF2\u590D\u67E5" : "\u5DF2\u7FFB\u8BD1", className: "translated" };
    if (s === "verified") return { label: "\u7ED3\u6784\u5DF2\u6821\u9A8C", className: "translated" };
    if (s === "partial" || s === "partially-translated") return { label: "\u90E8\u5206\u7FFB\u8BD1", className: "pending" };
    if (s === "original" || s === "pending" || s === "untranslated" || s === "source-only") return { label: "\u5F85\u7FFB\u8BD1", className: "pending" };
    if (page.titleZh && /[\u3400-\u9fff]/.test(page.titleZh)) return { label: "\u5DF2\u7FFB\u8BD1", className: "translated" };
    return { label: "\u539F\u6587\u6536\u5F55", className: "" };
  }
  function badge(page) {
    const s = statusInfo(page);
    return '<span class="badge '.concat(s.className, '">').concat(s.label, "</span>");
  }
  function setToc(items, note = "") {
    $("#toc").innerHTML = items.map((x) => '<a href="'.concat(esc(x.href), '" class="').concat(x.level > 2 ? "toc-deep" : "", '">').concat(esc(x.label), "</a>")).join("");
    $("#toc-note").innerHTML = note;
  }
  function snapshotFooter() {
    return '\u539F\u6587\uFF1A<a href="https://dotnet.github.io/orleans/" target="_blank" rel="noopener noreferrer">dotnet.github.io/orleans</a><br>\u57FA\u4E8E\u539F\u6587\u5FEB\u7167\u5236\u4F5C\u7684\u975E\u5B98\u65B9\u4E2D\u6587\u5BF9\u7167\u7248\u672C\u3002<br>\u6E90\u6587\u6863\u9075\u5FAA <a href="https://github.com/dotnet/orleans/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">MIT \u8BB8\u53EF\u8BC1</a>\uFF0C\u7248\u6743\u6240\u6709 \xA9 .NET Foundation\u3002';
  }
  function saveNavExpansion() {
    const groups = $$(".nav-group", $("#navigation")).map((group) => [group.dataset.group, group.open]);
    for (const [id, open] of groups) navExpansion.set(id, open);
    storage.set(navStorageKey, JSON.stringify({ version: 1, groups: Object.fromEntries(groups) }));
  }
  function navGroupForPath(path) {
    if (path === "/" || path === "/original-home/") return null;
    const page = state.byPath.get(path) || state.byId.get(path.slice(1, -1));
    return page ? groupOf(page) : null;
  }
  function renderNav() {
    const navPages = state.pages.filter((p) => p.path !== "/original-home/" && (!isApi(p) || isPackage(p)));
    const grouped = /* @__PURE__ */ new Map();
    navPages.forEach((p) => {
      const g = groupOf(p);
      if (!grouped.has(g)) grouped.set(g, []);
      grouped.get(g).push(p);
    });
    let html = '<a href="#/__overview/" class="nav-home" data-path="/__overview/">\u4E2D\u6587\u6587\u6863\u5BFC\u822A</a>';
    const groupOrder = [...state.groups.keys()];
    const orderedGroups = [...grouped].sort(([a], [b]) => (groupOrder.includes(a) ? groupOrder.indexOf(a) : 999) - (groupOrder.includes(b) ? groupOrder.indexOf(b) : 999));
    for (const [gid, pages] of orderedGroups) {
      const open = navExpansion.has(gid) ? navExpansion.get(gid) : true;
      html += '<details class="nav-group" data-group="'.concat(esc(gid), '"').concat(open ? " open" : "", "><summary>").concat(esc(groupLabel(gid)), '<span class="nav-count">').concat(pages.length, '</span></summary><div class="nav-links">');
      html += pages.map((p) => '<a class="nav-link'.concat(p.path.split("/").length > 6 ? " is-deep" : "", '" href="').concat(esc(link(p.path)), '" data-path="').concat(esc(p.path), '" title="').concat(esc(p.title || ""), '">').concat(esc(p.titleZh || p.title || p.path), "</a>")).join("");
      html += "</div></details>";
    }
    if (!navPages.some((p) => isApi(p))) html += '<a class="nav-home" href="#/__all/">C# API \u53C2\u8003</a>';
    $("#navigation").innerHTML = html;
    $$(".nav-group", $("#navigation")).forEach((group) => {
      group.addEventListener("toggle", saveNavExpansion);
      $("summary", group).addEventListener("click", (event) => {
        event.preventDefault();
        group.open = !group.open;
        saveNavExpansion();
      });
    });
    $("#collapse-nav").disabled = false;
    $("#sidebar-snapshot").textContent = sourceDate() ? "\u539F\u6587\u5FEB\u7167 ".concat(sourceDate()) : "\u539F\u6587\u5FEB\u7167\u4FE1\u606F\u89C1\u5BA1\u6821\u8BB0\u5F55";
    updateNavActive();
  }
  function updateNavActive(revealGroup = false) {
    const activePath = state.route === "/original-home/" ? "/" : state.route;
    $$("[data-path]", $("#navigation")).forEach((el) => {
      const on = el.dataset.path === activePath;
      el.classList.toggle("active", on);
      if (on) el.setAttribute("aria-current", "page");
      else el.removeAttribute("aria-current");
    });
    if (revealGroup) {
      const groupId = navGroupForPath(state.route), group = $$(".nav-group", $("#navigation")).find((item) => item.dataset.group === groupId);
      if (group && !group.open) {
        group.open = true;
        saveNavExpansion();
      }
    }
  }
  function closeMenu() {
    document.body.classList.remove("nav-open");
    $("#mobile-overlay").hidden = true;
    $("#menu-toggle").setAttribute("aria-expanded", "false");
  }
  function toast(message) {
    const el = $("#toast");
    el.textContent = message;
    el.classList.add("visible");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("visible"), 2400);
  }
  const isHomepagePath = (path) => path === "/" || path === "/original-home/";
  function officialIcon(name, className = "") {
    var _a2;
    const svg = (_a2 = window.OrleansOfficialIcons) == null ? void 0 : _a2[name];
    return svg ? '<span class="official-icon '.concat(className, '" data-source-icon="').concat(esc(name), '" data-source-ui="true" aria-hidden="true">').concat(svg, "</span>") : "";
  }
  function homepageBlock(block, index, className = "", asHeading = false, iconName = "") {
    const id = String(block.id || "homepage-".concat(index)), en = block.en || "", zh = block.zh || "";
    const shared = block.type === "code" && en === zh, compare = state.mode === "compare" && !shared;
    const fragment = (language, value) => {
      const source = '<div class="source-fragment" data-source-language="'.concat(language, '"').concat(shared ? ' data-source-shared="en zh"' : "", ' lang="').concat(language === "zh" ? "zh-CN" : "en", '">').concat(value, "</div>");
      return iconName ? '<div class="official-card-title-row" data-card-title-language="'.concat(language, '">').concat(officialIcon(iconName, "card-icon")).concat(source, "</div>") : source;
    };
    let content;
    if (compare) {
      content = '<div class="official-language"><span class="official-language-label" data-source-ui="true">English</span>'.concat(fragment("en", en), '</div><div class="official-language"><span class="official-language-label" data-source-ui="true">\u4E2D\u6587</span>').concat(fragment("zh", zh || en), "</div>");
    } else {
      const language = state.mode === "en" || shared && state.mode === "compare" ? "en" : "zh";
      content = (shared && state.mode === "compare" ? '<div class="shared-caption" data-source-ui="true">\u4EE3\u7801\u76F8\u540C \xB7 \u4E24\u79CD\u8BED\u8A00\u5171\u7528</div>' : "") + fragment(language, language === "en" ? en : zh || en);
    }
    return '<div class="official-block '.concat(className).concat(compare ? " is-bilingual" : "").concat(shared ? " is-shared" : "", '" id="').concat(esc(id), '" data-source-block="').concat(esc(id), '" data-source-type="').concat(esc(block.type || "other"), '" data-block="').concat(index, '"').concat(asHeading ? ' role="heading" aria-level="3"' : "", ">").concat(content, "</div>");
  }
  function preserveHomepageAnchors(blocks) {
    const sourceById = new Map(blocks.map((block) => [String(block.id), block]));
    const containers = $$(".official-block");
    const usedIds = new Set($$("[id]").filter((el) => !el.closest(".source-fragment")).map((el) => el.id));
    for (const container of containers) {
      const block = sourceById.get(container.dataset.sourceBlock), anchors = new Set((block == null ? void 0 : block.anchor) ? [block.anchor] : []);
      $$("[id]", container).forEach((el) => {
        anchors.add(el.id);
        el.dataset.sourceAnchor = el.id;
        el.removeAttribute("id");
      });
      for (const anchor of anchors) {
        if (usedIds.has(anchor)) continue;
        const marker = document.createElement("span");
        marker.id = anchor;
        marker.className = "official-anchor";
        marker.setAttribute("aria-hidden", "true");
        container.prepend(marker);
        usedIds.add(anchor);
      }
    }
  }
  function renderHome(page) {
    state.page = page;
    const blocks = page.blocks || [], used = /* @__PURE__ */ new Set();
    const block = (index, className = "", asHeading = false, iconName = "") => {
      if (!blocks[index]) return "";
      used.add(index);
      return homepageBlock(blocks[index], index, className, asHeading, iconName);
    };
    const featureIcons = ["virtual-actors", "durable-state", "streams", "scheduling", "transactions", "event-sourcing", "scaling", "fault-tolerance"];
    const scenarioIcons = ["ai-agents", "fraud-risk", "iot", "monitoring", "games", "commerce"];
    const cards = (start2, icons) => icons.map((name, index) => '<section class="official-card"><div class="official-card-heading">'.concat(block(start2 + index * 2, "official-card-title", true, name), "</div>").concat(block(start2 + index * 2 + 1, "official-card-description"), "</section>")).join("");
    const hero = '<section class="official-hero"><div class="official-hero-copy">'.concat(block(0, "official-title")).concat(block(1, "official-tagline")).concat(block(2, "official-introduction")).concat(block(3, "official-cta"), '</div><div class="official-logo-wrap"><img class="official-logo" src="assets/brand/orleans-logo.svg" width="400" height="400" alt="Microsoft Orleans"></div></section>');
    const features = '<section class="official-section official-features">'.concat(block(4, "official-section-heading")).concat(block(5, "official-section-introduction"), '<div class="official-feature-grid">').concat(cards(6, featureIcons), "</div></section>");
    const scenarios = '<section class="official-section official-scenarios">'.concat(block(22, "official-section-heading")).concat(block(23, "official-section-introduction"), '<div class="official-scenario-grid">').concat(cards(24, scenarioIcons), "</div></section>");
    const programming = '<section class="official-section official-programming">'.concat(block(36, "official-section-heading")).concat(block(37, "official-section-introduction"), '<div class="official-program-grid"><section class="official-code-card">').concat(block(38, "official-card-title", true)).concat(block(39, "official-code-filename")).concat(block(40, "official-code"), '</section><section class="official-code-card">').concat(block(41, "official-card-title", true)).concat(block(42, "official-code-filename")).concat(block(43, "official-code"), "</section></div></section>");
    const start = '<section class="official-section official-start">'.concat(block(44, "official-section-heading"), '<div class="official-start-grid">').concat([45, 46, 47, 48].map((index) => block(index, "official-start-card")).join(""), "</div></section>");
    const remaining = blocks.map((item, index) => used.has(index) ? "" : homepageBlock(item, index)).join("");
    const source = page.sourceUrl || "https://dotnet.github.io/orleans/";
    $("#content").innerHTML = '<div class="official-toolbar"><nav class="official-page-links" aria-label="\u9996\u9875\u5BFC\u822A"><a href="#/" aria-current="page">\u5B98\u7F51\u9996\u9875</a><a href="#/__overview/" class="official-overview-link">\u4E2D\u6587\u6587\u6863\u5BFC\u822A</a></nav><div class="mode-control" role="group" aria-label="\u9996\u9875\u9605\u8BFB\u8BED\u8A00"><button type="button" data-mode="zh" class="'.concat(state.mode === "zh" ? "active" : "", '" aria-pressed="').concat(state.mode === "zh", '">\u4E2D\u6587</button><button type="button" data-mode="compare" class="').concat(state.mode === "compare" ? "active" : "", '" aria-pressed="').concat(state.mode === "compare", '">\u4E2D\u82F1\u5BF9\u7167</button><button type="button" data-mode="en" class="').concat(state.mode === "en" ? "active" : "", '" aria-pressed="').concat(state.mode === "en", '">English</button></div></div><article class="official-home doc-body" data-mode="').concat(state.mode, '" data-source-page="').concat(esc(page.id), '" aria-label="\u539F\u5B98\u7F51\u9996\u9875\u4E2D\u6587\u5BF9\u7167">').concat(hero).concat(features).concat(scenarios).concat(programming).concat(start).concat(remaining ? '<section class="official-section">'.concat(remaining, "</section>") : "", '</article><footer class="official-footer">').concat(versionSummary(true), '<div class="official-provenance">').concat(badge(page), '<a href="').concat(esc(source), '" target="_blank" rel="noopener noreferrer">\u67E5\u770B\u82F1\u6587\u5B98\u7F51\u9996\u9875</a><a href="#/__overview/">\u4E2D\u6587\u6587\u6863\u5BFC\u822A</a><a href="#/__audit/">\u6765\u6E90\u4E0E\u5BA1\u6821\u8BB0\u5F55</a></div>').concat(page.sourceHash ? '<p class="source-hash">\u539F\u6587 SHA-256\uFF1A'.concat(esc(page.sourceHash), "</p>") : "", "<p>").concat(snapshotFooter(), "</p></footer>");
    preserveHomepageAnchors(blocks);
    $$(".official-toolbar [data-mode]").forEach((button) => button.onclick = () => {
      state.mode = button.dataset.mode;
      storage.set("orleans-mode", state.mode);
      const y = window.scrollY;
      renderHome(page);
      window.scrollTo(0, y);
    });
    enhanceContent();
    setToc([]);
    document.title = "Microsoft Orleans \xB7 \u5B98\u7F51\u9996\u9875\u4E2D\u6587\u5BF9\u7167";
  }
  function renderOverview() {
    var _a2, _b, _c;
    const m = state.catalog.meta || {}, total = (_a2 = m.totalPages) != null ? _a2 : state.pages.length, translated = (_b = m.translatedPages) != null ? _b : 0, reviewed = (_c = m.reviewedPages) != null ? _c : 0;
    const docs = state.pages.filter((p) => !isApi(p));
    const intro = docs.find((p) => /getting-started|quickstart|quick-start/.test(p.path)) || state.byPath.get("/docs/") || docs[0];
    const choices = [];
    const patterns = [/\/overview\/$|\/docs\/$/, /\/grains\/$/, /grain-persistence\/$/, /transactions\/$/, /configuration-guide\/$/, /\/streaming\/$/, /\/deployment\/$/, /\/tutorials-and-samples\/$/];
    for (const re of patterns) {
      const p = state.pages.find((p2) => !isApi(p2) && re.test(p2.path));
      if (p && !choices.includes(p)) choices.push(p);
    }
    for (const p of docs) {
      if (choices.length >= 8) break;
      if (!choices.includes(p)) choices.push(p);
    }
    $("#content").innerHTML = '<section class="home-hero"><div class="home-eyebrow">MICROSOFT ORLEANS \xB7 \u4E2D\u6587\u5BF9\u7167\u6587\u6863</div><h1 class="home-title">\u4E2D\u6587\u6587\u6863\u5BFC\u822A</h1><p class="home-lead">\u4ECE Grain \u7F16\u7A0B\u6A21\u578B\u5230\u8FD0\u884C\u65F6\u673A\u5236\uFF0C\u4ECE\u5E94\u7528\u5F00\u53D1\u5230 API \u53C2\u8003\u3002\u4FDD\u7559\u82F1\u6587\u539F\u6587\u3001\u4EE3\u7801\u548C\u6765\u6E90\uFF0C\u5728\u4E2D\u6587\u9605\u8BFB\u4E0E\u4E2D\u82F1\u5BF9\u7167\u4E4B\u95F4\u968F\u65F6\u5207\u6362\u3002</p>'.concat(versionSummary(true), '<div class="home-actions">').concat(intro ? '<a class="button-primary" href="'.concat(esc(link(intro.path)), '">\u5F00\u59CB\u9605\u8BFB</a>') : "", '<a class="button-secondary" href="#/__all/">\u6D4F\u89C8\u5168\u90E8\u6587\u6863</a><a class="button-secondary" href="#/__audit/">\u67E5\u770B\u5BA1\u6821\u8BB0\u5F55</a></div></section>\n    <section class="home-stats" aria-label="\u6587\u6863\u8986\u76D6\u7EDF\u8BA1"><div class="home-stat"><strong>').concat(nf.format(total), '</strong><span>\u539F\u7AD9\u9875\u9762</span></div><div class="home-stat"><strong>').concat(nf.format(translated), '</strong><span>\u5DF2\u63D0\u4F9B\u4E2D\u6587\u8BD1\u6587</span></div><div class="home-stat"><strong>').concat(nf.format(reviewed), "</strong><span>\u5DF2\u8BB0\u5F55\u8BED\u4E49\u590D\u5BA1</span></div></section>\n    ").concat(m.notice ? '<div class="page-notice information">'.concat(esc(m.notice), "</div>") : "", '\n    <section id="home-topics"><h2 class="section-title">\u4ECE\u8FD9\u91CC\u5F00\u59CB\u63A2\u7D22</h2><p class="section-description">\u6CBF\u7528\u539F\u7AD9\u7684\u77E5\u8BC6\u7ED3\u6784\u3002\u793A\u4F8B\u6CE8\u91CA\u63D0\u4F9B\u4E2D\u6587\u8BD1\u6587\uFF0C\u4EE3\u7801\u8BED\u53E5\u4E0E API \u6807\u8BC6\u7B26\u4FDD\u7559\u539F\u6837\uFF1B\u6B63\u6587\u6309\u6BB5\u843D\u5BF9\u5E94\u3002</p><div class="topic-list">').concat(choices.map((p) => '<a class="topic-link" href="'.concat(esc(link(p.path)), '"><strong>').concat(esc(p.titleZh || p.title), "</strong><small>").concat(esc(p.titleZh && p.title !== p.titleZh ? p.title : groupLabel(groupOf(p))), "</small></a>")).join(""), '</div></section>\n    <section id="home-reading"><h2 class="section-title">\u6309\u4F60\u7684\u4E60\u60EF\u9605\u8BFB</h2><div class="reading-guide"><div><h3>\u4E2D\u6587\u9605\u8BFB</h3><p>\u4F7F\u7528\u7EDF\u4E00\u7684\u4E13\u4E1A\u672F\u8BED\uFF1BGrain\u3001Silo\u3001\u7C7B\u578B\u540D\u79F0\u53CA\u65B9\u6CD5\u7B7E\u540D\u4FDD\u7559\u82F1\u6587\u6807\u8BC6\u3002</p></div><div><h3>\u4E2D\u82F1\u9010\u6BB5\u5BF9\u7167</h3><p>\u5728\u540C\u4E00\u4F4D\u7F6E\u67E5\u770B\u539F\u6587\u4E0E\u8BD1\u6587\u3002\u5BBD\u5C4F\u5E76\u6392\u663E\u793A\uFF0C\u624B\u673A\u6309\u539F\u6587\u3001\u8BD1\u6587\u987A\u5E8F\u6392\u5217\u3002</p></div><div><h3>\u6765\u6E90\u4E0E\u6821\u9A8C\u53EF\u8FFD\u6EAF</h3><p>\u6BCF\u7BC7\u6587\u6863\u4FDD\u7559\u82F1\u6587\u6765\u6E90\u548C\u5185\u5BB9\u5FEB\u7167\u4FE1\u606F\uFF0C\u7FFB\u8BD1\u8986\u76D6\u4E0E\u590D\u5BA1\u60C5\u51B5\u5355\u72EC\u8BB0\u5F55\u3002</p></div></div></section>\n    <div class="home-source">').concat(sourceDate() ? "\u539F\u6587\u5FEB\u7167\uFF1A".concat(esc(sourceDate()), "<br>") : "").concat(snapshotFooter(), "</div>");
    setToc([{ label: "\u4E2D\u6587\u6587\u6863\u5BFC\u822A", href: "#/__overview/" }, { label: "\u5F00\u59CB\u63A2\u7D22", href: "#/__overview/::home-topics" }, { label: "\u9605\u8BFB\u65B9\u5F0F", href: "#/__overview/::home-reading" }, { label: "\u672F\u8BED\u8868", href: "#/__glossary/" }, { label: "\u5BA1\u6821\u8BB0\u5F55", href: "#/__audit/" }], "\u4E2D\u6587\u7FFB\u8BD1\u4EE5\u5BF9\u5E94\u82F1\u6587\u539F\u6587\u4E3A\u4F9D\u636E\u3002<br>\u7248\u672C\u3001\u8986\u76D6\u8303\u56F4\u548C\u590D\u5BA1\u72B6\u6001\u89C1\u5BA1\u6821\u8BB0\u5F55\u3002");
    document.title = "\u4E2D\u6587\u6587\u6863\u5BFC\u822A \xB7 Orleans \u4E2D\u6587\u5BF9\u7167\u6587\u6863";
  }
  const builtInGlossary = [
    ["Grain", "Grain\uFF08\u865A\u62DF Actor\uFF09", "\u4FDD\u7559 Grain \u540D\u79F0\uFF1B\u4E0D\u80FD\u628A Grain \u7684\u903B\u8F91\u8EAB\u4EFD\u4E0E\u67D0\u4E2A\u6FC0\u6D3B\u5B9E\u4F8B\u6DF7\u4E3A\u4E00\u8C08\u3002"],
    ["Silo", "Silo\uFF08Orleans \u670D\u52A1\u5668\uFF09", "\u627F\u8F7D Grain \u6FC0\u6D3B\u5B9E\u4F8B\u7684\u670D\u52A1\u5668\u8FDB\u7A0B\u3002"],
    ["activation", "\u6FC0\u6D3B\u5B9E\u4F8B / \u6FC0\u6D3B", "\u6839\u636E\u4E0A\u4E0B\u6587\u533A\u5206\u8FD0\u884C\u4E2D\u7684\u5B9E\u4F8B\u4E0E\u6FC0\u6D3B\u8FC7\u7A0B\u3002"],
    ["virtual actor", "\u865A\u62DF Actor", "Actor \u7684\u903B\u8F91\u8EAB\u4EFD\u4E0E\u5185\u5B58\u4E2D\u7684\u751F\u547D\u5468\u671F\u89E3\u8026\u3002"],
    ["reentrancy", "\u91CD\u5165", "\u8BA8\u8BBA\u8BF7\u6C42\u4EA4\u9519\u8C03\u5EA6\uFF1B\u4E0D\u8981\u76F4\u63A5\u7B49\u540C\u4E8E\u591A\u7EBF\u7A0B\u5E76\u884C\u6267\u884C\u3002"],
    ["interleaving", "\u4EA4\u9519\u6267\u884C", "\u591A\u4E2A\u8BF7\u6C42\u5728\u6267\u884C\u4E0E\u7B49\u5F85\u4E4B\u95F4\u4EA4\u9519\u63A8\u8FDB\u3002"],
    ["persistence", "\u6301\u4E45\u5316", "\u5C06\u72B6\u6001\u5199\u5165\u6301\u4E45\u5B58\u50A8\u3002"],
    ["provider", "\u63D0\u4F9B\u7A0B\u5E8F", "Orleans \u7684\u5B58\u50A8\u3001\u6210\u5458\u7BA1\u7406\u3001\u6D41\u7B49\u53EF\u66FF\u6362\u5B9E\u73B0\u3002"],
    ["transaction", "\u4E8B\u52A1", "\u4FDD\u7559\u539F\u6587\u6240\u9650\u5B9A\u7684\u53C2\u4E0E\u8005\u3001\u72B6\u6001\u7C7B\u578B\u548C\u4E00\u81F4\u6027\u8FB9\u754C\u3002"],
    ["serializable isolation", "\u53EF\u4E32\u884C\u5316\u9694\u79BB", "\u6570\u636E\u5E93\u4E0E\u5206\u5E03\u5F0F\u4E8B\u52A1\u4E2D\u7684\u9694\u79BB\u7EA7\u522B\u3002"],
    ["stream", "\u6D41", "\u6D41\u5904\u7406\u4E2D\u7684\u4E8B\u4EF6\u5E8F\u5217\uFF1B\u4E0D\u662F\u64CD\u4F5C\u7CFB\u7EDF\u5B57\u8282\u6D41\u3002"],
    ["reminder", "\u63D0\u9192\u5668", "\u4E0E\u8BA1\u65F6\u5668\uFF08timer\uFF09\u533A\u5206\u3002"],
    ["event sourcing", "\u4E8B\u4EF6\u6EAF\u6E90", "\u901A\u8FC7\u4E8B\u4EF6\u5E8F\u5217\u63CF\u8FF0\u548C\u91CD\u5EFA\u72B6\u6001\u3002"],
    ["placement", "\u653E\u7F6E", "\u9009\u62E9\u627F\u8F7D Grain \u6FC0\u6D3B\u5B9E\u4F8B\u7684 Silo\u3002"],
    ["membership", "\u96C6\u7FA4\u6210\u5458\u7BA1\u7406", "\u96C6\u7FA4\u8282\u70B9\u8EAB\u4EFD\u3001\u5B58\u6D3B\u72B6\u6001\u53CA\u6210\u5458\u53D8\u66F4\u3002"],
    ["grain directory", "Grain \u76EE\u5F55", "\u8BB0\u5F55 Grain \u6FC0\u6D3B\u4F4D\u7F6E\u7684\u76EE\u5F55\u673A\u5236\u3002"],
    ["serialization", "\u5E8F\u5217\u5316", "\u533A\u5206\u6570\u636E\u5E8F\u5217\u5316\u4E0E\u4E8B\u52A1\u53EF\u4E32\u884C\u5316\u3002"],
    ["durability", "\u6301\u4E45\u6027", "\u5DF2\u63D0\u4EA4\u6570\u636E\u5728\u6545\u969C\u540E\u7684\u4FDD\u7559\u4FDD\u8BC1\u3002"]
  ];
  function renderGlossary() {
    var _a2;
    const list = ((_a2 = state.catalog.meta) == null ? void 0 : _a2.glossary) || builtInGlossary.map(([en, zh, note]) => ({ en, zh, note }));
    const rows = Array.isArray(list) ? list : Object.entries(list).map(([en, v]) => typeof v === "string" ? { en, zh: v } : { en, ...v });
    $("#content").innerHTML = '<div class="breadcrumbs"><a href="#/">\u6587\u6863\u9996\u9875</a><span class="sep">/</span><span>\u4E2D\u82F1\u672F\u8BED\u8868</span></div><h1 class="page-title">\u4E2D\u82F1\u672F\u8BED\u8868</h1><p class="english-title">Terminology glossary</p><p class="section-description" style="margin-top:23px">\u4E13\u4E1A\u672F\u8BED\u4F18\u5148\u4FDD\u6301\u8BED\u4E49\u51C6\u786E\u3002\u7C7B\u540D\u3001\u63A5\u53E3\u540D\u3001\u65B9\u6CD5\u540D\u3001\u5305\u540D\u4E0E\u4EE3\u7801\u6807\u8BC6\u7B26\u4E0D\u7FFB\u8BD1\uFF1B\u4E0A\u4E0B\u6587\u4E0D\u540C\u7684\u540C\u4E00\u82F1\u6587\u8BCD\u53EF\u80FD\u4F7F\u7528\u4E0D\u540C\u4E2D\u6587\u8868\u8FBE\u3002</p><table class="audit-table glossary-table"><thead><tr><th>\u82F1\u6587</th><th>\u7EDF\u4E00\u4E2D\u6587\u8868\u8FBE</th><th>\u4F7F\u7528\u8BF4\u660E</th></tr></thead><tbody>'.concat(rows.map((x) => "<tr><td>".concat(esc(x.en || x.term || ""), "</td><td>").concat(esc(x.zh || x.translation || ""), "</td><td>").concat(esc(x.note || x.notes || ""), "</td></tr>")).join(""), '</tbody></table><div class="document-footer">\u672F\u8BED\u8868\u7528\u4E8E\u4FDD\u8BC1\u8BD1\u6587\u524D\u540E\u4E00\u81F4\u3002\u5177\u4F53\u6280\u672F\u884C\u4E3A\u4ECD\u4EE5\u5BF9\u5E94\u9875\u9762\u7684\u5B8C\u6574\u4E0A\u4E0B\u6587\u4E3A\u51C6\u3002<br>').concat(snapshotFooter(), "</div>");
    setToc([{ label: "\u4E2D\u82F1\u672F\u8BED\u8868", href: "#/__glossary/" }, { label: "\u6765\u6E90\u4E0E\u5BA1\u6821\u8BB0\u5F55", href: "#/__audit/" }]);
    document.title = "\u4E2D\u82F1\u672F\u8BED\u8868 \xB7 Orleans \u4E2D\u6587\u6587\u6863";
  }
  function renderAudit() {
    var _a2, _b, _c;
    const m = state.catalog.meta || {};
    let audit = m.audit || [];
    if (!Array.isArray(audit)) audit = Object.entries(audit).map(([label, v]) => typeof v === "object" && v !== null ? { label, ...v } : { label, value: v });
    const counts = [{ label: "\u539F\u7AD9\u6536\u5F55\u9875\u9762", value: nf.format((_a2 = m.totalPages) != null ? _a2 : state.pages.length), detail: "\u4F9D\u636E\u5DF2\u4FDD\u5B58\u7684\u539F\u6587\u9875\u9762\u6E05\u5355\u3002" }, { label: "\u5DF2\u63D0\u4F9B\u4E2D\u6587\u8BD1\u6587\u7684\u9875\u9762", value: nf.format((_b = m.translatedPages) != null ? _b : 0), detail: "\u8BD1\u6587\u8986\u76D6\u7EDF\u8BA1\uFF1B\u4E0E\u8BED\u4E49\u590D\u5BA1\u6570\u91CF\u5206\u522B\u8BA1\u7B97\u3002" }, { label: "\u8BB0\u5F55\u8BED\u4E49\u590D\u5BA1\u7684\u9875\u9762", value: nf.format((_c = m.reviewedPages) != null ? _c : 0), detail: "\u53EA\u6709\u660E\u786E\u8BB0\u5F55\u590D\u5BA1\u7ED3\u679C\u7684\u9875\u9762\u8BA1\u5165\u3002" }];
    $("#content").innerHTML = '<div class="breadcrumbs"><a href="#/">\u6587\u6863\u9996\u9875</a><span class="sep">/</span><span>\u6765\u6E90\u4E0E\u5BA1\u6821\u8BB0\u5F55</span></div><h1 class="page-title">\u6765\u6E90\u4E0E\u5BA1\u6821\u8BB0\u5F55</h1><p class="english-title">Source, coverage & review</p><div class="audit-summary"><p>'.concat(esc(m.reviewSummary || "\u7FFB\u8BD1\u8986\u76D6\u3001\u4EE3\u7801\u4E0E\u7ED3\u6784\u6821\u9A8C\u3001\u8BED\u4E49\u590D\u5BA1\u5206\u522B\u8BB0\u5F55\u3002\u7ED3\u6784\u68C0\u67E5\u80FD\u591F\u53D1\u73B0\u7F3A\u6BB5\u3001\u4EE3\u7801\u53D8\u5316\u548C\u94FE\u63A5\u95EE\u9898\uFF0C\u4F46\u4E0D\u80FD\u66FF\u4EE3\u9010\u53E5\u7406\u89E3\u4E0E\u6280\u672F\u8BED\u4E49\u590D\u5BA1\u3002"), '</p></div><h2 id="audit-source" class="section-title">\u6587\u6863\u7248\u672C\u4E0E\u539F\u6587\u6765\u6E90</h2><table class="audit-table"><tbody><tr><td>\u539F\u6587\u7AD9\u70B9</td><td><a href="https://dotnet.github.io/orleans/" target="_blank" rel="noopener noreferrer">dotnet.github.io/orleans</a></td></tr>').concat(versionAuditRows()).concat(m.sourceHash ? '<tr><td>\u539F\u6587\u6458\u8981</td><td class="source-hash">'.concat(esc(m.sourceHash), "</td></tr>") : "", '<tr><td>\u539F\u6587\u8BB8\u53EF\u8BC1</td><td><a href="https://github.com/dotnet/orleans/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">MIT \xB7 \xA9 .NET Foundation</a></td></tr></tbody></table><h2 id="audit-coverage" class="section-title">\u8986\u76D6\u4E0E\u6821\u9A8C\u7ED3\u679C</h2><table class="audit-table"><thead><tr><th>\u68C0\u67E5\u9879</th><th>\u7ED3\u679C</th><th>\u8BF4\u660E</th></tr></thead><tbody>').concat([...counts, ...audit].map((x) => {
      var _a3, _b2, _c2;
      return "<tr><td>".concat(esc(x.label || x.name || ""), "</td><td>").concat(esc(typeof x.value === "object" ? JSON.stringify(x.value) : (_c2 = (_b2 = (_a3 = x.value) != null ? _a3 : x.result) != null ? _b2 : x.status) != null ? _c2 : ""), "</td><td>").concat(esc(x.detail || x.description || x.note || ""), "</td></tr>");
    }).join(""), '</tbody></table><p class="audit-downloads"><a href="documentation-version.json" download>\u4E0B\u8F7D\u6587\u6863\u7248\u672C\u4F9D\u636E</a> \xB7 <a href="audit-report.json" download>\u4E0B\u8F7D\u8986\u76D6\u62A5\u544A</a> \xB7 <a href="static-compatibility.json" download>\u4E0B\u8F7D\u9759\u6001\u7248\u517C\u5BB9\u6027\u6821\u9A8C</a> \xB7 <a href="publication-verification.json" download>\u4E0B\u8F7D\u5168\u7AD9\u7ED3\u6784\u6821\u9A8C</a> \xB7 <a href="code-verification.json" download>\u4E0B\u8F7D\u4EE3\u7801\u6821\u9A8C</a> \xB7 <a href="code-comments-review.json" download>\u4E0B\u8F7D\u4EE3\u7801\u6CE8\u91CA\u8BD1\u5BA1</a> \xB7 <a href="code-comments-cross-review.json" download>\u4E0B\u8F7D\u6CE8\u91CA\u4EA4\u53C9\u590D\u6838</a> \xB7 <a href="review-register.json" download>\u4E0B\u8F7D\u9010\u9875\u590D\u5BA1\u8BB0\u5F55</a> \xB7 <a href="unit-review-register.json" download>\u4E0B\u8F7D\u9010\u5355\u5143\u590D\u5BA1\u8BB0\u5F55</a> \xB7 <a href="contextual-reviews.json" download>\u4E0B\u8F7D\u9875\u9762\u8BED\u5883\u590D\u5BA1</a> \xB7 <a href="cross-review-report.json" download>\u4E0B\u8F7D\u4EA4\u53C9\u590D\u6838\u8BB0\u5F55</a> \xB7 <a href="source-issues.json" download>\u4E0B\u8F7D\u539F\u6587\u95EE\u9898\u8BB0\u5F55</a> \xB7 <a href="snapshot-metadata.json" download>\u4E0B\u8F7D\u6765\u6E90\u5FEB\u7167\u4FE1\u606F</a></p><h2 id="audit-status" class="section-title">\u5982\u4F55\u7406\u89E3\u9875\u9762\u72B6\u6001</h2><div class="doc-body"><ul><li><strong>\u4E2D\u6587\u521D\u7A3F \xB7 \u5F85\u590D\u5BA1\uFF1A</strong>\u5DF2\u6709\u673A\u5668\u8F85\u52A9\u751F\u6210\u7684\u4E2D\u6587\u521D\u7A3F\uFF0C\u5C1A\u672A\u5B8C\u6210\u9010\u53E5\u8BED\u4E49\u590D\u5BA1\u3002</li><li><strong>\u5DF2\u7FFB\u8BD1\uFF1A</strong>\u9875\u9762\u5DF2\u6709\u5BF9\u5E94\u8BD1\u6587\uFF1B\u662F\u5426\u5B8C\u6210\u8BED\u4E49\u590D\u5BA1\u53E6\u884C\u8BB0\u5F55\u3002</li><li><strong>\u8BD1\u6587\u5DF2\u590D\u5BA1\uFF1A</strong>\u8BE5\u9875\u5168\u90E8\u6B63\u6587\u5355\u5143\u5DF2\u6709 AI \u8BED\u4E49\u8BD1\u5BA1\u3001\u7CBE\u786E\u5BA1\u5B9A\u8BD1\u6587\u590D\u7528\u6216\u6807\u8BC6\u7B26\u6838\u5BF9\u8BB0\u5F55\u3002</li><li><strong>\u7ED3\u6784\u5DF2\u6821\u9A8C\uFF1A</strong>\u8868\u793A\u4EE3\u7801\u3001\u6BB5\u843D\u6216\u94FE\u63A5\u7B49\u7ED3\u6784\u68C0\u67E5\u901A\u8FC7\uFF0C\u4E0D\u4EE3\u8868\u6240\u6709\u53E5\u5B50\u5747\u5B8C\u6210\u8BED\u4E49\u590D\u5BA1\u3002</li><li><strong>\u90E8\u5206\u7FFB\u8BD1 / \u5F85\u7FFB\u8BD1\uFF1A</strong>\u5C1A\u672A\u5B8C\u6210\u7684\u5185\u5BB9\u4FDD\u7559\u82F1\u6587\uFF0C\u5E76\u5728\u6B63\u6587\u63D0\u793A\u3002</li></ul></div>').concat(m.limitations ? '<h2 id="audit-limits" class="section-title">\u5DF2\u77E5\u9650\u5236</h2><div class="doc-body">'.concat(Array.isArray(m.limitations) ? "<ul>".concat(m.limitations.map((s) => "<li>".concat(esc(s), "</li>")).join(""), "</ul>") : "<p>".concat(esc(m.limitations), "</p>"), "</div>") : "", '<div class="document-footer">').concat(snapshotFooter(), "</div>");
    setToc([{ label: "\u6587\u6863\u7248\u672C\u4E0E\u6765\u6E90", href: "#/__audit/::audit-source" }, { label: "\u8986\u76D6\u4E0E\u6821\u9A8C\u7ED3\u679C", href: "#/__audit/::audit-coverage" }, { label: "\u9875\u9762\u72B6\u6001", href: "#/__audit/::audit-status" }, ...m.limitations ? [{ label: "\u5DF2\u77E5\u9650\u5236", href: "#/__audit/::audit-limits" }] : []]);
    document.title = "\u6765\u6E90\u4E0E\u5BA1\u6821\u8BB0\u5F55 \xB7 Orleans \u4E2D\u6587\u6587\u6863";
  }
  function renderIndex() {
    state.indexPage = 0;
    $("#content").innerHTML = '<div class="breadcrumbs"><a href="#/">\u6587\u6863\u9996\u9875</a><span class="sep">/</span><span>\u5168\u7AD9\u9875\u9762\u7D22\u5F15</span></div><h1 class="page-title">\u5168\u7AD9\u9875\u9762\u7D22\u5F15</h1><p class="english-title">Documentation & C# API reference</p><div class="index-toolbar"><input class="index-input" id="index-query" type="search" placeholder="\u6309\u6807\u9898\u3001\u7C7B\u540D\u6216\u8DEF\u5F84\u7B5B\u9009" aria-label="\u7B5B\u9009\u5168\u90E8\u9875\u9762"><select class="index-filter" id="index-filter" aria-label="\u9875\u9762\u7C7B\u578B"><option value="all">\u5168\u90E8\u5185\u5BB9</option><option value="docs">\u6587\u6863\u4E0E\u6559\u7A0B</option><option value="api">C# API</option><option value="packages">API \u5305</option></select></div><p class="index-summary" id="index-summary"></p><div id="index-list"></div><div class="pagination"><button id="index-prev" type="button">\u4E0A\u4E00\u9875</button><span id="index-position"></span><button id="index-next" type="button">\u4E0B\u4E00\u9875</button></div>';
    $("#index-query").addEventListener("input", () => {
      state.indexPage = 0;
      updateIndex();
    });
    $("#index-filter").addEventListener("change", () => {
      state.indexPage = 0;
      updateIndex();
    });
    $("#index-prev").onclick = () => {
      state.indexPage--;
      updateIndex();
      $("#index-list").scrollIntoView({ block: "start" });
    };
    $("#index-next").onclick = () => {
      state.indexPage++;
      updateIndex();
      $("#index-list").scrollIntoView({ block: "start" });
    };
    updateIndex();
    setToc([{ label: "\u5168\u7AD9\u9875\u9762\u7D22\u5F15", href: "#/__all/" }, { label: "\u672F\u8BED\u8868", href: "#/__glossary/" }]);
    document.title = "\u5168\u7AD9\u9875\u9762\u7D22\u5F15 \xB7 Orleans \u4E2D\u6587\u6587\u6863";
  }
  function updateIndex() {
    const q = $("#index-query").value.toLowerCase().trim(), kind = $("#index-filter").value;
    const pages = state.pages.filter((p) => (kind === "all" || kind === "docs" && !isApi(p) || kind === "api" && isApi(p) || kind === "packages" && isPackage(p)) && (!q || p.searchText.includes(q)));
    const size = 60, total = Math.max(1, Math.ceil(pages.length / size));
    state.indexPage = Math.max(0, Math.min(state.indexPage, total - 1));
    $("#index-summary").textContent = "\u5171 ".concat(nf.format(pages.length), " \u4E2A\u9875\u9762\uFF0C\u6BCF\u9875 ").concat(size, " \u4E2A\u3002");
    $("#index-list").innerHTML = pages.slice(state.indexPage * size, (state.indexPage + 1) * size).map((p) => '<div class="index-row"><a href="'.concat(esc(link(p.path)), '">').concat(esc(p.titleZh || p.title), "<small>").concat(esc(p.titleZh && p.titleZh !== p.title ? p.title + " \xB7 " : "")).concat(esc(p.path), "</small></a>").concat(badge(p), "</div>")).join("") || '<p class="search-empty">\u6CA1\u6709\u627E\u5230\u5339\u914D\u9875\u9762\u3002\u8BF7\u5C1D\u8BD5\u66F4\u77ED\u7684\u4E2D\u6587\u8BCD\u6216\u82F1\u6587\u6807\u8BC6\u7B26\u3002</p>';
    $("#index-prev").disabled = state.indexPage === 0;
    $("#index-next").disabled = state.indexPage >= total - 1;
    $("#index-position").textContent = "".concat(state.indexPage + 1, " / ").concat(total);
  }
  function parseHash() {
    const raw = location.hash.slice(1) || "/";
    const i = raw.indexOf("::");
    let a = i >= 0 ? raw.slice(i + 2) : "";
    try {
      a = decodeURIComponent(a);
    } catch (e) {
    }
    return { path: canonical(i >= 0 ? raw.slice(0, i) : raw), anchor: a };
  }
  async function getPageData(page) {
    var _a2, _b;
    if (page.blocks) return page;
    const chunk = (_a2 = page.chunk) != null ? _a2 : page.id;
    let key = String(chunk);
    if (!/\.json$/.test(key)) key += ".json";
    if (!key.startsWith("content/")) key = "content/" + key;
    const data = await loadData(key);
    let out = data[page.id] || data[page.path] || ((_b = data.pages) == null ? void 0 : _b[page.id]);
    if (!out && Array.isArray(data)) out = data.find((x) => x.id === page.id || canonical(x.path) === page.path);
    if (!out && data.blocks) out = data;
    if (!out) throw new Error("\u5BF9\u5E94\u6570\u636E\u6587\u4EF6\u4E2D\u6CA1\u6709\u627E\u5230\u672C\u9875\u5185\u5BB9\u3002\u8BF7\u5B8C\u6574\u89E3\u538B\u6587\u6863\u5305\uFF0C\u5E76\u4FDD\u6301\u6587\u4EF6\u4F4D\u7F6E\u3002");
    return { ...page, ...out };
  }
  function safeId(id, i) {
    return String(id || "section-" + i);
  }
  function renderDocument(page) {
    var _a2;
    state.page = page;
    const title = currentTitle(page), type = isApi(page) ? "C# API" : "\u6587\u6863", src = page.sourceUrl || "https://dotnet.github.io/orleans" + page.path;
    const blocks = page.blocks || [];
    let missing = 0;
    const rows = blocks.map((b, i) => {
      if (b.level === 1) return "";
      const en = b.en || "", zh = b.zh || "", isShared = b.type === "code" && en === zh;
      if (!zh && !isShared && en) missing++;
      const id = safeId(b.anchor || b.id, i);
      if (isShared) return '<section class="doc-block shared-block" id="'.concat(esc(id), '" data-block="').concat(i, '">').concat(state.mode === "compare" ? '<div class="shared-caption">\u4EE3\u7801\u76F8\u540C \xB7 \u4E24\u79CD\u8BED\u8A00\u5171\u7528</div>' : "", '<div class="block-content">').concat(en || zh, "</div></section>");
      if (state.mode === "compare") return '<section class="doc-block" id="'.concat(esc(id), '" data-block="').concat(i, '"><div class="block-content block-en" lang="en">').concat(en, '</div><div class="block-content block-zh" lang="zh-CN">').concat(zh || '<span class="pending-text">\u672C\u6BB5\u5F85\u7FFB\u8BD1\uFF0C\u4EE5\u4E0B\u4FDD\u7559\u82F1\u6587\u539F\u6587\u3002</span>' + en, "</div></section>");
      return '<section class="doc-block" id="'.concat(esc(id), '" data-block="').concat(i, '"><div class="block-content" lang="').concat(state.mode === "en" ? "en" : "zh-CN", '">').concat(state.mode === "en" ? en : zh || '<span class="pending-text">\u672C\u6BB5\u5F85\u7FFB\u8BD1\uFF0C\u4EE5\u4E0B\u4FDD\u7559\u82F1\u6587\u539F\u6587\u3002</span>' + en, "</div></section>");
    }).join("");
    const notice = page.notice || page.reviewNote || (page.status === "machine-draft" ? "\u672C\u9875\u4E3A\u4E2D\u6587\u521D\u7A3F\uFF0C\u5C1A\u672A\u5B8C\u6210\u9010\u53E5\u8BED\u4E49\u590D\u5BA1\u3002\u53EF\u5207\u6362\u4E2D\u82F1\u5BF9\u7167\u67E5\u770B\u5BF9\u5E94\u539F\u6587\u3002" : "");
    $("#content").innerHTML = '<div class="breadcrumbs"><a href="#/">\u6587\u6863\u9996\u9875</a><span class="sep">/</span><span>'.concat(esc(groupLabel(groupOf(page))), '</span><span class="sep">/</span><span>').concat(type, '</span></div><h1 class="page-title" id="_top">').concat(esc(title), "</h1>").concat(page.title && page.title !== title ? '<p class="english-title" lang="en">'.concat(esc(page.title), "</p>") : "", '<div class="document-meta">').concat(badge(page), "<span>").concat(esc(sourceDate() ? "\u5FEB\u7167 " + sourceDate() : "\u539F\u6587\u5FEB\u7167"), '</span><a href="').concat(esc(src), '" target="_blank" rel="noopener noreferrer">\u67E5\u770B\u82F1\u6587\u539F\u9875<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6m0-6-9 9M10 5H5v14h14v-5"/></svg></a></div>').concat(versionSummary(), '<div class="reading-toolbar"><div class="mode-control" role="group" aria-label="\u9605\u8BFB\u8BED\u8A00"><button type="button" data-mode="zh" class="').concat(state.mode === "zh" ? "active" : "", '" aria-pressed="').concat(state.mode === "zh", '">\u4E2D\u6587</button><button type="button" data-mode="compare" class="').concat(state.mode === "compare" ? "active" : "", '" aria-pressed="').concat(state.mode === "compare", '">\u4E2D\u82F1\u5BF9\u7167</button><button type="button" data-mode="en" class="').concat(state.mode === "en" ? "active" : "", '" aria-pressed="').concat(state.mode === "en", '">English</button></div><span class="toolbar-note">\u6CE8\u91CA\u5DF2\u8BD1\u4E3A\u4E2D\u6587\uFF1B\u4EE3\u7801\u8BED\u53E5\u4E0E API \u6807\u8BC6\u7B26\u4FDD\u7559\u539F\u6587</span></div>').concat(notice ? '<div class="page-notice information">'.concat(esc(notice), "</div>") : "").concat(((_a2 = page.sourceIssues) == null ? void 0 : _a2.length) ? '<details class="source-review-note"><summary>\u539F\u6587\u95EE\u9898\u4E0E\u8BD1\u6CE8\uFF08'.concat(page.sourceIssues.length, "\uFF09</summary><ul>").concat(page.sourceIssues.map((note) => "<li>".concat(esc(note), "</li>")).join(""), '</ul><a href="source-issues.json" download>\u4E0B\u8F7D\u539F\u6587\u95EE\u9898\u8BB0\u5F55</a></details>') : "").concat(missing && state.mode !== "en" ? '<div class="page-notice">\u672C\u9875\u6709 '.concat(missing, " \u6BB5\u6682\u672A\u63D0\u4F9B\u4E2D\u6587\uFF0C\u5DF2\u4FDD\u7559\u82F1\u6587\u5E76\u9010\u6BB5\u6807\u8BB0\u3002</div>") : "").concat(state.mode === "compare" ? '<div class="comparison-head"><span>ENGLISH \xB7 \u539F\u6587</span><span>\u7B80\u4F53\u4E2D\u6587 \xB7 \u5BF9\u7167\u8BD1\u6587</span></div>' : "", '<article class="doc-body" data-mode="').concat(state.mode, '" data-source-page="').concat(esc(page.id), '" aria-label="\u6587\u6863\u6B63\u6587">').concat(rows || '<p class="muted">\u5F53\u524D\u9875\u6CA1\u6709\u6B63\u6587\u5185\u5BB9\u3002</p>', '</article><div class="document-footer"><a href="').concat(esc(src), '" target="_blank" rel="noopener noreferrer">\u82F1\u6587\u6765\u6E90</a> \xB7 <a href="#/__glossary/">\u672F\u8BED\u8868</a> \xB7 <a href="#/__audit/">\u5BA1\u6821\u8BB0\u5F55</a>').concat(page.sourceHash ? '<br><span class="source-hash">\u539F\u6587 SHA-256\uFF1A'.concat(esc(page.sourceHash), "</span>") : "", "<br>\xA9 .NET Foundation \xB7 \u539F\u6587\u9075\u5FAA MIT \u8BB8\u53EF\u8BC1\u3002</div>").concat(prevNext(page));
    $$(".mode-control button").forEach((b) => b.onclick = () => {
      state.mode = b.dataset.mode;
      storage.set("orleans-mode", state.mode);
      const y = window.scrollY;
      renderDocument(page);
      window.scrollTo(0, y);
    });
    enhanceContent();
    const toc = [];
    $$(".doc-block").forEach((el) => {
      const h = $("h1,h2,h3", state.mode === "compare" ? $(".block-zh", el) || el : el);
      if (h) toc.push({ label: h.textContent, href: link(page.path, el.id), level: Number(h.tagName[1]) });
    });
    setToc(toc, '<a href="'.concat(esc(src), '" target="_blank" rel="noopener noreferrer">\u67E5\u770B\u82F1\u6587\u539F\u6587</a><br><a href="#/__audit/">\u7FFB\u8BD1\u4E0E\u590D\u5BA1\u72B6\u6001</a>'));
    observeSections();
    document.title = title + " \xB7 Orleans \u4E2D\u6587\u6587\u6863";
  }
  function prevNext(page) {
    let list = state.pages.filter((p) => groupOf(p) === groupOf(page));
    if (!isApi(page)) list = list.filter((p) => !isApi(p));
    const i = list.findIndex((p) => p.id === page.id), prev = list[i - 1], next = list[i + 1];
    if (!prev && !next) return "";
    return '<nav class="prev-next" aria-label="\u76F8\u90BB\u6587\u6863">'.concat(prev ? '<a href="'.concat(esc(link(prev.path)), '"><small>\u4E0A\u4E00\u7BC7</small><strong>').concat(esc(currentTitle(prev)), "</strong></a>") : "<span></span>").concat(next ? '<a href="'.concat(esc(link(next.path)), '"><small>\u4E0B\u4E00\u7BC7</small><strong>').concat(esc(currentTitle(next)), "</strong></a>") : "", "</nav>");
  }
  async function copyText(text) {
    var _a2;
    try {
      if ((_a2 = navigator.clipboard) == null ? void 0 : _a2.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {
    }
    const active = document.activeElement, selection = window.getSelection(), ranges = [];
    if (selection) for (let i = 0; i < selection.rangeCount; i++) ranges.push(selection.getRangeAt(i).cloneRange());
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.readOnly = true;
    ta.tabIndex = -1;
    ta.setAttribute("aria-hidden", "true");
    ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;font-size:16px";
    try {
      document.body.append(ta);
      ta.focus({ preventScroll: true });
      ta.select();
      ta.setSelectionRange(0, text.length);
      return document.execCommand("copy") === true;
    } catch (e) {
      return false;
    } finally {
      ta.remove();
      try {
        if (active == null ? void 0 : active.isConnected) active.focus({ preventScroll: true });
        if (selection) {
          selection.removeAllRanges();
          ranges.forEach((range) => selection.addRange(range));
        }
      } catch (e) {
      }
    }
  }
  function enhanceSourceComponents() {
    $$('.doc-body input[type="checkbox"]').forEach((input) => {
      input.disabled = true;
      const item = input.closest("li");
      if (item) {
        item.classList.add("task-list-item");
        const list = item.parentElement;
        if (list == null ? void 0 : list.matches("ul,ol")) list.classList.add("contains-task-list");
      }
    });
    $$(".doc-body .starlight-aside").forEach((aside) => {
      const kind = ["note", "tip", "caution", "danger"].find((value) => aside.classList.contains("starlight-aside--" + value));
      const title = $(".starlight-aside__title", aside);
      if (!kind || !title || $(".official-icon", title)) return;
      const icon = officialIcon("aside-" + kind, "aside-icon");
      if (!icon) return;
      const empty = $("svg.starlight-aside__icon", title);
      if (empty) empty.outerHTML = icon;
      else title.insertAdjacentHTML("afterbegin", icon);
    });
    $$(".doc-body .source-link-card").forEach((card) => {
      if (card.closest(".source-link-shell")) return;
      const shell = document.createElement("div");
      shell.className = "source-link-shell";
      const fragment = card.closest(".source-fragment"), host = fragment && fragment.childElementCount === 1 && fragment.firstElementChild === card ? fragment : card;
      host.before(shell);
      shell.append(host);
      shell.insertAdjacentHTML("beforeend", officialIcon("arrow-right", "link-card-icon"));
    });
    $$(".doc-body h2,.doc-body h3,.doc-body h4,.doc-body h5,.doc-body h6").forEach((heading) => {
      var _a2;
      if (heading.closest("a,.source-heading,.source-link-card,.starlight-aside,.official-card-title")) return;
      const anchor = heading.dataset.sourceAnchor || heading.id || ((_a2 = heading.closest(".doc-block")) == null ? void 0 : _a2.id);
      if (!anchor) return;
      const fragment = heading.closest(".source-fragment"), host = fragment && fragment.childElementCount === 1 && fragment.firstElementChild === heading ? fragment : heading;
      const shell = document.createElement("div");
      shell.className = "source-heading level-" + heading.tagName.toLowerCase();
      const jump = document.createElement("a");
      jump.className = "source-anchor-link";
      jump.href = link(state.route, anchor);
      jump.dataset.sourceUi = "true";
      jump.setAttribute("aria-label", (state.mode === "en" ? "Link to section: " : "\u94FE\u63A5\u5230\u6B64\u8282\uFF1A") + heading.textContent.trim());
      jump.innerHTML = officialIcon("heading-anchor");
      host.before(shell);
      shell.append(host, jump);
    });
  }
  const reviewedImageAlts = Object.freeze([
    {
      "pageId": "9144e01529752bdc",
      "src": "assets/original/_astro/generate-serializer-code-fix.BrBLQAWQ_Z1ilxaJ.webp",
      "originalAlt": "An animated image of the available code fix being suggested and applied on the GenerateSerializerAttribute when the containing type doesn't contain IdAttribute's on its members.",
      "zh": "\u5DF2\u6807\u6CE8 GenerateSerializerAttribute \u7684\u7C7B\u578B\u672A\u5728\u5176\u6210\u5458\u4E0A\u6807\u6CE8 IdAttribute \u65F6\uFF0C\u7F16\u8F91\u5668\u5EFA\u8BAE\u5E76\u5E94\u7528\u53EF\u7528\u4EE3\u7801\u4FEE\u590D\u7684\u52A8\u56FE\u3002"
    },
    {
      "pageId": "1d3e2f583aa4b05f",
      "src": "assets/original/_astro/heterogeneous.C0meRUB5_V6RbB.webp",
      "originalAlt": "A cluster whose silos support different grain type sets.",
      "zh": "\u4E00\u4E2A\u96C6\u7FA4\uFF0C\u5176\u4E2D\u5404\u4E2A Silo \u652F\u6301\u7684 Grain \u7C7B\u578B\u96C6\u5408\u4E0D\u540C\u3002"
    },
    {
      "pageId": "382b25bad3cd2b5e",
      "src": "assets/original/_astro/grain-formulation.CtOzAqNu_Z1FvyYE.svg",
      "originalAlt": "A grain is composed of a stable identity, behavior, and state.",
      "zh": "Grain \u7531\u7A33\u5B9A\u7684\u6807\u8BC6\u3001\u884C\u4E3A\u548C\u72B6\u6001\u7EC4\u6210\u3002"
    },
    {
      "pageId": "382b25bad3cd2b5e",
      "src": "assets/original/_astro/cluster-silo-grain-relationship.BADVHeJX_OrNGc.svg",
      "originalAlt": "A cluster has one or more silos, and each silo hosts grain activations.",
      "zh": "\u96C6\u7FA4\u5305\u542B\u4E00\u4E2A\u6216\u591A\u4E2A Silo\uFF0C\u6BCF\u4E2A Silo \u6258\u7BA1 Grain \u6FC0\u6D3B\u5B9E\u4F8B\u3002"
    },
    {
      "pageId": "a48e234bd6ae9dd9",
      "src": "assets/original/_astro/web-application.mdTGpSsm_Z1r4fB0.webp",
      "originalAlt": "Screenshot of the running URL shortener web application.",
      "zh": "\u6B63\u5728\u8FD0\u884C\u7684 URL \u7F29\u77ED Web \u5E94\u7528\u7A0B\u5E8F\u7684\u5C4F\u5E55\u622A\u56FE\u3002"
    },
    {
      "pageId": "a48e234bd6ae9dd9",
      "src": "assets/original/_astro/storage-table-entities.DAOG8iOS_1vuzP0.webp",
      "originalAlt": "A screenshot showing Orleans data in Azure Table Storage.",
      "zh": "\u663E\u793A Azure \u8868\u5B58\u50A8\u4E2D Orleans \u6570\u636E\u7684\u5C4F\u5E55\u622A\u56FE\u3002"
    }
  ]);
  function applyReviewedImageAlt(img) {
    var _a2;
    const language = ((_a2 = img.closest(".block-content[lang]")) == null ? void 0 : _a2.getAttribute("lang")) || "";
    if (!/^zh(?:-|$)/i.test(language)) return;
    const match = reviewedImageAlts.find((item) => {
      var _a3;
      return item.pageId === ((_a3 = state.page) == null ? void 0 : _a3.id) && item.src === img.getAttribute("src") && item.originalAlt === img.getAttribute("alt");
    });
    if (match) img.setAttribute("alt", match.zh);
  }
  const sourceLightboxImages = /* @__PURE__ */ new Map([
    ["9144e01529752bdc", /* @__PURE__ */ new Set(["generate-serializer-code-fix.BrBLQAWQ_Z1ilxaJ.webp"])],
    ["382b25bad3cd2b5e", /* @__PURE__ */ new Set(["grain-formulation.CtOzAqNu_Z1FvyYE.svg", "cluster-silo-grain-relationship.BADVHeJX_OrNGc.svg"])]
  ]);
  function hasSourceLightbox(img) {
    var _a2, _b;
    return ((_b = sourceLightboxImages.get((_a2 = state.page) == null ? void 0 : _a2.id)) == null ? void 0 : _b.has((img.getAttribute("src") || "").split(/[?#]/)[0].split("/").pop())) || false;
  }
  let imageDialog;
  function showSourceImage(img) {
    if (!imageDialog) {
      imageDialog = document.createElement("dialog");
      imageDialog.className = "source-image-dialog";
      imageDialog.setAttribute("aria-label", "\u67E5\u770B\u539F\u5C3A\u5BF8\u56FE\u7247");
      const close = document.createElement("button");
      close.type = "button";
      close.className = "source-image-close";
      close.textContent = "\u5173\u95ED";
      close.onclick = () => imageDialog.close();
      const preview2 = document.createElement("img");
      preview2.className = "source-image-preview";
      imageDialog.append(close, preview2);
      document.body.append(imageDialog);
      imageDialog.addEventListener("click", (event) => {
        if (event.target === imageDialog) imageDialog.close();
      });
      imageDialog.addEventListener("close", () => {
        preview2.removeAttribute("src");
        preview2.alt = "";
      });
    }
    const preview = $("img", imageDialog);
    preview.src = img.currentSrc || img.src;
    preview.alt = img.alt;
    $(".source-image-close", imageDialog).textContent = state.mode === "en" ? "Close" : "\u5173\u95ED";
    imageDialog.setAttribute("aria-label", state.mode === "en" ? "View full-size image" : "\u67E5\u770B\u539F\u5C3A\u5BF8\u56FE\u7247");
    imageDialog.showModal();
  }
  function enhanceContent() {
    $$(".doc-block [id]").forEach((el) => {
      el.dataset.sourceAnchor = el.id;
      el.removeAttribute("id");
    });
    enhanceSourceComponents();
    $$(".doc-body table").forEach((table) => {
      if (table.parentElement.classList.contains("table-wrap")) return;
      const wrap = document.createElement("div");
      wrap.className = "table-wrap";
      wrap.tabIndex = 0;
      wrap.setAttribute("role", "region");
      wrap.setAttribute("aria-label", "\u53EF\u6A2A\u5411\u6EDA\u52A8\u7684\u8868\u683C");
      table.before(wrap);
      wrap.append(table);
    });
    $$(".doc-body pre").forEach((pre) => {
      var _a2, _b, _c;
      if (pre.closest(".code-shell")) return;
      const shell = document.createElement("div");
      shell.className = "code-shell";
      const fragment = pre.closest(".source-fragment"), host = fragment && fragment.childElementCount === 1 && fragment.firstElementChild === pre ? fragment : pre;
      host.before(shell);
      shell.append(host);
      const lang = ((_c = (_b = (_a2 = $("code", pre)) == null ? void 0 : _a2.className) == null ? void 0 : _b.match(/language-([\w-]+)/)) == null ? void 0 : _c[1]) || pre.dataset.language || "CODE";
      const label = document.createElement("span");
      label.className = "code-label";
      label.textContent = lang.toUpperCase();
      shell.prepend(label);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "copy-code";
      b.textContent = "\u590D\u5236";
      b.setAttribute("aria-label", "\u590D\u5236\u4EE3\u7801");
      b.onclick = async () => {
        var _a3;
        const t = ((_a3 = $("code", pre)) == null ? void 0 : _a3.textContent) || pre.textContent;
        if (await copyText(t)) {
          b.textContent = "\u5DF2\u590D\u5236";
          setTimeout(() => b.textContent = "\u590D\u5236", 1600);
        } else toast("\u81EA\u52A8\u590D\u5236\u672A\u6210\u529F\uFF0C\u8BF7\u9009\u4E2D\u4EE3\u7801\u540E\u590D\u5236\u3002");
      };
      shell.append(b);
    });
    $$(".doc-body img").forEach((img) => {
      applyReviewedImageAlt(img);
      img.loading = img.classList.contains("official-logo") ? "eager" : "lazy";
      img.decoding = "async";
      img.addEventListener("error", () => {
        img.alt = "\u56FE\u7247\u672A\u80FD\u52A0\u8F7D\uFF1A" + (img.alt || img.src);
      }, { once: true });
      if (hasSourceLightbox(img) && !img.closest("a") && !img.classList.contains("source-image-zoom")) {
        img.classList.add("source-image-zoom");
        img.tabIndex = 0;
        img.setAttribute("role", "button");
        img.setAttribute("aria-label", (state.mode === "en" ? "View image: " : "\u67E5\u770B\u539F\u5C3A\u5BF8\u56FE\u7247\uFF1A") + (img.alt || ""));
        img.onclick = () => showSourceImage(img);
        img.onkeydown = (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            showSourceImage(img);
          }
        };
      }
    });
    $$(".doc-body a[href]").forEach((a) => {
      const h = a.getAttribute("href");
      if (h.startsWith("#") && !h.startsWith("#/")) a.href = link(state.route, h.slice(1));
      else if (/^https?:\/\/dotnet\.github\.io\/orleans\//.test(h)) {
        try {
          const u = new URL(h), p = canonical(u.pathname);
          if (state.byPath.has(p)) a.href = link(p, u.hash.slice(1));
        } catch (e) {
        }
      }
      if (/^https?:/.test(a.getAttribute("href"))) {
        a.target = "_blank";
        a.rel = "noopener noreferrer";
      }
    });
    if (state.route === "/samples/") enhanceSamples();
    renderDiagrams();
  }
  function enhanceSamples() {
    const article = $(".doc-body");
    article.classList.add("samples-gallery");
    const lists = $$(".doc-block ul", article).filter((list) => $("li > a > img", list));
    const inputs = $$('input[type="search"]', article);
    const primary = lists[0] ? [...lists[0].children] : [];
    const pairs = primary.map((_, i) => lists.map((list) => list.children[i]).filter(Boolean));
    pairs.forEach((cards) => cards.forEach((card) => {
      var _a2;
      const anchor = $("a", card), img = $("img", card);
      if (!anchor || !img) return;
      anchor.classList.add("sample-card");
      if (!$(".sample-card-body", anchor)) {
        const body = document.createElement("div");
        body.className = "sample-card-body";
        while (img.nextSibling) body.append(img.nextSibling);
        anchor.append(body);
      }
      restoreSampleCardTail($(".sample-card-body", anchor), anchor.getAttribute("href"));
      if (/(?:^|\/)favicon\.svg(?:[?#]|$)/.test(img.getAttribute("src") || "")) {
        if (!img.parentElement.classList.contains("sample-card-placeholder")) {
          const placeholder = document.createElement("div");
          placeholder.className = "sample-card-placeholder";
          placeholder.setAttribute("aria-hidden", "true");
          img.before(placeholder);
          placeholder.append(img);
        }
        img.alt = "";
      } else {
        img.classList.add("sample-card-image");
        if (!img.alt) img.alt = ((_a2 = $("h2", card)) == null ? void 0 : _a2.textContent) || "\u793A\u4F8B\u9884\u89C8";
      }
    }));
    inputs.forEach((input, i) => {
      input.id = "samples-filter-" + i;
      input.setAttribute("aria-label", state.mode === "en" ? "Search samples" : "\u641C\u7D22\u793A\u4F8B");
      const form = input.closest("form"), label = $("label", form);
      if (label) label.htmlFor = input.id;
      form.addEventListener("submit", (event) => event.preventDefault());
      const count = document.createElement("span");
      count.className = "sample-count";
      count.setAttribute("aria-live", "polite");
      form.append(count);
      input.addEventListener("input", () => filter(input.value));
    });
    function filter(value) {
      const q = value.trim().toLowerCase();
      let visible = 0;
      pairs.forEach((cards) => {
        const show = !q || cards.some((card) => card.textContent.toLowerCase().includes(q));
        cards.forEach((card) => card.hidden = !show);
        if (show) visible++;
      });
      inputs.forEach((input) => {
        if (input.value !== value) input.value = value;
        $(".sample-count", input.closest("form")).textContent = state.mode === "en" ? "".concat(visible, " / ").concat(pairs.length, " samples") : "".concat(visible, " / ").concat(pairs.length, " \u4E2A\u793A\u4F8B");
      });
    }
    filter("");
  }
  function restoreSampleCardTail(body, href) {
    var _a2;
    if (!body || body.dataset.sourceTailRestored) return;
    const definition = (_a2 = window.OrleansSampleCardStructure) == null ? void 0 : _a2.find((card) => card.href === href);
    const description = $(":scope > p:last-of-type", body);
    if (!definition || !description) return;
    const nodes = [];
    for (let node = description.nextSibling; node; node = node.nextSibling) nodes.push(node);
    const isPlainTail = (node) => node.nodeType === 3 || node.nodeType === 1 && node.tagName === "SPAN" && [...node.childNodes].every((child) => child.nodeType === 3);
    if (!nodes.length || nodes.some((node) => !isPlainTail(node))) return;
    const original = nodes.map((node) => node.textContent).join(""), text = original.trim();
    const variant = definition.variants.find((value) => value.tail === text && [...value.chips, value.linkText].join(value.separator) === text);
    if (!variant) return;
    const fragment = document.createDocumentFragment(), chips = document.createElement("div");
    chips.className = "sample-card-chips";
    const separator = () => {
      const span = document.createElement("span");
      span.className = "sample-chip-separator";
      span.setAttribute("aria-hidden", "true");
      span.textContent = variant.separator;
      return span;
    };
    fragment.append(document.createTextNode(original.slice(0, original.indexOf(text))));
    variant.chips.forEach((label, index) => {
      if (index && variant.separator) chips.append(separator());
      const chip = document.createElement("span");
      chip.className = "sample-card-chip";
      chip.textContent = label;
      chips.append(chip);
    });
    fragment.append(chips);
    if (variant.separator) fragment.append(separator());
    const action = document.createElement("span");
    action.className = "sample-card-source";
    action.textContent = variant.linkText;
    fragment.append(action, document.createTextNode(original.slice(original.indexOf(text) + text.length)));
    if (fragment.textContent !== original) return;
    nodes.forEach((node) => node.remove());
    body.append(fragment);
    body.dataset.sourceTailRestored = "true";
  }
  let mermaidPromise, diagramQueue = Promise.resolve(), diagramNumber = 0;
  function loadMermaid() {
    var _a2, _b;
    if (typeof ((_a2 = window.OrleansMermaid) == null ? void 0 : _a2.initialize) === "function" && typeof ((_b = window.OrleansMermaid) == null ? void 0 : _b.render) === "function") return Promise.resolve(window.OrleansMermaid);
    if (mermaidPromise) return mermaidPromise;
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      let timer, settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        script.onload = null;
        script.onerror = null;
        script.remove();
        if (error) reject(error);
        else resolve(window.OrleansMermaid);
      };
      const failure = () => new Error("\u56FE\u8868\u811A\u672C\u65E0\u6CD5\u8F7D\u5165\u3002\u8BF7\u5B8C\u6574\u89E3\u538B\u6587\u6863\u5305\uFF0C\u5E76\u4FDD\u6301 assets/mermaid.bundle.js \u7684\u76F8\u5BF9\u4F4D\u7F6E\u3002");
      script.async = true;
      script.src = new URL("assets/mermaid.bundle.js", appBaseUrl).href;
      script.onload = () => {
        var _a3, _b2;
        return finish(typeof ((_a3 = window.OrleansMermaid) == null ? void 0 : _a3.initialize) === "function" && typeof ((_b2 = window.OrleansMermaid) == null ? void 0 : _b2.render) === "function" ? null : failure());
      };
      script.onerror = () => finish(failure());
      timer = setTimeout(() => finish(failure()), 3e4);
      try {
        document.head.append(script);
      } catch (e) {
        finish(failure());
      }
    });
    mermaidPromise = promise.catch((error) => {
      mermaidPromise = null;
      throw error;
    });
    return mermaidPromise;
  }
  function renderDiagrams() {
    const figures = $$(".doc-diagram");
    if (!figures.length) return;
    diagramQueue = diagramQueue.then(async () => {
      const [data, mermaid] = await Promise.all([loadData("diagrams.json"), loadMermaid()]);
      const dark = document.documentElement.dataset.theme === "dark";
      mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: dark ? "dark" : "default", fontFamily: 'system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif', flowchart: { htmlLabels: false, useMaxWidth: true }, sequence: { useMaxWidth: true, wrap: true } });
      for (const figure of figures) {
        if (!figure.isConnected) continue;
        const record = data[figure.dataset.diagramKey], language = figure.dataset.diagramLanguage, canvas = $(".diagram-canvas", figure);
        if (!record || !canvas) continue;
        try {
          const result = await mermaid.render("orleans-zh-diagram-" + ++diagramNumber, language === "zh" ? record.zh : record.source);
          if (!figure.isConnected) continue;
          canvas.innerHTML = result.svg;
          canvas.dataset.status = "rendered";
          canvas.setAttribute("aria-label", language === "zh" ? "\u5DF2\u8BD1\u5BA1\u7684\u4E2D\u6587\u56FE\u8868" : "\u539F\u6587\u56FE\u8868");
          if (!$("figcaption", figure)) {
            const caption = document.createElement("figcaption");
            const note = document.createElement("span");
            note.textContent = language === "zh" ? "\u4E2D\u6587\u6807\u7B7E \xB7 \u7ED3\u6784\u4E0E\u539F\u56FE\u5BF9\u5E94" : "Original diagram";
            const button = document.createElement("button");
            button.type = "button";
            button.className = "diagram-expand";
            button.textContent = language === "zh" ? "\u653E\u5927\u67E5\u770B" : "Expand";
            button.onclick = () => openDiagram(canvas, language === "zh" ? "\u4E2D\u6587\u56FE\u8868" : "Original diagram");
            caption.append(note, button);
            canvas.after(caption);
          }
        } catch (error) {
          canvas.textContent = language === "zh" ? "\u56FE\u8868\u6682\u65F6\u65E0\u6CD5\u7ED8\u5236\uFF0C\u8BF7\u5C55\u5F00\u4E0B\u65B9\u539F\u59CB\u4EE3\u7801\u67E5\u770B\u3002" : "Unable to render this diagram. Original source is available below.";
          canvas.dataset.status = "error";
          console.error(error);
        }
      }
    }).catch((error) => {
      for (const f of figures) {
        const c = $(".diagram-canvas", f);
        if (c) {
          c.textContent = "\u56FE\u8868\u8D44\u6E90\u6682\u65F6\u65E0\u6CD5\u8F7D\u5165\u3002\u8BF7\u5B8C\u6574\u89E3\u538B\u6587\u6863\u5305\uFF0C\u5E76\u4FDD\u6301 data \u548C assets \u7684\u76F8\u5BF9\u4F4D\u7F6E\uFF1B\u4E5F\u53EF\u67E5\u770B\u4E0B\u65B9\u539F\u59CB\u4EE3\u7801\u3002";
          c.dataset.status = "error";
        }
      }
      console.error(error);
    });
  }
  function openDiagram(canvas, title) {
    var _a2, _b;
    const svg = $("svg", canvas);
    if (!svg) return;
    const previousStyle = svg.getAttribute("style");
    const naturalWidth = ((_b = (_a2 = svg.viewBox) == null ? void 0 : _a2.baseVal) == null ? void 0 : _b.width) || svg.getBoundingClientRect().width;
    svg.style.width = "".concat(Math.max(240, naturalWidth * 1.25), "px");
    const dialog = document.createElement("dialog");
    dialog.className = "diagram-dialog";
    dialog.setAttribute("aria-label", title);
    const header = document.createElement("div");
    header.className = "diagram-dialog-header";
    const strong = document.createElement("strong");
    strong.textContent = title;
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "\u5173\u95ED";
    close.onclick = () => dialog.close();
    header.append(strong, close);
    const viewport = document.createElement("div");
    viewport.className = "diagram-viewport";
    viewport.append(svg);
    dialog.append(header, viewport);
    document.body.append(dialog);
    dialog.addEventListener("close", () => {
      if (previousStyle === null) svg.removeAttribute("style");
      else svg.setAttribute("style", previousStyle);
      canvas.append(svg);
      dialog.remove();
    }, { once: true });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.showModal();
  }
  function observeSections() {
    if (state.observer) state.observer.disconnect();
    if (!("IntersectionObserver" in window)) return;
    state.observer = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          const target = link(state.route, e.target.id);
          $$("#toc a").forEach((a) => a.classList.toggle("active", a.getAttribute("href") === target));
          break;
        }
      }
    }, { rootMargin: "-90px 0px -65% 0px", threshold: 0 });
    $$(".doc-block").filter((el) => $("h1,h2,h3", el)).forEach((el) => state.observer.observe(el));
  }
  function scrollAnchor(anchor) {
    if (!anchor) {
      window.scrollTo({ top: 0, behavior: "instant" });
      return;
    }
    requestAnimationFrame(() => {
      let el = document.getElementById(anchor);
      if (!el) el = $$("[id]").find((x) => x.id.toLowerCase() === anchor.toLowerCase());
      if (!el) el = $$("[data-source-anchor]").find((x) => x.dataset.sourceAnchor === anchor);
      el == null ? void 0 : el.scrollIntoView({ block: "start" });
    });
  }
  async function navigate() {
    if (!state.catalog) return;
    const { path, anchor } = parseHash();
    closeMenu();
    if (path === state.route && state.rendered) {
      scrollAnchor(anchor);
      return;
    }
    const revealNavGroup = navHasNavigated && navGroupForPath(path) !== navGroupForPath(state.route);
    navHasNavigated = true;
    state.route = path;
    state.rendered = false;
    state.page = null;
    document.body.classList.toggle("landing-page", isHomepagePath(path));
    updateNavActive(revealNavGroup);
    const id = ++state.loadId;
    if (state.observer) state.observer.disconnect();
    if (path === "/__overview/") renderOverview();
    else if (path === "/__glossary/") renderGlossary();
    else if (path === "/__audit/") renderAudit();
    else if (path === "/__all/") renderIndex();
    else {
      const p = isHomepagePath(path) ? state.byPath.get("/original-home/") || state.byId.get("bfa8f21cc2984261") : state.byPath.get(path) || state.byId.get(path.slice(1, -1));
      if (!p) {
        $("#content").innerHTML = '<div class="error-state"><div class="home-eyebrow">\u9875\u9762\u672A\u6536\u5F55</div><h1>\u6CA1\u6709\u627E\u5230\u8FD9\u7BC7\u6587\u6863</h1><p>\u5F53\u524D\u5FEB\u7167\u4E2D\u6CA1\u6709\u8DEF\u5F84 <code>'.concat(esc(path), '</code>\u3002\u53EF\u901A\u8FC7\u641C\u7D22\u6216\u5168\u7AD9\u7D22\u5F15\u5B9A\u4F4D\u5BF9\u5E94\u9875\u9762\u3002</p><a class="button-primary" href="#/__all/">\u6D4F\u89C8\u5168\u7AD9\u9875\u9762\u7D22\u5F15</a></div>');
        setToc([]);
      } else {
        $("#content").innerHTML = '<div class="initial-loading"><span class="loading-spinner"></span><p>\u6B63\u5728\u8F7D\u5165\u6587\u6863\u2026</p></div>';
        setToc([]);
        try {
          const data = await getPageData(p);
          if (id !== state.loadId) return;
          if (isHomepagePath(path)) renderHome(data);
          else renderDocument(data);
        } catch (e) {
          if (id !== state.loadId) return;
          $("#content").innerHTML = '<div class="error-state"><h1>\u8FD9\u7BC7\u6587\u6863\u6682\u65F6\u65E0\u6CD5\u8F7D\u5165</h1><p>'.concat(esc(e.message), '</p><p>\u8BF7\u786E\u8BA4\u6587\u6863\u5305\u5DF2\u5B8C\u6574\u89E3\u538B\uFF0C\u5E76\u4FDD\u6301 index.html\u3001data \u548C assets \u7684\u76F8\u5BF9\u4F4D\u7F6E\u540E\u91CD\u8BD5\u3002</p><button class="button-secondary" id="reload-page" type="button">\u91CD\u8BD5</button> <a class="button-secondary" href="').concat(esc(p.sourceUrl || (p.path === "/original-home/" ? "https://dotnet.github.io/orleans/" : "https://dotnet.github.io/orleans" + p.path)), '" target="_blank" rel="noopener noreferrer">\u82F1\u6587\u539F\u6587</a></div>');
          $("#reload-page").onclick = () => {
            state.rendered = false;
            navigate();
          };
        }
      }
    }
    state.rendered = true;
    scrollAnchor(anchor);
  }
  function openSearch() {
    const d = $("#search-dialog");
    if (!d.open) d.showModal();
    $("#search-input").focus();
    runSearch($("#search-input").value);
  }
  function highlight(text, query) {
    if (!query) return esc(text);
    const i = String(text).toLowerCase().indexOf(query.toLowerCase());
    return i < 0 ? esc(text) : esc(text.slice(0, i)) + "<mark>" + esc(text.slice(i, i + query.length)) + "</mark>" + esc(text.slice(i + query.length));
  }
  async function maybeSearchIndex() {
    var _a2, _b;
    if (state.searchIndex || state.searchLoading || !((_b = (_a2 = state.catalog) == null ? void 0 : _a2.meta) == null ? void 0 : _b.searchIndex)) return;
    state.searchLoading = true;
    try {
      state.searchIndex = await loadData(state.catalog.meta.searchIndex);
      if ($("#search-input").value) runSearch($("#search-input").value);
    } catch (e) {
      $("#search-meta").textContent += " \xB7 \u6B63\u6587\u7D22\u5F15\u672A\u8F7D\u5165\uFF0C\u5F53\u524D\u641C\u7D22\u6807\u9898\u4E0E\u8DEF\u5F84\u3002\u8BF7\u5B8C\u6574\u89E3\u538B\u6587\u6863\u5305\u5E76\u4FDD\u6301 data \u76EE\u5F55\u7684\u4F4D\u7F6E\u3002";
    } finally {
      state.searchLoading = false;
    }
  }
  function runSearch(raw) {
    if (!state.catalog) return;
    const q = raw.trim().toLowerCase();
    let hits = [];
    if (!q) {
      hits = state.pages.filter((p) => !isApi(p)).slice(0, 8).map((p) => ({ page: p, score: 0 }));
      $("#search-meta").textContent = "\u5E38\u7528\u6587\u6863 \xB7 \u8F93\u5165\u4E2D\u6587\u3001\u82F1\u6587\u6216 API \u6807\u8BC6\u7B26\u641C\u7D22";
    } else {
      const terms = q.split(/\s+/).filter(Boolean);
      for (const p of state.pages) {
        if (!terms.every((t) => p.searchText.includes(t))) continue;
        const zh = (p.titleZh || "").toLowerCase(), en = (p.title || "").toLowerCase();
        const score = (zh === q || en === q ? 100 : 0) + (zh.startsWith(q) || en.startsWith(q) ? 50 : 0) + (zh.includes(q) ? 25 : 0) + (en.includes(q) ? 20 : 0) + (!isApi(p) ? 5 : 0);
        hits.push({ page: p, score });
      }
      if (state.searchIndex && hits.length < 50) {
        const used = new Set(hits.map((x) => x.page.id));
        const entries = Array.isArray(state.searchIndex) ? state.searchIndex : Object.entries(state.searchIndex).map(([id, text]) => ({ id, text }));
        for (const s of entries) {
          if (used.has(s.id)) continue;
          const text = String(s.text || s.content || s.zh || "").toLowerCase();
          if (terms.every((t) => text.includes(t))) {
            const page = state.byId.get(s.id);
            if (page) hits.push({ page, score: 1 });
          }
        }
      }
      hits.sort((a, b) => b.score - a.score);
      $("#search-meta").textContent = "\u627E\u5230 ".concat(nf.format(hits.length), " \u4E2A\u5339\u914D\u7ED3\u679C").concat(hits.length > 70 ? " \xB7 \u663E\u793A\u524D 70 \u4E2A\uFF0C\u8BF7\u6DFB\u52A0\u5173\u952E\u8BCD\u7F29\u5C0F\u8303\u56F4" : "");
      maybeSearchIndex();
    }
    state.searchResults = hits.slice(0, 70).map((x) => x.page);
    state.searchSelected = 0;
    $("#search-results").innerHTML = state.searchResults.map((p, i) => '<a class="search-result'.concat(i === 0 ? " selected" : "", '" href="').concat(esc(link(p.path)), '" role="option" aria-selected="').concat(i === 0, '" data-result="').concat(i, '"><span class="result-kind">').concat(isApi(p) ? "API" : "DOC", '</span><span class="result-main"><strong>').concat(highlight(p.titleZh || p.title || p.path, q), "</strong><small>").concat(highlight(p.titleZh && p.titleZh !== p.title ? p.title : p.path, q), "</small></span></a>")).join("") || '<div class="search-empty">\u6CA1\u6709\u627E\u5230\u5339\u914D\u5185\u5BB9\u3002\u53EF\u4EE5\u5C1D\u8BD5\u82F1\u6587\u7C7B\u540D\u3001\u65B9\u6CD5\u540D\uFF0C\u6216\u7B80\u77ED\u7684\u4E2D\u6587\u6982\u5FF5\u3002</div>';
    $$(".search-result").forEach((a) => a.onclick = () => $("#search-dialog").close());
  }
  function selectResult(delta) {
    const n = state.searchResults.length;
    if (!n) return;
    state.searchSelected = (state.searchSelected + delta + n) % n;
    $$(".search-result").forEach((a, i) => {
      const on = i === state.searchSelected;
      a.classList.toggle("selected", on);
      a.setAttribute("aria-selected", String(on));
      if (on) a.scrollIntoView({ block: "nearest" });
    });
  }
  function bindThemePicker() {
    const root = document.documentElement, pickers = $$("select[data-theme-picker]");
    const normalize = (value) => ["auto", "dark", "light"].includes(value) ? value : "auto";
    let preference = normalize(storage.get("orleans-theme")), media;
    try {
      media = window.matchMedia("(prefers-color-scheme: dark)");
    } catch (e) {
      media = { matches: false };
    }
    const apply = (value, persist = false) => {
      preference = normalize(value);
      const effective = preference === "auto" ? media.matches ? "dark" : "light" : preference;
      const changed = root.dataset.theme !== effective;
      root.dataset.themePreference = preference;
      root.dataset.theme = effective;
      root.style.colorScheme = effective;
      pickers.forEach((picker) => picker.value = preference);
      if (persist) storage.set("orleans-theme", preference);
      if (changed) renderDiagrams();
    };
    apply(preference);
    pickers.forEach((picker) => picker.addEventListener("change", (event) => apply(event.currentTarget.value, true)));
    const systemChanged = () => {
      if (preference === "auto") apply("auto");
    };
    if (media.addEventListener) media.addEventListener("change", systemChanged);
    else if (media.addListener) media.addListener(systemChanged);
    window.addEventListener("storage", (event) => {
      if (event.key !== "orleans-theme" && event.key !== null) return;
      if (event.storageArea) {
        try {
          if (event.storageArea !== window.localStorage) return;
        } catch (e) {
          return;
        }
      }
      apply(event.key === null ? "auto" : event.newValue);
    });
  }
  function bindUi() {
    $(".skip-link").onclick = (e) => {
      e.preventDefault();
      $("#main").focus();
      $("#main").scrollIntoView({ block: "start" });
    };
    bindThemePicker();
    $("#search-open").onclick = openSearch;
    $("#search-input").addEventListener("input", (e) => {
      clearTimeout(runSearch.timer);
      runSearch.timer = setTimeout(() => runSearch(e.target.value), 100);
    });
    $("#search-input").addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectResult(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        selectResult(-1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const p = state.searchResults[state.searchSelected];
        if (p) {
          $("#search-dialog").close();
          location.hash = link(p.path).slice(1);
        }
      }
    });
    $("#search-dialog").addEventListener("click", (e) => {
      if (e.target === $("#search-dialog")) {
        const r = e.target.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.target.close();
      }
    });
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openSearch();
      }
      if (e.key === "Escape") closeMenu();
    });
    $("#menu-toggle").onclick = () => {
      const on = !document.body.classList.contains("nav-open");
      document.body.classList.toggle("nav-open", on);
      $("#mobile-overlay").hidden = !on;
      $("#menu-toggle").setAttribute("aria-expanded", String(on));
    };
    $("#mobile-overlay").onclick = closeMenu;
    $("#collapse-nav").onclick = () => {
      $$(".nav-group", $("#navigation")).forEach((group) => group.open = false);
      saveNavExpansion();
    };
    $("#back-top").onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });
    window.addEventListener("scroll", () => {
      $("#back-top").hidden = window.scrollY < 650;
    }, { passive: true });
    window.addEventListener("hashchange", navigate);
  }
  async function init() {
    try {
      bindUi();
      document.body.classList.toggle("landing-page", isHomepagePath(parseHash().path));
      state.catalog = await loadData("catalog.json");
      updateVersionHeader();
      state.pages = (state.catalog.pages || []).map((p) => {
        var _a2;
        return { ...p, id: String((_a2 = p.id) != null ? _a2 : p.path), path: canonical(p.path || p.id), searchText: [p.title, p.titleZh, p.path, p.keywords, canonical(p.path || p.id) === "/original-home/" ? "\u5B98\u7F51\u9996\u9875 \u539F\u5B98\u7F51\u9996\u9875 \u9996\u9875 homepage landing" : ""].filter(Boolean).join(" ").toLowerCase() };
      });
      for (const p of state.pages) {
        state.byPath.set(p.path, p);
        state.byId.set(p.id, p);
      }
      const groups = state.catalog.groups || [];
      if (Array.isArray(groups)) groups.forEach((g) => state.groups.set(g.id, g));
      else Object.entries(groups).forEach(([k, v]) => state.groups.set(k, v));
      renderNav();
      await navigate();
    } catch (e) {
      $("#content").innerHTML = '<div class="error-state"><div class="home-eyebrow">ORLEANS \u4E2D\u6587\u6587\u6863</div><h1>\u6587\u6863\u5185\u5BB9\u6682\u65F6\u65E0\u6CD5\u8F7D\u5165</h1><p>'.concat(esc(e.message), '</p><p>\u8BF7\u5B8C\u6574\u89E3\u538B\u6587\u6863\u5305\uFF0C\u5E76\u4FDD\u6301 index.html\u3001data-loader.js\u3001data \u548C assets \u7684\u76F8\u5BF9\u4F4D\u7F6E\uFF0C\u7136\u540E\u91CD\u65B0\u6253\u5F00 index.html\u3002</p><button class="button-primary" type="button" id="reload-app">\u91CD\u65B0\u8F7D\u5165</button></div>');
      $("#reload-app").onclick = () => location.reload();
      $("#navigation").innerHTML = '<p class="muted loading-label">\u76EE\u5F55\u5C1A\u672A\u8F7D\u5165\u3002</p>';
    }
  }
  window.OrleansAppStarted = true;
  init();
})();
