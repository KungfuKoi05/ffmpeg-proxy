// Local storage on this device only. Every access is wrapped because storage can be
// unavailable (private windows, blocked site data). Uploaded file contents are never stored.

import type { Recipe } from '../engine/types'
import { isRecipe } from '../engine/recipes'

const RECIPES = 'cleancsv.recipes.v1'
const HISTORY = 'cleancsv.history.v1'

export interface HistoryRecord {
  id: string
  fileName: string
  exportName: string
  at: string
  rowsBefore: number
  rowsAfter: number
  columnsBefore: number
  columnsAfter: number
  steps: string[]
}

function read<T>(key: string, check: (x: unknown) => x is T): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const data: unknown = JSON.parse(raw)
    return Array.isArray(data) ? data.filter(check) : []
  } catch {
    return []
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

const isHistory = (x: unknown): x is HistoryRecord =>
  !!x && typeof x === 'object' && typeof (x as HistoryRecord).id === 'string' && typeof (x as HistoryRecord).fileName === 'string' && Array.isArray((x as HistoryRecord).steps)

export const storage = {
  loadRecipes: () => read<Recipe>(RECIPES, isRecipe),
  saveRecipes: (r: Recipe[]) => write(RECIPES, r),
  loadHistory: () => read<HistoryRecord>(HISTORY, isHistory),
  saveHistory: (h: HistoryRecord[]) => write(HISTORY, h.slice(0, 100)),
  clearHistory: () => {
    try {
      localStorage.removeItem(HISTORY)
    } catch {
      // nothing to clear
    }
  },
  clearAll: () => {
    try {
      localStorage.removeItem(HISTORY)
      localStorage.removeItem(RECIPES)
    } catch {
      // nothing to clear
    }
  },
  available: () => {
    try {
      const k = 'cleancsv.test'
      localStorage.setItem(k, '1')
      localStorage.removeItem(k)
      return true
    } catch {
      return false
    }
  },
}
