// Docker log limit helper: merges log-opts into an existing daemon.json and estimates worst-case disk use.
(function (root) {
  'use strict';

  // Docker's json-file driver parses sizes with RAMInBytes: binary units (1m = 1024 × 1024 bytes).
  var UNITS = { k: 1024, m: 1024 * 1024, g: 1024 * 1024 * 1024 };

  function parseSize(s) {
    var m = /^(\d+(?:\.\d+)?)([kmg])$/i.exec(String(s).trim());
    return m ? parseFloat(m[1]) * UNITS[m[2].toLowerCase()] : null;
  }

  function human(bytes) {
    if (bytes >= 1e9) return (bytes / 1e9).toFixed(bytes >= 1e10 ? 0 : 1) + ' GB';
    if (bytes >= 1e6) return Math.round(bytes / 1e6) + ' MB';
    return Math.round(bytes / 1e3) + ' kB';
  }

  // Returns { ok, json, error }. Keeps every existing key; only sets log-driver and log-opts.
  function merge(existing, maxSize, maxFile) {
    var base = {};
    var text = String(existing || '').trim();
    if (text) {
      try { base = JSON.parse(text); } catch (e) { return { ok: false, error: 'Your daemon.json isn\'t valid JSON: ' + e.message }; }
      if (!base || typeof base !== 'object' || Array.isArray(base)) return { ok: false, error: 'daemon.json must be a JSON object ({ … }).' };
    }
    var driver = base['log-driver'];
    if (driver && driver !== 'json-file' && driver !== 'local') {
      return { ok: false, error: 'Your log driver is "' + driver + '". max-size/max-file only apply to json-file and local.' };
    }
    base['log-driver'] = driver || 'json-file';
    base['log-opts'] = Object.assign({}, base['log-opts'] || {}, { 'max-size': maxSize, 'max-file': String(maxFile) });
    return { ok: true, json: JSON.stringify(base, null, 4) + '\n' };
  }

  function worstCase(containers, maxSize, maxFile) {
    var size = parseSize(maxSize);
    if (size == null || !(containers > 0) || !(maxFile > 0)) return null;
    return { perContainer: size * maxFile, total: size * maxFile * containers };
  }

  var api = { parseSize: parseSize, human: human, merge: merge, worstCase: worstCase };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DockerLogs = api;
})(typeof window !== 'undefined' ? window : globalThis);
