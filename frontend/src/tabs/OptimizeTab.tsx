import { Check, Rocket } from 'lucide-react'
import { Badge, Callout, CheckField, DataTable, Disclosure, Empty, KeyValue, Learn, MetricCard, NumberField, ObjectiveBars, ObjectiveBreakdownTable, Panel, SelectField, SettlingBandTable } from '../components/common'
import { fmt, fmtGain } from '../components/common'
import { ConvergenceChart, CostSurfaceHeatmap } from '../components/charts'
import { useWorkspace } from '../state/WorkspaceContext'

const LEARNING = {
	optimize: 'The optimizer searches the gain box [Kp_min, Kp_max] × [Kd_min, Kd_max] for the pair K = (Kp, Kd) that minimizes the weighted objective J = wₑ·IAE + wᵤ·U + wₛ·Tₛ + wₒ·O (+ wᵥ·e_ss when the steady-state term is enabled), where U is control energy ∫u² dt and e_ss is the analytic steady-state tracking error. Every term is normalized against a fixed positive scale derived from the problem, so results do not depend on any manual baseline gain. Lower J = better tracking with less control effort. Grid search sweeps the box exhaustively (slow but complete) and returns the full cost surface. Differential evolution evolves a population using mutation (F) and crossover (CR): fast, seeded, and reproducible.',
	objective: 'The weights trade off competing goals. trackingError (wₑ) punishes accumulated deviation; control energy (wᵤ) punishes commanding the actuator hard; settling time (wₛ) punishes slow convergence; overshoot (wₒ) punishes overshooting the reference; steadyStateError (wᵥ, optional) punishes the residual tracking offset directly. Raise a weight to favor that property. Terms are normalized against fixed scales derived from the problem, so J stays comparable across gain ranges. The presets set sensible starting points.',
	formula: 'J = wₑ·IAE + wᵤ·U + wₛ·Tₛ + wₒ·O (+ wᵥ·e_ss when the steady-state term is enabled), where IAE is integrated position error ∫|r₁ − x₁| dt, U is control energy ∫u² dt, Tₛ is settling time (missing runs are penalized as the full horizon), O is overshoot %, and e_ss is the analytic steady-state tracking error. Each term is normalized by a fixed positive scale (IAE by |r₁|·T, energy by (k·|r₁|)²·T, settling by T, overshoot by 100, steady-state error by |r₁|). Lower J is better.',
	convergence: 'The convergence curve shows the best objective J found at each progression step. Grid search improves monotonically as it evaluates more of the box; DE improves per generation. When the curve flattens, extra iterations stop paying off.',
	grid: 'Grid search evaluates every point on a resolution × resolution lattice over the gain box. Lower resolution = fast, coarse; higher resolution = fine, slow. With "Return cost surface" on, the response includes the full heatmap: dark blue is low J (good), white/null is infeasible.',
	de: 'DE keeps a population of candidate gain vectors. Each generation it mutates members (differentialWeight F scales the difference between two members) and crosses them (crossoverRate CR mixes in mutant genes). maxIterations limits generations; seed makes the run deterministic.',
	constraints: 'Constraints are off by default. When enabled, candidates that violate them are treated as infeasible. Limits cover peak force, overshoot, settling time, steady-state tracking error e_ss, and control energy U = ∫u² dt. The result reports achieved vs limit for each, and when no feasible candidate exists the response explains why.',
}

