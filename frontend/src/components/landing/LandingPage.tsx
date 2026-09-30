import { Fragment, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, ArrowUpRight, SlidersHorizontal } from 'lucide-react'
import { LogoMark } from '../Landing'
import type { LabParams } from './LandingSim'
import { presetDamping, searchGains, simulateClosedLoop, stepResponse, zetaOmega } from './LandingSim'
import MassSpringDamperSim from './hero/MassSpringDamperSim'
import TuneSection from './TuneSection'
import { StepTraceView, pointsToPath } from './TraceView'

const HERO_BASE: Omit<LabParams, 'c'> = { m: 1, k: 2, kp: 10, kd: 0 }

function RegimeTraces() {
	const modes = ['under', 'critical', 'over'] as const
	const traces = useMemo(
		() =>
			modes.map((mode) => {
				const p = { ...HERO_BASE, c: presetDamping(mode, HERO_BASE) }
				return { mode, zeta: zetaOmega(p).zeta, points: simulateClosedLoop(p, 1, [0, 0], 8) }
			}),
		[],
	)

	return (
		<div className="regimes">
			{traces.map(({ mode, zeta, points }) => (
				<figure className="regime" key={mode}>
					<figcaption className="regime__caption">
						<span className="regime__name">{mode === 'under' ? 'Underdamped' : mode === 'critical' ? 'Critically damped' : 'Overdamped'}</span>
						<span className="regime__zeta mono">ζ = {zeta.toFixed(2)}</span>
					</figcaption>
					<StepTraceView tMax={8} ref={1}>
						<path d={pointsToPath(points, 8, 1)} className="trace__line" fill="none" />
					</StepTraceView>
				</figure>
			))}
		</div>
	)
}

const DEMO_PLANT = { m: 1, k: 2, c: 0.5 }
const DEMO_REF = 1
const SETTLE_BAND = 5
const TRADE_HORIZON = 6

const TRADE_OFFS = [
	{
		tone: 'bad',
		label: 'Too little damping',
		kp: 20,
		kd: 3,
		body: 'Same proportional gain, a third of the derivative. The poles sit close to the imaginary axis, so the step rings, passes the reference by more than a quarter of the step, and takes nearly three times as long to settle.',
	},
	{
		tone: 'good',
		label: 'Matched damping',
		kp: 20,
		kd: 6,
		body: 'More derivative, and the ringing goes away without giving up speed. Push much further and the step goes overdamped instead, which buys a cleaner trace and costs settling time all over again.',
	},
] as const

function fmtSeconds(t: number | null): string {
	return t === null ? 'never' : `${t.toFixed(2)} s`
}

// The two tunes share a plant and a proportional gain, so the pair isolates
// the derivative term. Measured once at module scope; the section is static.
const TRADE_TRAITS = TRADE_OFFS.map((t) => stepResponse({ ...DEMO_PLANT, kp: t.kp, kd: t.kd }, DEMO_REF, SETTLE_BAND, TRADE_HORIZON))

function TradeOffs() {
	return (
		<div className="tradeoffs">
			{TRADE_OFFS.map((t, i) => {
				const r = TRADE_TRAITS[i]
				return (
					<div className="tradeoffs__item" key={t.label}>
						<div className="tradeoffs__variant">
							<span className={`tradeoffs__dot tradeoffs__dot--${t.tone}`} /> {t.label}
						</div>
						<p className="tradeoffs__text">{t.body}</p>
						<div className="tradeoffs__traits mono">
							<span>
								Kp {t.kp} · Kd {t.kd}
							</span>
							<span>
								overshoot {r.overshoot.toFixed(1)}% · settle {fmtSeconds(r.settle)} ({SETTLE_BAND}% band)
							</span>
						</div>
					</div>
				)
			})}
		</div>
	)
}

const SEARCH_BOX = { kpMax: 30, kdMax: 15, step: 0.5 }
const SEARCH_DT = 0.01
const MAP_W = 300
const MAP_H = 160
const MAP_BANDS = 7

