import { Alert, Button, Empty, message, Spin } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import BacktestAggregationPanel from '../components/backtests/BacktestAggregationPanel';
import RenameBacktestGroupModal from '../components/backtests/RenameBacktestGroupModal';
import { useBacktestGroups } from '../context/BacktestGroupsContext';
import { backtestsService } from '../services/backtests';
import type { BacktestGroup } from '../types/backtestGroups';
import type { BacktestStatistics } from '../types/backtests';

interface BacktestGroupDetailsPageProps {
  extensionReady: boolean;
}

const buildBacktestPlaceholder = (id: number): BacktestStatistics => ({
  id,
  name: `Бэктест #${id}`,
  date: '',
  from: '',
  to: '',
  algorithm: '',
  exchange: '',
  symbol: '',
  base: '',
  quote: '',
  duration: 0,
  profitBase: 0,
  profitQuote: 0,
  netBase: 0,
  netQuote: 0,
  netBasePerDay: 0,
  netQuotePerDay: 0,
  minProfitBase: 0,
  maxProfitBase: 0,
  avgProfitBase: 0,
  minProfitQuote: 0,
  maxProfitQuote: 0,
  avgProfitQuote: 0,
  volume: 0,
  minDuration: 0,
  maxDuration: 0,
  avgDuration: 0,
  profits: 0,
  losses: 0,
  breakevens: 0,
  pullUps: 0,
  winRateProfits: 0,
  winRateLosses: 0,
  totalDeals: 0,
  minGrid: 0,
  maxGrid: 0,
  avgGrid: 0,
  minProfit: 0,
  maxProfit: 0,
  avgProfit: 0,
  mfePercent: 0,
  mfeAbsolute: 0,
  maePercent: 0,
  maeAbsolute: 0,
  commissionBase: 0,
  commissionQuote: 0,
});

