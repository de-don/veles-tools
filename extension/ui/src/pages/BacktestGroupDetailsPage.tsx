import type { MenuProps } from 'antd';
import { Alert, Button, Card, Dropdown, Empty, Input, Modal, message, Progress, Radio, Select } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import BacktestAggregationConfigPanel from '../components/backtests/BacktestAggregationConfigPanel';
import BacktestAnalyticsPanel from '../components/backtests/BacktestAnalyticsPanel';
import BacktestInfoTable from '../components/backtests/BacktestInfoTable';
import RenameBacktestGroupModal from '../components/backtests/RenameBacktestGroupModal';
import CreateBotsFromBacktestsModal, { type BacktestBotTarget } from '../components/CreateBotsFromBacktestsModal';
import PageHeader from '../components/ui/PageHeader';
import { useBacktestGroups } from '../context/BacktestGroupsContext';
import type { LimitImpactPoint } from '../lib/chartOptions';
import { aggregateBacktestsMetrics, DEFAULT_AGGREGATION_CONFIG } from '../services/backtestAggregations';
import { buildBacktestInfo } from '../services/backtestInfos';
import { backtestsService } from '../services/backtests';
import { readAggregationConfig, writeAggregationConfig } from '../storage/backtestAggregationConfigStore';
import { readLimitAnalysisPreferences, writeLimitAnalysisPreferences } from '../storage/backtestLimitAnalysisStore';
import type { AggregatedBacktestsMetrics, AggregationConfig } from '../types/backtestAggregations';
import type { BacktestGroup } from '../types/backtestGroups';
import type { BacktestInfo } from '../types/backtestInfos';
import type { BacktestCycle, BacktestDetail } from '../types/backtests';

interface BacktestGroupDetailsPageProps {
  extensionReady: boolean;
}

interface CachedBacktestSource {
  id: number;
  detail: BacktestDetail | null;
  cycles: BacktestCycle[] | null;
}

interface CompleteBacktestSource {
  id: number;
  detail: BacktestDetail;
  cycles: BacktestCycle[];
}

const isCompleteSource = (source: CachedBacktestSource): source is CompleteBacktestSource => {
  return Boolean(source.detail) && Array.isArray(source.cycles);
};

const DEFAULT_LIMIT_IMPACT_VALUE = 5;

