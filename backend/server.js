// ===================================================================
// IMPORTS E CONFIGURAÇÃO INICIAL
// ===================================================================
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

// Carrega .env do diretório raiz (../.env) se existir
try {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    lines.forEach((line) => {
      if (!line || line.trim().startsWith('#')) return;
      const idx = line.indexOf('=');
      if (idx > 0) {
        const key = line.substring(0, idx).trim();
        const val = line.substring(idx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
      }
    });
  }
} catch (e) {
  console.warn('Não foi possível carregar .env:', e.message);
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// WOL local: apenas executa "wol <mac>" no servidor Linux
const WOL_CMD = process.env.WOL_CMD || 'wol';

// Utilitário: primeiro MAC válido (00:11:22..., 00-11-22..., ou 001122334455)
function extractFirstMac(text) {
  if (!text || typeof text !== 'string') return null;
  const re = /([0-9A-Fa-f]{2}(?:[:-])){5}[0-9A-Fa-f]{2}|[0-9A-Fa-f]{12}/g;
  const match = text.match(re);
  if (!match || match.length === 0) return null;
  let mac = match[0];
  if (/^[0-9A-Fa-f]{12}$/.test(mac)) mac = mac.match(/.{1,2}/g).join(':');
  return mac.toUpperCase();
}

// ===================================================================
// CONFIG ZABBIX E AXIOS
// ===================================================================
const ZABBIX_CONFIG = {
  url: process.env.ZABBIX_URL || 'http://192.168.1.5/zabbix/api_jsonrpc.php',
  user: process.env.ZABBIX_USER || 'Admin',
  password: process.env.ZABBIX_PASSWORD || 'zabbix',
};
const INSECURE_TLS = (process.env.ZABBIX_TLS_INSECURE || '').toString() === '1';
const axiosInstance = axios.create({
  httpAgent: new http.Agent({ keepAlive: true, maxSockets: 20 }),
  httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 20, rejectUnauthorized: !INSECURE_TLS }),
  timeout: 10000,
  headers: { 'Content-Type': 'application/json-rpc' },
});

let zabbixAuthToken = null;
async function authenticateZabbix() {
  try {
    const response = await axiosInstance.post(ZABBIX_CONFIG.url, {
      jsonrpc: '2.0', method: 'user.login',
      params: { username: ZABBIX_CONFIG.user, password: ZABBIX_CONFIG.password },
      id: 1,
    });
    if (response.data.error) {
      console.error('Erro de autenticação Zabbix:', response.data.error);
      zabbixAuthToken = null;
      return null;
    }
    zabbixAuthToken = response.data.result;
    console.log('Autenticado no Zabbix com sucesso');
    return zabbixAuthToken;
  } catch (error) {
    console.error('Erro ao autenticar no Zabbix:', (error && ((error.response && error.response.data) || error.code || error.message)));
    zabbixAuthToken = null;
    return null;
  }
}
async function ensureAuth() {
  if (!zabbixAuthToken) {
    console.log('Token ausente, autenticando novamente...');
    await authenticateZabbix();
  }
}

// ===================================================================
// ZABBIX: HOSTS E ITENS
// ===================================================================
async function getZabbixHosts() {
  try {
    await ensureAuth();
    if (!zabbixAuthToken) {
      console.error('Sem token Zabbix após autenticação. Verifique ZABBIX_URL/USER/PASSWORD.');
      return [];
    }
    const response = await axiosInstance.post(ZABBIX_CONFIG.url, {
      jsonrpc: '2.0', method: 'host.get',
      params: {
        output: ['hostid', 'host', 'name', 'status'],
        selectInterfaces: ['ip'],
        selectGroups: ['name'],
        selectInventory: ['macaddress_a', 'macaddress_b'],
      },
      auth: zabbixAuthToken, id: 2,
    });
    if (response.data.error) {
      console.error('Erro da API Zabbix ao buscar hosts:', response.data.error);
      return [];
    }
    return response.data.result;
  } catch (error) {
    console.error('Erro ao buscar hosts Zabbix:', (error && ((error.response && error.response.data) || error.code || error.message)));
    return [];
  }
}

async function getItemValue(hostid, key) {
  try {
    await ensureAuth();
    const req = {
      jsonrpc: '2.0', method: 'item.get',
      params: { output: ['lastvalue'], hostids: hostid, filter: { key_: key }, limit: 1 },
      auth: zabbixAuthToken, id: Math.floor(Math.random() * 10000),
    };
    const resp = await axiosInstance.post(ZABBIX_CONFIG.url, req);
    if (resp.data.result?.length > 0) return parseFloat(resp.data.result[0].lastvalue) || 0;
    return null;
  } catch (err) {
    console.warn(`Erro ao buscar item ${key} em ${hostid}:`, (err && ((err.response && err.response.data) || err.code || err.message)));
    return null;
  }
}

