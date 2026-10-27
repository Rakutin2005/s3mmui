import { Button, Space, Table, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { endpoints, rpc } from '../api.js';
import { inventoryAddress } from '../address.js';

export default function ReplicationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading, refetch } = useQuery<any>({ queryKey: ['replications'], queryFn: endpoints.replications });
  const clusters = useQuery<any>({ queryKey: ['clusters'], queryFn: endpoints.clusters });

  const remove = useMutation({
    mutationFn: (name: any) => rpc('rm', { kind: 'replication', name }),
    onSuccess: (_data: any, name: any) => {
      message.success('Replication removed');
      queryClient.invalidateQueries({ queryKey: ['replications'] });
      queryClient.removeQueries({ queryKey: ['replication', name] });
    },
    onError: (e) => message.error(e.message),
  });

  const scan = useMutation({
    mutationFn: (name: any) => rpc('scan', { replication: name, force: true }),
    onSuccess: (_data: any, name: any) => {
      message.success('Scan completed');
      queryClient.invalidateQueries({ queryKey: ['stats', name] });
      queryClient.invalidateQueries({ queryKey: ['queues', name] });
    },
    onError: (e) => message.error(e.message),
  });

  const columns = [
    { title: 'Name', dataIndex: 'name' },
    { title: 'Owner', dataIndex: '_owner', render: (v) => v || 'local' },
    { title: 'Source', dataIndex: 'source' },
    { title: 'Destination', dataIndex: 'destination' },
    { title: 'Address', key: 'address', render: (_: any, r: any) => <code>{inventoryAddress('replication', r, clusters.data || [])}</code> },
    { title: 'Policy', dataIndex: 'policy' },
    { title: 'Delete propagation', dataIndex: 'delete_propagation', render: (v) => String(v) },
    { title: 'Paused', dataIndex: 'paused', render: (v) => String(v) },
    {
      title: 'Actions',
      render: (_: any, record: any) => (
        // stop the click from also triggering the row's navigate()
        <Space onClick={(e) => e.stopPropagation()}>
          <Button icon={<PlayCircleOutlined />} loading={scan.isPending && scan.variables === record.name} onClick={() => scan.mutate(record.name)}>Scan</Button>
          <Button icon={<EditOutlined />} onClick={() => navigate(`/replications/${encodeURIComponent(record.name)}`)} />
          <Button danger icon={<DeleteOutlined />} onClick={() => remove.mutate(record.name)} />
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>Replications</h2>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/replications/new')}>
            Add replication
          </Button>
        </Space>
      </div>
      <Table onRow={(record: any) => ({ onClick: () => navigate(`/replications/${encodeURIComponent(record.name)}`) })} rowKey={(r: any) => `${r.name}@${r._owner || 'local'}`} loading={isLoading} dataSource={data || []} columns={columns} />
    </>
  );
}
