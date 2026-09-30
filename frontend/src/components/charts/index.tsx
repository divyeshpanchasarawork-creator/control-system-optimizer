import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import {
	CartesianGrid,
	Line,
	LineChart,
	ReferenceArea,
	ReferenceLine,
	ResponsiveContainer,
	Scatter,
	ScatterChart,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts'

import type { MetricSurfaces, SimulationResponse } from '../../api/types'
import { Empty, fmt } from '../common'
import type { ChartColor } from './palette'
import { chartColors, hatchPattern } from './palette'

const fmtTick = (v: unknown) => (typeof v === 'number' ? String(Number(v.toFixed(2))) : String(v))

/** Recharts renders `null` as a gap; a masked 0 would draw a dive to zero. */
const fmtValue = (value: unknown, digits: number) => (typeof value === 'number' ? value.toFixed(digits) : '--')
const tooltipValue = (value: unknown, name: unknown, digits = 3) => [fmtValue(value, digits), String(name)] as [string, string]

/**
 * Two or more series over a shared time axis. Compare uses this three times
 * (each state dimension, plus control) and previously inlined recharts for it.
 */
export function OverlayChart({ data, series, height = 180 }: {
	data: Record<string, number | null | undefined>[]
	series: { key: string; name: string; color: ChartColor; dashed?: boolean }[]
	height?: number
}) {
	const c = chartColors()
	return (
		<ResponsiveContainer width="100%" height={height}>
			<LineChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: 0 }} title={series.map((s) => s.name).join(' vs ')} role="img" tabIndex={-1}>
				<XAxis dataKey="time" type="number" tick={{ fontSize: 11 }} stroke={c.axis} />
				<YAxis tick={{ fontSize: 11 }} stroke={c.axis} width={48} />
				{series.map((s) => (
					<Line
						key={s.key}
						name={s.name}
						dataKey={s.key}
						stroke={c[s.color]}
						dot={false}
						strokeWidth={2.2}
						strokeDasharray={s.dashed ? '6 4' : undefined}
						isAnimationActive={false}
						aria-label={s.name}
					/>
				))}
			</LineChart>
		</ResponsiveContainer>
	)
}

export function TrajectoryChart({ response, kind }: { response: SimulationResponse; kind: 'position' | 'velocity' | 'control' }) {
	const data = response.trajectory || []
	const idx = kind === 'position' ? 0 : kind === 'velocity' ? 1 : 0
	const yLabel = kind === 'position' ? 'Position (m)' : kind === 'velocity' ? 'Velocity (m/s)' : 'u (N)'
	const c = chartColors()
	const color = kind === 'position' ? c.blue : kind === 'velocity' ? c.green : c.amber
	const signalName = kind === 'position' ? 'Position' : kind === 'velocity' ? 'Velocity' : 'Control'

	const signalKey = kind === 'control'
		? (p: { time: number; control?: number[] }) => p.control?.[0] ?? null
		: (p: { time: number; state: number[] }) => p.state[idx] ?? null

	return (
<ResponsiveContainer width="100%" height={200}>
			<LineChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 0 }} title={`${signalName} over time`} role="img" tabIndex={-1}>
				<CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
				<XAxis dataKey="time" type="number" tickFormatter={fmtTick} tick={{ fontSize: 11 }} stroke={c.axis} />
				<YAxis tick={{ fontSize: 11 }} stroke={c.axis} width={52} label={{ value: yLabel, angle: -90, position: 'insideLeft', fontSize: 11, fill: c.axis, dx: 8 }} />
				<Tooltip formatter={(value, name) => tooltipValue(value, name)} />
				{kind !== 'control' && data[0]?.reference?.[idx] !== undefined && (
					<Line
						name="Reference"
						dataKey={(p: { time: number; reference?: number[] }) => p.reference?.[idx]}
						stroke={color}
						strokeDasharray="6 4"
						strokeWidth={1.4}
						dot={false}
						opacity={0.85}
						isAnimationActive={false}
					/>
				)}
				<Line name={signalName} dataKey={signalKey} stroke={color} dot={false} strokeWidth={2.2} strokeLinecap="round" isAnimationActive={false} />
			</LineChart>
		</ResponsiveContainer>
	)
}