const BacktestGroupDetailsPage = ({ extensionReady }: BacktestGroupDetailsPageProps) => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { groups, createGroup, deleteGroup, updateGroupName, removeBacktests, transferBacktests } = useBacktestGroups();
  const [messageApi, messageContextHolder] = message.useMessage();
  const group: BacktestGroup | null = useMemo(() => {
    return groups.find((item) => item.id === groupId) ?? null;
  }, [groupId, groups]);

  const [backtestInfos, setBacktestInfos] = useState<BacktestInfo[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [missingIds, setMissingIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [missingLoading, setMissingLoading] = useState(false);
  const [missingProgress, setMissingProgress] = useState<{ completed: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [aggregationConfig, setAggregationConfig] = useState<AggregationConfig>(DEFAULT_AGGREGATION_CONFIG);
  const [detailsById, setDetailsById] = useState<Map<number, BacktestDetail>>(() => new Map());
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferTargetGroupId, setTransferTargetGroupId] = useState<string | null>(null);
  const [transferMode, setTransferMode] = useState<'existing' | 'new'>('existing');
  const [newGroupName, setNewGroupName] = useState('');
  const [createBotsOpen, setCreateBotsOpen] = useState(false);
  const [botTargets, setBotTargets] = useState<BacktestBotTarget[]>([]);
  const [limitImpactValue, setLimitImpactValue] = useState(DEFAULT_LIMIT_IMPACT_VALUE);
  const [limitImpactPoints, setLimitImpactPoints] = useState<LimitImpactPoint[] | null>(null);
  const [limitImpactLoading, setLimitImpactLoading] = useState(false);

  const orderInfos = useCallback(
    (infoMap: Map<number, BacktestInfo>, orderOverride?: number[]): BacktestInfo[] => {
      const order = orderOverride ?? group?.backtestIds ?? [];
      return order.map((id) => infoMap.get(id) ?? null).filter((info): info is BacktestInfo => Boolean(info));
    },
    [group],
  );

  const syncStateWithGroupIds = useCallback(
    (nextGroupIds: number[]) => {
      const idsSet = new Set(nextGroupIds);
      setBacktestInfos((prev) => {
        const infoMap = new Map<number, BacktestInfo>(
          prev.filter((info) => idsSet.has(info.id)).map((info) => [info.id, info]),
        );
        return orderInfos(infoMap, nextGroupIds);
      });
      setSelectedIds((prev) => prev.filter((id) => idsSet.has(id)));
      setMissingIds((prev) => prev.filter((id) => idsSet.has(id)));
      setDetailsById((prev) => {
        const next = new Map<number, BacktestDetail>();
        nextGroupIds.forEach((id) => {
          const detail = prev.get(id);
          if (detail) {
            next.set(id, detail);
          }
        });
        return next;
      });
    },
    [orderInfos],
  );

  useEffect(() => {
    if (!group) {
      setAggregationConfig(DEFAULT_AGGREGATION_CONFIG);
      return;
    }
    const stored = readAggregationConfig(group.id);
    const maxAllowed = Math.max(1, group.backtestIds.length);
    if (stored) {
      const normalized = Math.min(Math.max(1, stored.maxConcurrentPositions), maxAllowed);
      setAggregationConfig({ ...stored, maxConcurrentPositions: normalized });
      return;
    }
    setAggregationConfig((prev) => {
      const normalized = Math.min(Math.max(1, prev.maxConcurrentPositions), maxAllowed);
      if (normalized === prev.maxConcurrentPositions) {
        return prev;
      }
      return { ...prev, maxConcurrentPositions: normalized };
    });
  }, [group]);

  useEffect(() => {
    if (!group) {
      setBacktestInfos([]);
      setSelectedIds([]);
      setMissingIds([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setError(null);
      setLoading(true);
      setDetailsById(new Map());

      try {
        const cachedSources: CachedBacktestSource[] = await Promise.all(
          group.backtestIds.map(async (id) => {
            const [detail, cycles] = await Promise.all([
              backtestsService.readCachedBacktestDetail(id),
              backtestsService.readCachedBacktestCycles(id, {
                pageSize: backtestsService.DEFAULT_CYCLES_PAGE_SIZE,
              }),
            ]);
            return { id, detail, cycles };
          }),
        );

        if (cancelled) {
          return;
        }

        const completeSources = cachedSources.filter(isCompleteSource);
        const infoMap = new Map<number, BacktestInfo>();
        completeSources.forEach((source) => {
          infoMap.set(source.id, buildBacktestInfo(source.detail, source.cycles));
        });
        const orderedInfos = orderInfos(infoMap);

        setBacktestInfos(orderedInfos);
        setSelectedIds(orderedInfos.map((info) => info.id));
        setMissingIds(cachedSources.filter((source) => !isCompleteSource(source)).map((source) => source.id));
        setDetailsById(new Map(completeSources.map((source) => [source.id, source.detail])));
      } catch (loadError) {
        if (!cancelled) {
          console.warn('[Backtest Group Details] Ошибка чтения кеша', loadError);
          setError('Не удалось прочитать локальные данные бэктестов.');
          setBacktestInfos([]);
          setSelectedIds([]);
          setMissingIds(group.backtestIds);
          setDetailsById(new Map());
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [group, orderInfos]);

  const totalBacktests = group?.backtestIds.length ?? 0;

  useEffect(() => {
    if (!group) {
      return;
    }
    const maxAllowed = Math.max(1, totalBacktests);
    setAggregationConfig((prev) => {
      if (prev.maxConcurrentPositions <= maxAllowed) {
        return prev;
      }
      const next = { ...prev, maxConcurrentPositions: maxAllowed };
      writeAggregationConfig(group.id, next);
      return next;
    });
  }, [group, totalBacktests]);

  const handleDeleteGroup = () => {
    if (!group) {
      return;
    }
    Modal.confirm({
      title: `Удалить группу «${group.name}»?`,
      content: 'Сама выборка бэктестов останется доступной в списке, но группа будет удалена без возможности отмены.',
      okText: 'Удалить',
      okButtonProps: { danger: true },
      cancelText: 'Отмена',
      onOk: () => {
        deleteGroup(group.id);
        messageApi.success(`Группа «${group.name}» удалена.`);
        navigate('/backtest-groups');
      },
    });
  };

  const handleRenameSubmit = (name: string) => {
    if (!group) {
      return;
    }
    const result = updateGroupName(group.id, name);
    if (!result) {
      messageApi.error('Не удалось переименовать группу.');
      return;
    }
    messageApi.success(`Группа переименована в «${result.name}».`);
    setRenameOpen(false);
  };

  const handleSelectionChange = useCallback((ids: number[]) => {
    setSelectedIds(ids);
  }, []);

  const handleLoadMissing = useCallback(() => {
    if (!group) {
      return;
    }
    if (missingIds.length === 0) {
      messageApi.info('Все необходимые данные уже загружены.');
      return;
    }
    if (!extensionReady) {
      messageApi.warning('Загрузка возможна только при активном расширении.');
      return;
    }

    const pendingMissingCount = missingIds.length;
    setMissingLoading(true);
    setMissingProgress({ completed: 0, total: pendingMissingCount });
    setError(null);

    const loadMissing = async () => {
      try {
        const successful: CompleteBacktestSource[] = [];
        let processed = 0;
        for (const id of missingIds) {
          try {
            // eslint-disable-next-line no-await-in-loop -- последовательные загрузки нужны для соблюдения задержек моста
            const [detail, cycles] = await Promise.all([
              backtestsService.getBacktestDetail(id, { forceRefresh: true }),
              backtestsService.getBacktestCycles(id, {
                forceRefresh: true,
                pageSize: backtestsService.DEFAULT_CYCLES_PAGE_SIZE,
              }),
            ]);
            successful.push({ id, detail, cycles });
          } catch (fetchError) {
            console.warn(`[Backtest Group Details] Не удалось загрузить бэктест ${id}`, fetchError);
          }
          processed += 1;
          setMissingProgress((prev) => (prev ? { ...prev, completed: processed } : prev));
        }

        if (successful.length === 0) {
          messageApi.error('Не удалось загрузить данные из API.');
          return;
        }

        const infoMap = new Map(backtestInfos.map((info) => [info.id, info] as const));
        successful.forEach((entry) => {
          infoMap.set(entry.id, buildBacktestInfo(entry.detail, entry.cycles));
        });
        const orderedInfos = orderInfos(infoMap);

        setBacktestInfos(orderedInfos);
        const nextMissing = group.backtestIds.filter((id) => !infoMap.has(id));
        setMissingIds(nextMissing);
        setSelectedIds((prevSelected) => {
          const selection = new Set(prevSelected);
          successful.forEach((entry) => void selection.add(entry.id));
          return orderedInfos.map((info) => info.id).filter((id) => selection.has(id));
        });
        setDetailsById((prev) => {
          const next = new Map(prev);
          successful.forEach((entry) => {
            next.set(entry.id, entry.detail);
          });
          return next;
        });

        if (nextMissing.length === 0) {
          messageApi.success('Все данные загружены.');
        } else {
          messageApi.success(`Загружено ${successful.length} из ${pendingMissingCount} бэктестов.`);
        }
      } catch (loadError) {
        console.warn('[Backtest Group Details] Ошибка загрузки данных из API', loadError);
        setError('Не удалось загрузить данные из API.');
      } finally {
        setMissingLoading(false);
        setMissingProgress(null);
      }
    };

    void loadMissing();
  }, [backtestInfos, extensionReady, group, messageApi, missingIds, orderInfos]);

  const loadedCount = backtestInfos.length;
  const selectedCount = selectedIds.length;
  const missingCount = missingIds.length;
  const tableLoading = loading || missingLoading;
  const hasData = backtestInfos.length > 0;
  const shouldRenderTable = tableLoading || hasData;
  const missingProgressPercent =
    missingProgress && missingProgress.total > 0
      ? Math.round((missingProgress.completed / missingProgress.total) * 100)
      : 0;
  const selectedBacktests = useMemo(() => {
    if (selectedIds.length === 0) {
      return [] as BacktestInfo[];
    }
    const selectedSet = new Set(selectedIds);
    return backtestInfos.filter((info) => selectedSet.has(info.id));
  }, [backtestInfos, selectedIds]);

  const aggregatedMetrics = useMemo<AggregatedBacktestsMetrics | null>(() => {
    if (selectedBacktests.length === 0) {
      return null;
    }
    return aggregateBacktestsMetrics(selectedBacktests, aggregationConfig);
  }, [selectedBacktests, aggregationConfig]);

  const handleAggregationConfigChange = useCallback(
    (config: AggregationConfig) => {
      setAggregationConfig(config);
      if (group) {
        writeAggregationConfig(group.id, config);
      }
    },
    [group],
  );

  const analyticsQuote = selectedBacktests[0]?.quote ?? 'USDT';
  const maxAggregationLimit = Math.max(1, totalBacktests || 1);
  const limitSliderCap = Math.max(1, totalBacktests || 1);

  const clampLimitImpactValue = useCallback(
    (value: number) => {
      const normalized = Math.round(value);
      return Math.min(Math.max(1, normalized), limitSliderCap);
    },
    [limitSliderCap],
  );

  useEffect(() => {
    if (!group) {
      setLimitImpactValue(DEFAULT_LIMIT_IMPACT_VALUE);
      setLimitImpactPoints(null);
      return;
    }
    const stored = readLimitAnalysisPreferences(group.id);
    setLimitImpactValue((prev) => {
      const base = stored?.maxLimit ?? prev ?? DEFAULT_LIMIT_IMPACT_VALUE;
      const next = clampLimitImpactValue(base);
      if (!stored || stored.maxLimit !== next) {
        writeLimitAnalysisPreferences(group.id, { maxLimit: next });
      }
      return next;
    });
  }, [clampLimitImpactValue, group]);

  useEffect(() => {
    void [backtestInfos, selectedIds];
    setLimitImpactPoints(null);
  }, [backtestInfos, selectedIds]);

  const handleLimitImpactValueChange = useCallback(
    (value: number) => {
      if (!group) {
        return;
      }
      const normalized = clampLimitImpactValue(value);
      setLimitImpactValue(normalized);
      writeLimitAnalysisPreferences(group.id, { maxLimit: normalized });
    },
    [clampLimitImpactValue, group],
  );

  const handleComputeLimitImpact = useCallback(async () => {
    if (selectedBacktests.length === 0) {
      messageApi.warning('Выберите бэктесты для расчёта лимита.');
      return;
    }
    setLimitImpactLoading(true);
    try {
      const maxLimit = clampLimitImpactValue(limitImpactValue);
      const points: LimitImpactPoint[] = [];
      for (let limit = 1; limit <= maxLimit; limit += 1) {
        const summary = aggregateBacktestsMetrics(selectedBacktests, {
          ...aggregationConfig,
          maxConcurrentPositions: limit,
        });
        const worstRisk = Math.max(summary.maxAggregatedDrawdown, summary.maxConcurrentMae);
        points.push({
          label: `${limit}`,
          totalPnl: summary.totalProfitQuote,
          aggregateDrawdown: summary.maxAggregatedDrawdown,
          aggregateMPU: summary.maxConcurrentMae,
          aggregateWorstRisk: worstRisk,
          aggregateRiskEfficiency: worstRisk === 0 ? null : summary.totalProfitQuote / Math.max(1, worstRisk),
        });
        // Allow UI thread to repaint between heavy iterations
        // eslint-disable-next-line no-await-in-loop -- sequential throttling to prevent UI freeze
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      setLimitImpactPoints(points);
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      messageApi.error(`Не удалось рассчитать влияние лимита: ${messageText}`);
    } finally {
      setLimitImpactLoading(false);
    }
  }, [aggregationConfig, clampLimitImpactValue, limitImpactValue, messageApi, selectedBacktests]);

  const availableTransferGroups = useMemo(
    () => (group ? groups.filter((item) => item.id !== group.id) : []),
    [group, groups],
  );

  const hasSelection = selectedIds.length > 0;
  const canTransfer = hasSelection;
  const canCreateBots = hasSelection && selectedIds.every((id) => detailsById.has(id));
  const canInvertSelection = backtestInfos.length > 0;

  const handleDeleteSelected = useCallback(() => {
    if (!group || selectedIds.length === 0) {
      return;
    }
    Modal.confirm({
      title: 'Удалить выбранные бэктесты из группы?',
      content: `Будет удалено ${selectedIds.length} элементов.`,
      okText: 'Удалить',
      okButtonProps: { danger: true },
      cancelText: 'Отмена',
      onOk: () => {
        const updatedGroup = removeBacktests(group.id, selectedIds);
        if (!updatedGroup) {
          messageApi.error('Не удалось удалить бэктесты из группы.');
          return;
        }
        syncStateWithGroupIds(updatedGroup.backtestIds);
        messageApi.success('Бэктесты удалены из группы.');
      },
    });
  }, [group, messageApi, removeBacktests, selectedIds, syncStateWithGroupIds]);

  const handleInvertSelection = useCallback(() => {
    if (backtestInfos.length === 0) {
      return;
    }
    setSelectedIds((prev) => {
      const selectedSet = new Set(prev);
      return backtestInfos.map((info) => info.id).filter((id) => !selectedSet.has(id));
    });
  }, [backtestInfos]);

  const handleOpenTransfer = useCallback(() => {
    if (!canTransfer) {
      return;
    }
    const hasAvailableGroups = availableTransferGroups.length > 0;
    setTransferMode(hasAvailableGroups ? 'existing' : 'new');
    setTransferTargetGroupId(availableTransferGroups[0]?.id ?? null);
    setNewGroupName('');
    setTransferModalOpen(true);
  }, [availableTransferGroups, canTransfer]);

  const handleTransferSubmit = useCallback(() => {
    if (!group) {
      return;
    }
    if (selectedIds.length === 0) {
      return;
    }
    if (transferMode === 'new') {
      const createdGroup = createGroup(newGroupName, selectedIds);
      if (!createdGroup) {
        messageApi.error('Укажите имя новой группы.');
        return;
      }
      const updatedGroup = removeBacktests(group.id, selectedIds);
      if (!updatedGroup) {
        messageApi.error('Не удалось перенести бэктесты.');
        return;
      }
      syncStateWithGroupIds(updatedGroup.backtestIds);
      messageApi.success(`Перенесено ${selectedIds.length} бэктестов в «${createdGroup.name}».`);
      setTransferTargetGroupId(createdGroup.id);
      setTransferModalOpen(false);
      return;
    }
    if (!transferTargetGroupId) {
      return;
    }
    const transferResult = transferBacktests(group.id, transferTargetGroupId, selectedIds);
    if (!transferResult) {
      messageApi.error('Не удалось перенести бэктесты.');
      return;
    }
    syncStateWithGroupIds(transferResult.source.backtestIds);
    messageApi.success(`Перенесено ${selectedIds.length} бэктестов.`);
    setTransferModalOpen(false);
  }, [
    createGroup,
    group,
    messageApi,
    newGroupName,
    removeBacktests,
    selectedIds,
    syncStateWithGroupIds,
    transferBacktests,
    transferMode,
    transferTargetGroupId,
  ]);

  const handleOpenCreateBots = useCallback(() => {
    if (!hasSelection) {
      return;
    }
    const targets: BacktestBotTarget[] = selectedBacktests
      .map((info) => {
        const detail = detailsById.get(info.id);
        return detail ? { id: info.id, detail } : null;
      })
      .filter((item): item is BacktestBotTarget => Boolean(item));
    if (targets.length !== selectedBacktests.length) {
      messageApi.warning('Загрузите данные всех выбранных бэктестов перед созданием ботов.');
      return;
    }
    setBotTargets(targets);
    setCreateBotsOpen(true);
  }, [detailsById, hasSelection, messageApi, selectedBacktests]);

  const handleBotsModalClose = useCallback(() => {
    setCreateBotsOpen(false);
    setBotTargets([]);
  }, []);

  const actionMenuItems =
    useMemo<MenuProps['items']>(
      () => [
        {
          key: 'remove-selected',
          label: 'Удалить выбранные из группы',
          danger: true,
          disabled: !hasSelection,
        },
        {
          key: 'transfer-selected',
          label: 'Перенести выбранные в другую группу',
          disabled: !canTransfer,
        },
        {
          key: 'create-bots',
          label: 'Создать ботов из выбранных',
          disabled: !canCreateBots,
        },
        { type: 'divider' },
        {
          key: 'invert-selection',
          label: 'Инвертировать выделение',
          disabled: !canInvertSelection,
        },
      ],
      [canCreateBots, canInvertSelection, canTransfer, hasSelection],
    ) ?? [];

  const handleActionsMenuClick = useCallback<NonNullable<MenuProps['onClick']>>(
    ({ key }) => {
      switch (key) {
        case 'remove-selected':
          handleDeleteSelected();
          break;
        case 'transfer-selected':
          handleOpenTransfer();
          break;
        case 'create-bots':
          handleOpenCreateBots();
          break;
        case 'invert-selection':
          handleInvertSelection();
          break;
        default:
          break;
      }
    },
    [handleDeleteSelected, handleOpenCreateBots, handleOpenTransfer, handleInvertSelection],
  );

  const hasEnabledAction = actionMenuItems.some((item) => {
    if (!item || item.type === 'divider' || item.type === 'group') {
      return false;
    }
    return item.disabled !== true;
  });

  const actionMenu = (
    <Dropdown menu={{ items: actionMenuItems, onClick: handleActionsMenuClick }} trigger={['click']}>
      <Button disabled={!hasEnabledAction}>Действия</Button>
    </Dropdown>
  );

  if (!group) {
    return (
      <section className="page">
        <PageHeader
          title="Группа не найдена"
          description="Похоже, группа была удалена или никогда не существовала."
          onBack={() => navigate('/backtest-groups')}
        />
        <Card>
          <Empty description="Нет данных по указанной группе." />
          <Button type="primary" className="u-mt-16" onClick={() => navigate('/backtest-groups')}>
            Вернуться к списку групп
          </Button>
        </Card>
      </section>
    );
  }

  const headerTags = (
    <div className="panel__description">
      Создана: {new Date(group.createdAt).toLocaleString('ru-RU')} · Обновлена:{' '}
      {new Date(group.updatedAt).toLocaleString('ru-RU')} · Бектестов: {group.backtestIds.length}
    </div>
  );
  const headerExtra = (
    <>
      <Button onClick={() => setRenameOpen(true)}>Переименовать</Button>
      <Button danger onClick={handleDeleteGroup}>
        Удалить
      </Button>
    </>
  );

  return (
    <section className="page">
      {messageContextHolder}
      <PageHeader
        title={group.name}
        tags={headerTags}
        extra={headerExtra}
        onBack={() => navigate('/backtest-groups')}
      />

      {missingCount > 0 && (
        <Alert
          message="Нужна синхронизация"
          description={
            <div>
              Локально отсутствуют нужные данные по {missingCount} бэктестам.
              {!extensionReady && 'Подключите расширение, чтобы загрузить данные.'}
              {missingLoading && missingProgress && (
                <div className="u-mt-12">
                  <Progress
                    percent={missingProgressPercent}
                    size="small"
                    status="active"
                    format={() => `${missingProgress.completed} / ${missingProgress.total}`}
                  />
                </div>
              )}
            </div>
          }
          type="warning"
          action={
            <Button
              type="primary"
              onClick={handleLoadMissing}
              loading={missingLoading}
              disabled={!extensionReady || missingLoading}
            >
              Загрузить
            </Button>
          }
        />
      )}

      <Card title="Аналитика и бэктесты" className="u-mt-16">
        <div className="panel__header">
          <div>
            <p className="panel__description">
              Загружено {loadedCount} из {totalBacktests} · выбрано {selectedCount}
            </p>
          </div>
        </div>

        <BacktestAggregationConfigPanel
          value={aggregationConfig}
          onChange={handleAggregationConfigChange}
          disabled={selectedBacktests.length === 0}
          maxLimit={maxAggregationLimit}
        />

        <BacktestAnalyticsPanel
          metrics={aggregatedMetrics}
          quoteCurrency={analyticsQuote}
          limitAnalysis={
            selectedBacktests.length > 0
              ? {
                  value: limitImpactValue,
                  maxCap: limitSliderCap,
                  onValueChange: handleLimitImpactValueChange,
                  onCompute: handleComputeLimitImpact,
                  loading: limitImpactLoading,
                  points: limitImpactPoints,
                }
              : undefined
          }
        />

        {shouldRenderTable ? (
          <BacktestInfoTable
            data={backtestInfos}
            loading={tableLoading}
            selectedIds={selectedIds}
            onSelectionChange={handleSelectionChange}
            actions={actionMenu}
          />
        ) : (
          <Empty description="Нет загруженных данных о бэктестах." className="empty-state--padded-lg" />
        )}
      </Card>

      {error && <Alert type="warning" message={error} showIcon className="u-mt-16" />}

      <RenameBacktestGroupModal
        open={renameOpen}
        group={group}
        onCancel={() => setRenameOpen(false)}
        onSubmit={handleRenameSubmit}
      />
      <Modal
        title="Перенос в другую группу"
        open={transferModalOpen}
        onCancel={() => setTransferModalOpen(false)}
        okText="Перенести"
        cancelText="Отмена"
        onOk={handleTransferSubmit}
        okButtonProps={{
          disabled: transferMode === 'new' ? newGroupName.trim().length === 0 : transferTargetGroupId === null,
        }}
        destroyOnClose
      >
        <Radio.Group
          value={transferMode}
          onChange={(event) => setTransferMode(event.target.value as 'existing' | 'new')}
          className="u-mb-16"
        >
          <Radio.Button value="existing" disabled={availableTransferGroups.length === 0}>
            В существующую группу
          </Radio.Button>
          <Radio.Button value="new">В новую группу</Radio.Button>
        </Radio.Group>

        {transferMode === 'existing' ? (
          availableTransferGroups.length === 0 ? (
            <p>Нет доступных групп для переноса.</p>
          ) : (
            <Select
              placeholder="Выберите группу"
              value={transferTargetGroupId ?? undefined}
              className="u-full-width"
              options={availableTransferGroups.map((item) => ({ value: item.id, label: item.name }))}
              onChange={(value) => setTransferTargetGroupId(value)}
            />
          )
        ) : (
          <Input
            placeholder="Название новой группы"
            value={newGroupName}
            onChange={(event) => setNewGroupName(event.target.value)}
          />
        )}
      </Modal>
      <CreateBotsFromBacktestsModal
        open={createBotsOpen}
        targets={botTargets}
        onClose={handleBotsModalClose}
        onCompleted={({ succeeded, failed }) => {
          handleBotsModalClose();
          if (succeeded > 0) {
            messageApi.success(`Создано ${succeeded} бота.`);
          }
          if (failed > 0) {
            messageApi.warning(`Не удалось создать ${failed} бота.`);
          }
        }}
      />
    </section>
  );
};

export default BacktestGroupDetailsPage;
