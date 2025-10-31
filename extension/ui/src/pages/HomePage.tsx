import { Card, Col, List, Row, Space, Typography } from 'antd';
import { APP_NAME, APP_VERSION } from '../config/version';

const completedHighlights: string[] = [
  'Агрегированная статистика бэктестов с лимитом ботов и активным МПУ.',
  'Мониторинг активных сделок с графиком P&L.',
  'Массовый менеджмент ботов (запуск/остановка/удаление).',
  'Удобный поиск, фильтрация и сортировка бектестов.',
  'Разделение бэктестов на группы для удобства анализа.',
];

const roadmapHighlights: string[] = [
  'Группы ботов и символов для более удобного управления.',
  'Экспорт публичных ссылок для бектестов и ботов',
  'Блокировка по позиции при анализе бэктестов.',
  'Дополнительные визуализации результатов бэктестов.',
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