const BacktestGroupDetailsPage = ({ extensionReady }: BacktestGroupDetailsPageProps) => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { groups, deleteGroup, updateGroupName, removeBacktests } = useBacktestGroups();
  const [messageApi, messageContextHolder] = message.useMessage();
  const group: BacktestGroup | null = useMemo(() => {
    return groups.find((item) => item.id === groupId) ?? null;
  }, [groupId, groups]);

  const [backtests, setBacktests] = useState<BacktestStatistics[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);

  useEffect(() => {
    if (!group) {
      setBacktests([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setError(null);
      setLoading(true);

      try {
        const [cachedPairs, cachedList] = await Promise.all([
          Promise.all(
            group.backtestIds.map(async (id) => {
              const detail = await backtestsService.readCachedBacktestDetail(id);
              return detail ? ({ id, detail } as const) : null;
            }),
          ),
          backtestsService.readCachedBacktestList(),
        ]);

        if (cancelled) {
          return;
        }

        const cachedDetailsMap = new Map<number, BacktestStatistics>();
        cachedPairs.forEach((entry) => {
          if (entry) {
            cachedDetailsMap.set(entry.id, entry.detail.statistics);
          }
        });

        const listSnapshotsMap = new Map<number, BacktestStatistics>();
        cachedList.forEach((snapshot) => {
          listSnapshotsMap.set(snapshot.id, snapshot);
        });

        const composeBacktests = () =>
          group.backtestIds.map(
            (id) => cachedDetailsMap.get(id) ?? listSnapshotsMap.get(id) ?? buildBacktestPlaceholder(id),
          );

        setBacktests(composeBacktests());
        setLoading(false);

        if (!extensionReady) {
          return;
        }

        const missingIds = group.backtestIds.filter((id) => !cachedDetailsMap.has(id));
        if (missingIds.length === 0) {
          return;
        }

        const failed: number[] = [];

        await Promise.all(
          missingIds.map(async (id) => {
            try {
              const detail = await backtestsService.getBacktestDetail(id, { forceRefresh: true });
              cachedDetailsMap.set(id, detail.statistics);
            } catch (fetchError) {
              console.warn(`[Backtest Groups] Не удалось загрузить бэктест ${id}`, fetchError);
              failed.push(id);
            }
          }),
        );

        if (cancelled) {
          return;
        }

        setBacktests(composeBacktests());
        if (failed.length > 0) {
          setError(`Не удалось загрузить ${failed.length} из ${missingIds.length} бэктестов.`);
        }
      } catch (loadError) {
        if (!cancelled) {
          console.warn('[Backtest Groups] Ошибка загрузки данных группы', loadError);
          setError('Не удалось загрузить данные группы.');
          setBacktests([]);
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
  }, [extensionReady, group]);

  if (!group) {
    return (
      <section className="page">
        <header className="page__header">
          <h1 className="page__title">Группа не найдена</h1>
          <p className="page__subtitle">Похоже, группа была удалена или никогда не существовала.</p>
        </header>
        <div className="panel">
          <Empty description="Нет данных по указанной группе." />
          <Button type="primary" style={{ marginTop: 16 }} onClick={() => navigate('/backtest-groups')}>
            Вернуться к списку групп
          </Button>
        </div>
      </section>
    );
  }

  const handleDeleteGroup = () => {
    deleteGroup(group.id);
    messageApi.success(`Группа «${group.name}» удалена.`);
    navigate('/backtest-groups');
  };

  const handleRenameSubmit = (name: string) => {
    const result = updateGroupName(group.id, name);
    if (!result) {
      messageApi.error('Не удалось переименовать группу.');
      return;
    }
    messageApi.success(`Группа переименована в «${result.name}».`);
    setRenameOpen(false);
  };

  const handleRemoveSelected = (ids: number[]) => {
    if (ids.length === 0) {
      messageApi.warning('Выберите бэктесты для удаления из группы.');
      return;
    }
    const result = removeBacktests(group.id, ids);
    if (!result) {
      messageApi.error('Не удалось удалить выбранные бэктесты.');
      return;
    }
    setBacktests((prev) => {
      const map = new Map(prev.map((item) => [item.id, item] as const));
      return result.backtestIds.map((id) => map.get(id)).filter((item): item is BacktestStatistics => Boolean(item));
    });
    messageApi.success('Выбранные бэктесты удалены из группы.');
  };

  const handleRemoveUnselected = (ids: number[]) => {
    if (ids.length === 0) {
      messageApi.warning('Нет невыбранных бэктестов для удаления.');
      return;
    }
    const result = removeBacktests(group.id, ids);
    if (!result) {
      messageApi.error('Не удалось обновить группу.');
      return;
    }
    setBacktests((prev) => {
      const map = new Map(prev.map((item) => [item.id, item] as const));
      return result.backtestIds.map((id) => map.get(id)).filter((item): item is BacktestStatistics => Boolean(item));
    });
    messageApi.success('Невыбранные бэктесты удалены из группы.');
  };

  return (
    <section className="page">
      {messageContextHolder}
      <header className="page__header">
        <h1 className="page__title">{group.name}</h1>
        <p className="page__subtitle">
          Группа включает {group.backtestIds.length} бэктестов. Используйте агрегацию ниже для анализа и управления
          составом.
        </p>
      </header>

      <div className="panel">
        <div className="panel__header" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 className="panel__title">Детали группы</h2>
            <p className="panel__description">
              Создана: {new Date(group.createdAt).toLocaleString('ru-RU')} · Обновлена:{' '}
              {new Date(group.updatedAt).toLocaleString('ru-RU')}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button onClick={() => setRenameOpen(true)}>Переименовать</Button>
            <Button danger onClick={handleDeleteGroup}>
              Удалить
            </Button>
            <Button type="default" onClick={() => navigate('/backtest-groups')}>
              ← К списку групп
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="panel">
          <div style={{ padding: '48px 0', textAlign: 'center' }}>
            <Spin />
          </div>
        </div>
      ) : backtests.length === 0 ? (
        <div className="panel">
          <Empty description="Не удалось загрузить бэктесты для этой группы." style={{ padding: '48px 0' }} />
        </div>
      ) : (
        <BacktestAggregationPanel
          extensionReady={extensionReady}
          selectedBacktests={backtests}
          onRemoveSelected={handleRemoveSelected}
          onRemoveUnselected={handleRemoveUnselected}
        />
      )}

      {error && <Alert type="warning" message={error} showIcon style={{ marginTop: 16 }} />}

      <RenameBacktestGroupModal
        open={renameOpen}
        group={group}
        onCancel={() => setRenameOpen(false)}
        onSubmit={handleRenameSubmit}
      />
    </section>
  );
};

export default BacktestGroupDetailsPage;
