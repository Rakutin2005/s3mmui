import { Button, Card, Descriptions, Form, Input, Modal, Select, Space, Switch, Table, message } from 'antd';
import { ArrowLeftOutlined, DeleteOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { endpoints, rpc } from '../api.js';

const IDENTITY_FIELDS = ['cluster', 'zone', 'access_key', 'secret', 'session_token'];
const ACCESS_FIELDS = ['region', 'read_only'];
// access_key and secret are always shown; only these can be toggled on.
const IDENTITY_OPTIONAL = ['cluster', 'zone', 'session_token'];

// Keyed by the route param so that form/modal state is reset when navigating
// from one credential to another.
export default function CredentialDetail() {
  const { name } = useParams();
  return <CredentialDetailView key={name} />;
}

function CredentialDetailView() {
  const { name } = useParams();
  const isNew = name === 'new';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const credential = useQuery<any>({ queryKey: ['credential', name], queryFn: () => endpoints.credential(name), enabled: !isNew });
  const clusters = useQuery<any>({ queryKey: ['clusters'], queryFn: endpoints.clusters });
  const [editingSection, setEditingSection] = useState(null);
  const [visibleOptional, setVisibleOptional] = useState([]);
  const [form] = Form.useForm();
  // Memoised: a fresh object per render would re-run the sync effect endlessly.
  const record: any = useMemo(() => (isNew ? { name: '' } : (credential.data || {})), [isNew, credential.data]);

  // optional fields shown follow the loaded record (adjusted during render, not in an effect)
  const [optionalFor, setOptionalFor] = useState(null);
  if (optionalFor !== record && (record.name || isNew)) {
    setOptionalFor(record);
    setVisibleOptional(['cluster', 'zone', 'session_token', 'region', 'read_only']
      .filter((key) => record[key] !== undefined && record[key] !== null && record[key] !== '' && !(Array.isArray(record[key]) && record[key].length === 0)));
  }

  useEffect(() => {
    if (record.name || isNew) {
      form.setFieldsValue(record);
    }
  }, [record, form, isNew]);

  const saveSection = useMutation({
    mutationFn: (fields: any) => {
      const payload: any = { ...fields };
      return isNew
        ? rpc('add', { kind: 'credential', name: payload.name, fields: payload })
        : rpc('edit', { kind: 'credential', name, fields: payload });
    },
    onSuccess: (_data: any, fields: any) => {
      message.success('Credential saved');
      setEditingSection(null);
      // Never keep the plaintext secret in the form after it has been stored.
      form.setFieldsValue({ secret: undefined });
      if (isNew && fields.name) navigate(`/credentials/${encodeURIComponent(fields.name)}`, { replace: true });
      queryClient.invalidateQueries({ queryKey: ['credential', name] });
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
    },
    onError: (e) => message.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => rpc('rm', { kind: 'credential', name }),
    onSuccess: () => {
      message.success('Credential removed');
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
      queryClient.removeQueries({ queryKey: ['credential', name] });
      navigate('/credentials');
    },
    onError: (e) => message.error(e.message),
  });

  const submitSection = (fieldNames) => {
    form.validateFields(fieldNames.concat(['name', 'access_key'])).then((values) => {
      const payload: any = {};
      // 'add' must carry everything at once (access_key + secret are mandatory),
      // so a new credential sends the values of both sections.
      const all = isNew ? form.getFieldsValue(true) : values;
      (isNew ? IDENTITY_FIELDS.concat(ACCESS_FIELDS) : fieldNames).forEach((field) => { if (all[field] !== undefined && !(field === 'secret' && !all[field])) payload[field] = all[field]; });
      if (isNew) {
        // the Name input lives in the Identity modal; without it 'add' would create a credential called "new"
        if (!all.name) { message.warning('Enter the credential name in Identity first'); setEditingSection('identity'); return; }
        payload.name = all.name;
      }
      saveSection.mutate(payload);
    }).catch(() => {});
  };

  const availableOptional = (fields) => fields.filter((key) => !visibleOptional.includes(key));

  if (!isNew && credential.isLoading) return <div>Loading...</div>;
  if (!isNew && !record.name) return <div>Credential not found</div>;

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/credentials')}>Back</Button>
        {!isNew && <Button danger icon={<DeleteOutlined />} onClick={() => remove.mutate()}>Remove</Button>}
      </Space>

      <Card title="Identity" extra={<Button size="small" onClick={() => setEditingSection('identity')}>Edit</Button>} style={{ marginBottom: 16 }}>
        <Descriptions bordered={false} column={2} size="small">
          <Descriptions.Item label="Name">{record.name || 'New credential'}</Descriptions.Item>
          <Descriptions.Item label="Cluster">{record.cluster || '—'}</Descriptions.Item>
          <Descriptions.Item label="Zone">{record.zone || '—'}</Descriptions.Item>
          <Descriptions.Item label="Access key">{record.access_key || '—'}</Descriptions.Item>
          <Descriptions.Item label="Has secret">{String(record.has_secret)}</Descriptions.Item>
          <Descriptions.Item label="Session token">{record.session_token_set ? 'set' : 'not set'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="Access" extra={<Button size="small" onClick={() => setEditingSection('access')}>Edit</Button>} style={{ marginBottom: 16 }}>
        <Descriptions bordered={false} column={2} size="small">
          <Descriptions.Item label="Region">{record.region || '—'}</Descriptions.Item>
          <Descriptions.Item label="Read only">{String(record.read_only)}</Descriptions.Item>
        </Descriptions>
      </Card>

      {!isNew && (
        <Card title="Used by clusters">
          <Table rowKey={(r: any) => `${r.name}@${r._owner || 'local'}`} dataSource={(clusters.data || []).filter((c) => (c.credentials || []).includes(name))} pagination={false} columns={[
            { title: 'Cluster', dataIndex: 'name', render: (v) => <Link to={`/clusters/${v}`}>{v}</Link> },
            { title: 'Vendor', dataIndex: 'vendor' },
            { title: 'Zone', dataIndex: 'zone' },
          ]} />
        </Card>
      )}

      <Modal title="Identity" open={editingSection === 'identity'} onCancel={() => setEditingSection(null)} onOk={() => submitSection(IDENTITY_FIELDS)} confirmLoading={saveSection.isPending} width={640}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input disabled={!isNew} /></Form.Item>
          {visibleOptional.includes('cluster') && (
            <Form.Item name="cluster" label="Cluster">
              <Select options={Array.from(new Map((clusters.data || []).map((c: any) => [c.name, c])).values()).map((c: any) => ({ value: c.name, label: c.name }))} />
            </Form.Item>
          )}
          {visibleOptional.includes('zone') && <Form.Item name="zone" label="Zone"><Input /></Form.Item>}
          <Form.Item name="access_key" label="Access key" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="secret" label="Secret" rules={isNew ? [{ required: true }] : []} extra={isNew ? undefined : 'Leave empty to keep the stored secret'}><Input.Password autoComplete="new-password" /></Form.Item>
          {visibleOptional.includes('session_token') && <Form.Item name="session_token" label="Session token"><Input /></Form.Item>}
          {availableOptional(IDENTITY_OPTIONAL).length > 0 && (
            <Select placeholder="Add optional field" style={{ width: 220, marginTop: 8 }} options={availableOptional(IDENTITY_OPTIONAL).map((k: any) => ({ value: k, label: k }))} onChange={(value) => setVisibleOptional((prev) => [...prev, value])} value={null} />
          )}
        </Form>
      </Modal>

      <Modal title="Access" open={editingSection === 'access'} onCancel={() => setEditingSection(null)} onOk={() => submitSection(ACCESS_FIELDS)} confirmLoading={saveSection.isPending} width={640}>
        <Form form={form} layout="vertical">
          {visibleOptional.includes('region') && <Form.Item name="region" label="Region"><Input /></Form.Item>}
          {visibleOptional.includes('read_only') && <Form.Item name="read_only" label="Read only" valuePropName="checked"><Switch /></Form.Item>}
          {availableOptional(ACCESS_FIELDS).length > 0 && (
            <Select placeholder="Add optional field" style={{ width: 220, marginTop: 8 }} options={availableOptional(ACCESS_FIELDS).map((k: any) => ({ value: k, label: k }))} onChange={(value) => setVisibleOptional((prev) => [...prev, value])} value={null} />
          )}
        </Form>
      </Modal>
    </>
  );
}
