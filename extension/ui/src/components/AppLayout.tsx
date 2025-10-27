import {
  AppstoreOutlined,
  CheckCircleOutlined,
  CloudUploadOutlined,
  ExclamationCircleOutlined,
  ExperimentOutlined,
  HeartOutlined,
  HomeOutlined,
  ReloadOutlined,
  RobotOutlined,
  SettingOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { Alert, Button, Layout, Menu, Space, Tag, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { type PropsWithChildren, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';
import { APP_NAME, APP_VERSION } from '../config/version';
import SupportProjectModal from './SupportProjectModal';

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

const NAVIGATION_ITEMS = [
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
] satisfies MenuProps['items'];

const NAVIGATION_KEYS = NAVIGATION_ITEMS.map((item) => (item && 'key' in item ? item.key : null)).filter(
  (key): key is string => typeof key === 'string',
);

const formatTimestamp = (timestamp: number | null) => {
  if (!timestamp) {
    return '—';
  }
  return new Date(timestamp).toLocaleTimeString();
};

const resolveSelectedKey = (pathname: string) => {
  if (!pathname || pathname === '/') {
    return '/';
  }
  const normalized = pathname.replace(/\/+$/, '');
  if (NAVIGATION_KEYS.includes(normalized)) {
    return normalized;
  }
  const nestedMatch = NAVIGATION_KEYS.find((key) => key !== '/' && normalized.startsWith(`${key}/`));
  return nestedMatch ?? '/';
};

const AppLayout = ({ children, extensionReady, connectionStatus, onPing, onOpenVeles }: AppLayoutProps) => {
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const selectedKey = useMemo(() => resolveSelectedKey(location.pathname), [location.pathname]);
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
      {connectionStatus.error ?? 'Нет соединения'}
    </Tag>
  );

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (typeof key === 'string' && key !== location.pathname) {
      navigate(key);
    }
  };

  return (
    <Layout className="app-layout" style={{ minHeight: '100vh' }}>
      <Sider theme="light" width={240} className="app-layout__sider">
        {brand}
        <nav className="app-layout__nav">
          <Menu mode="inline" items={NAVIGATION_ITEMS} selectedKeys={[selectedKey]} onClick={handleMenuClick} />
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
        <div className="app-layout__sider-footer">
          <Space direction="vertical" size={8}>
            <Typography.Link href={CHROME_WEBSTORE_URL} target="_blank" rel="noreferrer noopener">
              Расширение в Chrome Web Store
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
              {statusTag}
              <Typography.Text type="secondary">Обновлено: {lastCheckedLabel}</Typography.Text>
              {connectionStatus.origin && (
                <Typography.Text type="secondary">Домен: {connectionStatus.origin}</Typography.Text>
              )}
            </Space>
          </Space>
          <Space size="middle" wrap>
            <Button icon={<ReloadOutlined />} onClick={onPing}>
              Обновить
            </Button>
            {!connectionStatus.ok && (
              <Button type="primary" onClick={onOpenVeles}>
                Открыть veles.finance
              </Button>
            )}
            <Button icon={<HeartOutlined />} onClick={() => setSupportModalOpen(true)}>
              Поддержать проект
            </Button>
          </Space>
        </Header>
        <Content className="app-layout__content">{children}</Content>
      </Layout>
      <SupportProjectModal open={supportModalOpen} onClose={() => setSupportModalOpen(false)} />
    </Layout>
  );
};

export default AppLayout;
