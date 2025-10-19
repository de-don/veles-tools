import { Modal } from 'antd';
import { useMemo } from 'react';
import { useBacktestsSync } from '../../context/BacktestsSyncContext';

interface BacktestsFullSyncModalProps {
  open: boolean;
  onClose: () => void;
  formatDate: (value: string | null | undefined) => string;
}

const formatCount = (value: number | null | undefined): string => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }
  return new Intl.NumberFormat('ru-RU').format(value);
};

const BacktestsFullSyncModal = ({ open, onClose, formatDate }: BacktestsFullSyncModalProps) => {
  const { startSync, stopSync, isSyncRunning, syncSnapshot, localCount, remoteTotal, oldestLocalDate } =
    useBacktestsSync();

  const percent = useMemo(() => {
    if (!remoteTotal || remoteTotal <= 0) {
      return null;
    }
    return Math.min(Math.round((localCount / remoteTotal) * 100), 100);
  }, [remoteTotal, localCount]);

  const handleStart = async () => {
    await startSync({ mode: 'full' });
  };

  const handleCancel = () => {
    if (isSyncRunning) {
      return;
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onCancel={handleCancel}
      footer={null}
      title="Полная синхронизация бэктестов"
      destroyOnClose={false}
      maskClosable={!isSyncRunning}
      centered
    >
      <p className="panel__description" style={{ marginBottom: 12 }}>
        Полная синхронизация выгрузит всю историю бэктестов, включая самые ранние записи. Используйте её, если вы
        подозреваете, что старые данные отсутствуют или были импортированы не полностью.
      </p>
      <p className="panel__description" style={{ marginBottom: 16 }}>
        Процесс может занять продолжительное время и нужен только один раз. Пока синхронизация выполняется, вкладку
        нельзя закрывать без подтверждения.
      </p>

      <div className="panel" style={{ marginTop: 16 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
          }}
        >
          <div>
            <div className="panel__description" style={{ marginBottom: 4 }}>
              Локально сохранено
            </div>
            <div style={{ fontWeight: 600 }}>{formatCount(localCount)}</div>
          </div>
          <div>
            <div className="panel__description" style={{ marginBottom: 4 }}>
              На сервере
            </div>
            <div style={{ fontWeight: 600 }}>{formatCount(remoteTotal)}</div>
          </div>
          <div>
            <div className="panel__description" style={{ marginBottom: 4 }}>
              Самый старый локальный бэктест
            </div>
            <div style={{ fontWeight: 600 }}>{formatDate(oldestLocalDate)}</div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <p className="panel__description">
          {isSyncRunning
            ? 'Полная синхронизация выполняется — это может занять несколько минут.'
            : syncSnapshot?.status === 'success'
              ? 'Последняя полная синхронизация успешно завершилась.'
              : 'Синхронизация ещё не запускалась или была прервана.'}
        </p>
        {syncSnapshot?.error && (
          <div className="form-error" style={{ marginTop: 8 }}>
            {syncSnapshot.error}
          </div>
        )}
        {(percent !== null || isSyncRunning) && (
          <div className="run-log" style={{ marginTop: 12 }}>
            <div className="run-log__progress">
              <span>
                Синхронизировано {formatCount(localCount)} из {formatCount(remoteTotal)}
              </span>
              <div className="progress-bar">
                <div
                  className="progress-bar__fill"
                  style={{ width: percent !== null ? `${percent}%` : isSyncRunning ? '100%' : '0%' }}
                />
              </div>
            </div>
            <div className="panel__description" style={{ marginTop: 8 }}>
              Обработано {formatCount(syncSnapshot?.processed)} записей, загружено страниц:{' '}
              {formatCount(syncSnapshot?.fetchedPages)}
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 12,
          marginTop: 24,
        }}
      >
        <button type="button" className="button button--ghost" onClick={handleCancel} disabled={isSyncRunning}>
          Закрыть
        </button>
        {isSyncRunning ? (
          <button type="button" className="button button--ghost" onClick={stopSync}>
            Остановить
          </button>
        ) : (
          <button type="button" className="button" onClick={handleStart}>
            Запустить полную синхронизацию
          </button>
        )}
      </div>
    </Modal>
  );
};

export default BacktestsFullSyncModal;
