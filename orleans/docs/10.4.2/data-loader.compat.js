"use strict";
(() => {
  var _a;
  const baseUrl = new URL(".", ((_a = document.currentScript) == null ? void 0 : _a.src) || document.baseURI);
  const permanentCache = /* @__PURE__ */ new Map();
  const contentCache = /* @__PURE__ */ new Map();
  const pending = /* @__PURE__ */ new Map();
  const scriptRequests = /* @__PURE__ */ new WeakMap();
  const contentLimit = 12;
  const timeoutMs = 3e4;
  const validKey = (key) => typeof key === "string" && /^(?:(?:catalog|search|diagrams)\.json|content\/[A-Za-z0-9_-]+\.json)$/.test(key);
  const cacheFor = (key) => key.startsWith("content/") ? contentCache : permanentCache;
  const filePath = (key) => "data/" + key.slice(0, -5) + ".js";
  const failure = (key, reason) => new Error("".concat(reason, "\uFF08").concat(filePath(key), "\uFF09\u3002\u8BF7\u5B8C\u6574\u89E3\u538B\u6587\u6863\u5305\uFF0C\u5E76\u4FDD\u6301 index.html\u3001data \u548C assets \u7684\u76F8\u5BF9\u4F4D\u7F6E\u3002"));
  function remember(key, value) {
    const cache = cacheFor(key);
    cache.delete(key);
    cache.set(key, value);
    if (cache === contentCache && cache.size > contentLimit) {
      cache.delete(cache.keys().next().value);
    }
  }
  function finish(request, error) {
    if (request.settled) return;
    request.settled = true;
    clearTimeout(request.timer);
    request.script.onload = null;
    request.script.onerror = null;
    request.script.remove();
    if (pending.get(request.key) === request) pending.delete(request.key);
    if (error) {
      request.reject(error);
    } else {
      remember(request.key, request.value);
      request.resolve(request.value);
    }
    request.value = void 0;
  }
  function register(key, value) {
    const source = document.currentScript;
    const request = source ? scriptRequests.get(source) : null;
    if (request == null ? void 0 : request.settled) return;
    if (!validKey(key) || value === null || typeof value !== "object") {
      const error = new Error("\u6587\u6863\u6570\u636E\u7684\u540D\u79F0\u6216\u5185\u5BB9\u65E0\u6548\uFF0C\u8BF7\u5B8C\u6574\u89E3\u538B\u6587\u6863\u5305\u5E76\u4FDD\u6301\u6587\u4EF6\u4F4D\u7F6E\u3002");
      if (request) finish(request, error);
      else throw error;
      return;
    }
    if (request && request.key !== key) {
      finish(request, failure(request.key, "\u6570\u636E\u6587\u4EF6\u6CE8\u518C\u7684\u540D\u79F0\u4E0D\u5339\u914D"));
      return;
    }
    const active = pending.get(key);
    if (active) {
      if (source && source !== active.script) return;
      active.value = value;
      active.registered = true;
    } else {
      remember(key, value);
    }
  }
  function load(key) {
    if (!validKey(key)) return Promise.reject(new Error("\u6587\u6863\u6570\u636E\u8DEF\u5F84\u65E0\u6548\uFF0C\u8BF7\u4F7F\u7528\u6587\u6863\u5305\u4E2D\u4FDD\u7559\u7684\u76F8\u5BF9\u6587\u4EF6\u4F4D\u7F6E\u3002"));
    const cache = cacheFor(key);
    if (cache.has(key)) {
      const value = cache.get(key);
      remember(key, value);
      return Promise.resolve(value);
    }
    if (pending.has(key)) return pending.get(key).promise;
    let resolve, reject;
    const promise = new Promise((yes, no) => {
      resolve = yes;
      reject = no;
    });
    const script = document.createElement("script");
    const request = { key, script, promise, resolve, reject, registered: false, settled: false, value: void 0, timer: null };
    pending.set(key, request);
    scriptRequests.set(script, request);
    script.async = true;
    script.src = new URL(filePath(key), baseUrl).href;
    script.onload = () => finish(request, request.registered ? null : failure(key, "\u6570\u636E\u6587\u4EF6\u672A\u63D0\u4F9B\u6240\u9700\u5185\u5BB9"));
    script.onerror = () => finish(request, failure(key, "\u6570\u636E\u6587\u4EF6\u65E0\u6CD5\u8F7D\u5165"));
    request.timer = setTimeout(() => finish(request, failure(key, "\u6570\u636E\u6587\u4EF6\u8F7D\u5165\u8D85\u65F6")), timeoutMs);
    try {
      (document.head || document.documentElement).append(script);
    } catch (e) {
      finish(request, failure(key, "\u6570\u636E\u6587\u4EF6\u65E0\u6CD5\u8F7D\u5165"));
    }
    return promise;
  }
  window.OrleansData = Object.freeze({ load, register });
})();
