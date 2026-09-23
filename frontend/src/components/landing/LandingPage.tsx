import { Fragment, useMemo } from 'react'
import { LogoMark } from '../Landing'
import type { LabParams } from './LandingSim'
import { presetDamping, simulateClosedLoop, zetaOmega } from './LandingSim'
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
					<button className="landing__nav-cta" onClick={onEnter}>Open Lab →</button>
				</nav>
			</header>

			<section className="landing-hero" id="top">
				<div className="landing-hero__inner">
					<div className="landing-hero__copy">
						<p className="landing-hero__eyebrow">LINEAR CONTROL LAB</p>
						<h1 className="landing-hero__title">
							Design control systems. <br />
							See the dynamics <em>behave</em>.
						</h1>
						<p className="landing-hero__subtitle">
							A thinking spring-mass-damper. Tune the feedback gains, watch the closed-loop poles move, and
							search for the design that clears your specs.
						</p>
						<div className="landing-hero__cta-row">
							<button className="btn btn--primary" onClick={onEnter}>Open the Lab</button>
							<a className="btn btn--ghost" href="#tune">Explore the System</a>
						</div>
					</div>
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
								<div className="step__body">
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
				<div className="tradeoffs">
					<div className="tradeoffs__item">
						<div className="tradeoffs__variant">
							<span className="tradeoffs__dot tradeoffs__dot--bad" /> Too much gain, too little damping
						</div>
						<p className="tradeoffs__text">Rings hard, overshoots, and takes just as long to settle as a calmer tune.</p>
						<div className="tradeoffs__traits mono">overshoot 28% · settle 2.1 s</div>
					</div>
					<div className="tradeoffs__item">
						<div className="tradeoffs__variant">
							<span className="tradeoffs__dot tradeoffs__dot--good" /> Balanced gains
						</div>
						<p className="tradeoffs__text">A compact, damped step that reaches the reference cleanly and stays there.</p>
						<div className="tradeoffs__traits mono">overshoot 2% · settle 0.8 s</div>
					</div>
				</div>
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
					<p className="landing-section__lede">Thousands of candidate gain pairs, scored against your specs, then ranked.</p>
				</div>
				<div className="search">
					<div className="search__meta">
						<div className="search__meta-row">
							<span className="search__meta-key">Candidates</span>
							<span className="search__meta-value mono">11,520</span>
						</div>
						<div className="search__meta-row">
							<span className="search__meta-key">Cost function</span>
							<span className="search__meta-value mono">settle + overshoot</span>
						</div>
						<div className="search__meta-row">
							<span className="search__meta-key">Best</span>
							<span className="search__meta-value mono">★ Kp 12 · Kd 5.5</span>
						</div>
					</div>
					<div className="search__map" aria-hidden>
						{Array.from({ length: 46 }).map((_, i) => {
							const x = 8 + ((i * 37) % 84)
							const y = 8 + ((i * 53) % 76)
							const hit = i % 9 === 0
							return <span key={i} className={`search__cell ${hit ? 'search__cell--hit' : ''}`} style={{ left: `${x}%`, top: `${y}%` }} />
						})}
						<span className="search__cell search__cell--best">★</span>
					</div>
				</div>
			</section>

			<section className="landing-cta">
				<h2 className="landing-cta__title">Start with intuition. Dive into the math when you are ready.</h2>
				<p className="landing-cta__sub">Build the model, place the poles, and search the space. All in the browser.</p>
				<button className="btn btn--primary btn--lg" onClick={onEnter}>Open the Lab</button>
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