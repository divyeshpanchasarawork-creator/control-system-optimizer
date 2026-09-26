import { Fragment, useMemo, useState } from 'react'
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
import { Empty } from '../common'

export const COLORS = ['#0a84ff', '#32d74b', '#c77800', '#d70015', '#7c3aed', '#0891b2', '#db2777', '#65a30d']

const fmtTick = (v: unknown) => (typeof v === 'number' ? String(Number(v.toFixed(2))) : String(v))

export function TrajectoryChart({ response, kind }: { response: SimulationResponse; kind: 'position' | 'velocity' | 'control' }) {
	const data = response.trajectory || []
	const idx = kind === 'position' ? 0 : kind === 'velocity' ? 1 : 0
	const yLabel = kind === 'position' ? 'Position (m)' : kind === 'velocity' ? 'Velocity (m/s)' : 'u (N)'
	const color = kind === 'position' ? '#0a84ff' : kind === 'velocity' ? '#32d74b' : '#c77800'
	const signalName = kind === 'position' ? 'Position' : kind === 'velocity' ? 'Velocity' : 'Control'

	const signalKey = kind === 'control'
		? (p: { time: number; control?: number[] }) => p.control?.[0] ?? 0
		: (p: { time: number; state: number[] }) => p.state[idx] ?? 0

	return (
		<ResponsiveContainer width="100%" height={200}>
			<LineChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
				<CartesianGrid strokeDasharray="3 3" stroke="#e6e6ec" />
				<XAxis dataKey="time" type="number" tickFormatter={fmtTick} tick={{ fontSize: 11 }} stroke="#a3a3ad" />
				<YAxis tick={{ fontSize: 11 }} stroke="#a3a3ad" width={52} label={{ value: yLabel, angle: -90, position: 'insideLeft', fontSize: 11, fill: '#a3a3ad', dx: 8 }} />
				<Tooltip formatter={(value, name) => [Number(value ?? 0).toFixed(3), name]} />
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
	const color = '#0a84ff'
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
			<LineChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
				<CartesianGrid strokeDasharray="3 3" stroke="#e6e6ec" />
				<XAxis dataKey="time" type="number" tickFormatter={fmtTick} tick={{ fontSize: 11 }} stroke="#a3a3ad" />
				<YAxis tick={{ fontSize: 11 }} stroke="#a3a3ad" width={52} domain={yDomain} label={{ value: 'Position (m)', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#a3a3ad', dx: 8 }} />
				<Tooltip formatter={(value, name) => [Number(value ?? 0).toFixed(3), name]} />
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
					<ReferenceLine y={xSS} stroke="#7c3aed" strokeDasharray="2 6" ifOverflow="extendDomain" />
				)}
				{showBand && (
					<>
						<ReferenceArea y1={bandLow} y2={bandHigh} fill="#0a84ff" fillOpacity={0.06} stroke="#0a84ff" strokeOpacity={0.4} strokeDasharray="4 4" ifOverflow="extendDomain" />
						<ReferenceLine y={bandLow} stroke="#0a84ff" strokeDasharray="4 4" strokeOpacity={0.7} ifOverflow="extendDomain" />
						<ReferenceLine y={bandHigh} stroke="#0a84ff" strokeDasharray="4 4" strokeOpacity={0.7} ifOverflow="extendDomain" />
					</>
				)}
				<Line name="Position" dataKey={(p: { state: number[] }) => p.state?.[0] ?? 0} stroke={color} dot={false} strokeWidth={2.2} strokeLinecap="round" isAnimationActive={false} />
			</LineChart>
		</ResponsiveContainer>
	)
}

