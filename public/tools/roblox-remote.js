// Roblox RemoteEvent validator generator: builds server-side Luau that validates every client argument.
// Pure function `generate(spec)` is exported for testing.
(function (root) {
  'use strict';

  var IDENT = /^[A-Za-z_][A-Za-z0-9_]{0,40}$/;
  var RESERVED = ['and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function', 'if', 'in', 'local', 'nil', 'not', 'or',
    'repeat', 'return', 'then', 'true', 'until', 'while', 'continue', 'type', 'export', 'typeof', 'game', 'workspace', 'remote', 'handle',
    'now', 'last', 'lastCall', 'RATE_LIMIT', 'Players', 'ReplicatedStorage'];

  function luaString(s) {
    return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
  }
  function num(v, fallback) {
    var n = Number(v);
    return isFinite(n) ? n : fallback;
  }
  function list(v) {
    return String(v || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  }

  var LUAU_TYPE = { string: 'string', number: 'number', integer: 'number', boolean: 'boolean', choice: 'string', Vector3: 'Vector3', Instance: 'Instance' };

  // spec: { remote, rateLimit, args: [{ name, type, min, max, maxLength, options, className, maxMagnitude }] }
  function generate(spec) {
    var errors = [];
    var remote = String(spec.remote || '').trim();
    if (!IDENT.test(remote)) errors.push('Remote name must be letters, digits or _ (e.g. BuyItem).');
    var args = (spec.args || []).filter(function (a) { return a && String(a.name || '').trim(); });
    var seen = {};
    args.forEach(function (a) {
      a.name = String(a.name).trim();
      if (!IDENT.test(a.name)) errors.push('Argument "' + a.name + '": use letters, digits or _ only.');
      if (a.name === 'player' || seen[a.name]) errors.push('Argument "' + a.name + '": name already used.');
      else if (RESERVED.indexOf(a.name) !== -1) errors.push('Argument "' + a.name + '": that name is reserved in Luau or used by the generated code.');
      seen[a.name] = true;
      if (!LUAU_TYPE[a.type]) errors.push('Argument "' + a.name + '": unknown type.');
      if (a.type === 'choice' && !list(a.options).length) errors.push('Argument "' + a.name + '": list the allowed values.');
      if (a.type === 'Instance' && String(a.className || '').trim() && !IDENT.test(String(a.className).trim())) errors.push('Argument "' + a.name + '": class name looks wrong (e.g. BasePart).');
    });
    if (errors.length) return { ok: false, errors: errors };

    var rate = Math.max(0, num(spec.rateLimit, 0));
    var L = [];
    L.push('--!strict');
    L.push('-- Server-side validation for the "' + remote + '" RemoteEvent.');
    L.push('-- Generated at realfin.dev/tools/roblox-remote-validator/. Review it, then put your logic in handle().');
    L.push('local Players = game:GetService("Players")');
    L.push('local ReplicatedStorage = game:GetService("ReplicatedStorage")');
    L.push('');
    L.push('local remote = ReplicatedStorage:WaitForChild(' + luaString(remote) + ') :: RemoteEvent');
    if (rate > 0) {
      L.push('');
      L.push('local RATE_LIMIT = ' + rate + ' -- seconds between calls per player');
      L.push('local lastCall: { [Player]: number } = {}');
    }
    args.forEach(function (a) {
      if (a.type === 'choice') {
        L.push('local ALLOWED_' + a.name + ': { [string]: boolean } = { ' +
          list(a.options).map(function (o) { return '[' + luaString(o) + '] = true'; }).join(', ') + ' }');
      }
    });
    L.push('');
    var params = args.map(function (a) { return a.name + ': ' + LUAU_TYPE[a.type]; });
    L.push('-- Only called with values that passed every check below.');
    L.push('local function handle(player: Player' + (params.length ? ', ' + params.join(', ') : '') + ')');
    L.push('\t-- TODO: check server-side state (ownership, currency, cooldowns, distance) and act.');
    L.push('end');
    L.push('');
    L.push('remote.OnServerEvent:Connect(function(player: Player' + args.map(function (a) { return ', ' + a.name + ': unknown'; }).join('') + ')');
    if (rate > 0) {
      L.push('\tlocal now = os.clock()');
      L.push('\tlocal last = lastCall[player]');
      L.push('\tif last and now - last < RATE_LIMIT then return end');
      L.push('\tlastCall[player] = now');
      L.push('');
    }
    args.forEach(function (a) {
      var n = a.name;
      L.push('\t-- ' + n + ': ' + a.type);
      if (a.type === 'string' || a.type === 'choice') {
        var maxLen = Math.max(1, Math.floor(num(a.maxLength, 50)));
        L.push('\tif typeof(' + n + ') ~= "string" or #' + n + ' == 0 or #' + n + ' > ' + maxLen + ' then return end');
        if (a.type === 'choice') L.push('\tif not ALLOWED_' + n + '[' + n + '] then return end');
      } else if (a.type === 'number' || a.type === 'integer') {
        var cond = 'typeof(' + n + ') ~= "number" or ' + n + ' ~= ' + n + ' or ' + n + ' == math.huge or ' + n + ' == -math.huge';
        if (a.type === 'integer') cond += ' or ' + n + ' % 1 ~= 0';
        var min = num(a.min, null), max = num(a.max, null);
        if (min !== null && a.min !== '' && a.min != null) cond += ' or ' + n + ' < ' + min;
        if (max !== null && a.max !== '' && a.max != null) cond += ' or ' + n + ' > ' + max;
        L.push('\tif ' + cond + ' then return end');
      } else if (a.type === 'boolean') {
        L.push('\tif typeof(' + n + ') ~= "boolean" then return end');
      } else if (a.type === 'Vector3') {
        L.push('\tif typeof(' + n + ') ~= "Vector3" then return end');
        L.push('\tif ' + n + '.X ~= ' + n + '.X or ' + n + '.Y ~= ' + n + '.Y or ' + n + '.Z ~= ' + n + '.Z then return end -- NaN');
        var mag = num(a.maxMagnitude, null);
        if (mag !== null && a.maxMagnitude !== '' && a.maxMagnitude != null) L.push('\tif ' + n + '.Magnitude > ' + mag + ' then return end');
      } else if (a.type === 'Instance') {
        var cls = String(a.className || '').trim();
        L.push('\tif typeof(' + n + ') ~= "Instance" then return end');
        if (cls) {
          L.push('\tif not ' + n + ':IsA(' + luaString(cls) + ') then return end');
        }
        L.push('\tif not ' + n + ':IsDescendantOf(workspace) then return end -- ignore objects that left the world');
      }
    });
    L.push('');
    L.push('\thandle(player' + args.map(function (a) { return ', ' + a.name + ' :: ' + LUAU_TYPE[a.type]; }).join('') + ')');
    L.push('end)');
    if (rate > 0) {
      L.push('');
      L.push('Players.PlayerRemoving:Connect(function(player: Player)');
      L.push('\tlastCall[player] = nil');
      L.push('end)');
    }
    return { ok: true, code: L.join('\n') + '\n' };
  }

  var api = { generate: generate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.RobloxRemote = api;
})(typeof window !== 'undefined' ? window : globalThis);
