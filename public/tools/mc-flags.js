// Minecraft server JVM flags (Aikar's flags, as published at https://mcflags.emc.gs).
(function (root) {
  'use strict';

  function flags(gb) {
    var big = gb > 12; // Aikar: different G1 tuning above 12 GB
    return [
      '-Xms' + gb + 'G',
      '-Xmx' + gb + 'G',
      '-XX:+UseG1GC',
      '-XX:+ParallelRefProcEnabled',
      '-XX:MaxGCPauseMillis=200',
      '-XX:+UnlockExperimentalVMOptions',
      '-XX:+DisableExplicitGC',
      '-XX:+AlwaysPreTouch',
      '-XX:G1NewSizePercent=' + (big ? 40 : 30),
      '-XX:G1MaxNewSizePercent=' + (big ? 50 : 40),
      '-XX:G1HeapRegionSize=' + (big ? '16M' : '8M'),
      '-XX:G1ReservePercent=' + (big ? 15 : 20),
      '-XX:G1HeapWastePercent=5',
      '-XX:G1MixedGCCountTarget=4',
      '-XX:InitiatingHeapOccupancyPercent=' + (big ? 20 : 15),
      '-XX:G1MixedGCLiveThresholdPercent=90',
      '-XX:G1RSetUpdatingPauseTimePercent=5',
      '-XX:SurvivorRatio=32',
      '-XX:+PerfDisableSharedMem',
      '-XX:MaxTenuringThreshold=1',
      '-Dusing.aikars.flags=https://mcflags.emc.gs',
      '-Daikars.new.flags=true',
    ];
  }

  // kind: 'args-file' (NeoForge/Forge user_jvm_args.txt) or 'jar' (Paper/vanilla start command)
  function generate(opts) {
    var gb = Math.round(Number(opts.gb));
    if (!(gb >= 2 && gb <= 64)) return { ok: false, error: 'Pick between 2 and 64 GB.' };
    var java = String(opts.java || 'java').trim() || 'java';
    if (/[;&|`$<>]/.test(java)) return { ok: false, error: 'The Java path contains characters that don\'t belong in a path.' };
    var jar = String(opts.jar || 'server.jar').trim() || 'server.jar';
    if (!/^[\w.\-\/]+\.jar$/.test(jar)) return { ok: false, error: 'The jar name should look like server.jar or paper-1.21.jar.' };
    var f = flags(gb);
    if (opts.kind === 'args-file') {
      return { ok: true, filename: 'user_jvm_args.txt', text: '# Aikar\'s flags for ' + gb + ' GB (https://mcflags.emc.gs)\n' + f.join('\n') + '\n' };
    }
    return { ok: true, filename: 'start.sh', text: '#!/bin/sh\n' + java + ' ' + f.join(' ') + ' -jar ' + jar + ' nogui\n' };
  }

  var api = { flags: flags, generate: generate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.McFlags = api;
})(typeof window !== 'undefined' ? window : globalThis);
