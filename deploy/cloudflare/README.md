# Free parallel deployment

This keeps `covenda.app` unchanged while a replacement stack is tested beside Vercel:

- Cloudflare Pages serves the reviewed static files in `dist/`.
- A Pages Function forwards only `/api/*` to the Node API.
- Render Free runs the existing Express adapter from `server.js`.
- Supabase remains the database, authentication provider and object store.
- GitHub Actions replaces the three Vercel cron declarations, but remains disabled until the
  repository variable `COVENDA_CRON_ENABLED=true` is set.

No production DNS record needs to change until the preview passes the workflow checklist.

## 1. Prepare Supabase Storage

Run `npm run storage:plan`, review the output, then run `npm run storage:apply`. The script uses
Supabase's supported Storage API to create a private `uploads` bucket and a MIME-restricted
public `avatars` bucket. It does not write directly to Supabase's read-only Storage schema. Do not
delete the existing Vercel Blob store: older database rows still point to those files and the
storage adapter intentionally keeps them readable.

Set `COVENDA_UPLOAD_MAX_BYTES` to the project's real Supabase global file limit before applying.
Supabase Free currently caps a file at 50 MiB (`52428800` bytes); paid projects can set a larger
limit. The API returns this limit to the recorder so the browser does not promise an upload the
bucket will reject.

## 2. Create the Render API

1. In Render, choose **New → Blueprint** and connect this GitHub repository.
2. Render reads `render.yaml`. Confirm the service is `covenda-api` on the **Free** plan.
3. Copy the current production values from Vercel into every prompted `sync: false` variable.
   Never put the Supabase secret/service-role key in GitHub or browser-side Cloudflare values.
   For a Supabase Free project, set `COVENDA_UPLOAD_MAX_BYTES=52428800`.
4. Deploy the branch manually. `autoDeployTrigger: off` prevents an unreviewed branch from
   becoming a new API build automatically.
5. Open `https://<render-service>.onrender.com/healthz`; it should return `{ "ok": true }`.

Render Free sleeps after 15 minutes without inbound traffic. The first API action after that can
take roughly a minute while the service starts. Static pages remain fast because Cloudflare
serves them independently. This is the material tradeoff for a $0 API host.

## 3. Create the Cloudflare Pages preview

1. In Cloudflare, choose **Workers & Pages → Create → Pages → Connect to Git**.
2. Select this repository and the migration branch.
3. Set build command to `npm run build:static` and output directory to `dist`.
4. Add one Pages Function variable:
   `COVENDA_API_ORIGIN=https://<render-service>.onrender.com`
5. Deploy and test the generated `pages.dev` URL.

The build is an allowlist. It cannot publish `api/`, `supabase/`, `data/`, `docs/`, tests,
environment files, or server source. `_routes.json` limits billed Function requests to `/api/*`;
static requests stay on Pages' static path.

## 4. Configure authentication previews

In Supabase **Authentication → URL Configuration**:

1. Keep the production Site URL as `https://covenda.app`.
2. Keep `https://covenda.app/portal.html` in Redirect URLs.
3. Temporarily add the exact Pages preview callback:
   `https://<pages-project>.pages.dev/portal.html`

In Google Cloud Console, the Google OAuth client's authorized redirect URI remains Supabase's
callback, not the Pages URL:

`https://<supabase-project-ref>.supabase.co/auth/v1/callback`

The Pages proxy preserves the public host in `x-forwarded-host`, so the API asks Supabase to
return the user to the same browser-visible Pages or Covenda address.

## 5. Test before DNS

On the Pages preview, verify:

1. Homepage, portal, cohort, confirmation and operator pages load without console errors.
2. Email and Google login return to the preview portal.
3. Student and company dashboards enforce the same ownership boundaries.
4. A private recording uploads, plays for its owner, and is refused for an unrelated account.
5. A project attachment uploads and can be read by the project owner.
6. An avatar uploads and renders from the public avatar bucket.
7. Operator actions and admin allowlist behavior remain unchanged.
8. Stripe webhook behavior is tested with a non-production endpoint before changing its live URL.
9. Each cron endpoint succeeds through a manual GitHub Actions dispatch.

## 6. Cut over with rollback available

1. Lower the `covenda.app` DNS TTL to 300 seconds at least a day in advance.
2. Add the custom domain to Cloudflare Pages and complete its DNS instructions.
3. Update any live Stripe webhook endpoint only after the custom domain is serving the previewed
   build. The public URL stays `https://covenda.app/api/stripe-webhook`.
4. Set GitHub repository variable `COVENDA_API_ORIGIN` to the Render origin, add Actions secret
   `COVENDA_CRON_SECRET` matching Render's `CRON_SECRET`, then enable
   `COVENDA_CRON_ENABLED=true`.
5. Remove or disable the Vercel cron jobs so the same operation never runs twice.
6. Leave the Vercel project and Blob store intact for at least one week.

Rollback is DNS-only: point `covenda.app` back to Vercel and set
`COVENDA_CRON_ENABLED=false`. Existing Vercel Blob objects must remain until they are copied and
their database references are migrated in a separate, verified operation.
