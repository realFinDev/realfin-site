// GitHub OAuth for Decap CMS, step 2: swap the code for a token and hand it to the CMS window.
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = (request.headers.get('Cookie') || '').match(/(?:^|;\s*)decap_oauth_state=([^;]+)/)?.[1];

  if (!code || !state || state !== cookieState) {
    return page('error', { message: 'Login failed: invalid or expired request. Please try again.' }, url.origin);
  }

  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'realfin-decap-oauth' },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${url.origin}/api/callback`,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.access_token) {
    return page('error', { message: 'GitHub did not return a token. Please try again.' }, url.origin);
  }
  return page('success', { token: data.access_token, provider: 'github' }, url.origin);
}

// Decap's popup handshake: announce "authorizing", then reply with the result to the CMS window,
// but only if that window is on our own site (never to other origins).
function page(status, content, origin) {
  const payload = JSON.stringify(`authorization:github:${status}:${JSON.stringify(content)}`);
  const html = `<!doctype html><html><body><p>${status === 'success' ? 'Logged in, you can close this window.' : 'Login failed.'}</p>
<script>
  (function () {
    var allowed = ${JSON.stringify(origin)};
    function receive(e) {
      if (e.origin !== allowed) return;
      window.opener.postMessage(${payload}, allowed);
      window.removeEventListener('message', receive, false);
    }
    window.addEventListener('message', receive, false);
    window.opener && window.opener.postMessage('authorizing:github', allowed);
  })();
</script></body></html>`;
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Set-Cookie': 'decap_oauth_state=; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    },
  });
}
