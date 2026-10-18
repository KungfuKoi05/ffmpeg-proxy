// App-wide state: the current cleaning session, saved recipes and local history.
// Everything lives in memory or in this browser's local storage. Nothing is sent anywhere.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Analysis } from './engine/analyze'
import { useAnalysis } from './lib/useAnalysis'
import { ActionError } from './engine/actions'
import * as H from './engine/history'
import { newRecipe } from './engine/recipes'
import type { ActionResult, ImportMeta, ParseResult, Recipe, Rule, Step, Table } from './engine/types'
import { storage, type HistoryRecord } from './lib/storage'
import type { Source } from './lib/readFile'

export type Route = 'clean' | 'history' | 'recipes' | 'help'
export type StepNo = 1 | 2 | 3 | 4

export interface Notice {
  id: number
  text: string
  tone: 'success' | 'error' | 'info'
  undoable?: boolean
}

export interface RowFilter {
  label: string
  rowIds: number[]
}

export interface Upload {
  source: Source
  encoding: string
  delimiter: string
  result: ParseResult | null
  parsing: boolean
}

interface Ctx {
  route: Route
  navigate: (r: Route) => void
  step: StepNo
  setStep: (s: StepNo) => void
  upload: Upload | null
  setUpload: (u: Upload | null | ((prev: Upload | null) => Upload | null)) => void
  session: H.Session | null
  table: Table | null
  analysis: Analysis | null
  /** True while the problem list is being updated in the background (big files only). */
  analysisPending: boolean
  startSession: (table: Table, meta: ImportMeta) => void
  clearSession: () => void
  apply: (step: Step, precomputed?: ActionResult, kind?: H.SessionEvent['kind']) => boolean
  /** Applies several steps (from a recipe) one after another. Steps that fail are skipped and counted. */
  applyMany: (steps: Step[], rules?: Rule[], label?: string) => void
  undo: () => void
  redo: () => void
  reset: () => void
  setRules: (rules: Rule[]) => void
  notice: Notice | null
  notify: (text: string, tone?: Notice['tone'], undoable?: boolean) => void
  dismissNotice: () => void
  rowFilter: RowFilter | null
  setRowFilter: (f: RowFilter | null) => void
  focusFix: string | null
  setFocusFix: (id: string | null) => void
  pendingRecipe: string | null
  setPendingRecipe: (id: string | null) => void
  recipes: Recipe[]
  /** Returns the recipe and whether it was actually written to this browser's storage. */
  saveRecipe: (name: string) => { recipe: Recipe; persisted: boolean } | null
  /** Returns false if the browser refused to store them (they are kept for this tab only). */
  setRecipes: (r: Recipe[]) => boolean
  history: HistoryRecord[]
  addHistory: (r: HistoryRecord) => void
  clearHistory: () => void
  storageOk: boolean
}

const AppContext = createContext<Ctx | null>(null)

export function useApp(): Ctx {
  const c = useContext(AppContext)
  if (!c) throw new Error('useApp must be used inside AppProvider')
  return c
}

