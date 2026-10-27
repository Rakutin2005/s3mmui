import { Button, Card, Col, Descriptions, Form, Input, InputNumber, Modal, Row, Select, Space, Switch, Table, message } from 'antd';
import { ArrowLeftOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { endpoints, rpc, rbac } from '../api.js';
import ObjectBrowserPage from './ObjectBrowserPage.jsx';
import { clusterAddress } from '../address.js';

const SUMMARY_FIELDS = ['alias', 'vendor', 'zone', 'location', 'description'];
const CONNECTIVITY_FIELDS = ['addr', 'credentials', 'path_style', 'insecure', 'admin_endpoint'];
const PERFORMANCE_FIELDS = ['timeout', 'connect_timeout', 'rate_limit', 'parallel', 'part_size', 'retries'];
const ALL_OPTIONAL = [...SUMMARY_FIELDS, ...CONNECTIVITY_FIELDS, ...PERFORMANCE_FIELDS, 'managed'];

// Keyed by the route param so that form/modal state is reset when navigating
// from one cluster to another (React Router reuses the element otherwise).
export default function ClusterDetail() {
  const { name } = useParams();
  return <ClusterDetailView key={name} />;
}

function ClusterDetailView() {
  const { name } = useParams();
  const isNew = name === 'new';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cluster = useQuery<any>({ queryKey: ['cluster', name], queryFn: () => endpoints.cluster(name), enabled: !isNew });
  const credentials = useQuery<any>({ queryKey: ['credentials'], queryFn: endpoints.credentials });
  const replications = useQuery<any>({ queryKey: ['replications'], queryFn: endpoints.replications });
  const acls = useQuery<any>({ queryKey: ['acls','clusters',name], queryFn: () => rbac.listAcl('clusters', name), enabled: !isNew });

  const [editingSection, setEditingSection] = useState(null);
  const [aclModal, setAclModal] = useState(false);
  const [aclForm] = Form.useForm();
  const [visibleOptional, setVisibleOptional] = useState([]);
  const [form] = Form.useForm();
  // Memoised: a fresh object on every render re-ran the form sync on every render
  // (and looped forever on /clusters/new).
  const record: any = useMemo(() => (isNew ? { name: '', addr: [] } : (cluster.data || {})), [isNew, cluster.data]);

  const usedByCredentials = (credentials.data || []).filter((c) => (record.credentials || []).includes(c.name) || c.cluster === name);
  const usedByReplications = (replications.data || []).filter((r) => r.source === name || r.destination === name);

  // optional fields shown follow the loaded record (adjusted during render, not in an effect)
  const [optionalFor, setOptionalFor] = useState(null);
  if (optionalFor !== record && (record.name || isNew)) {
    setOptionalFor(record);
    setVisibleOptional(ALL_OPTIONAL.filter((key) => record[key] !== undefined && record[key] !== null && record[key] !== '' && !(Array.isArray(record[key]) && record[key].length === 0)));
  }

  useEffect(() => {
    if (record.name || isNew) {
      form.setFieldsValue({
        ...record,
        addr: record.addr || [],
        credentials: record.credentials || [],
        admin_endpoint: record.admin_endpoint || [],
      });
    }
  }, [record, form, isNew]);

  const saveSection = useMutation({
    mutationFn: (fields: any) => {
      const payload: any = { ...fields };
      if (payload.addr) payload.addr = payload.addr.filter(Boolean);
      if (payload.credentials) payload.credentials = payload.credentials.filter(Boolean);
      if (payload.admin_endpoint) payload.admin_endpoint = payload.admin_endpoint.filter(Boolean);
      return isNew
        ? rpc('add', { kind: 'cluster', name: fields.name, fields: payload })
        : rpc('edit', { kind: 'cluster', name, fields: payload });
    },
    onSuccess: (_data: any, fields: any) => {
      message.success('Cluster saved');
      setEditingSection(null);
      queryClient.invalidateQueries({ queryKey: ['cluster', name] });
      queryClient.invalidateQueries({ queryKey: ['clusters'] });
      // After creation leave /clusters/new, otherwise the next save would try 'add' again.
      if (isNew && fields.name) navigate(`/clusters/${encodeURIComponent(fields.name)}`, { replace: true });
    },
    onError: (e) => message.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => rpc('rm', { kind: 'cluster', name }),
    onSuccess: () => {
      message.success('Cluster removed');
      queryClient.invalidateQueries({ queryKey: ['clusters'] });
      queryClient.removeQueries({ queryKey: ['cluster', name] });
      navigate('/clusters');
    },
    onError: (e) => message.error(e.message),
  });

  const setAcl = useMutation({
    mutationFn: rbac.setAcl,
    onSuccess: () => { message.success('ACL saved'); queryClient.invalidateQueries({ queryKey: ['acls','clusters',name] }); setAclModal(false); aclForm.resetFields(); },
    onError: (e) => message.error(e.message),
  });
  const deleteAcl = useMutation({
    mutationFn: rbac.deleteAcl,
    onSuccess: () => { message.success('deleted'); queryClient.invalidateQueries({ queryKey: ['acls','clusters',name] }); },
    onError: (e) => message.error(e.message),
  });
  const openSection = (section, fieldNames) => {
    form.validateFields().catch(() => {});
    setEditingSection(section);
    setVisibleOptional((prev) => {
      const present = fieldNames.filter((key) => record[key] !== undefined && record[key] !== null && record[key] !== '' && !(Array.isArray(record[key]) && record[key].length === 0));
      return Array.from(new Set([...prev, ...present]));
    });
  };

  const submitSection = (fieldNames) => {
    form.validateFields(fieldNames.concat(['name'])).then((values) => {
      const payload: any = {};
      // A new cluster is created in one 'add' call, which requires 'addr': send every
      // section's values, not only the fields of the modal being saved.
      const all = isNew ? form.getFieldsValue(true) : values;
      (isNew ? ALL_OPTIONAL.concat(['addr']) : fieldNames).forEach((field) => { if (all[field] !== undefined) payload[field] = all[field]; });
      if (isNew) {
        // the Name input lives in the Summary modal; without it 'add' would create a cluster called "new"
        if (!all.name) { message.warning('Enter the cluster name in Summary first'); setEditingSection('summary'); return; }
        payload.name = all.name;
      }
      saveSection.mutate(payload);
    }).catch(() => {});
  };

  if (!isNew && cluster.isLoading) return <div>Loading...</div>;
  if (!isNew && !record.name) return <div>Cluster not found</div>;

  const availableOptional = (sectionFields) => sectionFields.filter((key) => !visibleOptional.includes(key));

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/clusters')}>Back</Button>
        {!isNew && <Button danger icon={<DeleteOutlined />} onClick={() => remove.mutate()}>Remove</Button>}
      </Space>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="Summary" extra={<Button size="small" onClick={() => openSection('summary', SUMMARY_FIELDS)}>Edit</Button>} style={{ height: "100%" }}>
        <Descriptions bordered={false} column={2} size="small">
          <Descriptions.Item label="Name">{record.name || 'New cluster'}</Descriptions.Item>
          <Descriptions.Item label="Address"><code>{clusterAddress(record) || '—'}</code></Descriptions.Item>
          <Descriptions.Item label="Alias">{record.alias || '—'}</Descriptions.Item>
          <Descriptions.Item label="Vendor">{record.vendor || '—'}</Descriptions.Item>
          <Descriptions.Item label="Zone">{record.zone || '—'}</Descriptions.Item>
          <Descriptions.Item label="Location">{record.location || '—'}</Descriptions.Item>
          <Descriptions.Item label="Description">{record.description || '—'}</Descriptions.Item>
          <Descriptions.Item label="Managed">{record.managed === false ? 'Unmanaged' : 'Managed'}</Descriptions.Item>
        </Descriptions>
      </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Connectivity" extra={<Button size="small" onClick={() => openSection('connectivity', CONNECTIVITY_FIELDS)}>Edit</Button>} style={{ height: "100%" }}>
        <Descriptions bordered={false} column={1} size="small">
          <Descriptions.Item label="Endpoints">{(record.addr || []).length ? (record.addr || []).join(', ') : '—'}</Descriptions.Item>
          <Descriptions.Item label="Credentials">{(record.credentials || []).length ? (record.credentials || []).join(', ') : '—'}</Descriptions.Item>
          <Descriptions.Item label="Path style">{String(record.path_style)}</Descriptions.Item>
          <Descriptions.Item label="Insecure">{String(record.insecure)}</Descriptions.Item>
          <Descriptions.Item label="Management endpoint">
            {record.managed === false ? 'not used (unmanaged)' : (record.admin_endpoint || []).length ? record.admin_endpoint.join(', ') : 'same as endpoints'}
          </Descriptions.Item>
        </Descriptions>
      </Card>
        </Col>
      </Row>

      <Card title="Performance" extra={<Button size="small" onClick={() => openSection('performance', PERFORMANCE_FIELDS)}>Edit</Button>} style={{ marginBottom: 16 }}>
        <Descriptions bordered={false} column={2} size="small">
          <Descriptions.Item label="Timeout">{record.timeout || '—'}</Descriptions.Item>
          <Descriptions.Item label="Connect timeout">{record.connect_timeout || '—'}</Descriptions.Item>
          <Descriptions.Item label="Rate limit">{record.rate_limit || '—'}</Descriptions.Item>
          <Descriptions.Item label="Parallel">{record.parallel || '—'}</Descriptions.Item>
          <Descriptions.Item label="Part size">{record.part_size || '—'}</Descriptions.Item>
          <Descriptions.Item label="Retries">{record.retries || '—'}</Descriptions.Item>
        </Descriptions>
      </Card>

      {!isNew && <Card title="Object browser" style={{ marginBottom: 16, height: 'calc(100vh - 300px)', minHeight: 540, maxHeight: 'calc(100vh - 140px)', width: '100%' }} styles={{ body: { padding: 0, height: 'calc(100% - 57px)', overflow: 'hidden' } }}>
        <div style={{ height: '100%', width: '100%' }}>
          <ObjectBrowserPage />
        </div>
      </Card>}

      {!isNew && (
        <>
          <Card title="Access control (ACL)" style={{ marginBottom: 16 }} extra={<Button size="small" onClick={() => setAclModal(true)}>+ add</Button>}>
            <Table rowKey="id" dataSource={acls.data || []} pagination={false} columns={[
              { title: 'ID', dataIndex: 'id' },
              { title: 'Subject', dataIndex: 'subject' },
              { title: 'Type', dataIndex: 'subject_type' },
              { title: 'Effect', dataIndex: 'effect' },
              { title: 'Actions', dataIndex: 'actions', render: (v) => (v || []).join(', ') },
              { title: '', render: (_: any, r: any) => <Button danger size="small" onClick={() => deleteAcl.mutate(r.id)}>Delete</Button> },
            ]} />
          </Card>
          <Card title="Used by credentials" style={{ marginBottom: 16 }}>
            <Table rowKey={(r: any) => `${r.name}@${r._owner || 'local'}`} dataSource={usedByCredentials} pagination={false} columns={[
              { title: 'Credential', dataIndex: 'name', render: (v) => <Link to={`/credentials/${v}`}>{v}</Link> },
              { title: 'Access key', dataIndex: 'access_key' },
              { title: 'Region', dataIndex: 'region' },
            ]} />
          </Card>
          <Card title="Used by replications">
            <Table rowKey={(r: any) => `${r.name}@${r._owner || 'local'}`} dataSource={usedByReplications} pagination={false} columns={[
              { title: 'Replication', dataIndex: 'name', render: (v) => <Link to={`/replications/${v}`}>{v}</Link> },
              { title: 'Role', render: (_: any, r: any) => r.source === name ? 'source' : 'destination' },
              { title: 'Policy', dataIndex: 'policy' },
            ]} />
          </Card>
        </>
      )}

      <Modal title="Summary" open={editingSection === 'summary'} onCancel={() => setEditingSection(null)} onOk={() => submitSection(SUMMARY_FIELDS.concat(['managed']))} confirmLoading={saveSection.isPending} width={640}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input disabled={!isNew} /></Form.Item>
          {visibleOptional.includes('alias') && <Form.Item name="alias" label="Alias"><Input /></Form.Item>}
          {visibleOptional.includes('vendor') && <Form.Item name="vendor" label="Vendor"><Input /></Form.Item>}
          {visibleOptional.includes('zone') && <Form.Item name="zone" label="Zone"><Input /></Form.Item>}
          {visibleOptional.includes('location') && <Form.Item name="location" label="Location"><Input /></Form.Item>}
          {visibleOptional.includes('description') && <Form.Item name="description" label="Description"><Input.TextArea rows={3} /></Form.Item>}
          {visibleOptional.includes('managed') && <Form.Item name="managed" label="Managed" valuePropName="checked"><Switch /></Form.Item>}
          {availableOptional(SUMMARY_FIELDS.concat(['managed'])).length > 0 && (
            <Select placeholder="Add optional field" style={{ width: 220, marginBottom: 16 }} options={availableOptional(SUMMARY_FIELDS.concat(['managed'])).map((k: any) => ({ value: k, label: k }))} onChange={(value) => setVisibleOptional((prev) => [...prev, value])} value={null} />
          )}
        </Form>
      </Modal>

      <Modal title="Connectivity" open={editingSection === 'connectivity'} onCancel={() => setEditingSection(null)} onOk={() => submitSection(CONNECTIVITY_FIELDS)} confirmLoading={saveSection.isPending} width={760}>
        <Form form={form} layout="vertical">
          <Form.List name="addr">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field: any) => (
                  <Space key={field.key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                    <Form.Item {...field} rules={[{ required: true }]} style={{ flex: 1, marginBottom: 0 }}>
                      <Input placeholder="http://host:port" />
                    </Form.Item>
                    <Button onClick={() => remove(field.name)} danger>-</Button>
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />} block>Add endpoint</Button>
              </>
            )}
          </Form.List>
          {visibleOptional.includes('credentials') && (
            <Form.Item name="credentials" label="Credentials">
              <Select mode="multiple" options={Array.from(new Map((credentials.data || []).map((c: any) => [c.name, c])).values()).map((c: any) => ({ value: c.name, label: c.name }))} />
            </Form.Item>
          )}
          {visibleOptional.includes('path_style') && (
            <Form.Item name="path_style" label="Path style" valuePropName="checked"><Switch /></Form.Item>
          )}
          {visibleOptional.includes('insecure') && (
            <Form.Item name="insecure" label="Insecure" valuePropName="checked"><Switch /></Form.Item>
          )}
          {visibleOptional.includes('admin_endpoint') && (
            <Form.Item
              name="admin_endpoint"
              label="Management (admin API) endpoints"
              extra="scheme://host:port of the vendor admin API (MinIO/RustFS); empty = same as the endpoints. Used only for managed clusters."
            >
              <Select mode="tags" tokenSeparators={[',', ' ']} placeholder="https://admin.example.com:9000" />
            </Form.Item>
          )}
          {availableOptional(CONNECTIVITY_FIELDS).length > 0 && (
            <Select placeholder="Add optional field" style={{ width: 220, marginTop: 8 }} options={availableOptional(CONNECTIVITY_FIELDS).map((k: any) => ({ value: k, label: k }))} onChange={(value) => setVisibleOptional((prev) => [...prev, value])} value={null} />
          )}
        </Form>
      </Modal>

      <Modal title="Performance" open={editingSection === 'performance'} onCancel={() => setEditingSection(null)} onOk={() => submitSection(PERFORMANCE_FIELDS)} confirmLoading={saveSection.isPending} width={640}>
        <Form form={form} layout="vertical">
          {visibleOptional.includes('timeout') && <Form.Item name="timeout" label="Timeout (seconds)"><InputNumber style={{ width: '100%' }} /></Form.Item>}
          {visibleOptional.includes('connect_timeout') && <Form.Item name="connect_timeout" label="Connect timeout (seconds)"><InputNumber style={{ width: '100%' }} /></Form.Item>}
          {visibleOptional.includes('rate_limit') && <Form.Item name="rate_limit" label="Rate limit"><InputNumber style={{ width: '100%' }} /></Form.Item>}
          {visibleOptional.includes('parallel') && <Form.Item name="parallel" label="Parallel transfers"><InputNumber style={{ width: '100%' }} /></Form.Item>}
          {visibleOptional.includes('part_size') && <Form.Item name="part_size" label="Part size (bytes)"><InputNumber style={{ width: '100%' }} /></Form.Item>}
          {visibleOptional.includes('retries') && <Form.Item name="retries" label="Retries"><InputNumber style={{ width: '100%' }} /></Form.Item>}
          {availableOptional(PERFORMANCE_FIELDS).length > 0 && (
            <Select placeholder="Add optional field" style={{ width: 220, marginTop: 8 }} options={availableOptional(PERFORMANCE_FIELDS).map((k: any) => ({ value: k, label: k }))} onChange={(value) => setVisibleOptional((prev) => [...prev, value])} value={null} />
          )}
        </Form>
      </Modal>
      <Modal title="Add ACL entry" open={aclModal} onCancel={() => setAclModal(false)} onOk={() => aclForm.submit()} confirmLoading={setAcl.isPending}>
        <Form form={aclForm} layout="vertical" onFinish={(v) => setAcl.mutate({ ...v, resource_type: 'clusters', resource_id: name })}>
          <Form.Item name="subject" label="Subject" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="subject_type" label="Subject type" initialValue="user"><Select options={[{value:'user',label:'user'},{value:'role',label:'role'},{value:'group',label:'group'}]} /></Form.Item>
          <Form.Item name="effect" label="Effect" initialValue="allow"><Select options={[{value:'allow',label:'allow'},{value:'deny',label:'deny'}]} /></Form.Item>
          <Form.Item name="actions" label="Actions" initialValue={['read']}><Select mode="multiple" options={[{value:'read',label:'read'},{value:'write',label:'write'},{value:'manage',label:'manage'}]} /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}
