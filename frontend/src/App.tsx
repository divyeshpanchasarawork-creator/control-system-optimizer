import { lazy, Suspense, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Activity, BarChart3, Crosshair, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
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

export default function App() {
	const w = useWorkspace()
	const [tab, setTab] = useState<TabId>('simulate')
	const [view, setView] = useState<'landing' | 'lab'>('landing')
	const [drawerOpen, setDrawerOpen] = useState(false)
	const [collapsed, setCollapsed] = useState(() => {
		try {
			return localStorage.getItem(LS_KEY) === '1'
		} catch {
			return false
		}
	})

	useEffect(() => {
		if (w.error) toast.error(w.error, { id: 'workspace-error' })
	}, [w.error])

	const toggleSidebar = () => {
		const next = !collapsed
		setCollapsed(next)
		try {
			localStorage.setItem(LS_KEY, next ? '1' : '0')
		} catch {
			/* private mode; ignore */
		}
	}

	const tabOrder: TabId[] = ['simulate', 'optimize', 'compare']
	const openTab = (id: TabId) => {
		setTab(id)
		setDrawerOpen(false)
	}

	return (
		<div className="app">
			<Toaster
				position="bottom-right"
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
						<LandingPage onEnter={() => setView('lab')} />
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
							{drawerOpen && <div className="sidebar-backdrop" onClick={() => setDrawerOpen(false)} />}
							<aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''} ${drawerOpen ? 'sidebar--open' : ''}`}>
								<button className="brand" onClick={() => setView('landing')} title="Back to landing">
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
												title={TAB_META[id].label}
												onClick={() => openTab(id)}
											>
												<span className="nav__icon"><Icon size={18} strokeWidth={1.8} /></span>
												<span className="nav__label">{TAB_META[id].label}</span>
											</button>
										)
									})}
								</nav>

								<button className="sidebar-toggle" onClick={toggleSidebar} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
									<span className="nav__icon">
										{collapsed ? <PanelLeftOpen size={16} strokeWidth={1.8} /> : <PanelLeftClose size={16} strokeWidth={1.8} />}
									</span>
									<span className="nav__label">{collapsed ? '' : 'Collapse'}</span>
								</button>
							</aside>

							<main className="main">
								<header className="main__header">
									<div className="main__header-left">
										<button className="main__menu-btn" onClick={() => setDrawerOpen(true)} title="Open navigation">
											<Menu size={18} strokeWidth={1.8} />
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