const PRESETS: { key: string; label: string; weights: { trackingErrorWeight: number; controlEffortWeight: number; settlingTimeWeight: number; overshootWeight: number } }[] = [
	{ key: 'balanced', label: 'Balanced', weights: { trackingErrorWeight: 1, controlEffortWeight: 0.2, settlingTimeWeight: 0.5, overshootWeight: 0.5 } },
	{ key: 'fast', label: 'Fast response', weights: { trackingErrorWeight: 5, controlEffortWeight: 0.05, settlingTimeWeight: 2, overshootWeight: 0.3 } },
	{ key: 'effort', label: 'Low actuator effort', weights: { trackingErrorWeight: 1, controlEffortWeight: 1.5, settlingTimeWeight: 0.3, overshootWeight: 0.5 } },
	{ key: 'overshoot', label: 'Minimal overshoot', weights: { trackingErrorWeight: 1.5, controlEffortWeight: 0.3, settlingTimeWeight: 0.4, overshootWeight: 2.5 } },
	{ key: 'tracking', label: 'Tracking priority', weights: { trackingErrorWeight: 6, controlEffortWeight: 0.1, settlingTimeWeight: 0.6, overshootWeight: 0.5 } },
	{ key: 'custom', label: 'Custom', weights: { trackingErrorWeight: 1, controlEffortWeight: 0.1, settlingTimeWeight: 0.5, overshootWeight: 0.5 } },
]

function matchesPreset(w: { trackingErrorWeight: number; controlEffortWeight: number; settlingTimeWeight: number; overshootWeight: number }) {
	const n = { trackingErrorWeight: w.trackingErrorWeight, controlEffortWeight: w.controlEffortWeight, settlingTimeWeight: w.settlingTimeWeight, overshootWeight: w.overshootWeight }
	const custom = PRESETS.find((p) => p.key === 'custom')!
	const matchesCustom = Math.abs(custom.weights.trackingErrorWeight - n.trackingErrorWeight) < 1e-6
		&& Math.abs(custom.weights.controlEffortWeight - n.controlEffortWeight) < 1e-6
		&& Math.abs(custom.weights.settlingTimeWeight - n.settlingTimeWeight) < 1e-6
		&& Math.abs(custom.weights.overshootWeight - n.overshootWeight) < 1e-6
	if (matchesCustom) return 'custom'
	return PRESETS.find(
		(p) => p.key !== 'custom' && Math.abs(p.weights.trackingErrorWeight - n.trackingErrorWeight) < 1e-6 && Math.abs(p.weights.controlEffortWeight - n.controlEffortWeight) < 1e-6 && Math.abs(p.weights.settlingTimeWeight - n.settlingTimeWeight) < 1e-6 && Math.abs(p.weights.overshootWeight - n.overshootWeight) < 1e-6,
	)?.key ?? 'custom'
}