export function PositionChart({ response, band, xSS, focused }: {
	response: SimulationResponse
	band: number
	xSS: number | null
	focused: boolean
}) {
	const data = response.trajectory || []
	const c = chartColors()
	const color = c.blue
	const r1 = data[0]?.reference?.[0]
	const refMag = Math.abs(r1 ?? 0)
	const bandAbs = (band / 100) * refMag
	const showBand = band > 0 && refMag > 0
	const bandLow = r1 === undefined ? 0 : r1 - bandAbs
	const bandHigh = r1 === undefined ? 0 : r1 + bandAbs
	const x0 = data[0]?.state?.[0]
	const margin = r1 === undefined ? 0 : 0.05 * Math.abs(r1)
	const envelope = [r1, x0, xSS].filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
	const yDomain: [number, number] | undefined = focused && envelope.length > 0
		? [Math.min(...envelope) - bandAbs - margin, Math.max(...envelope) + bandAbs + margin]
		: undefined

	return (
		<ResponsiveContainer width="100%" height={200}>
			<LineChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 0 }} title={`Position x₁(t) over time${showBand ? `; settling band ±${fmt(bandAbs, 2)} m around the reference r₁ = ${fmt(r1 ?? 0, 2)} m` : ''}`} role="img" tabIndex={-1}>
				<CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
				<XAxis dataKey="time" type="number" tickFormatter={fmtTick} tick={{ fontSize: 11 }} stroke={c.axis} />
				<YAxis tick={{ fontSize: 11 }} stroke={c.axis} width={52} domain={yDomain} label={{ value: 'Position (m)', angle: -90, position: 'insideLeft', fontSize: 11, fill: c.axis, dx: 8 }} />
				<Tooltip formatter={(value, name) => tooltipValue(value, name)} />
				{data[0]?.reference?.[0] !== undefined && (
					<Line
						name="Reference"
						dataKey={(p: { time: number; reference?: number[] }) => p.reference?.[0]}
						stroke={color}
						strokeDasharray="6 4"
						strokeWidth={1.4}
						dot={false}
						opacity={0.85}
						isAnimationActive={false}
					/>
				)}
				{xSS !== null && xSS !== r1 && (
					<ReferenceLine y={xSS} stroke={c.violet} strokeDasharray="2 6" ifOverflow="extendDomain" />
				)}
				{showBand && (
					<>
						<ReferenceArea y1={bandLow} y2={bandHigh} fill={c.blue} fillOpacity={0.06} stroke={c.blue} strokeOpacity={0.4} strokeDasharray="4 4" ifOverflow="extendDomain" />
						<ReferenceLine y={bandLow} stroke={c.blue} strokeDasharray="4 4" strokeOpacity={0.7} ifOverflow="extendDomain" />
						<ReferenceLine y={bandHigh} stroke={c.blue} strokeDasharray="4 4" strokeOpacity={0.7} ifOverflow="extendDomain" />
					</>
				)}
				<Line name="Position" dataKey={(p: { state: number[] }) => p.state?.[0] ?? null} stroke={color} dot={false} strokeWidth={2.2} strokeLinecap="round" isAnimationActive={false} />
			</LineChart>
		</ResponsiveContainer>
	)
}

export function ErrorChart({ response, band }: { response: SimulationResponse; band: number }) {
	const data = response.trajectory || []
	const refMag = Math.abs(data[0]?.reference?.[0] ?? 0)
	const bandAbs = (band / 100) * refMag
	const showBand = bandAbs > 0 && refMag > 0
	const c = chartColors()
	const color = c.red

	return (
		<ResponsiveContainer width="100%" height={200}>
			<LineChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 0 }} title={`Position error e(t) = r₁ − x₁ over time${showBand ? `; settling band ±${fmt(bandAbs, 2)} m around e = 0` : ''}`} role="img" tabIndex={-1}>
				<CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
				<XAxis dataKey="time" type="number" tickFormatter={fmtTick} tick={{ fontSize: 11 }} stroke={c.axis} />
				<YAxis tick={{ fontSize: 11 }} stroke={c.axis} width={52} label={{ value: 'e (m)', angle: -90, position: 'insideLeft', fontSize: 11, fill: c.axis, dx: 8 }} />
				<Tooltip formatter={(value, name) => tooltipValue(value, name)} labelFormatter={(t) => `t = ${Number(t).toFixed(2)} s`} />
				{showBand && (
					<>
						<ReferenceArea y1={-bandAbs} y2={bandAbs} fill={c.blue} fillOpacity={0.06} stroke={c.blue} strokeOpacity={0.4} strokeDasharray="4 4" ifOverflow="extendDomain" />
						<ReferenceLine y={-bandAbs} stroke={c.blue} strokeDasharray="4 4" strokeOpacity={0.7} ifOverflow="extendDomain" />
						<ReferenceLine y={bandAbs} stroke={c.blue} strokeDasharray="4 4" strokeOpacity={0.7} ifOverflow="extendDomain" />
					</>
				)}
				<ReferenceLine y={0} stroke={c.zero} strokeWidth={1} />
				<Line
					name="Error e(t)"
					dataKey={(p: { state: number[]; reference?: number[] }) => {
						const r = p.reference?.[0]
						const x = p.state?.[0]
						return r === undefined || x === undefined ? null : r - x
					}}
					stroke={color}
					dot={false}
					strokeWidth={2.2}
					strokeLinecap="round"
					isAnimationActive={false}
				/>
			</LineChart>
		</ResponsiveContainer>
	)
}