function routeFromHash(): Route {
  const h = typeof location !== 'undefined' ? location.hash.replace(/^#\/?/, '') : ''
  return h === 'history' || h === 'recipes' || h === 'help' ? h : 'clean'
}

let noticeId = 1

export function AppProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>(routeFromHash)
  const [step, setStep] = useState<StepNo>(1)
  const [upload, setUpload] = useState<Upload | null>(null)
  const [session, setSession] = useState<H.Session | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [rowFilter, setRowFilter] = useState<RowFilter | null>(null)
  const [focusFix, setFocusFix] = useState<string | null>(null)
  const [pendingRecipe, setPendingRecipe] = useState<string | null>(null)
  const [recipes, setRecipesState] = useState<Recipe[]>(() => storage.loadRecipes())
  const [history, setHistory] = useState<HistoryRecord[]>(() => storage.loadHistory())
  const [storageOk] = useState(() => storage.available())

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const navigate = useCallback((r: Route) => {
    const hash = r === 'clean' ? '#/' : `#/${r}`
    if (location.hash !== hash) location.hash = hash
    setRoute(r)
    window.scrollTo?.(0, 0)
  }, [])

  const notify = useCallback((text: string, tone: Notice['tone'] = 'success', undoable = false) => {
    setNotice({ id: noticeId++, text, tone, undoable })
  }, [])

  const table = session ? H.currentTable(session) : null
  const rules = session?.rules
  const { analysis, pending: analysisPending } = useAnalysis(table, rules, session?.original)

  const startSession = useCallback((t: Table, meta: ImportMeta) => {
    setSession(H.createSession(t, meta))
    setRowFilter(null)
    setFocusFix(null)
    setNotice(null)
  }, [])

  const clearSession = useCallback(() => {
    setSession(null)
    setUpload(null)
    setRowFilter(null)
    setFocusFix(null)
    setNotice(null)
    setStep(1)
  }, [])

  const apply = useCallback(
    (s: Step, precomputed?: ActionResult, kind: H.SessionEvent['kind'] = 'applied') => {
      if (!session) return false
      try {
        const next = H.applyStep(session, s, precomputed, kind)
        setSession(next)
        setRowFilter(null)
        const e = next.entries[next.cursor - 1]
        notify(e.result.summary, 'success', true)
        return true
      } catch (err) {
        notify(err instanceof ActionError ? err.message : 'That change could not be applied. Your data was not changed.', 'error')
        return false
      }
    },
    [session, notify],
  )

  const applyMany = useCallback(
    (steps: Step[], extraRules: Rule[] = [], label = 'recipe') => {
      if (!session) return
      let s = session
      let done = 0
      let failed = 0
      for (const st of steps) {
        try {
          s = H.applyStep(s, st, undefined, 'recipe')
          done++
        } catch {
          failed++
        }
      }
      if (extraRules.length) {
        const have = new Set(s.rules.map((r) => `${r.column}|${r.kind}|${(r.allowed ?? []).join(',')}`))
        const add = extraRules.filter((r) => !have.has(`${r.column}|${r.kind}|${(r.allowed ?? []).join(',')}`))
        s = H.setRules(s, [...s.rules, ...add.map((r) => ({ ...r, id: `${r.id}-${Date.now().toString(36)}` }))])
      }
      setSession(s)
      setRowFilter(null)
      notify(
        `Applied ${done} step${done === 1 ? '' : 's'} from ${label}${failed ? `. ${failed} could not run and were skipped` : ''}.`,
        failed ? 'info' : 'success',
        done > 0,
      )
    },
    [session, notify],
  )

  const undo = useCallback(() => {
    if (!session || !H.canUndo(session)) return
    const label = session.entries[session.cursor - 1].label
    setSession(H.undo(session))
    setRowFilter(null)
    notify(`Undone: ${label}`, 'info')
  }, [session, notify])

  const redo = useCallback(() => {
    if (!session || !H.canRedo(session)) return
    const label = session.entries[session.cursor].label
    setSession(H.redo(session))
    setRowFilter(null)
    notify(`Redone: ${label}`, 'info')
  }, [session, notify])

  const reset = useCallback(() => {
    if (!session) return
    setSession(H.reset(session))
    setRowFilter(null)
    notify('Back to the original file. You can redo the steps if you change your mind.', 'info')
  }, [session, notify])

  const setRules = useCallback((r: Rule[]) => setSession((s) => (s ? H.setRules(s, r) : s)), [])

  const setRecipes = useCallback((r: Recipe[]) => {
    setRecipesState(r)
    return storage.saveRecipes(r)
  }, [])

  const saveRecipe = useCallback(
    (name: string) => {
      if (!session) return null
      const steps = H.appliedEntries(session).map((e) => e.step)
      const recipe = newRecipe(name, steps, session.rules, [...session.original.headers])
      const persisted = setRecipes([recipe, ...recipes])
      return { recipe, persisted }
    },
    [session, recipes, setRecipes],
  )

  const addHistory = useCallback((r: HistoryRecord) => {
    setHistory((h) => {
      const next = [r, ...h]
      storage.saveHistory(next)
      return next
    })
  }, [])

  const clearHistory = useCallback(() => {
    storage.clearHistory()
    setHistory([])
  }, [])

  const value: Ctx = {
    route,
    navigate,
    step,
    setStep,
    upload,
    setUpload,
    session,
    table,
    analysis,
    analysisPending,
    startSession,
    clearSession,
    apply,
    applyMany,
    undo,
    redo,
    reset,
    setRules,
    notice,
    notify,
    dismissNotice: () => setNotice(null),
    rowFilter,
    setRowFilter,
    focusFix,
    setFocusFix,
    pendingRecipe,
    setPendingRecipe,
    recipes,
    saveRecipe,
    setRecipes,
    history,
    addHistory,
    clearHistory,
    storageOk,
  }
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
