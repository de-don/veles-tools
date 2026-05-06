import {
  AppstoreOutlined,
  CheckCircleOutlined,
  CloudUploadOutlined,
  ControlOutlined,
  ExclamationCircleOutlined,
  ExperimentOutlined,
  HeartFilled,
  HomeOutlined,
  MoonOutlined,
  ReloadOutlined,
  RobotOutlined,
  SettingOutlined,
  SunOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Alert, Button, Layout, Menu, Popover, Segmented, Space, Tag, Typography } from 'antd';
import { type PropsWithChildren, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';
import { APP_NAME, APP_VERSION } from '../config/version';
import { useThemeMode } from '../context/ThemeContext';
import { readStorageValue, writeStorageValue } from '../lib/safeStorage';
import { backtestsService } from '../services/backtests';
import { usersService } from '../services/users';
import type { BacktestLimits } from '../types/backtests';
import type { UserBalance } from '../types/users';
import ConnectionHelpModal from './ConnectionHelpModal';
import SupportProjectModal from './SupportProjectModal';
import TelegramChannelModal from './TelegramChannelModal';

interface AppLayoutProps extends PropsWithChildren {
  extensionReady: boolean;
  connectionStatus: ConnectionStatus;
  onPing: () => void;
  onOpenVeles: () => void;
}

export interface ConnectionStatus {
  ok: boolean;
  lastChecked: number | null;
  error?: string;
  origin?: string | null;
}

const { Header, Sider, Content } = Layout;

const REPOSITORY_URL = 'https://github.com/de-don/veles-tools';
const AUTHOR_URL = 'https://t.me/dontsov';
const CHROME_WEBSTORE_URL = 'https://chromewebstore.google.com/detail/veles-tools/hgfhapnhcnncjplmjkbbljhjpcjilbgm';
const TELEGRAM_CHANNEL_URL = 'https://t.me/veles_tools';
const TELEGRAM_MODAL_KEY = '__VELES_TG_CHANNEL_SHOWN';
const ACCOUNT_STATUS_REFRESH_MS = 5 * 60 * 1000;

interface AccountStatusSnapshot {
  backtestLimits: BacktestLimits | null;
  backtestLimitsError: string | null;
  userBalance: UserBalance | null;
  userBalanceError: string | null;
}

const formatTimestamp = (timestamp: number | null) => {
  if (!timestamp) {
    return '—';
  }
  return new Date(timestamp).toLocaleTimeString();
};

const formatBacktestLimitsExpiration = (expiration: Date): string => {
  return expiration.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatBacktestLimitsStatus = (limits: BacktestLimits | null): string => {
  if (!limits) {
    return '—';
  }
  if (limits.hasActiveSubscription && limits.expiration) {
    return `Активна до ${formatBacktestLimitsExpiration(limits.expiration)}`;
  }
  return `Бесплатно: ${limits.permits} из 10`;
};

const serviceBalanceFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 8,
});

const formatServiceBalance = (balance: UserBalance | null): string => {
  if (!balance) {
    return '—';
  }
  return serviceBalanceFormatter.format(balance.balance);
};

const resolveSelectedKey = (pathname: string, navigationKeys: string[]) => {
  if (!pathname || pathname === '/') {
    return '/';
  }
  const normalized = pathname.replace(/\/+$/, '');
  if (navigationKeys.includes(normalized)) {
    return normalized;
  }
  const nestedMatch = navigationKeys.find((key) => key !== '/' && normalized.startsWith(`${key}/`));
  return nestedMatch ?? '/';
};

