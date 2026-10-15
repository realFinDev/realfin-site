// Only Cloudflare Access-approved visitors may load the editor. See lib/access.js.
import { requireAccess } from '../../lib/access.js';

export const onRequest = requireAccess;
