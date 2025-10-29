// js/main.js
import { fetchComputers } from './api.js';
import { renderComputers, renderBlockFilter, showLoading, initializeUiFunctions } from './ui.js';
import { setupSearchBar, setupSortMenu } from './events.js';

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
  renderBlockFilter(state.computers, state.selectedBlock);
  rerender();
};

document.addEventListener('DOMContentLoaded', async () => {
  showLoading(true);

  setupSearchBar((term) => {
    state.searchTerm = term;
    rerender();
  });

  setupSortMenu((sortValue) => {
    state.currentSort = sortValue;
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
  
  // Renderização inicial
  renderBlockFilter(state.computers, state.selectedBlock);
  rerender();
  
  showLoading(false);
});