const AppLayout = ({ children, extensionReady, connectionStatus, onPing, onOpenVeles }: AppLayoutProps) => {
  const { mode: themeMode, setMode: setThemeMode } = useThemeMode();
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [telegramModalOpen, setTelegramModalOpen] = useState(false);
  const [connectionHelpOpen, setConnectionHelpOpen] = useState(false);
  const [backtestLimits, setBacktestLimits] = useState<BacktestLimits | null>(null);
  const [backtestLimitsLoading, setBacktestLimitsLoading] = useState(false);
  const [backtestLimitsError, setBacktestLimitsError] = useState<string | null>(null);
  const [userBalance, setUserBalance] = useState<UserBalance | null>(null);
  const [userBalanceLoading, setUserBalanceLoading] = useState(false);
  const [userBalanceError, setUserBalanceError] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (readStorageValue(TELEGRAM_MODAL_KEY) !== 'shown') {
      setTelegramModalOpen(true);
      writeStorageValue(TELEGRAM_MODAL_KEY, 'shown');
    }
  }, []);

  useEffect(() => {
    if (!extensionReady || !connectionStatus.ok) {
      setBacktestLimits(null);
      setBacktestLimitsError(null);
      setBacktestLimitsLoading(false);
      setUserBalance(null);
      setUserBalanceError(null);
      setUserBalanceLoading(false);
      return;
    }

    let cancelled = false;

    const applySnapshot = (snapshot: AccountStatusSnapshot) => {
      setBacktestLimits(snapshot.backtestLimits);
      setBacktestLimitsError(snapshot.backtestLimitsError);
      setBacktestLimitsLoading(false);
      setUserBalance(snapshot.userBalance);
      setUserBalanceError(snapshot.userBalanceError);
      setUserBalanceLoading(false);
    };

    const loadStatus = async () => {
      setBacktestLimitsLoading(true);
      setBacktestLimitsError(null);
      setUserBalanceLoading(true);
      setUserBalanceError(null);
      try {
        const [limitsResult, balanceResult] = await Promise.allSettled([
          backtestsService.getBacktestLimits(),
          usersService.getUserBalance(),
        ]);
        const snapshot: AccountStatusSnapshot = {
          backtestLimits: limitsResult.status === 'fulfilled' ? limitsResult.value : null,
          backtestLimitsError: limitsResult.status === 'rejected' ? 'Не удалось загрузить' : null,
          userBalance: balanceResult.status === 'fulfilled' ? balanceResult.value : null,
          userBalanceError: balanceResult.status === 'rejected' ? 'Не удалось загрузить' : null,
        };

        if (limitsResult.status === 'rejected') {
          console.warn('[AppLayout] Не удалось загрузить лимиты бэктестов', limitsResult.reason);
        }
        if (balanceResult.status === 'rejected') {
          console.warn('[AppLayout] Не удалось загрузить баланс сервиса', balanceResult.reason);
        }

        if (!cancelled) {
          applySnapshot(snapshot);
        }
      } catch (error) {
        console.warn('[AppLayout] Не удалось загрузить статус аккаунта', error);
        if (!cancelled) {
          setBacktestLimits(null);
          setBacktestLimitsError('Не удалось загрузить');
          setUserBalance(null);
          setUserBalanceError('Не удалось загрузить');
        }
      } finally {
        if (!cancelled) {
          setBacktestLimitsLoading(false);
          setUserBalanceLoading(false);
        }
      }
    };

    void loadStatus();
    const refreshTimer = window.setInterval(() => {
      void loadStatus();
    }, ACCOUNT_STATUS_REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
    };
  }, [connectionStatus.ok, connectionStatus.origin, extensionReady]);

  const navigationItems = [
    {
      key: '/',
      label: 'Главная',
      icon: <HomeOutlined />,
    },
    {
      key: '/active-deals',
      label: 'Активные сделки',
      icon: <ThunderboltOutlined />,
    },
    {
      key: '/bots',
      label: 'Мои боты',
      icon: <RobotOutlined />,
    },
    {
      key: '/dynamic-blocks',
      label: 'Динамич. блок.',
      icon: <ControlOutlined />,
    },
    {
      key: '/import',
      label: 'Импорт ботов',
      icon: <CloudUploadOutlined />,
    },
    {
      key: '/backtests',
      label: 'Бэктесты',
      icon: <ExperimentOutlined />,
    },
    {
      key: '/backtest-groups',
      label: 'Группы бэктестов',
      icon: <AppstoreOutlined />,
    },
    {
      key: '/settings',
      label: 'Настройки',
      icon: <SettingOutlined />,
    },
  ];

  const navigationKeys = (navigationItems ?? [])
    .map((item) => (item && 'key' in item ? (item.key as string | undefined) : undefined))
    .filter((key): key is string => Boolean(key));

  const selectedKey = useMemo(
    () => resolveSelectedKey(location.pathname, navigationKeys),
    [location.pathname, navigationKeys],
  );
  const lastCheckedLabel = formatTimestamp(connectionStatus.lastChecked);

  const brand = (
    <div className="app-layout__brand">
      <img className="app-layout__brand-logo" src={logo} alt="Veles Tools" />
      <div className="app-layout__brand-meta">
        <Typography.Text strong>{APP_NAME}</Typography.Text>
        <Typography.Text type="secondary">v{APP_VERSION}</Typography.Text>
      </div>
    </div>
  );

  const statusTag = connectionStatus.ok ? (
    <Tag icon={<CheckCircleOutlined />} color="success">
      Связь активна
    </Tag>
  ) : (
    <Tag icon={<ExclamationCircleOutlined />} color="error">
      Связь не активна
    </Tag>
  );

  const velesOriginLabel = (connectionStatus.origin ?? 'https://veles.finance').replace(/^https?:\/\//, '');

  const connectionPopover = (
    <Space direction="vertical" size={8} className="app-layout__popover">
      <Typography.Text type="secondary">Обновлено: {lastCheckedLabel}</Typography.Text>
      <Typography.Text type={connectionStatus.ok ? 'secondary' : 'danger'}>
        {connectionStatus.ok
          ? 'Соединение с вкладкой активно.'
          : (connectionStatus.error ?? 'Нет соединения с вкладкой.')}
      </Typography.Text>
      {connectionStatus.origin && <Typography.Text type="secondary">Домен: {connectionStatus.origin}</Typography.Text>}
      <Button size="small" type="primary" icon={<ReloadOutlined />} onClick={onPing}>
        Обновить
      </Button>
      {!connectionStatus.ok && (
        <Button size="small" type="link" onClick={() => setConnectionHelpOpen(true)}>
          Как восстановить связь
        </Button>
      )}
    </Space>
  );

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (typeof key === 'string' && key !== location.pathname) {
      navigate(key);
    }
  };

  return (
    <Layout className="app-layout">
      <Sider theme="light" width={240} className="app-layout__sider">
        {brand}
        <nav className="app-layout__nav">
          <Menu mode="inline" items={navigationItems} selectedKeys={[selectedKey]} onClick={handleMenuClick} />
        </nav>
        {!extensionReady && (
          <Alert
            type="warning"
            showIcon
            className="app-layout__extension-alert"
            message="Расширение Veles Tools неактивно"
            description="Откройте интерфейс из меню расширения для работы с запросами."
          />
        )}
        <div className="app-layout__status-panel">
          <div className="app-layout__status-row">
            <Typography.Text type="secondary" className="app-layout__status-label">
              Бэктесты
            </Typography.Text>
            <Tag color={backtestLimits?.hasActiveSubscription ? 'success' : 'default'}>
              {backtestLimitsLoading
                ? 'Загрузка...'
                : (backtestLimitsError ?? formatBacktestLimitsStatus(backtestLimits))}
            </Tag>
          </div>
          <div className="app-layout__status-row">
            <Typography.Text type="secondary" className="app-layout__status-label">
              Баланс сервиса
            </Typography.Text>
            <Tag color="processing">
              {userBalanceLoading ? 'Загрузка...' : (userBalanceError ?? formatServiceBalance(userBalance))}
            </Tag>
          </div>
        </div>
        <div className="app-layout__sider-footer">
          <Space direction="vertical" size={8}>
            <Typography.Link href={CHROME_WEBSTORE_URL} target="_blank" rel="noreferrer noopener">
              Страница в Chrome Web Store
            </Typography.Link>
            <Typography.Link href={TELEGRAM_CHANNEL_URL} target="_blank" rel="noreferrer noopener">
              Telegram-канал Veles Tools
            </Typography.Link>
            <Typography.Link href={REPOSITORY_URL} target="_blank" rel="noreferrer noopener">
              Исходный код на GitHub
            </Typography.Link>
            <Typography.Link href={AUTHOR_URL} target="_blank" rel="noreferrer noopener">
              Автор: @dontsov
            </Typography.Link>
          </Space>
        </div>
      </Sider>
      <Layout className="app-layout__main">
        <Header className="app-layout__header">
          <Space direction="vertical" size={2} className="app-layout__header-details">
            <Space size="small" wrap align="center">
              <Popover content={connectionPopover} trigger="hover" placement="bottomLeft">
                {statusTag}
              </Popover>
            </Space>
          </Space>
          <Space size="middle" wrap>
            {!connectionStatus.ok && (
              <Button type="primary" onClick={onOpenVeles}>
                Открыть {velesOriginLabel}
              </Button>
            )}
            <Segmented
              size="middle"
              options={[
                { label: 'Светлая', value: 'light', icon: <SunOutlined /> },
                { label: 'Тёмная', value: 'dark', icon: <MoonOutlined /> },
              ]}
              value={themeMode}
              onChange={(value) => setThemeMode(value as 'light' | 'dark')}
            />
            <Button
              type="primary"
              icon={<HeartFilled className="support-button__icon" />}
              className="support-button support-button--wave"
              onClick={() => setSupportModalOpen(true)}
            >
              Поддержать проект
            </Button>
          </Space>
        </Header>
        <Content className="app-layout__content">{children}</Content>
      </Layout>
      <SupportProjectModal open={supportModalOpen} onClose={() => setSupportModalOpen(false)} />
      <TelegramChannelModal
        open={telegramModalOpen}
        onClose={() => setTelegramModalOpen(false)}
        channelUrl={TELEGRAM_CHANNEL_URL}
      />
      <ConnectionHelpModal open={connectionHelpOpen} onClose={() => setConnectionHelpOpen(false)} />
    </Layout>
  );
};

export default AppLayout;