// ===================================================================
// COLETA DE MÉTRICAS POR HOST
// ===================================================================
async function getHostMetrics(hostid, hostName) {
  const name = (hostName || '').toLowerCase();
  const metrics = { cpu: null, ram: null, ping: null, pingAlive: null, pingLoss: null, netRx: null, netTx: null, ink: null, agentStatus: null, uptimeSec: null, totalRam: null, totalDisk: null };
  try {
    await ensureAuth();
    if (name.includes('router') || name.includes('switch') || name.includes('unifi')) {
      metrics.ping = await getItemValue(hostid, 'icmppingsec');
      metrics.pingAlive = await getItemValue(hostid, 'icmpping');
      metrics.netRx = await getItemValue(hostid, 'unifiIfRxBytes.1');
      metrics.netTx = await getItemValue(hostid, 'unifiIfTxBytes.1');
    } else if (name.includes('cam') || name.includes('camera') || name.includes('ezviz') || name.includes('hikvision')) {
      metrics.ping = await getItemValue(hostid, 'icmppingsec');
      metrics.pingAlive = await getItemValue(hostid, 'icmpping');
      metrics.pingLoss = await getItemValue(hostid, 'icmppingloss');
    } else if (name.includes('epson')) {
      metrics.ping = await getItemValue(hostid, 'icmppingsec');
      metrics.pingAlive = await getItemValue(hostid, 'icmpping');
      metrics.ink = {
        black: await getItemValue(hostid, 'prtMarkerSuppliesCapacity[Black Ink Bottle]'),
        cyan: await getItemValue(hostid, 'prtMarkerSuppliesCapacity[Cyan Ink Bottle]'),
        magenta: await getItemValue(hostid, 'prtMarkerSuppliesCapacity[Magenta Ink Bottle]'),
        yellow: await getItemValue(hostid, 'prtMarkerSuppliesCapacity[Yellow Ink Bottle]'),
      };
    } else if (name.includes('brother')) {
      metrics.ping = await getItemValue(hostid, 'icmppingsec');
      metrics.pingAlive = await getItemValue(hostid, 'icmpping');
      let [bBlack, bCyan, bMagenta, bYellow] = await Promise.all([
        getItemValue(hostid, 'brother.ink.black'),
        getItemValue(hostid, 'brother.ink.cyan'),
        getItemValue(hostid, 'brother.ink.magenta'),
        getItemValue(hostid, 'brother.ink.yellow'),
      ]);
      if (bBlack == null && bCyan == null && bMagenta == null && bYellow == null) {
        bBlack = await getItemValue(hostid, 'brother.toner.black');
      }
      if (bBlack == null && bCyan == null && bMagenta == null && bYellow == null) {
        const [pBlack, pCyan, pMagenta, pYellow] = await Promise.all([
          getItemValue(hostid, 'prtMarkerSuppliesLevel[Black Toner Cartridge]'),
          getItemValue(hostid, 'prtMarkerSuppliesLevel[Cyan Toner Cartridge]'),
          getItemValue(hostid, 'prtMarkerSuppliesLevel[Magenta Toner Cartridge]'),
          getItemValue(hostid, 'prtMarkerSuppliesLevel[Yellow Toner Cartridge]'),
        ]);
        bBlack = pBlack; bCyan = pCyan; bMagenta = pMagenta; bYellow = pYellow;
      }
      metrics.ink = { black: bBlack, cyan: bCyan, magenta: bMagenta, yellow: bYellow };
    } else {
      const [cpu, ram, pingValue, pingAlive] = await Promise.all([
        getItemValue(hostid, 'system.cpu.util'),
        getItemValue(hostid, 'vm.memory.util'),
        getItemValue(hostid, 'icmppingsec'),
        getItemValue(hostid, 'icmpping'),
      ]);
      metrics.cpu = cpu || 0;
      metrics.ram = ram || 0;
      metrics.ping = pingValue ? pingValue * 1000 : null;
      metrics.pingAlive = !!(pingAlive && Number(pingAlive) >= 1);
      metrics.uptimeSec = await getItemValue(hostid, 'system.uptime');
      metrics.totalRam = await getItemValue(hostid, 'vm.memory.size[total]');
      metrics.totalDisk = await getItemValue(hostid, 'vfs.fs.size[C:,total]');
    }
    const agentPing = await getItemValue(hostid, 'agent.ping');
    metrics.agentStatus = agentPing > 0 ? 'online' : 'offline';
  } catch (err) {
    console.error(`Erro ao buscar métricas do host ${hostid}:`, (err && (err.message || err)));
  }
  return metrics;
}

// ===================================================================
// HISTÓRICO
// ===================================================================
async function getZabbixHistory(hostid, itemKey, historyType, valueFormatter = (v) => parseFloat(v)) {
  await ensureAuth();
  const itemResp = await axiosInstance.post(ZABBIX_CONFIG.url, {
    jsonrpc: '2.0', method: 'item.get',
    params: { output: ['itemid'], hostids: hostid, filter: { key_: itemKey }, limit: 1 },
    auth: zabbixAuthToken, id: 10,
  });
  const itemid = itemResp.data.result[0]?.itemid;
  if (!itemid) return [];
  const now = Math.floor(Date.now() / 1000);
  const dayAgo = now - 86400;
  const historyResp = await axiosInstance.post(ZABBIX_CONFIG.url, {
    jsonrpc: '2.0', method: 'history.get',
    params: { output: 'extend', history: historyType, itemids: itemid, sortfield: 'clock', sortorder: 'ASC', time_from: dayAgo, time_till: now },
    auth: zabbixAuthToken, id: 11,
  });
  return historyResp.data.result.map((h) => ({ time: Number(h.clock), value: valueFormatter(h.value) }));
}

