import { Button, Form, Input, Modal, Space, Table, message, Select } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { endpoints, rpc } from '../api.js';

// 'list policy' does not include rule_list, so the expanded row loads the bundle itself.
function PolicyRules({ name }) {
  const policy = useQuery<any>({ queryKey: ['policy', name], queryFn: () => endpoints.policy(name) });
  return (
    <Table
      rowKey={(r: any) => `${name}-${r.order}`}
      loading={policy.isLoading}
      dataSource={policy.data?.rule_list || []}
      pagination={false}
      columns={[
        { title: 'Order', dataIndex: 'order' },
        { title: 'Name', dataIndex: 'name' },
        { title: 'Category', dataIndex: 'category' },
        { title: 'Condition', dataIndex: 'condition' },
        { title: 'Actions', dataIndex: 'actions', render: (v) => (v || []).join(', ') },
      ]}
    />
  );
}

export default function PoliciesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading, refetch } = useQuery<any>({ queryKey: ['policies'], queryFn: endpoints.policies });
  const [bundleOpen, setBundleOpen] = useState(false);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [editingBundle, setEditingBundle] = useState(null);
  const [selectedBundle, setSelectedBundle] = useState(null);
  const [bundleForm] = Form.useForm();
  const [ruleForm] = Form.useForm();

  const saveBundle = useMutation({
    mutationFn: (values: any) => {
      const fields: any = {
        route_denied: values.route_denied,
        route_warning: values.route_warning,
        route_success: values.route_success,
      };
      // s3mmd rejects an empty default action ("empty action"): only send filled ones
      ['default_access', 'default_bucket', 'default_object'].forEach((k) => { if (values[k]) fields[k] = values[k]; });
      return editingBundle
        ? rpc('edit', { kind: 'policy', name: values.name, fields })
        : rpc('add', { kind: 'policy', name: values.name, fields });
    },
    onSuccess: (_data: any, values: any) => {
      message.success('Policy bundle saved');
      queryClient.invalidateQueries({ queryKey: ['policy', values.name] });
      setBundleOpen(false);
      setEditingBundle(null);
      bundleForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['policies'] });
    },
    onError: (e) => message.error(e.message),
  });

  const removeBundle = useMutation({
    mutationFn: (name: any) => rpc('rm', { kind: 'policy', name }),
    onSuccess: (_data: any, name: any) => {
      message.success('Policy bundle removed');
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      queryClient.removeQueries({ queryKey: ['policy', name] });
    },
    onError: (e) => message.error(e.message),
  });

  const saveRule = useMutation({
    mutationFn: (values: any) => rpc('rule', {
      action: values.action,
      policy: selectedBundle,
      ref: values.ref || undefined,
      line: values.line || undefined,
      before: values.before || undefined,
      after: values.after || undefined,
    }),
    onSuccess: () => {
      message.success('Rule applied');
      setRuleOpen(false);
      ruleForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      queryClient.invalidateQueries({ queryKey: ['policy', selectedBundle] });
    },
    onError: (e) => message.error(e.message),
  });

  const columns = [
    { title: 'Name', dataIndex: 'name' },
    { title: 'Owner', dataIndex: '_owner', render: (v) => v || 'local' },
    { title: 'Rules', dataIndex: 'rules' },
    { title: 'Route denied', dataIndex: 'route_denied' },
    { title: 'Route warning', dataIndex: 'route_warning' },
    { title: 'Route success', dataIndex: 'route_success' },
    {
      title: 'Actions',
      render: (_: any, record: any) => (
        // stop the click from also triggering the row's navigate()
        <Space onClick={(e) => e.stopPropagation()}>
          <Button onClick={() => { setSelectedBundle(record.name); ruleForm.resetFields(); setRuleOpen(true); }}>Rules</Button>
          <Button icon={<EditOutlined />} onClick={() => navigate(`/policies/${encodeURIComponent(record.name)}`)} />
          <Button danger icon={<DeleteOutlined />} onClick={() => removeBundle.mutate(record.name)} />
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>Policies</h2>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingBundle(null); bundleForm.resetFields(); setBundleOpen(true); }}>
            Add policy
          </Button>
        </Space>
      </div>
      <Table onRow={(record: any) => ({ onClick: () => navigate(`/policies/${encodeURIComponent(record.name)}`) })} rowKey={(r: any) => `${r.name}@${r._owner || 'local'}`} loading={isLoading} dataSource={data || []} columns={columns} expandable={{
        expandedRowRender: (record) => <PolicyRules name={record.name} />,
      }} />
      <Modal title={editingBundle ? 'Edit policy' : 'Add policy'} open={bundleOpen} onCancel={() => setBundleOpen(false)} onOk={() => bundleForm.submit()} confirmLoading={saveBundle.isPending}>
        <Form form={bundleForm} layout="vertical" onFinish={(values) => saveBundle.mutate(values)}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input disabled={!!editingBundle} /></Form.Item>
          <Form.Item name="default_access" label="Default access"><Input placeholder="accept" /></Form.Item>
          <Form.Item name="default_bucket" label="Default bucket"><Input placeholder="accept" /></Form.Item>
          <Form.Item name="default_object" label="Default object"><Input placeholder="accept" /></Form.Item>
          <Form.Item name="route_denied" label="Route denied"><Input placeholder="null" /></Form.Item>
          <Form.Item name="route_warning" label="Route warning"><Input placeholder="quarantine" /></Form.Item>
          <Form.Item name="route_success" label="Route success"><Input placeholder="" /></Form.Item>
        </Form>
      </Modal>
      <Modal title={`Rule on ${selectedBundle}`} open={ruleOpen} onCancel={() => setRuleOpen(false)} onOk={() => ruleForm.submit()} confirmLoading={saveRule.isPending}>
        <Form form={ruleForm} layout="vertical" initialValues={{ action: 'add' }} onFinish={(values) => saveRule.mutate(values)}>
          <Form.Item name="action" label="Action" rules={[{ required: true }]}>
            <Select options={[{ value: 'add', label: 'add' }, { value: 'edit', label: 'edit' }, { value: 'rm', label: 'rm' }]} />
          </Form.Item>
          <Form.Item name="ref" label="Ref (name or number)"><Input /></Form.Item>
          <Form.Item name="line" label="Rule line"><Input.TextArea rows={3} placeholder="object source.size >= 1M => accept" /></Form.Item>
          <Form.Item name="before" label="Before"><Input /></Form.Item>
          <Form.Item name="after" label="After"><Input /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}
