import { useCallback, useEffect, useRef, useState } from 'react'
import { GitCompareArrows } from 'lucide-react'

import { Badge, BusyNote, Callout, ChartCell, ChartPanel, DataTable, Delta, deltaTone, Empty, GainTag, Learn, METRIC_GROUPS, MetricCard, ObjectiveBreakdownTable, Panel, relativeDelta, RunButton, StaleCallout } from '../components/common'
import type { MetricKey } from '../components/common'
import { OverlayChart } from '../components/charts'
import { chartColors } from '../components/charts/palette'
import type { ChartColor } from '../components/charts/palette'
import { fmt } from '../components/common'
import { useWorkspace } from '../state/WorkspaceContext'
import type { MetricsResponse, SimulationResponse } from '../api/types'

const METRIC_UNIT: Partial<Record<MetricKey, string>> = Object.fromEntries(
	METRIC_GROUPS.flatMap((g) => g.keys.map((k) => [k.key, k.unit] as const)).filter(([, u]) => u !== undefined),
)

function metricValue(m: MetricsResponse | null, key: MetricKey): number | null {
	if (!m) return null
	if (key === 'settling') return m.settlingTime
	return m[key] as number
}

function displayMetric(m: MetricsResponse | null, key: MetricKey): string {
	const v = metricValue(m, key)
	if (v === null || !Number.isFinite(v)) return key === 'settling' ? 'Not reached' : 'n/a'
	const digits = key === 'iae' || key === 'ise' || key === 'controlEffort' ? 4 : 3
	return `${fmt(v, digits)}${METRIC_UNIT[key] ?? ''}`
}

function allMetricKeys() {
	return METRIC_GROUPS.flatMap((g) => g.keys)
}

/** Manual vs optimized, drawn the same way on every Compare plot. */
const OVERLAY_SERIES: { key: string; name: string; color: ChartColor; dashed?: boolean }[] = [
	{ key: 'manual', name: 'Manual K', color: 'blue' },
	{ key: 'optimized', name: 'Optimized K', color: 'amber', dashed: true },
]

function tradeoffSentence(manual: MetricsResponse, optimized: MetricsResponse): string | null {
	// only metrics that actually moved are counted, so "3 of 5" cannot be
	// inflated by rows whose change is indistinguishable from zero
	const deltas = allMetricKeys().flatMap((k) => {
		const m = metricValue(manual, k.key)
		const o = metricValue(optimized, k.key)
		const rel = m === null || o === null ? null : relativeDelta(m, o)
		return rel === null || rel === 0 ? [] : [{ k, rel }]
	})
	if (deltas.length === 0) return null
	const improved = deltas.filter((d) => d.rel < 0).sort((a, b) => a.rel - b.rel)
	const degraded = deltas.filter((d) => d.rel > 0).sort((a, b) => b.rel - a.rel)
	if (improved.length > 0 && degraded.length > 0) {
		const best = improved[0]
		const worst = degraded[0]
		return `The optimizer trimmed ${best.k.name.toLowerCase()} by ${fmt(Math.abs(best.rel), 1)}% but accepted a ${fmt(Math.abs(worst.rel), 1)}% rise in ${worst.k.name.toLowerCase()}. Under the current weights it accepted that trade-off.`
	}
	if (improved.length > 0) return `The optimizer improved ${improved.length} of ${deltas.length} metrics that moved; the largest win was ${improved[0].k.name.toLowerCase()} at ${fmt(Math.abs(improved[0].rel), 1)}%.`
	if (degraded.length > 0) return `The optimizer did not beat your manual gain on any metric; the largest regression was ${degraded[0].k.name.toLowerCase()} at ${fmt(degraded[0].rel, 1)}%.`
	return null
}

