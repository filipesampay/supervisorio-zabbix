// = ==================================================================
// IMPORTS E CONFIGURAÇÃO INICIAL
// ===================================================================
const express = require("express");
const cors = require("cors");
const axios = require("axios");
// ... (resto dos seus imports)
const http = require("http");
const https = require("https");

const app = express();
const PORT = process.env.PORT || 3000;
// ... (resto da sua configuração inicial)
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));


// ===================================================================
// ... (COLE AQUI TODO O SEU CÓDIGO DO ZABBIX ATÉ A SEÇÃO DE ROTAS)
// authenticateZabbix, ensureAuth, getZabbixHosts, getItemValue, getHostMetrics
// ...
// ===================================================================

const ZABBIX_CONFIG = {
  url: process.env.ZABBIX_URL || "http://192.168.1.5/zabbix/api_jsonrpc.php",
  user: process.env.ZABBIX_USER || "Admin",
  password: process.env.ZABBIX_PASSWORD || "zabbix",
};

const axiosInstance = axios.create({
  httpAgent: new http.Agent({ keepAlive: true, maxSockets: 20 }),
  httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 20 }),
  timeout: 10000,
});

let zabbixAuthToken = null;

async function authenticateZabbix() {
  try {
    const response = await axiosInstance.post(ZABBIX_CONFIG.url, {
      jsonrpc: "2.0",
      method: "user.login",
      params: { username: ZABBIX_CONFIG.user, password: ZABBIX_CONFIG.password },
      id: 1,
    });

    if (response.data.error) {
      console.error("❌ Erro de autenticação Zabbix:", response.data.error);
      zabbixAuthToken = null;
      return null;
    }

    zabbixAuthToken = response.data.result;
    console.log("✅ Autenticado no Zabbix com sucesso");
    return zabbixAuthToken;
  } catch (error) {
    console.error("❌ Erro ao autenticar no Zabbix:", error.message);
    zabbixAuthToken = null;
    return null;
  }
}

async function ensureAuth() {
  if (!zabbixAuthToken) {
    console.log("🔑 Token ausente, autenticando novamente...");
    await authenticateZabbix();
  }
}

async function getZabbixHosts() {
  try {
    await ensureAuth();

    const response = await axiosInstance.post(ZABBIX_CONFIG.url, {
      jsonrpc: "2.0",
      method: "host.get",
      params: {
        output: ["hostid", "host", "name", "status"],
        selectInterfaces: ["ip"],
        selectGroups: ["name"],
      },
      auth: zabbixAuthToken,
      id: 2,
    });

    if (response.data.error) {
      console.error("Erro da API Zabbix ao buscar hosts:", response.data.error);
      return [];
    }

    return response.data.result;
  } catch (error) {
    console.error("Erro ao buscar hosts Zabbix:", error.message);
    return [];
  }
}

async function getItemValue(hostid, key) {
  try {
    await ensureAuth();
    const req = {
      jsonrpc: "2.0",
      method: "item.get",
      params: {
        output: ["lastvalue"],
        hostids: hostid,
        filter: { key_: key },
        limit: 1,
      },
      auth: zabbixAuthToken,
      id: Math.floor(Math.random() * 10000),
    };
    const resp = await axiosInstance.post(ZABBIX_CONFIG.url, req);
    if (resp.data.result?.length > 0)
      return parseFloat(resp.data.result[0].lastvalue) || 0;
    return null;
  } catch (err) {
    console.warn(`⚠️ Erro ao buscar item ${key} em ${hostid}: ${err.message}`);
    return null;
  }
}

