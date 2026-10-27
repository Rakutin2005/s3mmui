import { Button, Drawer, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, Tabs, Tag, Typography, message } from 'antd';
import { ArrowUpOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { browse, endpoints, objectBlob } from '../api.js';
import JsonEditor from '../components/JsonEditor.jsx';

function decodeBase64(base64) {
  try { return atob(base64); } catch { return ''; }
}

function extension(key) {
  const k = String(key || '').toLowerCase();
  const dot = k.lastIndexOf('.');
  return dot >= 0 ? k.slice(dot + 1) : '';
}

const AUDIO_TYPES: Record<string, string> = { mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', flac: 'audio/flac', m4a: 'audio/mp4', aac: 'audio/aac', opus: 'audio/ogg' };
const VIDEO_TYPES: Record<string, string> = { mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg', mov: 'video/quicktime' };
const IMAGE_TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp' };

/// 'image' | 'audio' | 'video' | null, by Content-Type first and by the key extension otherwise.
function mediaKind(contentType, key): 'image' | 'audio' | 'video' | null {
  const ct = String(contentType || '').toLowerCase();
  if (ct.startsWith('image/')) return 'image';
  if (ct.startsWith('audio/')) return 'audio';
  if (ct.startsWith('video/')) return 'video';
  const ext = extension(key);
  if (IMAGE_TYPES[ext]) return 'image';
  if (AUDIO_TYPES[ext]) return 'audio';
  if (VIDEO_TYPES[ext]) return 'video';
  return null;
}

/// MIME type usable by <audio>/<video>/<img> (objects are often stored as application/octet-stream).
function mediaMime(contentType, key) {
  const ct = String(contentType || '').toLowerCase();
  if (/^(image|audio|video)\//.test(ct)) return ct;
  const ext = extension(key);
  return IMAGE_TYPES[ext] || AUDIO_TYPES[ext] || VIDEO_TYPES[ext] || 'application/octet-stream';
}

const MEDIA_PREVIEW_LIMIT = 512 * 1024 * 1024;

function isJson(contentType, key) {
  return String(contentType || '').includes('json') || String(key || '').toLowerCase().endsWith('.json');
}

export default function ObjectBrowserPage() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const embed = searchParams.get('embed') === '1';
  const queryClient = useQueryClient();
  const [cluster, setCluster] = useState(params.name || searchParams.get('cluster') || '');
  const [bucket, setBucket] = useState('');
  const [prefix, setPrefix] = useState('');
  const [selectedKey, setSelectedKey] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [creatingBucket, setCreatingBucket] = useState(false);
  const [aclOpen, setAclOpen] = useState(false);
  const [form] = Form.useForm();
  const [uploadForm] = Form.useForm();
  const [renameForm] = Form.useForm();
  const [aclForm] = Form.useForm();
  const [bucketForm] = Form.useForm();
  const [fileBase64, setFileBase64] = useState('');

  const clusterList = useQuery<any>({ queryKey: ['clusters'], queryFn: endpoints.clusters });

  const buckets = useQuery<any>({ queryKey: ['browse-buckets', cluster], queryFn: () => browse.buckets(cluster), enabled: !!cluster });
  const objects = useQuery<any>({
    queryKey: ['browse-objects', cluster, bucket, prefix],
    queryFn: () => browse.objects(cluster, bucket, prefix),
    enabled: !!cluster && !!bucket,
  });
  const metadata = useQuery<any>({
    queryKey: ['browse-object', cluster, bucket, selectedKey],
    queryFn: () => browse.object(cluster, bucket, selectedKey),
    enabled: !!cluster && !!bucket && !!selectedKey,
  });
  const kind = selectedKey ? mediaKind(metadata.data?.content_type, selectedKey) : null;
  const tooBigForMedia = !!kind && Number(metadata.data?.size || 0) > MEDIA_PREVIEW_LIMIT;
  const content = useQuery<any>({
    queryKey: ['browse-content', cluster, bucket, selectedKey],
    queryFn: () => browse.objectContent(cluster, bucket, selectedKey),
    enabled: !!cluster && !!bucket && !!selectedKey && previewOpen && metadata.isSuccess && !kind,
  });
  // Images, audio and video are fetched whole as a Blob (with the session
  // token) and played from an object URL.
  const media = useQuery<any>({
    queryKey: ['browse-media', cluster, bucket, selectedKey],
    queryFn: async () => {
      const blob = await objectBlob(cluster, bucket, selectedKey);
      return new Blob([blob], { type: mediaMime(metadata.data?.content_type, selectedKey) });
    },
    enabled: !!cluster && !!bucket && !!selectedKey && previewOpen && !!kind && !tooBigForMedia,
    staleTime: Infinity,
    gcTime: 60000,
  });
  const [mediaUrl, setMediaUrl] = useState('');
  useEffect(() => {
    if (!media.data) { setMediaUrl(''); return undefined; }
    const url = URL.createObjectURL(media.data);
    setMediaUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [media.data]);

  // Fill the metadata form whenever another object's metadata arrives.
  useEffect(() => {
    if (!metadata.data) return;
    form.setFieldsValue({
      content_type: metadata.data.content_type,
      tags: JSON.stringify(metadata.data.tags || {}, null, 2),
      metadata: JSON.stringify(metadata.data.user_meta || {}, null, 2),
      replace_content: false,
      content: '',
    });
  }, [metadata.data, form]);

  const decodedContent = content.data?.content_base64 ? decodeBase64(content.data.content_base64) : '';

  const saveObject = useMutation({
    mutationFn: (values: any) => {
      let tags = {};
      let userMeta = {};
      try { tags = values.tags ? JSON.parse(values.tags) : {}; } catch { throw new Error('Invalid tags JSON'); }
      try { userMeta = values.metadata ? JSON.parse(values.metadata) : {}; } catch { throw new Error('Invalid metadata JSON'); }
      const payload: any = {
        content_type: values.content_type,
        tags,
        metadata: userMeta,
      };
      if (values.replace_content) payload.content = values.content || '';
      return browse.saveObject(cluster, bucket, selectedKey, payload);
    },
    onSuccess: () => {
      message.success('Object updated');
      queryClient.invalidateQueries({ queryKey: ['browse-objects', cluster, bucket, prefix] });
      queryClient.invalidateQueries({ queryKey: ['browse-object', cluster, bucket, selectedKey] });
      queryClient.invalidateQueries({ queryKey: ['browse-content', cluster, bucket, selectedKey] });
    },
    onError: (e) => message.error(e.message),
  });

  const uploadObject = useMutation({
    mutationFn: (values: any) => {
      let tags = {};
      let userMeta = {};
      try { tags = values.tags ? JSON.parse(values.tags) : {}; } catch { throw new Error('Invalid tags JSON'); }
      try { userMeta = values.metadata ? JSON.parse(values.metadata) : {}; } catch { throw new Error('Invalid metadata JSON'); }
      const payload: any = {
        content_type: values.content_type || 'application/octet-stream',
        tags,
        metadata: userMeta,
      };
      if (fileBase64) payload.content_base64 = fileBase64;
      else payload.content = values.content || '';
      return browse.saveObject(cluster, bucket, values.key, payload);
    },
    onSuccess: () => {
      message.success('Object uploaded');
      setUploading(false);
      setFileBase64('');
      uploadForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['browse-objects', cluster, bucket, prefix] });
    },
    onError: (e) => message.error(e.message),
  });

  const deleteObject = useMutation({
    mutationFn: (key: any) => browse.deleteObject(cluster, bucket, key),
    onSuccess: () => {
      message.success('Object deleted');
      queryClient.invalidateQueries({ queryKey: ['browse-objects', cluster, bucket, prefix] });
      if (selectedKey) { setSelectedKey(null); setPreviewOpen(false); }
    },
    onError: (e) => message.error(e.message),
  });

  const renameObject = useMutation({
    mutationFn: (values: any) => browse.renameObject(cluster, bucket, selectedKey, values.target),
    onSuccess: () => {
      message.success('Object renamed');
      setRenaming(false);
      renameForm.resetFields();
      setSelectedKey(null);
      setPreviewOpen(false);
      queryClient.invalidateQueries({ queryKey: ['browse-objects', cluster, bucket, prefix] });
    },
    onError: (e) => message.error(e.message),
  });

  const createBucket = useMutation({
    mutationFn: (values: any) => browse.createBucket(cluster, values.name),
    onSuccess: () => {
      message.success('Bucket created');
      setCreatingBucket(false);
      bucketForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['browse-buckets', cluster] });
    },
    onError: (e) => message.error(e.message),
  });

  const setAcl = useMutation({
    mutationFn: (values: any) => browse.setObjectAcl(cluster, bucket, selectedKey, values.acl),
    onSuccess: () => {
      message.success('ACL updated');
      setAclOpen(false);
    },
    onError: (e) => message.error(e.message),
  });

  const openPreview = (key) => {
    setSelectedKey(key);
    setPreviewOpen(true);
  };

  const goUp = () => {
    if (!prefix) return;
    const trimmed = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
    const parts = trimmed.split('/');
    parts.pop();
    setPrefix(parts.length ? `${parts.join('/')}/` : '');
  };

  const folders = (objects.data?.prefixes || []).map((p: any) => ({ key: `folder:${p}`, name: p, type: 'folder' }));
  const files = (objects.data?.objects || []).map((o: any) => ({ ...o, type: 'file' }));
  const rows = [...folders, ...files];

  const renderContent = () => {
    if (metadata.isLoading) return <Typography.Text type="secondary">Loading metadata...</Typography.Text>;
    if (kind) {
      if (tooBigForMedia) return <Typography.Text type="secondary">Object is larger than {MEDIA_PREVIEW_LIMIT / 1024 / 1024} MiB, preview disabled.</Typography.Text>;
      if (media.isLoading) return <Typography.Text type="secondary">Loading {kind}...</Typography.Text>;
      if (media.error) return <Typography.Text type="danger">{(media.error as Error).message}</Typography.Text>;
      if (!mediaUrl) return null;
      if (kind === 'image') return <img src={mediaUrl} alt={selectedKey} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />;
      if (kind === 'audio') {
        return (
          <div style={{ paddingTop: 24 }}>
            <audio key={mediaUrl} controls preload="metadata" src={mediaUrl} style={{ width: '100%' }}>
              Your browser cannot play this audio format.
            </audio>
          </div>
        );
      }
      return (
        <video key={mediaUrl} controls preload="metadata" src={mediaUrl} style={{ width: '100%', maxHeight: '100%', background: '#000' }}>
          Your browser cannot play this video format.
        </video>
      );
    }
    if (content.isLoading) return <Typography.Text type="secondary">Loading content...</Typography.Text>;
    if (content.error) return <Typography.Text type="danger">{(content.error as Error).message}</Typography.Text>;
    const contentType = content.data?.content_type || metadata.data?.content_type || '';
    const text = decodedContent || '';
    if (isJson(contentType, selectedKey)) {
      let pretty = text;
      try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch {}
      return <Input.TextArea value={pretty} readOnly style={{ fontFamily: 'monospace', height: '100%', resize: 'none' }} />;
    }
    return <Input.TextArea value={text} readOnly style={{ fontFamily: 'monospace', height: '100%', resize: 'none' }} />;
  };

  return (
    <div style={{ position: 'relative', height: '100%', minHeight: '100%', width: '100%', paddingLeft: embed ? 176 : 192, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <aside style={{
        width: embed ? 164 : 180,
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        overflow: 'auto',
        padding: embed ? '6px 6px 10px' : '8px 8px 12px',
        borderRight: '1px solid rgba(127,127,127,0.18)',
        background: 'inherit',
        zIndex: 5,
      }}>
        <Space orientation="vertical" style={{ width: '100%' }} size={4}>
          {!embed && (
            <Select
              style={{ width: '100%' }}
              placeholder="Cluster"
              value={cluster || undefined}
              onChange={(value) => { setCluster(value); setBucket(''); setPrefix(''); setSelectedKey(null); setPreviewOpen(false); }}
              options={(clusterList.data || []).map((c: any) => ({ value: c.name, label: c.name }))}
            />
          )}
          <div style={{ fontWeight: 600, fontSize: 11, opacity: 0.7 }}>Buckets</div>
          <Space orientation="vertical" style={{ width: '100%' }} size={1}>
            {(buckets.data || []).map((b: any) => (
              <Button
                key={b.name}
                type={bucket === b.name ? 'primary' : 'text'}
                size="small"
                style={{ width: '100%', textAlign: 'left', justifyContent: 'flex-start', height: 24, paddingInline: 6 }}
                onClick={() => { setBucket(b.name); setPrefix(''); setSelectedKey(null); setPreviewOpen(false); }}
              >
                {b.name}
              </Button>
            ))}
          </Space>
          <Button
            type="text"
            icon={<PlusOutlined />}
            onClick={() => setCreatingBucket(true)}
            disabled={!cluster}
            size="small"
            style={{
              width: '100%',
              textAlign: 'left',
              height: 24,
              paddingInline: 6,
              border: '1px dashed rgba(127,127,127,0.35)',
              borderRadius: 6,
              opacity: 0.72,
              justifyContent: 'flex-start',
            }}
          >
            Create bucket
          </Button>
          {bucket && (
            <>
              <div style={{ fontWeight: 600, fontSize: 11, opacity: 0.7, marginTop: 6 }}>Current prefix</div>
              <Tag color="blue" style={{ fontSize: 11 }}>/ {prefix || ''}</Tag>
            </>
          )}
        </Space>
      </aside>

      <section style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Space style={{ marginBottom: embed ? 8 : 12 }} wrap size={4}>
          <Input style={{ width: embed ? 200 : 260 }} size={embed ? 'small' : 'middle'} placeholder="Prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
          <Button icon={<ArrowUpOutlined />} size={embed ? 'small' : 'middle'} onClick={goUp} disabled={!prefix}>Up</Button>
          <Button icon={<ReloadOutlined />} size={embed ? 'small' : 'middle'} onClick={() => queryClient.invalidateQueries({ queryKey: ['browse-objects', cluster, bucket, prefix] })}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} size={embed ? 'small' : 'middle'} onClick={() => setUploading(true)} disabled={!cluster || !bucket}>Upload</Button>
        </Space>

        <div style={{ flex: 1, overflow: 'auto' }}>
          <Table
            rowKey="key"
            size={embed ? 'small' : 'small'}
            loading={objects.isLoading}
            dataSource={rows}
            scroll={{ x: 'max-content' }}
            pagination={false}
            columns={[
              {
                title: 'Name',
                key: 'name',
                render: (_: any, record: any) => {
                  const full = record.type === 'folder' ? record.name : record.key;
                  const shown = full.startsWith(prefix) ? full.slice(prefix.length) : full;
                  return (
                    <Typography.Link onClick={() => (record.type === 'folder' ? setPrefix(record.name) : openPreview(record.key))}>
                      {record.type === 'folder' ? `📁 ${shown}` : shown}
                    </Typography.Link>
                  );
                },
              },
              { title: 'Type', dataIndex: 'type', width: 70 },
              { title: 'Size', dataIndex: 'size', width: 80 },
              { title: 'Last modified', dataIndex: 'last_modified', width: 160 },
              { title: 'ETag', dataIndex: 'etag', width: 160, ellipsis: true },
              {
                title: 'Actions',
                fixed: 'right',
                width: 210,
                render: (_: any, record: any) => record.type === 'file' ? (
                  <Space size={2}>
                    <Button size="small" onClick={(e) => { e.stopPropagation(); openPreview(record.key); }}>Preview</Button>
                    <Button size="small" onClick={(e) => { e.stopPropagation(); setSelectedKey(record.key); setRenaming(true); renameForm.setFieldsValue({ target: record.key }); }}>Rename</Button>
                    <Button size="small" onClick={(e) => { e.stopPropagation(); setSelectedKey(record.key); setAclOpen(true); }}>ACL</Button>
                    <Popconfirm title={`Delete ${record.key}?`} okButtonProps={{ danger: true }} onConfirm={() => deleteObject.mutate(record.key)}>
                      <Button size="small" danger onClick={(e) => e.stopPropagation()}>Delete</Button>
                    </Popconfirm>
                  </Space>
                ) : (
                  <Button size="small" onClick={() => setPrefix(record.name)}>Open</Button>
                ),
              },
            ]}
          />
        </div>
      </section>

      <Drawer title={selectedKey} open={previewOpen} onClose={() => setPreviewOpen(false)} size={720}>
        <Tabs items={[
          {
            key: 'content',
            label: 'Content',
            children: (
              <div style={{ height: 'calc(100vh - 200px)' }}>
                {renderContent()}
              </div>
            ),
          },
          {
            key: 'metadata',
            label: 'Metadata',
            children: (
              <Form form={form} layout="vertical" onFinish={(values) => saveObject.mutate(values)}>
                <Form.Item name="content_type" label="Content-Type"><Input /></Form.Item>
                <Form.Item name="replace_content" valuePropName="checked" label="Replace content"><Switch /></Form.Item>
                <Form.Item name="content" label="Content"><Input.TextArea rows={6} /></Form.Item>
                <Form.Item name="tags" label="Tags"><JsonEditor /></Form.Item>
                <Form.Item name="metadata" label="User metadata"><JsonEditor /></Form.Item>
                <Button type="primary" htmlType="submit" loading={saveObject.isPending}>Save</Button>
              </Form>
            ),
          },
        ]} />
      </Drawer>

      <Modal title="Upload object" open={uploading} onCancel={() => setUploading(false)} onOk={() => uploadForm.submit()} confirmLoading={uploadObject.isPending} width={760}>
        <Form form={uploadForm} layout="vertical" onFinish={(values) => uploadObject.mutate(values)}>
          <Form.Item name="key" label="Key" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="content_type" label="Content-Type"><Input placeholder="text/plain" /></Form.Item>
          <Form.Item label="File">
            <Input type="file" onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) { setFileBase64(''); return; }
              const reader = new FileReader();
              reader.onload = () => {
                const result = String(reader.result || '');
                const base64 = result.includes(',') ? result.split(',')[1] : result;
                setFileBase64(base64);
                if (!uploadForm.getFieldValue('content_type')) uploadForm.setFieldValue('content_type', file.type || 'application/octet-stream');
              };
              reader.readAsDataURL(file);
            }} />
          </Form.Item>
          <Form.Item name="content" label="Text content (optional if file selected)"><Input.TextArea rows={6} /></Form.Item>
          <Form.Item name="tags" label="Tags"><JsonEditor /></Form.Item>
          <Form.Item name="metadata" label="User metadata"><JsonEditor /></Form.Item>
        </Form>
      </Modal>

      <Modal title={`Rename ${selectedKey}`} open={renaming} onCancel={() => setRenaming(false)} onOk={() => renameForm.submit()} confirmLoading={renameObject.isPending}>
        <Form form={renameForm} layout="vertical" onFinish={(values) => renameObject.mutate(values)}>
          <Form.Item name="target" label="New key" rules={[{ required: true }]}><Input /></Form.Item>
        </Form>
      </Modal>

      <Modal title="Create bucket" open={creatingBucket} onCancel={() => setCreatingBucket(false)} onOk={() => bucketForm.submit()} confirmLoading={createBucket.isPending}>
        <Form form={bucketForm} layout="vertical" onFinish={(values) => createBucket.mutate(values)}>
          <Form.Item name="name" label="Bucket name" rules={[{ required: true }]}><Input /></Form.Item>
        </Form>
      </Modal>

      <Modal title={`ACL for ${selectedKey}`} open={aclOpen} onCancel={() => setAclOpen(false)} onOk={() => aclForm.submit()} confirmLoading={setAcl.isPending}>
        <Form form={aclForm} layout="vertical" initialValues={{ acl: 'private' }} onFinish={(values) => setAcl.mutate(values)}>
          <Form.Item name="acl" label="Canned ACL">
            <Select options={[
              { value: 'private' },
              { value: 'public-read' },
              { value: 'public-read-write' },
              { value: 'authenticated-read' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
