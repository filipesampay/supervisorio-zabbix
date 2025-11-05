// js/ui.js
import { formatPing, formatBytes, formatUptime, formatMbps, getUsageClass, getCategory, shouldShowAgentBadge } from './utils.js';
// ADICIONE AS NOVAS FUNÇÕES AO IMPORT
import { fetchRamHistory, fetchCpuHistory, fetchDiskHistory, sendWakeOnLan } from './api.js';

// ... (cole aqui suas funções renderBlockFilter, renderComputers, applySort, createGroupHTML, e createComputerCard) ...

// =======================================================
// RENDERIZAÇÃO PRINCIPAL
// =======================================================

export function renderBlockFilter(computers, state) {
  const filterContainer = document.getElementById('blockFilter');
  if (!filterContainer) return;
  const sf = state?.sort?.field || '';
  const sd = state?.sort?.dir || 'asc';
  const ff = state?.filter?.field || '';
  const fo = state?.filter?.op || '';
  const fv = state?.filter?.value || '';
  filterContainer.innerHTML = `
    <div class="filter-builder">
      <div class="filter-row">
        <label>Filtrar por</label>
        <select id="filterField">
          <option value="">(Sem filtro)</option>
          <option value="name" ${ff==='name'?'selected':''}>Nome</option>
          <option value="group" ${ff==='group'?'selected':''}>Grupo</option>
          <option value="ip" ${ff==='ip'?'selected':''}>IP</option>
          <option value="agentStatus" ${ff==='agentStatus'?'selected':''}>Agente</option>
          <option value="category" ${ff==='category'?'selected':''}>Categoria</option>
          <option value="cpu" ${ff==='cpu'?'selected':''}>CPU</option>
          <option value="ram" ${ff==='ram'?'selected':''}>RAM</option>
          <option value="ping" ${ff==='ping'?'selected':''}>Ping</option>
        </select>
        <select id="filterOp">${fo ? `<option value="${fo}" selected>${fo}</option>` : ''}</select>
        <input id="filterValue" value="${fv ?? ''}" placeholder="valor" />
        <button id="filterClear" class="filter-btn">Limpar</button>
      </div>
      <div class="filter-row">
        <label>Ordenar</label>
        <select id="sortField">
          <option value="">(Sem ordenação)</option>
          <option value="name" ${sf==='name'?'selected':''}>Nome</option>
          <option value="group" ${sf==='group'?'selected':''}>Grupo</option>
          <option value="cpu" ${sf==='cpu'?'selected':''}>CPU</option>
          <option value="ram" ${sf==='ram'?'selected':''}>RAM</option>
          <option value="ping" ${sf==='ping'?'selected':''}>Ping</option>
          <option value="agentStatus" ${sf==='agentStatus'?'selected':''}>Agente</option>
        </select>
        <select id="sortDir">
          <option value="asc" ${sd==='asc'?'selected':''}>Crescente</option>
          <option value="desc" ${sd==='desc'?'selected':''}>Decrescente</option>
        </select>
      </div>
    </div>`;
}