export function CompareTab() {
	const w = useWorkspace()
	const opt = w.optimizerResult
	const [manualSim, setManualSim] = useState<SimulationResponse | null>(null)
	const [optSim, setOptSim] = useState<SimulationResponse | null>(null)
	const [ran, setRan] = useState(false)
	const [pending, setPending] = useState(false)

	const ready = w.optimizedGain !== null
	const inputKey = JSON.stringify({
		mass: w.mass,
		damping: w.damping,
		springConstant: w.springConstant,
		tracking: w.tracking,
		feedforward: w.feedforward,
		manualGain: w.manualGain.join(','),
		optimizedGain: w.optimizedGain ? w.optimizedGain.join(',') : null,
		optimizerRunId: w.optimizerRunId,
		initialState: w.initialState.join(','),
		reference: w.reference.join(','),
		endTime: w.endTime,
		timeStep: w.timeStep,
		settlingBand: w.settlingBand,
		saturation: w.saturation,
	})
	const ranKeyRef = useRef<string | null>(null)
	// Mirrors `pending` for the auto-run effect, which must not add a dep on the
	// state itself or it would re-fire on every tick of the busy flag.
	const inFlightRef = useRef(false)

	const manualMetrics = manualSim?.metrics ?? null
	// Falling back to the optimizer's own metrics is only honest while the
	// model still matches the run: once it drifts, those numbers describe a
	// different plant than the manual column beside them.
	const optMetrics = optSim?.metrics ?? (!w.staleContext ? opt?.metrics ?? null : null)

	const runBoth = useCallback(async () => {
		setPending(true)
		inFlightRef.current = true
		w.update({ error: null })
		try {
			const [m, o] = await Promise.all([
				w.simulateGain(w.manualGain, 'compare:manual'),
				w.optimizedGain ? w.simulateGain(w.optimizedGain, 'compare:optimized') : Promise.resolve(null),
			])
			setManualSim(m)
			setOptSim(o)
			setRan(true)
		} catch (e) {
			if (e instanceof Error && e.name === 'AbortError') return
			// Clear the pair so a failure cannot leave the previous comparison on
			// screen under text claiming it matches the current model.
			setManualSim(null)
			setOptSim(null)
			setRan(false)
			w.update({ error: e instanceof Error ? e.message : String(e) })
		} finally {
			inFlightRef.current = false
			setPending(false)
		}
	}, [w.manualGain, w.optimizedGain, w.simulateGain, w.update])

	const runRef = useRef(runBoth)
	runRef.current = runBoth

	useEffect(() => {
		if (!ready) return
		if (inFlightRef.current) return
		if (ranKeyRef.current === inputKey) return
		// Claim the key only when the run actually fires, and re-evaluate when
		// `pending` flips back to false, so an edit that lands while a run is in
		// flight is picked up as soon as that run finishes instead of being
		// dropped. Claiming up front opened exactly that gap: the key was marked
		// done before the debounce elapsed, so a changed input re-entering this
		// effect saw an already-claimed key and never rescheduled.
		const id = setTimeout(() => {
			ranKeyRef.current = inputKey
			void runRef.current()
		}, 400)
		return () => clearTimeout(id)
	}, [ready, inputKey, pending])

	const breakdown = opt?.objectiveBreakdown

	return (
		<div className="stack">
			<Learn title="How the comparison works">
				<p>
					The table lines up the manual run and the optimized run over the same system, horizon, time step and settling band.
					The percentage shows how the optimized result moved relative to the manual one. <b>Lower tracking numbers are better</b>,
					but a gain that cuts IAE in half can quadruple peak actuator force. Watch the trade-offs, not just one column.
				</p>
			</Learn>

			<Panel title="Compare both gains">
				<div className="row">
					<span className="faint">Both runs integrate the same plant from Simulate tab: m = {fmt(w.mass)} kg, c = {fmt(w.damping)} N·s/m, k = {fmt(w.springConstant)} N/m.</span>
				</div>
				<div className="row row--between">
					<span className="faint"><GainTag gain={w.manualGain} label="Manual K" />{w.optimizedGain ? <>{'  ·  '}<GainTag gain={w.optimizedGain} label="Optimized K" /></> : ''}</span>
					<RunButton icon={<GitCompareArrows size={14} strokeWidth={2} />} disabled={!ready} pending={pending}
						pendingLabel="Comparing…" label={!ready ? 'Run an optimization first' : ran ? 'Re-run comparison' : 'Compare gains'}
						onClick={() => void runBoth()} />
				</div>
				{pending && (
					<div className="row mt-3">
						<BusyNote large>Running both controllers…</BusyNote>
					</div>
				)}
				{!ready && (
					<div className="mt-3">
						<Callout tone="warn" >Run an optimization in the Optimize tab to unlock the comparison.</Callout>
					</div>
				)}
				{ready && !pending && ran && (w.staleContext ? (
					<div className="mt-3">
						<StaleCallout context={w.staleContext} onAction={() => { window.location.hash = '#/lab/optimize' }}>
							The comparison below still re-simulates both gains on the current model, but the breakdown
							and "why" describe the run it was launched with.
						</StaleCallout>
					</div>
				) : (
					<div className="row mt-3">
						<span className="faint">Both columns were re-simulated on the current plant. Edit any input and they refresh on their own.</span>
					</div>
				))}
			</Panel>

			<div className="grid grid--split">
				<div className="stack">
					{(manualSim || optSim) && (
						<ChartPanel title="Per-metric comparison" busy={pending}>
							<DataTable columns={[{ header: 'Metric' }, { header: 'Manual' }, { header: 'Optimized' }, { header: 'Δ' }]}>
								<tbody>
										{METRIC_GROUPS.map((g) => (
											<GroupRow key={g.label} group={g} manual={manualMetrics} optimized={optMetrics} />
										))}
									</tbody>
							</DataTable>
						</ChartPanel>
					)}

					{!manualSim && !optSim && (
						<Empty>The comparison starts on its own as soon as an optimization produces a gain.</Empty>
					)}

					<ChartPanel title="Trajectory overlay" busy={pending}>
						{(manualSim || optSim)
							? <ChartGrid manual={manualSim} optimized={optSim} />
							: <Empty>Both trajectories appear here once the comparison runs.</Empty>}
					</ChartPanel>
				</div>

				<div className="stack">
					{opt && breakdown && (
						<Panel title="Objective breakdown at the optimized gain">
							<ObjectiveBreakdownTable breakdown={breakdown} notSettled={opt.metrics?.settlingTime === null} />
						</Panel>
					)}

					<Panel title="Why this gain?">
						<div className="stack">
							{opt ? (
								<>
									<p className="faint reset-top">
										The optimizer minimized J = wₑ·IAE + wᵤ·U + wₛ·Tₛ + wₒ·O{w.steadyStateErrorEnabled ? ' + wᵥ·e_ss' : ''}
										{(manualMetrics && optMetrics) ? <> This is exactly what it bought over your manual K.</> : <> The measured deltas appear as soon as the comparison finishes.</>}
									</p>
									{manualMetrics && optMetrics && tradeoffSentence(manualMetrics, optMetrics) && (
										<p className="faint" style={{ marginTop: -4 }}>{tradeoffSentence(manualMetrics, optMetrics)}</p>
									)}
									{manualMetrics && optMetrics ? (
										<div className="grid grid--2">
											{METRIC_GROUPS.flatMap((g) => g.keys).map((k) => {
												const manual = metricValue(manualMetrics, k.key)
												const optimized = metricValue(optMetrics, k.key)
												const rel = manual === null || optimized === null ? null : relativeDelta(manual, optimized)
												if (rel === null) return null
												return (
													<MetricCard
																key={k.key}
																label={k.name}
																sub={`manual ${displayMetric(manualMetrics, k.key)} → opt ${displayMetric(optMetrics, k.key)}`}
																value={<Delta value={rel} pct tone={deltaTone(rel)} />}
																tone={deltaTone(rel)}/>
												)
											})}
										</div>
									) : null}
								</>
							) : (
								<Empty>Run an optimization to get the "why": weights, breakdown, and per-metric deltas.</Empty>
							)}
						</div>
					</Panel>

					{opt && (
						<div className="row">
							<Badge tone={opt.feasible ? 'good' : 'bad'}>{opt.feasible ? 'feasible' : 'infeasible'}</Badge>
							<Badge tone="neutral">{opt.optimizerType}</Badge>
							<span className="faint mono">{fmt(opt.evaluations, 0)} evaluations · {fmt(opt.elapsedMillis, 0)} ms</span>
						</div>
					)}
				</div>
			</div>

			{w.loading && (
				<div className="callout callout--info">
					<span className="spinner" />
					{w.loading}
				</div>
			)}
		</div>
	)
}

