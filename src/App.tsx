import { Layout, Menu, Typography, Button, Space, Dropdown } from 'antd';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { VendorIcon } from './components/Icons.jsx';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DashboardOutlined,
  ClusterOutlined,
  CloudOutlined,
  DatabaseOutlined,
  LinkOutlined,
  MonitorOutlined,
  KeyOutlined,
  SyncOutlined,
  DeploymentUnitOutlined,
  SafetyOutlined,
  SettingOutlined,
  ApiOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BulbOutlined,
  BulbFilled,
} from '@ant-design/icons';

import { useUiStore } from './store.js';
import { endpoints } from './api.js';

import DashboardPage from './pages/DashboardPage.jsx';
import ClustersPage from './pages/ClustersPage.jsx';
import ClusterDetail from './pages/ClusterDetail.jsx';
import CredentialsPage from './pages/CredentialsPage.jsx';
import CredentialDetail from './pages/CredentialDetail.jsx';
import ReplicationsPage from './pages/ReplicationsPage.jsx';
import ReplicationDetail from './pages/ReplicationDetail.jsx';
import TargetsPage from './pages/TargetsPage.jsx';
import TargetDetail from './pages/TargetDetail.jsx';
import PoliciesPage from './pages/PoliciesPage.jsx';
import PolicyDetail from './pages/PolicyDetail.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import AccountsPage from './pages/AccountsPage.jsx';
import RbacPage from './pages/RbacPage.jsx';
import AuthSettingsPage from './pages/AuthSettingsPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ModulesPage from './pages/ModulesPage.jsx';
import ObjectBrowserPage from './pages/ObjectBrowserPage.jsx';
import ExtensionPage from './pages/ExtensionPage.jsx';
import { inventoryAddress } from './address.js';

const { Sider, Content } = Layout;

/// Icons a module may name in its UI extension ("icon").
const extensionIcons: Record<string, any> = {
  cluster: <ClusterOutlined />,
  api: <ApiOutlined />,
  cloud: <CloudOutlined />,
  database: <DatabaseOutlined />,
  link: <LinkOutlined />,
  monitor: <MonitorOutlined />,
  setting: <SettingOutlined />,
};

function statusColor(path, item) {
  if (path === '/replications') return item.paused ? '#faad14' : '#52c41a';
  if (path === '/clusters') {
    if ((item.endpoints || item.addr || []).length === 0) return '#ff4d4f';
    if (item.managed === false) return '#1890ff';
    return '#52c41a';
  }
  if (path === '/credentials') return item.has_secret ? '#52c41a' : '#faad14';
  return '#52c41a';
}