export function ErrorChart({ response, band }: { response: SimulationResponse; band: number }) {
	const data = response.trajectory || []
	const refMag = Math.abs(data[0]?.reference?.[0] ?? 0)
	const bandAbs = (band / 100) * refMag
	const showBand = bandAbs > 0 && refMag > 0
	const color = '#d70015'

	return (
		<ResponsiveContainer width="100%" height={200}>
			<LineChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
				<CartesianGrid strokeDasharray="3 3" stroke="#e6e6ec" />
				<XAxis dataKey="time" type="number" tickFormatter={fmtTick} tick={{ fontSize: 11 }} stroke="#a3a3ad" />
				<YAxis tick={{ fontSize: 11 }} stroke="#a3a3ad" width={52} label={{ value: 'e (m)', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#a3a3ad', dx: 8 }} />
				<Tooltip formatter={(value, name) => [Number(value ?? 0).toFixed(3), name]} labelFormatter={(t) => `t = ${Number(t).toFixed(2)} s`} />
				{showBand && (
					<>
						<ReferenceArea y1={-bandAbs} y2={bandAbs} fill="#0a84ff" fillOpacity={0.06} stroke="#0a84ff" strokeOpacity={0.4} strokeDasharray="4 4" ifOverflow="extendDomain" />
						<ReferenceLine y={-bandAbs} stroke="#0a84ff" strokeDasharray="4 4" strokeOpacity={0.7} ifOverflow="extendDomain" />
						<ReferenceLine y={bandAbs} stroke="#0a84ff" strokeDasharray="4 4" strokeOpacity={0.7} ifOverflow="extendDomain" />
					</>
				)}
				<ReferenceLine y={0} stroke="#c8c8d0" strokeWidth={1} />
				<Line name="Error e(t)" dataKey={(p: { state: number[]; reference?: number[] }) => (p.reference?.[0] ?? 0) - (p.state?.[0] ?? 0)} stroke={color} dot={false} strokeWidth={2.2} strokeLinecap="round" isAnimationActive={false} />
			</LineChart>
		</ResponsiveContainer>
	)
}

export function PoleZeroChart({ eigenvalues }: { eigenvalues: { real: number; imag: number }[] }) {
	const points = eigenvalues.map((e, i) => ({ x: e.real, y: e.imag, i }))
	const maxAbs = Math.max(1, ...points.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y))))
	const lim = maxAbs * 1.25

	return (
		<ResponsiveContainer width="100%" height={240}>
			<ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
				<CartesianGrid strokeDasharray="3 3" stroke="#e6e6ec" />
				<ReferenceLine x={0} stroke="#d70015" strokeWidth={1.5} strokeDasharray="4 4" label={{ value: 'stability edge', fontSize: 10, fill: '#d70015', position: 'top' }} />
				<XAxis type="number" dataKey="x" domain={[-lim, lim]} tickCount={7} tick={{ fontSize: 11 }} stroke="#a3a3ad" name="Re" label={{ value: 'Re(λ)', position: 'insideBottomRight', fontSize: 11, fill: '#a3a3ad', dx: 4 }} />
				<YAxis type="number" dataKey="y" domain={[-lim, lim]} tickCount={7} tick={{ fontSize: 11 }} stroke="#a3a3ad" name="Im" label={{ value: 'Im(λ)', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#a3a3ad', dy: -4 }} />
				<Scatter data={points} fill="#0a84ff" isAnimationActive={false} shape="cross" />
				<Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(v) => [Number(v).toFixed(3), 'Re/Im']} />
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

	const annotated = finalJ !== undefined
	return (
		<ResponsiveContainer width="100%" height={220}>
			<LineChart data={plot} margin={{ top: 24, right: 16, bottom: 0, left: 0 }}>
				<CartesianGrid strokeDasharray="3 3" stroke="#e6e6ec" />
				<XAxis dataKey="generation" type="number" domain={[0, gMax]} tick={{ fontSize: 11 }} stroke="#a3a3ad" label={{ value: xLabel, position: 'insideBottomRight', fontSize: 11, fill: '#a3a3ad', dy: 6 }} />
				<YAxis tick={{ fontSize: 11 }} stroke="#a3a3ad" width={56} label={{ value: 'Best objective J', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#a3a3ad', dx: 10 }} />
				{annotated && (
					<ReferenceLine y={finalJ} stroke="#0a84ff" strokeDasharray="4 4" label={{ value: `final J = ${Number(finalJ).toFixed(4)}`, fontSize: 11, fill: '#0a84ff', position: 'insideBottomLeft' }} />
				)}
				<Tooltip formatter={(v) => [Number(v).toFixed(4), 'Best J']} labelFormatter={(l) => `${xLabel.replace(/s$/, '')} ${l}`} />
				<Line dataKey="bestCost" name="Best J" stroke="#32d74b" dot={false} strokeWidth={2.2} isAnimationActive={false} />
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

	const { lo, hi } = useMemo(() => {
		const flat = surface.flat().filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v))
		return { lo: flat.length ? Math.min(...flat) : 0, hi: flat.length ? Math.max(...flat) : 1 }
	}, [surface])
	const range = hi - lo || 1

	const cell = (val: number | null | undefined) => {
		if (val === null || val === undefined || !Number.isFinite(val)) return 'repeating-linear-gradient(45deg, #f4f4f7 0 4px, #ececf1 4px 8px)'
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
			<div className="heatmap" style={{ display: 'grid', gridTemplateColumns: `34px repeat(${cols}, minmax(10px, 1fr))`, gap: 2 }}>
				<div />
				<div style={{ textAlign: 'center', fontSize: 10, color: '#8e8e93', gridColumn: `2 / -1` }}>
					{kdAxis} →
				</div>
				{surface.map((row, r) => (
					<Fragment key={r}>
						<div style={{ fontSize: 10, color: '#8e8e93', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6 }}>
							{r === Math.floor(rows / 2) ? <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>← {kpAxis}</span> : ''}
						</div>
						{row.map((val, c) => {
							const isOpt = optiR === r && optiC === c
							const isManual = manualR === r && manualC === c
							return (
								<div
									key={`${r}-${c}`}
									className="heatmap__cell"
									style={{
										aspectRatio: '1',
										background: cell(val),
										boxShadow: isOpt ? 'inset 0 0 0 2px #1d1d1f' : isManual ? 'inset 0 0 0 2px #0a84ff' : undefined,
										position: 'relative',
									}}
									onMouseEnter={() => setHover({ r, c })}
									onMouseLeave={() => setHover(null)}
								>
									{isOpt && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }} title="global optimum">★</span>}
									{isManual && !isOpt && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }} title="current / manual gain">●</span>}
								</div>
							)
						})}
					</Fragment>
				))}
			</div>

			{hover && (
				<div className="heatmap-tooltip" style={{ marginTop: 10, padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface-2)', display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 12.5 }}>
					<span className="mono">Kp ~ row {hover.r}, Kd ~ col {hover.c}</span>
					<span><b>J</b> = {hoverInfeasible ? 'infeasible / unstable' : ` ${Number(hoverJ).toFixed(4)}`}</span>
					{metricSurfaces && <span><b>IAE</b> = {hoverIae === null || hoverIae === undefined ? 'n/a' : Number(hoverIae).toFixed(3)}</span>}
					{metricSurfaces && <span><b>Control energy (U = ∫u² dt)</b> = {hoverEffort === null || hoverEffort === undefined ? 'n/a' : Number(hoverEffort).toFixed(3)}</span>}
				</div>
			)}

			<div className="heatmap-legend-row" style={{ marginTop: 8 }}>
				<span><span className="swatch" style={{ background: cell(lo) }} /> low J</span>
				<span><span className="swatch" style={{ background: cell(hi) }} /> high J</span>
				<span><span className="swatch" style={{ background: 'repeating-linear-gradient(45deg,#f4f4f7 0 4px,#ececf1 4px 8px)' }} /> infeasible / unstable</span>
				<span>★ optimum</span>
				<span>● current</span>
			</div>
		</div>
	)
}