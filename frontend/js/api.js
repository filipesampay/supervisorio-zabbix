// js/api.js

const API_URL = 'http://192.168.5.148:3000/api';

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