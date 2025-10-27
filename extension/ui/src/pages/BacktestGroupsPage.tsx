import { Button, Empty, message, Popconfirm, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import RenameBacktestGroupModal from '../components/backtests/RenameBacktestGroupModal';
import { useBacktestGroups } from '../context/BacktestGroupsContext';
import type { BacktestGroup } from '../types/backtestGroups';

const formatTimestamp = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '—';
  }
  try {
    return new Date(value).toLocaleString('ru-RU');
  } catch {
    return '—';
  }
};

const BacktestGroupsPage = () => {
  const { groups, deleteGroup, updateGroupName } = useBacktestGroups();
  const [renameTarget, setRenameTarget] = useState<BacktestGroup | null>(null);
  const [messageApi, messageContextHolder] = message.useMessage();
  const navigate = useNavigate();

  const columns = useMemo<ColumnsType<BacktestGroup>>(
    () => [
      {
        title: 'Название',
        dataIndex: 'name',
        key: 'name',
        render: (_value, record) => (
          <div>
            <Link to={`/backtest-groups/${record.id}`} style={{ fontWeight: 600 }}>
              {record.name}
            </Link>
            <div className="panel__description">ID: {record.id}</div>
          </div>
        ),
      },
      {
        title: 'Бэктестов',
        dataIndex: 'backtestIds',
        key: 'count',
        sorter: (a, b) => a.backtestIds.length - b.backtestIds.length,
        render: (value: number[]) => value.length,
        width: 120,
      },
      {
        title: 'Обновлено',
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        sorter: (a, b) => a.updatedAt - b.updatedAt,
        render: (value: number) => formatTimestamp(value),
        width: 200,
      },
      {
        title: 'Создано',
        dataIndex: 'createdAt',
        key: 'createdAt',
        sorter: (a, b) => a.createdAt - b.createdAt,
        render: (value: number) => formatTimestamp(value),
        width: 200,
      },
      {
        title: 'Действия',
        key: 'actions',
        render: (_value, record) => (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="small" type="primary" onClick={() => navigate(`/backtest-groups/${record.id}`)}>
              Открыть
            </Button>
            <Button size="small" onClick={() => setRenameTarget(record)}>
              Переименовать
            </Button>
            <Popconfirm
              title="Удалить группу?"
              description="Группа будет удалена, но сами бэктесты останутся доступными в списке."
              okText="Удалить"
              cancelText="Отмена"
              onConfirm={() => {
                deleteGroup(record.id);
                messageApi.success(`Группа «${record.name}» удалена.`);
              }}
            >
              <Button size="small" danger>
                Удалить
              </Button>
            </Popconfirm>
          </div>
        ),
        width: 280,
      },
    ],
    [deleteGroup, messageApi, navigate],
  );

  const handleRenameSubmit = (name: string) => {
    if (!renameTarget) {
      return;
    }
    const result = updateGroupName(renameTarget.id, name);
    if (!result) {
      messageApi.error('Не удалось переименовать группу.');
      return;
    }
    messageApi.success(`Группа переименована в «${result.name}».`);
    setRenameTarget(null);
  };

  return (
    <section className="page">
      {messageContextHolder}
      <header className="page__header">
        <h1 className="page__title">Группы бэктестов</h1>
        <p className="page__subtitle">
          Сохраняйте наборы бэктестов, чтобы быстро возвращаться к их анализу, делиться подборками и сравнивать
          агрегированную статистику.
        </p>
      </header>

      <div className="panel">
        <div className="panel__header">
          <div>
            <h2 className="panel__title">Сохранённые группы</h2>
            <p className="panel__description">Всего групп: {groups.length}</p>
          </div>
        </div>
        {groups.length === 0 ? (
          <Empty description="Группы пока не сохранены." style={{ padding: '48px 0' }} />
        ) : (
          <Table<BacktestGroup>
            rowKey={(record) => record.id}
            columns={columns}
            dataSource={groups}
            pagination={false}
            size="middle"
          />
        )}
      </div>

      <RenameBacktestGroupModal
        open={Boolean(renameTarget)}
        group={renameTarget}
        onCancel={() => setRenameTarget(null)}
        onSubmit={handleRenameSubmit}
      />
    </section>
  );
};

export default BacktestGroupsPage;