function GroupRow({ group, manual, optimized }: {
	group: (typeof METRIC_GROUPS)[number]
	manual: MetricsResponse | null
	optimized: MetricsResponse | null
}) {
	return (
		<>
			<tr>
				<td colSpan={4} style={{ textAlign: 'left', fontWeight: 700, color: 'var(--text-2)', paddingTop: "var(--space-3)" }}>{group.label}</td>
			</tr>
			{group.keys.map((k) => {
				const m = metricValue(manual, k.key)
				const o = metricValue(optimized, k.key)
				const rel = m === null || o === null ? null : relativeDelta(m, o)
				return (
					<tr key={k.name}>
						<td>{k.name}</td>
						<td className="mono">{displayMetric(manual, k.key)}</td>
						<td className="mono">{displayMetric(optimized, k.key)}</td>
						<td>
							{rel === null ? <span className="faint">n/a</span> : (
								<Delta value={rel} pct tone={deltaTone(rel)} />
							)}
						</td>
					</tr>
				)
			})}
		</>
	)
}

function ChartGrid({ manual, optimized }: { manual: SimulationResponse | null; optimized: SimulationResponse | null }) {
	const sources = [
		{ label: 'Manual', data: manual?.trajectory },
		{ label: 'Optimized', data: optimized?.trajectory },
	].filter((s) => s?.data) as { label: 'Manual' | 'Optimized'; data: { time: number; state: number[]; control?: number[] }[] }[]

	const manualData = sources.find((s) => s.label === 'Manual')?.data
	const optData = sources.find((s) => s.label === 'Optimized')?.data
	const base = manualData ?? optData ?? []
	const count = base.length

	const dims = base[0]?.state.length ?? 1
	const rows = []
	for (let i = 0; i < dims; i++) {
		const data = Array.from({ length: count }, (_, k) => ({
			time: base[k].time,
			manual: manualData?.[k]?.state?.[i],
			optimized: optData?.[k]?.state?.[i],
		}))
		const label = dims >= 2 ? (i === 0 ? 'Position' : 'Velocity') : 'State'
		const unit = dims >= 2 ? (i === 0 ? ' (m)' : ' (m/s)') : ''
		rows.push(
			<ChartCell key={label} title={`${label} over time${unit}`}>
				<OverlayChart data={data} series={OVERLAY_SERIES} />
			</ChartCell>,
		)
	}

	const controlData = Array.from({ length: count }, (_, k) => ({
		time: base[k].time,
		manual: manualData?.[k]?.control?.[0],
		optimized: optData?.[k]?.control?.[0],
	}))
	rows.push(
		<ChartCell key="Control" title="Control over time (N)">
			<OverlayChart data={controlData} series={OVERLAY_SERIES} />
		</ChartCell>,
	)

	const c = chartColors()
	return (
		<>
			<div className="grid grid--2">{rows}</div>
			<div className="heatmap-legend-row mt-2" role="group" aria-label="Overlay series">
				{OVERLAY_SERIES.map((s) => (
					<span key={s.key}>
						<span className="swatch" style={s.dashed ? { background: 'transparent', borderTop: `2.5px dashed ${c[s.color]}` } : { background: c[s.color] }} />
						{s.name}
					</span>
				))}
			</div>
		</>
	)
}

export default CompareTab