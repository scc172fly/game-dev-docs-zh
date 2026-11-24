'use strict';
(() => {
  const baseUrl = new URL('.', document.currentScript?.src || document.baseURI);
  const permanentCache = new Map();
  const contentCache = new Map();
  const pending = new Map();
  const scriptRequests = new WeakMap();
  const contentLimit = 12;
  const timeoutMs = 30000;
  const validKey = key => typeof key === 'string' && /^(?:(?:catalog|search|diagrams)\.json|content\/[A-Za-z0-9_-]+\.json)$/.test(key);
  const cacheFor = key => key.startsWith('content/') ? contentCache : permanentCache;
  const filePath = key => 'data/' + key.slice(0, -5) + '.js';
  const failure = (key, reason) => new Error(`${reason}（${filePath(key)}）。请完整解压文档包，并保持 index.html、data 和 assets 的相对位置。`);

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
    request.value = undefined;
  }

  function register(key, value) {
    const source = document.currentScript;
    const request = source ? scriptRequests.get(source) : null;
    // Ignore a late registration from an attempt which already failed or timed out.
    if (request?.settled) return;
    if (!validKey(key) || value === null || typeof value !== 'object') {
      const error = new Error('文档数据的名称或内容无效，请完整解压文档包并保持文件位置。');
      if (request) finish(request, error);
      else throw error;
      return;
    }
    if (request && request.key !== key) {
      finish(request, failure(request.key, '数据文件注册的名称不匹配'));
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
    if (!validKey(key)) return Promise.reject(new Error('文档数据路径无效，请使用文档包中保留的相对文件位置。'));
    const cache = cacheFor(key);
    if (cache.has(key)) {
      const value = cache.get(key);
      remember(key, value);
      return Promise.resolve(value);
    }
    if (pending.has(key)) return pending.get(key).promise;

    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    const script = document.createElement('script');
    const request = { key, script, promise, resolve, reject, registered: false, settled: false, value: undefined, timer: null };
    pending.set(key, request);
    scriptRequests.set(script, request);
    script.async = true;
    script.src = new URL(filePath(key), baseUrl).href;
    script.onload = () => finish(request, request.registered ? null : failure(key, '数据文件未提供所需内容'));
    script.onerror = () => finish(request, failure(key, '数据文件无法载入'));
    request.timer = setTimeout(() => finish(request, failure(key, '数据文件载入超时')), timeoutMs);
    try {
      (document.head || document.documentElement).append(script);
    } catch {
      finish(request, failure(key, '数据文件无法载入'));
    }
    return promise;
  }

  window.OrleansData = Object.freeze({ load, register });
})();
