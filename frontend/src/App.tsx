import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Activity, BarChart3, Crosshair, Menu, PanelLeftClose, PanelLeftOpen, RotateCcw } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

import { LogoMark } from './components/Landing'
import LandingPage from './components/landing/LandingPage'
import { useWorkspace } from './state/WorkspaceContext'

const SimulateTab = lazy(() => import('./tabs/SimulateTab'))
const OptimizeTab = lazy(() => import('./tabs/OptimizeTab'))
const CompareTab = lazy(() => import('./tabs/CompareTab'))

type TabId = 'simulate' | 'optimize' | 'compare'

const TAB_META: Record<TabId, { label: string; badge: string; icon: typeof Activity }> = {
	simulate: { label: 'Simulate', badge: 'Model & verify', icon: Activity },
	optimize: { label: 'Optimize', badge: 'Search the gains', icon: Crosshair },
	compare: { label: 'Compare', badge: 'Trade-offs', icon: BarChart3 },
}

const LS_KEY = 'cso.sidebar.collapsed'

/**
 * Single announcement channel for the whole app.
 *
 * Every busy state in the lab is a text swap inside a chart panel or a
 * callout, and none of it was reachable by a screen reader: there was no
 * live region anywhere, so a 120-second optimization was completely silent.
 * This mirrors the existing visual loading text into one polite region, and
 * routes errors to an assertive one.
 */
function LiveStatus({ loading, refreshing, error }: { loading: string | null; refreshing: boolean; error: string | null }) {
	return (
		<>
			<div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
				{loading ?? (refreshing ? 'Updating results' : '')}
			</div>
			<div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
				{error ?? ''}
			</div>
		</>
	)
}

const TAB_FROM_HASH: Record<string, TabId | undefined> = {
	'#/lab/simulate': 'simulate',
	'#/lab/optimize': 'optimize',
	'#/lab/compare': 'compare',
}

function parseHash(hash: string): { view: 'landing' | 'lab'; tab: TabId } {
	const clean = hash || '#/'
	if (clean.startsWith('#/lab')) {
		return { view: 'lab', tab: TAB_FROM_HASH[clean] ?? 'simulate' }
	}
	return { view: 'landing', tab: 'simulate' }
}

