(() => {
  if (window.__velesMultiBacktestsSkip) {
    return;
  }

  const namespace = window.velesMulti || {};
  window.velesMulti = namespace;

  if (namespace.aggregator) {
    return;
  }

  const aggregator = (() => {
    const PANEL_ID = 'veles-aggregation-panel';
    const SELECT_ALL_ATTR = 'data-veles-agg-select-all';
    const TARGET_PATH_REGEX = /^\/cabinet\/(backtests\/?$|backtests\?|backtests\#|backtests$)/i;
    const API_BASE = 'https://veles.finance/api/backtests/statistics';
    const MAX_TRAVERSED_LINKS = 1000;
    const PAGE_SIZE = 200;
    const DRAW_ZERO = '—';
    const MS_IN_DAY = 24 * 60 * 60 * 1000;

    const stateAgg = {
      initialized: false,
      active: false,
      panel: null,
      elements: {},
      rows: new Map(),
      sourceTables: new Map(),
      sourceSelectedIds: new Set(),
      aggregateSelectedIds: new Set(),
      locationListenerAttached: false,
      historyPatched: false,
      locationChangeScheduled: false,
      progress: {
        totalRequests: 0,
        completedRequests: 0,
      },
      isFetching: false,
      lastScanCount: 0,
    };

    const summaryRefs = {};
    const sourceCheckboxHandlers = new WeakMap();

    const isOnTargetPage = () => {
      try {
        const pathname = window.location?.pathname || '';
        return TARGET_PATH_REGEX.test(pathname);
      } catch (error) {
        console.warn('[Veles multi backtests] Unable to read location pathname', error);
        return false;
      }
    };

    const numberFormat = (value, options = {}) => {
      const { minimumFractionDigits = 2, maximumFractionDigits = 2 } = options;
      if (!Number.isFinite(value)) {
        return DRAW_ZERO;
      }
      return value.toLocaleString('ru-RU', {
        minimumFractionDigits,
        maximumFractionDigits,
      });
    };

    const formatSigned = (value, options = {}) => {
      if (!Number.isFinite(value) || Math.abs(value) < 1e-9) {
        return '0.00';
      }
      const sign = value > 0 ? '+' : '';
      return `${sign}${numberFormat(value, options)}`;
    };

    const parseBacktestId = (input) => {
      if (!input) return null;
      const match = String(input).match(/backtests\/(\d+)/i);
      if (match && match[1]) {
        return match[1];
      }
      const digitsOnly = String(input).trim();
      if (/^\d+$/.test(digitsOnly)) {
        return digitsOnly;
      }
      return null;
    };

    const ensurePanelHost = () => {
      if (!stateAgg.panel) {
        const panel = document.createElement('section');
        panel.id = PANEL_ID;
        panel.innerHTML = `
        <div class="veles-agg-header">
          <div class="veles-agg-title">
            <h2>Агрегация результатов бэктестов</h2>
            <p class="veles-agg-subtitle">Выберите бэктесты на странице и загрузите их статистику для общей сводки.</p>
          </div>
          <div class="veles-agg-actions">
            <button type="button" class="veles-agg-button" data-veles-agg="refresh">Обновить список</button>
            <button type="button" class="veles-agg-button veles-agg-button--primary" data-veles-agg="run">Агрегировать результаты</button>
          </div>
        </div>
        <div class="veles-agg-progress" style="display:none">
          <div class="veles-agg-progress-text"></div>
          <progress class="veles-agg-progress-bar" max="1" value="0"></progress>
        </div>
        <div class="veles-agg-summary">
          <div class="veles-agg-metric">
            <div class="veles-agg-metric-label">Выбрано бэктестов</div>
            <div class="veles-agg-metric-value" data-veles-agg-summary="total-selected">0</div>
          </div>
          <div class="veles-agg-metric">
            <div class="veles-agg-metric-label">Суммарный P&amp;L</div>
            <div class="veles-agg-metric-value veles-agg-neutral" data-veles-agg-summary="total-pnl">0.00</div>
          </div>
          <div class="veles-agg-metric">
            <div class="veles-agg-metric-label">Сделки</div>
            <div class="veles-agg-metric-value veles-agg-metric-combo" data-veles-agg-summary="deals">
              <span class="veles-agg-positive">0</span>
              <span class="veles-agg-negative">0</span>
              <span class="veles-agg-total">0</span>
            </div>
          </div>
          <div class="veles-agg-metric">
            <div class="veles-agg-metric-label">Средний P&amp;L на сделку</div>
            <div class="veles-agg-metric-value veles-agg-neutral" data-veles-agg-summary="avg-pnl-deal">0.00</div>
          </div>
          <div class="veles-agg-metric">
            <div class="veles-agg-metric-label">Средний P&amp;L на бэктест</div>
            <div class="veles-agg-metric-value veles-agg-neutral" data-veles-agg-summary="avg-pnl-backtest">0.00</div>
          </div>
          <div class="veles-agg-metric">
            <div class="veles-agg-metric-label">Средняя макс. просадка</div>
            <div class="veles-agg-metric-value veles-agg-neutral" data-veles-agg-summary="avg-drawdown">0.00</div>
          </div>
          <div class="veles-agg-metric">
            <div class="veles-agg-metric-label">Макс. аггрегированная просадка</div>
            <div class="veles-agg-metric-value veles-agg-neutral" data-veles-agg-summary="max-agg-drawdown">0.00</div>
          </div>
          <div class="veles-agg-metric">
            <div class="veles-agg-metric-label">Макс. суммарное МПУ</div>
            <div class="veles-agg-metric-value veles-agg-neutral" data-veles-agg-summary="max-agg-mpu">0.00</div>
          </div>
          <div class="veles-agg-metric">
            <div class="veles-agg-metric-label">Макс. одновременно открытых позиций</div>
            <div class="veles-agg-metric-value" data-veles-agg-summary="max-concurrent">0</div>
          </div>
          <div class="veles-agg-metric">
            <div class="veles-agg-metric-label">Среднее одновременно открытых</div>
            <div class="veles-agg-metric-value" data-veles-agg-summary="avg-concurrent">0.00</div>
          </div>
          <div class="veles-agg-metric">
            <div class="veles-agg-metric-label">Средняя длительность сделки (дни)</div>
            <div class="veles-agg-metric-value" data-veles-agg-summary="avg-duration">0.00</div>
          </div>
          <div class="veles-agg-metric">
            <div class="veles-agg-metric-label">Дни без торговли</div>
            <div class="veles-agg-metric-value veles-agg-neutral" data-veles-agg-summary="no-trade-days">0.00</div>
          </div>
        </div>
        <div class="veles-agg-concurrency" data-veles-agg="concurrency">
          <div class="veles-agg-concurrency-header">
            <h3>Активные позиции по дням</h3>
            <p>Распределение дневных пиков помогает подобрать лимит одновременно открытых позиций.</p>
          </div>
          <div class="veles-agg-concurrency-metrics">
            <div class="veles-agg-metric">
              <div class="veles-agg-metric-label">Средний дневной пик</div>
              <div class="veles-agg-metric-value" data-veles-agg-concurrency-summary="mean">0.00</div>
            </div>
            <div class="veles-agg-metric">
              <div class="veles-agg-metric-label">P75 дневного пика</div>
              <div class="veles-agg-metric-value" data-veles-agg-concurrency-summary="p75">0.00</div>
            </div>
            <div class="veles-agg-metric">
              <div class="veles-agg-metric-label">P90 дневного пика</div>
              <div class="veles-agg-metric-value" data-veles-agg-concurrency-summary="p90">0.00</div>
            </div>
            <div class="veles-agg-metric">
              <div class="veles-agg-metric-label">P95 дневного пика</div>
              <div class="veles-agg-metric-value" data-veles-agg-concurrency-summary="p95">0.00</div>
            </div>
          </div>
          <div class="veles-agg-concurrency-hint" data-veles-agg-concurrency-summary="limit-note"></div>
          <div class="veles-agg-chart-wrapper">
            <canvas class="veles-agg-chart" data-veles-agg-concurrency-chart></canvas>
            <div class="veles-agg-chart-empty" data-veles-agg-concurrency-empty>Нет данных для построения графика.</div>
          </div>
        </div>
        <div class="veles-agg-table-wrapper">
          <table class="veles-agg-table">
            <thead>
              <tr>
                <th><input type="checkbox" ${SELECT_ALL_ATTR} /></th>
                <th>ID</th>
                <th>Название</th>
                <th>Пара</th>
                <th>P&amp;L</th>
                <th>Сделки</th>
                <th>Средняя длительность</th>
                <th>Дни без торговли</th>
                <th>Макс. просадка</th>
                <th>МПУ</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
          <div class="veles-agg-empty" data-veles-agg="empty">На странице не найдены бэктесты. Откройте раздел Backtests или обновите список.</div>
        </div>
        <div class="veles-agg-log" data-veles-agg="log"></div>
      `;
        stateAgg.panel = panel;

        stateAgg.elements = {
          refreshButton: panel.querySelector('[data-veles-agg="refresh"]'),
          runButton: panel.querySelector('[data-veles-agg="run"]'),
          progressWrapper: panel.querySelector('.veles-agg-progress'),
          progressText: panel.querySelector('.veles-agg-progress-text'),
          progressBar: panel.querySelector('.veles-agg-progress-bar'),
          tableBody: panel.querySelector('tbody'),
          emptyState: panel.querySelector('[data-veles-agg="empty"]'),
          log: panel.querySelector('[data-veles-agg="log"]'),
          selectAll: panel.querySelector(`[${SELECT_ALL_ATTR}]`),
          concurrencySection: panel.querySelector('[data-veles-agg="concurrency"]'),
          concurrencyChart: panel.querySelector('[data-veles-agg-concurrency-chart]'),
          concurrencyEmpty: panel.querySelector('[data-veles-agg-concurrency-empty]'),
        };

        summaryRefs.totalSelected = panel.querySelector('[data-veles-agg-summary="total-selected"]');
        summaryRefs.totalPnl = panel.querySelector('[data-veles-agg-summary="total-pnl"]');
        summaryRefs.deals = panel.querySelector('[data-veles-agg-summary="deals"]');
        summaryRefs.avgPnlDeal = panel.querySelector('[data-veles-agg-summary="avg-pnl-deal"]');
        summaryRefs.avgPnlBacktest = panel.querySelector('[data-veles-agg-summary="avg-pnl-backtest"]');
        summaryRefs.avgDrawdown = panel.querySelector('[data-veles-agg-summary="avg-drawdown"]');
        summaryRefs.maxAggDrawdown = panel.querySelector('[data-veles-agg-summary="max-agg-drawdown"]');
        summaryRefs.maxAggMPU = panel.querySelector('[data-veles-agg-summary="max-agg-mpu"]');
        summaryRefs.maxConcurrent = panel.querySelector('[data-veles-agg-summary="max-concurrent"]');
        summaryRefs.avgConcurrent = panel.querySelector('[data-veles-agg-summary="avg-concurrent"]');
        summaryRefs.avgDuration = panel.querySelector('[data-veles-agg-summary="avg-duration"]');
        summaryRefs.noTradeDays = panel.querySelector('[data-veles-agg-summary="no-trade-days"]');
        summaryRefs.concurrencyMean = panel.querySelector('[data-veles-agg-concurrency-summary="mean"]');
        summaryRefs.concurrencyP75 = panel.querySelector('[data-veles-agg-concurrency-summary="p75"]');
        summaryRefs.concurrencyP90 = panel.querySelector('[data-veles-agg-concurrency-summary="p90"]');
        summaryRefs.concurrencyP95 = panel.querySelector('[data-veles-agg-concurrency-summary="p95"]');
        summaryRefs.concurrencyLimitNote = panel.querySelector('[data-veles-agg-concurrency-summary="limit-note"]');

        if (summaryRefs.deals) {
          const [profitSpan, lossSpan, totalSpan] = summaryRefs.deals.querySelectorAll('span');
          profitSpan?.classList.add('veles-agg-positive');
          lossSpan?.classList.add('veles-agg-negative');
          totalSpan?.classList.add('veles-agg-total');
        }

        stateAgg.elements.refreshButton?.addEventListener('click', () => refreshRows(true));
        stateAgg.elements.runButton?.addEventListener('click', () => runAggregation());
        stateAgg.elements.selectAll?.addEventListener('change', (event) => {
          const shouldSelect = Boolean(event.target.checked);
          setSelectionForAll(shouldSelect);
        });
      }

      const panel = stateAgg.panel;
      const defaultHost = document.querySelector('main') || document.querySelector('#__nuxt') || document.body;
      const targetWrapper = document.querySelector('.backtest-history-page-table-wrapper.table-wrapper');
      const targetTable = targetWrapper?.querySelector('table') || document.querySelector('.backtest-history-page-table');
      const insertionTarget = targetWrapper || targetTable;

      if (insertionTarget?.parentElement && (insertionTarget.parentElement !== panel.parentElement || panel.previousElementSibling !== insertionTarget)) {
        insertionTarget.parentElement.insertBefore(panel, insertionTarget.nextSibling);
      } else if (!panel.isConnected) {
        if (defaultHost?.firstChild) {
          defaultHost.insertBefore(panel, defaultHost.firstChild);
        } else if (defaultHost) {
          defaultHost.appendChild(panel);
        }
      }

      return panel;
    };

    const attachSourceCheckboxHandler = (checkbox, idString) => {
      if (!checkbox) {
        return;
      }
      const existing = sourceCheckboxHandlers.get(checkbox);
      if (existing) {
        checkbox.removeEventListener('change', existing);
      }
      const handler = () => {
        setSourceSelection(idString, Boolean(checkbox.checked));
      };
      sourceCheckboxHandlers.set(checkbox, handler);
      checkbox.addEventListener('change', handler);
    };

    const ensureSourceTableAugmented = (container) => {
      if (!container) {
        return null;
      }

      let entry = stateAgg.sourceTables.get(container);
      if (entry) {
        return entry;
      }

      let master = null;
      let handler = null;

      if (container.tagName === 'TABLE') {
        const headerRow = container.querySelector('thead tr');
        const bodyRows = Array.from(container.querySelectorAll('tbody tr'));
        if (headerRow || bodyRows.length > 0) {
          if (headerRow) {
            const headerCell = document.createElement('th');
            headerCell.className = 'veles-agg-source-header';
            master = document.createElement('input');
            master.type = 'checkbox';
            master.className = 'veles-agg-source-checkbox';
            headerCell.appendChild(master);
            headerRow.insertBefore(headerCell, headerRow.firstChild);

            handler = (event) => {
              setSelectionForTable(container, Boolean(event.target.checked));
            };
            master.addEventListener('change', handler);
          }
        }
      } else {
        container.classList.add('veles-agg-source-container');
      }

      entry = { master, handler };
      stateAgg.sourceTables.set(container, entry);
      return entry;
    };

    const ensureSourceCheckbox = (rowElement, idString) => {
      if (!rowElement) {
        return null;
      }

      const container = rowElement.closest('table') || rowElement.closest('.backtest-history-page-table-wrapper.table-wrapper') || rowElement.parentElement;
      ensureSourceTableAugmented(container);

      if (rowElement.tagName === 'TR') {
        let cell = rowElement.querySelector('td[data-veles-agg-source]');
        if (!cell) {
          cell = document.createElement('td');
          cell.dataset.velesAggSource = 'true';
          cell.className = 'veles-agg-source-cell';
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.className = 'veles-agg-source-checkbox';
          cell.appendChild(checkbox);
          if (rowElement.firstChild) {
            rowElement.insertBefore(cell, rowElement.firstChild);
          } else {
            rowElement.appendChild(cell);
          }
          attachSourceCheckboxHandler(checkbox, idString);
          checkbox.checked = stateAgg.sourceSelectedIds.has(idString);
          return checkbox;
        }

        let checkbox = cell.querySelector('input[type="checkbox"]');
        if (!checkbox) {
          checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.className = 'veles-agg-source-checkbox';
          cell.appendChild(checkbox);
        }
        attachSourceCheckboxHandler(checkbox, idString);
        checkbox.checked = stateAgg.sourceSelectedIds.has(idString);
        return checkbox;
      }

      rowElement.dataset.velesAggRow = 'true';
      let slot = rowElement.querySelector('[data-veles-agg-source]');
      if (!slot) {
        slot = document.createElement('div');
        slot.dataset.velesAggSource = 'true';
        slot.className = 'veles-agg-source-floating';
        if (rowElement.firstChild) {
          rowElement.insertBefore(slot, rowElement.firstChild);
        } else {
          rowElement.appendChild(slot);
        }
      }

      let checkbox = slot.querySelector('input[type="checkbox"]');
      if (!checkbox) {
        checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'veles-agg-source-checkbox';
        slot.appendChild(checkbox);
      }

      attachSourceCheckboxHandler(checkbox, idString);
      checkbox.checked = stateAgg.sourceSelectedIds.has(idString);
      return checkbox;
    };

    const syncAggregateTableBody = () => {
      const tableBody = stateAgg.elements.tableBody;
      if (!tableBody) {
        return;
      }

      const fragment = document.createDocumentFragment();
      let visibleCount = 0;

      stateAgg.rows.forEach((rowState) => {
        if (!rowState?.row) {
          return;
        }

        rowState.row.classList.toggle('veles-agg-row-stale', !rowState.hasSource);

        if (stateAgg.sourceSelectedIds.has(rowState.idString)) {
          visibleCount += 1;
          fragment.appendChild(rowState.row);
        }
      });

      tableBody.innerHTML = '';
      tableBody.appendChild(fragment);

      if (stateAgg.elements.emptyState) {
        stateAgg.elements.emptyState.style.display = visibleCount === 0 ? 'block' : 'none';
      }
    };

    const setSourceSelection = (idString, isSelected, options = {}) => {
      const { silent = false, skipSync = false } = options;
      const rowState = stateAgg.rows.get(idString);

      if (isSelected) {
        stateAgg.sourceSelectedIds.add(idString);
        if (!stateAgg.aggregateSelectedIds.has(idString)) {
          setAggregateSelection(idString, true, { silent: true });
        }
      } else {
        stateAgg.sourceSelectedIds.delete(idString);
        if (stateAgg.aggregateSelectedIds.has(idString)) {
          setAggregateSelection(idString, false, { silent: true });
        }
      }

      if (rowState?.sourceCheckbox) {
        rowState.sourceCheckbox.checked = isSelected;
      }

      if (!skipSync) {
        syncAggregateTableBody();
      }

      if (!silent) {
        updateSummary();
      }
    };

    const setAggregateSelection = (idString, isSelected, options = {}) => {
      const { silent = false } = options;
      if (isSelected) {
        stateAgg.aggregateSelectedIds.add(idString);
      } else {
        stateAgg.aggregateSelectedIds.delete(idString);
      }

      const rowState = stateAgg.rows.get(idString);
      if (rowState?.checkbox) {
        rowState.checkbox.checked = isSelected;
      }
      if (rowState) {
        renderAggregateRow(rowState);
      }

      if (!silent) {
        updateSummary();
      }
    };

    const setSelectionForAll = (shouldSelect) => {
      stateAgg.sourceSelectedIds.forEach((idString) => {
        setAggregateSelection(idString, shouldSelect, { silent: true });
      });
      updateSummary();
    };

    const setSelectionForTable = (table, shouldSelect) => {
      const affected = [];
      stateAgg.rows.forEach((rowState) => {
        if (rowState.sourceTable === table) {
          affected.push(rowState);
        }
      });
      affected.forEach((rowState) => {
        setSourceSelection(rowState.idString, shouldSelect, { silent: true, skipSync: true });
      });
      syncAggregateTableBody();
      updateSummary();
    };

    const addLog = (message, type = 'info') => {
      const container = stateAgg.elements.log;
      if (!container) return;
      const entry = document.createElement('div');
      entry.className = `veles-agg-log-entry veles-agg-log-${type}`;
      entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
      container.appendChild(entry);
      while (container.childNodes.length > 200) {
        container.removeChild(container.firstChild);
      }
      container.scrollTop = container.scrollHeight;
    };

    const resetProgress = () => {
      stateAgg.progress.totalRequests = 0;
      stateAgg.progress.completedRequests = 0;
      updateProgress();
    };

    const registerRequests = (count) => {
      if (!Number.isFinite(count) || count <= 0) {
        return;
      }
      stateAgg.progress.totalRequests += count;
      updateProgress();
    };

    const markRequestCompleted = () => {
      stateAgg.progress.completedRequests += 1;
      updateProgress();
    };

    const updateProgress = () => {
      const { progressWrapper, progressBar, progressText } = stateAgg.elements;
      if (!progressWrapper || !progressBar || !progressText) {
        return;
      }

      const { totalRequests, completedRequests } = stateAgg.progress;
      if (totalRequests <= 0) {
        progressWrapper.style.display = 'none';
        progressBar.value = 0;
        progressBar.max = 1;
        progressText.textContent = '';
        return;
      }

      progressWrapper.style.display = 'block';
      progressBar.max = totalRequests;
      progressBar.value = Math.min(completedRequests, totalRequests);
      const remaining = Math.max(totalRequests - completedRequests, 0);
      progressText.textContent = `Выполнено ${completedRequests} из ${totalRequests}. Осталось запросов: ${remaining}`;
    };

    const resolveRowElement = (anchor) => {
      if (!anchor) {
        return null;
      }
      return anchor.closest('tr, .row-wrapper, .backtest-history-page-table-row');
    };

    const ensureRowState = (id, anchor) => {
      const idString = String(id);
      const existing = stateAgg.rows.get(idString);
      const sourceRow = resolveRowElement(anchor);
      if (existing) {
        existing.sourceRow = sourceRow;
        existing.sourceTable = sourceRow?.closest('table') || sourceRow?.closest('.backtest-history-page-table-wrapper') || existing.sourceTable || null;
        existing.sourceCheckbox = ensureSourceCheckbox(sourceRow, idString);
        if (anchor?.href && existing.link) {
          existing.link.href = anchor.href;
        }
        const aggregateSelected = stateAgg.aggregateSelectedIds.has(idString);
        const sourceSelected = stateAgg.sourceSelectedIds.has(idString);
        if (existing.checkbox) {
          existing.checkbox.checked = aggregateSelected;
        }
        if (existing.sourceCheckbox) {
          existing.sourceCheckbox.checked = sourceSelected;
        }
        existing.hasSource = Boolean(sourceRow);
        renderAggregateRow(existing);
        return existing;
      }

      const row = document.createElement('tr');
      row.dataset.backtestId = idString;

      const checkboxCell = document.createElement('td');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'veles-agg-checkbox';
      checkbox.addEventListener('change', () => {
        setAggregateSelection(idString, Boolean(checkbox.checked));
      });
      checkboxCell.appendChild(checkbox);

      const idCell = document.createElement('td');
      const link = document.createElement('a');
      link.className = 'veles-agg-link';
      link.textContent = idString;
      link.href = anchor?.href || `https://veles.finance/cabinet/backtests/${idString}`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      idCell.appendChild(link);

      const nameCell = document.createElement('td');
      const pairCell = document.createElement('td');
      const pnlCell = document.createElement('td');
      pnlCell.className = 'veles-agg-pnl';
      const dealsCell = document.createElement('td');
      dealsCell.className = 'veles-agg-deals';
      const avgDurationCell = document.createElement('td');
      const downtimeCell = document.createElement('td');
      const drawdownCell = document.createElement('td');
      const mpuCell = document.createElement('td');
      mpuCell.className = 'veles-agg-mpu';

      nameCell.textContent = DRAW_ZERO;
      pairCell.textContent = DRAW_ZERO;
      pnlCell.textContent = DRAW_ZERO;
      dealsCell.innerHTML = '<span class="veles-agg-positive">0</span> / <span class="veles-agg-negative">0</span> / <span class="veles-agg-total">0</span>';
      avgDurationCell.textContent = DRAW_ZERO;
      downtimeCell.textContent = DRAW_ZERO;
      drawdownCell.textContent = DRAW_ZERO;
      mpuCell.textContent = DRAW_ZERO;

      pnlCell.classList.add('veles-agg-neutral');
      drawdownCell.classList.add('veles-agg-neutral');
      mpuCell.classList.add('veles-agg-neutral');

      row.appendChild(checkboxCell);
      row.appendChild(idCell);
      row.appendChild(nameCell);
      row.appendChild(pairCell);
      row.appendChild(pnlCell);
      row.appendChild(dealsCell);
      row.appendChild(avgDurationCell);
      row.appendChild(downtimeCell);
      row.appendChild(drawdownCell);
      row.appendChild(mpuCell);

      const rowState = {
        id: Number(idString),
        idString,
        row,
        checkbox,
        link,
        cells: {
          name: nameCell,
          pair: pairCell,
          pnl: pnlCell,
          deals: dealsCell,
          avgDuration: avgDurationCell,
          downtime: downtimeCell,
          drawdown: drawdownCell,
          mpu: mpuCell,
        },
        data: null,
        error: null,
        sourceRow,
        sourceTable: null,
        sourceCheckbox: null,
        hasSource: false,
      };
      rowState.sourceTable = rowState.sourceRow?.closest('table') || rowState.sourceRow?.closest('.backtest-history-page-table-wrapper') || null;
      rowState.sourceCheckbox = ensureSourceCheckbox(rowState.sourceRow, idString);
      rowState.hasSource = Boolean(rowState.sourceRow);
      const aggregateSelected = stateAgg.aggregateSelectedIds.has(idString);
      checkbox.checked = aggregateSelected;
      const sourceSelected = stateAgg.sourceSelectedIds.has(idString);
      if (rowState.sourceCheckbox) {
        rowState.sourceCheckbox.checked = sourceSelected;
      }

      stateAgg.rows.set(idString, rowState);
      renderAggregateRow(rowState);
      return rowState;
    };

    const refreshRows = (forceLog = false) => {
      if (!stateAgg.active) {
        return 0;
      }

      ensurePanelHost();
      const wrapper = document.querySelector('.backtest-history-page-table-wrapper.table-wrapper');
      const table = wrapper?.querySelector('table') || document.querySelector('.backtest-history-page-table');
      const anchorRoot = table || wrapper;
      if (!anchorRoot) {
        stateAgg.rows.forEach((rowState) => {
          rowState.sourceRow = null;
          rowState.sourceTable = null;
          rowState.sourceCheckbox = null;
          rowState.hasSource = false;
        });
        syncAggregateTableBody();
        updateSummary();
        return 0;
      }

      const anchors = Array.from(anchorRoot.querySelectorAll('a[href*="/cabinet/backtests/"]'));
      const mapped = new Map();
      for (let index = 0; index < anchors.length && index < MAX_TRAVERSED_LINKS; index += 1) {
        const anchor = anchors[index];
        if (anchor.closest(`#${PANEL_ID}`)) {
          continue;
        }

        const rowWrapper = resolveRowElement(anchor);
        if (!rowWrapper) {
          continue;
        }

        const tableBody = rowWrapper.closest('.table-body');
        const wrapperRoot = rowWrapper.closest('.backtest-history-page-table-wrapper');
        if (!tableBody || !wrapperRoot || tableBody.parentElement !== wrapperRoot) {
          continue;
        }

        const rowClassNames = Array.from(rowWrapper.classList || []);
        if (rowClassNames.some((className) => /progress|processing|running/i.test(className))) {
          continue;
        }

        const statusAttr = (rowWrapper.dataset?.status || rowWrapper.getAttribute('data-status') || '').toLowerCase();
        if (statusAttr && statusAttr !== 'finished' && statusAttr !== 'completed' && statusAttr !== 'done') {
          continue;
        }

        const statusText = (rowWrapper.querySelector('[class*="status"], .status')?.textContent || '').toLowerCase();
        if (statusText && (statusText.includes('процесс') || statusText.includes('ожид') || statusText.includes('актив') || statusText.includes('работ') || statusText.includes('running') || statusText.includes('progress') || statusText.includes('processing'))) {
          continue;
        }

        const href = anchor.getAttribute('href') || anchor.href;
        const id = parseBacktestId(href);
        if (!id || mapped.has(id)) {
          continue;
        }
        mapped.set(id, anchor);
      }

      const processedIds = new Set();
      mapped.forEach((anchor, id) => {
        const rowState = ensureRowState(id, anchor);
        rowState.sourceTable = rowState.sourceRow?.closest('table') || rowState.sourceRow?.closest('.backtest-history-page-table-wrapper') || table || wrapper || rowState.sourceTable || null;
        processedIds.add(rowState.idString);
      });

      stateAgg.rows.forEach((rowState, idString) => {
        if (processedIds.has(idString)) {
          rowState.hasSource = true;
          return;
        }

        const hostRow = rowState.sourceRow;
        if (rowState.sourceCheckbox) {
          const slot = rowState.sourceCheckbox.closest('[data-veles-agg-source]');
          if (slot?.parentElement) {
            slot.parentElement.removeChild(slot);
          }
        }
        if (hostRow?.dataset?.velesAggRow) {
          delete hostRow.dataset.velesAggRow;
        }
        rowState.sourceRow = null;
        rowState.sourceTable = null;
        rowState.sourceCheckbox = null;
        rowState.hasSource = false;
      });

      syncAggregateTableBody();

      const detected = processedIds.size;
      stateAgg.lastScanCount = detected;

      if (forceLog) {
        addLog(`Найдено бэктестов на странице: ${detected}`);
      }

      updateSummary();
      return detected;
    };

    const setRowStatus = (rowState, message, type = 'info') => {
      if (!rowState?.row) {
        return;
      }

      rowState.statusType = type;
      rowState.statusMessage = message || '';

      const { row } = rowState;
      row.dataset.velesAggStatus = type;

      if (rowState.statusMessage) {
        row.title = rowState.statusMessage;
      } else {
        row.removeAttribute('title');
      }

      row.classList.remove('veles-agg-row-error', 'veles-agg-row-loading');

      if (type === 'error') {
        row.classList.add('veles-agg-row-error');
      } else if (type === 'info') {
        row.classList.add('veles-agg-row-loading');
      }
    };

    const applyRowData = (rowState, metrics) => {
      rowState.data = metrics;
      rowState.error = null;

      if (rowState.cells.name) {
        rowState.cells.name.textContent = metrics.name || DRAW_ZERO;
      }
      if (rowState.cells.pair) {
        rowState.cells.pair.textContent = metrics.symbol || DRAW_ZERO;
      }

      setRowStatus(rowState, '', 'ready');
      renderAggregateRow(rowState);
    };

    const setRowError = (rowState, error) => {
      rowState.error = error instanceof Error ? error : new Error(String(error));
      rowState.data = null;
      setRowStatus(rowState, rowState.error.message, 'error');
      addLog(`Не удалось получить данные по бэктесту ${rowState.idString}: ${rowState.error.message}`, 'error');
      renderAggregateRow(rowState);
    };

    const computeDrawdownTimeline = (cycles) => {
      const events = [];
      if (!Array.isArray(cycles)) {
        return { maxDrawdown: 0, events };
      }

      cycles
        .filter((cycle) => cycle && cycle.status === 'FINISHED')
        .forEach((cycle) => {
          const closeTime = Number(new Date(cycle.date).getTime());
          const net = Number(cycle.netQuote ?? cycle.profitQuote ?? 0);
          if (Number.isFinite(closeTime) && Number.isFinite(net)) {
            events.push({ time: closeTime, delta: net });
          }
        });

      events.sort((a, b) => a.time - b.time);

      let cumulative = 0;
      let peak = 0;
      let maxDrawdown = 0;
      const enriched = [];

      for (let index = 0; index < events.length; index += 1) {
        const current = events[index];
        cumulative += current.delta;
        if (cumulative > peak) {
          peak = cumulative;
        }
        const drawdown = peak - cumulative;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
        }
        enriched.push({ ...current, cumulative, drawdown });
      }

      return { maxDrawdown, events: enriched };
    };

    const resolveCycleInterval = (cycle) => {
      if (!cycle || cycle.status !== 'FINISHED') {
        return null;
      }

      const end = Number(new Date(cycle.date).getTime());
      if (!Number.isFinite(end)) {
        return null;
      }

      const durationSec = Number(cycle.duration);
      let start = Number.isFinite(durationSec) ? end - durationSec * 1000 : Number.NaN;

      if (!Number.isFinite(start) && Array.isArray(cycle.orders)) {
        const orderTimes = cycle.orders
          .map((order) => Number(new Date(order.executedAt || order.createdAt || '').getTime()))
          .filter((value) => Number.isFinite(value));
        if (orderTimes.length > 0) {
          start = Math.min(...orderTimes);
        }
      }

      if (!Number.isFinite(start)) {
        start = end;
      }

      if (start > end) {
        start = end;
      }

      return { start, end };
    };

    const computeIntervals = (cycles) => {
      if (!Array.isArray(cycles)) {
        return [];
      }
      const intervals = [];
      cycles
        .filter((cycle) => cycle && cycle.status === 'FINISHED')
        .forEach((cycle) => {
          const interval = resolveCycleInterval(cycle);
          if (interval) {
            intervals.push(interval);
          }
        });

      intervals.sort((a, b) => a.start - b.start || a.end - b.end);
      return intervals;
    };

    const buildRiskIntervals = (cycles) => {
      const riskIntervals = [];
      let maxRisk = 0;
      if (!Array.isArray(cycles)) {
        return { riskIntervals, maxRisk };
      }

      cycles
        .filter((cycle) => cycle && cycle.status === 'FINISHED')
        .forEach((cycle) => {
          const value = Math.abs(Number(cycle.maeAbsolute ?? 0));
          if (!Number.isFinite(value) || value <= 0) {
            return;
          }
          const interval = resolveCycleInterval(cycle);
          if (!interval) {
            return;
          }
          riskIntervals.push({ ...interval, value });
          if (value > maxRisk) {
            maxRisk = value;
          }
        });

      riskIntervals.sort((a, b) => a.start - b.start || a.end - b.end);
      return { riskIntervals, maxRisk };
    };

    const computeCoverage = (intervals) => {
      if (!Array.isArray(intervals) || intervals.length === 0) {
        return { totalActiveMs: 0, spanMs: 0, minStart: Number.NaN, maxEnd: Number.NaN };
      }

      const sanitized = intervals
        .map((interval) => ({
          start: Number(interval.start),
          end: Number(interval.end),
        }))
        .filter((interval) => Number.isFinite(interval.start) && Number.isFinite(interval.end) && interval.end >= interval.start)
        .sort((a, b) => a.start - b.start || a.end - b.end);

      if (sanitized.length === 0) {
        return { totalActiveMs: 0, spanMs: 0, minStart: Number.NaN, maxEnd: Number.NaN };
      }

      let totalActiveMs = 0;
      let currentStart = sanitized[0].start;
      let currentEnd = sanitized[0].end;
      let minStart = currentStart;
      let maxEnd = currentEnd;

      for (let index = 1; index < sanitized.length; index += 1) {
        const { start, end } = sanitized[index];
        if (start > currentEnd) {
          totalActiveMs += Math.max(0, currentEnd - currentStart);
          currentStart = start;
          currentEnd = end;
        } else {
          currentEnd = Math.max(currentEnd, end);
        }
        if (start < minStart) {
          minStart = start;
        }
        if (end > maxEnd) {
          maxEnd = end;
        }
      }

      totalActiveMs += Math.max(0, currentEnd - currentStart);
      const spanMs = Math.max(0, maxEnd - minStart);

      return { totalActiveMs, spanMs, minStart, maxEnd };
    };

    const parseTimestamp = (value) => {
      if (!value) {
        return null;
      }
      const time = Number(new Date(value).getTime());
      return Number.isFinite(time) ? time : null;
    };

    const resolveStatsSpan = (stats) => {
      if (!stats || typeof stats !== 'object') {
        return null;
      }

      const startCandidates = [
        stats.from,
        stats.start,
        stats.periodStart,
        stats.dateFrom,
        stats.date_from,
        stats.range?.from,
        stats.period?.from,
        stats.period?.start,
      ];
      const endCandidates = [
        stats.to,
        stats.end,
        stats.periodEnd,
        stats.dateTo,
        stats.date_to,
        stats.range?.to,
        stats.period?.to,
        stats.period?.end,
      ];

      const resolvedStart = startCandidates.map(parseTimestamp).find((value) => value !== null);
      const resolvedEnd = endCandidates.map(parseTimestamp).find((value) => value !== null);

      if (Number.isFinite(resolvedStart) && Number.isFinite(resolvedEnd) && resolvedEnd > resolvedStart) {
        return { start: resolvedStart, end: resolvedEnd };
      }

      return null;
    };

    const computeRowMetrics = (stats, cycles) => {
      const pnl = Number(stats?.netQuote ?? stats?.profitQuote ?? 0);
      const profitsCount = Number(stats?.profits ?? 0);
      const lossesCount = Number(stats?.losses ?? 0);
      const totalDeals = Number(stats?.totalDeals ?? 0);
      const avgDurationSec = Number(stats?.avgDuration ?? 0);
      const totalTradeDurationSec = avgDurationSec * totalDeals;
      const avgTradeDurationDays = totalDeals > 0 ? avgDurationSec / 86400 : 0;

      const drawdownTimeline = computeDrawdownTimeline(cycles);
      const concurrencyIntervals = computeIntervals(cycles);
      const riskInfo = buildRiskIntervals(cycles);
      const coverage = computeCoverage(concurrencyIntervals);
      const statsSpan = resolveStatsSpan(stats);

      let spanStart = Number.isFinite(coverage.minStart) ? coverage.minStart : Number.NaN;
      let spanEnd = Number.isFinite(coverage.maxEnd) ? coverage.maxEnd : Number.NaN;

      if (statsSpan) {
        if (!Number.isFinite(spanStart) || statsSpan.start < spanStart) {
          spanStart = statsSpan.start;
        }
        if (!Number.isFinite(spanEnd) || statsSpan.end > spanEnd) {
          spanEnd = statsSpan.end;
        }
      }

      const spanMs = Number.isFinite(spanStart) && Number.isFinite(spanEnd) && spanEnd > spanStart
        ? spanEnd - spanStart
        : Math.max(
            coverage.spanMs,
            statsSpan ? Math.max(0, statsSpan.end - statsSpan.start) : 0,
          );

      const downtimeDays = spanMs > 0
        ? Math.max(spanMs - coverage.totalActiveMs, 0) / MS_IN_DAY
        : 0;

      const activeDaySet = new Set();
      const markActiveRange = (startMs, endMs) => {
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
          return;
        }
        if (endMs < startMs) {
          return;
        }
        const startDay = Math.floor(startMs / MS_IN_DAY);
        const adjustedEnd = endMs > startMs ? endMs - 1 : endMs;
        const endDay = Math.floor(adjustedEnd / MS_IN_DAY);
        for (let day = startDay; day <= endDay; day += 1) {
          activeDaySet.add(day);
        }
      };

      concurrencyIntervals.forEach((interval) => {
        markActiveRange(Number(interval.start), Number(interval.end));
      });

      cycles.forEach((cycle) => {
        if (!cycle || cycle.status !== 'FINISHED') {
          return;
        }
        const interval = resolveCycleInterval(cycle);
        if (interval) {
          markActiveRange(interval.start, interval.end);
        }
        if (Array.isArray(cycle.orders)) {
          cycle.orders.forEach((order) => {
            const ts = Number(new Date(order.executedAt || order.createdAt || order.updatedAt || '').getTime());
            if (Number.isFinite(ts)) {
              activeDaySet.add(Math.floor(ts / MS_IN_DAY));
            }
          });
        }
      });

      return {
        id: Number(stats?.id),
        name: stats?.name || DRAW_ZERO,
        symbol: stats?.symbol || `${stats?.base ?? ''}/${stats?.quote ?? ''}`.replace(/^[\/]+|[\/]+$/g, '') || DRAW_ZERO,
        pnl,
        profitsCount,
        lossesCount,
        totalDeals,
        avgTradeDurationDays,
        maxDrawdown: drawdownTimeline.maxDrawdown,
        equityEvents: drawdownTimeline.events,
        totalTradeDurationSec,
        concurrencyIntervals,
        maxMPU: riskInfo.maxRisk,
        riskIntervals: riskInfo.riskIntervals,
        downtimeDays,
        spanStart: Number.isFinite(spanStart) ? spanStart : null,
        spanEnd: Number.isFinite(spanEnd) ? spanEnd : null,
        activeDurationMs: coverage.totalActiveMs,
        activeDayIndices: Array.from(activeDaySet),
      };
    };

    const computeAggregateDrawdown = (rows) => {
      const events = [];
      rows.forEach((row) => {
        const timeline = row.data?.equityEvents;
        if (Array.isArray(timeline)) {
          timeline.forEach((event) => {
            if (Number.isFinite(event.time) && Number.isFinite(event.delta)) {
              events.push({ time: event.time, delta: event.delta });
            }
          });
        }
      });

      if (events.length === 0) {
        return 0;
      }

      events.sort((a, b) => a.time - b.time);

      let cumulative = 0;
      let peak = 0;
      let maxDrawdown = 0;
      for (let index = 0; index < events.length;) {
        const currentTime = events[index].time;
        let deltaSum = 0;
        while (index < events.length && events[index].time === currentTime) {
          deltaSum += events[index].delta;
          index += 1;
        }
        cumulative += deltaSum;
        if (cumulative > peak) {
          peak = cumulative;
        }
        const drawdown = peak - cumulative;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
        }
      }

      return maxDrawdown;
    };

    const computeAggregateMPU = (rows) => {
      const events = [];
      rows.forEach((row) => {
        const riskIntervals = row.data?.riskIntervals;
        if (!Array.isArray(riskIntervals)) {
          return;
        }
        riskIntervals.forEach((interval) => {
          const value = Number(interval.value);
          if (!Number.isFinite(interval.start) || !Number.isFinite(interval.end) || interval.end < interval.start || !Number.isFinite(value) || value <= 0) {
            return;
          }
          events.push({ time: interval.start, delta: value, type: 'start' });
          events.push({ time: interval.end, delta: -value, type: 'end' });
        });
      });

      if (events.length === 0) {
        return 0;
      }

      events.sort((a, b) => {
        if (a.time === b.time) {
          if (a.type === b.type) return 0;
          return a.type === 'start' ? -1 : 1;
        }
        return a.time - b.time;
      });

      let current = 0;
      let max = 0;
      events.forEach((event) => {
        current += event.delta;
        if (current > max) {
          max = current;
        }
      });

      return max;
    };

    const computeNoTradeInfo = (rows) => {
      let minDay = Number.POSITIVE_INFINITY;
      let maxDay = Number.NEGATIVE_INFINITY;
      const activeDays = new Set();

      rows.forEach((row) => {
        const data = row.data;
        if (!data) {
          return;
        }

        if (Array.isArray(data.activeDayIndices)) {
          data.activeDayIndices.forEach((dayIndex) => {
            if (Number.isInteger(dayIndex)) {
              activeDays.add(dayIndex);
              if (dayIndex < minDay) {
                minDay = dayIndex;
              }
              if (dayIndex > maxDay) {
                maxDay = dayIndex;
              }
            }
          });
        }

        if (Number.isFinite(data.spanStart)) {
          const startDay = Math.floor(Number(data.spanStart) / MS_IN_DAY);
          if (startDay < minDay) {
            minDay = startDay;
          }
        }
        if (Number.isFinite(data.spanEnd)) {
          const spanEndValue = Number(data.spanEnd);
          const spanStartValue = Number.isFinite(data.spanStart) ? Number(data.spanStart) : spanEndValue;
          const endAnchor = spanEndValue > spanStartValue ? spanEndValue - 1 : spanEndValue;
          const endDay = Math.floor(endAnchor / MS_IN_DAY);
          if (endDay > maxDay) {
            maxDay = endDay;
          }
        }
      });

      if (!Number.isFinite(minDay) || !Number.isFinite(maxDay) || maxDay < minDay) {
        return { totalDays: 0, noTradeDays: 0 };
      }

      const totalDays = maxDay - minDay + 1;
      let activeDayCount = 0;
      for (let day = minDay; day <= maxDay; day += 1) {
        if (activeDays.has(day)) {
          activeDayCount += 1;
        }
      }

      const noTradeDays = Math.max(totalDays - activeDayCount, 0);
      return { totalDays, noTradeDays };
    };

    const computeConcurrency = (rows) => {
      const events = [];
      let minSpanStart = Number.POSITIVE_INFINITY;
      let maxSpanEnd = Number.NEGATIVE_INFINITY;

      rows.forEach((row) => {
        const data = row.data;
        if (!data) {
          return;
        }

        if (Number.isFinite(data.spanStart) && data.spanStart < minSpanStart) {
          minSpanStart = data.spanStart;
        }
        if (Number.isFinite(data.spanEnd) && data.spanEnd > maxSpanEnd) {
          maxSpanEnd = data.spanEnd;
        }

        if (!Array.isArray(data.concurrencyIntervals)) {
          return;
        }

        data.concurrencyIntervals.forEach((interval) => {
          if (Number.isFinite(interval.start) && Number.isFinite(interval.end) && interval.end >= interval.start) {
            events.push({ time: interval.start, type: 'start' });
            events.push({ time: interval.end, type: 'end' });
            if (interval.start < minSpanStart) {
              minSpanStart = interval.start;
            }
            if (interval.end > maxSpanEnd) {
              maxSpanEnd = interval.end;
            }
          }
        });
      });

      if (!Number.isFinite(minSpanStart) || !Number.isFinite(maxSpanEnd) || maxSpanEnd <= minSpanStart) {
        if (events.length > 0) {
          minSpanStart = Math.min(minSpanStart, events[0].time);
          maxSpanEnd = Math.max(maxSpanEnd, events[events.length - 1].time);
        } else {
          minSpanStart = Number.NaN;
          maxSpanEnd = Number.NaN;
        }
      }

      if (events.length === 0) {
        const totalSpanMs = Number.isFinite(minSpanStart) && Number.isFinite(maxSpanEnd) && maxSpanEnd > minSpanStart
          ? maxSpanEnd - minSpanStart
          : 0;
        return { max: 0, average: 0, totalSpanMs, zeroSpanMs: Math.max(totalSpanMs, 0) };
      }

      events.sort((a, b) => {
        if (a.time === b.time) {
          if (a.type === b.type) return 0;
          return a.type === 'start' ? -1 : 1;
        }
        return a.time - b.time;
      });

      let current = 0;
      let max = 0;
      let weightedSum = 0;
      let totalDuration = 0;
      let activeDuration = 0;
      let previousTime = events[0].time;

      if (!Number.isFinite(minSpanStart) || minSpanStart > previousTime) {
        minSpanStart = previousTime;
      }

      events.forEach((event) => {
        const { time, type } = event;
        if (time > previousTime) {
          const duration = time - previousTime;
          weightedSum += current * duration;
          totalDuration += duration;
          if (current > 0) {
            activeDuration += duration;
          }
          previousTime = time;
        }

        if (type === 'start') {
          current += 1;
          if (current > max) {
            max = current;
          }
        } else {
          current = Math.max(0, current - 1);
        }
      });

      const lastEventTime = previousTime;
      if (!Number.isFinite(maxSpanEnd) || maxSpanEnd < lastEventTime) {
        maxSpanEnd = lastEventTime;
      }

      if (maxSpanEnd > lastEventTime) {
        const tailDuration = maxSpanEnd - lastEventTime;
        if (current > 0) {
          activeDuration += tailDuration;
        }
        totalDuration += tailDuration;
      }

      const totalSpanMs = Number.isFinite(minSpanStart) && Number.isFinite(maxSpanEnd) && maxSpanEnd > minSpanStart
        ? maxSpanEnd - minSpanStart
        : totalDuration;
      const zeroSpanMs = Math.max(Math.min(totalSpanMs - activeDuration, totalSpanMs), 0);

      return {
        max,
        average: totalDuration > 0 ? weightedSum / totalDuration : 0,
        totalSpanMs,
        zeroSpanMs,
      };
    };

    const computePercentile = (values, percentile) => {
      if (!Array.isArray(values) || values.length === 0) {
        return 0;
      }
      const clamped = Math.min(Math.max(percentile, 0), 1);
      const sorted = values
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
        .sort((a, b) => a - b);

      if (sorted.length === 0) {
        return 0;
      }

      if (clamped <= 0) {
        return sorted[0];
      }
      if (clamped >= 1) {
        return sorted[sorted.length - 1];
      }

      const index = (sorted.length - 1) * clamped;
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      if (lower === upper) {
        return sorted[lower];
      }
      const weight = index - lower;
      return sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
    };

    const computeDailyConcurrency = (rows) => {
      const events = [];

      rows.forEach((row) => {
        const data = row.data;
        if (!data || !Array.isArray(data.concurrencyIntervals)) {
          return;
        }
        data.concurrencyIntervals.forEach((interval) => {
          if (Number.isFinite(interval.start) && Number.isFinite(interval.end) && interval.end > interval.start) {
            events.push({ time: interval.start, type: 'start' });
            events.push({ time: interval.end, type: 'end' });
          }
        });
      });

      if (events.length === 0) {
        return {
          days: [],
          stats: {
            meanMax: 0,
            p75: 0,
            p90: 0,
            p95: 0,
            limits: { p75: 0, p90: 0, p95: 0 },
          },
        };
      }

      events.sort((a, b) => {
        if (a.time === b.time) {
          if (a.type === b.type) return 0;
          return a.type === 'start' ? -1 : 1;
        }
        return a.time - b.time;
      });

      const dayMap = new Map();
      let current = 0;
      let previousTime = events[0].time;

      const accumulate = (start, end, count) => {
        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || count <= 0) {
          return;
        }
        let segmentStart = start;
        while (segmentStart < end) {
          const dayIndex = Math.floor(segmentStart / MS_IN_DAY);
          const dayEnd = Math.min(end, (dayIndex + 1) * MS_IN_DAY);
          const duration = dayEnd - segmentStart;
          if (duration <= 0) {
            break;
          }
          let entry = dayMap.get(dayIndex);
          if (!entry) {
            entry = {
              dayIndex,
              dayStartMs: dayIndex * MS_IN_DAY,
              activeDurationMs: 0,
              weightedSum: 0,
              maxCount: 0,
            };
            dayMap.set(dayIndex, entry);
          }
          entry.activeDurationMs += duration;
          entry.weightedSum += duration * count;
          if (count > entry.maxCount) {
            entry.maxCount = count;
          }
          segmentStart = dayEnd;
        }
      };

      events.forEach((event) => {
        const { time, type } = event;
        if (time > previousTime && current > 0) {
          accumulate(previousTime, time, current);
        }
        previousTime = time;
        if (type === 'start') {
          current += 1;
        } else {
          current = Math.max(0, current - 1);
        }
      });

      const days = Array.from(dayMap.values())
        .filter((entry) => entry.activeDurationMs > 0 && entry.maxCount > 0)
        .sort((a, b) => a.dayIndex - b.dayIndex)
        .map((entry) => ({
          dayIndex: entry.dayIndex,
          dayStartMs: entry.dayStartMs,
          activeDurationMs: entry.activeDurationMs,
          maxCount: entry.maxCount,
          avgActiveCount: entry.activeDurationMs > 0 ? entry.weightedSum / entry.activeDurationMs : 0,
        }));

      const dailyMaxValues = days.map((entry) => entry.maxCount).filter((value) => Number.isFinite(value));

      const meanMax = dailyMaxValues.length > 0
        ? dailyMaxValues.reduce((acc, value) => acc + value, 0) / dailyMaxValues.length
        : 0;
      const p75 = computePercentile(dailyMaxValues, 0.75);
      const p90 = computePercentile(dailyMaxValues, 0.9);
      const p95 = computePercentile(dailyMaxValues, 0.95);

      return {
        days,
        stats: {
          meanMax,
          p75,
          p90,
          p95,
          limits: {
            p75: Math.ceil(p75),
            p90: Math.ceil(p90),
            p95: Math.ceil(p95),
          },
        },
      };
    };

    const renderDailyConcurrencyChart = (canvas, records) => {
      if (!canvas) {
        return;
      }

      const context = canvas.getContext('2d');
      if (!context) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const cssWidth = rect.width || canvas.clientWidth || 0;
      const cssHeight = rect.height || canvas.clientHeight || 0;
      if (cssWidth <= 0 || cssHeight <= 0) {
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(cssWidth * dpr));
      const height = Math.max(1, Math.round(cssHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, width, height);
      if (dpr !== 1) {
        context.scale(dpr, dpr);
      }

      const drawWidth = width / dpr;
      const drawHeight = height / dpr;
      const chartLeft = 48;
      const chartRight = drawWidth - 16;
      const chartTop = 16;
      const chartBottom = drawHeight - 32;
      const chartWidth = Math.max(chartRight - chartLeft, 0);
      const chartHeight = Math.max(chartBottom - chartTop, 0);

      const values = Array.isArray(records) ? records.map((record) => Number(record?.maxCount) || 0) : [];
      const maxValue = values.length > 0 ? Math.max(...values) : 0;

      const drawBaselineOnly = values.length === 0 || chartWidth <= 0 || chartHeight <= 0;

      context.strokeStyle = 'rgba(148, 163, 184, 0.55)';
      context.lineWidth = 1.2;
      context.beginPath();
      context.moveTo(chartLeft, chartTop);
      context.lineTo(chartLeft, chartBottom);
      context.lineTo(chartRight, chartBottom);
      context.stroke();

      context.font = '11px sans-serif';
      context.fillStyle = 'rgba(100, 116, 139, 0.85)';
      context.textAlign = 'right';
      context.textBaseline = 'middle';

      if (drawBaselineOnly) {
        context.fillText('0', chartLeft - 8, chartBottom);
        return;
      }

      const effectiveMax = maxValue > 0 ? maxValue : 1;
      const horizontalSteps = 4;
      context.strokeStyle = 'rgba(148, 163, 184, 0.35)';
      context.lineWidth = 1;
      context.setLineDash([4, 4]);
      for (let step = 0; step <= horizontalSteps; step += 1) {
        const ratio = step / horizontalSteps;
        const y = chartBottom - chartHeight * ratio;
        context.beginPath();
        context.moveTo(chartLeft, y);
        context.lineTo(chartRight, y);
        context.stroke();
        const labelValue = effectiveMax * ratio;
        const label = labelValue >= 10 ? labelValue.toFixed(0) : labelValue.toFixed(1);
        context.fillText(label, chartLeft - 8, y);
      }
      context.setLineDash([]);

      const barWidth = chartWidth / values.length;
      const scaleY = chartHeight / effectiveMax;
      context.fillStyle = 'rgba(99, 102, 241, 0.7)';

      records.forEach((record, index) => {
        const numericValue = Math.max(Number(record?.maxCount) || 0, 0);
        if (numericValue <= 0) {
          return;
        }
        const barHeight = numericValue * scaleY;
        const baseX = chartLeft + index * barWidth;
        const bodyWidth = Math.max(Math.min(barWidth * 0.6, 28), Math.min(barWidth, 4));
        const barX = baseX + (barWidth - bodyWidth) / 2;
        const barY = chartBottom - barHeight;
        context.fillRect(barX, barY, bodyWidth, barHeight);
      });

      context.fillStyle = 'rgba(71, 85, 105, 0.9)';
      context.textAlign = 'center';
      context.textBaseline = 'top';

      const labelSlots = Math.min(8, records.length);
      const labelStep = Math.max(1, Math.floor(records.length / labelSlots));
      const labeledIndices = new Set();
      for (let index = 0; index < records.length; index += labelStep) {
        labeledIndices.add(index);
      }
      labeledIndices.add(records.length - 1);

      const formatDayLabel = (dayIndex) => {
        if (!Number.isFinite(dayIndex)) {
          return '';
        }
        try {
          const date = new Date(dayIndex * MS_IN_DAY);
          const timestamp = date.getTime();
          if (!Number.isFinite(timestamp)) {
            return '';
          }
          return date.toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' });
        } catch (error) {
          console.warn('[Veles multi backtests] Unable to format date label', error);
          return String(dayIndex);
        }
      };

      labeledIndices.forEach((index) => {
        const record = records[index];
        if (!record) {
          return;
        }
        const centerX = chartLeft + (index + 0.5) * barWidth;
        const label = formatDayLabel(record.dayIndex);
        if (label) {
          context.fillText(label, centerX, chartBottom + 6);
        }
      });
    };

    function renderAggregateRow(rowState) {
      if (!rowState || !rowState.cells) {
        return;
      }
      const metrics = rowState.data;
      const hasMetrics = Boolean(metrics) && !rowState.error;
      const isSelected = stateAgg.aggregateSelectedIds.has(rowState.idString);
      const showMetrics = hasMetrics && isSelected;

      const { cells } = rowState;

      if (cells.pnl) {
        if (showMetrics) {
          const pnlValue = Number(metrics.pnl ?? 0);
          cells.pnl.textContent = numberFormat(pnlValue, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
          cells.pnl.classList.toggle('veles-agg-positive', pnlValue > 0);
          cells.pnl.classList.toggle('veles-agg-negative', pnlValue < 0);
          cells.pnl.classList.toggle('veles-agg-neutral', Math.abs(pnlValue) <= 1e-9);
        } else {
          cells.pnl.textContent = DRAW_ZERO;
          cells.pnl.classList.remove('veles-agg-positive', 'veles-agg-negative');
          cells.pnl.classList.add('veles-agg-neutral');
        }
      }

      if (cells.deals) {
        if (showMetrics) {
          const profits = Number(metrics.profitsCount ?? 0);
          const losses = Number(metrics.lossesCount ?? 0);
          const total = Number(metrics.totalDeals ?? 0);
          cells.deals.innerHTML = `<span class="veles-agg-positive">${profits}</span> / <span class="veles-agg-negative">${losses}</span> / <span class="veles-agg-total">${total}</span>`;
        } else {
          cells.deals.innerHTML = `<span class="veles-agg-positive">${DRAW_ZERO}</span> / <span class="veles-agg-negative">${DRAW_ZERO}</span> / <span class="veles-agg-total">${DRAW_ZERO}</span>`;
        }
      }

      if (cells.avgDuration) {
        cells.avgDuration.textContent = showMetrics
          ? numberFormat(metrics.avgTradeDurationDays ?? 0, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : DRAW_ZERO;
      }

      if (cells.downtime) {
        cells.downtime.textContent = showMetrics
          ? numberFormat(metrics.downtimeDays ?? 0, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : DRAW_ZERO;
      }

      if (cells.drawdown) {
        if (showMetrics) {
          const drawdownValue = Number(metrics.maxDrawdown ?? 0);
          cells.drawdown.textContent = numberFormat(drawdownValue, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
          cells.drawdown.classList.toggle('veles-agg-negative', Math.abs(drawdownValue) > 1e-9);
          cells.drawdown.classList.toggle('veles-agg-neutral', Math.abs(drawdownValue) <= 1e-9);
        } else {
          cells.drawdown.textContent = DRAW_ZERO;
          cells.drawdown.classList.remove('veles-agg-negative');
          cells.drawdown.classList.add('veles-agg-neutral');
        }
      }

      if (cells.mpu) {
        if (showMetrics) {
          const mpuValue = Number(metrics.maxMPU ?? 0);
          cells.mpu.textContent = numberFormat(mpuValue, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
          cells.mpu.classList.toggle('veles-agg-negative', Math.abs(mpuValue) > 1e-9);
          cells.mpu.classList.toggle('veles-agg-neutral', Math.abs(mpuValue) <= 1e-9);
        } else {
          cells.mpu.textContent = DRAW_ZERO;
          cells.mpu.classList.remove('veles-agg-negative');
          cells.mpu.classList.add('veles-agg-neutral');
        }
      }

      if (rowState.row) {
        rowState.row.dataset.velesAggSelected = isSelected ? 'true' : 'false';
        rowState.row.style.display = '';
      }
    }

    const updateSummary = () => {
      const selectedRowStates = Array.from(stateAgg.aggregateSelectedIds)
        .filter((id) => stateAgg.sourceSelectedIds.has(id))
        .map((id) => stateAgg.rows.get(id))
        .filter(Boolean);

      const rowsWithData = selectedRowStates.filter((row) => row.data && !row.error);

      const totalSelected = selectedRowStates.length;
      const totalPnl = rowsWithData.reduce((acc, row) => acc + Number(row.data.pnl ?? 0), 0);
      const totalProfits = rowsWithData.reduce((acc, row) => acc + Number(row.data.profitsCount ?? 0), 0);
      const totalLosses = rowsWithData.reduce((acc, row) => acc + Number(row.data.lossesCount ?? 0), 0);
      const totalDeals = rowsWithData.reduce((acc, row) => acc + Number(row.data.totalDeals ?? 0), 0);
      const totalTradeDurationSec = rowsWithData.reduce((acc, row) => acc + Number(row.data.totalTradeDurationSec ?? 0), 0);
      const avgPnlPerDeal = totalDeals > 0 ? totalPnl / totalDeals : 0;
      const avgPnlPerBacktest = rowsWithData.length > 0 ? totalPnl / rowsWithData.length : 0;
      const avgTradeDurationDays = totalDeals > 0 ? totalTradeDurationSec / totalDeals / 86400 : 0;
      const avgMaxDrawdown = rowsWithData.length > 0
        ? rowsWithData.reduce((acc, row) => acc + Number(row.data.maxDrawdown ?? 0), 0) / rowsWithData.length
        : 0;

      const aggregatedDrawdown = computeAggregateDrawdown(rowsWithData);
      const concurrency = computeConcurrency(rowsWithData);
      const aggregateMPU = computeAggregateMPU(rowsWithData);
      const noTradeInfo = computeNoTradeInfo(rowsWithData);
      const noTradeDays = noTradeInfo.noTradeDays;
      const dailyConcurrency = computeDailyConcurrency(rowsWithData);
      const hasDailyConcurrency = dailyConcurrency.days.length > 0;
      const concurrencyStats = dailyConcurrency.stats || {};

      if (summaryRefs.totalSelected) {
        summaryRefs.totalSelected.textContent = String(totalSelected);
      }
      if (summaryRefs.totalPnl) {
        summaryRefs.totalPnl.textContent = numberFormat(totalPnl, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        summaryRefs.totalPnl.classList.toggle('veles-agg-positive', totalPnl > 0);
        summaryRefs.totalPnl.classList.toggle('veles-agg-negative', totalPnl < 0);
        summaryRefs.totalPnl.classList.toggle('veles-agg-neutral', Math.abs(totalPnl) <= 1e-9);
      }
      if (summaryRefs.deals) {
        const [profitSpan, lossSpan, totalSpan] = summaryRefs.deals.querySelectorAll('span');
        if (profitSpan) profitSpan.textContent = String(totalProfits);
        if (lossSpan) lossSpan.textContent = String(totalLosses);
        if (totalSpan) totalSpan.textContent = String(totalDeals);
      }
      if (summaryRefs.avgPnlDeal) {
        summaryRefs.avgPnlDeal.textContent = numberFormat(avgPnlPerDeal, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        summaryRefs.avgPnlDeal.classList.toggle('veles-agg-positive', avgPnlPerDeal > 0);
        summaryRefs.avgPnlDeal.classList.toggle('veles-agg-negative', avgPnlPerDeal < 0);
        summaryRefs.avgPnlDeal.classList.toggle('veles-agg-neutral', Math.abs(avgPnlPerDeal) <= 1e-9);
      }
      if (summaryRefs.avgPnlBacktest) {
        summaryRefs.avgPnlBacktest.textContent = numberFormat(avgPnlPerBacktest, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        summaryRefs.avgPnlBacktest.classList.toggle('veles-agg-positive', avgPnlPerBacktest > 0);
        summaryRefs.avgPnlBacktest.classList.toggle('veles-agg-negative', avgPnlPerBacktest < 0);
        summaryRefs.avgPnlBacktest.classList.toggle('veles-agg-neutral', Math.abs(avgPnlPerBacktest) <= 1e-9);
      }
      if (summaryRefs.avgDrawdown) {
        summaryRefs.avgDrawdown.textContent = numberFormat(avgMaxDrawdown, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        summaryRefs.avgDrawdown.classList.toggle('veles-agg-negative', Math.abs(avgMaxDrawdown) > 1e-9);
        summaryRefs.avgDrawdown.classList.toggle('veles-agg-neutral', Math.abs(avgMaxDrawdown) <= 1e-9);
      }
      if (summaryRefs.maxAggDrawdown) {
        summaryRefs.maxAggDrawdown.textContent = numberFormat(aggregatedDrawdown, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        summaryRefs.maxAggDrawdown.classList.toggle('veles-agg-negative', Math.abs(aggregatedDrawdown) > 1e-9);
        summaryRefs.maxAggDrawdown.classList.toggle('veles-agg-neutral', Math.abs(aggregatedDrawdown) <= 1e-9);
      }
      if (summaryRefs.maxAggMPU) {
        summaryRefs.maxAggMPU.textContent = numberFormat(aggregateMPU, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        summaryRefs.maxAggMPU.classList.toggle('veles-agg-negative', Math.abs(aggregateMPU) > 1e-9);
        summaryRefs.maxAggMPU.classList.toggle('veles-agg-neutral', Math.abs(aggregateMPU) <= 1e-9);
      }
      if (summaryRefs.maxConcurrent) {
        summaryRefs.maxConcurrent.textContent = numberFormat(concurrency.max, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        });
      }
      if (summaryRefs.avgConcurrent) {
        summaryRefs.avgConcurrent.textContent = numberFormat(concurrency.average, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      }
      if (summaryRefs.avgDuration) {
        summaryRefs.avgDuration.textContent = numberFormat(avgTradeDurationDays, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      }
      if (summaryRefs.noTradeDays) {
        summaryRefs.noTradeDays.textContent = numberFormat(noTradeDays, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        });
        summaryRefs.noTradeDays.classList.remove('veles-agg-positive', 'veles-agg-negative');
        summaryRefs.noTradeDays.classList.add('veles-agg-neutral');
      }
      if (summaryRefs.concurrencyMean) {
        if (hasDailyConcurrency && Number.isFinite(concurrencyStats.meanMax)) {
          summaryRefs.concurrencyMean.textContent = numberFormat(concurrencyStats.meanMax, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        } else {
          summaryRefs.concurrencyMean.textContent = DRAW_ZERO;
        }
      }
      if (summaryRefs.concurrencyP75) {
        if (hasDailyConcurrency && Number.isFinite(concurrencyStats.p75)) {
          summaryRefs.concurrencyP75.textContent = numberFormat(concurrencyStats.p75, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        } else {
          summaryRefs.concurrencyP75.textContent = DRAW_ZERO;
        }
      }
      if (summaryRefs.concurrencyP90) {
        if (hasDailyConcurrency && Number.isFinite(concurrencyStats.p90)) {
          summaryRefs.concurrencyP90.textContent = numberFormat(concurrencyStats.p90, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        } else {
          summaryRefs.concurrencyP90.textContent = DRAW_ZERO;
        }
      }
      if (summaryRefs.concurrencyP95) {
        if (hasDailyConcurrency && Number.isFinite(concurrencyStats.p95)) {
          summaryRefs.concurrencyP95.textContent = numberFormat(concurrencyStats.p95, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        } else {
          summaryRefs.concurrencyP95.textContent = DRAW_ZERO;
        }
      }
      if (summaryRefs.concurrencyLimitNote) {
        if (hasDailyConcurrency && concurrencyStats.limits) {
          const limitParts = [];
          if (Number.isFinite(concurrencyStats.limits.p75) && concurrencyStats.limits.p75 > 0) {
            limitParts.push(`P75 -> ${concurrencyStats.limits.p75}`);
          }
          if (Number.isFinite(concurrencyStats.limits.p90) && concurrencyStats.limits.p90 > 0) {
            limitParts.push(`P90 -> ${concurrencyStats.limits.p90}`);
          }
          if (Number.isFinite(concurrencyStats.limits.p95) && concurrencyStats.limits.p95 > 0) {
            limitParts.push(`P95 -> ${concurrencyStats.limits.p95}`);
          }
          summaryRefs.concurrencyLimitNote.textContent = limitParts.length > 0
            ? `Округлённые варианты лимита: ${limitParts.join(', ')}.`
            : 'Недостаточно данных для расчёта лимитов.';
        } else {
          summaryRefs.concurrencyLimitNote.textContent = 'Недостаточно данных для расчёта лимитов.';
        }
      }

      const chartCanvas = stateAgg.elements.concurrencyChart;
      const chartEmptyState = stateAgg.elements.concurrencyEmpty;
      if (chartCanvas) {
        if (hasDailyConcurrency) {
          chartCanvas.style.display = 'block';
          renderDailyConcurrencyChart(chartCanvas, dailyConcurrency.days);
        } else {
          const ctx = chartCanvas.getContext('2d');
          if (ctx) {
            const width = chartCanvas.width || 0;
            const height = chartCanvas.height || 0;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, width, height);
          }
          chartCanvas.style.display = 'none';
        }
      }
      if (chartEmptyState) {
        chartEmptyState.style.display = hasDailyConcurrency ? 'none' : 'flex';
      }

      if (stateAgg.elements.selectAll) {
        const totalRows = stateAgg.sourceSelectedIds.size;
        let selectedCount = 0;
        stateAgg.sourceSelectedIds.forEach((id) => {
          if (stateAgg.aggregateSelectedIds.has(id)) {
            selectedCount += 1;
          }
        });
        stateAgg.elements.selectAll.disabled = totalRows === 0;
        stateAgg.elements.selectAll.indeterminate = selectedCount > 0 && selectedCount < totalRows;
        stateAgg.elements.selectAll.checked = totalRows > 0 && selectedCount === totalRows;
      }

      stateAgg.sourceTables.forEach((entry, table) => {
        if (!entry?.master) {
          return;
        }
        const rowsInTable = [];
        stateAgg.rows.forEach((rowState) => {
          if (rowState.sourceTable === table) {
            rowsInTable.push(rowState);
          }
        });
        if (rowsInTable.length === 0) {
          entry.master.checked = false;
          entry.master.indeterminate = false;
          entry.master.disabled = true;
          return;
        }

        entry.master.disabled = false;
        const selectedInTable = rowsInTable.filter((rowState) => stateAgg.sourceSelectedIds.has(rowState.idString)).length;
        entry.master.checked = selectedInTable > 0 && selectedInTable === rowsInTable.length;
        entry.master.indeterminate = selectedInTable > 0 && selectedInTable < rowsInTable.length;
      });

    };

    const fetchJson = async (url) => {
      const response = await window.fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          accept: 'application/json, text/plain, */*',
        },
      });
      if (!response.ok) {
        const text = await response.text();
        const message = text ? text.slice(0, 200) : `HTTP ${response.status}`;
        throw new Error(message);
      }
      return response.json();
    };

    const fetchCycles = async (id, stats) => {
      const cycles = [];
      const baseUrl = `${API_BASE}/${id}/cycles`;
      const baseParams = new URLSearchParams();
      baseParams.set('size', String(PAGE_SIZE));
      baseParams.set('sort', 'date,desc');
      if (stats?.from) {
        baseParams.set('from', stats.from);
      }
      if (stats?.to) {
        baseParams.set('to', stats.to);
      }

      let page = 0;
      let totalPages = null;

      while (true) {
        baseParams.set('page', String(page));
        const url = `${baseUrl}?${baseParams.toString()}`;
        registerRequests(1);
        let json;
        try {
          json = await fetchJson(url);
        } finally {
          markRequestCompleted();
        }
        const pageContent = Array.isArray(json?.content) ? json.content : [];
        cycles.push(...pageContent);

        if (totalPages === null) {
          totalPages = Number(json?.totalPages ?? 1);
          if (!Number.isFinite(totalPages) || totalPages <= 0) {
            totalPages = 1;
          }
        }

        page += 1;
        if (page >= totalPages || pageContent.length < PAGE_SIZE) {
          break;
        }
      }

      return cycles;
    };

    const fetchBacktest = async (rowState) => {
      setRowStatus(rowState, 'Загрузка...', 'info');
      const statsUrl = `${API_BASE}/${rowState.idString}`;
      registerRequests(1);
      let stats;
      try {
        stats = await fetchJson(statsUrl);
      } finally {
        markRequestCompleted();
      }

      const cycles = await fetchCycles(rowState.idString, stats);
      const metrics = computeRowMetrics(stats, cycles);
      applyRowData(rowState, metrics);
      addLog(`Бэктест ${rowState.idString} загружен: ${formatSigned(metrics.pnl)} P&L, ${metrics.totalDeals} сделок.`);
    };

    const runAggregation = async () => {
      if (!stateAgg.active || stateAgg.isFetching) {
        return;
      }

      ensurePanelHost();
      const selectedRows = Array.from(stateAgg.sourceSelectedIds)
        .map((id) => stateAgg.rows.get(id))
        .filter(Boolean);
      if (selectedRows.length === 0) {
        addLog('Выберите хотя бы один бэктест перед запуском агрегации.', 'warn');
        return;
      }

      stateAgg.isFetching = true;
      stateAgg.elements.runButton?.setAttribute('disabled', 'true');
      stateAgg.elements.refreshButton?.setAttribute('disabled', 'true');
      resetProgress();
      addLog(`Запуск агрегации для ${selectedRows.length} бэктестов...`);

      for (let index = 0; index < selectedRows.length; index += 1) {
        const rowState = selectedRows[index];
        try {
          await fetchBacktest(rowState);
        } catch (error) {
          setRowError(rowState, error);
        }
        updateSummary();
      }

      addLog('Загрузка аггрегированных данных завершена.');
      stateAgg.elements.runButton?.removeAttribute('disabled');
      stateAgg.elements.refreshButton?.removeAttribute('disabled');
      stateAgg.isFetching = false;
      updateSummary();
    };

    const cleanupSourceAugmentations = () => {
      stateAgg.sourceTables.forEach((entry, container) => {
        if (!(container instanceof Element)) {
          return;
        }
        try {
          if (container.tagName === 'TABLE') {
            container.querySelectorAll('th.veles-agg-source-header').forEach((node) => node.remove());
            container.querySelectorAll('td[data-veles-agg-source]').forEach((node) => node.remove());
          } else {
            container.classList.remove('veles-agg-source-container');
            container.querySelectorAll('[data-veles-agg-source]').forEach((node) => node.remove());
          }
        } catch (error) {
          console.warn('[Veles multi backtests] Unable to cleanup augmented source container', error);
        }
      });
      stateAgg.sourceTables.clear();
    };

    const resetPanelState = () => {
      stateAgg.rows.forEach((rowState) => {
        if (rowState?.sourceRow?.dataset?.velesAggRow) {
          delete rowState.sourceRow.dataset.velesAggRow;
        }
      });
      stateAgg.rows.clear();
      stateAgg.sourceSelectedIds.clear();
      stateAgg.aggregateSelectedIds.clear();
      stateAgg.lastScanCount = 0;
      stateAgg.isFetching = false;
      resetProgress();

      if (stateAgg.elements.tableBody) {
        stateAgg.elements.tableBody.innerHTML = '';
      }
      if (stateAgg.elements.emptyState) {
        stateAgg.elements.emptyState.style.display = 'block';
      }
      if (stateAgg.elements.selectAll) {
        stateAgg.elements.selectAll.checked = false;
        if ('indeterminate' in stateAgg.elements.selectAll) {
          stateAgg.elements.selectAll.indeterminate = false;
        }
      }
      stateAgg.elements.runButton?.removeAttribute('disabled');
      stateAgg.elements.refreshButton?.removeAttribute('disabled');
      if (stateAgg.elements.log) {
        stateAgg.elements.log.innerHTML = '';
      }

      updateSummary();
    };

    const detachPanel = () => {
      if (stateAgg.panel?.parentElement) {
        stateAgg.panel.parentElement.removeChild(stateAgg.panel);
      }
    };

    const ensureDomObserver = () => {
      if (stateAgg.domObserver) {
        if (stateAgg.active && document.body) {
          try {
            stateAgg.domObserver.observe(document.body, { childList: true, subtree: true });
          } catch (error) {
            // observer already attached
          }
        }
        return;
      }

      const observer = new MutationObserver((mutations) => {
        if (!stateAgg.active) {
          return;
        }

        const hasExternalMutation = mutations.some((mutation) => {
          const target = mutation.target;
          if (!target) {
            return false;
          }
          if (target.nodeType === Node.ELEMENT_NODE) {
            return !target.closest(`#${PANEL_ID}`);
          }
          if (target.parentElement) {
            return !target.parentElement.closest(`#${PANEL_ID}`);
          }
          return false;
        });

        if (!hasExternalMutation) {
          return;
        }

        const previousCount = stateAgg.lastScanCount;
        window.requestAnimationFrame(() => {
          if (!stateAgg.active) {
            return;
          }
          const count = refreshRows();
          if (count !== previousCount) {
            addLog(`Обновление списка бэктестов: найдено ${count}.`);
          }
        });
      });

      stateAgg.domObserver = observer;

      const attach = () => {
        if (!stateAgg.active || stateAgg.domObserver !== observer) {
          return;
        }
        if (document.body) {
          observer.observe(document.body, { childList: true, subtree: true });
        } else {
          window.requestAnimationFrame(attach);
        }
      };

      attach();
    };

    const activate = () => {
      if (stateAgg.active) {
        refreshRows();
        return;
      }

      stateAgg.active = true;
      ensurePanelHost();
      refreshRows();
      ensureDomObserver();
    };

    const cleanupSourceAugmentationsSafe = () => {
      try {
        cleanupSourceAugmentations();
      } catch (error) {
        console.warn('[Veles multi backtests] Cleanup failed', error);
      }
    };

    const resetSummaryRefs = () => {
      Object.keys(summaryRefs).forEach((key) => {
        summaryRefs[key] = null;
      });
    };

    const deactivate = () => {
      if (!stateAgg.active) {
        detachPanel();
        resetPanelState();
        resetSummaryRefs();
        stateAgg.panel = null;
        stateAgg.elements = {};
        return;
      }

      stateAgg.active = false;

      if (stateAgg.domObserver) {
        try {
          stateAgg.domObserver.disconnect();
        } catch (error) {
          console.warn('[Veles multi backtests] Unable to disconnect observer', error);
        }
        stateAgg.domObserver = null;
      }

      cleanupSourceAugmentationsSafe();
      resetPanelState();
      detachPanel();
      resetSummaryRefs();
      stateAgg.panel = null;
      stateAgg.elements = {};
    };

    const handleLocationChange = () => {
      if (!stateAgg.initialized) {
        return;
      }

      if (isOnTargetPage()) {
        activate();
      } else {
        deactivate();
      }
    };

    const scheduleLocationCheck = () => {
      if (stateAgg.locationChangeScheduled) {
        return;
      }
      stateAgg.locationChangeScheduled = true;
      window.requestAnimationFrame(() => {
        stateAgg.locationChangeScheduled = false;
        handleLocationChange();
      });
    };

    const ensureLocationListeners = () => {
      if (!stateAgg.locationListenerAttached) {
        const onNavigation = () => {
          scheduleLocationCheck();
        };
        window.addEventListener('popstate', onNavigation);
        window.addEventListener('hashchange', onNavigation);
        stateAgg.locationListenerAttached = true;
      }

      if (!stateAgg.historyPatched) {
        const patchHistory = (method) => {
          const original = history[method];
          if (typeof original !== 'function') {
            return;
          }
          history[method] = function patchedHistoryMethod(...args) {
            const result = original.apply(this, args);
            scheduleLocationCheck();
            return result;
          };
        };
        patchHistory('pushState');
        patchHistory('replaceState');
        stateAgg.historyPatched = true;
      }
    };

    const init = () => {
      if (!stateAgg.initialized) {
        stateAgg.initialized = true;
        ensureLocationListeners();
      }

      handleLocationChange();
    };

    return { init };
  })();

  namespace.aggregator = aggregator;
})();