export function PoleZeroChart({ eigenvalues }: { eigenvalues: { real: number; imag: number }[] }) {
	const points = eigenvalues.map((e, i) => ({ x: e.real, y: e.imag, i }))
	const maxAbs = Math.max(1, ...points.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y))))
	const lim = maxAbs * 1.25
	const c = chartColors()

	return (
		<ResponsiveContainer width="100%" height={240}>
			<ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }} title="Closed-loop pole locations on the complex plane" role="img" tabIndex={-1}>
				<CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
				<ReferenceLine x={0} stroke={c.red} strokeWidth={1.5} strokeDasharray="4 4" label={{ value: 'stability edge', fontSize: 10, fill: c.red, position: 'top' }} />
				<XAxis type="number" dataKey="x" domain={[-lim, lim]} tickCount={7} tick={{ fontSize: 11 }} stroke={c.axis} name="Re" label={{ value: 'Re(λ)', position: 'insideBottomRight', fontSize: 11, fill: c.axis, dx: 4 }} />
				<YAxis type="number" dataKey="y" domain={[-lim, lim]} tickCount={7} tick={{ fontSize: 11 }} stroke={c.axis} name="Im" label={{ value: 'Im(λ)', angle: -90, position: 'insideLeft', fontSize: 11, fill: c.axis, dy: -4 }} />
				<Scatter data={points} fill={c.blue} isAnimationActive={false} shape="cross" />
				<Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(v) => tooltipValue(v, 'Re/Im')} />
			</ScatterChart>
		</ResponsiveContainer>
	)
}

export function ConvergenceChart({ points, optimizerType }: { points: { generation: number; bestCost: number | null }[]; optimizerType?: string }) {
	const plot = points.filter((p): p is { generation: number; bestCost: number } => p.bestCost !== null)
	if (plot.length === 0) return <Empty>No convergence data</Empty>
	const gMax = Math.max(...plot.map((p) => p.generation))
	const finalJ = plot[plot.length - 1]?.bestCost
	const xLabel = optimizerType === 'GRID_SEARCH' ? 'Evaluations' : 'Generations'
	const c = chartColors()

	const annotated = finalJ !== undefined
	return (
		<ResponsiveContainer width="100%" height={220}>
			<LineChart data={plot} margin={{ top: 24, right: 16, bottom: 0, left: 0 }} title={`Convergence of best objective J over ${xLabel.toLowerCase()}`} role="img" tabIndex={-1}>
				<CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
				<XAxis dataKey="generation" type="number" domain={[0, gMax]} tick={{ fontSize: 11 }} stroke={c.axis} label={{ value: xLabel, position: 'insideBottomRight', fontSize: 11, fill: c.axis, dy: 6 }} />
				<YAxis tick={{ fontSize: 11 }} stroke={c.axis} width={56} label={{ value: 'Best objective J', angle: -90, position: 'insideLeft', fontSize: 11, fill: c.axis, dx: 10 }} />
				{annotated && (
					<ReferenceLine y={finalJ} stroke={c.blue} strokeDasharray="4 4" label={{ value: `final J = ${Number(finalJ).toFixed(4)}`, fontSize: 11, fill: c.blue, position: 'insideBottomLeft' }} />
				)}
				<Tooltip formatter={(v) => tooltipValue(v, 'Best J', 4)} labelFormatter={(l) => `${xLabel.replace(/s$/, '')} ${l}`} />
				<Line dataKey="bestCost" name="Best J" stroke={c.green} dot={false} strokeWidth={2.2} isAnimationActive={false} />
			</LineChart>
		</ResponsiveContainer>
	)
}