export function OptimizeTab() {
	const w = useWorkspace()
	const busy = w.loading !== null || w.refreshing
	const surf = w.optimizerResult?.costSurface
	const metricSurfaces = w.optimizerResult?.metricSurfaces
	const hasSurface = surf !== null && surf !== undefined && surf.length > 0
	const activePreset = matchesPreset(w)
	const breakdown = w.optimizerResult?.objectiveBreakdown
	const constraintReport = w.optimizerResult?.constraints
	// The result describes the run it was launched with, so bound/step/method
	// reads prefer the request-time snapshot over the live form, which the user
	// may have edited since the run finished.
	const cfg = w.optimizerConfig
	const runType = cfg?.optimizerType ?? w.optimizerType
	const runGridResolution = cfg?.gridResolution ?? w.gridResolution
	const runPopulation = cfg?.populationSize ?? w.populationSize
	const runIterations = cfg?.maxIterations ?? w.maxIterations
	const runLower = cfg?.gainLower ?? w.gainLower
	const runUpper = cfg?.gainUpper ?? w.gainUpper
	const runFeedforward = cfg?.feedforward ?? w.feedforward
	const runSaturation = cfg?.saturation ?? w.saturation
	const boundaryHits: string[] = []
	if (w.optimizerResult?.feasible && (w.optimizerResult.bestGain?.length ?? 0) >= 2) {
		const axes: { label: string; index: number }[] = [
			{ label: 'Kp', index: 0 },
			{ label: 'Kd', index: 1 },
		]
		for (const axis of axes) {
			const best = w.optimizerResult.bestGain[axis.index]
			if (Math.abs(best - runLower[axis.index]) < 1e-9) boundaryHits.push(`${axis.label} = ${fmtGain(best)} (lower edge)`)
			else if (Math.abs(best - runUpper[axis.index]) < 1e-9) boundaryHits.push(`${axis.label} = ${fmtGain(best)} (upper edge)`)
		}
	}
	const boundaryHit = w.optimizerResult?.boundaryHit ?? false

	const weights = [
		{ label: 'Tracking error', symbol: 'trackingErrorWeight', value: w.trackingErrorWeight, hint: 'wₑ · weight on integrated absolute error (IAE).' },
		{ label: 'Control energy', symbol: 'controlEffortWeight', value: w.controlEffortWeight, hint: 'wᵤ · weight on ∫u² dt (N²·s). Higher keeps the actuator from working so hard.' },
		{ label: 'Settling time', symbol: 'settlingTimeWeight', value: w.settlingTimeWeight, hint: 'wₛ · weight on time to settle. Non-settling runs are penalized as the full horizon.' },
		{ label: 'Overshoot', symbol: 'overshootWeight', value: w.overshootWeight, hint: 'wₒ · weight on overshoot percentage.' },
	]

	const handleWeight = (symbol: string, value: number) => {
		w.update({ [symbol]: Number.isFinite(value) ? value : 0 } as never)
	}

	const handlePreset = (key: string) => {
		const p = PRESETS.find((x) => x.key === key)
		if (p) w.update({ ...p.weights })
	}

	const constraintFields = [w.maxControl, w.maxOvershoot, w.maxSettlingTime, w.maxSteadyStateError, w.maxControlEnergy]
	const hasActiveConstraints = w.constraintsEnabled && constraintFields.some((v) => Number.isFinite(v) && v > 0)

	const result = w.optimizerResult
	const infeasible = result != null && !result.feasible
	const nearMiss = infeasible ? (result?.nearestMiss ?? null) : null
	// Bands come from whichever candidate the response actually reports on, so
	// the infeasible card describes the nearest miss rather than nothing.
	const reportedMetrics = infeasible ? nearMiss?.metrics ?? null : w.optimizerResult?.metrics ?? null
	// a rejected gain must never be shown as "the best gain", so the two cases
	// are labelled separately instead of sharing one formatter
	const bestGainLabel = (result?.bestGain ?? []).map((g) => fmtGain(g)).join(', ')
	const heroGainLabel = result?.feasible
		? bestGainLabel
		: (nearMiss?.gain.map((g) => fmtGain(g)).join(', ') ?? bestGainLabel)

	return (
		<div className="stack">
			<Learn title="How optimization works">
				<p>{LEARNING.optimize}</p>
				<p>{LEARNING.objective}</p>
			</Learn>

			<Panel title="Plant · the physics">
				<div className="row">
					<span className="faint">
						This optimization searches over the plant set in the Simulate tab: m = {fmt(w.mass)} kg, c = {fmt(w.damping)} N
						·s/m, k = {fmt(w.springConstant)} N/m. Every evaluation integrates that plant, so results stay comparable with
						your manual run.
					</span>
				</div>
			</Panel>

			<Panel title="Step 1 · Search space">
					<div className="grid grid--2">
						<div className="gain-card" role="group" aria-label="Kp position gain search range">
							<span className="gain-card__label">Kp <span className="faint">position gain</span></span>
							<span className="gain-card__desc">Search range for the proportional gain.</span>
							<div className="grid grid--auto">
								<NumberField label="Min" value={w.gainLower[0]} step={1} min={-100} onChange={(v) => w.update({ gainLower: [v, w.gainLower[1]] })} />
								<NumberField label="Max" value={w.gainUpper[0]} step={1} min={-100} onChange={(v) => w.update({ gainUpper: [v, w.gainUpper[1]] })} />
							</div>
						</div>
						<div className="gain-card" role="group" aria-label="Kd velocity gain search range">
							<span className="gain-card__label">Kd <span className="faint">velocity gain</span></span>
							<span className="gain-card__desc">Search range for the derivative gain.</span>
							<div className="grid grid--auto">
								<NumberField label="Min" value={w.gainLower[1]} step={1} min={-100} onChange={(v) => w.update({ gainLower: [w.gainLower[0], v] })} />
								<NumberField label="Max" value={w.gainUpper[1]} step={1} min={-100} onChange={(v) => w.update({ gainUpper: [w.gainUpper[0], v] })} />
							</div>
						</div>
					</div>
			</Panel>

			<Panel title="Step 2 · Method">
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
							<div className="grid grid--auto mt-3">
								<NumberField label="Grid resolution (per dim.)" hint="Samples per gain dimension. Total evaluations = resolution². 41 → 1,681 simulations, 101 → ~10,000."
									value={w.gridResolution} min={2} max={101} step={1} onChange={(v) => w.update({ gridResolution: Math.round(v) })} />
								<CheckField label="Return cost surface (2-D grid)" checked={w.includeCostSurface}
									onChange={(v) => w.update({ includeCostSurface: v })} hint="When on, the response includes the full objective heatmap over the grid, plus per-cell IAE and control energy for the interactive tooltip." />
							</div>
							<div className="mt-2"><Learn title="About grid search"><p>{LEARNING.grid}</p></Learn></div>
						</>
					) : (
						<>
							<div className="mt-3">
								<Disclosure
									label="Advanced parameters"
									summary={`pop ${w.populationSize} · gen ${w.maxIterations} · F ${fmt(w.differentialWeight, 2)} · CR ${fmt(w.crossoverRate, 2)} · seed ${w.seed}`}
									count={5}
								>
									<div className="grid grid--auto">
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
								</Disclosure>
							</div>
							<div className="mt-2"><Learn title="About differential evolution"><p>{LEARNING.de}</p></Learn></div>
						</>
					)}
			</Panel>

			<Panel title="Step 3 · Objective">
					<p className="faint reset-top">{LEARNING.formula}</p>
					<div className="preset-row" role="radiogroup" aria-label="Objective weight preset">
						{PRESETS.map((p) => (
							<button key={p.key} role="radio" aria-checked={activePreset === p.key} className={`preset-chip ${activePreset === p.key ? 'active' : ''}`} onClick={() => handlePreset(p.key)}>
								{p.label}
							</button>
						))}
					</div>
					<ObjectiveBars weights={weights} onChange={handleWeight} />
					<p className="faint mt-3" style={{ marginBottom: 0 }}>The steady-state term is normalized by |r₁| and the other four terms by fixed scales: IAE by |r₁|·T, control energy by (k·|r₁|)²·T, settling time by T, overshoot by 100. So J does not depend on any manual baseline gain.</p>
					<div className="row mt-3">
						<CheckField
							label="Include steady-state error term"
							checked={w.steadyStateErrorEnabled}
							disabled={!w.tracking}
							onChange={(v) => w.update({ steadyStateErrorEnabled: v })}
							hint="Adds wᵥ·(e_ss / |r₁|) to J, where e_ss is the analytic steady-state error (k·r₁/(k+Kp) for PD, 0 with feedforward). Encodes the residual tracking offset directly."
						/>
						{w.steadyStateErrorEnabled && (
							<NumberField label="Steady-state error weight" value={w.steadyStateErrorWeight} min={0} step={0.1} onChange={(v) => w.update({ steadyStateErrorWeight: v })} />
						)}
					</div>
			</Panel>

			<Panel title="Step 4 · Constraints (optional)">
					<CheckField label="Enforce constraints during search" checked={w.constraintsEnabled}
						onChange={(v) => w.update({ constraintsEnabled: v })} hint={LEARNING.constraints} />
					{w.constraintsEnabled && (
						<div className="grid grid--auto mt-3">
							<NumberField label="Peak force" unit="force" hint="Ceiling on the peak actuator command. Candidates exceeding it are infeasible."
								value={Number.isFinite(w.maxControl) ? w.maxControl : 0} min={0} step={1} onChange={(v) => w.update({ maxControl: v })} />
							<NumberField label="Max overshoot" unit="%" hint="Ceiling on overshoot percentage."
								value={Number.isFinite(w.maxOvershoot) ? w.maxOvershoot : 0} min={0} step={1} onChange={(v) => w.update({ maxOvershoot: v })} />
							<NumberField label="Max settling time" unit="s" hint="Latest time the response may settle (within the settling band)."
								value={Number.isFinite(w.maxSettlingTime) ? w.maxSettlingTime : 0} min={0} step={0.5} onChange={(v) => w.update({ maxSettlingTime: v })} />
							<NumberField label="Max steady-state error" unit="m" hint="Ceiling on the analytic steady-state tracking error e_ss. Candidates with a larger residual offset are infeasible."
								value={Number.isFinite(w.maxSteadyStateError) ? w.maxSteadyStateError : 0} min={0} step={0.01} onChange={(v) => w.update({ maxSteadyStateError: v })} />
							<NumberField label="Max control energy" unit="N²·s" hint="Ceiling on U = ∫u² dt. Candidates that demand too much cumulative actuator work are infeasible."
								value={Number.isFinite(w.maxControlEnergy) ? w.maxControlEnergy : 0} min={0} step={1} onChange={(v) => w.update({ maxControlEnergy: v })} />
						</div>
					)}
			</Panel>

			{w.loading && <div className="callout callout--info">{w.loading}</div>}

			<div className="btn-row btn-row--end">
				<button className="btn primary btn--block" onClick={() => void w.runOptimization()} disabled={w.loading !== null}>
					<Rocket size={14} strokeWidth={2} /> {w.loading ?? (w.error ? 'Retry optimization' : 'Run optimization')}
				</button>
			</div>

			{w.optimizerResult ? (
				<div className="stack">
					{w.staleContext && (
						<Callout tone="warn">
							<span>
								This result was optimized against an earlier model
								{w.staleContext.length === 1 ? `: ${w.staleContext[0]}.` : `. Changed: ${w.staleContext.join(', ')}.`}
							</span>
							<button className="btn btn--sm" onClick={() => void w.runOptimization()}>Re-run optimization</button>
						</Callout>
					)}

					<div className="result-hero">
						<span className="result-hero__stat">
							<span className="result-hero__label">Objective J</span>
							<span className="result-hero__value">{w.optimizerResult.bestCost === null ? 'Not feasible' : fmt(w.optimizerResult.bestCost, 4)}</span>
						</span>
						<span className="result-hero__stat">
							<span className="result-hero__label">{result?.feasible ? 'Best gain K' : 'Closest gain K'}</span>
							<span className="result-hero__value">[{heroGainLabel}]</span>
						</span>
						<span className="result-hero__meta">
							<Badge tone={result?.feasible ? 'good' : 'bad'}>{result?.feasible ? 'feasible' : 'infeasible'}</Badge>
							<Badge tone="neutral">{runType}</Badge>
							<span className="mono">{fmt(w.optimizerResult.evaluations, 0)} evaluations · {fmt(w.optimizerResult.elapsedMillis, 0)} ms</span>
						</span>
					</div>

					<Panel title="Optimization">
						<KeyValue
							rows={[
								{
									label: 'Method',
									value: runType === 'GRID_SEARCH' ? `Grid search · ${runGridResolution}×${runGridResolution} cells` : `Differential evolution · pop ${runPopulation} × gen ${runIterations}`,
								},
								{
									label: 'Search space',
									mono: true,
									value: <>Kp: {fmt(runLower[0], 1)} → {fmt(runUpper[0], 1)} · Kd: {fmt(runLower[1], 1)} → {fmt(runUpper[1], 1)}</>,
								},
								...(runType === 'GRID_SEARCH'
									? [{
										label: 'Step',
										mono: true,
										value: <>Kp {fmt((runUpper[0] - runLower[0]) / (runGridResolution - 1), 3)} · Kd {fmt((runUpper[1] - runLower[1]) / (runGridResolution - 1), 3)}</>,
									}]
									: []),
								{
									label: 'Control law',
									mono: true,
									value: <>u = −K(x − r){runFeedforward ? ' + k·r₁' : ''} · {runSaturation > 0 ? `u clamped to ±${fmt(runSaturation, 2)} N` : 'u unlimited'}</>,
								},
							]}
						/>
					</Panel>

					{infeasible && result?.infeasibleReason && (
						<div className="callout callout--error">{result.infeasibleReason}</div>
					)}

					{nearMiss && nearMiss.violatedConstraints.length > 0 && (
						<Panel
							title="Closest candidate · and what stopped it"
							right={<Learn title="Why the search failed"><p>Every candidate costs +∞ once it breaks a limit, so the search ranks them by the worst relative miss instead. The candidate below came nearest, and these are the limits it broke. Relax one of them, or widen the gain range, and rerun.</p></Learn>}
						>
							<p className="faint reset-top">
								Nearest candidate K = [{nearMiss.gain.map((g) => fmtGain(g)).join(', ')}]
								{nearMiss.metrics && (
									<>
										{' '}· IAE {fmt(nearMiss.metrics.iae, 3)} · energy{' '}
										{fmt(nearMiss.metrics.controlEffort, 1)}
									</>
								)}
								. This gain was rejected, so it is not applied to the plant.
							</p>
							<DataTable columns={[{ header: 'Constraint missed' }, { header: 'Achieved' }, { header: 'Limit' }, { header: 'Over by' }]}>
								<tbody>
									{nearMiss.violatedConstraints.map((c) => (
										<tr key={c.id} className="row-best">
											<td>{c.name}</td>
											<td className="mono">{c.achieved === null ? 'Not reached' : fmt(c.achieved, 3)}</td>
											<td className="mono">{fmt(c.limit, 3)}</td>
											<td className="mono">
												{c.achieved === null || c.limit <= 0
													? '—'
													: `${fmt(((c.achieved - c.limit) / c.limit) * 100, 0)}%`}
											</td>
										</tr>
									))}
								</tbody>
							</DataTable>
						</Panel>
					)}

					{boundaryHit && (
						<div className="callout callout--info">
							{boundaryHits.length > 0 ? (
								<>
									Boundary hit: {boundaryHits.join(' and ')} sit on the edge of the search box. The objective keeps
									pushing these gains further, so the true optimum may lie outside the box. Expand the bound and
									rerun to see if J improves.
								</>
							) : (
								<>
									The best candidate sits on the edge of the search box. The objective keeps pushing these gains
									further, so the true optimum may lie outside the box. Expand the bound and rerun to see if J
									improves.
								</>
							)}
						</div>
					)}

					<Panel title="Optimization Result" className={busy ? 'chart-busy' : ''} right={<Learn title="Read the results"><p>{LEARNING.convergence}</p></Learn>}>
						<div className="grid grid--3">
							<MetricCard
								hint={result?.feasible
									? 'Best gain vector found, applied as K = (Kp, Kd) for u = −K(x − r).'
									: 'No gain inside the search box satisfied every enforced limit, so there is no best gain. The closest candidate is reported alongside the limits it missed.'}
								label="Best gain"
								value={result?.feasible
									? `[${bestGainLabel}]`
									: nearMiss
										? `No feasible gain · closest [${nearMiss.gain.map((g) => fmtGain(g)).join(', ')}]`
										: 'No feasible gain in range'}/>
							<MetricCard hint="Value of the weighted objective J at the best gain. Lower is better." label="Best cost (J)" value={w.optimizerResult.bestCost === null ? 'Not feasible' : fmt(w.optimizerResult.bestCost, 4)} />
							<MetricCard hint="Simulations run during the search. Grid: resolution². DE: population × generations." label="Evaluations" value={fmt(w.optimizerResult.evaluations, 0)} sub={`${fmt(w.optimizerResult.elapsedMillis, 0)} ms`} />
							<MetricCard hint="Whether any stable, valid gain was found inside the box." label="Feasible" value={w.optimizerResult.feasible ? 'Yes' : 'No'} tone={w.optimizerResult.feasible ? 'good' : 'bad'} />
							<MetricCard hint="Grid search always converges (finite box). DE converged when improvement stalled before max iterations." label="Converged" value={w.optimizerResult.converged ? 'Yes' : 'No'} tone={w.optimizerResult.converged ? 'good' : 'neutral'} />
							<MetricCard hint="Random seed used (DE only). Re-run with the same seed reproduces these exact results." label="Seed" value={w.optimizerResult.seed === null ? 'Not used' : fmt(w.optimizerResult.seed, 0)} />
						</div>

						{w.optimizerResult.feasible && (w.optimizerResult.bestGain?.length ?? 0) >= 1 && (
							<div className="btn-row mt-3">
								<button className="btn" onClick={w.applyOptimizedGain}><Check size={14} strokeWidth={2} /> Apply optimized gain</button>
							</div>
						)}

						{w.optimizerType === 'DIFFERENTIAL_EVOLUTION' && (
							<p className="faint reset-bottom">
								Seeded search explores the box by sampling: this K is the best of that sample, not the box-wide optimum. Run grid search at the same bounds and compare its best J before calling either result optimal.
							</p>
						)}
					</Panel>

					{breakdown && (
					<Panel title="Why this objective value?" className={busy ? 'chart-busy' : ''} right={<Learn title="Read the breakdown"><p>Each row shows the metric that feeds the objective: its raw value, the fixed normalization scale derived from the problem, the normalized ratio (1.0 = metric equals that scale), the weight, the weighted contribution and its share of J.</p></Learn>}>
						<ObjectiveBreakdownTable
							breakdown={breakdown}
							notSettled={w.optimizerResult?.metrics?.settlingTime === null}
							baselineNote="terms are raw (unnormalized) only when fixed scales are unavailable"
						/>
					</Panel>
					)}

					<Panel title="Settling time across bands" className={busy ? 'chart-busy' : ''}>
						<p className="faint reset-top">
							The reported gain measured against each tolerance band. A "Not reached" row means the response never
							stays inside that band, which is what a residual steady-state offset looks like.
						</p>
						<SettlingBandTable
							metrics={reportedMetrics}
							empty={infeasible ? 'No nearest candidate to measure bands on.' : 'No settling bands to report for this result.'}
						/>
					</Panel>

					{constraintReport && hasActiveConstraints && (
						<Panel title="Constraint report" className={busy ? 'chart-busy' : ''}>
							<DataTable columns={[{ header: 'Constraint' }, { header: 'Achieved' }, { header: 'Limit' }, { header: 'Status' }]}>
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
							</DataTable>
						</Panel>
					)}

					<Panel title="Convergence" className={busy ? 'chart-busy' : ''}>
						<ConvergenceChart points={w.optimizerResult.convergence} optimizerType={w.optimizerResult.optimizerType} />
					</Panel>

					{runType === 'GRID_SEARCH' && hasSurface && (
						<Panel title="Interactive cost surface · Kp × Kd" className={busy ? 'chart-busy' : ''}
							right={<Learn title="Read the heatmap"><p>{LEARNING.grid}</p></Learn>}>
							<CostSurfaceHeatmap
								surface={surf as (number | null)[][]}
								axisLabels={['Kp', 'Kd']}
								metricSurfaces={metricSurfaces ?? undefined}
								optimum={w.optimizerResult.feasible ? w.optimizerResult.bestGain : undefined}
								manual={(w.useOptimized ? w.optimizedGain : w.manualGain) ?? undefined}
								gainBounds={{ lower: [...runLower], upper: [...runUpper] }}
								resolution={[runGridResolution, runGridResolution]}
							/>
						</Panel>
					)}
				</div>
			) : (
				<Empty>Configure the optimizer and run it to see the objective surface, convergence curve, and best gain.</Empty>
			)}
		</div>
	)
}

export default OptimizeTab