import { useState } from 'react';
import { Button, Card, Form, Input, Modal, Select, Space, Table, Tabs, Typography, message } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rbac } from '../api.js';

export default function RbacPage() {
  const qc = useQueryClient();
  const [aclRT, setAclRT] = useState('clusters');
  const [aclRID, setAclRID] = useState('');
  const users = useQuery<any>({ queryKey: ['rbac-users'], queryFn: rbac.users });
  const roles = useQuery<any>({ queryKey: ['rbac-roles'], queryFn: rbac.roles });
  const perms = useQuery<any>({ queryKey: ['rbac-perms'], queryFn: rbac.permissions });
  const bindings = useQuery<any>({ queryKey: ['rbac-bindings'], queryFn: rbac.bindings });
  const acls = useQuery<any>({ queryKey: ['acls', aclRT, aclRID], queryFn: () => rbac.listAcl(aclRT, aclRID) });

  const [userModal, setUserModal] = useState(false);
  const [roleModal, setRoleModal] = useState(false);
  const [bindModal, setBindModal] = useState(false);
  const [aclModal, setAclModal] = useState(false);
  const [aclForm] = Form.useForm();
  const [form] = Form.useForm();
  const [rform] = Form.useForm();
  const [bform] = Form.useForm();

  const createUser = useMutation({
    mutationFn: rbac.createUser,
    onSuccess: () => { message.success('user created'); qc.invalidateQueries({ queryKey: ['rbac-users'] }); setUserModal(false); form.resetFields(); },
    onError: (e) => message.error(e.message),
  });
  const deleteUser = useMutation({
    mutationFn: rbac.deleteUser,
    onSuccess: () => { message.success('deleted'); qc.invalidateQueries({ queryKey: ['rbac-users'] }); },
    onError: (e) => message.error(e.message),
  });
  const createRole = useMutation({
    mutationFn: rbac.createRole,
    onSuccess: () => { message.success('role created'); qc.invalidateQueries({ queryKey: ['rbac-roles'] }); setRoleModal(false); rform.resetFields(); },
    onError: (e) => message.error(e.message),
  });
  const deleteRole = useMutation({
    mutationFn: rbac.deleteRole,
    onSuccess: () => { message.success('deleted'); qc.invalidateQueries({ queryKey: ['rbac-roles'] }); },
    onError: (e) => message.error(e.message),
  });
  const createBinding = useMutation({
    mutationFn: rbac.createBinding,
    onSuccess: () => { message.success('binding created'); qc.invalidateQueries({ queryKey: ['rbac-bindings'] }); setBindModal(false); bform.resetFields(); },
    onError: (e) => message.error(e.message),
  });
  const setAcl = useMutation({
    mutationFn: rbac.setAcl,
    onSuccess: () => { message.success('acl saved'); qc.invalidateQueries({ queryKey: ['acls'] }); setAclModal(false); aclForm.resetFields(); },
    onError: (e) => message.error(e.message),
  });
  const deleteAcl = useMutation({
    mutationFn: rbac.deleteAcl,
    onSuccess: () => { message.success('deleted'); qc.invalidateQueries({ queryKey: ['acls'] }); },
    onError: (e) => message.error(e.message),
  });
  const deleteBinding = useMutation({
    mutationFn: rbac.deleteBinding,
    onSuccess: () => { message.success('deleted'); qc.invalidateQueries({ queryKey: ['rbac-bindings'] }); },
    onError: (e) => message.error(e.message),
  });

  return (
    <>
      <Typography.Title level={3}>RBAC</Typography.Title>
      <Tabs items={[
        {
          key: 'users', label: 'Users',
          children: (
            <Card extra={<Button type="primary" onClick={() => setUserModal(true)}>+ add user</Button>}>
              <Table rowKey="id" dataSource={users.data || []} columns={[
                { title: 'ID', dataIndex: 'id' },
                { title: 'Username', dataIndex: 'username' },
                { title: 'Display name', dataIndex: 'display_name' },
                { title: 'Provider', dataIndex: 'provider' },
                { title: 'Roles', dataIndex: 'role_ids', render: (v) => (v || []).join(', ') },
                { title: '', render: (_: any, r: any) => <Button danger size="small" onClick={() => deleteUser.mutate(r.id)}>Delete</Button> },
              ]} />
            </Card>
          ),
        },
        {
          key: 'roles', label: 'Roles',
          children: (
            <Card extra={<Button type="primary" onClick={() => setRoleModal(true)}>+ add role</Button>}>
              <Table rowKey="id" dataSource={roles.data || []} columns={[
                { title: 'ID', dataIndex: 'id' },
                { title: 'Name', dataIndex: 'name' },
                { title: 'Description', dataIndex: 'description' },
                { title: 'Permissions', dataIndex: 'permission_ids', render: (v) => (v || []).length },
                { title: '', render: (_: any, r: any) => <Button danger size="small" onClick={() => deleteRole.mutate(r.id)}>Delete</Button> },
              ]} />
            </Card>
          ),
        },
        {
          key: 'permissions', label: 'Permissions',
          children: (
            <Card>
              <Table rowKey="id" dataSource={perms.data || []} columns={[
                { title: 'ID', dataIndex: 'id' },
                { title: 'Name', dataIndex: 'name' },
                { title: 'Description', dataIndex: 'description' },
              ]} />
            </Card>
          ),
        },
        {
          key: 'bindings', label: 'Bindings',
          children: (
            <Card extra={<Button type="primary" onClick={() => setBindModal(true)}>+ add binding</Button>}>
              <Table rowKey="id" dataSource={bindings.data || []} columns={[
                { title: 'ID', dataIndex: 'id' },
                { title: 'Subject', dataIndex: 'subject' },
                { title: 'Type', dataIndex: 'subject_type' },
                { title: 'Role', dataIndex: 'role_id' },
                { title: 'Scope', dataIndex: 'scope' },
                { title: '', render: (_: any, r: any) => <Button danger size="small" onClick={() => deleteBinding.mutate(r.id)}>Delete</Button> },
              ]} />
            </Card>
          ),
        },
        {
          key: 'acl', label: 'ACL',
          children: (
            <Card extra={<Button type="primary" onClick={() => setAclModal(true)}>+ add entry</Button>}>
              <Space style={{ marginBottom: 12 }}>
                <Select value={aclRT} onChange={setAclRT} options={[{value:'clusters',label:'clusters'},{value:'replications',label:'replications'},{value:'policies',label:'policies'},{value:'targets',label:'targets'},{value:'credentials',label:'credentials'}]} />
                <Input placeholder="resource id (name)" value={aclRID} onChange={(e)=>setAclRID(e.target.value)} style={{ width: 200 }} />
                <Button onClick={()=>qc.invalidateQueries({queryKey:['acls']})}>Load</Button>
              </Space>
              <Table rowKey="id" dataSource={acls.data || []} columns={[
                { title: 'ID', dataIndex: 'id' },
                { title: 'Subject', dataIndex: 'subject' },
                { title: 'Type', dataIndex: 'subject_type' },
                { title: 'Effect', dataIndex: 'effect' },
                { title: 'Actions', dataIndex: 'actions', render: (v)=>(v||[]).join(', ') },
                { title: '', render: (_: any, r: any) => <Button danger size="small" onClick={() => deleteAcl.mutate(r.id)}>Delete</Button> },
              ]} />
            </Card>
          ),
        },
      ]} />

      <Modal title="Add user" open={userModal} onCancel={() => setUserModal(false)} onOk={() => form.submit()} confirmLoading={createUser.isPending}>
        <Form form={form} layout="vertical" onFinish={(v) => createUser.mutate(v)}>
          <Form.Item name="username" label="Username" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="password" label="Password"><Input.Password /></Form.Item>
          <Form.Item name="display_name" label="Display name"><Input /></Form.Item>
          <Form.Item name="email" label="Email"><Input /></Form.Item>
          <Form.Item name="provider" label="Provider" initialValue="local"><Select options={[{value:'local',label:'local'},{value:'ldap',label:'ldap'},{value:'keycloak',label:'keycloak'}]} /></Form.Item>
          <Form.Item name="role_ids" label="Roles"><Select mode="multiple" options={(roles.data||[]).map(r=>({value:r.id,label:r.id}))} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="Add role" open={roleModal} onCancel={() => setRoleModal(false)} onOk={() => rform.submit()} confirmLoading={createRole.isPending}>
        <Form form={rform} layout="vertical" onFinish={(v) => createRole.mutate(v)}>
          <Form.Item name="id" label="ID" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="name" label="Name"><Input /></Form.Item>
          <Form.Item name="description" label="Description"><Input /></Form.Item>
          <Form.Item name="permission_ids" label="Permissions"><Select mode="multiple" options={(perms.data||[]).map(p=>({value:p.id,label:p.id}))} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="Add binding" open={bindModal} onCancel={() => setBindModal(false)} onOk={() => bform.submit()} confirmLoading={createBinding.isPending}>
        <Form form={bform} layout="vertical" onFinish={(v) => createBinding.mutate(v)}>
          <Form.Item name="subject" label="Subject (user id or group)" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="subject_type" label="Subject type" initialValue="user"><Select options={[{value:'user',label:'user'},{value:'group',label:'group'},{value:'role',label:'role'}]} /></Form.Item>
          <Form.Item name="role_id" label="Role" rules={[{ required: true }]}><Select options={(roles.data||[]).map(r=>({value:r.id,label:r.id}))} /></Form.Item>
          <Form.Item name="scope" label="Scope (optional)"><Input /></Form.Item>
        </Form>
      </Modal>

      <Modal title="Add ACL entry" open={aclModal} onCancel={() => setAclModal(false)} onOk={() => aclForm.submit()} confirmLoading={setAcl.isPending}>
        <Form form={aclForm} layout="vertical" onFinish={(v) => setAcl.mutate({ ...v, resource_type: aclRT, resource_id: aclRID })}>
          <Form.Item name="subject" label="Subject" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="subject_type" label="Subject type" initialValue="user"><Select options={[{value:'user',label:'user'},{value:'role',label:'role'},{value:'group',label:'group'}]} /></Form.Item>
          <Form.Item name="effect" label="Effect" initialValue="allow"><Select options={[{value:'allow',label:'allow'},{value:'deny',label:'deny'}]} /></Form.Item>
          <Form.Item name="actions" label="Actions" initialValue={['read']}><Select mode="multiple" options={[{value:'read',label:'read'},{value:'write',label:'write'},{value:'manage',label:'manage'}]} /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}
