import { ControlOutlined, DeleteOutlined, PlusOutlined, ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons';
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
  Popconfirm,
  Row,
  Select,
  Slider,
  Space,
  Statistic,
  Switch,
  Typography,
} from 'antd';
import { useCallback, useMemo, useState } from 'react';
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

const resolveApiKeyLabel = (apiKeyId: number, apiKeys: { id: number; name: string; exchange: string }[]): string => {
  const key = apiKeys.find((item) => item.id === apiKeyId);
  if (!key) {
    return `API key ${apiKeyId}`;
  }
  return key.name ? `${key.name}` : `API key ${apiKeyId}`;
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
  } = useDynamicBlocks();
  const [manualRunPending, setManualRunPending] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm] = Form.useForm<AddFormValues>();
  const updateConfig = useCallback(
    (config: DynamicBlockConfig, patch: Partial<DynamicBlockConfig>) => {
      upsertConfig({ ...config, ...patch });
    },
    [upsertConfig],
  );

  const availableApiKeysForAdd = useMemo(() => {
    const usedIds = new Set(activeConfigs.map((config) => config.apiKeyId));
    return apiKeys.filter((key) => !usedIds.has(key.id));
  }, [activeConfigs, apiKeys]);

  const apiKeyOptions: SelectProps['options'] = useMemo(
    () =>
      availableApiKeysForAdd.map((key) => ({
        value: key.id,
        label: key.name ? `${key.name}` : `API key ${key.id}`,
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
        className="dynamic-blocks-card card--full-height"
        size="small"
        extra={
          <Popconfirm
            title="Отключить блокировку?"
            okText="Да"
            cancelText="Нет"
            onConfirm={() => disableConfig(config.apiKeyId)}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label="Отключить блокировку" />
          </Popconfirm>
        }
      >
        <Space direction="vertical" size={12} className="u-full-width">
          <div className="dynamic-blocks-card__stats">
            <Statistic title="Позиции" value={openPositions} />
            <Statistic title="Лимит" value={currentLimit} suffix="поз." className="statistic--highlight" />
            <Statistic title="Диапазон" value={`${config.minPositionsBlock} – ${config.maxPositionsBlock}`} />
          </div>

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

          <Form layout="vertical" component="div" size="small" className="dynamic-blocks-card__form">
            <Row gutter={[8, 8]}>
              <Col xs={24} md={12} lg={8}>
                <Form.Item label="Мин. блок">
                  <InputNumber
                    className="u-full-width"
                    value={config.minPositionsBlock}
                    min={1}
                    size="small"
                    onChange={(value) =>
                      updateConfig(config, {
                        minPositionsBlock: Number(value ?? 1),
                        maxPositionsBlock: Math.max(config.maxPositionsBlock, Number(value ?? 1)),
                      })
                    }
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} lg={8}>
                <Form.Item label="Макс. блок">
                  <InputNumber
                    className="u-full-width"
                    value={config.maxPositionsBlock}
                    min={config.minPositionsBlock}
                    size="small"
                    onChange={(value) =>
                      updateConfig(config, {
                        maxPositionsBlock: Math.max(
                          Number(value ?? config.minPositionsBlock),
                          config.minPositionsBlock,
                        ),
                      })
                    }
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} lg={8}>
                <Form.Item label="Таймаут (мин)">
                  <InputNumber
                    className="u-full-width"
                    value={Math.round(config.timeoutBetweenChangesSec / 60)}
                    min={1}
                    size="small"
                    onChange={(value) =>
                      updateConfig(config, {
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
                    updateConfig(config, { enabled: checked });
                  }}
                  disabled={!extensionReady}
                />
                <Typography.Text>Автоматически менять блокировку</Typography.Text>
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
          className="u-mb-16"
        />
      )}

      <Space direction="vertical" size={16} className="u-full-width">
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
          <Space direction="vertical" size={12} className="u-full-width">
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
          <div className="dynamic-blocks-grid">
            {activeConfigs.map((config) => (
              <div key={config.apiKeyId} className="dynamic-blocks-grid__item">
                {renderConfigCard(config)}
              </div>
            ))}
          </div>
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
        <Form form={addForm} layout="vertical" size="small">
          <Form.Item label="API-ключ" name="apiKeyId" rules={[{ required: true, message: 'Выберите ключ' }]}>
            <Select
              placeholder="Выберите ключ"
              options={apiKeyOptions}
              showSearch
              optionFilterProp="label"
              disabled={apiKeyOptions.length === 0}
            />
          </Form.Item>
          <Form.Item label="Мин. блок" name="minPositionsBlock" rules={[{ required: true, type: 'number', min: 1 }]}>
            <InputNumber min={1} className="u-full-width" size="small" />
          </Form.Item>
          <Form.Item
            label="Макс. блок"
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
            <InputNumber min={1} className="u-full-width" size="small" />
          </Form.Item>
          <Form.Item
            label="Таймаут (мин)"
            name="timeoutBetweenChangesMin"
            rules={[{ required: true, type: 'number', min: 1 }]}
          >
            <InputNumber min={1} className="u-full-width" size="small" />
          </Form.Item>
        </Form>
      </Modal>
    </section>
  );
};

export default DynamicBlocksPage;
