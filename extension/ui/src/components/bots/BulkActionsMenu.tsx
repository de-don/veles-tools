import { DeleteOutlined, DownOutlined, PlayCircleOutlined, StopOutlined } from '@ant-design/icons';
import { Button, Dropdown, message } from 'antd';
import type { MenuProps } from 'antd';
import type { ButtonProps } from 'antd/es/button';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { useCallback, useMemo, useState } from 'react';
import type { TradingBot } from '../../types/bots';
import { deleteBot, startBot, stopBot } from '../../api/bots';
import BulkActionModal, { type BulkActionCopy, type BulkActionResult } from './BulkActionModal';

type BulkActionKey = 'delete' | 'stop' | 'start';

interface BulkActionConfig {
  key: BulkActionKey;
  menuLabel: string;
  menuIcon: ReactNode;
  menuDanger?: boolean;
  copy: BulkActionCopy;
  confirmButtonDanger?: boolean;
  confirmButtonType?: ButtonProps['type'];
  runAction: (bot: TradingBot) => Promise<void>;
  buildSuccessMessage: (count: number) => string;
  buildPartialMessage: (result: BulkActionResult) => string;
  buildErrorMessage: (result: BulkActionResult) => string;
  removeSucceededFromSelection: boolean;
}

interface BulkActionsMenuProps {
  bots: TradingBot[];
  onReloadRequested: () => void;
  onSelectionUpdate: Dispatch<SetStateAction<TradingBot[]>>;
}

const ACTION_CONFIGS: Record<BulkActionKey, BulkActionConfig> = {
  start: {
    key: 'start',
    menuLabel: 'Запустить',
    menuIcon: <PlayCircleOutlined />,
    copy: {
      title: 'Запустить выбранных ботов',
      description: 'Расширение отправит запрос запуска для каждого выбранного бота последовательно.',
      checkboxLabel: 'Я подтверждаю запуск выбранных ботов',
      confirmLabel: 'Запустить',
      runningMessage: 'Запускаем ботов...',
      successMessage: 'Все выбранные боты успешно запущены.',
      failureMessage: 'Не удалось запустить часть ботов.',
      progressLabel: 'Запущено',
    },
    confirmButtonType: 'primary',
    runAction: async (bot) => {
      await startBot(bot.id);
    },
    buildSuccessMessage: (count) => `Запущено ботов: ${count}.`,
    buildPartialMessage: (result) =>
      `Запущено ${result.succeeded.length} из ${result.succeeded.length + result.failed.length}. Ошибок: ${result.failed.length}.`,
    buildErrorMessage: (result) =>
      result.failed.length > 0 ? 'Не удалось запустить выбранных ботов.' : 'Операция запуска не выполнена.',
    removeSucceededFromSelection: false,
  },
  stop: {
    key: 'stop',
    menuLabel: 'Остановить',
    menuIcon: <StopOutlined />,
    copy: {
      title: 'Остановить выбранных ботов',
      description: 'Расширение отправит запрос остановки для каждого выбранного бота последовательно.',
      checkboxLabel: 'Я подтверждаю остановку выбранных ботов',
      confirmLabel: 'Остановить',
      runningMessage: 'Останавливаем ботов...',
      successMessage: 'Все выбранные боты успешно остановлены.',
      failureMessage: 'Не удалось остановить часть ботов.',
      progressLabel: 'Обработано',
    },
    confirmButtonType: 'primary',
    runAction: async (bot) => {
      await stopBot(bot.id);
    },
    buildSuccessMessage: (count) => `Остановлено ботов: ${count}.`,
    buildPartialMessage: (result) =>
      `Остановлено ${result.succeeded.length} из ${result.succeeded.length + result.failed.length}. Ошибок: ${result.failed.length}.`,
    buildErrorMessage: (result) =>
      result.failed.length > 0 ? 'Не удалось остановить выбранных ботов.' : 'Операция остановки не выполнена.',
    removeSucceededFromSelection: false,
  },
  delete: {
    key: 'delete',
    menuLabel: 'Удалить',
    menuIcon: <DeleteOutlined />,
    menuDanger: true,
    copy: {
      title: 'Удалить выбранных ботов',
      description:
        'Боты будут удалены без возможности восстановления. Операция выполняется последовательно и может занять некоторое время.',
      checkboxLabel: 'Я подтверждаю удаление выбранных ботов',
      confirmLabel: 'Удалить',
      runningMessage: 'Удаляем ботов...',
      successMessage: 'Боты удалены.',
      failureMessage: 'Не удалось удалить часть ботов.',
      progressLabel: 'Удалено',
    },
    confirmButtonDanger: true,
    confirmButtonType: 'primary',
    runAction: async (bot) => {
      await deleteBot(bot.id);
    },
    buildSuccessMessage: (count) => `Удалено ботов: ${count}.`,
    buildPartialMessage: (result) =>
      `Удалено ${result.succeeded.length} из ${result.succeeded.length + result.failed.length}. Ошибок: ${result.failed.length}.`,
    buildErrorMessage: (result) =>
      result.failed.length > 0 ? 'Не удалось удалить выбранных ботов.' : 'Операция удаления не выполнена.',
    removeSucceededFromSelection: true,
  },
};

