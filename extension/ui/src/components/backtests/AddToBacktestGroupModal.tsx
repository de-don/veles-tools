import { Form, Modal, Select } from 'antd';
import { useEffect } from 'react';
import type { BacktestGroup } from '../../types/backtestGroups';
import type { BacktestStatistics } from '../../types/backtests';

interface AddToBacktestGroupModalProps {
  open: boolean;
  groups: BacktestGroup[];
  selectedBacktests: BacktestStatistics[];
  onCancel: () => void;
  onSubmit: (groupId: string) => void;
}

interface AddToGroupFormValues {
  groupId: string;
}

const AddToBacktestGroupModal = ({
  open,
  groups,
  selectedBacktests,
  onCancel,
  onSubmit,
}: AddToBacktestGroupModalProps) => {
  const [form] = Form.useForm<AddToGroupFormValues>();

  useEffect(() => {
    if (open) {
      form.resetFields();
    }
  }, [open, form]);

  const handleOk = () => {
    void form.validateFields().then(({ groupId }) => {
      onSubmit(groupId);
    });
  };

  const hasGroups = groups.length > 0;
  const totalSelected = selectedBacktests.length;

  return (
    <Modal
      title="Добавить в группу"
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      okText="Добавить"
      cancelText="Отмена"
      destroyOnClose
      okButtonProps={{ disabled: !hasGroups }}
    >
      {hasGroups ? (
        <>
          <p className="u-mb-16">
            Выберите группу, в которую будет добавлено {totalSelected} выбранных бэктестов. Повторяющиеся записи будут
            проигнорированы.
          </p>
          <Form<AddToGroupFormValues> form={form} layout="vertical" initialValues={{ groupId: undefined }}>
            <Form.Item label="Группа" name="groupId" rules={[{ required: true, message: 'Выберите группу.' }]}>
              <Select
                placeholder="Выберите группу"
                options={groups.map((group) => ({ value: group.id, label: group.name }))}
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
          </Form>
        </>
      ) : (
        <p>У вас пока нет сохранённых групп. Сначала создайте новую группу.</p>
      )}
    </Modal>
  );
};

export default AddToBacktestGroupModal;
