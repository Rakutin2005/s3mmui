import { Button, Checkbox, Form, Select, Space, Table, message } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { endpoints, rpc } from '../api.js';

export default function AccountsPage() {
  const [form] = Form.useForm();
  const [report, setReport] = useState(null);
  const replications = useQuery<any>({ queryKey: ['replications'], queryFn: endpoints.replications });

  const sync = useMutation({
    mutationFn: (values: any) => rpc('sync-accounts', {
      replication: values.replication,
      dry_run: !values.apply,
      prune: !!values.prune,
    }),
    onSuccess: (data) => {
      setReport(data);
      message.success('Account sync finished');
    },
    onError: (e) => message.error(e.message),
  });

  const columns = [
    { title: 'Access key', dataIndex: 'access_key' },
    { title: 'Actions', dataIndex: 'actions', render: (v) => (v || []).join(', ') },
    { title: 'Applied', dataIndex: 'applied', render: (v) => String(v) },
    { title: 'Error', dataIndex: 'error' },
  ];

  return (
    <>
      <h2>Account sync</h2>
      <Form form={form} layout="inline" onFinish={(values) => sync.mutate(values)} style={{ marginBottom: 16 }}>
        <Form.Item name="replication" rules={[{ required: true }]}>
          <Select style={{ width: 240 }} placeholder="Replication" options={(replications.data || []).map((r: any) => ({ value: r.name, label: r.name }))} />
        </Form.Item>
        {/* a named Form.Item must have exactly one child, otherwise the value is never bound */}
        <Form.Item name="apply" valuePropName="checked"><Checkbox>Apply</Checkbox></Form.Item>
        <Form.Item name="prune" valuePropName="checked"><Checkbox>Prune</Checkbox></Form.Item>
        <Button type="primary" htmlType="submit" loading={sync.isPending}>Run sync</Button>
      </Form>
      {report && (
        <>
          <Space style={{ marginBottom: 16 }}>
            <span>Source: {report.source_accounts}</span>
            <span>Destination: {report.destination_accounts}</span>
            <span>Matched: {report.matched}</span>
            <span>Created: {report.created}</span>
            <span>Updated: {report.updated}</span>
            <span>Deleted: {report.deleted}</span>
            <span>Failed: {report.failed}</span>
          </Space>
          {(report.errors || []).length > 0 && (
            <div style={{ marginBottom: 16, color: 'var(--ant-color-error)' }}>{report.errors.join('; ')}</div>
          )}
          <Table rowKey={(r: any) => `${r.access_key}:${(r.actions || []).join(",")}`} dataSource={report.changes || []} columns={columns} />
        </>
      )}
    </>
  );
}
