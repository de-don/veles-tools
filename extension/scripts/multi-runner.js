(() => {
  if (window.__velesMultiBacktestsSkip) {
    return;
  }

  const namespace = window.velesMulti || {};
  window.velesMulti = namespace;

  if (namespace.multiRunner) {
    return;
  }

  console.info('[Veles multi backtests] multi-runner module setup');

  const STORAGE_KEY = 'veles-multi-backtests-config';
  const DEFAULT_DELAY = 35;

  const state = {
    running: false,
    abort: false,
    total: 0,
    completed: 0,
  };

  const elements = {};
  const DEFAULT_MAKER_COMMISSION = '0.02';
  const DEFAULT_TAKER_COMMISSION = '0.055';
  let modalEnsureScheduled = false;

  const normalizeCommissionValue = (rawValue, fallback) => {
    const stringValue = `${rawValue ?? ''}`.trim();
    if (!stringValue) {
      return { ok: true, value: fallback };
    }

    const normalized = stringValue.replace(',', '.');
    const numeric = Number(normalized);

    if (!Number.isFinite(numeric) || numeric < 0) {
      return { ok: false, value: null };
    }

    return { ok: true, value: normalized };
  };

  const loadSavedConfig = () => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (error) {
      console.warn('[Veles multi backtests] Unable to parse saved config:', error);
      return null;
    }
  };

  const saveConfig = (config) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (error) {
      console.warn('[Veles multi backtests] Unable to save config:', error);
    }
  };

  const capturePanelElements = (panel) => ({
    panel,
    error: panel.querySelector('#veles-multi-error'),
    symbolsInput: panel.querySelector('#veles-multi-symbols'),
    delayInput: panel.querySelector('#veles-multi-delay'),
    progressWrapper: panel.querySelector('#veles-multi-progress'),
    progressBar: panel.querySelector('#veles-multi-progress-bar'),
    progressText: panel.querySelector('#veles-multi-progress-text'),
    log: panel.querySelector('#veles-multi-log'),
  });

  const assignPanelElements = (panel) => {
    const refs = capturePanelElements(panel);
    Object.assign(elements, refs);
  };

  const hydratePanelConfig = () => {
    if (!elements.panel) return;
    const saved = loadSavedConfig();
    if (!saved) return;

    if (Array.isArray(saved.symbols) && elements.symbolsInput) {
      elements.symbolsInput.value = saved.symbols.join('\n');
    }
    if (typeof saved.delay === 'number' && elements.delayInput) {
      elements.delayInput.value = saved.delay;
    }
  };

  const ensurePanelStructure = (popupBody) => {
    let panel = popupBody.querySelector('#veles-multi-backtests-panel');
    let isNew = false;

    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'veles-multi-backtests-panel';
      panel.innerHTML = `
        <div class="veles-multi-header">
          <h2>Мультизапуск бэктестов</h2>
          <p class="veles-multi-subtitle">Укажите список тикеров. Вторая валюта берётся из текущей стратегии.</p>
        </div>
        <div id="veles-multi-error" class="error" style="display:none"></div>
        <div class="veles-multi-field">
          <label for="veles-multi-symbols">Список тикеров (без второй валюты, например BTC), каждый с новой строки</label>
          <textarea id="veles-multi-symbols" placeholder="BTC\nETH\n..."></textarea>
        </div>
        <div class="veles-multi-field">
          <label for="veles-multi-delay">Пауза между запросами (секунды)</label>
          <input id="veles-multi-delay" type="number" min="5" step="1" value="${DEFAULT_DELAY}" />
        </div>
        <div id="veles-multi-progress">
          <div id="veles-multi-progress-text"></div>
          <progress id="veles-multi-progress-bar" max="100" value="0"></progress>
        </div>
        <div class="veles-multi-log-label">Лог мультизапуска</div>
        <div id="veles-multi-log"></div>
      `;

      popupBody.appendChild(panel);

      panel.style.display = 'none';
      panel.classList.remove('veles-multi-active');

      isNew = true;
    }

    assignPanelElements(panel);

    if (isNew || panel.dataset.velesMultiInitialized !== 'true') {
      hydratePanelConfig();

      panel.dataset.velesMultiInitialized = 'true';
    }

    return panel;
  };

  const findInputByTitle = (title) => {
    try {
      const titleElement = elements.popupBody?.querySelector(`p[title="${title}"]`);
      if (!titleElement) {
        return null;
      }
      if (titleElement.parentElement) {
        const candidate = titleElement.parentElement.querySelector('input');
        if (candidate) {
          return candidate;
        }
      }
      return null;
    } catch (error) {
      console.warn('[Veles multi backtests] Unable to locate input for title', title, error);
      return null;
    }
  };

  const resolveCommissionInputs = () => ({
    makerInput: findInputByTitle('Комиссия мейкера'),
    takerInput: findInputByTitle('Комиссия тейкера'),
  });

  const resolveWicksCheckbox = () => {
    try {
      const labels = elements.popupBody?.querySelectorAll('label.start-backtest-popup-checkbox');
      if (!labels) return null;
      for (let index = 0; index < labels.length; index += 1) {
        const label = labels[index];
        if (label?.textContent?.toLowerCase().includes('тени')) {
          const input = label.querySelector('input[type="checkbox"]');
          if (input) {
            return input;
          }
        }
      }
    } catch (error) {
      console.warn('[Veles multi backtests] Unable to resolve wicks checkbox', error);
    }
    return null;
  };

  const parseDateSegment = (segment) => {
    if (!segment) return null;
    const trimmed = segment.trim();
    const [datePart, timePart] = trimmed.split(/\s+/);
    if (!datePart || !timePart) return null;
    const [day, month, yearShort] = datePart.split('.');
    const [hours, minutes] = timePart.split(':');
    if (!day || !month || !yearShort || !hours || !minutes) {
      return null;
    }
    const year = parseInt(yearShort, 10);
    const fullYear = Number.isFinite(year) ? (year < 100 ? 2000 + year : year) : NaN;
    const date = new Date(fullYear, parseInt(month, 10) - 1, parseInt(day, 10), parseInt(hours, 10), parseInt(minutes, 10));
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return date.toISOString();
  };

  const resolveBacktestPeriod = () => {
    const fallback = computeBacktestPeriod();
    let periodInput = null;

    try {
      periodInput = elements.popupBody?.querySelector('.date-picker input, .datepicker-wrapper input');
    } catch (error) {
      console.warn('[Veles multi backtests] Unable to access period input', error);
    }

    if (!periodInput) {
      return { ...fallback, source: 'по умолчанию (последний год)' };
    }

    const datasetStart = periodInput.dataset?.from || periodInput.dataset?.start;
    const datasetEnd = periodInput.dataset?.to || periodInput.dataset?.end;

    if (datasetStart && datasetEnd) {
      const startDate = new Date(datasetStart);
      const endDate = new Date(datasetEnd);
      if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())) {
        return { startISO: startDate.toISOString(), endISO: endDate.toISOString(), source: 'из выбранного периода' };
      }
    }

    const rawValue = periodInput.value?.trim();
    if (rawValue && rawValue.includes(' - ')) {
      const [startRaw, endRaw] = rawValue.split(' - ');
      const parsedStart = parseDateSegment(startRaw);
      const parsedEnd = parseDateSegment(endRaw);
      if (parsedStart && parsedEnd) {
        return { startISO: parsedStart, endISO: parsedEnd, source: 'из выбранного периода' };
      }
    }

    return { ...fallback, source: 'по умолчанию (последний год)' };
  };

  const resolveBotIdFromDatasets = () => {
    const candidates = [elements.modal, elements.popup];
    const attrNames = ['botId', 'bot-id', 'bot_id', 'id'];
    for (let cIndex = 0; cIndex < candidates.length; cIndex += 1) {
      const node = candidates[cIndex];
      if (!node?.dataset) continue;
      for (let aIndex = 0; aIndex < attrNames.length; aIndex += 1) {
        const attr = attrNames[aIndex];
        const value = node.dataset[attr] || node.getAttribute(`data-${attr}`);
        if (value && /^\d+$/.test(value)) {
          return value;
        }
      }
    }

    const attrElement = document.querySelector('[data-bot-id]');
    if (attrElement) {
      const value = attrElement.getAttribute('data-bot-id');
      if (value && /^\d+$/.test(value)) {
        return value;
      }
    }

    return null;
  };

  const deepFind = (root, predicate, limit = 5000) => {
    if (!root || typeof root !== 'object') {
      return null;
    }

    const queue = [{ value: root, path: [] }];
    const visited = new WeakSet();
    let processed = 0;

    while (queue.length > 0) {
      const current = queue.shift();
      const { value, path } = current;

      if (!value || typeof value !== 'object') {
        continue;
      }

      if (visited.has(value)) {
        continue;
      }

      visited.add(value);
      processed += 1;

      if (processed > limit) {
        break;
      }

      const result = predicate(value, path);
      if (result) {
        return result;
      }

      const entries = Array.isArray(value) ? value : Object.values(value);
      for (let index = 0; index < entries.length; index += 1) {
        const child = entries[index];
        if (child && typeof child === 'object') {
          queue.push({ value: child, path: path.concat(index) });
        }
      }
    }

    return null;
  };

  const resolveBotIdFromNuxt = () => {
    const nuxt = window.__NUXT__;
    if (!nuxt) {
      return null;
    }

    const match = deepFind(nuxt, (node) => {
      if (typeof node !== 'object' || node === null) {
        return null;
      }
      const looksLikeStrategy =
        typeof node.id === 'number' &&
        typeof node.name === 'string' &&
        typeof node.symbol === 'string' &&
        (typeof node.exchange === 'string' || typeof node.algorithm === 'string' || Array.isArray(node.symbols));
      if (looksLikeStrategy) {
        return String(node.id);
      }
      return null;
    });

    return match || null;
  };

  const resolveBotId = () => {
    const fromDatasets = resolveBotIdFromDatasets();
    if (fromDatasets) {
      return fromDatasets;
    }

    const fromLocation = parseBotId(window.location.href);
    if (fromLocation) {
      return fromLocation;
    }

    try {
      const anchor = document.querySelector('a[href*="/cabinet/bot/"]');
      if (anchor) {
        const fromLink = parseBotId(anchor.getAttribute('href'));
        if (fromLink) {
          return fromLink;
        }
      }
    } catch (error) {
      console.warn('[Veles multi backtests] Unable to inspect anchor links for bot id', error);
    }

    const nuxtId = resolveBotIdFromNuxt();
    if (nuxtId) {
      return nuxtId;
    }

    return null;
  };

  const showError = (message) => {
    if (!elements.error) return;
    elements.error.textContent = message;
    elements.error.style.display = message ? 'block' : 'none';
  };

  const clearLog = () => {
    if (elements.log) {
      elements.log.innerHTML = '';
    }
  };

  const activateMulti = () => {
    if (!elements.panel) {
      console.warn('[Veles multi backtests] Panel not ready');
      return;
    }

    if (elements.panel.classList.contains('veles-multi-active')) {
      return;
    }

    console.info('[Veles multi backtests] activating multi panel');

    elements.panel.style.display = 'block';
    elements.panel.classList.add('veles-multi-active');

    ensureRunButton();
    if (elements.confirmButton) {
      elements.confirmButton.dataset.velesHidden = 'true';
      elements.confirmButton.style.display = 'none';
    }
    if (elements.runButton) {
      elements.runButton.style.display = '';
    }

    if (elements.multiTrigger) {
      elements.multiTrigger.classList.add('veles-multi-trigger--active');
      elements.multiTrigger.textContent = 'Скрыть мультизапуск';
    }

    window.requestAnimationFrame(() => {
      try {
        elements.panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (error) {
        console.warn('[Veles multi backtests] scrollIntoView failed', error);
      }
    });

    showError('');
    clearLog();

    state.total = 0;
    state.completed = 0;

    if (elements.progressWrapper) {
      elements.progressWrapper.style.display = 'none';
    }
    if (elements.progressBar) {
      elements.progressBar.value = 0;
      elements.progressBar.max = 100;
    }
    if (elements.progressText) {
      elements.progressText.textContent = '';
    }

    setRunningState(false);

    if (elements.symbolsInput) {
      elements.symbolsInput.focus();
    }
  };

  const deactivateMulti = (force = false) => {
    if (!elements.panel) {
      return;
    }

    if (state.running && !force) {
      return;
    }

    if (!state.running) {
      setRunningState(false);
    }

    removeRunButton();
    if (elements.confirmButton) {
      elements.confirmButton.style.display = '';
      elements.confirmButton.disabled = false;
      delete elements.confirmButton.dataset.velesHidden;
      if (elements.confirmDefaultText) {
        elements.confirmButton.textContent = elements.confirmDefaultText;
      }
    }

    elements.panel.classList.remove('veles-multi-active');
    elements.panel.style.display = 'none';

    if (elements.multiTrigger) {
      elements.multiTrigger.disabled = false;
      elements.multiTrigger.classList.remove('veles-multi-trigger--active');
      elements.multiTrigger.textContent = 'Мультизапуск';
    }

    if (elements.progressWrapper) {
      elements.progressWrapper.style.display = 'none';
    }
    if (elements.progressText) {
      elements.progressText.textContent = '';
    }

    showError('');
  };

  const ensureMultiTrigger = (popupFooter) => {
    if (!popupFooter) {
      return null;
    }

    let trigger = popupFooter.querySelector('.veles-multi-trigger');
    if (!trigger) {
      trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'button transparent veles-multi-trigger';
      trigger.textContent = 'Мультизапуск';
      popupFooter.insertBefore(trigger, popupFooter.firstChild);
    } else if (trigger.parentNode !== popupFooter) {
      popupFooter.insertBefore(trigger, popupFooter.firstChild);
    } else if (popupFooter.firstChild !== trigger) {
      popupFooter.insertBefore(trigger, popupFooter.firstChild);
    }

    if (!trigger.dataset.velesMultiBound) {
      trigger.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (elements.panel?.classList.contains('veles-multi-active')) {
          deactivateMulti();
        } else {
          activateMulti();
        }
      });
      trigger.dataset.velesMultiBound = 'true';
    }

    const confirmCandidate = Array.from(popupFooter.querySelectorAll('button')).find((btn) => !btn.classList.contains('veles-multi-trigger') && btn.dataset.velesMultiRun !== 'true');
    if (confirmCandidate) {
      elements.confirmButton = confirmCandidate;
      if (!elements.confirmDefaultText) {
        elements.confirmDefaultText = confirmCandidate.textContent || 'Подтвердить';
      }
    }

    return trigger;
  };

  const ensureRunButton = () => {
    if (!elements.popupFooter) {
      return null;
    }

    if (!elements.runButton) {
      const runBtn = document.createElement('button');
      runBtn.type = 'button';
      runBtn.dataset.velesMultiRun = 'true';
      runBtn.addEventListener('click', () => {
        if (state.running) {
          handleCancel();
        } else {
          handleStart();
        }
      });
      elements.runButton = runBtn;
    }

    if (elements.confirmButton) {
      const baseClass = elements.confirmButton.className || 'button';
      elements.runButton.className = `${baseClass} veles-multi-run-button`;
    } else if (!elements.runButton.className) {
      elements.runButton.className = 'button veles-multi-run-button';
    }

    if (elements.confirmButton) {
      const parent = elements.popupFooter;
      if (elements.runButton.parentNode !== parent) {
        parent.insertBefore(elements.runButton, elements.confirmButton.nextSibling);
      }
    } else if (elements.popupFooter && elements.runButton.parentNode !== elements.popupFooter) {
      elements.popupFooter.appendChild(elements.runButton);
    }

    elements.runButton.style.display = '';
    elements.runButton.disabled = false;
    return elements.runButton;
  };

  const removeRunButton = () => {
    if (elements.runButton) {
      elements.runButton.classList.remove('veles-multi-run-button--stop');
      elements.runButton.style.display = 'none';
    }
    if (elements.runButton?.parentNode) {
      elements.runButton.parentNode.removeChild(elements.runButton);
    }
  };


  const attachToModal = (modal) => {
    if (!modal) {
      return;
    }

    const popup = modal.querySelector('.popup');
    const popupBody = popup?.querySelector('.popup-body');
    const popupFooter = popup?.querySelector('.popup-footer');

    if (!popup || !popupBody || !popupFooter) {
      return;
    }

    elements.modal = modal;
    elements.popup = popup;
    elements.popupBody = popupBody;
    elements.popupFooter = popupFooter;

    const panel = ensurePanelStructure(popupBody);
    elements.panel = panel;

    const trigger = ensureMultiTrigger(popupFooter);
    elements.multiTrigger = trigger;

    if (!modal.dataset.velesMultiObserverAttached) {
      const modalClassObserver = new MutationObserver(() => {
        const isActive = modal.classList.contains('active');
        if (!isActive) {
          if (state.running && !state.abort) {
            state.abort = true;
            addLogEntry('Модалка закрыта. Остановка после завершения текущего запроса.', 'warn');
          }
          deactivateMulti(true);
        } else if (!state.running && elements.multiTrigger) {
          elements.multiTrigger.disabled = false;
          elements.multiTrigger.classList.remove('veles-multi-trigger--active');
          elements.multiTrigger.textContent = 'Мультизапуск';
        }
      });

      modalClassObserver.observe(modal, { attributes: true, attributeFilter: ['class'] });
      elements.modalClassObserver = modalClassObserver;
      modal.dataset.velesMultiObserverAttached = 'true';
    }

    if (!elements.panel.classList.contains('veles-multi-active')) {
      deactivateMulti(true);
    }

    if (!state.running) {
      setRunningState(false);
    }
  };

  const ensureModalPresence = () => {
    modalEnsureScheduled = false;
    if (!document.body) {
      return;
    }

    const modal = document.querySelector('.popup-wrapper.start-backtest-popup');

    if (!modal) {
      elements.modal = null;
      deactivateMulti(true);
      return;
    }

    attachToModal(modal);

    if (!modal.classList.contains('active')) {
      deactivateMulti(true);
    }
  };

  const setupModalObserver = () => {
    const initObserver = () => {
      ensureModalPresence();

      if (!document.body) {
        return;
      }

      if (elements.domObserver) {
        return;
      }

      const observer = new MutationObserver(() => {
        if (!modalEnsureScheduled) {
          modalEnsureScheduled = true;
          window.requestAnimationFrame(() => {
            ensureModalPresence();
          });
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
      elements.domObserver = observer;
    };

    if (!document.body) {
      window.setTimeout(setupModalObserver, 50);
      return;
    }

    initObserver();
  };

  const addLogEntry = (message, type = 'info') => {
    if (!elements.log) return;
    const entry = document.createElement('div');
    entry.className = `veles-multi-log-entry veles-multi-log-${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    elements.log.appendChild(entry);
    elements.log.scrollTop = elements.log.scrollHeight;
  };

  const setRunningState = (isRunning) => {
    state.running = isRunning;
    state.abort = false;

    if (elements.runButton) {
      elements.runButton.disabled = false;
      elements.runButton.textContent = isRunning ? 'Остановить мультизапуск' : 'Запустить мультизапуск';
      elements.runButton.classList.toggle('veles-multi-run-button--stop', isRunning);
    }

    if (elements.symbolsInput) elements.symbolsInput.disabled = isRunning;
    if (elements.delayInput) elements.delayInput.disabled = isRunning;
    if (elements.multiTrigger) elements.multiTrigger.disabled = isRunning;

    if (!isRunning && elements.progressWrapper) {
      elements.progressWrapper.style.display = 'none';
    }
  };

  const parseBotId = (input) => {
    if (!input) return null;
    const trimmed = input.trim();
    if (!trimmed) return null;

    if (/^\d+$/.test(trimmed)) {
      return trimmed;
    }

    const match = trimmed.match(/(?:bot\/)(\d+)/i);
    if (match && match[1]) {
      return match[1];
    }

    return null;
  };

  const parseSymbols = (raw) => {
    const list = [];
    const discarded = [];
    if (!raw) {
      return { list, discarded };
    }

    raw
      .split(/\r?\n/)
      .forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return;
        }

        const basePart = trimmed.split(/[\s\/]+/)[0];
        const normalized = basePart.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        if (!normalized) {
          discarded.push(trimmed);
          return;
        }

        if (list.includes(normalized)) {
          discarded.push(trimmed);
          return;
        }

        list.push(normalized);
      });

    return { list, discarded };
  };


  const resolveQuoteCurrency = (strategy) => {
    const direct = strategy?.pair?.to;
    if (typeof direct === 'string' && direct.trim().length > 0) {
      return direct.trim().toUpperCase();
    }

    const primarySymbol = Array.isArray(strategy?.symbols) ? strategy.symbols[0] : strategy?.symbol;
    if (typeof primarySymbol === 'string' && primarySymbol.includes('/')) {
      const parts = primarySymbol.split('/');
      if (parts.length === 2 && parts[1].trim()) {
        return parts[1].trim().toUpperCase();
      }
    }

    const pairSymbol = strategy?.pair?.symbol;
    const baseFrom = strategy?.pair?.from;
    if (typeof pairSymbol === 'string' && typeof baseFrom === 'string') {
      const upperPair = pairSymbol.toUpperCase();
      const upperBase = baseFrom.toUpperCase();
      if (upperPair.startsWith(upperBase)) {
        const remainder = upperPair.slice(upperBase.length);
        if (remainder) {
          return remainder;
        }
      }
    }

    return null;
  };

  const composeSymbol = (baseTicker, quoteCurrency) => {
    const normalizedBase = baseTicker.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (!normalizedBase) {
      throw new Error('Некорректный тикер');
    }
    const quote = quoteCurrency.toUpperCase();
    return {
      base: normalizedBase,
      display: `${normalizedBase}/${quote}`,
      pairCode: `${normalizedBase}${quote}`,
    };
  };

  const ensureNameWithCoin = (originalName, coin) => {
    const baseName = typeof originalName === 'string' ? originalName.trim() : '';
    const normalizedCoin = coin.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (!baseName) {
      return normalizedCoin;
    }

    if (!normalizedCoin) {
      return baseName;
    }

    const trailingToken = baseName.split(/\s+/).pop();
    if (trailingToken && trailingToken.toUpperCase() === normalizedCoin) {
      return baseName;
    }

    return `${baseName} ${normalizedCoin}`;
  };

  const resolveCsrfToken = () => {
    const meta = document.querySelector('meta[name="_csrf"]');
    const token = meta?.content?.trim();
    if (token) {
      return { token, source: 'meta:_csrf' };
    }
    return { token: null, source: 'meta:_csrf (not found)' };
  };

  const fetchBaseStrategy = async (botId) => {
    const response = await window.fetch(`https://veles.finance/api/bots/${botId}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Не удалось получить стратегию (HTTP ${response.status})`);
    }

    return response.json();
  };

  const computeBacktestPeriod = () => {
    const end = new Date();
    const start = new Date(end);
    start.setFullYear(start.getFullYear() - 1);
    return { startISO: start.toISOString(), endISO: end.toISOString() };
  };

  const buildBacktestPayload = (baseStrategy, composedSymbol, options = {}) => {
    const payload = JSON.parse(JSON.stringify(baseStrategy));
    const makerCommission = options.makerCommission ?? DEFAULT_MAKER_COMMISSION;
    const takerCommission = options.takerCommission ?? DEFAULT_TAKER_COMMISSION;
    const useWicks = options.useWicks ?? false;
    const quoteCurrency = options.quoteCurrency ?? baseStrategy?.pair?.to ?? 'USDT';
    const quote = quoteCurrency.toUpperCase();

    let periodStartISO = options.periodStartISO || null;
    let periodEndISO = options.periodEndISO || null;
    if (!periodStartISO || !periodEndISO) {
      const period = computeBacktestPeriod();
      periodStartISO = periodStartISO || period.startISO;
      periodEndISO = periodEndISO || period.endISO;
    }

    payload.id = null;
    payload.name = ensureNameWithCoin(payload.name || baseStrategy?.name, composedSymbol.base);
    payload.symbol = composedSymbol.display;
    payload.symbols = [composedSymbol.display];

    if (payload.pair) {
      payload.pair = {
        ...payload.pair,
        from: composedSymbol.base,
        to: quote,
        symbol: composedSymbol.pairCode,
      };
    } else {
      payload.pair = {
        exchange: payload.exchange,
        type: payload.pair?.type ?? 'FUTURES',
        from: composedSymbol.base,
        to: quote,
        symbol: composedSymbol.pairCode,
      };
    }

    if (payload.status) {
      payload.status = 'FINISHED';
    }

    if (payload.substatus) {
      delete payload.substatus;
    }

    if (payload.lastFail) {
      delete payload.lastFail;
    }

    payload.commissions = {
      maker: makerCommission,
      taker: takerCommission,
    };

    payload.useWicks = Boolean(useWicks);
    payload.from = periodStartISO;
    payload.to = periodEndISO;
    payload.cursor = null;
    payload.includePosition = true;
    payload.public = Boolean(payload.public);

    return payload;
  };

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const postBacktest = async (payload, csrfToken) => {
    const headers = {
      'content-type': 'application/json',
      accept: 'application/json, text/plain, */*',
    };

    if (csrfToken) {
      headers['x-csrf-token'] = csrfToken;
    }

    const response = await window.fetch('https://veles.finance/api/backtests/', {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Ошибка запуска бектеста: HTTP ${response.status} ${message}`);
    }

    return response.json();
  };

  const updateProgress = () => {
    if (!elements.progressWrapper || !elements.progressBar || !elements.progressText) return;

    const percentage = state.total === 0 ? 0 : Math.round((state.completed / state.total) * 100);
    elements.progressBar.max = state.total;
    elements.progressBar.value = state.completed;
    elements.progressText.textContent = `Выполнено ${state.completed} из ${state.total}`;
    elements.progressWrapper.style.display = 'block';
  };

  const handleStart = async () => {
    if (state.running) {
      return;
    }

    showError('');

    if (!elements.popupBody) {
      showError('Модалка не готова. Попробуйте открыть её заново.');
      return;
    }

    const { list: baseTickers, discarded: discardedTickers } = parseSymbols(elements.symbolsInput.value);
    const delaySeconds = parseInt(elements.delayInput.value, 10) || DEFAULT_DELAY;
    const { makerInput, takerInput } = resolveCommissionInputs();
    const makerResult = normalizeCommissionValue(makerInput?.value, DEFAULT_MAKER_COMMISSION);
    const takerResult = normalizeCommissionValue(takerInput?.value, DEFAULT_TAKER_COMMISSION);

    if (!makerResult.ok) {
      showError('Проверьте поле комиссии мейкера в форме — значение некорректно.');
      return;
    }

    if (!takerResult.ok) {
      showError('Проверьте поле комиссии тейкера в форме — значение некорректно.');
      return;
    }

    const makerCommission = makerResult.value;
    const takerCommission = takerResult.value;

    if (makerInput) {
      makerInput.value = makerCommission;
    }

    if (takerInput) {
      takerInput.value = takerCommission;
    }

    const wicksCheckbox = resolveWicksCheckbox();
    const useWicks = Boolean(wicksCheckbox?.checked);
    const missingMakerField = !makerInput;
    const missingTakerField = !takerInput;
    const missingWicksCheckbox = !wicksCheckbox;

    const botId = resolveBotId();

    if (!botId) {
      showError('Не удалось определить ID бота на странице.');
      return;
    }

    if (baseTickers.length === 0) {
      showError('Добавьте хотя бы одну валюту.');
      return;
    }

    if (delaySeconds < 5) {
      showError('Минимальная пауза между запросами — 5 секунд.');
      return;
    }

    saveConfig({
      symbols: baseTickers,
      delay: delaySeconds,
    });

    clearLog();
    addLogEntry(`Получаем стратегию ${botId}...`);
    if (discardedTickers.length > 0) {
      addLogEntry(`Игнорированы строки (повтор или некорректный тикер): ${discardedTickers.join(', ')}`, 'warn');
    }
    if (missingMakerField) {
      addLogEntry('Поле комиссии мейкера не найдено, используем значение по умолчанию.', 'warn');
    }
    if (missingTakerField) {
      addLogEntry('Поле комиссии тейкера не найдено, используем значение по умолчанию.', 'warn');
    }
    if (missingWicksCheckbox) {
      addLogEntry('Чекбокс учёта теней не найден. Используем режим без теней.', 'warn');
    }

    setRunningState(true);

    try {
      const baseStrategy = await fetchBaseStrategy(botId);
      addLogEntry('Стратегия загружена.');

      let csrfInfo = resolveCsrfToken();

      const quoteCurrency = resolveQuoteCurrency(baseStrategy);
      if (!quoteCurrency) {
        throw new Error('Не удалось определить котируемую валюту стратегии.');
      }

      const backtestPeriod = resolveBacktestPeriod();
      const periodStartDate = new Date(backtestPeriod.startISO);
      const periodEndDate = new Date(backtestPeriod.endISO);

      state.total = baseTickers.length;
      state.completed = 0;
      updateProgress();

      for (let index = 0; index < baseTickers.length; index += 1) {
        if (state.abort) {
          addLogEntry('Остановлено пользователем.', 'warn');
          break;
        }

        const currentBase = baseTickers[index];
        let composedSymbol;
        try {
          composedSymbol = composeSymbol(currentBase, quoteCurrency);
        } catch (error) {
          state.completed += 1;
          updateProgress();
          addLogEntry(`Пропуск ${currentBase}: ${error.message}`, 'warn');
          continue;
        }

        addLogEntry(`Запуск для ${composedSymbol.display}...`);

        try {
          const payload = buildBacktestPayload(baseStrategy, composedSymbol, {
            makerCommission,
            takerCommission,
            useWicks,
            quoteCurrency,
            periodStartISO: backtestPeriod.startISO,
            periodEndISO: backtestPeriod.endISO,
          });
          const refreshedInfo = resolveCsrfToken();
          if (refreshedInfo?.token) {
            csrfInfo = refreshedInfo;
          }

          const response = await postBacktest(payload, csrfInfo?.token);
          state.completed += 1;
          updateProgress();
          addLogEntry(`Успешно: ${composedSymbol.display} (id: ${response?.id ?? 'неизвестно'})`);
        } catch (error) {
          state.completed += 1;
          updateProgress();
          addLogEntry(`Ошибка для ${composedSymbol.display}: ${error.message}`, 'error');
        }

        if (index < baseTickers.length - 1) {
          await wait(delaySeconds * 1000);
        }
      }

      if (!state.abort) {
        addLogEntry('Последовательность завершена.');
      }
    } catch (error) {
      addLogEntry(`Не удалось запустить последовательность: ${error.message}`, 'error');
      showError(error.message);
    } finally {
      setRunningState(false);
    }
  };

  const handleCancel = () => {
    if (!state.running) {
      deactivateMulti();
      return;
    }

    state.abort = true;
    addLogEntry('Запрошена остановка. Ждём завершения текущего запроса.', 'warn');
  };


  const init = () => {
    setupModalObserver();
  };

  namespace.multiRunner = {
    init,
  };
})();
