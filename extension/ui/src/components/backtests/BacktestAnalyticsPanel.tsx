import type { TabsProps } from 'antd';
import { Button, Card, Empty, Flex, Slider, Tabs } from 'antd';
import type { PropsWithChildren, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import type { AggregateRiskSeries, DailyConcurrencyRecord, PortfolioEquitySeries } from '../../lib/aggregationTypes';
import { formatAmount } from '../../lib/backtestFormatting';
import type { DataZoomRange, LimitImpactPoint } from '../../lib/chartOptions';
import { MS_IN_DAY } from '../../lib/dateTime';
import { formatDurationDays } from '../../lib/tableHelpers';
import type { AggregatedBacktestsMetrics, ChartPoint } from '../../types/backtestAggregations';
import { AggregateRiskChart } from '../charts/AggregateRiskChart';
import { BacktestDealsTimelineChart } from '../charts/BacktestDealsTimelineChart';
import { DailyConcurrencyChart } from '../charts/DailyConcurrencyChart';
import { LimitImpactChart, LimitRiskEfficiencyChart } from '../charts/LimitImpactChart';
import { PortfolioEquityChart } from '../charts/PortfolioEquityChart';
import InfoTooltip from '../ui/InfoTooltip';
import { StatisticCard } from '../ui/StatisticCard';

interface BacktestAnalyticsPanelProps {
  metrics: AggregatedBacktestsMetrics | null;
  quoteCurrency?: string;
  limitAnalysis?: {
    value: number;
    maxCap: number;
    onValueChange: (value: number) => void;
    onCompute: () => void;
    loading: boolean;
    points: LimitImpactPoint[] | null;
  };
}

const numberFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

const formatRatio = (value: number): string => numberFormatter.format(value);

const formatSignedAmount = (value: number, currency?: string): string => {
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatAmount(value, currency)}`;
};

const resolveSignedTrend = (value: number, threshold = 0): 'positive' | 'negative' | 'neutral' => {
  if (value > threshold) {
    return 'positive';
  }
  if (value < threshold) {
    return 'negative';
  }
  return 'neutral';
};

const buildPortfolioEquitySeries = (points: ChartPoint[]): PortfolioEquitySeries => {
  if (points.length === 0) {
    return { points: [], minValue: 0, maxValue: 0 };
  }

  const mapped = points.map((point) => ({ time: point.date, value: point.value }));
  if (mapped[0]?.value !== 0) {
    mapped.unshift({ time: mapped[0].time, value: 0 });
  }

  const values = mapped.map((point) => point.value);
  return {
    points: mapped,
    minValue: Math.min(...values, 0),
    maxValue: Math.max(...values, 0),
  };
};

const buildAggregateRiskSeries = (points: ChartPoint[]): AggregateRiskSeries => {
  const normalized = points.map((point) => ({ time: point.date, value: Math.max(0, point.value) }));
  const maxValue = normalized.reduce((max, point) => Math.max(max, point.value), 0);

  return {
    points: normalized,
    maxValue,
  };
};

const getDayStartMs = (timestamp: number): number => {
  const day = new Date(timestamp);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
};

const buildDailyConcurrencyRecords = (points: ChartPoint[]): DailyConcurrencyRecord[] => {
  const byDay = new Map<number, { maxCount: number }>();

  points.forEach((point) => {
    const dayStartMs = getDayStartMs(point.date);
    const record = byDay.get(dayStartMs) ?? { maxCount: 0 };
    record.maxCount = Math.max(record.maxCount, Math.max(0, point.value));
    byDay.set(dayStartMs, record);
  });

  return Array.from(byDay.entries())
    .sort(([left], [right]) => left - right)
    .map(([dayStartMs, record]) => ({
      dayIndex: Math.floor(dayStartMs / MS_IN_DAY),
      dayStartMs,
      activeDurationMs: 0,
      maxCount: record.maxCount,
      avgActiveCount: record.maxCount,
    }));
};

const ChartCard = ({ title, children, minHeight }: PropsWithChildren<{ title: string; minHeight?: number }>) => {
  const className = ['chart-card', minHeight === 0 ? 'chart-card--compact' : null].filter(Boolean).join(' ');
  return (
    <Card className={className}>
      <div className="chart-card__title">{title}</div>
      <div className="chart-card__body">{children}</div>
    </Card>
  );
};

const renderChartTab = (title: string, content: ReactNode) => {
  return <ChartCard title={title}>{content}</ChartCard>;
};

const BacktestAnalyticsPanel = ({ metrics, limitAnalysis }: BacktestAnalyticsPanelProps) => {
  const [riskZoomRange, setRiskZoomRange] = useState<DataZoomRange | undefined>(undefined);
  const [portfolioZoomRange, setPortfolioZoomRange] = useState<DataZoomRange | undefined>(undefined);
  const [concurrencyZoomRange, setConcurrencyZoomRange] = useState<DataZoomRange | undefined>(undefined);
  const maeSeriesKey = metrics?.maeSeries.length ?? 0;
  const pnlSeriesKey = metrics?.pnlSeries.length ?? 0;
  const concurrencySeriesKey = metrics?.activeDealCountSeries.length ?? 0;

  useEffect(() => {
    void maeSeriesKey;
    setRiskZoomRange(undefined);
  }, [maeSeriesKey]);

  useEffect(() => {
    void pnlSeriesKey;
    setPortfolioZoomRange(undefined);
  }, [pnlSeriesKey]);

  useEffect(() => {
    void concurrencySeriesKey;
    setConcurrencyZoomRange(undefined);
  }, [concurrencySeriesKey]);
  if (!metrics) {
    return <Empty description="Нет данных для расчёта метрик." className="empty-state--padded" />;
  }

  const totalPnlDisplay = formatSignedAmount(metrics.totalProfitQuote);
  const totalPnlTrend = resolveSignedTrend(metrics.totalProfitQuote);
  const avgDealProfitDisplay = formatSignedAmount(metrics.averageProfitPerDeal);
  const avgDealProfitTrend = resolveSignedTrend(metrics.averageProfitPerDeal);
  const netPerDayDisplay = formatSignedAmount(metrics.averageNetPerDay);
  const netPerDayTrend = resolveSignedTrend(metrics.averageNetPerDay);
  const pnlToRiskTrend = resolveSignedTrend(metrics.pnlToRisk, 1);
  const pnlToRiskDisplay = formatRatio(metrics.pnlToRisk);
  const drawdownTrend = resolveSignedTrend(metrics.maxAggregatedDrawdown * -1);
  const drawdownDisplay = formatAmount(metrics.maxAggregatedDrawdown);

  const summaryTab = (
    <div className="aggregation-summary u-mt-12">
      <StatisticCard
        title="Бэктесты (Σ)"
        tooltip={<InfoTooltip text="Количество бэктестов, включённых в расчёт агрегированных показателей." />}
        value={metrics.totalBacktests}
      />
      <StatisticCard
        title="Лимит позиций"
        tooltip={
          <InfoTooltip text="Максимальное число одновременно открытых позиций, учитываемое при расчёте агрегированных метрик." />
        }
        value={metrics.maxConcurrentPositions}
      />
      <StatisticCard
        title="P&L (Σ)"
        tooltip={<InfoTooltip text="Совокупный результат (NET)" />}
        value={totalPnlDisplay}
        trend={totalPnlTrend}
      />
      <StatisticCard
        title="P&L / сделку"
        tooltip={<InfoTooltip text="Средний результат одной сделки по всем включённым бэктестам." />}
        value={avgDealProfitDisplay}
        trend={avgDealProfitTrend}
      />
      <StatisticCard
        title="Net / день"
        tooltip={
          <InfoTooltip text="Средний дневной результат по всем бэктестам, включённым в агрегированную статистику." />
        }
        value={netPerDayDisplay}
        trend={netPerDayTrend}
      />
      <StatisticCard
        title="P&L к риску"
        tooltip={<InfoTooltip text="Отношение совокупного P&L к наибольшему из значений МПУ или просадки." />}
        value={pnlToRiskDisplay}
        trend={pnlToRiskTrend}
      />
      <StatisticCard
        title="Сделки (Σ)"
        tooltip={
          <InfoTooltip text="Количество сделок и распределение по прибыльным, убыточным и активным операциям." />
        }
        value={`${metrics.totalProfitableDeals} / ${metrics.totalLosingDeals} / ${metrics.openDeals}`}
      />
      <StatisticCard
        title="Акт. МПУ"
        tooltip={<InfoTooltip text="Совокупный МПУ по активным (не закрытым) сделкам." />}
        value={formatAmount(metrics.aggregatedActiveMae)}
        trend="negative"
      />
      <StatisticCard
        title="Длит. сделки"
        tooltip={
          <InfoTooltip text="Средняя продолжительность одной сделки среди всех участников агрегированной выборки." />
        }
        value={formatDurationDays(metrics.averageDealDurationDays)}
      />
      <StatisticCard
        title="Дни без сделок"
        tooltip={<InfoTooltip text="Суммарное количество дней, в которых не было ни единой сделки." />}
        value={metrics.totalIdleDays}
      />
      <StatisticCard
        title="Макс. просадка"
        tooltip={<InfoTooltip text="Фактическая просадка портфеля при агрегировании всех бэктестов." />}
        value={drawdownDisplay}
        trend={drawdownTrend}
      />
      <StatisticCard
        title="Макс. МПУ"
        tooltip={
          <InfoTooltip text="Максимальное одновременное МПУ. Тот показатель, который вы в худшем случае бы увидели у себя на бирже как нереализованный P&L." />
        }
        value={formatAmount(metrics.maxConcurrentMae)}
        trend="negative"
      />
    </div>
  );

  const portfolioContent = renderChartTab(
    'P&L портфеля',
    metrics.pnlSeries.length === 0 ? (
      <Empty description="Недостаточно данных для расчёта P&L портфеля." className="empty-state--padded" />
    ) : (
      <PortfolioEquityChart
        series={buildPortfolioEquitySeries(metrics.pnlSeries)}
        dataZoomRange={portfolioZoomRange}
        onDataZoom={setPortfolioZoomRange}
      />
    ),
  );

  const riskContent = renderChartTab(
    'Риски',
    metrics.maeSeries.length === 0 ? (
      <Empty description="Нет данных о риске." className="empty-state--padded" />
    ) : (
      <AggregateRiskChart
        series={buildAggregateRiskSeries(metrics.maeSeries)}
        dataZoomRange={riskZoomRange}
        onDataZoom={setRiskZoomRange}
        filterVisibleRange
      />
    ),
  );

  const concurrencyRecords = buildDailyConcurrencyRecords(metrics.activeDealCountSeries);
  const averageConcurrency =
    concurrencyRecords.length > 0
      ? concurrencyRecords.reduce((sum, record) => sum + record.maxCount, 0) / concurrencyRecords.length
      : 0;

  const concurrencyContent = renderChartTab(
    'Одновременность',
    concurrencyRecords.length === 0 ? (
      <Empty description="Нет данных о позициях." className="empty-state--padded" />
    ) : (
      <Flex vertical gap={16}>
        <div className="aggregation-summary">
          <StatisticCard
            title="Среднее значение"
            tooltip={<InfoTooltip text="Среднее значение максимального количества одновременных сделок в день." />}
            value={formatAmount(averageConcurrency)}
          />
        </div>
        <DailyConcurrencyChart
          records={concurrencyRecords}
          filterVisibleRange
          dataZoomRange={concurrencyZoomRange}
          onDataZoom={setConcurrencyZoomRange}
        />
      </Flex>
    ),
  );

  const hasTimelineData = metrics.dealTimelineRows.some((row) => row.items.length > 0);
  const dealsTimelineContent = renderChartTab(
    'Сделки',
    hasTimelineData ? (
      <BacktestDealsTimelineChart rows={metrics.dealTimelineRows} />
    ) : (
      <Empty description="Нет сделок для отображения." className="empty-state--padded" />
    ),
  );

  const limitTab =
    limitAnalysis === undefined
      ? null
      : {
          key: 'limit',
          label: 'Лимит по ботам',
          children: (
            <div className="chart-grid">
              <ChartCard title="Параметры расчёта" minHeight={0}>
                <div className="u-mb-16">
                  <div className="chart-card__label">Максимальный лимит</div>
                  <Slider
                    min={1}
                    max={Math.max(1, limitAnalysis.maxCap)}
                    marks={
                      limitAnalysis.maxCap > 1
                        ? {
                            1: '1',
                            [limitAnalysis.maxCap]: String(limitAnalysis.maxCap),
                          }
                        : undefined
                    }
                    value={Math.min(limitAnalysis.value, Math.max(1, limitAnalysis.maxCap))}
                    onChange={(value) => limitAnalysis.onValueChange(Number(value))}
                    disabled={limitAnalysis.loading || limitAnalysis.maxCap <= 1}
                  />
                </div>
                <p className="panel__description u-mb-12">
                  Чем больше лимит, тем дольше выполняется расчёт. При значениях выше сотни вкладка может подвиснуть.
                </p>
                <Button type="primary" onClick={limitAnalysis.onCompute} loading={limitAnalysis.loading}>
                  Посчитать
                </Button>
              </ChartCard>
              <ChartCard title="Влияние лимита на P&L">
                {limitAnalysis.points?.length ? (
                  <LimitImpactChart points={limitAnalysis.points} />
                ) : (
                  <Empty description="Нет подготовленных данных. Запустите расчёт." className="empty-state--padded" />
                )}
              </ChartCard>
              <ChartCard title="Эффективность лимита">
                {limitAnalysis.points?.length ? (
                  <LimitRiskEfficiencyChart points={limitAnalysis.points} />
                ) : (
                  <Empty description="Нет подготовленных данных. Запустите расчёт." className="empty-state--padded" />
                )}
              </ChartCard>
            </div>
          ),
        };

  const tabs: TabsProps['items'] = [
    { key: 'summary', label: 'Показатели', children: summaryTab },
    { key: 'portfolio', label: 'P&L портфеля', children: portfolioContent },
    { key: 'risk', label: 'Риски', children: riskContent },
    ...(limitTab ? [limitTab] : []),
    { key: 'timeline', label: 'Сделки', children: dealsTimelineContent },
    { key: 'concurrency', label: 'Одновременность', children: concurrencyContent },
  ];

  return <Tabs items={tabs} destroyInactiveTabPane />;
};

export default BacktestAnalyticsPanel;
