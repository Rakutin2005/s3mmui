// Generic page for an s3mmws module (GET /ui/extensions). The module
// describes its page declaratively (see s3mm/include/s3mm/rest/module.hpp);
// nothing here knows about a particular module.
import { Button, Card, Descriptions, Empty, Form, Input, InputNumber, Modal, Space, Switch, Table, Tag, Typography, message } from 'antd';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { endpoints, extCall } from '../api.js';

type Field = { name: string; label?: string; type?: string; required?: boolean };
type Action = { label: string; method?: string; endpoint: string; body?: any; fields?: Field[]; confirm?: string; danger?: boolean };
type Column = { key: string; title?: string; type?: string };
type Section = {
  type: 'kv' | 'table' | 'actions' | 'json';
  title?: string;
  source?: string;
  path?: string;
  fields?: Column[];
  columns?: Column[];
  rowKey?: string;
  rowActions?: Action[];
  actions?: Action[];
};

function pick(data: any, path?: string) {
  if (!path) return data;
  return path.split('.').reduce((v, k) => (v == null ? v : v[k]), data);
}

/// Replace {name} placeholders in strings (deep) with values from `vars`.
function fill(template: any, vars: Record<string, any>, encode = false): any {
  if (typeof template === 'string') {
    return template.replace(/\{([A-Za-z0-9_.-]+)\}/g, (_, k) => {
      const v = vars[k] ?? '';
      return encode ? encodeURIComponent(String(v)) : String(v);
    });
  }
  if (Array.isArray(template)) return template.map((t) => fill(t, vars, encode));
  if (template && typeof template === 'object') {
    const out: any = {};
    Object.entries(template).forEach(([k, v]) => { out[k] = fill(v, vars, encode); });
    return out;
  }
  return template;
}

function renderValue(value: any, type?: string) {
  if (value === undefined || value === null || value === '') return <Typography.Text type="secondary">—</Typography.Text>;
  if (type === 'bool' || typeof value === 'boolean') return value ? <Tag color="green">yes</Tag> : <Tag>no</Tag>;
  if (type === 'tag') return (Array.isArray(value) ? value : [value]).map((v: any) => <Tag key={String(v)}>{String(v)}</Tag>);
  if (type === 'json' || typeof value === 'object') return <code style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(value)}</code>;
  return String(value);
}

