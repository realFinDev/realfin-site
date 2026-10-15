#!/usr/bin/env bash
# Homelab health check: read-only. Prints problems worth a look; changes nothing.
# From https://realfin.dev/blog/homelab-health-check-checklist/
# Usage: bash homelab-healthcheck.sh            (works as a normal user in the docker group)
set -uo pipefail

warn=0
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
bad()  { printf '  \033[33m!\033[0m %s\n' "$*"; warn=$((warn + 1)); }
info() { printf '    %s\n' "$*"; }
section() { printf '\n\033[1m%s\033[0m\n' "$*"; }

section "Docker containers"
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  restarting=$(docker ps -a --filter status=restarting --format '{{.Names}}')
  [ -n "$restarting" ] && bad "restarting right now: $restarting" || ok "nothing stuck restarting"
  loops=$(docker ps -q | xargs -r docker inspect --format '{{.RestartCount}} {{.Name}}' | awk '$1 > 0 {sub("/","",$2); print $2 " (" $1 "x)"}')
  [ -n "$loops" ] && { bad "containers that have restarted since they were created:"; echo "$loops" | while read -r l; do info "$l"; done; } || ok "no restarts"
  unhealthy=$(docker ps --filter health=unhealthy --format '{{.Names}}')
  [ -n "$unhealthy" ] && bad "unhealthy: $unhealthy" || ok "no unhealthy containers"
  young=$(docker ps --format '{{.Names}}\t{{.Status}}' | awk -F'\t' '$2 ~ /^Up [0-9]+ seconds/ {print $1}')
  [ -n "$young" ] && bad "only up for seconds (crash loop?): $young" || ok "no suspiciously fresh containers"
  nolimit=$(docker ps -q | xargs -r docker inspect --format '{{.Name}} {{index .HostConfig.LogConfig.Config "max-size"}}' | awk 'NF == 1 {sub("/","",$1); print $1}')
  [ -n "$nolimit" ] && bad "no log size limit: $(echo $nolimit | tr '\n' ' ')" && info "fix: https://realfin.dev/tools/docker-log-limits/" || ok "all containers have a log size limit"
else
  info "docker not available to this user, skipped"
fi

section "System services"
if command -v systemctl >/dev/null 2>&1; then
  failed=$(systemctl --failed --no-legend --plain 2>/dev/null | awk '{print $1}')
  [ -n "$failed" ] && bad "failed units: $(echo $failed | tr '\n' ' ')" && info "details: systemctl status <unit>" || ok "no failed systemd units"
  [ -f /var/run/reboot-required ] && bad "a reboot is pending (kernel or library update)" || ok "no reboot pending"
fi

section "GPU (NVIDIA)"
if command -v nvidia-smi >/dev/null 2>&1; then
  if nvidia-smi >/dev/null 2>&1; then
    ok "nvidia-smi works ($(nvidia-smi --query-gpu=name,temperature.gpu --format=csv,noheader | head -1) °C)"
  else
    bad "nvidia-smi fails: $(nvidia-smi 2>&1 | head -1)"
    info "a driver/library mismatch is fixed by a reboot: https://realfin.dev/blog/nvidia-driver-mismatch-jellyfin-transcoding/"
  fi
else
  info "no NVIDIA tools, skipped"
fi

section "Disks"
df -hP -x tmpfs -x devtmpfs -x squashfs -x overlay -x efivarfs 2>/dev/null | awk 'NR > 1 {gsub("%","",$5); print $5, $6, $4}' | while read -r pct mount avail; do
  if [ "$pct" -ge 90 ]; then bad "$mount is ${pct}% full ($avail free)"; elif [ "$pct" -ge 80 ]; then bad "$mount is ${pct}% full, keep an eye on it"; else ok "$mount ${pct}% used ($avail free)"; fi
done
if command -v journalctl >/dev/null 2>&1; then
  info "journal: $(journalctl --disk-usage 2>/dev/null | grep -oE '[0-9.]+[KMGT]' | head -1) (trim with: sudo journalctl --vacuum-size=500M)"
fi

section "Temperatures"
if command -v sensors >/dev/null 2>&1; then
  sensors 2>/dev/null | grep -E '^(Tctl|Tdie|Package id 0|Composite):' | sed 's/^/    /'
else
  info "lm-sensors not installed, skipped"
fi

section "Errors in container logs (last 24 h)"
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  docker ps --format '{{.Names}}' | while read -r c; do
    n=$(docker logs --since 24h "$c" 2>&1 | grep -ciE '\berror\b|\bfatal\b|exception|panic' || true)
    [ "$n" -gt 0 ] && echo "$n $c"
  done | sort -rn | head -8 | while read -r n c; do info "$n  $c"; done
  info "(many of these are harmless noise: learn your baseline, then watch for changes)"
fi

printf '\n'
[ "$warn" -eq 0 ] && printf '\033[32mAll checks passed.\033[0m\n' || printf '\033[33m%s thing(s) worth a look.\033[0m\n' "$warn"
