(() => {
  if (window.__velesMultiBacktestsSkip) {
    return;
  }

  const namespace = window.velesMulti || {};
  window.velesMulti = namespace;

  const initialize = () => {
    try {
      namespace.multiRunner?.init();
    } catch (error) {
      console.error('[Veles multi backtests] Failed to init multi-runner', error);
    }

    try {
      namespace.aggregator?.init();
    } catch (error) {
      console.error('[Veles multi backtests] Failed to init aggregator', error);
    }

    console.log('[Veles multi backtests] Version 1.1.0');
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
