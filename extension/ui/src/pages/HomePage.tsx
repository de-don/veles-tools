import { Link } from 'react-router-dom';
import { APP_NAME, APP_VERSION } from '../config/version';

const completedHighlights: string[] = [
  'Мультизапуск бэктестов для любых ботов.',
  'Детальные метрики с агрегацией и графиком одновременных позиций.',
  'Импорт пользовательских ботов с локальным хранилищем стратегий и быстрым доступом.',
];

const roadmapHighlights: string[] = [
  'Фильтры и сортировки для списков ботов и бэктестов.',
  'Дополнительные визуализации и метрики для анализа результатов.',
  'Группы символов, группы ботов и конфигурируемые таблицы для гибкой аналитики.',
];

const quickLinks = [
  {
    to: '/bots',
    label: 'Мои боты',
    description: 'Запускайте бэктесты для своих ботов сразу на большом наборе валют.',
  },
  {
    to: '/backtests',
    label: 'К бэктестам',
    description: 'Собирайте статистику, анализируйте результаты.',
  },
  {
    to: '/import',
    label: 'Импорт ботов',
    description: 'Импортируйте публичных ботов для дальнейших бэктестов.',
  },
];

const faqItems = [
  {
    question: 'Почему Veles Tools пишет, что нет соединения с вкладкой?',
    answer:
      'Veles Tools работает через открытую вкладку veles.finance. Если видите статус «нет соединения», откройте или обновите вкладку veles.finance, закройте окно расширения и запустите его снова, затем нажмите «Обновить» в боковой панели — обычно этого достаточно, чтобы восстановить связь.',
  },
  {
    question: 'Почему в агрегированных метриках некоторые показатели равны нулю?',
    answer:
      'Агрегация считает метрики только по завершённым бэктестам с валидными данными. Если у стратегии ещё нет просадки или исходный ответ veles.finance не содержит значения, показатель (например, максимальная просадка) останется 0. Запустите дополнительные бэктесты и убедитесь, что они завершились успешно, чтобы получить корректные значения.',
  },
  {
    question: 'Как запустить мультизапуск бэктестов для моих ботов?',
    answer:
      'Перейдите на страницу «Мои боты», выберите нужные стратегии и используйте действие «Запустить бэктесты». Задайте параметры запуска и подтвердите выполнение очереди.',
  },
  {
    question: 'Как протестировать чужие стратегии?',
    answer:
      'Перейдите на страницу «Импорт ботов», вставьте ссылку на публичного бота и импортируйте его. После этого запускайте бэктесты так же, как и для собственных стратегий.',
  },
  {
    question: 'Где хранятся мои боты и результаты бэктестов?',
    answer:
      'Все данные хранятся локально в вашем браузере. Это обеспечивает быстрый доступ и конфиденциальность стратегий и результатов.',
  },
  {
    question: 'Как обновить расширение?',
    answer:
      'Veles Tools обновляется автоматически через магазин расширений. Чтобы проверить наличие обновлений вручную, откройте страницу расширений браузера (например, chrome://extensions), включите режим разработчика и нажмите «Обновить», либо переустановите расширение из магазина.',
  },
  {
    question: 'А где гарантии, что вы не нанесёте вред?',
    answer:
      'Это open-source проект. Репозиторий GitHub доступен в левой панели, где можно проверить код, предложить улучшения или задать вопросы.',
  },
];

const HomePage = () => {
  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">{APP_NAME}</h1>
        <p className="page__subtitle">
          Veles Tools — рабочая панель для управления мультизапусками бэктестов и ботами veles.finance. Текущая версия — v{APP_VERSION}.
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
