import { useEffect, useRef } from 'react'

import { CheckField, GainField, Learn, MetricCard, NumberField, Panel, RadioChip } from '../components/common'
import { fmt } from '../components/common'
import { PoleZeroChart, TrajectoryChart } from '../components/charts'
import { useWorkspace } from '../state/WorkspaceContext'
import { poleSummary } from '../lib/poles'
import type { SimulationResponse } from '../api/types'

function metricTone(m: SimulationResponse['metrics'], key: 'overshoot' | 'maxAbsError') {
	const v = m[key]
	if (!Number.isFinite(v)) return 'good'
	return v > 20 ? 'bad' : 'good'
}

const LEARNING = {
	sim: 'The simulated spring-damper follows ẋ = Ax + Bu, integrated with a fixed-step Runge-Kutta (RK4) solver. The three plots separate the states and the actuator command: position and velocity over time with the dashed reference they track, and control u(t) showing how hard the controller is working. The control law u = −K(x − r) is applied at every step.',
	stability: 'The closed-loop pole map plots the eigenvalues of A − BK (state feedback has no finite zeros). The system is stable when every pole sits in the left half-plane (real part < 0). Poles further left decay faster; a nonzero imaginary part means oscillation.',
	metrics: 'Metrics use the scalar position error e = r₁ − x₁ (position only, never mixed with velocity). IAE measures ∫|e| dt, ISE squares the error so large deviations hurt more. Overshoot is how far position exceeds the target. Settling time is when |e| stays inside the chosen band; if it never does, it shows "Not reached". Control energy U = ∫u² dt (units N²·s) is the integrated actuator demand; Max |u| is its peak.',
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

	const inputKey = JSON.stringify({
		mass: w.mass,
		damping: w.damping,
		springConstant: w.springConstant,
		tracking: w.tracking,
		gain: (w.useOptimized && w.optimizedGain ? w.optimizedGain : w.manualGain).join(','),
		useOptimized: w.useOptimized,
		initialState: w.initialState.join(','),
		reference: w.reference.join(','),
		endTime: w.endTime,
		timeStep: w.timeStep,
		settlingBand: w.settlingBand,
	})
	const attemptedKeyRef = useRef<string | null>(w.simulation === null ? null : inputKey)

	useEffect(() => {
		if (w.systemDescriptor === null) void w.loadCatalog()
	}, [w.systemDescriptor, w.loadCatalog])

	useEffect(() => {
		const needsRun = w.simulation === null || attemptedKeyRef.current !== inputKey
		if (!needsRun) return
		const isFirst = attemptedKeyRef.current === null
		const id = setTimeout(() => {
			attemptedKeyRef.current = inputKey
			void w.runSimulation(undefined, { silent: !isFirst })
			void w.runStability({ silent: true })
		}, isFirst ? 0 : 400)
		return () => clearTimeout(id)
	}, [inputKey, w.simulation, w.runSimulation, w.runStability, w.systemDescriptor, w.loadCatalog])

	const gain = w.useOptimized && w.optimizedGain ? w.optimizedGain : w.manualGain
	const metrics = w.simulation?.metrics
	const eigenvalues = w.stability?.eigenvalues
	const poleInfo = w.stability ? poleSummary(w.stability.eigenvalues ?? []) : null
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
				<Panel title="Position x₁(t)">
					{w.simulation ? <TrajectoryChart response={w.simulation} kind="position" /> : <div className="empty">No simulation yet</div>}
				</Panel>
				<Panel title="Closed-Loop Poles">
					{w.stability ? (
						<>
							<PoleZeroChart eigenvalues={eigenvalues ?? []} />
							<div className="poles-readout">
								{eigenvalues?.slice(0, 4).map((lam, i) => (
									<span key={i} className="mono">λ{i + 1} = {lam.imag === 0 ? fmt(lam.real, 3) : `${fmt(lam.real, 3)} ${lam.imag >= 0 ? '+' : '−'} ${fmt(Math.abs(lam.imag), 3)}i`}</span>
								))}
							</div>
							<div style={{ marginTop: 8 }} className="row">
								<span className="faint">Stability:</span>{' '}
								{w.stability.stable ? <span>Stable ✓ · poles in the left half-plane</span> : <span>Unstable ✗ · increase Kp or Kd</span>}
							</div>
						</>
					) : (
						<div className="empty">
							Running stability analysis…
						</div>
					)}
				</Panel>
			</div>

			<div className="charts-grid charts-grid--2a">
				<Panel title="Velocity x₂(t)">
					{w.simulation ? <TrajectoryChart response={w.simulation} kind="velocity" /> : <div className="empty">No simulation yet</div>}
				</Panel>
				<Panel title="Control u(t)">
					{w.simulation ? <TrajectoryChart response={w.simulation} kind="control" /> : <div className="empty">No simulation yet</div>}
				</Panel>
			</div>

			{poleInfo && (
				<Panel title="Pole preview">
					<div className="grid-3">
						<MetricCard label="Damping ratio ζ" value={poleInfo.zeta === null ? 'n/a' : fmt(poleInfo.zeta, 3)} hint="ζ from the closed-loop poles. Below 1 the response rings, above 1 it crawls. n/a when the poles are real." />
						<MetricCard label="Natural frequency ωₙ" value={poleInfo.omegaN === null ? 'n/a' : fmt(poleInfo.omegaN, 3)} sub="rad/s" hint="Undamped angular frequency from the pole magnitude." />
						<MetricCard label="Pole-based settling estimate" value={poleInfo.settlingEstimate === null ? 'n/a' : `≈ ${fmt(poleInfo.settlingEstimate, 2)} s`} hint="A model estimate from the dominant pole (2% rule: 4 / |Re λ|), not the measured settling time. The measured value is under Metrics." />
					</div>
				</Panel>
			)}

			<Panel title="Metrics" right={<span className="mono faint">K = [{fmt(gain[0])}, {fmt(gain[1])}]</span>}>
				{metrics ? (
					<>
						<div className="metric-group">
							<p className="metric-group__label">Tracking quality</p>
							<div className="grid-3">
								<MetricCard hint="Measured |r₁ − x₁| at the end of the horizon. With PD feedback a static offset can remain; see the steady-state error note below." label="Final error" value={fmt(metrics.finalError)} tone="neutral" />
								<MetricCard hint={LEARNING.metrics} label="IAE" value={fmt(metrics.iae, 4)} sub="∫|r₁ − x₁| dt" />
								<MetricCard hint={LEARNING.metrics} label="ISE" value={fmt(metrics.ise, 4)} sub="∫(r₁ − x₁)² dt" />
							</div>
						</div>
						<div className="metric-group">
							<p className="metric-group__label">Transient response</p>
							<div className="grid-3">
								<MetricCard hint={LEARNING.metrics} label="Max abs error" value={fmt(metrics.maxAbsError, 3)} sub="max |r₁ − x₁|" tone={metricTone(metrics, 'maxAbsError')} />
								<MetricCard hint="Overshoot. How far the response exceeds the reference, as a percentage of the step." label="Overshoot" value={`${fmt(metrics.overshoot)}%`} tone={metricTone(metrics, 'overshoot')} />
								<MetricCard hint={`Settling time. When the response stays within the ${settlingBand}% band and never leaves it. "Not reached" means the response never settles within the horizon.`}
									label="Settling time" value={metrics.settlingTime === null ? 'Not reached' : `${fmt(metrics.settlingTime)} s`} sub={`${settlingBand}% band`} />
							</div>
						</div>
						<div className="metric-group">
							<p className="metric-group__label">Control signal</p>
							<div className="grid-3">
								<MetricCard hint={LEARNING.metrics} label="Control energy" value={fmt(metrics.controlEffort, 4)} sub="U = ∫u² dt · N²·s" />
								<MetricCard hint="Peak magnitude of the actuator command, the practical force the controller demands." label="Max |u|" value={fmt(metrics.maxControl)} />
							</div>
						</div>
					</>
				) : (
					<div className="empty">Run a simulation to see metrics.</div>
				)}
			</Panel>

			{w.tracking && (
				<Panel title="Steady-state error">
					<p className="faint" style={{ marginTop: 0 }}>
						With u = −K(x − r), state feedback alone cannot cancel the spring's static load. The position
						settles at x_ss = Kp/(k + Kp) · r₁, so the steady-state error is e_ss = k/(k + Kp) · r₁.
						{gain[0] + w.springConstant !== 0 ? (
							<span> For these gains e_ss = {fmt((w.springConstant / (w.springConstant + gain[0])) * w.reference[0], 4)} m, matching the measured Final error above.</span>
						) : (
							<span> (undefined: k + Kp = 0).</span>
						)}{' '}
						Raising Kp shrinks the offset but never removes it. Add integral action (PID, or a state
						augmented with ∫e dt) to drive e_ss to zero.
					</p>
				</Panel>
			)}

			<Panel title="Settling time across bands">
				<p className="faint" style={{ marginTop: 0 }}>The same run measured against four tolerance bands. Tight bands require the response to hug the reference; a "Not reached" row is the steady-state offset described above.</p>
				{metrics?.settlingTimeByBand?.length ? (
					<table className="data">
						<thead>
							<tr>
								<th>Band</th>
								<th>Measured settling time</th>
							</tr>
						</thead>
						<tbody>
							{metrics.settlingTimeByBand.map((b) => (
								<tr key={b.band}>
									<td>{b.band}% of |r|</td>
									<td>{b.time === null ? 'Not reached' : `${fmt(b.time, 3)} s`}</td>
								</tr>
							))}
						</tbody>
					</table>
				) : (
					<div className="empty">Run a simulation to see settling at each band.</div>
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
			{w.refreshing && !w.loading && <div className="callout callout--info">Refreshing results after your edits…</div>}
		</div>
	)
}

export default SimulateTab