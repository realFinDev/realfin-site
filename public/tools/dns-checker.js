// DNS record checker: asks public DNS-over-HTTPS resolvers (Cloudflare, Google) from the visitor's browser.
// Pure helpers are exported for testing; nothing is sent to realfin.dev.
(function (root) {
  'use strict';

  var TYPES = { A: 1, NS: 2, CNAME: 5, SOA: 6, MX: 15, TXT: 16, AAAA: 28, CAA: 257 };
  var TYPE_NAMES = {};
  Object.keys(TYPES).forEach(function (k) { TYPE_NAMES[TYPES[k]] = k; });
  var STATUS = { 0: 'NOERROR', 1: 'FORMERR', 2: 'SERVFAIL', 3: 'NXDOMAIN', 4: 'NOTIMP', 5: 'REFUSED' };

  var RESOLVERS = [
    { name: 'Cloudflare (1.1.1.1)', url: function (n, t) { return 'https://cloudflare-dns.com/dns-query?name=' + encodeURIComponent(n) + '&type=' + t; } },
    { name: 'Google (8.8.8.8)', url: function (n, t) { return 'https://dns.google/resolve?name=' + encodeURIComponent(n) + '&type=' + t; } },
  ];

  function normalizeName(input) {
    var s = String(input || '').trim().toLowerCase();
    s = s.replace(/^[a-z]+:\/\//, '').replace(/[\/?#].*$/, '').replace(/\.$/, '');
    if (s.length < 1 || s.length > 253) return null;
    if (!/^([a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,62}$/.test(s)) return null;
    return s;
  }

  // Turns a DoH JSON response into something displayable.
  function summarize(json) {
    var status = STATUS[json.Status] || ('code ' + json.Status);
    var answers = (json.Answer || []).map(function (a) {
      return { name: a.name.replace(/\.$/, ''), type: TYPE_NAMES[a.type] || String(a.type), ttl: a.TTL, data: a.data };
    });
    var negativeTtl = null, soa = null;
    if (!answers.length) {
      var auth = (json.Authority || []).filter(function (a) { return a.type === 6; })[0];
      if (auth) {
        // Negative caching (RFC 2308): min(SOA record TTL, SOA "minimum" field).
        var fields = String(auth.data).trim().split(/\s+/);
        var minimum = parseInt(fields[fields.length - 1], 10);
        negativeTtl = isNaN(minimum) ? auth.TTL : Math.min(auth.TTL, minimum);
        soa = auth.name.replace(/\.$/, '');
      }
    }
    var kind = json.Status === 3 ? 'nxdomain' : json.Status !== 0 ? 'error' : answers.length ? 'ok' : 'nodata';
    return { status: status, kind: kind, answers: answers, negativeTtl: negativeTtl, soaZone: soa };
  }

  function formatTtl(s) {
    if (s == null) return '';
    if (s < 120) return s + ' s';
    if (s < 7200) return Math.round(s / 60) + ' min';
    if (s < 172800) return Math.round(s / 3600) + ' h';
    return Math.round(s / 86400) + ' days';
  }

  var api = { TYPES: TYPES, RESOLVERS: RESOLVERS, normalizeName: normalizeName, summarize: summarize, formatTtl: formatTtl };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DnsChecker = api;
})(typeof window !== 'undefined' ? window : globalThis);
