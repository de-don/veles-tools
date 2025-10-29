import { CopyOutlined } from '@ant-design/icons';
import { Button, Input, Modal } from 'antd';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import Tabs, { type TabItem } from './ui/Tabs';

interface SupportProjectModalProps {
  open: boolean;
  onClose: () => void;
}

type SupportTab = 'bybit' | 'crypto' | 'coffee';

const WALLET_ADDRESS = '0xDAa8A9B232A06616a0b0F9E91D6913A0b7555643';
const DEBANK_URL = `https://debank.com/profile/${WALLET_ADDRESS}`;
const BUY_ME_A_COFFEE_URL = 'https://www.buymeacoffee.com/dedon';
const BYBIT_UID = '496946534';

const SupportProjectModal = ({ open, onClose }: SupportProjectModalProps) => {
  const [activeTab, setActiveTab] = useState<SupportTab>('bybit');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const addressInputId = useId();

  useEffect(() => {
    if (open) {
      setActiveTab('bybit');
      setCopyStatus('idle');
    }
  }, [open]);

  const handleCopyAddress = useCallback(async () => {
    if (!navigator?.clipboard?.writeText) {
      setCopyStatus('error');
      return;
    }

    try {
      await navigator.clipboard.writeText(WALLET_ADDRESS);
      setCopyStatus('copied');
    } catch (_error) {
      setCopyStatus('error');
    }
  }, []);

  const tabItems: TabItem[] = useMemo<TabItem[]>(
    () => [
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
        id: 'crypto',
        label: 'Крипта',
        content: (
          <div className="support-modal__tab">
            <p>
              Можно отправить любую сумму в любой криптовалюте (USDT, USDC, ETH, WBTC, DAI, и т.д.) на протоколе
              Ethereum (ERC-20) — в любой совместимой сети (например, Ethereum Mainnet, Arbitrum, Base и др.).
            </p>
            <div className="support-modal__address-block">
              <label className="support-modal__address-label" htmlFor={addressInputId}>
                Адрес кошелька
              </label>
              <div className="support-modal__address-row">
                <Input
                  id={addressInputId}
                  className="support-modal__address-input"
                  value={WALLET_ADDRESS}
                  readOnly
                  aria-readonly="true"
                />
                <Button icon={<CopyOutlined />} onClick={handleCopyAddress} className="support-modal__copy-button">
                  Скопировать
                </Button>
              </div>
              {copyStatus === 'copied' && (
                <span className="support-modal__copy-status support-modal__copy-status--success">Адрес скопирован</span>
              )}
              {copyStatus === 'error' && (
                <span className="support-modal__copy-status support-modal__copy-status--error">
                  Не удалось скопировать — выдели адрес вручную
                </span>
              )}
            </div>
            <a className="support-modal__link" href={DEBANK_URL} target="_blank" rel="noreferrer noopener">
              Открыть профиль в DeBank
            </a>
          </div>
        ),
      },
      {
        id: 'coffee',
        label: 'Buy Me a Coffee',
        content: (
          <div className="support-modal__tab">
            <p>
              Если удобнее воспользоваться Buy Me a Coffee, можно оставить любое пожертвование и добавить сообщение
              команде. Это быстрый способ сказать спасибо.
            </p>
            <a className="support-modal__link" href={BUY_ME_A_COFFEE_URL} target="_blank" rel="noreferrer noopener">
              Открыть Buy Me a Coffee
            </a>
          </div>
        ),
      },
    ],
    [addressInputId, copyStatus, handleCopyAddress],
  );

  const handleTabChange = (nextTabId: string) => {
    if (nextTabId === 'bybit' || nextTabId === 'crypto' || nextTabId === 'coffee') {
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
