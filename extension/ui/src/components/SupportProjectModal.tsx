import { Modal } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import Tabs, { type TabItem } from './ui/Tabs';

interface SupportProjectModalProps {
  open: boolean;
  onClose: () => void;
}

type SupportTab = 'free' | 'bybit' | 'binance' | 'other';

const BYBIT_UID = '496946534';
const BINANCE_UID = '64125639';
const TELEGRAM_URL = 'https://t.me/dontsov';

const SupportProjectModal = ({ open, onClose }: SupportProjectModalProps) => {
  const [activeTab, setActiveTab] = useState<SupportTab>('free');

  useEffect(() => {
    if (open) {
      setActiveTab('free');
    }
  }, [open]);

  const tabItems: TabItem[] = useMemo<TabItem[]>(
    () => [
      {
        id: 'free',
        label: 'Бесплатно',
        content: (
          <div className="support-modal__tab">
            <p>
              Если вы ещё не чей-то реферал в Veles, просто напишите в поддержку{' '}
              <a href="https://t.me/VelesSupportBot" target="_blank" rel="noreferrer noopener">
                t.me/VelesSupportBot
              </a>{' '}
              и попросите прикрепить вас к моему аккаунту (ID <strong>388307</strong>). Это бесплатно и помогает
              проекту.
            </p>
          </div>
        ),
      },
      {
        id: 'bybit',
        label: 'ByBit перевод',
        content: (
          <div className="support-modal__tab">
            <p>
              Можно перевести любую сумму на ByBit по UID <strong>{BYBIT_UID}</strong>. Укажи его как получателя в
              приложении или веб-версии биржи.
            </p>
          </div>
        ),
      },
      {
        id: 'binance',
        label: 'Binance перевод',
        content: (
          <div className="support-modal__tab">
            <p>
              На Binance можно отправить любую сумму по UID <strong>{BINANCE_UID}</strong>. Укажите его в разделе
              «Перевод по UID» и выберите удобную валюту.
            </p>
          </div>
        ),
      },
      {
        id: 'other',
        label: 'Другой вариант',
        content: (
          <div className="support-modal__tab">
            <p>
              Если удобнее другой способ поддержки —{' '}
              <a href={TELEGRAM_URL} target="_blank" rel="noreferrer noopener">
                напишите в Telegram
              </a>
              , обсудим удобный для вас вариант.
            </p>
          </div>
        ),
      },
    ],
    [],
  );

  const handleTabChange = (nextTabId: string) => {
    if (nextTabId === 'free' || nextTabId === 'bybit' || nextTabId === 'binance' || nextTabId === 'other') {
      setActiveTab(nextTabId);
    }
  };

  return (
    <Modal open={open} onCancel={onClose} footer={null} title="💖 Поддержи проект" centered destroyOnClose width={520}>
      <div className="support-modal">
        <p className="support-modal__intro">
          Этот проект — опенсорс и развивается в моё свободное время. Если расширение делает твою работу проще — ты
          всегда можешь помочь ему расти!
        </p>
        <p className="support-modal__intro">
          Любая поддержка мотивирует развивать новые функции и улучшать стабильность. Поддержка абсолютно добровольная и
          может быть любой суммы ❤️
        </p>
        <Tabs items={tabItems} activeTabId={activeTab} onTabChange={handleTabChange} />
      </div>
    </Modal>
  );
};

export default SupportProjectModal;
