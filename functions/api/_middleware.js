// The GitHub login (auth/callback) is admin-only for now. See lib/access.js.
// When guest authoring opens (GUEST_AUTHORING in src/consts.ts), guests need this login too:
// then move the Access check to /admin only and give guests their own editor path.
import { requireAccess } from '../../lib/access.js';

export const onRequest = requireAccess;
