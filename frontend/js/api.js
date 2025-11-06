// js/api.js

const API_URL = 'http://192.168.1.5:3000/api';

/**
 * Busca a lista completa de computadores.
 */
export async function fetchComputers() {
  try {
    const response = await fetch(`${API_URL}/computers`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Falha ao buscar computadores:", error);
    return []; // Retorna um array vazio em caso de erro
  }
}

/**
 * Busca o histórico de RAM para um ID específico.
 */
export async function fetchRamHistory(computerId) {
    try {
        const response = await fetch(`${API_URL}/history/${computerId}/ram`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Falha ao buscar histórico de RAM para ID ${computerId}:`, error);
        return null; // Retorna nulo em caso de erro
    }
}

export async function fetchCpuHistory(computerId) {
    try {
        const response = await fetch(`${API_URL}/history/${computerId}/cpu`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Falha ao buscar histórico de CPU para ID ${computerId}:`, error);
        return null;
    }
}

/**
 * Busca o histórico de Disco para um ID específico.
 */
export async function fetchDiskHistory(computerId) {
    try {
        const response = await fetch(`${API_URL}/history/${computerId}/disk`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Falha ao buscar histórico de Disco para ID ${computerId}:`, error);
        return null;
    }
}

export async function fetchFwSessions(computerId) {
  try {
    const response = await fetch(`${API_URL}/history/${computerId}/fw_sessions`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (e) { console.error('Falha ao buscar sessões FW:', e); return null; }
}

export async function fetchNasStorageUsed(computerId) {
  try {
    const response = await fetch(`${API_URL}/history/${computerId}/storage_used`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (e) { console.error('Falha ao buscar storage NAS:', e); return null; }
}

export async function fetchUnifiPoePower(computerId) {
  try {
    const response = await fetch(`${API_URL}/history/${computerId}/poe_power`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (e) { console.error('Falha ao buscar PoE power:', e); return null; }
}

export async function fetchUnifiPortsUp(computerId) {
  try {
    const response = await fetch(`${API_URL}/history/${computerId}/ports_up`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (e) { console.error('Falha ao buscar portas UP:', e); return null; }
}

/**
 * Dispara Wake-on-LAN para um MAC informado.
 */
export async function sendWakeOnLan(mac) {
  try {
    const response = await fetch(`${API_URL}/wol`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mac }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Falha ao enviar WOL:', error);
    throw error;
  }
}
