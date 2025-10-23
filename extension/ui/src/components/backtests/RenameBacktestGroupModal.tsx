import { Form, Input, Modal } from 'antd';
import { useEffect } from 'react';
import type { BacktestGroup } from '../../types/backtestGroups';

interface RenameBacktestGroupModalProps {
  open: boolean;
  group: BacktestGroup | null;
  onCancel: () => void;
  onSubmit: (name: string) => void;
}

interface RenameGroupFormValues {
  name: string;
}

const RenameBacktestGroupModal = ({ open, group, onCancel, onSubmit }: RenameBacktestGroupModalProps) => {
  const [form] = Form.useForm<RenameGroupFormValues>();

  useEffect(() => {
    if (open) {
      form.setFieldsValue({ name: group?.name ?? '' });
    }
  }, [open, group, form]);

  const handleOk = () => {
    void form.validateFields().then(({ name }) => {
      onSubmit(name.trim());
    });
  };

  return (
    <Modal
      title="Переименовать группу"
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      okText="Сохранить"
      cancelText="Отмена"
      destroyOnClose
    >
      <Form<RenameGroupFormValues> form={form} layout="vertical">
        <Form.Item
          label="Название группы"
          name="name"
          rules={[{ required: true, message: 'Введите название группы.' }]}
        >
          <Input placeholder="Новое название группы" maxLength={120} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default RenameBacktestGroupModal;
