import { Button, Space, Table, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { endpoints, rpc } from '../api.js';

export default function CredentialsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading, refetch } = useQuery<any>({ queryKey: ['credentials'], queryFn: endpoints.credentials });

  const remove = useMutation({
    mutationFn: (name: any) => rpc('rm', { kind: 'credential', name }),
    onSuccess: (_data: any, name: any) => {
      message.success('Credential removed');
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
      queryClient.removeQueries({ queryKey: ['credential', name] });
    },
    onError: (e) => message.error(e.message),
  });

  const columns = [
    { title: 'Name', dataIndex: 'name' },
    { title: 'Owner', dataIndex: '_owner', render: (v) => v || 'local' },
    { title: 'Cluster', dataIndex: 'cluster' },
    { title: 'Access key', dataIndex: 'access_key' },
    { title: 'Region', dataIndex: 'region' },
    { title: 'Read only', dataIndex: 'read_only', render: (v) => String(v) },
    {
      title: 'Actions',
      render: (_: any, record: any) => (
        // stop the click from also triggering the row's navigate()
        <Space onClick={(e) => e.stopPropagation()}>
          <Button icon={<EditOutlined />} onClick={() => navigate(`/credentials/${encodeURIComponent(record.name)}`)} />
          <Button danger icon={<DeleteOutlined />} onClick={() => remove.mutate(record.name)} />
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>Credentials</h2>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/credentials/new')}>
            Add credential
          </Button>
        </Space>
      </div>
      <Table onRow={(record: any) => ({ onClick: () => navigate(`/credentials/${encodeURIComponent(record.name)}`) })} rowKey={(r: any) => `${r.name}@${r._owner || 'local'}`} loading={isLoading} dataSource={data || []} columns={columns} />
    </>
  );
}
