/**
 * Formata o resultado do ping em texto e classe CSS.
 */
export function formatPing(p) {
  if (!p || !p.status) return { pingText: '—', pingClass: 'ping-unknown' };
  if (p.status === 'ok') {
    const t = parseFloat(p.time);
    if (!isNaN(t) && t > 100)
      return { pingText: `${t.toFixed(2)} ms`, pingClass: 'ping-ok high' };
    return { pingText: `${t.toFixed(2)} ms`, pingClass: 'ping-ok' };
  }
  if (p.status === 'fail') return { pingText: 'Falhou', pingClass: 'ping-fail' };
  return { pingText: '—', pingClass: 'ping-unknown' };
}

/**
 * Formata bytes em KB, MB, GB, etc.
 */
export function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
  return `${bytes.toFixed(2)} ${units[i]}`;
}

/**
 * Formata segundos em "Xd Yh Zm".
 */
export function formatUptime(seconds) {
  if (!seconds || isNaN(seconds)) return '—';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${mins}m`;
}

/**
 * Formata bits por segundo em Kbps, Mbps, etc.
 */
export function formatMbps(bits) {
    if (bits === null || bits === undefined || isNaN(bits)) return '—';
    if (bits < 1000) return `${bits.toFixed(0)} bps`;
    if (bits < 1_000_000) return `${(bits / 1000).toFixed(2)} Kbps`;
    if (bits < 1_000_000_000) return `${(bits / 1_000_000).toFixed(2)} Mbps`;
    return `${(bits / 1_000_000_000).toFixed(2)} Gbps`;
}

/**
 * Retorna uma classe CSS baseada no uso de CPU/RAM.
 */
export function getUsageClass(v) {
  if (v < 60) return 'low';
  if (v < 85) return 'medium';
  return 'high';
}

/**
 * Define a categoria do dispositivo com base no nome.
 */
export function getCategory(pc) {
    const n = pc.name?.toLowerCase() || '';
    const isCamera = /\bcam(_|\b|[0-9])/i.test(n) || n.includes('camera') || n.includes('ezviz') || n.includes('hikvision') || n.includes('ipcam');
    if (isCamera) return 'camera';
    if (n.includes('print') || n.includes('epson') || n.includes('brother')) return 'printer';
    if (n.includes('router') || n.includes('switch') || n.includes('unifi')) return 'network';
    return 'computer';
}

/**
 * Verifica se o badge do agente deve ser exibido.
 */
export function shouldShowAgentBadge(pc) {
    const g = (pc.group || '').toLowerCase();
    const cat = getCategory(pc);
    const allowedGroups = ['notebook', 'notebooks', 'laboratório', 'laboratorio', 'lab', 'servidor', 'servidores'];
    return cat === 'computer' && allowedGroups.some(k => g.includes(k));
}