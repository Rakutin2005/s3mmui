import { Button, Card, Descriptions, Form, Input, Modal, Select, Space, Switch, Table, message } from 'antd';
import { ArrowLeftOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { endpoints, rpc } from '../api.js';
import DurationInput from '../components/DurationInput.jsx';
import SizeInput from '../components/SizeInput.jsx';

const OPTIONAL_FIELDS = [
  { key: 'buckets', label: 'Buckets' },
  { key: 'accounts', label: 'Accounts' },
  { key: 'policy', label: 'Policy' },
  { key: 'retention', label: 'Retention' },
  { key: 'delete_propagation', label: 'Delete propagation' },
  { key: 'queue_size', label: 'Queue size' },
  { key: 'queue_time', label: 'Queue time' },
  { key: 'min_size', label: 'Min size' },
  { key: 'max_disk', label: 'Max disk' },
  { key: 'scan_every', label: 'Scan every' },
  { key: 'paused', label: 'Paused' },
];

// Keyed by the route param so that form/modal state resets between replications.
export default function ReplicationDetail() {
  const { name } = useParams();
  return <ReplicationDetailView key={name} />;
}

function ReplicationDetailView() {
  const { name } = useParams();
  const isNew = name === 'new';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const replication = useQuery<any>({ queryKey: ['replication', name], queryFn: () => endpoints.replication(name), enabled: !isNew });
  const clusters = useQuery<any>({ queryKey: ['clusters'], queryFn: endpoints.clusters });
  const policies = useQuery<any>({ queryKey: ['policies'], queryFn: endpoints.policies });
  const stats = useQuery<any>({ queryKey: ['stats', name], queryFn: () => endpoints.stats(name), refetchInterval: 5000, enabled: !isNew });
  const queues = useQuery<any>({ queryKey: ['queues', name], queryFn: () => endpoints.queues(name), refetchInterval: 5000, enabled: !isNew });
  const routes = useQuery<any>({ queryKey: ['routes', name], queryFn: () => endpoints.routes(name, 20), refetchInterval: 5000, enabled: !isNew });

  const [editing, setEditing] = useState(false);
  const [visibleOptional, setVisibleOptional] = useState([]);
  const [form] = Form.useForm();
  const record: any = useMemo(() => (isNew ? { name: '', buckets: [], accounts: [] } : (replication.data || {})), [isNew, replication.data]);
  // 'stat' answers with an array (one snapshot per replication)
  const statRows = Array.isArray(stats.data) ? stats.data : (stats.data ? [stats.data] : []);

  // optional fields shown follow the loaded record (adjusted during render, not in an effect)
  const [optionalFor, setOptionalFor] = useState(null);
  if (optionalFor !== record && record.name) {
    setOptionalFor(record);
    setVisibleOptional(OPTIONAL_FIELDS
      .map((f: any) => f.key)
      .filter((key) => record[key] !== undefined && record[key] !== null && record[key] !== '' && !(Array.isArray(record[key]) && record[key].length === 0)));
  }

  useEffect(() => {
    if (record.name) {
      form.setFieldsValue({
        ...record,
        buckets: record.buckets || [],
        accounts: record.accounts || [],
      });
    }
  }, [record, form]);

  const save = useMutation({
    mutationFn: (values: any) => {
      const fields = { ...values };
      delete fields.name;
      return isNew
        ? rpc('add', { kind: 'replication', name: values.name, fields })
        : rpc('edit', { kind: 'replication', name, fields });
    },
    onSuccess: (_data: any, values: any) => {
      message.success('Replication saved');
      setEditing(false);
      if (isNew && values.name) navigate(`/replications/${encodeURIComponent(values.name)}`, { replace: true });
      queryClient.invalidateQueries({ queryKey: ['replication', name] });
      queryClient.invalidateQueries({ queryKey: ['replications'] });
    },
    onError: (e) => message.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => rpc('rm', { kind: 'replication', name }),
    onSuccess: () => {
      message.success('Replication removed');
      queryClient.invalidateQueries({ queryKey: ['replications'] });
      queryClient.removeQueries({ queryKey: ['replication', name] });
      navigate('/replications');
    },
    onError: (e) => message.error(e.message),
  });

  const scan = useMutation({
    mutationFn: () => rpc('scan', { replication: name, force: true }),
    onSuccess: () => {
      message.success('Scan completed');
      queryClient.invalidateQueries({ queryKey: ['stats', name] });
      queryClient.invalidateQueries({ queryKey: ['queues', name] });
      queryClient.invalidateQueries({ queryKey: ['routes', name] });
    },
    onError: (e) => message.error(e.message),
  });

  if (!isNew && replication.isLoading) return <div>Loading...</div>;
  if (!isNew && !record.name) return <div>Replication not found</div>;

  const availableOptional = OPTIONAL_FIELDS.filter((f) => !visibleOptional.includes(f.key));

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/replications')}>Back</Button>
        <Button type="primary" icon={<EditOutlined />} onClick={() => setEditing(true)}>{isNew ? 'Create' : 'Edit'}</Button>
        {!isNew && <Button icon={<PlusOutlined />} loading={scan.isPending} onClick={() => scan.mutate()}>Scan</Button>}
        {!isNew && <Button danger icon={<DeleteOutlined />} onClick={() => remove.mutate()}>Remove</Button>}
      </Space>

      <Card title="Summary" style={{ marginBottom: 16 }}>
        <Descriptions bordered={false} column={2} size="small">
          <Descriptions.Item label="Name">{record.name || 'New replication'}</Descriptions.Item>
          <Descriptions.Item label="Source">{record.source || '—'}</Descriptions.Item>
          <Descriptions.Item label="Destination">{record.destination || '—'}</Descriptions.Item>
          <Descriptions.Item label="Policy">{record.policy || '—'}</Descriptions.Item>
        </Descriptions>
      </Card>
      <Card title="Filters" style={{ marginBottom: 16 }}>
        <Descriptions bordered={false} column={1} size="small">
          <Descriptions.Item label="Buckets">{(record.buckets || []).length ? (record.buckets || []).join(', ') : '—'}</Descriptions.Item>
          <Descriptions.Item label="Accounts">{(record.accounts || []).length ? (record.accounts || []).join(', ') : '—'}</Descriptions.Item>
        </Descriptions>
      </Card>
      <Card title="Schedule and queue" style={{ marginBottom: 16 }}>
        <Descriptions bordered={false} column={2} size="small">
          <Descriptions.Item label="Retention">{record.retention || '—'}</Descriptions.Item>
          <Descriptions.Item label="Delete propagation">{String(record.delete_propagation)}</Descriptions.Item>
          <Descriptions.Item label="Queue size">{record.queue_size || '—'}</Descriptions.Item>
          <Descriptions.Item label="Queue time">{record.queue_time || '—'}</Descriptions.Item>
          <Descriptions.Item label="Min size">{record.min_size || '—'}</Descriptions.Item>
          <Descriptions.Item label="Max disk">{record.max_disk || '—'}</Descriptions.Item>
          <Descriptions.Item label="Scan every">{record.scan_every || '—'}</Descriptions.Item>
          <Descriptions.Item label="Paused">{String(record.paused)}</Descriptions.Item>
        </Descriptions>
      </Card>

<Card title="Usage" style={{ marginBottom: 16 }}>
        <Table rowKey="replication" dataSource={statRows} pagination={false} columns={[
          { title: 'Scanned', dataIndex: 'objects_scanned' },
          { title: 'Accepted', dataIndex: 'accepted' },
          { title: 'Shipped', dataIndex: 'shipped' },
          { title: 'Failed', dataIndex: 'failed' },
          { title: 'Bytes shipped', dataIndex: 'bytes_shipped' },
          { title: 'Last lag, sec', dataIndex: 'last_lag_sec' },
        ]} />
      </Card>

      <Card title="Queues" style={{ marginBottom: 16 }}>
        <Table rowKey="replication" dataSource={queues.data || []} pagination={false} columns={[
          { title: 'Objects', dataIndex: 'objects' },
          { title: 'Bytes', dataIndex: 'bytes' },
          { title: 'Ready', dataIndex: 'ready', render: (v) => String(v) },
          { title: 'Age, sec', dataIndex: 'age_sec' },
        ]} />
      </Card>

      <Card title="Recent routes">
        <Table rowKey={(r, i) => `${r.at}-${i}`} dataSource={routes.data || []} pagination={false} columns={[
          { title: 'Time', dataIndex: 'at', render: (v) => (v ? new Date(v * 1000).toLocaleString() : '—') },
          { title: 'Kind', dataIndex: 'kind' },
          { title: 'Object', dataIndex: 'key' },
          { title: 'Outcome', dataIndex: 'outcome' },
          { title: 'Target', dataIndex: 'target' },
        ]} />
      </Card>

      <Modal title={isNew ? 'Add replication' : `Edit ${name}`} open={editing} onCancel={() => setEditing(false)} onOk={() => form.submit()} confirmLoading={save.isPending} width={760}>
        <Form form={form} layout="vertical" onFinish={(values) => save.mutate(values)}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input disabled={!isNew} /></Form.Item>
          <Form.Item name="source" label="Source" rules={[{ required: true }]}>
            <Select options={Array.from(new Map((clusters.data || []).map((c: any) => [c.name, c])).values()).map((c: any) => ({ value: c.name, label: c.name }))} />
          </Form.Item>
          <Form.Item name="destination" label="Destination" rules={[{ required: true }]}>
            <Select options={Array.from(new Map((clusters.data || []).map((c: any) => [c.name, c])).values()).map((c: any) => ({ value: c.name, label: c.name }))} />
          </Form.Item>

          {visibleOptional.includes('buckets') && (
            <Form.Item name="buckets" label="Buckets">
              <Select mode="tags" tokenSeparators={[',']} placeholder="media*, !tmp/*" />
            </Form.Item>
          )}
          {visibleOptional.includes('accounts') && (
            <Form.Item name="accounts" label="Accounts">
              <Select mode="tags" tokenSeparators={[',']} />
            </Form.Item>
          )}
          {visibleOptional.includes('policy') && (
            <Form.Item name="policy" label="Policy">
              <Select options={(policies.data || []).map((p: any) => ({ value: p.name, label: p.name }))} />
            </Form.Item>
          )}
          {visibleOptional.includes('retention') && (
            <Form.Item name="retention" label="Retention"><DurationInput /></Form.Item>
          )}
          {visibleOptional.includes('delete_propagation') && (
            <Form.Item name="delete_propagation" label="Delete propagation" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
          {visibleOptional.includes('queue_size') && (
            <Form.Item name="queue_size" label="Queue size"><SizeInput /></Form.Item>
          )}
          {visibleOptional.includes('queue_time') && (
            <Form.Item name="queue_time" label="Queue time"><DurationInput /></Form.Item>
          )}
          {visibleOptional.includes('min_size') && (
            <Form.Item name="min_size" label="Min size"><SizeInput /></Form.Item>
          )}
          {visibleOptional.includes('max_disk') && (
            <Form.Item name="max_disk" label="Max disk"><SizeInput /></Form.Item>
          )}
          {visibleOptional.includes('scan_every') && (
            <Form.Item name="scan_every" label="Scan every"><DurationInput /></Form.Item>
          )}
          {visibleOptional.includes('paused') && (
            <Form.Item name="paused" label="Paused" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}

          {availableOptional.length > 0 && (
            <Space style={{ marginBottom: 16 }}>
              <Select
                placeholder="Add optional field"
                style={{ width: 220 }}
                options={availableOptional.map((f: any) => ({ value: f.key, label: f.label }))}
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
