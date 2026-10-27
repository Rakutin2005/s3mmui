import { AutoComplete, Button, Card, Descriptions, Form, Input, Modal, Select, Space, Table, Typography, message } from 'antd';
import { ArrowLeftOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import RuleEditor from '../components/RuleEditor.jsx';
import SortableRulesTable from '../components/SortableRulesTable.jsx';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { endpoints, rpc } from '../api.js';

// Valid default actions (see policy::findActionSpec); 'null'/'defer' are rejected by s3mmd.
const DEFAULT_ACTION_OPTIONS = [{ value: 'accept' }, { value: 'drop' }, { value: 'quarantine' }, { value: 'pass' }];

// Keyed by the route param so that forms/modals reset when switching policies.
export default function PolicyDetail() {
  const { name } = useParams();
  return <PolicyDetailView key={name} />;
}

function PolicyDetailView() {
  const { name } = useParams();
  const isNew = name === 'new';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const policy = useQuery<any>({ queryKey: ['policy', name], queryFn: () => endpoints.policy(name), enabled: !isNew });
  const replications = useQuery<any>({ queryKey: ['replications'], queryFn: endpoints.replications });
  const [editingSection, setEditingSection] = useState(null);
  const [visibleOptional, setVisibleOptional] = useState([]);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState(null);
  const [bundleForm] = Form.useForm();
  const record: any = useMemo(() => (isNew ? { name: '' } : (policy.data || {})), [isNew, policy.data]);

  // s3mmd reports defaults as { acl, bucket, object }; the edit fields are default_*.
  const formValues: any = useMemo(() => ({
    ...record,
    default_access: record.defaults?.acl ?? record.defaults?.access,
    default_bucket: record.defaults?.bucket,
    default_object: record.defaults?.object,
  }), [record]);

  // optional fields shown follow the loaded record (adjusted during render, not in an effect)
  const [optionalFor, setOptionalFor] = useState(null);
  if (optionalFor !== formValues && record.name) {
    setOptionalFor(formValues);
    setVisibleOptional(['default_access', 'default_bucket', 'default_object', 'route_denied', 'route_warning', 'route_success']
      .filter((key) => formValues[key] !== undefined && formValues[key] !== null && formValues[key] !== ''));
  }

  useEffect(() => {
    if (record.name) bundleForm.setFieldsValue(formValues);
  }, [record, formValues, bundleForm]);

  const saveSection = useMutation({
    mutationFn: (values: any) => {
      const fields = { ...values };
      delete fields.name;
      return isNew ? rpc('add', { kind: 'policy', name: values.name, fields }) : rpc('edit', { kind: 'policy', name, fields });
    },
    onSuccess: (_data: any, values: any) => {
      message.success('Policy saved');
      setEditingSection(null);
      if (isNew && values.name) navigate(`/policies/${encodeURIComponent(values.name)}`, { replace: true });
      queryClient.invalidateQueries({ queryKey: ['policy', name] });
      queryClient.invalidateQueries({ queryKey: ['policies'] });
    },
    onError: (e) => message.error(e.message),
  });

  const removeBundle = useMutation({
    mutationFn: () => rpc('rm', { kind: 'policy', name }),
    onSuccess: () => {
      message.success('Policy removed');
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      queryClient.removeQueries({ queryKey: ['policy', name] });
      navigate('/policies');
    },
    onError: (e) => message.error(e.message),
  });

  const applyRule = useMutation({
    mutationFn: (values: any) => {
      // s3mmd reads 'ref' with fstr(): it must be a string, a number is ignored.
      return rpc('rule', {
        action: values.action,
        policy: name,
        ref: values.ref !== undefined && values.ref !== null ? String(values.ref) : undefined,
        line: values.line,
        before: values.before || undefined,
        after: values.after || undefined,
      });
    },
    onSuccess: () => {
      message.success('Rule applied');
      setRuleOpen(false);
      setSelectedRule(null);
      queryClient.invalidateQueries({ queryKey: ['policy', name] });
      queryClient.invalidateQueries({ queryKey: ['policies'] });
    },
    onError: (e) => message.error(e.message),
  });

  const removeRule = useMutation({
    mutationFn: (ref: any) => rpc('rule', { action: 'rm', policy: name, ref: String(ref) }),
    onSuccess: () => {
      message.success('Rule removed');
      queryClient.invalidateQueries({ queryKey: ['policy', name] });
      queryClient.invalidateQueries({ queryKey: ['policies'] });
    },
    onError: (e) => message.error(e.message),
  });

  // There is no 'move' rule action: re-insert the rule next to its new neighbour
  // (rm + add with before/after), restoring it if the add is rejected.
  const moveRule = useMutation({
    mutationFn: async ({ rule, before, after }: any) => {
      const line = String(rule.line || '').replace(/^\d+\s+/, '');
      await rpc('rule', { action: 'rm', policy: name, ref: String(rule.order) });
      try {
        return await rpc('rule', { action: 'add', policy: name, line, before, after });
      } catch (e) {
        await rpc('rule', { action: 'add', policy: name, line }).catch(() => {});
        throw e;
      }
    },
    onSuccess: () => message.success('Rule order updated'),
    onError: (e) => message.error(e.message),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['policy', name] });
      queryClient.invalidateQueries({ queryKey: ['policies'] });
    },
  });
  if (!isNew && policy.isLoading) return <div>Loading...</div>;
  if (!isNew && !record.name) return <div>Policy not found</div>;

  const usedBy = (replications.data || []).filter((r) => r.policy === name);

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/policies')}>Back</Button>
        <Button type="primary" icon={<EditOutlined />} onClick={() => setEditingSection('defaults')}>Edit defaults</Button>
        <Button icon={<EditOutlined />} onClick={() => setEditingSection('routing')}>Edit routing</Button>
        {!isNew && <Button icon={<PlusOutlined />} onClick={() => { setSelectedRule(null); setRuleOpen(true); }}>Add rule</Button>}
        {!isNew && <Button danger icon={<DeleteOutlined />} onClick={() => removeBundle.mutate()}>Remove</Button>}
      </Space>

      <Card title="Defaults" style={{ marginBottom: 16 }}>
        <Descriptions bordered={false} column={2} size="small">
          <Descriptions.Item label="Name">{record.name || 'New policy'}</Descriptions.Item>
          <Descriptions.Item label="Default access">{record.defaults?.acl || record.defaults?.access || '—'}</Descriptions.Item>
          <Descriptions.Item label="Default bucket">{record.defaults?.bucket || '—'}</Descriptions.Item>
          <Descriptions.Item label="Default object">{record.defaults?.object || '—'}</Descriptions.Item>
        </Descriptions>
      </Card>
      <Card title="Routing" style={{ marginBottom: 16 }}>
        <Descriptions bordered={false} column={2} size="small">
          <Descriptions.Item label="Route denied">{record.route_denied || '—'}</Descriptions.Item>
          <Descriptions.Item label="Route warning">{record.route_warning || '—'}</Descriptions.Item>
          <Descriptions.Item label="Route success">{record.route_success || '—'}</Descriptions.Item>
          <Descriptions.Item label="Rules">{record.rules || 0}</Descriptions.Item>
        </Descriptions>
      </Card>

