import { Button, Modal, Space, Typography } from 'antd';

interface TelegramChannelModalProps {
  open: boolean;
  onClose: () => void;
  channelUrl: string;
}

const TelegramChannelModal = ({ open, onClose, channelUrl }: TelegramChannelModalProps) => (
  <Modal open={open} onCancel={onClose} footer={null} title="📣 Наш Telegram-канал" centered destroyOnClose width={520}>
    <Space direction="vertical" size={12}>
      <Typography.Text>
        Мы запустили Telegram-канал Veles Tools. Подписывайтесь, чтобы первыми получать новости, обновления и полезные
        подсказки.
      </Typography.Text>
      <Button type="primary" href={channelUrl} target="_blank" rel="noreferrer noopener">
        Подписаться в Telegram
      </Button>
    </Space>
  </Modal>
);

export default TelegramChannelModal;
