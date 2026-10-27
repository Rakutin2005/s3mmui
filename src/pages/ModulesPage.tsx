import { Table, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { endpoints } from '../api.js';

export default function ModulesPage() {
  const { data, isLoading } = useQuery<any>({ queryKey: ['modules'], queryFn: endpoints.modules });
  return (
    <div style={{ padding: 24 }}>
      <h2>Modules</h2>
      <Typography.Paragraph type="secondary">
        s3mmws modules configured with <code>module &lt;name&gt; {'{ ... }'}</code> in the s3mmws configuration.
        A module with a web page adds it to the navigation while it is loaded.
      </Typography.Paragraph>
      <Table rowKey={(r: any) => `${r.name}@${r._owner || 'local'}`} loading={isLoading} dataSource={Array.isArray(data) ? data : []} columns={[
        { title: 'Name', dataIndex: 'name' },
        { title: 'Version', dataIndex: 'version' },
        { title: 'Vendor', dataIndex: 'vendor' },
        {
          title: 'Web UI',
          dataIndex: 'ui',
          render: (ui: boolean, r: any) => (ui ? <Link to={`/ext/${encodeURIComponent(r.name)}`}>open page</Link> : <Tag>none</Tag>),
        },
      ]} />
    </div>
  );
}
