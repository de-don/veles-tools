const HomePage = () => {
  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">Veles Tools</h1>
        <p className="page__subtitle">
          Рабочая панель для управления мультизапусками бэктестов и ботами veles.finance.
        </p>
      </header>

      <div className="panel">
        <h2 className="panel__title">Что уже готово</h2>
        <ul className="panel__list">
          <li>UI запускается как отдельная вкладка расширения.</li>
          <li>Запросы выполняются от лица страницы veles.finance, чтобы избежать CORS.</li>
          <li>Есть навигация между главной и списком ботов.</li>
        </ul>
      </div>

      <div className="panel">
        <h2 className="panel__title">Что дальше</h2>
        <ul className="panel__list">
          <li>Добавить виджет со списком бэктестов и детальные настройки запуска.</li>
          <li>Реализовать действия над ботами (массовый старт, остановка, обновления).</li>
          <li>Подключить показатели эффективности и фильтры.</li>
        </ul>
      </div>
    </section>
  );
};

export default HomePage;
