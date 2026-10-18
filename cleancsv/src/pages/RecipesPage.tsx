import { Download, Pencil, Play, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { describeStep } from '../engine/describe'
import { isRecipe } from '../engine/recipes'
import type { Recipe } from '../engine/types'
import { downloadText } from '../lib/download'
import { sanitizeFileName } from '../engine/export'
import { useApp } from '../state'
import { Alert, Button, Card, Dialog, TextInput } from '../components/ui'

const RULE_TEXT: Record<string, string> = {
  required: 'must not be empty',
  unique: 'must be different on every row',
  email: 'must contain email addresses',
  number: 'must contain numbers',
  date: 'must contain dates',
  allowed: 'may only contain certain values',
}

function RecipeCard({ r }: { r: Recipe }) {
  const { recipes, setRecipes, session, setPendingRecipe, setStep, navigate, notify } = useApp()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(r.name)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const rename = () => {
    const n = name.trim()
    if (!n) return
    setRecipes(recipes.map((x) => (x.id === r.id ? { ...x, name: n, updatedAt: new Date().toISOString() } : x)))
    setEditing(false)
  }
  const use = () => {
    if (!session) {
      notify('Open a file first, then choose “Apply a saved recipe” in the Clean step.', 'info')
      navigate('clean')
      return
    }
    setPendingRecipe(r.id)
    setStep(3)
    navigate('clean')
  }

  return (
    <Card className="p-5" data-testid="recipe-card">
      {editing ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[12rem] flex-1">
            <TextInput label="Recipe name" value={name} onChange={setName} autoFocus />
          </div>
          <Button variant="primary" onClick={rename} disabled={!name.trim()}>
            Save name
          </Button>
          <Button
            onClick={() => {
              setName(r.name)
              setEditing(false)
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold text-slate-900">{r.name}</h2>
            <p className="text-sm text-slate-500">
              {r.steps.length} step{r.steps.length === 1 ? '' : 's'}
              {r.rules.length > 0 && `, ${r.rules.length} check${r.rules.length === 1 ? '' : 's'}`} · saved {new Date(r.createdAt).toLocaleDateString('en-US')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="primary" onClick={use}>
              <Play className="h-4 w-4" aria-hidden /> Use on the open file
            </Button>
            <Button size="sm" onClick={() => setEditing(true)} aria-label={`Rename ${r.name}`}>
              <Pencil className="h-4 w-4" aria-hidden /> Rename
            </Button>
            <Button
              size="sm"
              onClick={() => downloadText(`${sanitizeFileName(r.name, 'recipe')}.cleancsv-recipe.json`, JSON.stringify(r, null, 2), 'application/json')}
              aria-label={`Download ${r.name} as a file`}
            >
              <Download className="h-4 w-4" aria-hidden /> Export
            </Button>
            <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)} aria-label={`Delete ${r.name}`}>
              <Trash2 className="h-4 w-4" aria-hidden /> Delete
            </Button>
          </div>
        </div>
      )}
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-slate-700">View steps</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-700">
          {r.steps.map((s, i) => (
            <li key={i}>{describeStep(s)}</li>
          ))}
        </ol>
        {r.rules.length > 0 && (
          <ul className="mt-2 list-disc pl-5 text-slate-600">
            {r.rules.map((x) => (
              <li key={x.id}>
                Check: “{x.column}” {RULE_TEXT[x.kind]}
                {x.allowed ? ` (${x.allowed.join(', ')})` : ''}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-slate-500">Made from a file with the columns: {r.sourceColumns.join(', ')}</p>
      </details>
      <Dialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete “${r.name}”?`}
        description="The recipe will be removed from this browser. This cannot be undone. Files you already cleaned are not affected."
        footer={
          <>
            <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                setRecipes(recipes.filter((x) => x.id !== r.id))
                setConfirmDelete(false)
                notify(`Deleted the recipe “${r.name}”.`, 'info')
              }}
            >
              Delete recipe
            </Button>
          </>
        }
      />
    </Card>
  )
}

export function RecipesPage() {
  const { recipes, setRecipes, notify, storageOk } = useApp()
  const fileRef = useRef<HTMLInputElement>(null)
  const importFile = async (f: File | undefined) => {
    if (!f) return
    try {
      if (f.size > 1_000_000) throw new Error('too big')
      const data: unknown = JSON.parse(await f.text())
      if (!isRecipe(data)) throw new Error('not a recipe')
      const copy: Recipe = { ...data, id: `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}` }
      setRecipes([copy, ...recipes])
      notify(`Imported the recipe “${copy.name}”.`)
    } catch {
      notify('That file is not a CleanCSV recipe.', 'error')
    }
  }
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Saved recipes</h1>
          <p className="mt-2 max-w-2xl text-slate-600">
            A recipe is a list of cleaning steps you can run again on a similar file, for example the same export every week. Recipes are saved only in this browser. Use Export to move one to another device.
          </p>
        </div>
        <div>
          <Button onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" aria-hidden /> Import a recipe file
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            aria-label="Import a recipe file"
            onChange={(e) => {
              void importFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>
      </header>
      {!storageOk && <Alert tone="warning">Your browser is blocking local storage, so recipes will be lost when you close this tab.</Alert>}
      {recipes.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="font-medium text-slate-900">No recipes yet</p>
          <p className="mt-1 text-sm text-slate-600">Clean a file, then press “Save steps as a recipe” to reuse the same steps next time.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {recipes.map((r) => (
            <RecipeCard key={r.id} r={r} />
          ))}
        </div>
      )}
    </div>
  )
}