function makeEntityItem(path, item, icon, clusters: any[] = []) {
  let vendorIcon = null;
  if (path === '/clusters') {
    vendorIcon = <VendorIcon vendor={item.vendor || item.name || ''} size={12} />;
  }
  const address = inventoryAddress(path, item, clusters);
  return {
    key: `${path}/${item.name}@${item._owner || 'local'}`,
    icon: vendorIcon || icon,
    label: (
      <Link to={`${path}/${encodeURIComponent(item.name)}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor(path, item), flex: '0 0 auto' }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: '0 1 auto' }}>{item.name}</span>
        {address && (
          <span title={address} style={{ overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 11, opacity: 0.55, flex: '1 1 0', minWidth: 0 }}>
            {address}
          </span>
        )}
      </Link>
    ),
    className: 's3mm-inventory-entity',
  };
}

function entityItems(path, items, icon, clusters: any[] = []) {
  const list = items || [];
  const groups = {};
  list.forEach((item) => {
    const owner = item._owner || 'local';
    if (!groups[owner]) groups[owner] = [];
    groups[owner].push(item);
  });
  const owners = Object.keys(groups);
  if (owners.length <= 1) {
    return (owners.length ? groups[owners[0]] : []).map((item: any) => makeEntityItem(path, item, icon, clusters));
  }
  const out = [];
  owners.forEach((owner) => {
    out.push({ type: 'group', label: owner, children: groups[owner].map((item: any) => makeEntityItem(path, item, icon, clusters)) });
  });
  return out;
}

export default function App() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const { theme, toggleTheme, sidebarCollapsed, toggleSidebar, token, logout } = useUiStore();
  const embed = new URLSearchParams(location.search).get('embed') === '1';

  useEffect(() => {
    document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
    document.body.style.background = theme === 'dark' ? '#0d0f12' : '#f5f7fa';
  }, [theme]);

  const authProbe = useQuery<any>({ queryKey: ['auth-probe', token], queryFn: endpoints.clusters, retry: false, refetchInterval: false });
  // Inventory loads once the API answers: with a session token, or without one when s3mmws runs with auth disabled.
  const authed = !!token || authProbe.isSuccess;
  const clusters = useQuery<any>({ queryKey: ['clusters'], queryFn: endpoints.clusters, refetchInterval: 10000, enabled: authed });
  const credentials = useQuery<any>({ queryKey: ['credentials'], queryFn: endpoints.credentials, refetchInterval: 10000, enabled: authed });
  const replications = useQuery<any>({ queryKey: ['replications'], queryFn: endpoints.replications, refetchInterval: 10000, enabled: authed });
  const targets = useQuery<any>({ queryKey: ['targets'], queryFn: endpoints.targets, refetchInterval: 10000, enabled: authed });
  const policies = useQuery<any>({ queryKey: ['policies'], queryFn: endpoints.policies, refetchInterval: 10000, enabled: authed });
  const extensions = useQuery<any>({ queryKey: ['ui-extensions'], queryFn: endpoints.extensions, refetchInterval: 30000, enabled: authed });
  const needsLogin = !token && authProbe.isError && /unauthorized/i.test(authProbe.error?.message || '');
  const sessionExpired = !!token && authProbe.isError && /unauthorized/i.test(authProbe.error?.message || '');

  useEffect(() => {
    if (!sessionExpired) return;
    logout();
    queryClient.clear();
  }, [sessionExpired, logout, queryClient]);

  if (embed) {
    return (
      <Routes>
        <Route path="/clusters/:name/browse" element={<ObjectBrowserPage />} />
        <Route path="/browser" element={<ObjectBrowserPage />} />
      </Routes>
    );
  }

  const selectedKeys = [location.pathname];
  const addEntityKeys = (data, path) => {
    const m = location.pathname.match(new RegExp('^' + path.replace('/', '\\/') + '/([^/]+)$'));
    if (!m) return;
    const name = decodeURIComponent(m[1]);
    (data || []).filter((d) => d.name === name).forEach((item) => {
      selectedKeys.push(`${path}/${name}@${item._owner || 'local'}`);
    });
  };
  [['/clusters', clusters.data], ['/credentials', credentials.data], ['/replications', replications.data], ['/targets', targets.data], ['/policies', policies.data]].forEach(([path, data]) => {
    addEntityKeys(data, path);
  });

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, title: 'Dashboard', label: <Link to="/">Dashboard</Link> },
    {
      key: 'clusters',
      icon: <ClusterOutlined />,
      label: <Link to="/clusters">Clusters</Link>,
      children: [
        ...entityItems('/clusters', clusters.data, <ClusterOutlined />),
        { key: 'clusters-add', icon: <ClusterOutlined />, label: <Link to="/clusters/new">+ add cluster</Link>, className: 's3mm-inventory-add' },
      ],
    },
    {
      key: 'credentials',
      icon: <KeyOutlined />,
      label: <Link to="/credentials">Credentials</Link>,
      children: [
        ...entityItems('/credentials', credentials.data, <KeyOutlined />),
        { key: 'credentials-add', icon: <KeyOutlined />, label: <Link to="/credentials/new">+ add credential</Link>, className: 's3mm-inventory-add' },
      ],
    },
    {
      key: 'replications',
      icon: <SyncOutlined />,
      label: <Link to="/replications">Replications</Link>,
      children: [
        ...entityItems('/replications', replications.data, <SyncOutlined />, clusters.data || []),
        { key: 'replications-add', icon: <SyncOutlined />, label: <Link to="/replications/new">+ add replication</Link>, className: 's3mm-inventory-add' },
      ],
    },
    {
      key: 'targets',
      icon: <DeploymentUnitOutlined />,
      label: <Link to="/targets">Targets</Link>,
      children: [
        ...entityItems('/targets', targets.data, <DeploymentUnitOutlined />),
        { key: 'targets-add', icon: <DeploymentUnitOutlined />, label: <Link to="/targets/new">+ add target</Link>, className: 's3mm-inventory-add' },
      ],
    },
    {
      key: 'policies',
      icon: <SafetyOutlined />,
      label: <Link to="/policies">Policies</Link>,
      children: [
        ...entityItems('/policies', policies.data, <SafetyOutlined />),
        { key: 'policies-add', icon: <SafetyOutlined />, label: <Link to="/policies/new">+ add policy</Link>, className: 's3mm-inventory-add' },
      ],
    },
    { key: '/settings', icon: <SettingOutlined />, title: 'Settings', label: <Link to="/settings">Settings</Link> },
    { key: '/accounts', icon: <UserOutlined />, title: 'Accounts', label: <Link to="/accounts">Accounts</Link> },
    { key: '/rbac', icon: <UserOutlined />, title: 'RBAC', label: <Link to="/rbac">RBAC</Link> },
    // Pages contributed by the s3mmws modules that are loaded right now.
    ...(Array.isArray(extensions.data) ? extensions.data : []).map((ext: any) => ({
      key: `/ext/${ext.id}`,
      icon: extensionIcons[ext.icon] || <ApiOutlined />,
      title: ext.title || ext.id,
      label: <Link to={`/ext/${encodeURIComponent(ext.id)}`}>{ext.title || ext.id}</Link>,
    })),
    { key: '/modules', icon: <ApiOutlined />, title: 'Modules', label: <Link to="/modules">Modules</Link> },
  ];

  if (needsLogin) {
    return <LoginPage />;
  }
  if (sessionExpired) {
    return <LoginPage />;
  }
  return (
    <Layout className="s3mm-shell" style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={sidebarCollapsed}
        onCollapse={toggleSidebar}
        trigger={null}
        width={250}
        collapsedWidth={72}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          height: '100vh',
          overflow: 'auto',
          zIndex: 1000,
          background: theme === 'dark' ? '#111318' : '#f7f8fa',
          boxShadow: theme === 'dark' ? '4px 0 24px rgba(0,0,0,0.35)' : '4px 0 24px rgba(15,23,42,0.08)',
        }}
      >
        <div style={{ height: 52, display: 'flex', alignItems: 'center', padding: '0 16px', fontWeight: 700, fontSize: 18 }}>
          s3mm
        </div>
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <Menu
            mode="inline"
            theme={theme === 'dark' ? 'dark' : 'light'}
            selectedKeys={selectedKeys}
            defaultOpenKeys={['clusters', 'credentials', 'replications', 'targets', 'policies']}
            items={menuItems}
            style={{ borderInlineEnd: 'none', background: 'transparent' }}
          />
        </div>
        <div style={{ flex: '0 0 auto', padding: 8, textAlign: 'center', background: theme === 'dark' ? '#111318' : '#f7f8fa', borderTop: `1px solid ${theme === 'dark' ? '#262626' : '#e8e8e8'}` }}>
          <Button type="text" icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={toggleSidebar} />
        </div>
      </Sider>
      <Layout style={{ marginLeft: sidebarCollapsed ? 72 : 250, background: theme === 'dark' ? '#0d0f12' : '#ffffff', minHeight: '100vh' }}>
        <header style={{
          height: 52,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          background: theme === 'dark' ? '#111318' : '#ffffff',
          borderBottom: `1px solid ${theme === 'dark' ? '#262626' : '#e8e8e8'}`,
        }}>
          <Typography.Text strong>s3mm control plane</Typography.Text>
          <Space>
            <Button type="text" icon={theme === 'dark' ? <BulbOutlined /> : <BulbFilled />} onClick={toggleTheme}>
              {theme === 'dark' ? 'Light' : 'Dark'}
            </Button>
            {token && <Button type="text" onClick={() => { logout(); queryClient.clear(); }}>Logout</Button>}
            <Dropdown menu={{ items: [{ key: 'about', label: 's3mm management UI' }] }}>
              <Button type="text">Help</Button>
            </Dropdown>
          </Space>
        </header>
        <Content>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/clusters" element={<ClustersPage />} />
            <Route path="/clusters/:name" element={<ClusterDetail />} />
            <Route path="/clusters/:name/browse" element={<ObjectBrowserPage />} />
            <Route path="/credentials" element={<CredentialsPage />} />
            <Route path="/credentials/:name" element={<CredentialDetail />} />
            <Route path="/replications" element={<ReplicationsPage />} />
            <Route path="/replications/:name" element={<ReplicationDetail />} />
            <Route path="/targets" element={<TargetsPage />} />
            <Route path="/targets/:name" element={<TargetDetail />} />
            <Route path="/policies" element={<PoliciesPage />} />
            <Route path="/policies/:name" element={<PolicyDetail />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/rbac" element={<RbacPage />} />
            <Route path="/auth-settings" element={<AuthSettingsPage />} />
            <Route path="/modules" element={<ModulesPage />} />
            <Route path="/browser" element={<ObjectBrowserPage />} />
            <Route path="/ext/:id" element={<ExtensionPage />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}