export default function ExtensionPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const extensions = useQuery<any>({ queryKey: ['ui-extensions'], queryFn: endpoints.extensions });
  const ext = (extensions.data || []).find((e: any) => e.id === id);
  const sections: Section[] = ext?.sections || [];
  const sources = Array.from(new Set(sections.map((s) => s.source).filter(Boolean))) as string[];
  const refreshMs = ext?.refresh ? Number(ext.refresh) * 1000 : false;

  const results = useQueries({
    queries: sources.map((src) => ({
      queryKey: ['ext', id, src],
      queryFn: () => extCall('GET', src),
      refetchInterval: refreshMs,
    })),
  });
  const bySource: Record<string, any> = {};
  sources.forEach((src, i) => { bySource[src] = results[i]; });

  const [pending, setPending] = useState<{ action: Action; row?: any } | null>(null);
  const [resultView, setResultView] = useState<{ title: string; data: any } | null>(null);
  const [form] = Form.useForm();

  const run = useMutation({
    mutationFn: ({ action, vars }: { action: Action; vars: Record<string, any> }) => {
      const method = (action.method || 'POST').toUpperCase();
      const body = action.body !== undefined ? fill(action.body, vars) : method === 'GET' || method === 'DELETE' ? undefined : {};
      return extCall(method, fill(action.endpoint, vars, true), body);
    },
    onSuccess: (data, { action }) => {
      if ((action.method || 'POST').toUpperCase() === 'GET') setResultView({ title: action.label, data });
      else message.success(`${action.label}: done`);
      setPending(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['ext', id] });
    },
    onError: (e: any) => message.error(e.message),
  });

  const trigger = (action: Action, row?: any) => {
    if (action.fields?.length) {
      setPending({ action, row });
      return;
    }
    const vars = { ...(row || {}) };
    if (action.confirm) {
      Modal.confirm({
        title: fill(action.confirm, vars),
        okButtonProps: { danger: !!action.danger },
        onOk: () => run.mutateAsync({ action, vars }),
      });
    } else {
      run.mutate({ action, vars });
    }
  };

  if (extensions.isLoading) return <Card loading />;
  if (!ext) return <Empty style={{ marginTop: 48 }} description={`Module page '${id}' is not available (module not loaded in s3mmws)`} />;

  const renderSection = (s: Section, idx: number) => {
    const q = s.source ? bySource[s.source] : null;
    const data = q?.data !== undefined ? pick(q.data, s.path) : undefined;
    const error = q?.error ? <Typography.Text type="danger">{(q.error as Error).message}</Typography.Text> : null;
    if (s.type === 'kv') {
      const fields = s.fields || Object.keys(data || {}).map((k) => ({ key: k, title: k }));
      return (
        <Card key={idx} size="small" title={s.title} loading={q?.isLoading}>
          {error || (
            <Descriptions size="small" column={{ xs: 1, md: 2, xl: 3 }}>
              {fields.map((f) => <Descriptions.Item key={f.key} label={f.title || f.key}>{renderValue(data?.[f.key], f.type)}</Descriptions.Item>)}
            </Descriptions>
          )}
        </Card>
      );
    }
    if (s.type === 'table') {
      const columns: any[] = (s.columns || []).map((c) => ({
        title: c.title || c.key,
        dataIndex: c.key,
        render: (v: any) => renderValue(v, c.type),
      }));
      if (s.rowActions?.length) {
        columns.push({
          title: '',
          key: '__actions',
          align: 'right',
          render: (_: any, row: any) => (
            <Space size={4}>
              {s.rowActions!.map((a) => (
                <Button key={a.label} size="small" danger={!!a.danger} onClick={() => trigger(a, row)}>{a.label}</Button>
              ))}
            </Space>
          ),
        });
      }
      return (
        <Card key={idx} size="small" title={s.title}>
          {error || (
            <Table
              size="small"
              rowKey={(r: any) => String(r?.[s.rowKey || 'id'] ?? JSON.stringify(r))}
              loading={q?.isLoading}
              dataSource={Array.isArray(data) ? data : []}
              columns={columns}
              pagination={false}
            />
          )}
        </Card>
      );
    }
    if (s.type === 'actions') {
      return (
        <Card key={idx} size="small" title={s.title}>
          <Space wrap>
            {(s.actions || []).map((a) => (
              <Button key={a.label} danger={!!a.danger} onClick={() => trigger(a)} loading={run.isPending && run.variables?.action === a}>{a.label}</Button>
            ))}
          </Space>
        </Card>
      );
    }
    return (
      <Card key={idx} size="small" title={s.title} loading={q?.isLoading}>
        {error || <pre style={{ margin: 0, maxHeight: 400, overflow: 'auto' }}>{JSON.stringify(data, null, 2)}</pre>}
      </Card>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }} align="baseline">
        <Typography.Title level={3} style={{ margin: 0 }}>{ext.title || ext.id}</Typography.Title>
        <Typography.Text type="secondary">module {ext.module}</Typography.Text>
        <Button size="small" onClick={() => queryClient.invalidateQueries({ queryKey: ['ext', id] })}>Refresh</Button>
      </Space>
      <Space orientation="vertical" style={{ width: '100%' }} size={16}>
        {sections.map(renderSection)}
      </Space>

      <Modal
        title={pending?.action.label}
        open={!!pending}
        onCancel={() => { setPending(null); form.resetFields(); }}
        onOk={() => form.submit()}
        confirmLoading={run.isPending}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => pending && run.mutate({ action: pending.action, vars: { ...(pending.row || {}), ...values } })}
        >
          {(pending?.action.fields || []).map((f) => (
            <Form.Item
              key={f.name}
              name={f.name}
              label={f.label || f.name}
              rules={f.required ? [{ required: true }] : []}
              valuePropName={f.type === 'bool' ? 'checked' : 'value'}
            >
              {f.type === 'bool' ? <Switch /> : f.type === 'number' ? <InputNumber style={{ width: '100%' }} /> : <Input />}
            </Form.Item>
          ))}
        </Form>
      </Modal>

      <Modal title={resultView?.title} open={!!resultView} onCancel={() => setResultView(null)} footer={null} width={760}>
        <pre style={{ maxHeight: 500, overflow: 'auto' }}>{JSON.stringify(resultView?.data, null, 2)}</pre>
      </Modal>
    </div>
  );
}