// ===================================================================
// COLETA DE MÉTRICAS POR HOST (VERSÃO CORRIGIDA PARA BROTHER)
// ===================================================================
async function getHostMetrics(hostid, hostName) {
  const name = hostName.toLowerCase();
  const metrics = {
    cpu: null, ram: null, ping: null, pingAlive: null, pingLoss: null,
    netRx: null, netTx: null, ink: null, agentStatus: null, macAddress: null,
    uptimeSec: null, totalRam: null, totalDisk: null,
  };

  try {
    await ensureAuth();

    // Lógica para Roteadores/Switches
    if (name.includes("router") || name.includes("switch") || name.includes("unifi")) {
      metrics.ping = await getItemValue(hostid, "icmppingsec");
      metrics.pingAlive = await getItemValue(hostid, "icmpping");
      metrics.netRx = await getItemValue(hostid, "unifiIfRxBytes.1");
      metrics.netTx = await getItemValue(hostid, "unifiIfTxBytes.1");
    
    // Lógica para Câmeras
    } else if (name.includes("cam") || name.includes("camera") || name.includes("ezviz") || name.includes("hikvision")) {
      metrics.ping = await getItemValue(hostid, "icmppingsec");
      metrics.pingAlive = await getItemValue(hostid, "icmpping");
      metrics.pingLoss = await getItemValue(hostid, "icmppingloss");
    
    // Lógica para Epson (tinta em garrafa)
    } else if (name.includes("epson")) {
      metrics.ping = await getItemValue(hostid, "icmppingsec");
      metrics.pingAlive = await getItemValue(hostid, "icmpping");
      metrics.ink = {
        black: await getItemValue(hostid, "prtMarkerSuppliesCapacity[Black Ink Bottle]"),
        cyan: await getItemValue(hostid, "prtMarkerSuppliesCapacity[Cyan Ink Bottle]"),
        magenta: await getItemValue(hostid, "prtMarkerSuppliesCapacity[Magenta Ink Bottle]"),
        yellow: await getItemValue(hostid, "prtMarkerSuppliesCapacity[Yellow Ink Bottle]"),
      };

    // Lógica para Brother (toner em cartucho)
    } else if (name.includes("brother")) {
        metrics.ping = await getItemValue(hostid, "icmppingsec");
        metrics.pingAlive = await getItemValue(hostid, "icmpping");
        
        // --- CHAVES CORRIGIDAS (MELHOR PALPITE) ---
        // Verifique no seu Zabbix se estas são as chaves corretas!
        const [black, cyan, magenta, yellow] = await Promise.all([
            getItemValue(hostid, "prtMarkerSuppliesLevel[Black Toner Cartridge]"),
            getItemValue(hostid, "prtMarkerSuppliesLevel[Cyan Toner Cartridge]"),
            getItemValue(hostid, "prtMarkerSuppliesLevel[Magenta Toner Cartridge]"),
            getItemValue(hostid, "prtMarkerSuppliesLevel[Yellow Toner Cartridge]"),
        ]);
        
        metrics.ink = { black, cyan, magenta, yellow };

    // Lógica Padrão para Computadores
    } else {
      const [cpu, ram, pingValue, pingAlive] = await Promise.all([
        getItemValue(hostid, "system.cpu.util"),
        getItemValue(hostid, "vm.memory.util"),
        getItemValue(hostid, "icmppingsec"),
        getItemValue(hostid, "icmpping"),
      ]);
      metrics.cpu = cpu || 0;
      metrics.ram = ram || 0;
      metrics.ping = pingValue ? pingValue * 1000 : null;
      metrics.pingAlive = !!(pingAlive && Number(pingAlive) >= 1);
      metrics.macAddress = await getItemValue(hostid, "system.hw.macaddr");
      metrics.uptimeSec = await getItemValue(hostid, "system.uptime");
      metrics.totalRam = await getItemValue(hostid, "vm.memory.size[total]");
      metrics.totalDisk = await getItemValue(hostid, "vfs.fs.size[C:,total]");
    }

    // Ping do agente para todos os tipos
    const agentPing = await getItemValue(hostid, "agent.ping");
    metrics.agentStatus = agentPing > 0 ? "online" : "offline";
  } catch (err) {
    console.error(`Erro ao buscar métricas do host ${hostid}:`, err.message);
  }

  return metrics;
}
// ===================================================================
// ROTAS DE HISTÓRICO (SEÇÃO ALTERADA E COM ADIÇÕES)
// ===================================================================

/**
 * Função genérica para buscar histórico de um item no Zabbix.
 * @param {string} hostid - ID do host.
 * @param {string} itemKey - Chave do item (ex: "system.cpu.util").
 * @param {number} historyType - Tipo de histórico no Zabbix (0=float, 3=numérico).
 * @param {function} valueFormatter - Função para formatar o valor recebido.
 */
async function getZabbixHistory(hostid, itemKey, historyType, valueFormatter = (v) => parseFloat(v)) {
  await ensureAuth();

  // 1. Encontrar o itemid para a chave fornecida
  const itemResp = await axiosInstance.post(ZABBIX_CONFIG.url, {
    jsonrpc: "2.0", method: "item.get",
    params: { output: ["itemid"], hostids: hostid, filter: { key_: itemKey }, limit: 1 },
    auth: zabbixAuthToken, id: 10
  });

  const itemid = itemResp.data.result[0]?.itemid;
  if (!itemid) return []; // Retorna vazio se o item não existe

  // 2. Buscar o histórico para o itemid encontrado
  const now = Math.floor(Date.now() / 1000);
  const dayAgo = now - 86400; // 24 horas atrás

  const historyResp = await axiosInstance.post(ZABBIX_CONFIG.url, {
    jsonrpc: "2.0", method: "history.get",
    params: {
      output: "extend", history: historyType, itemids: itemid,
      sortfield: "clock", sortorder: "ASC",
      time_from: dayAgo, time_till: now,
    },
    auth: zabbixAuthToken, id: 11
  });

  // 3. Formatar a saída
  return historyResp.data.result.map((h) => ({
    time: Number(h.clock),
    value: valueFormatter(h.value),
  }));
}

