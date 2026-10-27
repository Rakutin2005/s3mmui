# Deploying s3mm UI

## Build

```bash
npm ci
npm run build
```

The static files are written to `dist/`.

To point the UI at a different backend at build time, set `VITE_S3MMWS_URL`:

```bash
VITE_S3MMWS_URL=https://api.example.com npm run build
```

The default build uses `/api`, which is what `nginx.conf` proxies to the backend.

## Deploy

```bash
rsync -av --delete dist/ /var/www/s3mmui/
cp deploy/nginx.conf /etc/nginx/conf.d/s3mmui.conf
nginx -t && systemctl reload nginx
```

Adjust `server_name`, the backend upstream address and `root` in `nginx.conf` as needed.
