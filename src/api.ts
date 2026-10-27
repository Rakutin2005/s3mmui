import { useUiStore } from './store.js';
export const API_BASE = import.meta.env.VITE_S3MMWS_URL || '/api';
function authHeaders(extra: any = {}) {
  const token = useUiStore.getState().token;
  const h: any = { ...extra };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export async function rpc(cmd, params = {}) {
  const response = await fetch(`${API_BASE}/rpc`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ cmd, ...params }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.error) {
    throw new Error(json.error || response.statusText || 'request failed');
  }
  return json;
}

export async function get(path) {
  const response = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.error) {
    throw new Error(json.error || response.statusText || 'request failed');
  }
  return json;
}

export async function post(path: string, body: any = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.error) {
    throw new Error(json.error || response.statusText || 'request failed');
  }
  return json;
}

export const endpoints = {
  health: () => get('/health'),
  status: () => get('/status'),
  modules: () => get('/modules'),
  extensions: () => get('/ui/extensions'),
  clusters: () => rpc('list', { kind: 'cluster' }),
  cluster: (name) => rpc('show', { kind: 'cluster', name }),
  credentials: () => rpc('list', { kind: 'credential' }),
  credential: (name) => rpc('show', { kind: 'credential', name }),
  replications: () => rpc('list', { kind: 'replication' }),
  replication: (name) => rpc('show', { kind: 'replication', name }),
  targets: () => rpc('list', { kind: 'target' }),
  target: (name) => rpc('show', { kind: 'target', name }),
  policies: () => rpc('list', { kind: 'policy' }),
  policy: (name) => rpc('show', { kind: 'policy', name }),
  rules: (policy) => rpc('rule', { action: 'list', policy }),
  settings: () => rpc('list', { kind: 'settings' }),
  stats: (replication) => rpc('stat', { replication }),
  queues: (replication) => rpc('queues', { replication }),
  routes: (replication, limit = 50) => rpc('routes', { replication, limit }),
};


