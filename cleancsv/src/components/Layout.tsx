import { BookOpen, History, LifeBuoy, Menu, Sparkles, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useApp, type Route } from '../state'
import { cx } from './ui'
import { NoticeBar } from './NoticeBar'

const NAV: { route: Route; label: string; Icon: typeof Sparkles }[] = [
  { route: 'clean', label: 'Clean a File', Icon: Sparkles },
  { route: 'history', label: 'Cleaning History', Icon: History },
  { route: 'recipes', label: 'Saved Recipes', Icon: BookOpen },
  { route: 'help', label: 'Help', Icon: LifeBuoy },
]

function Logo() {
  return (
    <span className="flex items-center gap-2 text-lg font-semibold text-slate-900">
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
        <rect width="32" height="32" rx="7" fill="#0f766e" />
        <path d="M9 10h14M9 16h14M9 22h8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
        <path d="m19 21 2.5 2.5L26 19" stroke="#99f6e4" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      CleanCSV
    </span>
  )
}

function NavList({ onPick }: { onPick?: () => void }) {
  const { route, navigate, recipes } = useApp()
  return (
    <ul className="space-y-1">
      {NAV.map(({ route: r, label, Icon }) => (
        <li key={r}>
          <a
            href={r === 'clean' ? '#/' : `#/${r}`}
            onClick={(e) => {
              e.preventDefault()
              navigate(r)
              onPick?.()
            }}
            aria-current={route === r ? 'page' : undefined}
            className={cx(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              route === r ? 'bg-teal-50 text-teal-900' : 'text-slate-700 hover:bg-slate-100',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
            {r === 'recipes' && recipes.length > 0 && (
              <span className="ml-auto rounded-full bg-slate-200 px-2 text-xs text-slate-700">{recipes.length}</span>
            )}
          </a>
        </li>
      ))}
    </ul>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const { route } = useApp()
  const mainRef = useRef<HTMLElement>(null)
  useEffect(() => setOpen(false), [route])

  return (
    <div className="min-h-screen lg:flex">
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault()
          mainRef.current?.focus()
        }}
        className="sr-only z-50 rounded bg-white px-3 py-2 focus:not-sr-only focus:absolute focus:left-2 focus:top-2"
      >
        Skip to content
      </a>
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white lg:block">
        <div className="sticky top-0 flex h-screen flex-col p-4">
          <div className="px-2 pb-6 pt-1">
            <Logo />
          </div>
          <nav aria-label="Main">
            <NavList />
          </nav>
          <p className="mt-auto px-2 text-xs leading-relaxed text-slate-500">
            Your files are processed on this device and never uploaded.
          </p>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <Logo />
        <button
          type="button"
          className="rounded-lg p-2 text-slate-700 hover:bg-slate-100"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
        </button>
      </header>
      {open && (
        <nav id="mobile-nav" aria-label="Main" className="border-b border-slate-200 bg-white p-3 lg:hidden">
          <NavList onPick={() => setOpen(false)} />
        </nav>
      )}

      <main id="main" ref={mainRef} tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
      <NoticeBar />
    </div>
  )
}
