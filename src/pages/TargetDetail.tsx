import { Button, Card, Descriptions, Form, Input, Modal, Select, Space, message } from 'antd';
import { ArrowLeftOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { endpoints, rpc } from '../api.js';

// Keyed by the route param so that form/modal state resets between targets.
export default function TargetDetail() {
  const { name } = useParams();
  return <TargetDetailView key={name} />;
}

function TargetDetailView() {
  const { name } = useParams();
  const isNew = name === 'new';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const target = useQuery<any>({ queryKey: ['target', name], queryFn: () => endpoints.target(name), enabled: !isNew });
  const [editing, setEditing] = useState(false);
  const [visibleOptional, setVisibleOptional] = useState([]);
  const [form] = Form.useForm();
  const record: any = useMemo(() => (isNew ? { name: '', type: 'file' } : (target.data || {})), [isNew, target.data]);

  // optional fields shown follow the loaded record (adjusted during render, not in an effect)
  const [optionalFor, setOptionalFor] = useState(null);
  if (optionalFor !== record && record.name) {
    setOptionalFor(record);
    setVisibleOptional(['uri', 'template', 'description'].filter((key) => record[key] !== undefined && record[key] !== null && record[key] !== ''));
  }

  useEffect(() => {
    if (record.name) {
      form.setFieldsValue(record);
    }
  }, [record, form]);

  const save = useMutation({
    mutationFn: (values: any) => {
      const fields = { ...values };
      delete fields.name;
      return isNew ? rpc('add', { kind: 'target', name: values.name, fields }) : rpc('edit', { kind: 'target', name, fields });
    },
    onSuccess: (_data: any, values: any) => {
      message.success('Target saved');
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['target', name] });
      queryClient.invalidateQueries({ queryKey: ['targets'] });
      if (isNew && values.name) navigate(`/targets/${encodeURIComponent(values.name)}`, { replace: true });
    },
    onError: (e) => message.error(e.message),
  });
  const remove = useMutation({
    mutationFn: () => rpc('rm', { kind: 'target', name }),
    onSuccess: () => {
      message.success('Target removed');
      queryClient.invalidateQueries({ queryKey: ['targets'] });
      queryClient.removeQueries({ queryKey: ['target', name] });
      navigate('/targets');
    },
    onError: (e) => message.error(e.message),
  });

  if (!isNew && target.isLoading) return <div>Loading...</div>;
  if (!isNew && !record.name) return <div>Target not found</div>;

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/targets')}>Back</Button>
        <Button type="primary" icon={<EditOutlined />} onClick={() => setEditing(true)}>{isNew ? 'Create' : 'Edit'}</Button>
        {!isNew && <Button danger icon={<DeleteOutlined />} onClick={() => remove.mutate()}>Remove</Button>}
      </Space>
      <Card title="General" style={{ marginBottom: 16 }}>
        <Descriptions bordered={false} column={2} size="small">
          <Descriptions.Item label="Name">{record.name || 'New target'}</Descriptions.Item>
          <Descriptions.Item label="Type">{record.type || '—'}</Descriptions.Item>
          <Descriptions.Item label="URI">{record.uri || '—'}</Descriptions.Item>
          <Descriptions.Item label="Template">{record.template || '—'}</Descriptions.Item>
          <Descriptions.Item label="Description">{record.description || '—'}</Descriptions.Item>
        </Descriptions>
      </Card>
      <Modal title={isNew ? 'Add target' : `Edit ${name}`} open={editing} onCancel={() => setEditing(false)} onOk={() => form.submit()} confirmLoading={save.isPending}>
        <Form form={form} layout="vertical" initialValues={isNew ? { type: 'file' } : undefined} onFinish={(values) => save.mutate(values)}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input disabled={!isNew} /></Form.Item>
          <Form.Item name="type" label="Type" rules={[{ required: true }]}>
            <Select options={[{ value: 'file' }, { value: 's3' }, { value: 'http' }]} />
          </Form.Item>
          {visibleOptional.includes("uri") && (<Form.Item name="uri" label="URI"><Input /></Form.Item>)}
          {visibleOptional.includes("template") && (<Form.Item name="template" label="Template"><Input /></Form.Item>)}
          {visibleOptional.includes("description") && (<Form.Item name="description" label="Description"><Input.TextArea rows={3} /></Form.Item>)}
          {['uri','template','description'].filter((k) => !visibleOptional.includes(k)).length > 0 && (
            <Space style={{ marginBottom: 16 }}>
              <Select
                placeholder="Add optional field"
                style={{ width: 220 }}
                options={['uri','template','description']
                  .filter((k) => !visibleOptional.includes(k))
                  .map((k: any) => ({ value: k, label: k }))}
                onChange={(value) => setVisibleOptional((prev) => [...prev, value])}
                value={null}
              />
            </Space>
          )}
        </Form>
      </Modal>
    </>
  );
}
