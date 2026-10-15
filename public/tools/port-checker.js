// Docker Compose port checker. Runs entirely in the browser; nothing is uploaded.
// Understands short syntax ("8080:80", "127.0.0.1:53:53/udp", "2456-2457:2456-2457/udp"),
// long syntax (target/published/host_ip/protocol) and network_mode: host.
(function (root) {
  'use strict';

  var SENSITIVE = {
    2375: 'Docker API without TLS: anyone who can reach it controls the host',
    2376: 'Docker API: full control of the host',
    11434: 'Ollama API (no authentication)',
    9000: 'Portainer (controls Docker, effectively root)',
    9443: 'Portainer (controls Docker, effectively root)',
    81: 'Nginx Proxy Manager admin UI',
    19999: 'Netdata (system details)',
    6379: 'Redis (often no password)',
    5432: 'PostgreSQL database',
    3306: 'MySQL/MariaDB database',
    27017: 'MongoDB database',
  };

  function stripQuotes(s) {
    s = s.trim();
    if ((s[0] === '"' && s[s.length - 1] === '"') || (s[0] === "'" && s[s.length - 1] === "'")) s = s.slice(1, -1);
    return s.trim();
  }

  function range(spec) {
    var m = /^(\d+)(?:-(\d+))?$/.exec(spec);
    if (!m) return null;
    var a = +m[1], b = m[2] ? +m[2] : a;
    if (b < a || a < 1 || b > 65535 || b - a > 2000) return null;
    return [a, b];
  }

  // Short syntax → {ip, from, to, proto} or {container: true} for container-only ports, or null if unparseable.
  function parseShort(entry) {
    var s = stripQuotes(entry);
    var proto = 'tcp';
    var slash = s.lastIndexOf('/');
    if (slash > -1) { proto = s.slice(slash + 1).toLowerCase(); s = s.slice(0, slash); }
    var ip = '';
    var v6 = /^\[([^\]]+)\]:(.*)$/.exec(s);
    if (v6) { ip = v6[1]; s = v6[2]; }
    var parts = s.split(':');
    if (!v6 && parts.length === 3) { ip = parts[0]; parts = parts.slice(1); }
    if (parts.length === 1) return range(parts[0]) ? { container: true } : null;
    if (parts.length !== 2) return null;
    var host = range(parts[0]);
    if (!host || !range(parts[1])) return null;
    return { ip: ip, from: host[0], to: host[1], proto: proto };
  }

  function indentOf(line) { return line.length - line.replace(/^\s+/, '').length; }

  function parse(text) {
    var lines = text.replace(/\t/g, '  ').split(/\r?\n/);
    var out = { ports: [], hostNet: [], unparsed: [] };
    var file = 1, inServices = false, servicesIndent = -1, svcIndent = -1, service = null;
    var inPorts = false, portsIndent = -1, longEntry = null;

    function flushLong() {
      if (longEntry && longEntry.published) {
        var r = range(String(longEntry.published));
        if (r) out.ports.push({ file: file, service: service, ip: longEntry.host_ip || '', from: r[0], to: r[1], proto: (longEntry.protocol || 'tcp').toLowerCase() });
      }
      longEntry = null;
    }

    lines.forEach(function (raw) {
      var line = raw.replace(/\s+#.*$/, '');
      if (/^\s*#/.test(line) || !line.trim()) return;
      if (/^---\s*$/.test(line)) { flushLong(); file++; inServices = false; service = null; inPorts = false; return; }
      var ind = indentOf(line), t = line.trim();

      if (/^services:\s*$/.test(t)) { flushLong(); inServices = true; servicesIndent = ind; svcIndent = -1; service = null; inPorts = false; return; }
      if (inServices && ind <= servicesIndent) { flushLong(); inServices = false; service = null; inPorts = false; }
      if (!inServices) return;

      var key = /^([A-Za-z0-9_.-]+):\s*(.*)$/.exec(t);
      if (svcIndent === -1 && key && !t.startsWith('-')) svcIndent = ind;
      if (ind === svcIndent && key) { flushLong(); service = key[1]; inPorts = false; return; }
      if (!service) return;

      if (inPorts && ind <= portsIndent && !(ind === portsIndent && t.startsWith('-'))) { flushLong(); inPorts = false; }

      if (!inPorts && key && key[1] === 'network_mode' && /host/.test(key[2])) { out.hostNet.push({ file: file, service: service }); return; }
      if (!inPorts && key && key[1] === 'ports') {
        inPorts = true; portsIndent = ind;
        var inline = /^\[(.*)\]$/.exec(key[2].trim());
        if (inline) {
          inline[1].split(',').filter(Boolean).forEach(function (e) { add(e); });
          inPorts = false;
        }
        return;
      }
      if (!inPorts) return;

      if (t.startsWith('-')) {
        flushLong();
        var item = t.slice(1).trim();
        var kv = /^([a-z_]+):\s*(.*)$/.exec(item);
        if (kv && !/^\d/.test(item)) { longEntry = {}; longEntry[kv[1]] = stripQuotes(kv[2]); }
        else add(item);
      } else if (longEntry && key) {
        longEntry[key[1]] = stripQuotes(key[2]);
      }
    });
    flushLong();
    return out;

    function add(entry) {
      var p = parseShort(entry);
      if (p && p.container) return;
      if (p) out.ports.push({ file: file, service: service, ip: p.ip, from: p.from, to: p.to, proto: p.proto });
      else out.unparsed.push({ file: file, service: service, entry: stripQuotes(entry) });
    }
  }

  function exposure(ip) {
    if (!ip || ip === '0.0.0.0' || ip === '::') return 'all';
    if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') return 'local';
    return 'specific';
  }

  function ipsOverlap(a, b) {
    var ea = exposure(a), eb = exposure(b);
    if (ea === 'all' || eb === 'all') return true;
    return a === b;
  }

  function conflicts(ports) {
    var found = [];
    for (var i = 0; i < ports.length; i++) {
      for (var j = i + 1; j < ports.length; j++) {
        var a = ports[i], b = ports[j];
        if (a.proto !== b.proto || !ipsOverlap(a.ip, b.ip)) continue;
        var lo = Math.max(a.from, b.from), hi = Math.min(a.to, b.to);
        if (lo <= hi) found.push({ a: a, b: b, from: lo, to: hi });
      }
    }
    return found;
  }

  function sensitive(ports) {
    var hits = [];
    ports.forEach(function (p) {
      if (exposure(p.ip) !== 'all') return;
      Object.keys(SENSITIVE).forEach(function (k) {
        var n = +k;
        if (n >= p.from && n <= p.to) hits.push({ port: p, number: n, why: SENSITIVE[k] });
      });
    });
    return hits;
  }

  var api = { parse: parse, conflicts: conflicts, sensitive: sensitive, exposure: exposure, parseShort: parseShort };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PortChecker = api;
})(typeof window !== 'undefined' ? window : globalThis);