export function CostSurfaceHeatmap({ surface, axisLabels, metricSurfaces, optimum, manual, gainBounds, resolution }: {
	surface: (number | null)[][]
	axisLabels: [string, string]
	metricSurfaces?: MetricSurfaces
	optimum?: number[] | null
	manual?: number[]
	gainBounds?: { lower: number[]; upper: number[] }
	resolution?: number[]
}) {
	const rows = surface.length
	const cols = surface[0]?.length ?? 0
	const [hover, setHover] = useState<{ r: number; c: number } | null>(null)

	// Roving tabindex. A 41x41 surface is 1,681 cells, so making each one a
	// tab stop would be unusable. Instead the grid is a single tab stop and
	// the arrow keys move an active cell within it, which is the pattern
	// APG prescribes for a large 2D data grid. Without this the J / IAE /
	// control-energy readout was mouse-only.
	const clampRC = (r: number, c: number) => ({
		r: Math.max(0, Math.min(rows - 1, r)),
		c: Math.max(0, Math.min(cols - 1, c)),
	})
	const [cursor, setCursor] = useState<{ r: number; c: number } | null>(null)
	const active = cursor ?? (rows > 0 && cols > 0 ? { r: Math.floor(rows / 2), c: Math.floor(cols / 2) } : null)

	// Roving tabindex only moves the tab stop, not the actual DOM focus, so
	// the arrow keys would walk the tabIndex ring without the focus ring
	// following. Pull focus to the new cell after the cursor settles.
	const gridRef = useRef<HTMLDivElement>(null)
	useEffect(() => {
		if (!cursor) return
		gridRef.current?.querySelector<HTMLElement>(`[data-cell="${cursor.r}-${cursor.c}"]`)?.focus()
	}, [cursor])

	const moveCursor = (dr: number, dc: number) => {
		if (!active) return
		setCursor(clampRC(active.r + dr, active.c + dc))
	}

	const onGridKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
		if (!active) return
		let handled = true
		switch (e.key) {
			case 'ArrowUp': moveCursor(-1, 0); break
			case 'ArrowDown': moveCursor(1, 0); break
			case 'ArrowLeft': moveCursor(0, -1); break
			case 'ArrowRight': moveCursor(0, 1); break
			case 'Home': setCursor(clampRC(active.r, 0)); break
			case 'End': setCursor(clampRC(active.r, cols - 1)); break
			case 'PageUp': moveCursor(-10, 0); break
			case 'PageDown': moveCursor(10, 0); break
			default: handled = false
		}
		if (handled) {
			e.preventDefault()
			// the cell's own onFocus drives the tooltip, so no hover update here
		}
	}

	const { lo, hi } = useMemo(() => {
		const flat = surface.flat().filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v))
		return { lo: flat.length ? Math.min(...flat) : 0, hi: flat.length ? Math.max(...flat) : 1 }
	}, [surface])
	const range = hi - lo || 1
	const colors = chartColors()

	const cell = (val: number | null | undefined) => {
		if (val === null || val === undefined || !Number.isFinite(val)) return hatchPattern(colors)
		const t = (val - lo) / range
		const hue = 210 - t * 165
		return `hsla(${hue}, 78%, ${92 - t * 44}%, 1)`
	}

	const kpAxis = axisLabels[0]
	const kdAxis = axisLabels[1]

	// backend stores surface[kp][kd]: rows vary over the Kp dimension, columns over Kd
	const spacingOf = (idx: number): number => {
		const lo = gainBounds?.lower?.[idx]
		const up = gainBounds?.upper?.[idx]
		const res = resolution?.[idx]
		if (lo === undefined || up === undefined || !res || res < 2) return 1
		return (up - lo) / (res - 1)
	}
	const gainToRow = (gains?: number[] | null) => {
		if (!gains || gains.length < 2 || !Number.isFinite(gains[0])) return null
		return Math.max(0, Math.min(rows - 1, Math.round((gains[0] - (gainBounds?.lower?.[0] ?? 0)) / spacingOf(0))))
	}
	const gainToCol = (gains?: number[] | null) => {
		if (!gains || gains.length < 2 || !Number.isFinite(gains[1])) return null
		return Math.max(0, Math.min(cols - 1, Math.round((gains[1] - (gainBounds?.lower?.[1] ?? 0)) / spacingOf(1))))
	}
	const optiR = gainToRow(optimum)
	const optiC = gainToCol(optimum)
	const manualR = gainToRow(manual)
	const manualC = gainToCol(manual)

	const hoverJ = hover ? (surface[hover.r]?.[hover.c] ?? null) : null
	const hoverIae = hover && metricSurfaces ? (metricSurfaces.iae[hover.r]?.[hover.c] ?? null) : null
	const hoverEffort = hover && metricSurfaces ? (metricSurfaces.controlEffort[hover.r]?.[hover.c] ?? null) : null
	const hoverInfeasible = hoverJ === null || hoverJ === undefined

	return (
		<div>
			<div
				ref={gridRef}
				className="heatmap"
				role="grid"
				aria-label={`${kpAxis} against ${kdAxis} objective heatmap. ${rows} by ${cols}. Use the arrow keys to inspect a cell.`}
				aria-rowcount={rows}
				aria-colcount={cols}
				onKeyDown={onGridKeyDown}
				style={{ display: 'grid', gridTemplateColumns: `34px repeat(${cols}, minmax(10px, 1fr))`, gap: 2 }}
			>
				<div />
				<div style={{ textAlign: 'center', fontSize: 10, color: colors.muted, gridColumn: `2 / -1` }}>
					{kdAxis} →
				</div>
				{surface.map((row, r) => (
					<Fragment key={r}>
						<div style={{ fontSize: 10, color: colors.muted, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6 }}>
							{r === Math.floor(rows / 2) ? <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>← {kpAxis}</span> : ''}
						</div>
						{row.map((val, c) => {
							const isOpt = optiR === r && optiC === c
							const isManual = manualR === r && manualC === c
							const isActive = active?.r === r && active?.c === c
							const cellJ = val === null || val === undefined || !Number.isFinite(val)
								? 'infeasible or unstable'
								: fmt(val, 4)
							const cellIae = metricSurfaces ? (metricSurfaces.iae[r]?.[c] ?? null) : null
							const cellEffort = metricSurfaces ? (metricSurfaces.controlEffort[r]?.[c] ?? null) : null
							const spoken = [
								`${kpAxis} index ${r}, ${kdAxis} index ${c}`,
								`J ${cellJ}`,
								cellIae === null || cellIae === undefined ? null : `IAE ${fmt(cellIae, 3)}`,
								cellEffort === null || cellEffort === undefined ? null : `control energy ${fmt(cellEffort, 3)}`,
								isOpt ? 'global optimum' : null,
								isManual && !isOpt ? 'current gain' : null,
							].filter(Boolean).join(', ')
							return (
								<div
									key={`${r}-${c}`}
									data-cell={`${r}-${c}`}
									role="gridcell"
									aria-rowindex={r + 1}
									aria-colindex={c + 2}
									aria-label={spoken}
									tabIndex={isActive ? 0 : -1}
									className="heatmap__cell"
									style={{
										aspectRatio: '1',
										background: cell(val),
										boxShadow: isOpt ? `inset 0 0 0 2px ${colors.ink}` : isManual ? `inset 0 0 0 2px ${colors.blue}` : undefined,
										position: 'relative',
									}}
									onMouseEnter={() => setHover({ r, c })}
									onMouseLeave={() => setHover(null)}
									onFocus={() => { setCursor({ r, c }); setHover({ r, c }) }}
									onBlur={() => setHover((h) => (h && h.r === r && h.c === c ? null : h))}
								>
									{isOpt && <span aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>★</span>}
									{isManual && !isOpt && <span aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }}>●</span>}
								</div>
							)
						})}
					</Fragment>
				))}
			</div>

			{hover && (
				<div className="heatmap-tooltip" role="tooltip" aria-live="polite">
					<span className="mono">Kp ~ row {hover.r}, Kd ~ col {hover.c}</span>
					<span><b>J</b> = {hoverInfeasible ? 'infeasible / unstable' : fmt(hoverJ, 4)}</span>
					{metricSurfaces && <span><b>IAE</b> = {hoverIae === null || hoverIae === undefined ? 'n/a' : fmt(hoverIae, 3)}</span>}
					{metricSurfaces && <span><b>Control energy (U = ∫u² dt)</b> = {hoverEffort === null || hoverEffort === undefined ? 'n/a' : fmt(hoverEffort, 3)}</span>}
				</div>
			)}

			<div className="heatmap-legend-row mt-2">
				<span><span className="swatch" style={{ background: cell(lo) }} /> low J</span>
				<span><span className="swatch" style={{ background: cell(hi) }} /> high J</span>
				<span><span className="swatch" style={{ background: hatchPattern(colors) }} /> infeasible / unstable</span>
				<span>★ optimum</span>
				<span>● current</span>
			</div>
		</div>
	)
}