import { CopyOutlined } from '@ant-design/icons';
import { Button, Modal, message, Tooltip } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Tabs, { type TabItem } from './ui/Tabs';

interface SupportProjectModalProps {
  open: boolean;
  onClose: () => void;
}

type SupportTab = 'free' | 'bybit' | 'binance' | 'other';

const BYBIT_UID = '496946534';
const BINANCE_UID = '64125639';
const TELEGRAM_URL = 'https://t.me/dontsov';

const SUPPORT_EMAIL = 'support@veles.finance';
const REFERRAL_ACCOUNT_ID = '388307';
const REFERRAL_CODE = 'reg000';
const REFERRAL_SAMPLE_MESSAGE = `Здравствуйте, прошу прикрепить меня в качестве реферала к аккаунту ${REFERRAL_ACCOUNT_ID} (реф код ${REFERRAL_CODE}). Мой ID XXXXXX`;

const SupportProjectModal = ({ open, onClose }: SupportProjectModalProps) => {
  const [activeTab, setActiveTab] = useState<SupportTab>('free');
  const [messageApi, messageContextHolder] = message.useMessage();

  useEffect(() => {
    if (open) {
      setActiveTab('free');
    }
  }, [open]);

  const handleCopy = useCallback(
    async (value: string, successMessage: string) => {
      if (navigator.clipboard?.writeText == null) {
        messageApi.error('Буфер обмена недоступен');
        return;
      }
      try {
        await navigator.clipboard.writeText(value);
        messageApi.success(successMessage);
      } catch {
        messageApi.error('Не удалось скопировать в буфер обмена');
      }
    },
    [messageApi],
  );

  const tabItems: TabItem[] = useMemo<TabItem[]>(
    () => [
      {
        id: 'free',
        label: 'Бесплатно',
        content: (
          <div className="support-modal__tab">
            <p>
              Напишите на <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
              <Tooltip title="Скопировать email">
                <Button
                  type="text"
                  size="small"
                  aria-label={`Скопировать email ${SUPPORT_EMAIL}`}
                  icon={<CopyOutlined />}
                  className="support-modal__copy-button"
                  onClick={() => {
                    void handleCopy(SUPPORT_EMAIL, 'Email скопирован');
                  }}
                />
              </Tooltip>{' '}
              с просьбой прикрепить к вашему аккаунту код пригласителя. Укажите свой ID, мой ID{' '}
              <strong>{REFERRAL_ACCOUNT_ID}</strong> и мой реферальный код <code>{REFERRAL_CODE}</code>. Это полностью
              бесплатный способ поддержать проект.
            </p>
            <p>
              Пример письма: «{REFERRAL_SAMPLE_MESSAGE}»
              <Tooltip title="Скопировать пример">
                <Button
                  type="text"
                  size="small"
                  aria-label="Скопировать пример письма"
                  icon={<CopyOutlined />}
                  className="support-modal__copy-button"
                  onClick={() => {
                    void handleCopy(REFERRAL_SAMPLE_MESSAGE, 'Текст письма скопирован');
                  }}
                />
              </Tooltip>
              .
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
    [handleCopy],
  );

  const handleTabChange = (nextTabId: string) => {
    if (nextTabId === 'free' || nextTabId === 'bybit' || nextTabId === 'binance' || nextTabId === 'other') {
      setActiveTab(nextTabId);
    }
  };

  return (
    <Modal open={open} onCancel={onClose} footer={null} title="💖 Поддержи проект" centered destroyOnClose width={520}>
      {messageContextHolder}
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
