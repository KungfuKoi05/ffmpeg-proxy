import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { checkRecipe } from '../engine/recipes'
import { appliedEntries } from '../engine/history'
import { useApp } from '../state'
import { Alert, Button, Dialog, Select, TextInput } from './ui'

export function SaveRecipeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { session, saveRecipe, notify, storageOk } = useApp()
  const [name, setName] = useState('')
  const steps = session ? appliedEntries(session) : []
  const save = () => {
    const r = saveRecipe(name || `Recipe from ${session?.meta.fileName ?? 'a file'}`)
    if (r?.persisted) notify(`Saved the recipe “${r.recipe.name}” on this device.`)
    else if (r) notify(`Kept the recipe “${r.recipe.name}” for this tab only, because your browser is blocking storage. Use Export on the Saved Recipes page to keep a copy.`, 'info')
    setName('')
    onOpenChange(false)
  }
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Save these steps as a recipe"
      description="A recipe repeats the same cleaning steps on another file with the same layout. It is saved only in this browser."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={steps.length === 0 && (session?.rules.length ?? 0) === 0}>
            Save recipe
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!storageOk && <Alert tone="warning">Your browser is blocking local storage, so the recipe will be lost when you close this tab.</Alert>}
        <TextInput label="Recipe name" value={name} onChange={setName} placeholder="e.g. Clean weekly order export" autoFocus />
        {steps.length === 0 ? (
          <p className="text-sm text-slate-600">You have not applied any steps yet.</p>
        ) : (
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
            {steps.map((e) => (
              <li key={e.id}>{e.label}</li>
            ))}
          </ol>
        )}
        {session && session.rules.length > 0 && <p className="text-sm text-slate-600">Your {session.rules.length} check(s) will be saved too.</p>}
      </div>
    </Dialog>
  )
}

export function ApplyRecipeDialog({ open, onOpenChange, initialId }: { open: boolean; onOpenChange: (o: boolean) => void; initialId?: string | null }) {
  const { recipes, table, applyMany } = useApp()
  const [picked, setPicked] = useState<string>(initialId ?? recipes[0]?.id ?? '')
  const id = recipes.some((r) => r.id === picked) ? picked : (recipes[0]?.id ?? '')
  const recipe = recipes.find((r) => r.id === id)
  const plan = useMemo(() => (recipe && table && open ? checkRecipe(table, recipe) : null), [recipe, table, open])

  const run = (onlyOk: boolean) => {
    if (!recipe || !plan) return
    const steps = plan.checks.filter((c) => !onlyOk || c.status === 'ok').map((c) => c.step)
    applyMany(steps, recipe.rules, `“${recipe.name}”`)
    onOpenChange(false)
  }

  const allOk = plan && plan.runnable === plan.checks.length
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Apply a saved recipe"
      description="We try every step on your file first and show what it would do. Nothing changes until you confirm."
      footer={
        recipe && plan ? (
          <>
            <Button onClick={() => onOpenChange(false)}>Cancel</Button>
            {allOk ? (
              <Button variant="primary" onClick={() => run(false)} disabled={plan.checks.length === 0}>
                Apply all {plan.checks.length} steps
              </Button>
            ) : (
              <Button variant="primary" onClick={() => run(true)} disabled={plan.runnable === 0}>
                Apply only the {plan.runnable} step{plan.runnable === 1 ? '' : 's'} that fit
              </Button>
            )}
          </>
        ) : (
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        )
      }
    >
      {recipes.length === 0 ? (
        <p className="text-sm text-slate-600">You have no saved recipes yet. Clean a file, then use “Save these steps as a recipe”.</p>
      ) : (
        <div className="space-y-4">
          <Select label="Recipe" value={id} onChange={setPicked} options={recipes.map((r) => ({ value: r.id, label: r.name }))} />
          {plan && (
            <>
              {plan.missingColumns.length > 0 && (
                <Alert tone="warning" title="Some columns do not match the expected layout">
                  This file does not have {plan.missingColumns.map((c) => `“${c}”`).join(', ')}, which the recipe was made for.
                  {plan.newColumns.length > 0 && ` It has columns the original did not: ${plan.newColumns.map((c) => `“${c}”`).join(', ')}.`}
                </Alert>
              )}
              <ol className="space-y-2 text-sm">
                {plan.checks.map((c, i) => (
                  <li key={i} className="flex gap-2 rounded-lg border border-slate-200 p-2">
                    {c.status === 'ok' ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-label="Will run" />
                    ) : c.status === 'missing-columns' ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-label="Cannot run" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-label="Error" />
                    )}
                    <div>
                      <p className="text-slate-900">
                        {i + 1}. {c.label}
                      </p>
                      <p className="text-slate-600">
                        {c.status === 'ok'
                          ? `On this file: ${c.summary}`
                          : c.status === 'missing-columns'
                            ? `Skipped: needs ${c.missing.map((m) => `“${m}”`).join(', ')}, which this file does not have.`
                            : `Skipped: ${c.summary}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
              {recipe && recipe.rules.length > 0 && <p className="text-sm text-slate-600">The recipe also adds {recipe.rules.length} check(s) to the problem list.</p>}
            </>
          )}
        </div>
      )}
    </Dialog>
  )
}
