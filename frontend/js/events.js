// js/events.js

export function setupSearchBar(onSearch) {
  const input = document.getElementById('searchInput');
  if (!input) return;
  input.addEventListener('input', (e) => {
    onSearch(e.target.value.toLowerCase());
  });
}

export function setupSortMenu(onSort) {
  const select = document.getElementById('sortSelect');
  if (!select) return;
  select.addEventListener('change', (e) => {
    onSort(e.target.value);
  });
}

// Construtor de filtros e ordenação customizados
export function setupFilterBuilder(onChange) {
  const fieldEl = document.getElementById('filterField');
  const opEl = document.getElementById('filterOp');
  const valEl = document.getElementById('filterValue');
  const clearEl = document.getElementById('filterClear');
  const sortFieldEl = document.getElementById('sortField');
  const sortDirEl = document.getElementById('sortDir');
  if (!fieldEl || !opEl || !valEl || !sortFieldEl || !sortDirEl) return;

  const numericOps = [
    { v: 'gt', l: '>' },
    { v: 'gte', l: '≥' },
    { v: 'eq', l: '=' },
    { v: 'lte', l: '≤' },
    { v: 'lt', l: '<' },
  ];
  const textOps = [
    { v: 'contains', l: 'contém' },
    { v: 'eq', l: 'igual a' },
  ];

  function isNumericField(f) {
    return ['cpu', 'ram', 'ping'].includes(f);
  }

  function emit() {
    const filter = {
      field: fieldEl.value || '',
      op: opEl.value || '',
      value: valEl.value || '',
    };
    const sort = {
      field: sortFieldEl.value || '',
      dir: sortDirEl.value || 'asc',
    };
    onChange({ filter, sort });
  }

  function refreshOps() {
    const f = fieldEl.value;
    opEl.innerHTML = '';
    const ops = isNumericField(f) ? numericOps : textOps;
    ops.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.v; opt.textContent = o.l;
      opEl.appendChild(opt);
    });
    valEl.type = isNumericField(f) ? 'number' : 'text';
  }

  fieldEl.addEventListener('change', () => { refreshOps(); emit(); });
  opEl.addEventListener('change', emit);
  valEl.addEventListener('input', emit);
  sortFieldEl.addEventListener('change', emit);
  sortDirEl.addEventListener('change', emit);
  if (clearEl) clearEl.addEventListener('click', () => {
    fieldEl.value = '';
    opEl.innerHTML = '';
    valEl.value = '';
    emit();
  });

  refreshOps();
  emit();
}