// Rotas de histórico
app.get('/api/history/:hostid/ram', async (req, res) => {
  try {
    const data = await getZabbixHistory(req.params.hostid, 'vm.memory.size[used]', 3, (v) => parseFloat(v) / 1024 / 1024 / 1024);
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Erro ao buscar histórico de RAM' }); }
});
app.get('/api/history/:hostid/cpu', async (req, res) => {
  try { res.json(await getZabbixHistory(req.params.hostid, 'system.cpu.util', 0)); }
  catch (err) { res.status(500).json({ error: 'Erro ao buscar histórico de CPU' }); }
});
app.get('/api/history/:hostid/disk', async (req, res) => {
  try { res.json(await getZabbixHistory(req.params.hostid, 'vfs.fs.size[C:,pused]', 0)); }
  catch (err) { res.status(500).json({ error: 'Erro ao buscar histórico de Disco' }); }
});

// ===================================================================
// LISTAGEM E DETALHE DE HOSTS
// ===================================================================
async function processHostsInChunks(hosts, chunkSize = 10) {
  let allResults = [];
  for (let i = 0; i < hosts.length; i += chunkSize) {
    const chunk = hosts.slice(i, i + chunkSize);
    const chunkPromises = chunk.map(async (host) => {
      const metrics = await getHostMetrics(host.hostid, host.name);
      const ip = host.interfaces[0]?.ip || 'N/A';
      const group = host.groups[0]?.name || 'Sem Grupo';
      const status = metrics.pingAlive || metrics.agentStatus === 'online' ? 'online' : 'offline';
      const macFromInventory = extractFirstMac(host.inventory?.macaddress_a || host.inventory?.macaddress_b || '');
      return { id: parseInt(host.hostid), name: host.name, ip, group, status, ...metrics, macAddress: macFromInventory, lastUpdate: new Date().toISOString() };
    });
    const settled = await Promise.allSettled(chunkPromises);
    settled.forEach((r) => { if (r.status === 'fulfilled') allResults.push(r.value); });
  }
  return allResults;
}

app.get('/api/computers', async (req, res) => {
  try {
    const hosts = await getZabbixHosts();
    if (!hosts || hosts.length === 0) return res.json([]);
    const results = await processHostsInChunks(hosts, 10);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Erro interno ao buscar hosts' });
  }
});

app.get('/api/host/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const hosts = await getZabbixHosts();
    const host = hosts.find((h) => h.hostid === id);
    if (!host) return res.status(404).json({ error: 'Host não encontrado' });
    const metrics = await getHostMetrics(host.hostid, host.name);
    const ip = host.interfaces[0]?.ip || 'N/A';
    const group = host.groups[0]?.name || 'Sem Grupo';
    const status = metrics.pingAlive || metrics.agentStatus === 'online' ? 'online' : 'offline';
    const macFromInventory = extractFirstMac(host.inventory?.macaddress_a || host.inventory?.macaddress_b || '');
    res.json({ id: parseInt(host.hostid), name: host.name, ip, group, status, ...metrics, macAddress: macFromInventory });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno ao buscar host' });
  }
});

// ===================================================================
// ROTA: Wake on LAN
// ===================================================================
app.post('/api/wol', async (req, res) => {
  try {
    const macRaw = (req.body?.mac || '').toString();
    const mac = extractFirstMac(macRaw);
    if (!mac) return res.status(400).json({ error: 'MAC inválido' });

    console.log(`[LOCAL WOL] cmd=${WOL_CMD} mac=${mac}`);
    execFile(WOL_CMD, [mac], { timeout: 8000 }, (err, stdout, stderr) => {
      if (err) {
        console.error('Erro ao executar WOL local:', err.message, stderr);
        return res.status(500).json({ error: 'Falha ao executar WOL local' });
      }
      if (stdout) console.log('[LOCAL WOL] stdout:', stdout.toString().trim());
      if (stderr) console.log('[LOCAL WOL] stderr:', stderr.toString().trim());
      return res.json({ ok: true, stdout: (stdout || '').toString().trim() });
    });
  } catch (e) {
    console.error('Erro na rota /api/wol:', e.message);
    res.status(500).json({ error: 'Erro interno ao enviar WOL' });
  }
});

// ===================================================================
// INICIALIZAÇÃO DO SERVIDOR
// ===================================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  await authenticateZabbix();
});

setInterval(async () => {
  console.log('Reautenticando no Zabbix (agendado)...');
  await authenticateZabbix();
}, 3600000);
