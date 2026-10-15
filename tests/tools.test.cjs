// Tests for the browser tools in public/tools/. Run: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const load = (f) => require(path.join(__dirname, '..', 'public', 'tools', f));
load('port-checker.js'); load('dns-checker.js'); load('valheim-whitelist.js'); load('docker-logs.js'); load('roblox-remote.js');
const { PortChecker: pc, DnsChecker: dns, ValheimWhitelist: wl, DockerLogs: dl, RobloxRemote: rr } = globalThis;

test('port checker: short syntax', () => {
  assert.deepEqual(pc.parseShort('"8080:80"'), { ip: '', from: 8080, to: 8080, proto: 'tcp' });
  assert.deepEqual(pc.parseShort('127.0.0.1:53:53/udp'), { ip: '127.0.0.1', from: 53, to: 53, proto: 'udp' });
  assert.deepEqual(pc.parseShort('2456-2457:2456-2457/udp'), { ip: '', from: 2456, to: 2457, proto: 'udp' });
  assert.deepEqual(pc.parseShort('[::1]:8080:80'), { ip: '::1', from: 8080, to: 8080, proto: 'tcp' });
  assert.deepEqual(pc.parseShort('80'), { container: true });
  assert.equal(pc.parseShort('${PORT}:80'), null);
});

test('port checker: conflicts, long syntax, host network, sensitive ports', () => {
  const r = pc.parse(`services:
  web:
    ports: ["8080:80"]
  long:
    ports:
      - target: 80
        published: 8080
  portainer:
    ports:
      - 9000:9000
  ollama:
    ports:
      - "127.0.0.1:11434:11434"
  ha:
    network_mode: host
---
services:
  other:
    ports:
      - "8080:3000"`);
  assert.equal(r.ports.length, 5);
  assert.deepEqual(r.hostNet.map((h) => h.service), ['ha']);
  assert.equal(pc.conflicts(r.ports).length, 3); // web/long, web/other, long/other
  assert.deepEqual(pc.sensitive(r.ports).map((s) => s.number), [9000]);
});

test('dns checker: names and summaries', () => {
  assert.equal(dns.normalizeName('https://WWW.Example.com/x?y'), 'www.example.com');
  assert.equal(dns.normalizeName('_dmarc.example.com.'), '_dmarc.example.com');
  assert.equal(dns.normalizeName('<script>.dev'), null);
  const nx = dns.summarize({ Status: 3, Authority: [{ name: 'example.com', type: 6, TTL: 3600, data: 'ns. host. 1 2 3 4 1800' }] });
  assert.equal(nx.kind, 'nxdomain');
  assert.equal(nx.negativeTtl, 1800); // min(SOA TTL, SOA minimum)
  const ok = dns.summarize({ Status: 0, Answer: [{ name: 'example.com.', type: 1, TTL: 300, data: '192.0.2.1' }] });
  assert.deepEqual([ok.kind, ok.answers[0].name, ok.answers[0].type], ['ok', 'example.com', 'A']);
  assert.equal(dns.formatTtl(1800), '30 min');
});

test('valheim whitelist: extracts, dedupes, names from logs', () => {
  const r = wl.extract('Alice 76561198000000001\nhttps://steamcommunity.com/profiles/76561198000000002\n01:31:34: Player history entry with index 0:  Charlie Brown (Steam_76561198000000003, X)\n76561198000000001 dup\n1234567890');
  assert.deepEqual(r.map((e) => e.id), ['76561198000000001', '76561198000000002', '76561198000000003']);
  assert.deepEqual(r.map((e) => e.name), ['Alice', '', 'Charlie Brown']);
  assert.equal(wl.format(r.slice(0, 1), 'H'), '// H\n// Alice\n76561198000000001\n');
});

test('docker logs: merge keeps existing settings, binary units', () => {
  const r = dl.merge('{"runtimes":{"nvidia":{"path":"x"}},"shutdown-timeout":60}', '20m', 3);
  const o = JSON.parse(r.json);
  assert.equal(o.runtimes.nvidia.path, 'x');
  assert.equal(o['shutdown-timeout'], 60);
  assert.deepEqual(o['log-opts'], { 'max-size': '20m', 'max-file': '3' });
  assert.equal(dl.merge('{oops', '20m', 3).ok, false);
  assert.equal(dl.merge('{"log-driver":"journald"}', '20m', 3).ok, false);
  assert.equal(dl.parseSize('20m'), 20 * 1024 * 1024);
});

test('roblox generator: validates input and emits checks', () => {
  const bad = rr.generate({ remote: 'Bad Name', args: [{ name: 'end', type: 'string' }] });
  assert.equal(bad.ok, false);
  assert.equal(bad.errors.length, 2);
  const r = rr.generate({ remote: 'BuyItem', rateLimit: 0.5, args: [
    { name: 'item', type: 'choice', options: 'A, B"C', maxLength: 10 },
    { name: 'n', type: 'integer', min: 1, max: 9 },
    { name: 'pos', type: 'Vector3', maxMagnitude: 50 },
    { name: 'part', type: 'Instance', className: 'BasePart' },
  ] });
  assert.equal(r.ok, true);
  for (const needle of [
    'if typeof(item) ~= "string" or #item == 0 or #item > 10 then return end',
    '["B\\"C"] = true',
    'n ~= n or n == math.huge or n == -math.huge or n % 1 ~= 0 or n < 1 or n > 9',
    'if pos.Magnitude > 50 then return end',
    'if not part:IsA("BasePart") then return end',
    'if last and now - last < RATE_LIMIT then return end',
    'handle(player, item :: string, n :: number, pos :: Vector3, part :: Instance)',
    'lastCall[player] = nil',
  ]) assert.ok(r.code.includes(needle), 'missing: ' + needle);
});