{!isNew && <Card title="Rules" style={{ marginBottom: 16 }} extra={<Typography.Text type="secondary" style={{ fontSize: 12 }}>Drag to reorder</Typography.Text>}>
        <SortableRulesTable
          dataSource={record.rule_list || []}
          onEdit={(r) => { setSelectedRule(r); setRuleOpen(true); }}
          onDelete={(r) => removeRule.mutate(r.order)}
          onReorder={(_newItems, moved, target, oldIndex, newIndex) => {
            if (!moved || !target) return;
            moveRule.mutate(newIndex < oldIndex
              ? { rule: moved, before: String(target.order) }
              : { rule: moved, after: String(target.order) });
          }}
        />
      </Card>}

<Card title="Used by replications">
        <Table rowKey={(r: any) => `${r.name}@${r._owner || 'local'}`} dataSource={usedBy} pagination={false} columns={[
          { title: 'Replication', dataIndex: 'name', render: (v) => <Link to={`/replications/${v}`}>{v}</Link> },
          { title: 'Source', dataIndex: 'source' },
          { title: 'Destination', dataIndex: 'destination' },
        ]} />
      </Card>

      <Modal title="Defaults" open={editingSection === 'defaults'} onCancel={() => setEditingSection(null)} onOk={() => {
        bundleForm.validateFields(isNew ? ['name','default_access','default_bucket','default_object'] : ['default_access','default_bucket','default_object']).then((values) => {
          const fields: any = {};
          // an empty default is rejected by s3mmd ("empty action"): only send set values
          ['default_access','default_bucket','default_object'].forEach((k) => { if (values[k]) fields[k] = values[k]; });
          if (isNew) fields.name = bundleForm.getFieldValue('name');
          saveSection.mutate(fields);
        }).catch(() => {});
      }} confirmLoading={saveSection.isPending} width={700}>
        <Form form={bundleForm} layout="vertical">
          {isNew && <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>}
          {visibleOptional.includes('default_access') && (
            <Form.Item name="default_access" label="Default access">
              <AutoComplete options={DEFAULT_ACTION_OPTIONS} placeholder="accept" />
            </Form.Item>
          )}
          {visibleOptional.includes('default_bucket') && (
            <Form.Item name="default_bucket" label="Default bucket">
              <AutoComplete options={DEFAULT_ACTION_OPTIONS} placeholder="accept" />
            </Form.Item>
          )}
          {visibleOptional.includes('default_object') && (
            <Form.Item name="default_object" label="Default object">
              <AutoComplete options={DEFAULT_ACTION_OPTIONS} placeholder="accept" />
            </Form.Item>
          )}
          {['default_access','default_bucket','default_object'].filter((k) => !visibleOptional.includes(k)).length > 0 && (
            <Select placeholder="Add optional field" style={{ width: 220, marginBottom: 16 }} options={['default_access','default_bucket','default_object'].filter((k) => !visibleOptional.includes(k)).map((k: any) => ({ value: k, label: k }))} onChange={(value) => setVisibleOptional((prev) => [...prev, value])} value={null} />
          )}
        </Form>
      </Modal>

      <Modal title="Routing" open={editingSection === 'routing'} onCancel={() => setEditingSection(null)} onOk={() => {
        bundleForm.validateFields(isNew ? ['name','route_denied','route_warning','route_success'] : ['route_denied','route_warning','route_success']).then((values) => {
          const fields: any = {};
          ['route_denied','route_warning','route_success'].forEach((k) => { if (values[k] !== undefined) fields[k] = values[k]; });
          if (isNew) fields.name = bundleForm.getFieldValue('name');
          saveSection.mutate(fields);
        }).catch(() => {});
      }} confirmLoading={saveSection.isPending} width={700}>
        <Form form={bundleForm} layout="vertical">
          {isNew && <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>}
          {visibleOptional.includes('route_denied') && (
            <Form.Item name="route_denied" label="Route denied">
              <AutoComplete options={[{ value: 'null' }, { value: 'quarantine' }]} placeholder="null" />
            </Form.Item>
          )}
          {visibleOptional.includes('route_warning') && (
            <Form.Item name="route_warning" label="Route warning">
              <AutoComplete options={[{ value: 'null' }, { value: 'quarantine' }]} placeholder="quarantine" />
            </Form.Item>
          )}
          {visibleOptional.includes('route_success') && (
            <Form.Item name="route_success" label="Route success">
              <AutoComplete options={[{ value: '' }, { value: 'null' }]} />
            </Form.Item>
          )}
          {['route_denied','route_warning','route_success'].filter((k) => !visibleOptional.includes(k)).length > 0 && (
            <Select placeholder="Add optional field" style={{ width: 220, marginBottom: 16 }} options={['route_denied','route_warning','route_success'].filter((k) => !visibleOptional.includes(k)).map((k: any) => ({ value: k, label: k }))} onChange={(value) => setVisibleOptional((prev) => [...prev, value])} value={null} />
          )}
        </Form>
      </Modal>

      <Modal title={`Rule Editor: ${selectedRule ? 'Edit' : 'New'}`} open={ruleOpen} onCancel={() => { setRuleOpen(false); setSelectedRule(null); }} footer={null} width={900} destroyOnHidden>
        <RuleEditor
          key={selectedRule ? `edit-${selectedRule.order}` : 'new'}
          initialRule={selectedRule}
          onSave={(rule) => {
            // the modal is closed in applyRule.onSuccess so that a rejected rule is not lost
            if (selectedRule) {
              applyRule.mutate({ action: 'edit', ref: selectedRule.order, line: rule.line });
            } else {
              applyRule.mutate({ action: 'add', line: rule.line });
            }
          }}
          onCancel={() => { setRuleOpen(false); setSelectedRule(null); }}
        />
      </Modal>
    </>
  );
}
