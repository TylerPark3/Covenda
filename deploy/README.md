# Running Covenda on your own server

Why: hosting was $40/month, and $20 of that bought a seat rather than compute. A server has no
seat pricing — your partner gets an SSH key. Recurring cost drops to roughly €4/month.

Nothing in `api/` changed to make this possible. `api/storage.js` removed the last `@vercel/*`
package, and `server.js` is a ~90-line adapter that calls the existing
`export default handler(req, res)` functions unmodified.

**Do not cancel Vercel until step 8.** The last step is deleting the fallback, not the first.

---

## What you need

- A VPS. **Hetzner CX22, €3.79/mo** is the recommendation: 2 vCPU, 4 GB, boringly reliable.
  Not Oracle's always-free tier — it reclaims idle instances and locks accounts, and free that
  disappears is worse than €4 when a customer is on it.
- Ubuntu 24.04.
- Your Supabase, Resend and Stripe values. Supabase stays exactly as it is; it is your
  database, not your host.

## 1. The box

```bash
ssh root@YOUR_IP
adduser --system --group --home /srv/covenda covenda
apt update && apt install -y curl git
curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && apt install -y nodejs
```

## 2. Caddy

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy
```

## 3. The code

```bash
git clone https://github.com/TylerPark3/Covenda.git /srv/covenda
cd /srv/covenda && npm ci --omit=dev
chown -R covenda:covenda /srv/covenda
```

## 4. Secrets

Root-owned, `0600`, outside the repo. These never enter git and never appear in a unit file.

```bash
mkdir -p /etc/covenda
cat > /etc/covenda/env <<'EOF'
SUPABASE_URL=...
SUPABASE_SECRET_KEY=...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_STORAGE_BUCKET=uploads
RESEND_API_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
CRON_SECRET=...
PORT=3000
EOF
chmod 600 /etc/covenda/env
```

Copy the values out of Vercel → Settings → Environment Variables. **Rotate the Resend key while
you are doing this** — the current one has been sitting in a chat transcript.

## 5. Services

```bash
cp /srv/covenda/deploy/covenda*.service /srv/covenda/deploy/covenda*.timer /etc/systemd/system/
cp /srv/covenda/deploy/Caddyfile /etc/caddy/Caddyfile
systemctl daemon-reload
systemctl enable --now covenda
systemctl enable --now covenda-labels-cron.timer covenda-batch-review-cron.timer covenda-roles-cron.timer
systemctl reload caddy
```

Check it before touching DNS:

```bash
curl -s localhost:3000/healthz          # {"ok":true,"routes":28}
systemctl list-timers 'covenda-*'       # three timers, next run shown
journalctl -u covenda -n 50             # "28 routes, 6 taking a raw body"
```

## 6. Prove it works before DNS

Point a throwaway hostname at the box, or edit your laptop's `/etc/hosts`:

```
YOUR_IP  covenda.app
```

Then sign in and exercise the real paths: **upload a file**, open the portal, load Opportunities.
Uploads are the one thing that is genuinely new here — they go to Supabase Storage now. When it
is right, remove the hosts line.

## 7. DNS

**A day before**, drop the TTL on `covenda.app` to 300s. That is the difference between a
five-minute rollback and waiting out a 24-hour cache.

Then point the A record at the VPS. Caddy issues the certificate within seconds of the first
request. Watch `journalctl -u caddy -f` while it happens.

## 8. Leave Vercel running for a week

If anything breaks, put the A record back. Only after a quiet week:

- Cancel the Vercel subscription (both seats)
- **Do not delete the Vercel Blob store.** Files uploaded before the storage change still live
  there and `api/storage.js` reads them by absolute URL. Deleting it breaks every older
  deliverable and recording. It stays until those objects are copied across or have aged out.

---

## Deploying after this

```bash
cd /srv/covenda && git pull && npm ci --omit=dev && systemctl restart covenda
```

`server.js` drains in-flight requests on SIGTERM, so a restart does not cut someone off
mid-upload.

## What you take on

Patching (`unattended-upgrades` handles most of it), backups, and noticing when the box is down.
Caddy renews TLS on its own. Supabase still holds all the data, so the server is replaceable:
rebuilding it is these eight steps again.

Worth setting up an uptime check against `/healthz` — the one thing this arrangement loses
versus a platform is somebody else noticing first.