export const browse = {
  buckets: (cluster) => get(`/browse/buckets?cluster=${encodeURIComponent(cluster)}`),
  objects: (cluster, bucket, prefix = '') => get(`/browse/objects?cluster=${encodeURIComponent(cluster)}&bucket=${encodeURIComponent(bucket)}&prefix=${encodeURIComponent(prefix)}`),
  object: (cluster, bucket, key) => get(`/browse/object?cluster=${encodeURIComponent(cluster)}&bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}`),
  saveObject: async (cluster, bucket, key, payload) => {
    const response = await fetch(`${API_BASE}/browse/object?cluster=${encodeURIComponent(cluster)}&bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || json.error) throw new Error(json.error || response.statusText || 'request failed');
    return json;
  },
  deleteObject: async (cluster, bucket, key) => {
    const response = await fetch(`${API_BASE}/browse/object?cluster=${encodeURIComponent(cluster)}&bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}`, { method: 'DELETE', headers: authHeaders() });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || json.error) throw new Error(json.error || response.statusText || 'request failed');
    return json;
  },
  setObjectAcl: async (cluster, bucket, key, acl) => {
    const response = await fetch(`${API_BASE}/browse/object-acl?cluster=${encodeURIComponent(cluster)}&bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}&acl=${encodeURIComponent(acl)}`, { method: 'PUT', headers: authHeaders() });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || json.error) throw new Error(json.error || response.statusText || 'request failed');
    return json;
  },
  objectAcl: (cluster, bucket, key) => get(`/browse/object-acl?cluster=${encodeURIComponent(cluster)}&bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}`),
  objectContent: (cluster, bucket, key, limit = 2 * 1024 * 1024) => get(`/browse/object-content?cluster=${encodeURIComponent(cluster)}&bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}&limit=${encodeURIComponent(limit)}`),
  createBucket: async (cluster, bucket) => {
    const response = await fetch(`${API_BASE}/browse/buckets?cluster=${encodeURIComponent(cluster)}&bucket=${encodeURIComponent(bucket)}`, { method: 'POST', headers: authHeaders() });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || json.error) throw new Error(json.error || response.statusText || 'request failed');
    return json;
  },
  renameObject: async (cluster, bucket, source, target) => {
    const response = await fetch(`${API_BASE}/browse/rename?cluster=${encodeURIComponent(cluster)}&bucket=${encodeURIComponent(bucket)}`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ source, target }),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || json.error) throw new Error(json.error || response.statusText || 'request failed');
    return json;
  },
};


/// Whole object as a Blob through the s3mmws S3 gateway (/s3proxy), with the
/// session token; used for audio/video preview (<audio>/<video> cannot send
/// an Authorization header themselves).
export async function objectBlob(cluster: string, bucket: string, key: string): Promise<Blob> {
  const path = [cluster, bucket, ...key.split('/')].map(encodeURIComponent).join('/');
  const response = await fetch(`${API_BASE}/s3proxy/${path}`, { headers: authHeaders() });
  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error(json.error || response.statusText || 'download failed');
  }
  return response.blob();
}

/// Call a module (extension) endpoint: GET/POST/PUT/DELETE with optional JSON body.
export async function extCall(method: string, endpoint: string, body?: any) {
  const init: RequestInit = { method, headers: authHeaders(body !== undefined ? { 'Content-Type': 'application/json' } : {}) };
  if (body !== undefined) init.body = JSON.stringify(body);
  const response = await fetch(`${API_BASE}${endpoint}`, init);
  const json = await response.json().catch(() => ({}));
  if (!response.ok || (json && !Array.isArray(json) && json.error)) {
    throw new Error(json.error || response.statusText || 'request failed');
  }
  return json;
}

export const rbac = {
  users: () => get('/rbac/users'),
  roles: () => get('/rbac/roles'),
  permissions: () => get('/rbac/permissions'),
  bindings: () => get('/rbac/bindings'),
  createUser: async (payload) => {
    const r = await fetch(`${API_BASE}/rbac/users`, { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(payload) });
    const j = await r.json().catch(()=>({})); if (!r.ok || j.error) throw new Error(j.error || r.statusText); return j;
  },
  deleteUser: async (id) => {
    const r = await fetch(`${API_BASE}/rbac/users?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: authHeaders() });
    const j = await r.json().catch(()=>({})); if (!r.ok || j.error) throw new Error(j.error || r.statusText); return j;
  },
  createRole: async (payload) => {
    const r = await fetch(`${API_BASE}/rbac/roles`, { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(payload) });
    const j = await r.json().catch(()=>({})); if (!r.ok || j.error) throw new Error(j.error || r.statusText); return j;
  },
  updateRole: async (payload) => {
    const r = await fetch(`${API_BASE}/rbac/roles`, { method: 'PUT', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(payload) });
    const j = await r.json().catch(()=>({})); if (!r.ok || j.error) throw new Error(j.error || r.statusText); return j;
  },
  deleteRole: async (id) => {
    const r = await fetch(`${API_BASE}/rbac/roles?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: authHeaders() });
    const j = await r.json().catch(()=>({})); if (!r.ok || j.error) throw new Error(j.error || r.statusText); return j;
  },
  createBinding: async (payload) => {
    const r = await fetch(`${API_BASE}/rbac/bindings`, { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(payload) });
    const j = await r.json().catch(()=>({})); if (!r.ok || j.error) throw new Error(j.error || r.statusText); return j;
  },
  deleteBinding: async (id) => {
    const r = await fetch(`${API_BASE}/rbac/bindings?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: authHeaders() });
    const j = await r.json().catch(()=>({})); if (!r.ok || j.error) throw new Error(j.error || r.statusText); return j;
  },
  listAcl: (rt, rid) => get(`/acl?resource_type=${encodeURIComponent(rt)}&resource_id=${encodeURIComponent(rid)}`),
  setAcl: async (payload) => {
    const r = await fetch(`${API_BASE}/acl`, { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(payload) });
    const j = await r.json().catch(()=>({})); if (!r.ok || j.error) throw new Error(j.error || r.statusText); return j;
  },
  deleteAcl: async (id) => {
    const r = await fetch(`${API_BASE}/acl?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: authHeaders() });
    const j = await r.json().catch(()=>({})); if (!r.ok || j.error) throw new Error(j.error || r.statusText); return j;
  },
};


export const authApi = {
  config: () => get('/auth/config'),
  saveConfig: async (payload) => {
    const r = await fetch(`${API_BASE}/auth/config`, { method: 'PUT', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(payload) });
    const j = await r.json().catch(()=>({})); if (!r.ok || j.error) throw new Error(j.error || r.statusText); return j;
  },
  providers: () => get('/auth/providers'),
};
