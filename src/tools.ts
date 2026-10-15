// Single list of tools, used by /tools/ and the homepage.
export const TOOLS = [
  { href: '/tools/valheim-server-modifiers/', title: 'Valheim world modifier generator', short: 'World settings → exact dedicated-server arguments.', text: 'Pick combat, death penalty, resources, raids and portals, and get the exact -modifier server arguments and Docker env line.' },
  { href: '/tools/valheim-whitelist/', title: 'Valheim whitelist builder', short: 'Steam links or IDs → a clean permittedlist.txt.', text: 'Paste Steam profile links, IDs or server log lines and get a clean, commented permittedlist.txt or adminlist.txt.' },
  { href: '/tools/dns-checker/', title: 'DNS record checker', short: 'Records and TTLs on Cloudflare and Google DNS, side by side.', text: 'Look up records on Cloudflare and Google DNS side by side, with TTLs and how long a "doesn\'t exist" answer stays cached.' },
  { href: '/tools/compose-port-checker/', title: 'Docker Compose port checker', short: 'Find port conflicts and services open to your whole network.', text: 'Paste your compose files and find duplicate host ports, plus services exposed to your whole network that probably shouldn\'t be.' },
  { href: '/tools/docker-log-limits/', title: 'Docker log size limit helper', short: 'Merge log limits into daemon.json, with a disk estimate.', text: 'Paste your daemon.json, choose max-size and max-file, and get the merged config plus the worst-case disk usage.' },
];
