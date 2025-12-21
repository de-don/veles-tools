import { Form, Input, Modal } from 'antd';
import { useEffect } from 'react';
import type { BacktestStatistics } from '../../types/backtests';

interface SaveBacktestGroupModalProps {
  open: boolean;
  selectedBacktests: BacktestStatistics[];
  onCancel: () => void;
  onSubmit: (name: string) => void;
}

interface SaveGroupFormValues {
  name: string;
}

const SaveBacktestGroupModal = ({ open, selectedBacktests, onCancel, onSubmit }: SaveBacktestGroupModalProps) => {
  const [form] = Form.useForm<SaveGroupFormValues>();

  useEffect(() => {
    if (open) {
      form.resetFields();
    }
  }, [open, form]);

  const handleOk = () => {
    void form.validateFields().then((values) => {
      onSubmit(values.name.trim());
    });
  };

  const totalSelected = selectedBacktests.length;

  return (
    <Modal
      title="Сохранить группу"
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      okText="Сохранить"
      cancelText="Отмена"
      destroyOnClose
    >
      <p className="u-mb-16">
        Будет сохранена группа из {totalSelected} выбранных бэктестов. Вы сможете открыть её позднее на странице групп.
      </p>
      <Form<SaveGroupFormValues> form={form} layout="vertical" initialValues={{ name: '' }}>
        <Form.Item
          label="Название группы"
          name="name"
          rules={[{ required: true, message: 'Введите название группы.' }]}
        >
          <Input placeholder="Например, Маркет-мейкинг Q1" autoFocus maxLength={120} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default SaveBacktestGroupModal;
