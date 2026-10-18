// Small UI building blocks in the shadcn/ui style (Tailwind classes, Radix for dialogs).

import * as RadixDialog from '@radix-ui/react-dialog'
import { AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle } from 'lucide-react'
import { forwardRef, useId, type ButtonHTMLAttributes, type ReactNode } from 'react'

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary: 'bg-teal-700 text-white hover:bg-teal-800 disabled:bg-teal-700/50 shadow-sm',
  secondary: 'bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 disabled:text-slate-400 shadow-sm',
  ghost: 'text-slate-700 hover:bg-slate-100 disabled:text-slate-400',
  danger: 'bg-white text-red-700 border border-red-300 hover:bg-red-50 disabled:text-red-300',
}
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }>(
  function Button({ variant = 'secondary', size = 'md', className, type = 'button', ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={cx(
          'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed whitespace-nowrap',
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      />
    )
  },
)

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('rounded-xl border border-slate-200 bg-white shadow-sm', className)} {...props}>
      {children}
    </div>
  )
}

const badgeTones = {
  important: 'bg-red-50 text-red-800 ring-red-200',
  check: 'bg-amber-50 text-amber-900 ring-amber-200',
  info: 'bg-sky-50 text-sky-800 ring-sky-200',
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  guess: 'bg-violet-50 text-violet-800 ring-violet-200',
}

export function Badge({ tone = 'neutral', children, className }: { tone?: keyof typeof badgeTones; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', badgeTones[tone], className)}>
      {children}
    </span>
  )
}

const alertTones = {
  error: { cls: 'border-red-200 bg-red-50 text-red-900', Icon: XCircle },
  warning: { cls: 'border-amber-200 bg-amber-50 text-amber-950', Icon: AlertTriangle },
  info: { cls: 'border-sky-200 bg-sky-50 text-sky-950', Icon: Info },
  success: { cls: 'border-emerald-200 bg-emerald-50 text-emerald-950', Icon: CheckCircle2 },
}

export function Alert({
  tone = 'info',
  title,
  children,
  action,
  role,
}: {
  tone?: keyof typeof alertTones
  title?: ReactNode
  children?: ReactNode
  action?: ReactNode
  role?: 'alert' | 'status'
}) {
  const { cls, Icon } = alertTones[tone]
  return (
    <div className={cx('flex gap-3 rounded-lg border p-3 text-sm', cls)} role={role}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-relaxed">{children}</div>}
        {action && <div className="pt-1">{action}</div>}
      </div>
    </div>
  )
}

export function Spinner({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-slate-600" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {label}
    </span>
  )
}

const inputCls =
  'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30 disabled:bg-slate-50'

export function Field({ label, hint, children, id }: { label: ReactNode; hint?: ReactNode; children: (id: string) => ReactNode; id?: string }) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <div className="space-y-1">
      <label htmlFor={fid} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      {children(fid)}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

export function Select({
  label,
  value,
  onChange,
  options,
  hint,
  placeholder,
}: {
  label: ReactNode
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  hint?: ReactNode
  placeholder?: string
}) {
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <select id={id} className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  )
}

export function TextInput({
  label,
  value,
  onChange,
  hint,
  placeholder,
  autoFocus,
}: {
  label: ReactNode
  value: string
  onChange: (v: string) => void
  hint?: ReactNode
  placeholder?: string
  autoFocus?: boolean
}) {
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <input
          id={id}
          className={inputCls}
          value={value}
          placeholder={placeholder}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  )
}

export function Checkbox({ label, checked, onChange, hint }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; hint?: ReactNode }) {
  const id = useId()
  return (
    <div className="flex items-start gap-2">
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-teal-700 accent-teal-700 focus-visible:ring-2 focus-visible:ring-teal-600"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm text-slate-800">
          {label}
        </label>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  )
}

export function RadioGroup<T extends string>({
  legend,
  value,
  onChange,
  options,
}: {
  legend: ReactNode
  value: T | ''
  onChange: (v: T) => void
  options: { value: T; label: ReactNode; hint?: ReactNode }[]
}) {
  const name = useId()
  return (
    <fieldset className="space-y-1.5">
      <legend className="mb-1 text-sm font-medium text-slate-800">{legend}</legend>
      {options.map((o) => {
        const id = `${name}-${o.value}`
        return (
          <div key={o.value} className="flex items-start gap-2">
            <input
              id={id}
              type="radio"
              name={name}
              className="mt-0.5 h-4 w-4 shrink-0 accent-teal-700"
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            <div>
              <label htmlFor={id} className="text-sm text-slate-800">
                {o.label}
              </label>
              {o.hint && <p className="text-xs text-slate-500">{o.hint}</p>}
            </div>
          </div>
        )
      })}
    </fieldset>
  )
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-slate-900/40" />
        <RadixDialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl bg-white shadow-xl focus:outline-none">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
            <div>
              <RadixDialog.Title className="text-base font-semibold text-slate-900">{title}</RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="mt-1 text-sm text-slate-600">{description}</RadixDialog.Description>
              ) : (
                <RadixDialog.Description className="sr-only">Dialog</RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close className="rounded p-1 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600" aria-label="Close">
              <X className="h-4 w-4" />
            </RadixDialog.Close>
          </div>
          {children && <div className="overflow-y-auto p-5">{children}</div>}
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 p-4">{footer}</div>}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}

/** Shows a cell value with its edge spaces made visible, and "(empty)" for empty values. */
export function ShowValue({ value, className }: { value: string; className?: string }) {
  if (value === '') return <span className={cx('italic text-slate-400', className)}>(empty)</span>
  const lead = value.match(/^\s+/)?.[0] ?? ''
  const trail = value.length > lead.length ? (value.match(/\s+$/)?.[0] ?? '') : ''
  const mid = value.slice(lead.length, value.length - trail.length)
  const dots = (s: string) => (
    <span className="rounded-sm bg-amber-200/70 text-amber-900" title={`${s.length} space${s.length === 1 ? '' : 's'}`}>
      {s.replace(/[^\n]/g, '·')}
    </span>
  )
  return (
    <span className={cx('whitespace-pre-wrap break-words font-mono text-[13px]', className)}>
      {lead && dots(lead)}
      {mid}
      {trail && dots(trail)}
      {(lead || trail) && <span className="sr-only"> (has {lead ? 'leading' : ''}{lead && trail ? ' and ' : ''}{trail ? 'trailing' : ''} spaces)</span>}
    </span>
  )
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: 'good' | 'warn' }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={cx('mt-1 text-2xl font-semibold', tone === 'good' ? 'text-emerald-700' : tone === 'warn' ? 'text-amber-700' : 'text-slate-900')}>
        {value}
      </dd>
    </div>
  )
}
