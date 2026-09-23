import { CheckField, Learn, MetricCard, NumberField, ObjectiveBars, Panel, SelectField } from '../components/common'
import { fmt } from '../components/common'
import { ConvergenceChart, CostSurfaceHeatmap } from '../components/charts'
import { useWorkspace } from '../state/WorkspaceContext'

const LEARNING = {
	optimize: 'The optimizer searches the gain box [Kp_min, Kp_max] × [Kd_min, Kd_max] for the pair K = (Kp, Kd) that minimizes the weighted objective J = wₑ·IAE + wᵤ·control effort + wₛ·settling time + wₒ·overshoot. Lower J = better tracking with less control effort. Grid search sweeps the box exhaustively (slow but complete) and returns the full cost surface. Differential evolution evolves a population using mutation (F) and crossover (CR): fast, seeded, and reproducible.',
	objective: 'The four weights trade off competing goals. trackingError (wₑ) punishes accumulated deviation; control effort (wᵤ) punishes energetic command signals (actuator wear); settling time (wₛ) punishes slow convergence; overshoot (wₒ) punishes overshooting the reference. Raise a weight to favor that property. The presets set sensible starting points.',
	formula: 'J = wₑ·IAE + wᵤ·U + wₛ·Tₛ + wₒ·O, where U is integrated control effort ∫|u|² dt, Tₛ is settling time (missing runs are penalized as the full horizon), O is overshoot %. Lower J is better.',
	convergence: 'The convergence curve shows the best objective J found at each progression step. Grid search improves monotonically as it evaluates more of the box; DE improves per generation. When the curve flattens, extra iterations stop paying off.',
	grid: 'Grid search evaluates every point on a resolution × resolution lattice over the gain box. Lower resolution = fast, coarse; higher resolution = fine, slow. With "Return cost surface" on, the response includes the full heatmap: dark blue is low J (good), white/null is infeasible.',
	de: 'DE keeps a population of candidate gain vectors. Each generation it mutates members (differentialWeight F scales the difference between two members) and crosses them (crossoverRate CR mixes in mutant genes). maxIterations limits generations; seed makes the run deterministic.',
	constraints: 'Constraints are off by default. When enabled, candidates that violate them are treated as infeasible. The optimizer must stay within the actuator and response limits. The result reports achieved vs limit for each.',
}

const PRESETS: { key: string; label: string; weights: { trackingErrorWeight: number; controlEffortWeight: number; settlingTimeWeight: number; overshootWeight: number } }[] = [
	{ key: 'balanced', label: 'Balanced', weights: { trackingErrorWeight: 1, controlEffortWeight: 0.1, settlingTimeWeight: 0.5, overshootWeight: 0.5 } },
	{ key: 'fast', label: 'Fast response', weights: { trackingErrorWeight: 5, controlEffortWeight: 0.05, settlingTimeWeight: 2, overshootWeight: 0.3 } },
	{ key: 'effort', label: 'Low actuator effort', weights: { trackingErrorWeight: 1, controlEffortWeight: 1.5, settlingTimeWeight: 0.3, overshootWeight: 0.5 } },
	{ key: 'overshoot', label: 'Minimal overshoot', weights: { trackingErrorWeight: 1.5, controlEffortWeight: 0.3, settlingTimeWeight: 0.4, overshootWeight: 2.5 } },
	{ key: 'tracking', label: 'Tracking priority', weights: { trackingErrorWeight: 6, controlEffortWeight: 0.1, settlingTimeWeight: 0.6, overshootWeight: 0.5 } },
	{ key: 'custom', label: 'Custom', weights: { trackingErrorWeight: 1, controlEffortWeight: 0.1, settlingTimeWeight: 0.5, overshootWeight: 0.5 } },
]

function matchesPreset(w: { trackingErrorWeight: number; controlEffortWeight: number; settlingTimeWeight: number; overshootWeight: number }) {
	return PRESETS.find(
		(p) => p.key !== 'custom' && Math.abs(p.weights.trackingErrorWeight - w.trackingErrorWeight) < 1e-6 && Math.abs(p.weights.controlEffortWeight - w.controlEffortWeight) < 1e-6 && Math.abs(p.weights.settlingTimeWeight - w.settlingTimeWeight) < 1e-6 && Math.abs(p.weights.overshootWeight - w.overshootWeight) < 1e-6,
	)?.key ?? 'custom'
}

