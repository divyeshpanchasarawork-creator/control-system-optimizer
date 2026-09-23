import { useEffect } from 'react'

import { CheckField, GainField, Learn, MetricCard, NumberField, Panel, RadioChip } from '../components/common'
import { fmt } from '../components/common'
import { PoleZeroChart, TimeSeriesChart } from '../components/charts'
import { useWorkspace } from '../state/WorkspaceContext'
import type { SimulationResponse } from '../api/types'

function metricTone(m: SimulationResponse['metrics'], key: 'overshoot' | 'maxAbsError') {
	const v = m[key]
	if (!Number.isFinite(v)) return 'good'
	return v > 20 ? 'bad' : 'good'
}

const LEARNING = {
	sim: 'The simulated spring-damper follows ẋ = Ax + Bu, integrated with a fixed-step Runge-Kutta (RK4) solver. The plot shows each state over time: position and velocity, with the dashed lines as the reference the controller tracks. The control u = −K(x − r) is applied at every step.',
	stability: 'The pole-zero map plots the eigenvalues of the closed-loop matrix (A − BK). The system is stable when every pole sits in the left half-plane (real part < 0). Poles further left decay faster; a nonzero imaginary part means oscillation.',
	metrics: 'IAE and ISE measure how much the state deviates from the reference. IAE penalizes error linearly, ISE squares it (so large errors hurt more). Overshoot is how far the response exceeds the target. Settling time is when the response stays within the settling band; if it never does, it shows "Not reached". Control effort is the integrated magnitude of u.',
	units: 'Inputs are in SI units: mass in kilograms (kg), damping in newton-seconds per meter (N·s/m), spring constant in newtons per meter (N/m). Time is in seconds (s). Kp multiplies the position error (1/s² units of force authority) and Kd the velocity error.',
	tracking: 'With tracking, u = −K(x − r): the controller steers the state to the reference. Without it, u = −Kx drives the state to the origin instead.',
}

const SETTLING_OPTIONS = [
	{ value: '2', label: '2%' },
	{ value: '5', label: '5%' },
	{ value: '10', label: '10%' },
]

