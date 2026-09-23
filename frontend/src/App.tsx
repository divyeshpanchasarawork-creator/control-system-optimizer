import { useState } from 'react'

import SimulateTab from './tabs/SimulateTab'
import OptimizeTab from './tabs/OptimizeTab'
import CompareTab from './tabs/CompareTab'
import { LandingHero, LogoMark } from './components/Landing'

type TabId = 'simulate' | 'optimize' | 'compare'

const TAB_META: Record<TabId, { label: string; icon: string; badge: string }> = {
	simulate: { label: 'Simulate', icon: 'waveform', badge: 'Model & verify' },
	optimize: { label: 'Optimize', icon: 'target', badge: 'Search the gains' },
	compare: { label: 'Compare', icon: 'bars', badge: 'Trade-offs' },
}

function NavIcon({ name }: { name: string }) {
	const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
	switch (name) {
		case 'waveform':
			return (
				<svg {...common}>
					<path d="M3 12h2l2-7 3 14 3-11 2 4h6" />
				</svg>
			)
		case 'target':
			return (
				<svg {...common}>
					<circle cx="12" cy="12" r="9" />
					<circle cx="12" cy="12" r="4.5" />
					<circle cx="12" cy="12" r="0.6" fill="currentColor" />
				</svg>
			)
		case 'bars':
			return (
				<svg {...common}>
					<path d="M6 20V10M12 20V4M18 20v-7" />
				</svg>
			)
		default:
			return null
	}
}

const LS_KEY = 'cso.sidebar.collapsed'

export default function App() {
	const [tab, setTab] = useState<TabId>('simulate')
	const [view, setView] = useState<'landing' | 'lab'>('landing')
	const [collapsed, setCollapsed] = useState(() => {
		try {
			return localStorage.getItem(LS_KEY) === '1'
		} catch {
			return false
		}
	})

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

	return (
		<div className="app">
			{view === 'landing' ? (
				<LandingHero onEnter={() => setView('lab')} />
) : (
				<div className="workspace">
					<aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
						<button className="brand" onClick={() => setView('landing')} title="Back to landing">
							<span className="brand__mark"><LogoMark size={22} /></span>
							<span className="brand__text">
								<span className="brand__name">Control Lab</span>
								<span className="brand__tag">spring damper · closed loop</span>
							</span>
						</button>

						<nav className="sidebar__nav nav" aria-label="Workspace">
							{tabOrder.map((id) => (
								<button
									key={id}
									className={`nav__item ${tab === id ? 'active' : ''}`}
									title={TAB_META[id].label}
									onClick={() => setTab(id)}
								>
									<span className="nav__icon"><NavIcon name={TAB_META[id].icon} /></span>
									<span className="nav__label">{TAB_META[id].label}</span>
								</button>
							))}
						</nav>

						<button className="sidebar-toggle" onClick={toggleSidebar} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
							<span className="nav__icon">
								{collapsed
									? (
										<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
											<path d="M11 5l7 7-7 7M5 5l7 7-7 7" />
										</svg>
									)
									: (
										<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
											<path d="M13 5l-7 7 7 7M19 5l-7 7 7 7" />
										</svg>
									)}
							</span>
							<span className="nav__label">{collapsed ? '' : 'Collapse'}</span>
						</button>
					</aside>

					<main className="main">
						<header className="main__header">
							<div className="main__header-left">
								<h1 className="main__title">{TAB_META[tab].label}</h1>
								<span className="main__header-badge">· {TAB_META[tab].badge}</span>
							</div>
							<div className="main__header-right">
								<span className="main__header-badge">Closed loop · A − BK</span>
							</div>
						</header>
						<div className="main__body">
							{tab === 'simulate' && <SimulateTab />}
							{tab === 'optimize' && <OptimizeTab />}
							{tab === 'compare' && <CompareTab />}
						</div>
					</main>
				</div>
			)}
		</div>
	)
}