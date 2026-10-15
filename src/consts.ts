export const SITE_TITLE = 'RealFin';
export const SITE_DESCRIPTION =
  'Homelab, self-hosting and game servers, written up from a real server in my room. Plus the story of building a Roblox game with AI.';
export const AUTHOR = 'RealFin';

// Fill in after Google AdSense approves the site, e.g. 'ca-pub-1234567890123456'.
// While empty, no ad script is loaded at all.
export const ADSENSE_CLIENT = 'ca-pub-4674228053773116';

export const CATEGORIES = {
  homelab: { label: 'Homelab', blurb: 'Docker, networking, backups and the things that broke along the way.' },
  'game-servers': { label: 'Game servers', blurb: 'Running Valheim and Minecraft servers for friends, from setup to mods to weird bugs.' },
  roblox: { label: 'Roblox dev', blurb: 'Building a Roblox game with AI as a coding partner.' },
  other: { label: 'Other experiences', blurb: 'First-hand stories from guest authors that don\'t fit the other sections.' },
} as const;
export type Category = keyof typeof CATEGORIES;

// Comments via Giscus (GitHub Discussions). Visitors sign in with GitHub; no passwords stored by this site.
// Fill these in from https://giscus.app after the GitHub repo exists (Discussions enabled + giscus app installed).
// While repoId is empty, the comment section is not rendered.
export const GISCUS = {
  repo: '', // e.g. 'realfin/realfin-site'
  repoId: '',
  category: 'Comments',
  categoryId: '',
};

// Cloudflare Pages sets CF_PAGES_BRANCH during builds. Anything other than main is staging:
// no ads, noindex, robots.txt disallows everything. Local builds count as production.
export const IS_PRODUCTION = (process.env.CF_PAGES_BRANCH ?? 'main') === 'main';

// Guest authors (Decap CMS at /admin/). Turn on once the GitHub OAuth app is set up and
// GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET are configured in Cloudflare Pages.
export const GUEST_AUTHORING = false;
