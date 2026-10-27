import { Button, Form, Input, Select, Switch, Tabs, message } from 'antd';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { endpoints, rpc } from '../api.js';
import DurationInput from '../components/DurationInput.jsx';
import SizeInput from '../components/SizeInput.jsx';
import AuthSettingsPage from './AuthSettingsPage.jsx';

const fieldMeta = {
  socket: { type: 'text', group: 'general' },
  pid_file: { type: 'text', group: 'general' },
  cache_dir: { type: 'text', group: 'general' },
  secrets_dir: { type: 'text', group: 'general' },
  modules_dir: { type: 'text', group: 'general' },
  master_key_file: { type: 'text', group: 'general' },
  worker_count: { type: 'number', group: 'general' },
  permanent: { type: 'switch', group: 'general' },
  log_level: { type: 'select', options: ['debug', 'info', 'notice', 'warning', 'error', 'critical', 'alert', 'emergency'], group: 'logging' },
  log_facility: { type: 'text', group: 'logging' },
  log_socket: { type: 'text', group: 'logging' },
  metrics: { type: 'text', group: 'logging' },
  transfer_parallel: { type: 'number', group: 'transfer' },
  part_size: { type: 'size', group: 'transfer' },
  retries: { type: 'number', group: 'transfer' },
  backoff: { type: 'duration', group: 'transfer' },
  rate_limit: { type: 'number', group: 'transfer' },
  queue_size: { type: 'size', group: 'queue' },
  queue_time: { type: 'duration', group: 'queue' },
  min_size: { type: 'size', group: 'queue' },
  max_disk: { type: 'size', group: 'queue' },
  scan_every: { type: 'duration', group: 'scan' },
  bucket_scan_every: { type: 'duration', group: 'scan' },
};

const groups = [
  { key: 'general', label: 'General' },
  { key: 'logging', label: 'Logging' },
  { key: 'transfer', label: 'Transfer' },
  { key: 'queue', label: 'Queue' },
  { key: 'scan', label: 'Scan' },
];

const fields = Object.keys(fieldMeta);

const renderField = (field) => {
  const meta = fieldMeta[field];
  if (meta.type === 'number') return <Input type="number" />;
  if (meta.type === 'size') return <SizeInput />;
  if (meta.type === 'duration') return <DurationInput />;
  if (meta.type === 'switch') return <Switch />;
  if (meta.type === 'select') return <Select options={meta.options.map((v: any) => ({ value: v, label: v }))} />;
  return <Input />;
};

// One form instance per tab: a single useForm() shared by several <Form>
// elements is unsupported by antd and mixed the groups' values together.
function SettingsGroup({ group, data }) {
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const groupFields = fields.filter((f) => fieldMeta[f].group === group);

  useEffect(() => {
    if (data) form.setFieldsValue(data);
  }, [data, form]);

  const save = useMutation({
    mutationFn: (values: any) => {
      // Only send what actually changed: every settings edit stops and restarts
      // the engine, and some keys (socket, metrics, cache_dir) restart servers.
      const payload: any = {};
      groupFields.forEach((field) => {
        const v = values[field];
        if (v === undefined || v === '' || v === null) return;
        if (data && String(data[field]) === String(v)) return;
        payload[field] = v;
      });
      if (Object.keys(payload).length === 0) return Promise.resolve({ unchanged: true });
      return rpc('edit', { kind: 'settings', name: 'settings', fields: payload });
    },
    onSuccess: (res: any) => {
      message.success(res?.unchanged ? 'Nothing to save' : 'Settings saved');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (e) => message.error(e.message),
  });

  return (
    <Form form={form} layout="vertical" onFinish={(values) => save.mutate(values)} style={{ maxWidth: 900 }}>
      {groupFields.map((field: any) => (
        <Form.Item key={field} name={field} label={field} valuePropName={fieldMeta[field].type === 'switch' ? 'checked' : 'value'}>
          {renderField(field)}
        </Form.Item>
      ))}
      <Button type="primary" htmlType="submit" loading={save.isPending}>Save {group} settings</Button>
    </Form>
  );
}

export default function SettingsPage() {
  const { data } = useQuery<any>({ queryKey: ['settings'], queryFn: endpoints.settings });

  return (
    <>
      <h2>Settings</h2>
      <Tabs items={[
        ...groups.map((g: any) => ({ key: g.key, label: g.label, children: <SettingsGroup group={g.key} data={data} /> })),
        { key: 'auth', label: 'Authentication', children: <AuthSettingsPage /> },
        { key: 'rbac', label: 'Authorization (RBAC)', children: <div><Link to="/rbac">Open RBAC page</Link></div> },
      ]} />
    </>
  );
}