// Rota de RAM (agora usando a função genérica)
app.get("/api/history/:hostid/ram", async (req, res) => {
  try {
    const data = await getZabbixHistory(
      req.params.hostid,
      "vm.memory.size[used]",
      3, // Numérico (bytes)
      (v) => parseFloat(v) / 1024 / 1024 / 1024 // Formata para GB
    );
    res.json(data);
  } catch (err) {
    console.error("Erro ao buscar histórico de RAM:", err.message);
    res.status(500).json({ error: "Erro ao buscar histórico de RAM" });
  }
});

// >>> ROTA NOVA PARA CPU <<<
app.get("/api/history/:hostid/cpu", async (req, res) => {
  try {
    const data = await getZabbixHistory(
      req.params.hostid,
      "system.cpu.util",
      0 // Float (%)
    );
    res.json(data);
  } catch (err) {
    console.error("Erro ao buscar histórico de CPU:", err.message);
    res.status(500).json({ error: "Erro ao buscar histórico de CPU" });
  }
});

// >>> ROTA NOVA PARA DISCO <<<
app.get("/api/history/:hostid/disk", async (req, res) => {
  try {
    // Assumindo que você quer o % de uso do disco C:
    const data = await getZabbixHistory(
      req.params.hostid,
      "vfs.fs.size[C:,pused]",
      0 // Float (%)
    );
    res.json(data);
  } catch (err) {
    console.error("Erro ao buscar histórico de Disco:", err.message);
    res.status(500).json({ error: "Erro ao buscar histórico de Disco" });
  }
});


// ===================================================================
// ... (COLE AQUI O RESTO DO SEU CÓDIGO)
// Rota /api/computers, /api/host/:id, app.listen, etc.
// ...
// ===================================================================

async function processHostsInChunks(hosts, chunkSize = 10) {
  let allResults = [];
  for (let i = 0; i < hosts.length; i += chunkSize) {
    const chunk = hosts.slice(i, i + chunkSize);
    console.log(`🌀 Processando lote ${Math.floor(i / chunkSize) + 1} com ${chunk.length} hosts...`);

    const chunkPromises = chunk.map(async (host) => {
      const metrics = await getHostMetrics(host.hostid, host.name);
      const ip = host.interfaces[0]?.ip || "N/A";
      const group = host.groups[0]?.name || "Sem Grupo";
      const status = metrics.pingAlive || metrics.agentStatus === "online" ? "online" : "offline";

      return {
        id: parseInt(host.hostid),
        name: host.name,
        ip,
        group,
        status,
        ...metrics,
        lastUpdate: new Date().toISOString(),
      };
    });

    const settledResults = await Promise.allSettled(chunkPromises);
    
    settledResults.forEach(result => {
        if (result.status === 'fulfilled') {
            allResults.push(result.value);
        } else {
            console.warn(`⚠️ Host falhou no processamento:`, result.reason);
        }
    });
  }
  return allResults;
}

app.get("/api/computers", async (req, res) => {
  try {
    const hosts = await getZabbixHosts();
    if (!hosts || hosts.length === 0) {
      return res.json([]);
    }

    console.log(`🔍 Iniciando carregamento de métricas para ${hosts.length} hosts em lotes...`);

    // Usa a nova função para processar com concorrência limitada
    const results = await processHostsInChunks(hosts, 10); // Processa 10 hosts por vez

    console.log(`✅ Métricas carregadas de ${results.length} hosts`);
    res.json(results);

  } catch (err) {
    console.error("❌ Erro na rota /api/computers:", err);
    res.status(500).json({ error: "Erro interno ao buscar hosts" });
  }
});

app.get("/api/host/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const hosts = await getZabbixHosts();
    const host = hosts.find((h) => h.hostid === id);
    if (!host) return res.status(404).json({ error: "Host não encontrado" });

    const metrics = await getHostMetrics(host.hostid, host.name);

    const ip = host.interfaces[0]?.ip || "N/A";
    const group = host.groups[0]?.name || "Sem Grupo";
    const status =
      metrics.pingAlive || metrics.agentStatus === "online"
        ? "online"
        : "offline";

    res.json({
      id: parseInt(host.hostid),
      name: host.name,
      ip,
      group,
      status,
      ...metrics,
    });
  } catch (err) {
    console.error("Erro ao buscar host:", err);
    res.status(500).json({ error: "Erro interno ao buscar host" });
  }
});

// ===================================================================
// INICIALIZAÇÃO DO SERVIDOR
// ===================================================================
app.listen(PORT, async () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  await authenticateZabbix();
});

// Reautenticação periódica para manter o token válido
setInterval(async () => {
  console.log("♻️ Reautenticando no Zabbix (agendado)...");
  await authenticateZabbix();
}, 3600000); // 1 hora