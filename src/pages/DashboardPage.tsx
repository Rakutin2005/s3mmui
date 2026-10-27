import { Card, Col, Row, Statistic, Table, Tag, Typography, Badge, Space, Tooltip } from 'antd';
import { ClusterOutlined, SyncOutlined, WarningOutlined, CheckCircleOutlined, SafetyOutlined, LinkOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { endpoints } from '../api.js';
import { Link, useNavigate } from 'react-router-dom';
import { VendorIcon } from '../components/Icons.jsx';
import ReactFlow, { Background, Controls, MiniMap, MarkerType, EdgeLabelRenderer, getBezierPath, useNodesState, useEdgesState } from 'reactflow';
import 'reactflow/dist/style.css';
import { useMemo, useState } from 'react';

function CustomEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd }) {
  const navigate = useNavigate();
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.4,
  });

  return (
    <>
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
        style={{ 
          stroke: data.paused ? '#faad14' : '#52c41a', 
          strokeWidth: 2.5, 
          strokeDasharray: data.paused ? '6,6' : 'none',
          opacity: 0.8
        }}
      />
      <EdgeLabelRenderer>
        <Tooltip
          title={
            <div>
              <div><strong>Replication:</strong> {data.name}</div>
              <div><strong>Policy:</strong> {data.policy || '—'}</div>
              <div><strong>Source:</strong> {data.source}</div>
              <div><strong>Destination:</strong> {data.destination}</div>
              <div><strong>Rules:</strong> {data.ruleCount}</div>
              <div><strong>Status:</strong> {data.paused ? 'Paused' : 'Active'}</div>
            </div>
          }
          placement="top"
        >
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              background: 'var(--ant-color-bg-elevated)',
              padding: '6px 10px',
              borderRadius: 8,
              border: `2px solid ${data.paused ? '#faad14' : '#52c41a'}`,
              fontSize: 11,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              zIndex: 1000,
              whiteSpace: 'nowrap',
            }}
            className="nodrag nopan"
            onClick={() => navigate(`/replications/${encodeURIComponent(data.name)}`)}
          >
            <div style={{ fontWeight: 600, color: 'var(--ant-color-text)' }}>{data.name}</div>
            <div style={{ color: 'var(--ant-color-text-secondary)', fontSize: 10 }}>
              {data.policy ? `Policy: ${data.policy}` : `${data.ruleCount} rule${data.ruleCount !== 1 ? 's' : ''}`}
            </div>
          </div>
        </Tooltip>
      </EdgeLabelRenderer>
    </>
  );
}

const edgeTypes = {
  custom: CustomEdge,
};

