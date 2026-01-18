import { Modal, Typography } from 'antd';

interface ConnectionHelpModalProps {
  open: boolean;
  onClose: () => void;
}

const ConnectionHelpModal = ({ open, onClose }: ConnectionHelpModalProps) => (
  <Modal
    open={open}
    onCancel={onClose}
    onOk={onClose}
    okText="Понятно"
    cancelButtonProps={{ style: { display: 'none' } }}
    title="Как восстановить соединение"
  >
    <Typography.Paragraph>
      Если связь со вкладкой не устанавливается или периодически пропадает, попробуйте:
    </Typography.Paragraph>
    <ul>
      <li>Закрыть вкладку Veles, закрыть расширение, затем открыть Veles и расширение снова.</li>
      <li>Перезапустить браузер и повторить подключение.</li>
      <li>
        В некоторых браузерах режим энергосбережения (например, Memory Saver) может усыплять вкладку. Проверьте
        настройки энергосбережения и добавьте veles.finance в исключения — инструкции есть в справке вашего браузера.
      </li>
    </ul>
  </Modal>
);

export default ConnectionHelpModal;
