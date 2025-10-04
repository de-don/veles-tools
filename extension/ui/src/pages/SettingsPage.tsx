import { useState } from 'react';
import { clearBacktestCache } from '../storage/backtestCache';

const SettingsPage = () => {
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleClearCache = async () => {
    if (status === 'pending') {
      return;
    }
    setStatus('pending');
    setErrorMessage(null);
    try {
      await clearBacktestCache();
      setStatus('success');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorMessage(message);
      setStatus('error');
    }
  };

  const renderStatusNote = () => {
    if (status === 'success') {
      return <div className="banner banner--success">Кэш очищен.</div>;
    }
    if (status === 'error') {
      return <div className="banner banner--warning">Не удалось очистить кэш: {errorMessage ?? 'неизвестная ошибка'}.</div>;
    }
    return null;
  };

  const statusNote = renderStatusNote();

  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">Настройки</h1>
        <p className="page__subtitle">Управление локальными кэшами и вспомогательными параметрами.</p>
      </header>

      <div className="panel">
        <h2 className="panel__title">Очистка данных</h2>
        <p className="panel__description">
          Удаляет сохранённые детальные данные бэктестов и их циклов из локального кэша. При повторном обращении
          информация будет загружена заново с сервера.
        </p>
        <button type="button" className="button" onClick={handleClearCache} disabled={status === 'pending'}>
          {status === 'pending' ? 'Очищаем…' : 'Очистить кэш'}
        </button>
        {statusNote ? <div style={{ marginTop: 12 }}>{statusNote}</div> : null}
      </div>
    </section>
  );
};

export default SettingsPage;
