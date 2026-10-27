import { Button, Form, Input, Switch, Tabs, message } from 'antd';
import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api.js';

export default function AuthSettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery<any>({ queryKey: ['auth-config'], queryFn: authApi.config });
  const [form] = Form.useForm();

  useEffect(() => {
    if (data) {
      form.setFieldsValue({
        local_enabled: data.local?.enabled,
        local_users_file: data.local?.users_file,
        ldap_enabled: data.ldap?.enabled,
        ldap_url: data.ldap?.url,
        ldap_bind_dn: data.ldap?.bind_dn,
        ldap_bind_password: '',
        ldap_user_search_base: data.ldap?.user_search_base,
        ldap_user_filter: data.ldap?.user_filter,
        ldap_group_search_base: data.ldap?.group_search_base,
        ldap_group_filter: data.ldap?.group_filter,
        ldap_attr_uid: data.ldap?.attr_uid,
        ldap_attr_mail: data.ldap?.attr_mail,
        ldap_attr_display_name: data.ldap?.attr_display_name,
        ldap_group_role_map: data.ldap?.group_role_map,
        kc_enabled: data.keycloak?.enabled,
        kc_issuer: data.keycloak?.issuer,
        kc_client_id: data.keycloak?.client_id,
        kc_client_secret: '',
        kc_realm_roles_map: data.keycloak?.realm_roles_map,
        kc_use_introspection: data.keycloak?.use_introspection,
      });
    }
  }, [data, form]);

  const save = useMutation({
    mutationFn: (v: any) => authApi.saveConfig({
      local: { enabled: v.local_enabled, users_file: v.local_users_file },
      ldap: {
        enabled: v.ldap_enabled, url: v.ldap_url, bind_dn: v.ldap_bind_dn,
        bind_password: v.ldap_bind_password || undefined,
        user_search_base: v.ldap_user_search_base, user_filter: v.ldap_user_filter,
        group_search_base: v.ldap_group_search_base, group_filter: v.ldap_group_filter,
        attr_uid: v.ldap_attr_uid, attr_mail: v.ldap_attr_mail, attr_display_name: v.ldap_attr_display_name,
        group_role_map: v.ldap_group_role_map,
      },
      keycloak: {
        enabled: v.kc_enabled, issuer: v.kc_issuer, client_id: v.kc_client_id,
        client_secret: v.kc_client_secret || undefined,
        realm_roles_map: v.kc_realm_roles_map, use_introspection: v.kc_use_introspection,
      },
    }),
    onSuccess: () => { message.success('Auth settings saved'); qc.invalidateQueries({ queryKey: ['auth-config'] }); },
    onError: (e) => message.error(e.message),
  });

  return (
    <>
      <h2>Authentication settings</h2>
      <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)} style={{ maxWidth: 900 }}>
        <Tabs items={[
          { key: 'local', label: 'Local', children: (
            <>
              <Form.Item name="local_enabled" label="Enabled" valuePropName="checked"><Switch /></Form.Item>
              <Form.Item name="local_users_file" label="Users file"><Input /></Form.Item>
            </>
          )},
          { key: 'ldap', label: 'LDAP', children: (
            <>
              <Form.Item name="ldap_enabled" label="Enabled" valuePropName="checked"><Switch /></Form.Item>
              <Form.Item name="ldap_url" label="URL"><Input placeholder="ldaps://host:636" /></Form.Item>
              <Form.Item name="ldap_bind_dn" label="Bind DN"><Input /></Form.Item>
              <Form.Item name="ldap_bind_password" label="Bind password"><Input.Password /></Form.Item>
              <Form.Item name="ldap_user_search_base" label="User search base"><Input /></Form.Item>
              <Form.Item name="ldap_user_filter" label="User filter"><Input /></Form.Item>
              <Form.Item name="ldap_group_search_base" label="Group search base"><Input /></Form.Item>
              <Form.Item name="ldap_group_filter" label="Group filter"><Input /></Form.Item>
              <Form.Item name="ldap_attr_uid" label="UID attribute"><Input /></Form.Item>
              <Form.Item name="ldap_attr_mail" label="Mail attribute"><Input /></Form.Item>
              <Form.Item name="ldap_attr_display_name" label="Display name attribute"><Input /></Form.Item>
              <Form.Item name="ldap_group_role_map" label="Group→role map (grp=role;...)"><Input /></Form.Item>
            </>
          )},
          { key: 'kc', label: 'Keycloak', children: (
            <>
              <Form.Item name="kc_enabled" label="Enabled" valuePropName="checked"><Switch /></Form.Item>
              <Form.Item name="kc_issuer" label="Issuer"><Input placeholder="https://kc/realms/s3mm" /></Form.Item>
              <Form.Item name="kc_client_id" label="Client ID"><Input /></Form.Item>
              <Form.Item name="kc_client_secret" label="Client secret"><Input.Password /></Form.Item>
              <Form.Item name="kc_realm_roles_map" label="Realm role→s3mm role map"><Input /></Form.Item>
              <Form.Item name="kc_use_introspection" label="Use introspection" valuePropName="checked"><Switch /></Form.Item>
            </>
          )},
        ]} />
        <Button type="primary" htmlType="submit" loading={save.isPending}>Save</Button>
      </Form>
    </>
  );
}
