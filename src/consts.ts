export const SITE_TITLE = 'RealFin';
export const SITE_DESCRIPTION =
  'Homelab, self-hosting and game servers, written up from a real server in my room. Plus the story of building a Roblox game with AI.';
export const AUTHOR = 'RealFin';

// Fill in after Google AdSense approves the site, e.g. 'ca-pub-1234567890123456'.
// While empty, no ad script is loaded at all.
export const ADSENSE_CLIENT = '';

export const CATEGORIES = {
  homelab: { label: 'Homelab', blurb: 'Docker, networking, backups and the things that broke along the way.' },
  'game-servers': { label: 'Game servers', blurb: 'Running Valheim and Minecraft servers for friends, from setup to mods to weird bugs.' },
  roblox: { label: 'Roblox dev', blurb: 'Building a Roblox game with AI as a coding partner.' },
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
