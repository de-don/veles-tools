import { Card, Col, List, Row, Space, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { APP_NAME, APP_VERSION } from '../config/version';

const completedHighlights: string[] = [
  'Мультизапуск бэктестов для любых ботов.',
  'Детальные метрики с агрегацией и графиком одновременных позиций.',
  'Отслеживание активных позиций и их закрытие',
  'Массовый запуск и остановка ботов',
  'Импорт пользовательских ботов с локальным хранилищем стратегий и быстрым доступом.',
];

const roadmapHighlights: string[] = [
  'Фильтры и сортировки для списков ботов и бэктестов.',
  'Экспорт и импорт ботов и бэктестов.',
  'Дополнительные визуализации и метрики для анализа результатов.',
  'Группы символов, ботов и бектестов.',
  'Конфигурируемые таблицы для гибкой аналитики.',
  'Новый дизайн и улучшенный UX.',
];

const quickLinks = [
  {
    to: '/active-deals',
    label: 'Активные сделки',
    description: 'Отслеживайте и управляйте открытыми позициями.',
  },
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
    <div className="page">
      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        <Space direction="vertical" size={4} className="page__header">
          <Typography.Title level={1} style={{ marginBottom: 0 }}>
            {APP_NAME}
          </Typography.Title>
          <Typography.Paragraph type="secondary" className="page__subtitle" style={{ marginBottom: 0 }}>
            Veles Tools — рабочая панель для управления мультизапусками бэктестов и ботами veles.finance. Текущая версия
            — v{APP_VERSION}.
          </Typography.Paragraph>
        </Space>

        <Card
          title="Быстрый старт"
          bordered
          extra={<Typography.Text type="secondary">Готовые действия для работы каждый день</Typography.Text>}
        >
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Typography.Paragraph style={{ marginBottom: 0 }}>
              Собирайте метрики, управляйте очередью бэктестов и сохраняйте стратегии без переключения между страницами.
            </Typography.Paragraph>
            <Row gutter={[16, 16]}>
              {quickLinks.map((link) => (
                <Col key={link.to} xs={24} sm={12}>
                  <Link to={link.to} className="home-quick-card">
                    <Card hoverable size="small" className="home-quick-card__inner">
                      <Space direction="vertical" size={4}>
                        <Typography.Text strong>{link.label}</Typography.Text>
                        <Typography.Text type="secondary">{link.description}</Typography.Text>
                      </Space>
                    </Card>
                  </Link>
                </Col>
              ))}
            </Row>
          </Space>
        </Card>

        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Card title="Функционал" bordered>
              <List
                dataSource={completedHighlights}
                renderItem={(item) => (
                  <List.Item>
                    <Typography.Text>{item}</Typography.Text>
                  </List.Item>
                )}
              />
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title="В планах" bordered>
              <List
                dataSource={roadmapHighlights}
                renderItem={(item) => (
                  <List.Item>
                    <Typography.Text>{item}</Typography.Text>
                  </List.Item>
                )}
              />
            </Card>
          </Col>
        </Row>

        <Card title="Часто задаваемые вопросы" bordered>
          <List
            itemLayout="vertical"
            dataSource={faqItems}
            split={false}
            renderItem={(item) => (
              <List.Item key={item.question}>
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <Typography.Text strong>{item.question}</Typography.Text>
                  <Typography.Paragraph style={{ marginBottom: 0 }}>{item.answer}</Typography.Paragraph>
                </Space>
              </List.Item>
            )}
          />
        </Card>
      </Space>
    </div>
  );
};

export default HomePage;
