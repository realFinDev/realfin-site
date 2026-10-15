// Valheim whitelist builder: extracts SteamID64s from pasted text and formats permittedlist.txt / adminlist.txt.
// Runs entirely in the browser.
(function (root) {
  'use strict';

  // SteamID64 for individual accounts: 17 digits, starting with 7656119.
  var ID_RE = /7656119\d{10}/g;

  // Each non-empty line may contain an ID and optionally a name, e.g.
  //   "Alice 76561198000000001", "https://steamcommunity.com/profiles/76561198000000001",
  //   "Player history entry with index 0:  Alice (Steam_76561198000000001, D705…)"
  function extract(text) {
    var seen = {}, out = [];
    String(text || '').split(/\r?\n/).forEach(function (line) {
      var ids = line.match(ID_RE);
      if (!ids) return;
      ids.forEach(function (id) {
        if (seen[id]) return;
        seen[id] = true;
        out.push({ id: id, name: nameFrom(line, id) });
      });
    });
    return out;
  }

  function nameFrom(line, id) {
    // Valheim server log: "...index N:  NAME (Steam_ID, ...)"
    var log = new RegExp(':\\s+([^:]+?)\\s+\\(Steam_' + id).exec(line);
    if (log) return clean(log[1]);
    var rest = line
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(new RegExp('(Steam_)?' + id), ' ')
      .replace(/[\/,;|=\-]+/g, ' ')
      .replace(/^\s*\/\/\s*/, '');
    return clean(rest);
  }

  function clean(s) {
    s = String(s).replace(/[\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim();
    return s.length > 40 ? s.slice(0, 40) : s;
  }

  function format(entries, header) {
    var lines = ['// ' + header];
    entries.forEach(function (e) {
      if (e.name) lines.push('// ' + e.name);
      lines.push(e.id);
    });
    return lines.join('\n') + '\n';
  }

  var api = { extract: extract, format: format };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ValheimWhitelist = api;
})(typeof window !== 'undefined' ? window : globalThis);