function SearchSection() {
	const result = useMemo(
		() => searchGains(DEMO_PLANT, DEMO_REF, SEARCH_BOX, SETTLE_BAND, TRADE_HORIZON, SEARCH_DT),
		[],
	)
	const best = result.best
	const bestResponse = useMemo(
		() => (best ? stepResponse({ ...DEMO_PLANT, kp: best.kp, kd: best.kd }, DEMO_REF, SETTLE_BAND, TRADE_HORIZON, SEARCH_DT) : null),
		[best],
	)

	// One path per cost level, so a 1,891-cell surface costs seven DOM nodes
	// rather than one per candidate. Levels are spaced logarithmically: the
	// objective's range is 0.30 to 4.97 with 80% of the box below 0.90, so
	// banding it linearly would crush the entire cheap basin into one level.
	// A log scale also puts a level edge at J = 1, which is the scale the lab's
	// own breakdown uses for "this candidate matches the reference cost".
	const { paths, colW, rowH, lowCost, highCost } = useMemo(() => {
		const cols = Math.round(SEARCH_BOX.kpMax / SEARCH_BOX.step) + 1
		const rows = Math.round(SEARCH_BOX.kdMax / SEARCH_BOX.step) + 1
		const cw = MAP_W / cols
		const ch = MAP_H / rows
		const costs = result.cells.map((c) => c.cost)
		const lo = Math.log(Math.min(...costs))
		const hi = Math.log(Math.max(...costs))
		const span = hi - lo || 1
		const buckets: string[][] = Array.from({ length: MAP_BANDS }, () => [])
		for (const c of result.cells) {
			const t = (Math.log(c.cost) - lo) / span
			const band = Math.min(MAP_BANDS - 1, Math.max(0, Math.floor(t * MAP_BANDS)))
			const x = (c.kp / SEARCH_BOX.step) * cw
			const y = MAP_H - (c.kd / SEARCH_BOX.step + 1) * ch
			const w = Math.max(0.8, cw - 0.6)
			const h = Math.max(0.8, ch - 0.6)
			buckets[band].push(`M${x.toFixed(2)} ${y.toFixed(2)}h${w.toFixed(2)}v${h.toFixed(2)}h${(-w).toFixed(2)}z`)
		}
		return { paths: buckets.map((d) => d.join('')), colW: cw, rowH: ch, lowCost: Math.exp(lo), highCost: Math.exp(hi) }
	}, [result])

	if (!best || !bestResponse) return null
	const bestX = (best.kp / SEARCH_BOX.step) * colW + colW / 2
	const bestY = MAP_H - (best.kd / SEARCH_BOX.step + 1) * rowH + rowH / 2

	return (
		<div className="search">
			<div className="search__meta">
				<div className="search__meta-row">
					<span className="search__meta-key">Gain box</span>
					<span className="search__meta-value mono">
						Kp 0–{SEARCH_BOX.kpMax} · Kd 0–{SEARCH_BOX.kdMax}
					</span>
				</div>
				<div className="search__meta-row">
					<span className="search__meta-key">Candidates</span>
					<span className="search__meta-value mono">{result.evaluated.toLocaleString()}</span>
				</div>
				<div className="search__meta-row">
					<span className="search__meta-key">Cheapest</span>
					<span className="search__meta-value mono">
						★ Kp {best.kp} · Kd {best.kd}
					</span>
				</div>
				<div className="search__meta-row">
					<span className="search__meta-key">Its response</span>
					<span className="search__meta-value mono">
						{bestResponse.overshoot.toFixed(1)}% · {fmtSeconds(bestResponse.settle)} ({SETTLE_BAND}% band)
					</span>
				</div>
				<p className="search__meta-note">
					{result.scored === result.evaluated
						? `All ${result.evaluated.toLocaleString()} pairs were stable enough to score. `
						: `${result.scored.toLocaleString()} of ${result.evaluated.toLocaleString()} pairs were stable enough to score. `}
					Cost is <span className="mono">J = 1·IAE + 0.1·U + 0.5·Ts + 0.5·O</span>, each term divided by a fixed
					scale before weighting, so the weights stay comparable across the box. Lower is better. These are the
					lab's starting weights — the app's "Custom" preset.
				</p>
			</div>
			<figure className="search__figure">
				<div className="search__map">
					<svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} preserveAspectRatio="none" aria-hidden focusable="false">
						{paths.map((d, i) => (
							<path key={i} d={d} className={`search__band search__band--${i}`} />
						))}
					</svg>
					<span className="search__axis search__axis--y" aria-hidden>Kd</span>
					<span className="search__axis search__axis--x" aria-hidden>Kp</span>
					<span className="search__best" style={{ left: `${(bestX / MAP_W) * 100}%`, top: `${(bestY / MAP_H) * 100}%` }} aria-hidden>
						★
					</span>
				</div>
				<figcaption className="search__legend">
					<span className="search__legend-scale" aria-hidden>
						{Array.from({ length: MAP_BANDS }, (_, i) => (
							<span key={i} className={`search__band search__band--${i}`} />
						))}
					</span>
					<span className="search__legend-text">
						cost <span className="mono">J {lowCost.toFixed(2)}</span> in the basin, rising to{' '}
						<span className="mono">J {highCost.toFixed(2)}</span> at the far corner
					</span>
				</figcaption>
			</figure>
		</div>
	)
}

const STEPS = [
	{ mark: '1', title: 'Physics', body: 'The plant is a mass-spring-damper with its own dynamics.' },
	{ mark: 'u = −K(x − r)', title: 'Controller', body: 'A state-feedback law applies force from the state error.' },
	{ mark: 'A − BK', title: 'Closed loop', body: 'Gains reshape the poles, and with them the whole response.' },
	{ mark: 'x(t)', title: 'Response', body: 'Position, velocity and settling tell you how it feels.' },
]