export function SimulateTab() {
	const w = useWorkspace()

	useEffect(() => {
		if (w.systemDescriptor === null) {
			void w.loadCatalog()
		}
		if (w.simulation === null) {
			void w.runSimulation()
		}
	}, [w.systemDescriptor, w.simulation])

	const gain = w.useOptimized && w.optimizedGain ? w.optimizedGain : w.manualGain
	const metrics = w.simulation?.metrics
	const eigenvalues = w.stability?.eigenvalues
	const settlingBand = w.settlingBand

	return (
		<div className="stack">
			<Learn title="How simulation works">
				<p>{LEARNING.sim}</p>
				<p>{LEARNING.units}</p>
			</Learn>

			<section>
				<p className="section-label">Plant · the physics</p>
				<Panel>
					<div className="form-grid">
						<NumberField label="Mass" unit="kg" hint="Mass of the moving body (0.1 to 10). Higher mass makes the response slower and less sensitive to the controller."
							value={w.mass} min={0.1} step={0.1} onChange={(v) => w.update({ mass: v })} />
						<NumberField label="Damping" unit="N·s/m" hint="Viscous friction. Higher damping (closer to critical) reduces oscillation but can slow the response; 0 is undamped."
							value={w.damping} min={0} step={0.1} onChange={(v) => w.update({ damping: v })} />
						<NumberField label="Spring constant" unit="N/m" hint="Stiffness of the spring (Hooke’s law, F = kx). A stiffer spring raises the natural frequency, making the system faster but harder to stabilize."
							value={w.springConstant} min={0} step={0.1} onChange={(v) => w.update({ springConstant: v })} />
					</div>
				</Panel>
			</section>

			<section>
				<p className="section-label">Controller · state feedback</p>
				<Panel>
					<div className="gain-pair">
						<GainField name="Kp" unit="position" hint="Position (proportional) gain. u = −Kp·(x₁ − r₁) − Kd·(x₂ − ṙ₂). More Kp gives a stiffer, faster response but can cause overshoot or instability."
							value={gain[0]} min={-50} max={100}
							onChange={(v) => {
								if (w.useOptimized && w.optimizedGain) w.update({ optimizedGain: [v, w.optimizedGain[1]] })
								else w.update({ manualGain: [v, w.manualGain[1]] })
							}} />
						<GainField name="Kd" unit="velocity" hint="Velocity (derivative) gain, acts like extra damping. Raising it calms oscillation."
							value={gain[1]} min={-50} max={100}
							onChange={(v) => {
								if (w.useOptimized && w.optimizedGain) w.update({ optimizedGain: [w.optimizedGain[0], v] })
								else w.update({ manualGain: [w.manualGain[0], v] })
							}} />
					</div>
					<div style={{ marginTop: 12 }} className="row row--between">
						<CheckField label="Reference tracking" checked={w.tracking} onChange={(v) => w.update({ tracking: v })} hint={LEARNING.tracking} />
						<span className="mono faint">u = −{fmt(gain[0], 3)}·(x₁ − r₁) − {fmt(gain[1], 3)}·(x₂ − r₂)</span>
					</div>
				</Panel>
			</section>

			<section>
				<p className="section-label">Reference & simulation</p>
				<Panel>
					<div className="form-grid">
						<NumberField label="Reference position" unit="m" hint="Position the controller chases (x₁ reference)."
							value={w.reference[0]} step={0.1} onChange={(v) => w.update({ reference: [v, w.reference[1]] })} />
						<NumberField label="Reference velocity" unit="m/s" hint="Velocity reference (x₂)."
							value={w.reference[1]} step={0.1} onChange={(v) => w.update({ reference: [w.reference[0], v] })} />
						<NumberField label="End time" unit="s" hint="Horizon of the simulation. Longer horizons let the response fully settle."
							value={w.endTime} min={0.1} step={1} onChange={(v) => w.update({ endTime: v })} />
						<NumberField label="Time step" unit="s" hint="RK4 integration step. Smaller steps are more accurate but cost more samples; 0.01 is a good default."
							value={w.timeStep} min={0.0001} step={0.001} onChange={(v) => w.update({ timeStep: v })} />
						<NumberField label="Initial position" unit="m" hint="Starting position x(0)."
							value={w.initialState[0]} step={0.1} onChange={(v) => w.update({ initialState: [v, w.initialState[1]] })} />
						<NumberField label="Initial velocity" unit="m/s" hint="Starting velocity ẋ(0)."
							value={w.initialState[1]} step={0.1} onChange={(v) => w.update({ initialState: [w.initialState[0], v] })} />
					</div>
					<div style={{ marginTop: 14 }} className="row">
						<button className="btn primary" onClick={() => void w.runSimulation()}>Run simulation</button>
						<Learn title="Read the plot">
							<p>{LEARNING.sim}</p>
						</Learn>
					</div>
				</Panel>
			</section>

			<div className="charts-grid charts-grid--2a">
				<Panel title="Trajectory">
					{w.simulation ? <TimeSeriesChart response={w.simulation} /> : <div className="empty">No simulation yet</div>}
				</Panel>
				<Panel title="Pole-Zero Map">
					{w.stability ? (
						<>
							<PoleZeroChart eigenvalues={eigenvalues ?? []} />
							<div style={{ marginTop: 8 }} className="row">
								<span className="faint">Closed-loop stability:</span>{' '}
								{w.stability.stable ? <span>Stable · poles in the left half-plane</span> : <span>Unstable · increase Kp or Kd</span>}
							</div>
						</>
					) : (
						<div className="empty">
							Run stability analysis to see the pole-zero map.
							<div style={{ marginTop: 8 }}>
								<button className="btn secondary" onClick={() => void w.runStability()}>Analyze stability</button>
							</div>
						</div>
					)}
				</Panel>
			</div>

			<Panel title="Metrics" right={<span className="mono faint">K = [{fmt(gain[0])}, {fmt(gain[1])}]</span>}>
				{metrics ? (
					<>
						<div className="metric-group">
							<p className="metric-group__label">Tracking quality</p>
							<div className="grid-3">
								<MetricCard hint={LEARNING.metrics} label="Final error" value={fmt(metrics.finalError)} tone="neutral" />
								<MetricCard hint={LEARNING.metrics} label="IAE" value={fmt(metrics.iae, 4)} sub="integral of |error|" />
								<MetricCard hint={LEARNING.metrics} label="ISE" value={fmt(metrics.ise, 4)} sub="integral of error²" />
							</div>
						</div>
						<div className="metric-group">
							<p className="metric-group__label">Transient response</p>
							<div className="grid-3">
								<MetricCard hint={LEARNING.metrics} label="Max abs error" value={fmt(metrics.maxAbsError, 3)} tone={metricTone(metrics, 'maxAbsError')} />
								<MetricCard hint="Overshoot. How far the response exceeds the reference, as a percentage of the step." label="Overshoot" value={`${fmt(metrics.overshoot)}%`} tone={metricTone(metrics, 'overshoot')} />
								<MetricCard hint={`Settling time. When the response stays within the ${settlingBand}% band and never leaves it. "Not reached" means the response never settles within the horizon.`}
									label="Settling time" value={metrics.settlingTime === null ? 'Not reached' : `${fmt(metrics.settlingTime)} s`} sub={`${settlingBand}% band`} />
							</div>
						</div>
						<div className="metric-group">
							<p className="metric-group__label">Control signal</p>
							<div className="grid-3">
								<MetricCard hint={LEARNING.metrics} label="Control effort" value={fmt(metrics.controlEffort, 4)} sub="integral of |u|²" />
								<MetricCard hint="Peak magnitude of the actuator command, the practical force the controller demands." label="Max |u|" value={fmt(metrics.maxControl)} />
							</div>
						</div>
					</>
				) : (
					<div className="empty">Run a simulation to see metrics.</div>
				)}
			</Panel>

			<Panel title="Settling-time band">
				<p className="faint" style={{ marginTop: 0 }}>Settling time is measured against a tolerance band around the reference. Raise it for a more forgiving definition.</p>
				<div className="radio-list">
					{SETTLING_OPTIONS.map((o) => (
						<RadioChip key={o.value} label={o.label} value={o.value} active={String(settlingBand) === o.value}
							onChange={(v) => w.update({ settlingBand: parseInt(v, 10) })} />
					))}
				</div>
			</Panel>

			{w.error && <div className="callout callout--error">{w.error}</div>}
			{w.loading && <div className="callout callout--info">{w.loading}</div>}
		</div>
	)
}

export default SimulateTab