export function OptimizeTab() {
	const w = useWorkspace()
	const surf = w.optimizerResult?.costSurface
	const metricSurfaces = w.optimizerResult?.metricSurfaces
	const hasSurface = surf !== null && surf !== undefined && surf.length > 0
	const activePreset = matchesPreset(w)
	const breakdown = w.optimizerResult?.objectiveBreakdown
	const constraintReport = w.optimizerResult?.constraints

	const weights = [
		{ label: 'Tracking error', symbol: 'trackingErrorWeight', value: w.trackingErrorWeight, hint: 'wₑ · weight on integrated absolute error (IAE).' },
		{ label: 'Control effort', symbol: 'controlEffortWeight', value: w.controlEffortWeight, hint: 'wᵤ · weight on ∫|u|² dt. Higher keeps the actuator from saturating.' },
		{ label: 'Settling time', symbol: 'settlingTimeWeight', value: w.settlingTimeWeight, hint: 'wₛ · weight on time to settle. Non-settling runs are penalized as the full horizon.' },
		{ label: 'Overshoot', symbol: 'overshootWeight', value: w.overshootWeight, hint: 'wₒ · weight on overshoot percentage.' },
	]

	const handleWeight = (symbol: string, value: number) => {
		w.update({ [symbol]: Number.isFinite(value) ? value : 0 } as never)
	}

	const handlePreset = (key: string) => {
		const p = PRESETS.find((x) => x.key === key)
		if (p && p.key !== 'custom') w.update({ ...p.weights })
	}

	const constraintFields = [w.maxControl, w.maxOvershoot, w.maxSettlingTime]
	const hasActiveConstraints = w.constraintsEnabled && constraintFields.some((v) => Number.isFinite(v) && v > 0)

	return (
		<div className="stack">
			<Learn title="How optimization works">
				<p>{LEARNING.optimize}</p>
				<p>{LEARNING.objective}</p>
			</Learn>

			<section>
				<p className="section-label">Step 1 · Search space</p>
				<Panel>
					<div className="gain-pair">
						<div className="gain-card">
							<span className="gain-card__label">Kp <span className="faint">position gain</span></span>
							<span className="gain-card__desc">Search range for the proportional gain.</span>
							<div className="form-grid">
								<NumberField label="Min" value={w.gainLower[0]} step={1} min={-100} onChange={(v) => w.update({ gainLower: [v, w.gainLower[1]] })} />
								<NumberField label="Max" value={w.gainUpper[0]} step={1} min={-100} onChange={(v) => w.update({ gainUpper: [v, w.gainUpper[1]] })} />
							</div>
						</div>
						<div className="gain-card">
							<span className="gain-card__label">Kd <span className="faint">velocity gain</span></span>
							<span className="gain-card__desc">Search range for the derivative gain.</span>
							<div className="form-grid">
								<NumberField label="Min" value={w.gainLower[1]} step={1} min={-100} onChange={(v) => w.update({ gainLower: [w.gainLower[0], v] })} />
								<NumberField label="Max" value={w.gainUpper[1]} step={1} min={-100} onChange={(v) => w.update({ gainUpper: [w.gainUpper[0], v] })} />
							</div>
						</div>
					</div>
				</Panel>
			</section>

			<section>
				<p className="section-label">Step 2 · Method</p>
				<Panel>
					<SelectField
						label="Search strategy"
						value={w.optimizerType}
						hint="Grid search: exhaustive, deterministic, supports the cost-surface heatmap. Differential evolution: population-based, seeded and reproducible, scales to higher dimensions."
						onChange={(v) => w.update({ optimizerType: v as 'GRID_SEARCH' | 'DIFFERENTIAL_EVOLUTION' })}
						options={[
							{ value: 'GRID_SEARCH', label: 'Grid search (deterministic)' },
							{ value: 'DIFFERENTIAL_EVOLUTION', label: 'Differential evolution (seeded)' },
						]}
					/>
					{w.optimizerType === 'GRID_SEARCH' ? (
						<>
							<div style={{ marginTop: 12 }} className="form-grid">
								<NumberField label="Grid resolution (per dim.)" hint="Samples per gain dimension. Total evaluations = resolution². 41 → 1,681 simulations, 101 → ~10,000."
									value={w.gridResolution} min={2} max={101} step={1} onChange={(v) => w.update({ gridResolution: Math.round(v) })} />
								<CheckField label="Return cost surface (2-D grid)" checked={w.includeCostSurface}
									onChange={(v) => w.update({ includeCostSurface: v })} hint="When on, the response includes the full objective heatmap over the grid, plus per-cell IAE and control effort for the interactive tooltip." />
							</div>
							<div style={{ marginTop: 10 }}><Learn title="About grid search"><p>{LEARNING.grid}</p></Learn></div>
						</>
					) : (
						<>
							<div style={{ marginTop: 12 }} className="form-grid">
								<NumberField label="Population size" hint="Number of candidate gain vectors evolved per generation. Larger = better coverage, more cost per step."
									value={w.populationSize} min={4} step={2} onChange={(v) => w.update({ populationSize: Math.round(v) })} />
								<NumberField label="Max iterations" hint="Generations the population is evolved. Stop early when convergence flattens."
									value={w.maxIterations} min={1} step={10} onChange={(v) => w.update({ maxIterations: Math.round(v) })} />
								<NumberField label="Differential weight F" hint="Mutation factor, typically 0.5 to 1. Higher F = more exploratory; lower = closer to parent."
									value={w.differentialWeight} min={0} max={2} step={0.05} onChange={(v) => w.update({ differentialWeight: v })} />
								<NumberField label="Crossover rate CR" hint="Probability a trial vector inherits a mutated gene. Higher CR = more aggressive mixing."
									value={w.crossoverRate} min={0} max={1} step={0.05} onChange={(v) => w.update({ crossoverRate: v })} />
								<NumberField label="Seed" hint="Random seed. The DE run is fully deterministic for a fixed seed and reproducible exactly."
									value={w.seed} step={1} onChange={(v) => w.update({ seed: Math.round(v) })} />
							</div>
							<div style={{ marginTop: 10 }}><Learn title="About differential evolution"><p>{LEARNING.de}</p></Learn></div>
						</>
					)}
				</Panel>
			</section>

			<section>
				<p className="section-label">Step 3 · Objective</p>
				<Panel>
					<p className="faint" style={{ marginTop: 0 }}>{LEARNING.formula}</p>
					<div className="preset-row">
						{PRESETS.map((p) => (
							<button key={p.key} className={`preset-chip ${activePreset === p.key ? 'active' : ''}`} onClick={() => handlePreset(p.key)}>
								{p.label}
							</button>
						))}
					</div>
					<ObjectiveBars weights={weights} onChange={handleWeight} />
				</Panel>
			</section>

			<section>
				<p className="section-label">Step 4 · Constraints (optional)</p>
				<Panel>
					<CheckField label="Enforce constraints during search" checked={w.constraintsEnabled}
						onChange={(v) => w.update({ constraintsEnabled: v })} hint={LEARNING.constraints} />
					{w.constraintsEnabled && (
						<div style={{ marginTop: 12 }} className="form-grid">
							<NumberField label="Max |u|" unit="force" hint="Ceiling on the peak actuator command. Candidates exceeding it are infeasible."
								value={Number.isFinite(w.maxControl) ? w.maxControl : 0} min={0} step={1} onChange={(v) => w.update({ maxControl: v })} />
							<NumberField label="Max overshoot" unit="%" hint="Ceiling on overshoot percentage."
								value={Number.isFinite(w.maxOvershoot) ? w.maxOvershoot : 0} min={0} step={1} onChange={(v) => w.update({ maxOvershoot: v })} />
							<NumberField label="Max settling time" unit="s" hint="Latest time the response may settle (within the settling band)."
								value={Number.isFinite(w.maxSettlingTime) ? w.maxSettlingTime : 0} min={0} step={0.5} onChange={(v) => w.update({ maxSettlingTime: v })} />
						</div>
					)}
				</Panel>
			</section>

			{w.error && <div className="callout callout--error">{w.error}</div>}
			{w.loading && <div className="callout callout--info">{w.loading}</div>}

			<div className="btn-row btn-row--end">
				<button className="btn primary btn--block" onClick={() => void w.runOptimization()} disabled={w.loading !== null}>
					{w.loading ?? 'Run optimization'}
				</button>
			</div>

			{w.optimizerResult ? (
				<div className="stack">
					<Panel title="Optimization">
						<div className="opt-summary">
							<div className="opt-summary__row">
								<span>Method</span>
								<span>{w.optimizerType === 'GRID_SEARCH' ? `Grid search · ${w.gridResolution}×${w.gridResolution} cells` : `Differential evolution · pop ${w.populationSize} × gen ${w.maxIterations}`}</span>
							</div>
							<div className="opt-summary__row">
								<span>Search space</span>
								<span className="mono">Kp: {fmt(w.gainLower[0], 1)} → {fmt(w.gainUpper[0], 1)} · Kd: {fmt(w.gainLower[1], 1)} → {fmt(w.gainUpper[1], 1)}</span>
							</div>
							{w.optimizerType === 'GRID_SEARCH' && (
								<div className="opt-summary__row">
									<span>Step</span>
									<span className="mono">Kp {fmt((w.gainUpper[0] - w.gainLower[0]) / (w.gridResolution - 1), 3)} · Kd {fmt((w.gainUpper[1] - w.gainLower[1]) / (w.gridResolution - 1), 3)}</span>
								</div>
							)}
							<div className="opt-summary__row">
								<span>Runtime</span>
								<span className="mono">{fmt(w.optimizerResult.elapsedMillis, 0)} ms · {fmt(w.optimizerResult.evaluations, 0)} evaluations</span>
							</div>
							<div className="opt-summary__row">
								<span>Feasible</span>
								<span>{w.optimizerResult.feasible ? 'Yes · best candidate found' : 'No feasible candidate in the box'}</span>
							</div>
							<div className="opt-summary__row">
								<span>Best candidate</span>
								<span className="mono">K = [{w.optimizerResult.bestGain.map((g) => fmt(g, 3)).join(', ')}]</span>
							</div>
							<div className="opt-summary__row">
								<span>Objective</span>
								<span className="mono">J = {w.optimizerResult.bestCost === null ? 'Not feasible' : fmt(w.optimizerResult.bestCost, 4)}</span>
							</div>
						</div>
					</Panel>

					<Panel title="Optimization Result" right={<Learn title="Read the results"><p>{LEARNING.convergence}</p></Learn>}>
						<div className="grid-3">
							<MetricCard hint="Best gain vector found, applied as K = (Kp, Kd) for u = −K(x − r)." label="Best gain" value={`[${w.optimizerResult.bestGain.map((g) => fmt(g, 3)).join(', ')}]`} />
							<MetricCard hint="Value of the weighted objective J at the best gain. Lower is better." label="Best cost (J)" value={w.optimizerResult.bestCost === null ? 'Not feasible' : fmt(w.optimizerResult.bestCost, 4)} />
							<MetricCard hint="Simulations run during the search. Grid: resolution². DE: population × generations." label="Evaluations" value={fmt(w.optimizerResult.evaluations, 0)} sub={`${w.optimizerResult.elapsedMillis} ms`} />
							<MetricCard hint="Whether any stable, valid gain was found inside the box." label="Feasible" value={w.optimizerResult.feasible ? 'Yes' : 'No'} tone={w.optimizerResult.feasible ? 'good' : 'bad'} />
							<MetricCard hint="Grid search always converges (finite box). DE converged when improvement stalled before max iterations." label="Converged" value={w.optimizerResult.converged ? 'Yes' : 'No'} tone={w.optimizerResult.converged ? 'good' : 'neutral'} />
							<MetricCard hint="Random seed used (DE only). Re-run with the same seed reproduces these exact results." label="Seed" value={w.optimizerResult.seed === null ? 'Not used' : fmt(w.optimizerResult.seed, 0)} />
						</div>

						{w.optimizerResult.feasible && w.optimizerResult.bestGain.length >= 1 && (
							<div style={{ marginTop: 12 }} className="btn-row">
								<button className="btn" onClick={w.applyOptimizedGain}>Apply optimized gain</button>
							</div>
						)}

						{w.optimizerType === 'DIFFERENTIAL_EVOLUTION' && (
							<p className="faint" style={{ marginBottom: 0 }}>
								Seeded search explores the box by sampling: this K is the best of that sample, not the box-wide optimum. Run grid search at the same resolution to confirm the exhaustive best.
							</p>
						)}
					</Panel>

					{breakdown && (
						<Panel title="Why this objective value?">
							<p className="faint" style={{ marginTop: 0 }}>J = wₑ·IAE + wᵤ·U + wₛ·Tₛ + wₒ·O. When a run never settles, the settling term is penalized as the full horizon ({fmt(w.endTime)} s).</p>
							<div className="objective-breakdown grid-3">
								<MetricCard label="Tracking (wₑ·IAE)" value={fmt(breakdown.trackingError, 4)} />
								<MetricCard label="Control (wᵤ·U)" value={fmt(breakdown.controlEffort, 4)} />
								<MetricCard
									label={w.optimizerResult?.metrics?.settlingTime === null ? 'Settling penalty (wₛ·Tₛ)' : 'Settling (wₛ·Tₛ)'}
									value={fmt(breakdown.settlingTime, 4)}
									sub={w.optimizerResult?.metrics?.settlingTime === null ? `Ts not reached · full horizon ${fmt(w.endTime)} s` : 'Ts reached'}
								/>
								<MetricCard label="Overshoot (wₒ·O)" value={fmt(breakdown.overshoot, 4)} />
								<MetricCard label="Total J" value={fmt(breakdown.total, 4)} tone="neutral" />
							</div>
						</Panel>
					)}

					{constraintReport && hasActiveConstraints && (
						<Panel title="Constraint report">
							<table className="data">
								<thead>
									<tr>
										<th>Constraint</th>
										<th>Achieved</th>
										<th>Limit</th>
										<th>Status</th>
									</tr>
								</thead>
								<tbody>
									{constraintReport.map((c) => (
										<tr key={c.id} className={c.satisfied ? '' : 'row-best'}>
											<td>{c.name}</td>
											<td className="mono">{c.achieved === null ? 'Not reached' : fmt(c.achieved, 3)}</td>
											<td className="mono">{fmt(c.limit, 3)}</td>
											<td>{c.satisfied ? 'satisfied' : 'violated'}</td>
										</tr>
									))}
								</tbody>
							</table>
						</Panel>
					)}

					<Panel title="Convergence">
						<ConvergenceChart points={w.optimizerResult.convergence} />
					</Panel>

					{w.optimizerType === 'GRID_SEARCH' && hasSurface && (
						<Panel title="Interactive cost surface · Kp × Kd"
							right={<Learn title="Read the heatmap"><p>{LEARNING.grid}</p></Learn>}>
							<CostSurfaceHeatmap
								surface={surf as (number | null)[][]}
								axisLabels={['Kp', 'Kd']}
								metricSurfaces={metricSurfaces ?? undefined}
								optimum={w.optimizerResult.feasible ? w.optimizerResult.bestGain : undefined}
								manual={(w.useOptimized ? w.optimizedGain : w.manualGain) ?? undefined}
								gainBounds={{ lower: [...w.gainLower], upper: [...w.gainUpper] }}
								resolution={[w.gridResolution, w.gridResolution]}
							/>
						</Panel>
					)}
				</div>
			) : (
				<div className="empty">Configure the optimizer and run it to see the objective surface, convergence curve, and best gain.</div>
			)}
		</div>
	)
}

export default OptimizeTab