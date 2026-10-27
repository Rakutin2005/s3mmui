// Named address of an inventory element, shown next to it in the UI:
//   cluster reached over the network      -> s3://<name>
//   cluster published on a unix socket    -> u://<socket path>   (addr unix:/path#http://host)
//   replication                           -> s3://<source> → s3://<destination>
//   target                                -> its uri (s3://cluster/bucket, file:/path, https://...)

function addrList(item: any): string[] {
  const raw = item?.addr ?? item?.endpoints ?? [];
  return Array.isArray(raw) ? raw.map(String) : [String(raw)];
}

export function unixSocketPath(addr: string): string | null {
  if (!addr.startsWith('unix:')) return null;
  const rest = addr.slice('unix:'.length);
  const hash = rest.indexOf('#');
  return hash >= 0 ? rest.slice(0, hash) : rest;
}

export function clusterAddress(item: any): string {
  if (!item) return '';
  for (const addr of addrList(item)) {
    const sock = unixSocketPath(addr);
    if (sock) return `u://${sock.replace(/^\/+/, '/')}`;
  }
  return item.name ? `s3://${item.name}` : '';
}

export function inventoryAddress(kind: string, item: any, clusters: any[] = []): string {
  if (!item) return '';
  if (kind === 'cluster' || kind === '/clusters') return clusterAddress(item);
  if (kind === 'target' || kind === '/targets') return item.uri || '';
  if (kind === 'replication' || kind === '/replications') {
    const ref = (name: string) => {
      const c = clusters.find((x: any) => x.name === name || x.alias === name);
      return c ? clusterAddress(c) : name ? `s3://${name}` : '?';
    };
    return `${ref(item.source)} → ${ref(item.destination)}`;
  }
  return '';
}
