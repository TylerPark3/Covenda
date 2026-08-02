interface Env {
  COVENDA_API_ORIGIN: string;
}

interface PagesContext {
  request: Request;
  env: Env;
}

// Keep browser traffic same-origin while the static site and Node API live on different free
// services. Raw request bodies are streamed through unchanged, which preserves Stripe webhook
// signatures and avoids buffering large uploads in the Pages Function.
export const onRequest = async ({ request, env }: PagesContext): Promise<Response> => {
  const configured = String(env.COVENDA_API_ORIGIN || '').trim();
  let origin: URL;
  try {
    origin = new URL(configured);
  } catch {
    return Response.json({ ok: false, error: 'The API origin is not configured.' }, { status: 503 });
  }
  if (origin.protocol !== 'https:' && origin.hostname !== 'localhost') {
    return Response.json({ ok: false, error: 'The API origin must use HTTPS.' }, { status: 503 });
  }

  const incoming = new URL(request.url);
  if (origin.origin === incoming.origin) {
    return Response.json({ ok: false, error: 'The API proxy points back to itself.' }, { status: 508 });
  }

  const target = new URL(incoming.pathname + incoming.search, origin);
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.set('x-forwarded-host', incoming.host);
  headers.set('x-forwarded-proto', incoming.protocol.slice(0, -1));

  const response = await fetch(target, {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method) ? null : request.body,
    redirect: 'manual',
  });
  const outgoing = new Headers(response.headers);
  outgoing.set('x-covenda-api-proxy', 'cloudflare-pages');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: outgoing });
};
