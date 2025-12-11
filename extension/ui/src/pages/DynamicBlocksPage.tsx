import { ControlOutlined, PlusOutlined, ReloadOutlined, StopOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { SelectProps } from 'antd';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Form,
  InputNumber,
  Modal,
  message,
  Row,
  Select,
  Slider,
  Space,
  Statistic,
  Switch,
  Tag,
  Typography,
} from 'antd';
import { useMemo, useState } from 'react';
import { useDealsRefresh } from '../context/DealsRefreshContext';
import { useDynamicBlocks } from '../context/DynamicBlocksContext';
import { DEFAULT_DYNAMIC_BLOCK_CONFIG } from '../storage/dynamicPositionBlocksStore';
import type { DynamicBlockConfig } from '../types/positionConstraints';

interface DynamicBlocksPageProps {
  extensionReady: boolean;
}

interface AddFormValues {
  apiKeyId: number | null;
  minPositionsBlock: number;
  maxPositionsBlock: number;
  timeoutBetweenChangesMin: number;
}

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const formatExchangeLabel = (exchange: string): string => {
  return exchange
    .toLowerCase()
    .split('_')
    .map((chunk) => (chunk ? `${chunk[0].toUpperCase()}${chunk.slice(1)}` : ''))
    .join(' ')
    .trim();
};

const resolveApiKeyLabel = (apiKeyId: number, apiKeys: { id: number; name: string; exchange: string }[]): string => {
  const key = apiKeys.find((item) => item.id === apiKeyId);
  if (!key) {
    return `API key ${apiKeyId}`;
  }
  const exchange = formatExchangeLabel(key.exchange);
  return key.name ? `${key.name} · ${exchange}` : `API key ${apiKeyId} · ${exchange}`;
};

const formatTimestamp = (value: number | null | undefined): string => {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleTimeString();
};

