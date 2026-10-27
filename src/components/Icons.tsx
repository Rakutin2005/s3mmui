import {
  ApiOutlined,
  BugOutlined,
  CloudOutlined,
  ClusterOutlined,
  DatabaseOutlined,
  HomeOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';

function getVendorIcon(vendor = '', size = 16) {
  const v = String(vendor || '').toLowerCase();
  if (v.includes('minio')) {
    return <DatabaseOutlined style={{ color: '#C72E49', fontSize: size }} />;
  }
  if (v.includes('rustfs')) {
    return <ClusterOutlined style={{ color: '#22c55e', fontSize: size }} />;
  }
  if (v.includes('aws') || v.includes('amazon')) {
    return <CloudOutlined style={{ color: '#FF9900', fontSize: size }} />;
  }
  if (v.includes('google') || v.includes('gcs') || v.includes('gcp')) {
    return <CloudOutlined style={{ color: '#4285F4', fontSize: size }} />;
  }
  if (v.includes('garage')) {
    return <HomeOutlined style={{ color: '#8b5cf6', fontSize: size }} />;
  }
  if (v.includes('ceph')) {
    return <BugOutlined style={{ color: '#E94E1B', fontSize: size }} />;
  }
  if (v.includes('seaweed')) {
    return <ApartmentOutlined style={{ color: '#10b981', fontSize: size }} />;
  }
  return <ApiOutlined style={{ fontSize: size }} />;
}

export function VendorIcon({ vendor, size = 16 }: { vendor?: string; size?: number }) {
  return getVendorIcon(vendor, size);
}