export function LandingPage({ onEnter }: { onEnter: () => void }) {
	return (
		<div className="landing">
			<header className="landing__top">
				<a className="landing__brand" href="#top">
					<span className="landing__brand-mark"><LogoMark size={22} /></span>
					<span className="landing__brand-name">Control Lab</span>
				</a>
				<nav className="landing__nav" aria-label="Landing">
					<a href="#how">How it works</a>
					<a href="#simulate">Simulate</a>
					<a href="#tune">Tune</a>
					<a href="#search">Search</a>
					<button type="button" className="landing__nav-cta" onClick={onEnter}>Open the Lab <ArrowUpRight size={14} strokeWidth={2.2} /></button>
				</nav>
			</header>

			<section className="landing-hero" id="top">
				<div className="landing-hero__inner">
					<motion.div
						initial="hidden"
						animate="show"
						variants={{ hidden: {}, show: { transition: { staggerChildren: 0.09 } } }}
					>
						<motion.p
							className="landing-hero__eyebrow"
							variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } } }}
						>LINEAR CONTROL LAB</motion.p>
						<motion.h1
							className="landing-hero__title"
							variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } } }}
						>
							Design control systems. <br />
							See the dynamics <em>behave</em>.
						</motion.h1>
						<motion.p
							className="landing-hero__subtitle"
							variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } } }}
						>
							A thinking spring-mass-damper. Tune the feedback gains, watch the closed-loop poles move, and
							search for the design that clears your specs.
						</motion.p>
						<motion.div
							className="landing-hero__cta-row"
							variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } } }}
						>
							<button type="button" className="btn btn--primary" onClick={onEnter}>Open the Lab <ArrowRight size={15} strokeWidth={2.2} /></button>
							<a className="btn btn--ghost" href="#tune"><SlidersHorizontal size={14} strokeWidth={2} /> Explore the system</a>
						</motion.div>
					</motion.div>
					<div className="landing-hero__figure">
						<MassSpringDamperSim {...HERO_BASE} />
					</div>
				</div>
			</section>

			<section className="landing-section" id="how">
				<div className="landing-section__head">
					<h2 className="landing-section__title">From physics to response</h2>
					<p className="landing-section__lede">One pipeline: model it, close the loop, then react to what it does.</p>
				</div>
				<ol className="steps">
					{STEPS.map((s, i) => (
						<Fragment key={s.title}>
							<li className="step">
								<span className="step__mark mono">{s.mark}</span>
								<div>
									<h3 className="step__title">{s.title}</h3>
									<p className="step__text">{s.body}</p>
								</div>
							</li>
							{i < STEPS.length - 1 && <li className="step__arrow" aria-hidden>→</li>}
						</Fragment>
					))}
				</ol>
			</section>

			<section className="landing-section" id="simulate">
				<div className="landing-section__head">
					<h2 className="landing-section__title">Simulate the physics</h2>
					<p className="landing-section__lede">The same spring-damper model rendered three ways. The controller sets the character.</p>
				</div>
				<RegimeTraces />
			</section>

			<section className="landing-section" id="tune">
				<div className="landing-section__head">
					<h2 className="landing-section__title">Tune the feedback gains</h2>
					<p className="landing-section__lede">Drag <code>Kp</code> and <code>Kd</code>. The trace, the poles and the metrics move together.</p>
				</div>
				<TuneSection />
			</section>

			<section className="landing-section" id="tradeoffs">
				<div className="landing-section__head">
					<h2 className="landing-section__title">Understand the trade-offs</h2>
					<p className="landing-section__lede">Fast is not always better. Every gain choice trades one spec against another.</p>
				</div>
				<TradeOffs />
				<ol className="chain">
					<li>Gain</li>
					<li>→</li>
					<li>Poles</li>
					<li>→</li>
					<li>Transient</li>
					<li>→</li>
					<li>Metrics</li>
				</ol>
			</section>

			<section className="landing-section" id="search">
				<div className="landing-section__head">
					<h2 className="landing-section__title">Search the design space</h2>
					<p className="landing-section__lede">
						Every gain pair in the box is simulated and scored, then ranked. The cheapest one wins.
					</p>
				</div>
				<SearchSection />
			</section>

			<section className="landing-cta">
				<h2 className="landing-cta__title">Start with intuition. Dive into the math when you are ready.</h2>
				<p className="landing-cta__sub">Build the model, place the poles, and search the space. All in the browser.</p>
				<button type="button" className="btn btn--primary btn--lg" onClick={onEnter}>Open the Lab <ArrowRight size={15} strokeWidth={2.2} /></button>
			</section>

			<footer className="landing__footer" id="about">
				<div className="landing__footer-inner">
					<span className="landing__brand-name">Control Lab</span>
					<span className="landing__footer-dot">·</span>
					<span>A browser-based control design workbench for the classic spring-damper.</span>
					<span className="landing__footer-spacer" />
					<a href="#top">Back to top</a>
				</div>
			</footer>
		</div>
	)
}

export default LandingPage