export function renderComputers(computers, state) {
  const grid = document.getElementById('computersGrid');
  if (!grid) return;

  let filtered = [...computers];

  // Filtro personalizado
  const f = state.filter || {};
  if (f.field && f.op) {
    filtered = filtered.filter((pc) => {
      const val = (pc[f.field] ?? '').toString().toLowerCase();
      const raw = pc[f.field];
      const num = typeof raw === 'number' ? raw : parseFloat(raw);
      const cmp = (f.value ?? '').toString().toLowerCase();
      switch (f.op) {
        case 'contains': return val.includes(cmp);
        case 'eq': return val === cmp || (Number.isFinite(num) && num === parseFloat(f.value));
        case 'gt': return Number.isFinite(num) && num > parseFloat(f.value);
        case 'gte': return Number.isFinite(num) && num >= parseFloat(f.value);
        case 'lt': return Number.isFinite(num) && num < parseFloat(f.value);
        case 'lte': return Number.isFinite(num) && num <= parseFloat(f.value);
        default: return true;
      }
    });
  }

  // Busca
  if (state.searchTerm.trim() !== '') {
    filtered = filtered.filter(pc =>
      pc.name?.toLowerCase().includes(state.searchTerm) ||
      pc.group?.toLowerCase().includes(state.searchTerm) ||
      pc.ip?.includes(state.searchTerm)
    );
  }

  // Ordenação customizada
  applySort(filtered, state.sort);

  // Agrupamento
  const grouped = filtered.reduce((acc, pc) => {
    const groupName = pc.group || 'Sem Grupo';
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(pc);
    return acc;
  }, {});

  if (Object.keys(grouped).length === 0) {
    grid.innerHTML = `<p class="no-results">Nenhum equipamento encontrado.</p>`;
    return;
  }

  grid.innerHTML = Object.keys(grouped)
    .sort((a, b) => a.localeCompare(b))
    .map(groupName => createGroupHTML(groupName, grouped[groupName], state.pingResults, state.computers))
    .join('');
}

// =======================================================
// FUNÇÕES AUXILIARES DE GERAÇÃO DE HTML (não exportadas)
// =======================================================

function applySort(list, sort) {
  if (!sort || !sort.field) return list;
  const dir = sort.dir === 'desc' ? -1 : 1;
  list.sort((a, b) => {
    const va = a[sort.field];
    const vb = b[sort.field];
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
    return String(va ?? '').localeCompare(String(vb ?? '')) * dir;
  });
}

function createGroupHTML(group, list, pingResults, allComputers) {
  return `
    <div class="computer-group">
      <div class="group-header"><h2>${group} (${list.length})</h2></div>
      <div class="group-grid">${list.map(pc => createComputerCard(pc, pingResults, allComputers)).join('')}</div>
    </div>`;
}