export default function App() {
	const w = useWorkspace()
	const [route, setRoute] = useState(() => parseHash(window.location.hash))
	const [drawerOpen, setDrawerOpen] = useState(false)
	const [collapsed, setCollapsed] = useState(() => {
		try {
			return localStorage.getItem(LS_KEY) === '1'
		} catch {
			return false
		}
	})

	const { view, tab } = route

	useEffect(() => {
		const onHash = () => setRoute(parseHash(window.location.hash))
		window.addEventListener('hashchange', onHash)
		return () => window.removeEventListener('hashchange', onHash)
	}, [])

	useEffect(() => {
		if (w.error) toast.error(w.error, { id: 'workspace-error' })
	}, [w.error])

	const navigate = useCallback((next: { view: 'landing' | 'lab'; tab?: TabId }) => {
		let hash = next.view === 'landing' ? '#/' : '#/lab'
		if (next.view === 'lab' && next.tab) hash = `#/lab/${next.tab}`
		if (window.location.hash !== hash) window.location.hash = hash
		setRoute(parseHash(hash))
		setDrawerOpen(false)
	}, [])

	const toggleSidebar = () => {
		const next = !collapsed
		setCollapsed(next)
		try {
			localStorage.setItem(LS_KEY, next ? '1' : '0')
		} catch {
			/* private mode; ignore */
		}
	}

	const openTab = (id: TabId) => navigate({ view: 'lab', tab: id })

	const resetWorkspace = () => {
		w.resetWorkspace()
		toast.success('Workspace reset to defaults', { id: 'workspace-reset' })
	}

	const menuBtnRef = useRef<HTMLButtonElement>(null)
	const drawerRef = useRef<HTMLElement>(null)

	// The drawer is a modal on touch devices: Esc closes it, focus moves into
	// it on open and returns to the trigger on close. Without the focus round
	// trip, keyboard and screen-reader users had no way back out of it.
	useEffect(() => {
		if (!drawerOpen) return
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') setDrawerOpen(false)
		}
		window.addEventListener('keydown', onKey)
		const id = setTimeout(() => {
			drawerRef.current?.querySelector<HTMLButtonElement>('.nav__item')?.focus()
		}, 0)
		return () => {
			window.removeEventListener('keydown', onKey)
			clearTimeout(id)
			menuBtnRef.current?.focus()
		}
	}, [drawerOpen])

	// Bottom-right toasts are out of thumb reach on phones and collide with
	// the tab bar at the foot of the viewport, so slide them to the top where
	// they also stop covering the trailing-edge data. The workspace tab bar
	// is fixed to the bottom, so "top" is the only spot nothing else owns.
	const [toastsTop, setToastsTop] = useState(() => window.matchMedia('(max-width: 767px)').matches)
	useEffect(() => {
		const mq = window.matchMedia('(max-width: 767px)')
		const onChange = () => setToastsTop(mq.matches)
		mq.addEventListener('change', onChange)
		return () => mq.removeEventListener('change', onChange)
	}, [])

	const tabOrder: TabId[] = ['simulate', 'optimize', 'compare']

	return (
		<div className="app">
			<LiveStatus loading={w.loading} refreshing={w.refreshing} error={w.error} />
			<Toaster
				position={toastsTop ? 'top-center' : 'bottom-right'}
				toastOptions={{
					duration: 5000,
					style: {
						background: '#fff',
						color: '#1d1d1f',
						border: '1px solid #e5e5ea',
						borderRadius: 12,
						fontSize: 13,
						boxShadow: '0 12px 32px -8px rgba(29, 29, 31, 0.18)',
						padding: '10px 14px',
					},
				}}
			/>
			<AnimatePresence mode="wait">
				{view === 'landing' ? (
					<motion.div
						key="landing"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0, y: -8 }}
						transition={{ duration: 0.24, ease: 'easeOut' }}
					>
						<LandingPage onEnter={() => navigate({ view: 'lab', tab: 'simulate' })} />
					</motion.div>
				) : (
					<motion.div
						key="lab"
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.24, ease: 'easeOut' }}
					>
						<div className="workspace">
							{drawerOpen && <div className="sidebar-backdrop" onClick={() => setDrawerOpen(false)} aria-hidden="true" />}
							<aside
								ref={drawerRef}
								className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''} ${drawerOpen ? 'sidebar--open' : ''}`}
								role={drawerOpen ? 'dialog' : undefined}
								aria-modal={drawerOpen || undefined}
								aria-label={drawerOpen ? 'Workspace navigation' : undefined}
							>
								<button type="button" className="brand" onClick={() => navigate({ view: 'landing' })} title="Back to landing">
									<span className="brand__mark"><LogoMark size={22} /></span>
									<span className="brand__text">
										<span className="brand__name">Control Lab</span>
										<span className="brand__tag">spring damper · closed loop</span>
									</span>
								</button>

							<nav className="sidebar__nav nav" aria-label="Workspace">
								{tabOrder.map((id) => {
									const Icon = TAB_META[id].icon
									return (
										<button
											key={id}
											className={`nav__item ${tab === id ? 'active' : ''}`}
											aria-label={TAB_META[id].label}
											aria-current={tab === id ? 'page' : undefined}
											title={TAB_META[id].label}
											onClick={() => openTab(id)}
										>
											<span className="nav__icon"><Icon /></span>
											<span className="nav__label">{TAB_META[id].label}</span>
										</button>
									)
								})}
							</nav>

							<div className="sidebar__footer">
								<button type="button" className="sidebar-toggle" onClick={toggleSidebar} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
									<span className="nav__icon">
										{collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
									</span>
									<span className="nav__label">{collapsed ? '' : 'Collapse'}</span>
								</button>

								<button type="button" className="sidebar-toggle" onClick={resetWorkspace} aria-label="Reset workspace to defaults" title="Reset workspace to defaults">
									<span className="nav__icon"><RotateCcw /></span>
									<span className="nav__label">{collapsed ? '' : 'Reset'}</span>
								</button>
							</div>
						</aside>

						<main className="main" aria-busy={w.loading !== null || w.refreshing}>
							<header className="main__header">
								<div className="main__header-left">
									<button type="button" className="main__menu-btn" onClick={() => setDrawerOpen(true)} aria-label="Open navigation" title="Open navigation" ref={menuBtnRef}>
										<Menu />
									</button>
									<h1 className="main__title">{TAB_META[tab].label}</h1>
										<span className="main__header-badge">· {TAB_META[tab].badge}</span>
									</div>
									<div className="main__header-right">
										<span className="main__header-badge">Closed loop · A − BK</span>
									</div>
								</header>
								<div className="main__body">
									<AnimatePresence mode="wait">
										<motion.div
											key={tab}
											initial={{ opacity: 0, y: 8 }}
											animate={{ opacity: 1, y: 0 }}
											exit={{ opacity: 0, y: -8 }}
											transition={{ duration: 0.18, ease: 'easeOut' }}
										>
											<Suspense fallback={<div className="tab-loading">Loading…</div>}>
												{tab === 'simulate' && <SimulateTab />}
												{tab === 'optimize' && <OptimizeTab />}
												{tab === 'compare' && <CompareTab />}
											</Suspense>
										</motion.div>
									</AnimatePresence>
								</div>
							</main>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}