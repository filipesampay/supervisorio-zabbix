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