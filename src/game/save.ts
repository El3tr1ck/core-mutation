import { Card } from './types';

export interface SaveData {
  id: string; // run id or slot
  date: string;
  level: number;
  deck: Card[];
}

export const SAVE_KEY = 'survivor_save_slots';

export function getSaves(): SaveData[] {
  try {
    const data = localStorage.getItem(SAVE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

export function saveGame(saveData: SaveData) {
  const saves = getSaves();
  const existingIndex = saves.findIndex(s => s.id === saveData.id);
  
  if (existingIndex >= 0) {
    saves[existingIndex] = saveData;
  } else {
    saves.push(saveData);
  }
  
  localStorage.setItem(SAVE_KEY, JSON.stringify(saves));
}

export function loadGame(id: string): SaveData | null {
  const saves = getSaves();
  return saves.find(s => s.id === id) || null;
}