export default function DashboardPage() {
  const clusters = useQuery<any>({ queryKey: ['clusters'], queryFn: endpoints.clusters, refetchInterval: 10000 });
  const replications = useQuery<any>({ queryKey: ['replications'], queryFn: endpoints.replications, refetchInterval: 10000 });
  const credentials = useQuery<any>({ queryKey: ['credentials'], queryFn: endpoints.credentials, refetchInterval: 10000 });
  const policies = useQuery<any>({ queryKey: ['policies'], queryFn: endpoints.policies, refetchInterval: 10000 });

  // memoised so the topology below is only rebuilt when the data really changes
  const clusterList = useMemo(() => clusters.data || [], [clusters.data]);
  const repList = useMemo(() => replications.data || [], [replications.data]);
  // replications carry only the policy name; the rule count lives on the policy bundle
  const ruleCountOf = useMemo(() => {
    const byName = new Map((policies.data || []).map((p: any) => [p.name, p.rules || 0]));
    return (rep) => Number(byName.get(rep.policy) || 0);
  }, [policies.data]);

  const activeReps = repList.filter((r) => !r.paused).length;
  const pausedReps = repList.filter((r) => r.paused).length;
  const healthyClusters = clusterList.filter((c) => (c.endpoints || c.addr || []).length > 0).length;

  const getStatusTag = (rep) => {
    if (rep.paused) return <Tag color="orange">Paused</Tag>;
    return <Tag color="green">Active</Tag>;
  };

  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes = [];
    const edges = [];
    
    clusterList.forEach((cluster, idx) => {
      const x = 250 + (idx % 4) * 320;
      const y = 120 + Math.floor(idx / 4) * 200;
      nodes.push({
        id: `cluster-${cluster.name}`,
        type: 'default',
        position: { x, y },
        data: {
          label: (
            <div style={{ padding: '12px 16px', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
                <VendorIcon vendor={cluster.vendor || cluster.name} size={22} />
                <Typography.Text strong style={{ fontSize: 15 }}>{cluster.name}</Typography.Text>
              </div>
              <div style={{ fontSize: 11, color: 'var(--ant-color-text-secondary)', marginBottom: 4, maxWidth: 200 }}>
                {(cluster.endpoints || cluster.addr || []).map((ep, i) => (
                  <div key={i} style={{ wordBreak: 'break-all', lineHeight: 1.3 }}>{ep}</div>
                ))}
              </div>
              <Tag color={(cluster.endpoints || cluster.addr || []).length ? 'green' : 'red'} style={{ fontSize: 10 }}>
                {(cluster.endpoints || cluster.addr || []).length ? 'Online' : 'Offline'}
              </Tag>
            </div>
          ),
        },
        style: {
          background: 'var(--ant-color-bg-container)',
          border: '3px solid var(--ant-color-primary)',
          borderRadius: 14,
          width: 260,
          boxShadow: '0 6px 20px rgba(24,144,255,0.2)',
          zIndex: 10,
        },
      });
    });

    repList.forEach((rep) => {
      const sourceId = `cluster-${rep.source}`;
      const destId = `cluster-${rep.destination}`;
      if (!nodes.find(n => n.id === sourceId) || !nodes.find(n => n.id === destId)) return;
      
      const ruleCount = ruleCountOf(rep);
      edges.push({
        id: `edge-${rep.name}`,
        source: sourceId,
        target: destId,
        type: 'custom',
        data: {
          name: rep.name,
          policy: rep.policy,
          source: rep.source,
          destination: rep.destination,
          ruleCount: ruleCount,
          paused: rep.paused,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: rep.paused ? '#faad14' : '#52c41a',
        },
        animated: !rep.paused,
        zIndex: 0,
      });
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [clusterList, repList, ruleCountOf]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  // useNodesState only takes the initial value: follow data that arrives later
  // (otherwise the graph stays empty after the first, still-loading render).
  const [shown, setShown] = useState({ initialNodes, initialEdges });
  if (shown.initialNodes !== initialNodes || shown.initialEdges !== initialEdges) {
    setShown({ initialNodes, initialEdges });
    setNodes(initialNodes);
    setEdges(initialEdges);
  }

  return (
    <div style={{ padding: 24 }}>
      <Typography.Title level={3} style={{ marginBottom: 24 }}>Dashboard</Typography.Title>
      
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Clusters"
              value={clusterList.length}
              prefix={<ClusterOutlined />}
              suffix={<Tag color={healthyClusters === clusterList.length ? 'green' : 'orange'}>{healthyClusters} healthy</Tag>}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Replications"
              value={repList.length}
              prefix={<SyncOutlined />}
              suffix={<Tag color="green">{activeReps} active</Tag>}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Credentials"
              value={credentials.data?.length || 0}
              prefix={<SafetyOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Policies"
              value={policies.data?.length || 0}
              prefix={<SafetyOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24}>
          <Card 
            title={
              <Space>
                <LinkOutlined />
                <span>Replication Topology</span>
                <Badge count={repList.length} showZero color="blue" />
              </Space>
            } 
            extra={<Link to="/replications">View all replications</Link>}
          >
            <div style={{ height: 500, width: '100%', position: 'relative' }}>
              {nodes.length > 0 ? (
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  edgeTypes={edgeTypes as any}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  fitView
                  fitViewOptions={{ padding: 0.3 }}
                  attributionPosition="bottom-left"
                  defaultEdgeOptions={{ zIndex: 0 }}
                >
                  <Background color="#aaa" gap={24} />
                  <Controls />
                  <MiniMap 
                    nodeColor={(node) => {
                      return node.id.includes('cluster') ? '#1890ff' : '#52c41a';
                    }}
                    maskColor="rgba(0,0,0,0.1)"
                    style={{ height: 80 }}
                  />
                </ReactFlow>
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ant-color-text-secondary)' }}>
                  No clusters or replications configured
                </div>
              )}
            </div>
            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
              <Col xs={12} sm={6}>
                <Statistic title="Active" value={activeReps} styles={{ content: { color: "#52c41a" } }} prefix={<CheckCircleOutlined />} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title="Paused" value={pausedReps} styles={{ content: { color: "#faad14" } }} prefix={<WarningOutlined />} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title="Total Rules" value={(policies.data || []).reduce((sum, p) => sum + (Number(p.rules) || 0), 0)} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title="Connections" value={repList.length} />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Clusters" extra={<Link to="/clusters">Manage</Link>}>
            <Table
              dataSource={clusterList}
              rowKey={(r: any) => `${r.name}@${r._owner || 'local'}`}
              pagination={false}
              size="small"
              columns={[
                {
                  title: '',
                  width: 40,
                  render: (_: any, record: any) => <VendorIcon vendor={record.vendor || record.name} size={16} />,
                },
                {
                  title: 'Name',
                  dataIndex: 'name',
                  render: (v) => <Link to={`/clusters/${v}`}>{v}</Link>,
                },
                { 
                  title: 'Endpoints', 
                  dataIndex: 'addr',
                  render: (v) => (v || []).length ? (v || []).join(', ') : '—',
                },
                {
                  title: 'Status',
                  render: (_: any, record: any) => (
                    <Tag color={(record.endpoints || record.addr || []).length ? 'green' : 'red'}>
                      {(record.endpoints || record.addr || []).length ? 'Online' : 'Offline'}
                    </Tag>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Recent Replications" extra={<Link to="/replications">All</Link>}>
            <Table
              dataSource={repList.slice(0, 10)}
              rowKey={(r: any) => `${r.name}@${r._owner || 'local'}`}
              pagination={false}
              size="small"
              columns={[
                {
                  title: 'Name',
                  dataIndex: 'name',
                  render: (v) => <Link to={`/replications/${v}`}>{v}</Link>,
                },
                { 
                  title: 'Route', 
                  render: (_: any, record: any) => (
                    <Space size={4}>
                      <Tag>{record.source}</Tag>
                      <span>→</span>
                      <Tag>{record.destination}</Tag>
                    </Space>
                  ),
                },
                { 
                  title: 'Policy', 
                  dataIndex: 'policy',
                  render: (v) => v || '—',
                },
                { 
                  title: 'Rules', 
                  render: (_: any, record: any) => ruleCountOf(record),
                },
                {
                  title: 'Status',
                  render: (_: any, record: any) => getStatusTag(record),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