function createComputerCard(pc, pingResults) {
    const cat = getCategory(pc);
    const ping = pingResults[pc.id] || { status: null, time: null };
    const { pingText, pingClass } = formatPing(ping);

    const pingBadge = pc.pingAlive ? `<span class="status-badge online">ONLINE</span>` : `<span class="status-badge offline">OFFLINE</span>`;
    const agentBadge = (shouldShowAgentBadge(pc) && pc.agentStatus) ? (pc.agentStatus === 'online' ? `<span class="status-badge agent-online">AGENTE ON</span>` : pc.agentStatus === 'offline' ? `<span class="status-badge agent-offline">AGENTE OFF</span>` : '') : '';

    const macHtml = pc.macAddress ? `<span class=\"mac-label\">MAC: ${pc.macAddress}</span>` : '<span class=\"mac-label\">MAC: -</span>';
    const wolBtn = pc.macAddress
        ? `<button class=\"wol-btn\" title=\"Wake on LAN\" onclick=\"event.stopPropagation(); wakeOnLan('${pc.macAddress}')\"><i class=\"fas fa-power-off\"></i></button>`
        : `<button class=\"wol-btn\" disabled title=\"Sem MAC\"><i class=\"fas fa-power-off\"></i></button>`;

    return `
        <div class="computer-card" id="host-card-${pc.id}" data-cat="${cat}" onclick="toggleExpand(${pc.id}, this)">
            <div class="card-header">
                <h3>${pc.name}</h3>
                <div class="status-area">${pingBadge}${agentBadge}</div>
            </div>
            <div class="metrics">
                ${cat === 'computer' ? `
                    <div class="metric"><div class="metric-header"><span class="metric-label">CPU</span><span class="metric-value">${pc.cpu?.toFixed(1) ?? 0}%</span></div><div class="progress-bar"><div class="progress-fill ${getUsageClass(pc.cpu)}" style="width:${pc.cpu ?? 0}%"></div></div></div>
                    <div class="metric"><div class="metric-header"><span class="metric-label">RAM</span><span class="metric-value">${pc.ram?.toFixed(1) ?? 0}%</span></div><div class="progress-bar"><div class="progress-fill ${getUsageClass(pc.ram)}" style="width:${pc.ram ?? 0}%"></div></div></div>` : ''}
                ${cat === 'network' ? `<div class="metric metric-net"><span class="metric-label">Tráfego</span><div class="net-pair"><span class="metric-value net-val"><i class="fas fa-arrow-down"></i> ${pc.netRx ? formatMbps(pc.netRx) : '—'}</span><span class="metric-value net-val up"><i class="fas fa-arrow-up"></i> ${pc.netTx ? formatMbps(pc.netTx) : '—'}</span></div></div>` : ''}
                ${cat === 'camera' ? `<div class="metric"><span class="metric-label">Perda</span><span class="metric-value">${pc.pingLoss?.toFixed(2) ?? '—'}%</span></div>` : ''}
                ${pc.ink && Object.values(pc.ink).some(v => v !== null) ? (() => { // Condição melhorada
                    const renderInkTank = (color, level) => {
                        if (level === null || level === undefined) return ''; // Não renderiza o tanque se o nível for nulo
                        const value = Math.max(0, Math.min(100, level));
                        return `<div class="ink-tank" title="${value.toFixed(0)}%"><div class="ink-fill" style="height:${value}%; background-color:${color};"></div></div>`;
                    };

                    const inkTanks = [
                        renderInkTank('#000', pc.ink.black),
                        renderInkTank('#00bcd4', pc.ink.cyan),
                        renderInkTank('#e91e63', pc.ink.magenta),
                        renderInkTank('#facc15', pc.ink.yellow)
                    ].filter(Boolean).join(''); // Filtra os tanques vazios

                    const isMonochrome = inkTanks.includes('background-color:#000') && !inkTanks.includes('cyan') && !inkTanks.includes('magenta') && !inkTanks.includes('yellow');
                    const lowInk = Object.values(pc.ink).some(v => v !== null && v < 15);
                    const inkBadge = lowInk ? `<span class="status-badge ink-low">TINTA BAIXA</span>` : '';
                    
                    return `<div class="ink-break"></div><div class="metric ink-levels ${isMonochrome ? 'single-ink' : ''}">${inkBadge}${inkTanks}</div>`;
                })() : ''}
            </div>
            <div class="card-extras">
                ${macHtml}
                ${wolBtn}
            </div>
            <div class="card-footer">
                <span class="ping-label">Ping:</span>
                <span class="ping-chip ${pingClass}">${pingText}</span>
            </div>
        </div>`;
}
// =======================================================
// POP-IN E GRÁFICO (SEÇÃO COMPLETAMENTE REFEITA)
// =======================================================

/**
 * Função auxiliar para criar um gráfico de histórico.
 */
function createHistoryChart(container, canvasId, title, chartLabel, data, yAxisCallback, borderColor) {
    if (!data || !Array.isArray(data) || data.length === 0) {
        container.insertAdjacentHTML('beforeend', `<div class="chart-container"><p>${title}: Sem dados de histórico disponíveis.</p></div>`);
        return;
    }

    container.insertAdjacentHTML('beforeend', `<div class="chart-container"><h4>${title}</h4><canvas id="${canvasId}" height="130"></canvas></div>`);
    const labels = data.map(d => new Date(d.time * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    const values = data.map(d => Number(d.value) || 0);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: chartLabel, data: values,
                borderColor: borderColor, backgroundColor: `${borderColor}33`, // Cor com transparência
                fill: true, tension: 0.3, pointRadius: 0
            }]
        },
        options: {
            scales: {
                x: { ticks: { color: '#bbb', maxTicksLimit: 8 }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { beginAtZero: true, ticks: { color: '#bbb', callback: yAxisCallback }, grid: { color: 'rgba(255,255,255,0.05)' } }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#222', titleColor: '#fff', bodyColor: '#fff', displayColors: false,
                    callbacks: { label: (ctx) => `${chartLabel}: ${yAxisCallback(ctx.parsed.y)}` }
                }
            }
        }
    });
}

