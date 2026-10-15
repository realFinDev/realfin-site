// GitHub OAuth for Decap CMS, step 1: send the visitor to GitHub's consent screen.
// Needs GITHUB_CLIENT_ID (and GITHUB_CLIENT_SECRET for step 2) set in the Pages project's environment variables.
export async function onRequestGet({ request, env }) {
  if (!env.GITHUB_CLIENT_ID) {
    return new Response('Login is not configured yet (GITHUB_CLIENT_ID missing).', { status: 503 });
  }
  const url = new URL(request.url);
  // Only allow the scopes Decap asks for with our config; never let the caller request more.
  const requested = url.searchParams.get('scope') || 'public_repo';
  const scope = requested.split(/[ ,]+/).every((s) => ['public_repo', 'user', 'user:email'].includes(s)) ? requested : 'public_repo';
  const state = crypto.randomUUID();
  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  authorize.searchParams.set('redirect_uri', `${url.origin}/api/callback`);
  authorize.searchParams.set('scope', scope);
  authorize.searchParams.set('state', state);
  return new Response(null, {
    status: 302,
    headers: {
      Location: authorize.toString(),
      // CSRF protection: the callback only accepts the state we just issued.
      'Set-Cookie': `decap_oauth_state=${state}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    },
  });
}
