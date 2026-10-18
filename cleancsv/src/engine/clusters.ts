// Finds values in a column that are probably the same thing written differently:
// "Electronics" / "electronics " / "ELECTRONICS", "USA" / "United States", "Jewelery" / "Jewelry".
// These are suggestions only. Nothing is merged unless the user ticks the group.

import { caseStyle, fingerprint, hasEdgeSpace, levenshtein } from './values'

export interface ValueCluster {
  /** case: differ only in capitals, spaces or punctuation (safe). synonym: known alternative names. spelling: one or two letters apart (check carefully). */
  kind: 'case' | 'synonym' | 'spelling'
  values: { value: string; count: number }[]
  suggested: string
  /** Case-only groups start ticked. Synonyms and spelling groups start unticked. */
  preselected: boolean
}

const SYNONYMS: [string, string[]][] = [
  ['us', ['us', 'usa', 'united states', 'united states of america']],
  ['uk', ['uk', 'gb', 'united kingdom', 'great britain']],
  ['uae', ['uae', 'united arab emirates']],
  ['yes', ['yes', 'y', 'true']],
  ['no', ['no', 'n', 'false']],
]
const synonymOf = new Map<string, string>()
for (const [id, forms] of SYNONYMS) for (const f of forms) synonymOf.set(f, id)

/** "U.S.A." -> "usa", "United  States" -> "united states" */
function synKey(v: string): string {
  return v
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

class UnionFind {
  parent: number[]
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i)
  }
  find(i: number): number {
    while (this.parent[i] !== i) {
      this.parent[i] = this.parent[this.parent[i]]
      i = this.parent[i]
    }
    return i
  }
  union(a: number, b: number) {
    this.parent[this.find(a)] = this.find(b)
  }
}

const MAX_DISTINCT = 500
const MAX_FUZZY = 300

export function findClusters(counts: Map<string, number>): ValueCluster[] {
  const values = [...counts.keys()].filter((v) => v.trim() !== '')
  if (values.length < 2 || values.length > MAX_DISTINCT) return []
  const uf = new UnionFind(values.length)
  const kinds = new Map<number, Set<ValueCluster['kind']>>()
  const link = (a: number, b: number, kind: ValueCluster['kind']) => {
    uf.union(a, b)
    for (const i of [a, b]) {
      if (!kinds.has(i)) kinds.set(i, new Set())
      kinds.get(i)!.add(kind)
    }
  }

  const fps = values.map(fingerprint)
  const byFp = new Map<string, number>()
  fps.forEach((fp, i) => {
    if (fp === '') return
    const first = byFp.get(fp)
    if (first === undefined) byFp.set(fp, i)
    else link(first, i, 'case')
  })

  const bySyn = new Map<string, number>()
  const syns = values.map((v) => synonymOf.get(synKey(v)))
  syns.forEach((syn, i) => {
    if (!syn) return
    const first = bySyn.get(syn)
    if (first === undefined) bySyn.set(syn, i)
    else if (fps[first] !== fps[i]) link(first, i, 'synonym')
    else uf.union(first, i)
  })

  const uniqueFps = [...byFp.entries()]
  if (uniqueFps.length <= MAX_FUZZY) {
    for (let a = 0; a < uniqueFps.length; a++) {
      const [fa, ia] = uniqueFps[a]
      if (fa.length < 4) continue
      for (let b = a + 1; b < uniqueFps.length; b++) {
        const [fb, ib] = uniqueFps[b]
        if (fb.length < 4) continue
        // Values that differ in their numbers ("Size 10" vs "Size 11") are different things.
        if (fa.replace(/\D/g, '') !== fb.replace(/\D/g, '')) continue
        if (syns[ia] || syns[ib]) continue
        const max = Math.min(fa.length, fb.length) > 8 ? 2 : 1
        if (levenshtein(fa, fb, max) <= max) link(ia, ib, 'spelling')
      }
    }
  }

  const groups = new Map<number, number[]>()
  values.forEach((_, i) => {
    if (!kinds.has(i)) return
    const root = uf.find(i)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root)!.push(i)
  })

  const clusters: ValueCluster[] = []
  for (const members of groups.values()) {
    if (members.length < 2) continue
    const allKinds = new Set<ValueCluster['kind']>()
    for (const m of members) for (const k of kinds.get(m) ?? []) allKinds.add(k)
    const kind = allKinds.has('spelling') ? 'spelling' : allKinds.has('synonym') ? 'synonym' : 'case'
    const vals = members
      .map((i) => ({ value: values[i], count: counts.get(values[i]) ?? 0 }))
      .sort((x, y) => y.count - x.count || x.value.localeCompare(y.value))
    clusters.push({ kind, values: vals, suggested: pickTarget(vals), preselected: kind === 'case' })
  }
  return clusters.sort((a, b) => total(b) - total(a))
}

function total(c: ValueCluster): number {
  return c.values.reduce((s, v) => s + v.count, 0)
}

/** The most common spelling wins. On a tie, prefer one without stray spaces and with normal capitals. */
function pickTarget(vals: { value: string; count: number }[]): string {
  const score = (v: string) => (hasEdgeSpace(v) ? 0 : 2) + (caseStyle(v) === 'title' ? 1 : 0)
  return [...vals].sort((a, b) => b.count - a.count || score(b.value) - score(a.value))[0].value.trim()
}
