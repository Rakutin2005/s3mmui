import { Button, Space, Table, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { endpoints, rpc } from '../api.js';
import { clusterAddress } from '../address.js';

export default function ClustersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading, refetch } = useQuery<any>({ queryKey: ['clusters'], queryFn: endpoints.clusters });

  const remove = useMutation({
    mutationFn: (name: any) => rpc('rm', { kind: 'cluster', name }),
    onSuccess: (_data: any, name: any) => {
      message.success('Cluster removed');
      queryClient.invalidateQueries({ queryKey: ['clusters'] });
      queryClient.removeQueries({ queryKey: ['cluster', name] });
    },
    onError: (e) => message.error(e.message),
  });

  const columns = [
    { title: 'Name', dataIndex: 'name' },
    { title: 'Address', key: 'address', render: (_: any, r: any) => <code>{clusterAddress(r)}</code> },
    { title: 'Owner', dataIndex: '_owner', render: (v) => v || 'local' },
    { title: 'Alias', dataIndex: 'alias' },
    { title: 'Managed', dataIndex: 'managed', render: (v) => (v === false ? 'no' : 'yes') },
    { title: 'Vendor', dataIndex: 'vendor' },
    { title: 'Endpoints', dataIndex: 'addr', render: (v) => (v || []).join(', ') },
    { title: 'Zone', dataIndex: 'zone' },
    {
      title: 'Actions',
      render: (_: any, record: any) => (
        // stop the click from also triggering the row's navigate()
        <Space onClick={(e) => e.stopPropagation()}>
          <Button icon={<EditOutlined />} onClick={() => navigate(`/clusters/${encodeURIComponent(record.name)}`)} />
          <Button danger icon={<DeleteOutlined />} onClick={() => remove.mutate(record.name)} />
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>Clusters</h2>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/clusters/new')}>
            Add cluster
          </Button>
        </Space>
      </div>
      <Table onRow={(record: any) => ({ onClick: () => navigate(`/clusters/${encodeURIComponent(record.name)}`) })} rowKey={(r: any) => `${r.name}@${r._owner || 'local'}`} loading={isLoading} dataSource={data || []} columns={columns} />
    </>
  );
}
