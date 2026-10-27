import { Button, Form, Input, Modal, Space, Table, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { endpoints, rpc } from '../api.js';

export default function TargetsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading, refetch } = useQuery<any>({ queryKey: ['targets'], queryFn: endpoints.targets });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const save = useMutation({
    mutationFn: (values: any) => {
      const fields = { type: values.type, uri: values.uri, template: values.template, description: values.description };
      return editing ? rpc('edit', { kind: 'target', name: values.name, fields }) : rpc('add', { kind: 'target', name: values.name, fields });
    },
    onSuccess: (_data: any, values: any) => { message.success('Target saved'); setOpen(false); setEditing(null); form.resetFields(); queryClient.invalidateQueries({ queryKey: ['targets'] }); queryClient.invalidateQueries({ queryKey: ['target', values.name] }); },
    onError: (e) => message.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (name: any) => rpc('rm', { kind: 'target', name }),
    onSuccess: (_data: any, name: any) => { message.success('Target removed'); queryClient.invalidateQueries({ queryKey: ['targets'] }); queryClient.removeQueries({ queryKey: ['target', name] }); },
    onError: (e) => message.error(e.message),
  });

  function openEdit(record) { setEditing(record); form.resetFields(); form.setFieldsValue(record); setOpen(true); };
  const columns = [
    { title: 'Name', dataIndex: 'name' },
    { title: 'Owner', dataIndex: '_owner', render: (v) => v || 'local' },
    { title: 'Type', dataIndex: 'type' },
    { title: 'URI', dataIndex: 'uri' },
    { title: 'Template', dataIndex: 'template' },
    { title: 'Actions', render: (_: any, r: any) => <Space onClick={(e) => e.stopPropagation()}><Button icon={<EditOutlined />} onClick={() => openEdit(r)} /><Button danger icon={<DeleteOutlined />} onClick={() => remove.mutate(r.name)} /></Space> },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>Targets</h2>
        <Space><Button icon={<ReloadOutlined />} onClick={() => refetch()}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/targets/new')}>Add target</Button></Space>
      </div>
      <Table onRow={(record: any) => ({ onClick: () => navigate(`/targets/${record.name}`) })} rowKey={(r: any) => `${r.name}@${r._owner || 'local'}`} loading={isLoading} dataSource={data || []} columns={columns} />
      <Modal title={editing ? 'Edit target' : 'Add target'} open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} confirmLoading={save.isPending}>
        <Form form={form} layout="vertical" onFinish={(values) => save.mutate(values)}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input disabled={!!editing} /></Form.Item>
          <Form.Item name="type" label="Type" rules={[{ required: true }]}><Input placeholder="file, s3, ..." /></Form.Item>
          <Form.Item name="uri" label="URI"><Input /></Form.Item>
          <Form.Item name="template" label="Template"><Input /></Form.Item>
          <Form.Item name="description" label="Description"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}