const buildMenuItems = (configs: Record<BulkActionKey, BulkActionConfig>): MenuProps['items'] => [
  {
    key: configs.start.key,
    label: configs.start.menuLabel,
    icon: configs.start.menuIcon,
  },
  {
    key: configs.stop.key,
    label: configs.stop.menuLabel,
    icon: configs.stop.menuIcon,
  },
  { type: 'divider' },
  {
    key: configs.delete.key,
    label: configs.delete.menuLabel,
    icon: configs.delete.menuIcon,
    danger: configs.delete.menuDanger,
  },
];

const BulkActionsMenu = ({ bots, onReloadRequested, onSelectionUpdate }: BulkActionsMenuProps) => {
  const [messageApi, contextHolder] = message.useMessage();
  const [activeAction, setActiveAction] = useState<BulkActionKey | null>(null);
  const [botsSnapshot, setBotsSnapshot] = useState<TradingBot[]>([]);

  const menuItems = useMemo(() => buildMenuItems(ACTION_CONFIGS), []);

  const handleMenuClick = useCallback<NonNullable<MenuProps['onClick']>>(
    (info) => {
      if (bots.length === 0) {
        return;
      }
      const actionKey = info.key as BulkActionKey;
      setBotsSnapshot([...bots]);
      setActiveAction(actionKey);
    },
    [bots],
  );

  const handleModalClose = useCallback(() => {
    setActiveAction(null);
    setBotsSnapshot([]);
  }, []);

  const handleCompleted = useCallback(
    (action: BulkActionKey, result: BulkActionResult) => {
      const config = ACTION_CONFIGS[action];
      const totalProcessed = result.succeeded.length + result.failed.length;

      if (totalProcessed > 0) {
        if (result.failed.length === 0) {
          messageApi.success(config.buildSuccessMessage(result.succeeded.length));
        } else if (result.succeeded.length === 0) {
          messageApi.error(config.buildErrorMessage(result));
        } else {
          messageApi.warning(config.buildPartialMessage(result));
        }
      }

      if (config.removeSucceededFromSelection && result.succeeded.length > 0) {
        const succeededIds = new Set(result.succeeded);
        onSelectionUpdate((current) => current.filter((bot) => !succeededIds.has(bot.id)));
      }

      if (totalProcessed > 0) {
        onReloadRequested();
      }
    },
    [messageApi, onReloadRequested, onSelectionUpdate],
  );

  const currentAction = activeAction ? ACTION_CONFIGS[activeAction] : null;
  const currentBots = activeAction ? botsSnapshot : [];

  return (
    <>
      {contextHolder}
      <Dropdown
        menu={{ items: menuItems, onClick: handleMenuClick }}
        trigger={['click']}
        disabled={bots.length === 0}
      >
        <Button icon={<DownOutlined />}>Массовые операции</Button>
      </Dropdown>

      {activeAction && currentAction && (
        <BulkActionModal
          open
          bots={currentBots}
          copy={currentAction.copy}
          runAction={currentAction.runAction}
          confirmButtonDanger={currentAction.confirmButtonDanger}
          confirmButtonType={currentAction.confirmButtonType}
          onClose={handleModalClose}
          onCompleted={(result) => handleCompleted(activeAction, result)}
        />
      )}
    </>
  );
};

export default BulkActionsMenu;
