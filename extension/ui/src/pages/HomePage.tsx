import { Link } from 'react-router-dom';
import { APP_NAME, APP_VERSION } from '../config/version';

const completedHighlights: string[] = [
  'Мультизапуск и управление очередью бэктестов прямо из расширения.',
  'Детальные метрики с агрегацией, графиком одновременных позиций и быстрым кэшем деталей/циклов.',
  'Импорт пользовательских ботов с локальным хранилищем стратегий и быстрым доступом.',
  'UI развёрнут в отдельной вкладке расширения, все запросы проксируются через активную вкладку veles.finance.',
];

const roadmapHighlights: string[] = [
  'Фильтры и сортировки для списков ботов и бэктестов.',
  'Дополнительные визуализации и метрики для анализа результатов.',
  'Группы символов и конфигурируемые таблицы для гибкой аналитики.',
];

const quickLinks = [
  {
    to: '/backtests',
    label: 'К бэктестам',
    description: 'Собирайте статистику, запускайте мультизапуски и проверяйте агрегации.',
  },
  {
    to: '/import',
    label: 'Импорт ботов',
    description: 'Подготовьте стратегии заранее, чтобы запускать их в пару кликов.',
  },
  {
    to: '/settings',
    label: 'Настройки',
    description: 'Очистка локального кэша и вспомогательные параметры работы.',
  },
];

const faqItems = [
  {
    question: 'Почему UI пишет, что нет соединения с вкладкой?',
    answer:
      'Расширение общается через открытую вкладку veles.finance. Убедитесь, что вкладка активна и не выгружена браузером, затем нажмите «Обновить» в боковой панели.',
  },
  {
    question: 'Как ускорить загрузку детальных данных бэктестов?',
    answer:
      'Детали и циклы кэшируются локально. После первого запроса статистика подгружается мгновенно. При необходимости можно очистить кэш на странице «Настройки».',
  },
];

const HomePage = () => {
  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">{APP_NAME}</h1>
        <p className="page__subtitle">
          Рабочая панель для управления мультизапусками бэктестов и ботами veles.finance. Текущая версия — v{APP_VERSION}.
        </p>
      </header>

      <div className="panel panel--hero">
        <div className="home-hero">
          <div>
            <h2 className="panel__title">Быстрый старт</h2>
            <p className="panel__description">
              Собирайте метрики, управляйте очередью бэктестов и сохраняйте стратегии без переключения между страницами.
            </p>
          </div>
          <div className="home-quick-links">
            {quickLinks.map((link) => (
              <Link key={link.to} to={link.to} className="home-quick-link">
                <span className="home-quick-link__label">{link.label}</span>
                <span className="home-quick-link__hint">{link.description}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="home-grid">
        <div className="panel">
          <h2 className="panel__title">Что уже реализовано</h2>
          <ul className="panel__list">
            {completedHighlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="panel">
          <h2 className="panel__title">В планах</h2>
          <ul className="panel__list">
            {roadmapHighlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="panel">
        <h2 className="panel__title">Часто задаваемые вопросы</h2>
        <div className="faq">
          {faqItems.map((item) => (
            <div key={item.question} className="faq__item">
              <div className="faq__question">{item.question}</div>
              <div className="faq__answer">{item.answer}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HomePage;