const DynamicBlocksPage = ({ extensionReady }: DynamicBlocksPageProps) => {
  const { refreshInterval: dealsRefreshInterval } = useDealsRefresh();
  const {
    configs,
    activeConfigs,
    constraints,
    openPositionsByKey,
    automationStatuses,
    loadingSnapshot,
    snapshotError,
    automationError,
    lastSnapshotAt,
    apiKeys,
    refreshSnapshot,
    manualRun,
    upsertConfig,
    disableConfig,
    resetConfig,
  } = useDynamicBlocks();
  const [manualRunPending, setManualRunPending] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm] = Form.useForm<AddFormValues>();

  const availableApiKeysForAdd = useMemo(() => {
    const usedIds = new Set(activeConfigs.map((config) => config.apiKeyId));
    return apiKeys.filter((key) => !usedIds.has(key.id));
  }, [activeConfigs, apiKeys]);

  const apiKeyOptions: SelectProps['options'] = useMemo(
    () =>
      availableApiKeysForAdd.map((key) => ({
        value: key.id,
        label: key.name ? `${key.name} · ${formatExchangeLabel(key.exchange)}` : `API key ${key.id}`,
      })),
    [availableApiKeysForAdd],
  );

  const openAddModal = () => {
    addForm.setFieldsValue({
      apiKeyId: availableApiKeysForAdd[0]?.id ?? null,
      minPositionsBlock: DEFAULT_DYNAMIC_BLOCK_CONFIG.minPositionsBlock,
      maxPositionsBlock: DEFAULT_DYNAMIC_BLOCK_CONFIG.maxPositionsBlock,
      timeoutBetweenChangesMin: Math.round(DEFAULT_DYNAMIC_BLOCK_CONFIG.timeoutBetweenChangesSec / 60),
    });
    setAddModalOpen(true);
  };

  const handleAddSubmit = async () => {
    try {
      const values = await addForm.validateFields();
      if (!values.apiKeyId) {
        message.error('Выберите API-ключ.');
        return;
      }
      if (values.minPositionsBlock <= 0 || values.maxPositionsBlock < values.minPositionsBlock) {
        message.error('Проверьте диапазон блокировки.');
        return;
      }

      const nextConfig: DynamicBlockConfig = {
        apiKeyId: values.apiKeyId,
        minPositionsBlock: Math.trunc(values.minPositionsBlock),
        maxPositionsBlock: Math.trunc(values.maxPositionsBlock),
        timeoutBetweenChangesSec: Math.max(60, Math.trunc(values.timeoutBetweenChangesMin * 60)),
        checkPeriodSec: dealsRefreshInterval,
        enabled: true,
        lastChangeAt: null,
      };

      upsertConfig(nextConfig);
      message.success('Динамическая блокировка добавлена.');
      setAddModalOpen(false);
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      message.error(text);
    }
  };

  const handleManualRun = async () => {
    setManualRunPending(true);
    try {
      await manualRun();
      message.success('Проверка выполнена.');
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      message.error(text);
    } finally {
      setManualRunPending(false);
    }
  };

  const computeCurrentBlockValue = (config: DynamicBlockConfig): number => {
    const constraint = constraints.find((item) => item.apiKeyId === config.apiKeyId);
    const rawLimit =
      constraint && constraint.limit !== null && constraint.limit !== undefined
        ? constraint.limit
        : config.maxPositionsBlock;
    return clamp(rawLimit, config.minPositionsBlock, config.maxPositionsBlock);
  };

  const renderConfigCard = (config: DynamicBlockConfig) => {
    const constraint = constraints.find((item) => item.apiKeyId === config.apiKeyId) ?? null;
    const currentLimit = computeCurrentBlockValue(config);
    const openPositions = openPositionsByKey.get(config.apiKeyId) ?? 0;
    const apiKeyLabel = resolveApiKeyLabel(config.apiKeyId, apiKeys);

    return (
      <Card
        key={config.apiKeyId}
        title={
          <Space>
            <ControlOutlined />
            <span>{apiKeyLabel}</span>
          </Space>
        }
        extra={
          <Space size="small">
            <Tag color="processing">{constraint?.exchange ? formatExchangeLabel(constraint.exchange) : '—'}</Tag>
            {constraint && !constraint.positionEnabled && <Tag color="orange">Блокировка выключена на стороне API</Tag>}
          </Space>
        }
        style={{ height: '100%' }}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Row gutter={[16, 16]}>
            <Col xs={12} md={6}>
              <Statistic title="Открытые позиции" value={openPositions} />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="Текущий лимит" value={currentLimit} suffix="поз." valueStyle={{ color: '#1677ff' }} />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="Диапазон" value={`${config.minPositionsBlock} – ${config.maxPositionsBlock}`} />
            </Col>
          </Row>

          <Slider
            min={config.minPositionsBlock}
            max={config.maxPositionsBlock}
            value={currentLimit}
            marks={{
              [config.minPositionsBlock]: 'MIN',
              ...(currentLimit !== config.minPositionsBlock && currentLimit !== config.maxPositionsBlock
                ? { [currentLimit]: 'Текущая' }
                : {}),
              [config.maxPositionsBlock]: 'MAX',
            }}
            tooltip={{ open: false }}
          />

          <Form layout="vertical" component="div">
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12} lg={6}>
                <Form.Item label="Минимальный блок">
                  <InputNumber
                    style={{ width: '100%' }}
                    value={config.minPositionsBlock}
                    min={1}
                    onChange={(value) =>
                      upsertConfig({
                        ...config,
                        minPositionsBlock: Number(value ?? 1),
                        maxPositionsBlock: Math.max(config.maxPositionsBlock, Number(value ?? 1)),
                      })
                    }
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} lg={6}>
                <Form.Item label="Максимальный блок">
                  <InputNumber
                    style={{ width: '100%' }}
                    value={config.maxPositionsBlock}
                    min={config.minPositionsBlock}
                    onChange={(value) =>
                      upsertConfig({
                        ...config,
                        maxPositionsBlock: Math.max(
                          Number(value ?? config.minPositionsBlock),
                          config.minPositionsBlock,
                        ),
                      })
                    }
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} lg={6}>
                <Form.Item label="Таймаут между изменениями (мин)">
                  <InputNumber
                    style={{ width: '100%' }}
                    value={Math.round(config.timeoutBetweenChangesSec / 60)}
                    min={1}
                    onChange={(value) =>
                      upsertConfig({
                        ...config,
                        timeoutBetweenChangesSec: Math.max(60, Math.round(Number(value ?? 1) * 60)),
                      })
                    }
                  />
                </Form.Item>
              </Col>
            </Row>
          </Form>

          <Row gutter={[12, 12]} align="middle" justify="space-between">
            <Col>
              <Space>
                <Switch
                  checked={config.enabled}
                  onChange={(checked) => {
                    upsertConfig({ ...config, enabled: checked });
                  }}
                  disabled={!extensionReady}
                />
                <Typography.Text>Автоматически менять блокировку</Typography.Text>
              </Space>
            </Col>
            <Col>
              <Space wrap>
                <Button onClick={() => disableConfig(config.apiKeyId)} icon={<StopOutlined />} danger>
                  Отключить
                </Button>
                <Button onClick={() => resetConfig(config.apiKeyId)}>Сбросить к дефолту</Button>
              </Space>
            </Col>
          </Row>

          {automationStatuses[config.apiKeyId]?.state === 'error' && (
            <Alert
              type="error"
              showIcon
              message={automationStatuses[config.apiKeyId]?.note ?? 'Ошибка обновления лимита'}
              description={
                <>
                  <div>Последняя проверка: {formatTimestamp(automationStatuses[config.apiKeyId]?.lastCheckedAt)}</div>
                  <div>Последнее изменение: {formatTimestamp(automationStatuses[config.apiKeyId]?.lastChangeAt)}</div>
                </>
              }
            />
          )}
        </Space>
      </Card>
    );
  };

  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">Динамическая блокировка по ботам</h1>
        <p className="page__subtitle">
          Автоматически регулирует максимальное количество одновременных позиций для выбранных API-ключей на основе
          текущего числа открытых сделок.
        </p>
      </header>

      {!extensionReady && (
        <Alert
          type="warning"
          showIcon
          message="Расширение неактивно"
          description="Подключите интерфейс через расширение Veles Tools, чтобы управлять блокировкой позиций."
          style={{ marginBottom: 16 }}
        />
      )}

      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Card
          title="Управление"
          extra={
            <Space>
              <Button
                icon={<PlusOutlined />}
                type="primary"
                onClick={openAddModal}
                disabled={!extensionReady || apiKeyOptions.length === 0}
              >
                Добавить блокировку
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => refreshSnapshot()}
                loading={loadingSnapshot}
                disabled={!extensionReady}
              >
                Обновить данные
              </Button>
              <Button
                type="default"
                icon={<ThunderboltOutlined />}
                onClick={handleManualRun}
                loading={manualRunPending}
                disabled={!extensionReady || activeConfigs.length === 0}
              >
                Проверить сейчас
              </Button>
            </Space>
          }
        >
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Row gutter={[16, 16]} align="middle">
              <Col xs={24} md={12} lg={8}>
                <Statistic
                  title="Последняя синхронизация"
                  value={lastSnapshotAt ? new Date(lastSnapshotAt).toLocaleTimeString() : '—'}
                />
              </Col>
              <Col xs={24} md={12} lg={8}>
                <Statistic title="Активных блокировок" value={activeConfigs.length} />
              </Col>
              <Col xs={24} md={12} lg={8}>
                <Statistic title="Обновления" value={activeConfigs.length > 0 ? 'автоматические' : 'не настроены'} />
              </Col>
            </Row>
            {snapshotError && <Alert type="error" showIcon message={snapshotError} />}
            {automationError && <Alert type="warning" showIcon message={automationError} />}
          </Space>
        </Card>

        {activeConfigs.length === 0 ? (
          <Card>
            <Empty description="Пока нет активных динамических блокировок." image={Empty.PRESENTED_IMAGE_SIMPLE}>
              <Button
                type="primary"
                onClick={openAddModal}
                icon={<PlusOutlined />}
                disabled={!extensionReady || apiKeyOptions.length === 0}
              >
                Добавить блокировку
              </Button>
            </Empty>
          </Card>
        ) : (
          <Row gutter={[16, 16]}>
            {activeConfigs.map((config) => (
              <Col key={config.apiKeyId} xs={24}>
                {renderConfigCard(config)}
              </Col>
            ))}
          </Row>
        )}
      </Space>

      <Modal
        title="Добавить динамическую блокировку"
        open={addModalOpen}
        onCancel={() => setAddModalOpen(false)}
        onOk={handleAddSubmit}
        okText="Сохранить"
        okButtonProps={{ disabled: apiKeyOptions.length === 0 }}
      >
        <Form form={addForm} layout="vertical">
          <Form.Item label="API-ключ" name="apiKeyId" rules={[{ required: true, message: 'Выберите ключ' }]}>
            <Select
              placeholder="Выберите ключ"
              options={apiKeyOptions}
              showSearch
              optionFilterProp="label"
              disabled={apiKeyOptions.length === 0}
            />
          </Form.Item>
          <Form.Item
            label="Минимальный блок"
            name="minPositionsBlock"
            rules={[{ required: true, type: 'number', min: 1 }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="Максимальный блок"
            name="maxPositionsBlock"
            dependencies={['minPositionsBlock']}
            rules={[
              { required: true, type: 'number', min: 1 },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const min = getFieldValue('minPositionsBlock');
                  if (typeof value === 'number' && typeof min === 'number' && value < min) {
                    return Promise.reject(new Error('Максимум не может быть меньше минимума.'));
                  }
                  return Promise.resolve();
                },
              }),
            ]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="Таймаут между изменениями (мин)"
            name="timeoutBetweenChangesMin"
            rules={[{ required: true, type: 'number', min: 1 }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </section>
  );
};

export default DynamicBlocksPage;
