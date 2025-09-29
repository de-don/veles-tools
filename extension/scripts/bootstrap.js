(() => {
  const GLOBAL_FLAG = '__velesMultiBacktestsInitialized';
  if (window[GLOBAL_FLAG]) {
    window.__velesMultiBacktestsSkip = true;
    console.info('[Veles multi backtests] уже инициализировано');
    return;
  }

  window[GLOBAL_FLAG] = true;
  window.__velesMultiBacktestsSkip = false;

  const namespace = window.velesMulti || {};
  window.velesMulti = namespace;

  namespace.shared = namespace.shared || {};

  console.info('[Veles multi backtests] bootstrap ready');
})();
