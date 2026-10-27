import { useState, useEffect } from 'react';
import { Button, Card, Form, Input, Select, Typography, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useUiStore } from '../store.js';
import { get, API_BASE } from '../api.js';

export default function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setAuth = useUiStore((s) => s.setAuth);
  const [providers, setProviders] = useState(['local']);
  const [provider, setProvider] = useState('local');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    get('/auth/providers').then((d) => {
      const names = (d || []).filter((p) => p.enabled).map((p: any) => p.name);
      if (names.length) { setProviders(names); setProvider(names[0]); }
    }).catch(() => {});
  }, []);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, username: values.username, password: values.password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) throw new Error(json.error || res.statusText);
      setAuth(json.token, json.user);
      queryClient.invalidateQueries();
      message.success('Signed in');
      navigate('/');
    } catch (e) {
      message.error(e.message || 'login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0f12' }}>
      <Card style={{ width: 360 }}>
        <Typography.Title level={3} style={{ textAlign: 'center' }}>s3mm</Typography.Title>
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item label="Provider">
            <Select value={provider} onChange={setProvider} options={providers.map((p: any) => ({ value: p, label: p }))} />
          </Form.Item>
          <Form.Item name="username" label="Username" rules={[{ required: true }]}>
            <Input autoFocus />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>Sign in</Button>
        </Form>
      </Card>
    </div>
  );
}