async function toggleExpand(id, el, allComputers) {
    if (el.classList.contains('popin-active')) return closePopin();
    closePopin();

    const pc = allComputers.find(p => p.id === id);
    if (!pc) return;

    // Cria a base do pop-in
    const clone = el.cloneNode(true);
    clone.classList.add('popin-card');
    clone.removeAttribute('onclick');
    clone.insertAdjacentHTML('beforeend', `
        <div class="popin-details">
            <hr>
            <p><strong>Grupo:</strong> ${pc.group ?? '—'}</p>
            <p><strong>IP:</strong> ${pc.ip ?? '—'}</p>
            <p><strong>Status Agente:</strong> ${pc.agentStatus?.toUpperCase() ?? '-'}</p>
            <p><strong>MAC:</strong> ${pc.macAddress ?? '—'}</p>
            <p><strong>Uptime:</strong> ${formatUptime(pc.uptimeSec)}</p>
            <p><strong>RAM Total:</strong> ${formatBytes(pc.totalRam)}</p>
            <p><strong>Disco Total:</strong> ${formatBytes(pc.totalDisk)}</p>
            <div id="charts-wrapper"></div>
        </div>`);

    const overlay = document.createElement('div');
    overlay.className = 'popin-overlay';
    overlay.appendChild(clone);
    overlay.addEventListener('click', (e) => {
        if (e.target.classList.contains('popin-overlay')) closePopin();
    });
    document.body.appendChild(overlay);
    requestAnimationFrame(() => clone.classList.add('show'));
    try { localStorage.setItem('expandedHostId', String(id)); } catch (_) {}

    // Para de executar se não for um computador
    if (getCategory(pc) !== 'computer') return;

    const chartsWrapper = clone.querySelector('#charts-wrapper');
    chartsWrapper.innerHTML = `<p>Carregando gráficos...</p>`;

    try {
        // Busca todos os dados em paralelo para mais performance
        const [ramHistory, cpuHistory, diskHistory] = await Promise.all([
            fetchRamHistory(pc.id),
            fetchCpuHistory(pc.id),
            fetchDiskHistory(pc.id)
        ]);

        chartsWrapper.innerHTML = ''; // Limpa a mensagem de "carregando"

        // Renderiza cada gráfico usando a função auxiliar
        createHistoryChart(chartsWrapper, 'cpuChart', '📈 Histórico de CPU (24h)', 'CPU', cpuHistory, v => `${v.toFixed(1)} %`, '#e91e63');
        createHistoryChart(chartsWrapper, 'ramChart', 'Histórico de RAM (%) (24h)', 'RAM', ramHistory, v => `${v.toFixed(1)} %`, '#00bcd4');
        createHistoryChart(chartsWrapper, 'diskChart', 'Histórico de Disco (%) (24h)', 'Uso', diskHistory, v => `${v.toFixed(1)} %`, '#facc15');

    } catch (err) {
        console.error('Erro ao carregar dados de histórico:', err);
        chartsWrapper.innerHTML = `<p>Falha ao carregar os gráficos.</p>`;
    }
}

function closePopin() {
    document.querySelectorAll('.popin-overlay').forEach(o => o.remove());
    try { localStorage.removeItem('expandedHostId'); } catch (_) {}
}

// =======================================================
// INICIALIZAÇÃO E EXPORTAÇÕES GERAIS
// =======================================================
export function initializeUiFunctions(allComputers) {
    window.toggleExpand = (id, el) => toggleExpand(id, el, allComputers);
    window.closePopin = closePopin;
    window.wakeOnLan = async (mac) => {
        try {
            const res = await sendWakeOnLan(mac);
            alert(res && res.ok ? 'Pacote WOL enviado.' : (res?.error || 'Falha ao enviar WOL.'));
        } catch (e) {
            alert('Erro ao enviar WOL: ' + (e?.message || 'desconhecido'));
        }
    };
}

export function showLoading(show) {
    const modal = document.getElementById('loadingModal');
    if (modal) modal.classList.toggle('active', show);
}

















