// js/main.js
import { fetchComputers } from './api.js?v=2';
import { renderComputers, renderBlockFilter, showLoading, initializeUiFunctions } from './ui.js';
import { setupSearchBar, setupSortMenu, setupFilterBuilder } from './events.js';

// Estado da aplicação
const state = {
  computers: [],
  pingResults: {},
  selectedBlock: 'all',
  searchTerm: '',
  currentSort: '',
};

function rerender() {
    renderComputers(state.computers, state);
}

window.selectBlock = (group) => {
  state.selectedBlock = group;
  try { localStorage.setItem('ui.selectedBlock', group); } catch (_) {}
  renderBlockFilter(state.computers, state);
  setupFilterBuilder(({ filter, sort }) => {
    state.filter = filter;
    state.sort = sort;
    try {
      localStorage.setItem('ui.filter', JSON.stringify(filter));
      localStorage.setItem('ui.sort', JSON.stringify(sort));
    } catch (_) {}
    rerender();
  });
  rerender();
};

document.addEventListener('DOMContentLoaded', async () => {
  showLoading(true);

  // Restaura preferências de UI
  try {
    const persistedBlock = localStorage.getItem('ui.selectedBlock');
    const persistedSearch = localStorage.getItem('ui.searchTerm');
    const persistedSort = localStorage.getItem('ui.currentSort');
    if (persistedBlock) state.selectedBlock = persistedBlock;
    if (persistedSearch) state.searchTerm = persistedSearch;
    if (persistedSort) state.currentSort = persistedSort;

    const searchEl = document.getElementById('searchInput');
    if (searchEl && state.searchTerm) searchEl.value = state.searchTerm;
    const sortEl = document.getElementById('sortSelect');
    if (sortEl && state.currentSort) sortEl.value = state.currentSort;
  } catch (_) {}

  setupSearchBar((term) => {
    state.searchTerm = term;
    try { localStorage.setItem('ui.searchTerm', term); } catch (_) {}
    rerender();
  });
  // Inicializa construtor de filtros e ordenação
  setupFilterBuilder(({ filter, sort }) => {
    state.filter = filter;
    state.sort = sort;
    try {
      localStorage.setItem('ui.filter', JSON.stringify(filter));
      localStorage.setItem('ui.sort', JSON.stringify(sort));
    } catch (_) {}
    rerender();
  });

  setupSortMenu((sortValue) => {
    state.currentSort = sortValue;
    try { localStorage.setItem('ui.currentSort', sortValue); } catch (_) {}
    rerender();
  });
  
  // Busca os dados iniciais
  state.computers = await fetchComputers();
  
  // Mapeia os resultados de ping
  state.computers.forEach(pc => {
    state.pingResults[pc.id] = {
      status: pc.pingAlive ? 'ok' : 'fail',
      time: pc.ping || null
    };
  });

  // IMPORTANTE: Inicializa as funções da UI DEPOIS de ter os dados
  initializeUiFunctions(state.computers);
  
  // Renderização inicial\n  renderBlockFilter(state.computers, state);
  setupFilterBuilder(({ filter, sort }) => {
    state.filter = filter;
    state.sort = sort;
    try {
      localStorage.setItem('ui.filter', JSON.stringify(filter));
      localStorage.setItem('ui.sort', JSON.stringify(sort));
    } catch (_) {}
    rerender();
  });
  rerender();
  // Restaura card expandido, se houver
  try {
    const expandedId = localStorage.getItem('expandedHostId');
    if (expandedId) {
      const card = document.getElementById(`host-card-${expandedId}`);
      if (card && window.toggleExpand) window.toggleExpand(Number(expandedId), card);
    }
  } catch (_) {}
  
  showLoading(false);

  // Atualização periódica (ping e demais métricas) a cada 60s
  const refresh = async () => {
    try {
      const latest = await fetchComputers();
      if (!Array.isArray(latest) || latest.length === 0) return;

      state.computers = latest;
      state.pingResults = {};
      state.computers.forEach(pc => {
        state.pingResults[pc.id] = {
          status: pc.pingAlive ? 'ok' : 'fail',
          time: pc.ping || null
        };
      });

      // Mantém filtro atual e re-renderiza
      renderBlockFilter(state.computers, state);
  setupFilterBuilder(({ filter, sort }) => {
    state.filter = filter;
    state.sort = sort;
    try {
      localStorage.setItem('ui.filter', JSON.stringify(filter));
      localStorage.setItem('ui.sort', JSON.stringify(sort));
    } catch (_) {}
    rerender();
  });
  rerender();

      // Reabre card expandido, se ainda existir
      try {
        const expandedId = localStorage.getItem('expandedHostId');
        if (expandedId) {
          const card = document.getElementById(`host-card-${expandedId}`);
          if (card && window.toggleExpand) window.toggleExpand(Number(expandedId), card);
        }
      } catch (_) {}
    } catch (e) {
      console.warn('Falha ao atualizar métricas periodicamente:', e?.message || e);
    }
  };

  setInterval(refresh, 60_000);
});











