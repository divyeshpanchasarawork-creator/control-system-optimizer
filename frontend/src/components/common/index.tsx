import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useId, useState } from 'react'
import type { ReactNode } from 'react'

const FALLBACK = 'Not available'

const clamp = (v: number, min?: number, max?: number) => {
	let r = v
	if (min !== undefined && r < min) r = min
	if (max !== undefined && r > max) r = max
	return r
}

const clean = (n: number) => {
	const v = Number(n.toFixed(10))
	return Number.isFinite(v) ? String(v) : '0'
}

export function BufferedNumberInput({ value, min, max, step = 1, onChange, className, ariaLabel, disabled }: {
	value: number
	min?: number
	max?: number
	step?: number
	onChange: (v: number) => void
	className?: string
	ariaLabel?: string
	disabled?: boolean
}) {
	const [draft, setDraft] = useState<string | null>(null)

	const display = draft ?? clean(Number.isFinite(value) ? value : 0)

	const handleChange = (raw: string) => {
		setDraft(raw)
		const parsed = parseFloat(raw)
		if (Number.isFinite(parsed)) onChange(parsed)
	}

	const commit = () => {
		setDraft(null)
	}

	const bump = (dir: 1 | -1) => {
		const base = Number.isFinite(value) ? value : 0
		const raw = clamp(parseFloat((base + dir * step).toFixed(10)), min, max)
		onChange(raw)
	}

	return (
		<span className="num-input">
			<button type="button" className="num-input__step" tabIndex={-1} aria-label={ariaLabel ? `decrease ${ariaLabel}` : 'decrease'} disabled={disabled} onClick={() => bump(-1)}>
				<svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
			</button>
			<input
				className={className}
				type="text"
				inputMode="decimal"
				value={display}
				disabled={disabled}
				onChange={(e) => handleChange(e.target.value)}
				onBlur={commit}
				onKeyDown={(e) => {
					if (e.key === 'Enter') {
						commit()
						e.currentTarget.blur()
					}
				}}
				aria-label={ariaLabel}
			/>
			<button type="button" className="num-input__step" tabIndex={-1} aria-label={ariaLabel ? `increase ${ariaLabel}` : 'increase'} disabled={disabled} onClick={() => bump(1)}>
				<svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
			</button>
		</span>
	)
}

export function fmt(n: number | null | undefined, digits = 3, fallback = FALLBACK): string {
	if (n === null || n === undefined || Number.isNaN(n) || !Number.isFinite(n)) return fallback
	const s = n < 0 ? '-' : ''
	const a = Math.abs(n)
	return s + a.toLocaleString('en-US', { maximumFractionDigits: digits })
}

/** Gains read with up to three decimals, matching the metric precision. */
export const fmtGain = (g: number) => fmt(g, 3)

/** The metric readings both tabs compare. `settling` maps to `settlingTime`. */
export type MetricKey = 'finalError' | 'iae' | 'ise' | 'maxAbsError' | 'overshoot' | 'settling' | 'controlEffort' | 'maxControl'

/**
 * Single declaration of the reading groups Simulate, Optimize and Compare all
 * render. `unit` is the one stated in the input fields, so a reading never
 * surfaces with units in one tab and bare in another.
 */
export const METRIC_GROUPS: { label: string; keys: { key: MetricKey; name: string; unit?: string; lowerBetter: boolean }[] }[] = [
	{
		label: 'Tracking quality',
		keys: [
			{ key: 'finalError', name: 'Final error', unit: 'm', lowerBetter: true },
			{ key: 'iae', name: 'IAE', unit: 'm·s', lowerBetter: true },
			{ key: 'ise', name: 'ISE', unit: 'm²·s', lowerBetter: true },
		],
	},
	{
		label: 'Transient response',
		keys: [
			{ key: 'maxAbsError', name: 'Max abs error', unit: 'm', lowerBetter: true },
			{ key: 'overshoot', name: 'Overshoot', unit: '%', lowerBetter: true },
			{ key: 'settling', name: 'Settling time', unit: 's', lowerBetter: true },
		],
	},
	{
		label: 'Control signal',
		keys: [
			{ key: 'controlEffort', name: 'Control energy', unit: 'N²·s', lowerBetter: true },
			{ key: 'maxControl', name: 'Peak force', unit: 'N', lowerBetter: true },
		],
	},
]

/** Tone for a reading that expresses how far a metric overshoots the reference. */
export function metricGood(value: number | null | undefined): 'good' | 'bad' | 'neutral' {
	if (typeof value !== 'number' || !Number.isFinite(value)) return 'neutral'
	// overshoot on a step input and the biggest excursion read against the
	// reference; anything past a fifth of it deserves the yellow flag
	return value > 20 ? 'bad' : 'good'
}

/**
 * The panel wrapper used around every chart. `busy` turns the panel's
 * surface into the chart-busy treatment while a run is in flight, so the
 * three tabs share one idiom instead of each restating the class.
 */
export function ChartPanel({ title, right, busy = false, children }: {
	title?: ReactNode
	right?: ReactNode
	busy?: boolean
	children: ReactNode
}) {
	return (
		<Panel title={title} right={right} className={busy ? 'chart-busy' : ''}>
			{children}
		</Panel>
	)
}

/** The primary run/compare action shared by Optimize and Compare. */
export function RunButton({ label, pendingLabel, pending = false, disabled = false, block = false, icon, onClick }: {
	label: ReactNode
	pendingLabel?: ReactNode
	pending?: boolean
	disabled?: boolean
	block?: boolean
	icon?: ReactNode
	onClick: () => void
}) {
	return (
		<button type="button" className={`btn primary${block ? ' btn--block' : ''}`} onClick={onClick} disabled={disabled || pending}>
			{icon}{pending ? (pendingLabel ?? 'Working…') : label}
		</button>
	)
}

/**
 * A gain vector printed the same way everywhere: mono, bracketed, up to three
 * decimals. `label` prefixes the reading (e.g. "Manual K"), never formatted
 * with momentum as part of the value.
 */
export function GainTag({ gain, label }: { gain: (number | null | undefined)[]; label?: ReactNode }) {
	return (
		<span className="mono">
			{label !== undefined && <>{label} = </>}[{gain.map((g) => (g === null || g === undefined ? '?' : fmtGain(g))).join(', ')}]
		</span>
	)
}

/** Warns that a result was computed for an earlier model and offers the rerun. */
export function StaleCallout({ context, onAction, children }: {
	context: string[]
	onAction: () => void
	children?: ReactNode
}) {
	return (
		<Callout tone="warn">
			<span>
				This result was optimized against an earlier model
				{context.length === 1 ? `: ${context[0]}.` : `. Changed: ${context.join(', ')}.`}
			</span>
			{children}
			<button type="button" className="btn btn--sm" onClick={onAction}>Re-run optimization</button>
		</Callout>
	)
}

/**
 * A titled block of content. The title is an `h2` so the document outline
 * runs h1 (tab title, in the app header) -> h2 (panel) with no skipped level.
 */
export function Panel({ title, right, children, className = '' }: {
	title?: ReactNode
	right?: ReactNode
	children: ReactNode
	className?: string
}) {
	return (
		<section className={`panel ${className}`.trim()}>
			{(title !== undefined || right !== undefined) && (
				<header className="panel__header">
					{title !== undefined && <h2 className="panel__title">{title}</h2>}
					{right}
				</header>
			)}
			<div className="panel__body">{children}</div>
		</section>
	)
}

/**
 * A titled chart with no box of its own.
 *
 * Use inside a Panel that already holds the heading: a run of related charts
 * then reads as one figure rather than a panel nested in a panel, and the
 * caption keeps the chart identifiable without a second border. When a chart
 * is the only thing on screen it should be the Panel instead.
 */
export function ChartCell({ title, children }: { title: ReactNode; children: ReactNode }) {
	return (
		<figure className="chart-cell">
			<figcaption className="chart-cell__title">{title}</figcaption>
			{children}
		</figure>
	)
}

export function DataTable({ columns, children, className = '' }: {
	columns: readonly { header: ReactNode }[]
	children: ReactNode
	className?: string
}) {
	return (
		<div className="table-wrap">
			<table className={`data ${className}`.trim()}>
				<thead>
					<tr>{columns.map((c, i) => <th key={i}>{c.header}</th>)}</tr>
				</thead>
				{children}
			</table>
		</div>
	)
}

/**
 * Label/value pairs. A definition list rather than a div soup, so the pairing is
 * exposed to assistive tech instead of being purely visual.
 */
export function KeyValue({ rows }: {
	rows: readonly { label: ReactNode; value: ReactNode; mono?: boolean }[]
}) {
	return (
		<dl className="kv">
			{rows.map((r) => (
				<div className="kv__row" key={String(r.label)}>
					<dt className="kv__label">{r.label}</dt>
					<dd className={`kv__value ${r.mono === true ? 'mono' : ''}`.trim()}>{r.value}</dd>
				</div>
			))}
		</dl>
	)
}

export function Empty({ children }: { children: ReactNode }) {
	return <div className="empty">{children}</div>
}

/**
 * Settling time measured at each tolerance band. Simulate and Optimize both
 * report the same bands from the same pass over the trajectory, so they render
 * it through this one table. Typed structurally to keep this module free of API
 * imports.
 */
export function SettlingBandTable({ metrics, empty }: {
	metrics?: { settlingTimeByBand?: { bandPercent: number; time: number | null }[] } | null
	empty: string
}) {
	const bands = metrics?.settlingTimeByBand
	if (!bands?.length) return <Empty>{empty}</Empty>
	return (
		<DataTable columns={[{ header: 'Band' }, { header: 'Measured settling time' }]}>
			<tbody>
				{bands.map((b) => (
					<tr key={b.bandPercent}>
						<td>{b.bandPercent}% of |r|</td>
						<td>{b.time === null ? 'Not reached' : `${fmt(b.time, 3)} s`}</td>
					</tr>
				))}
			</tbody>
		</DataTable>
	)
}

/**
 * A single reading: label, value, optional unit, optional explanation.
 *
 * A reading never gets a box of its own. It sits directly on the panel that
 * holds it and is separated from its neighbours by whitespace and the group's
 * rule, so a panel of nine readings is one surface rather than ten. The tone
 * accent moves to the left edge, which keeps good and bad readable without a
 * border to sit on, and the hint popover is unchanged.
 */
export function MetricCard({ label, value, sub, tone = 'neutral', hint }: {
	label: string
	value: ReactNode
	sub?: ReactNode
	tone?: 'good' | 'bad' | 'neutral'
	hint?: string
}) {
	const [open, setOpen] = useState(false)
	const popId = useId()
	return (
		<div className={`metric-card metric-card--${tone}`}>
			<span className="metric-card__label">
				{label}
				{hint !== undefined && (
					<button
						type="button"
						className="info"
						aria-label={`About ${label}`}
						aria-expanded={open}
						aria-describedby={open ? popId : undefined}
						onClick={() => setOpen((o) => !o)}
					>
						<span className="info__glyph" aria-hidden="true">i</span>
					</button>
				)}
			</span>
			<span className={`metric-card__value metric-card__value--${tone}`}>{value}</span>
			{sub !== undefined && <span className="metric-card__sub">{sub}</span>}
			{hint !== undefined && open && <span className="metric-card__pop" id={popId} role="tooltip">{hint}</span>}
		</div>
	)
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'good' | 'bad' | 'neutral' }) {
	return <span className={`badge badge--${tone}`}>{children}</span>
}

export function Callout({ tone, children }: { tone: 'info' | 'warn' | 'error'; children: ReactNode }) {
	return <div className={`callout callout--${tone}`}>{children}</div>
}

export function BusyNote({ children, large = false }: { children: ReactNode; large?: boolean }) {
	return (
		<span className="loading-note">
			<span className={large ? 'spinner spinner--lg' : 'spinner'} />
			<span>{children}</span>
		</span>
	)
}

export function Info({ text }: { text: string }) {
	const id = useId()
	return (
		<span className="info" tabIndex={0} title={text} aria-describedby={id}>
			<span className="info__glyph" aria-hidden="true">i</span>
			<span className="info__tip" id={id} role="note">{text}</span>
		</span>
	)
}

export function Learn({ title, children }: { title: string; children: ReactNode }) {
	const [open, setOpen] = useState(false)
	const reduceMotion = useReducedMotion()
	return (
		<div className="learn">
			<button type="button" className="learn__summary" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
				<span className="learn__tag">Learn</span>
				<span className="learn__title">{title}</span>
				<span className={`learn__chevron ${open ? 'learn__chevron--open' : ''}`} aria-hidden="true">
					<svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
						<path d="M6 9l6 6 6-6" />
					</svg>
				</span>
			</button>
			<AnimatePresence initial={false}>
				{open && (
					<motion.div
						className="learn__body"
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: 'auto', opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' }}
					>
						{children}
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

/**
 * Settings that most runs never change, tucked behind a summary line.
 *
 * Use this for advanced parameters, not for explanation: `Learn` is the
 * explainer, this one hides controls. The summary is the reason it is safe to
 * hide them, because a collapsed group that says nothing leaves the reader
 * unable to tell whether the run is using the values they think it is. The
 * panel heading names the group and the trigger reports how many fields it
 * holds, so the count is available to assistive tech even while collapsed.
 */
export function Disclosure({ label, summary, count, defaultOpen = false, children }: {
	label: string
	summary?: ReactNode
	count?: number
	defaultOpen?: boolean
	children: ReactNode
}) {
	const [open, setOpen] = useState(defaultOpen)
	const reduceMotion = useReducedMotion()
	return (
		<div className={`disclosure${open ? ' disclosure--open' : ''}`}>
			<button
				type="button"
				className="disclosure__trigger"
				onClick={() => setOpen((o) => !o)}
				aria-expanded={open}
			>
				<span className="disclosure__label">{label}</span>
				{count !== undefined && <span className="sr-only"> {count} settings</span>}
				{summary !== undefined && !open && <span className="disclosure__summary mono">{summary}</span>}
				<span className="disclosure__chevron" aria-hidden="true">
					<svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
						<path d="M6 9l6 6 6-6" />
					</svg>
				</span>
			</button>
			<AnimatePresence initial={false}>
				{open && (
					<motion.div
						className="disclosure__body"
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: 'auto', opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' }}
					>
						{children}
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

export function NumberField({ label, value, onChange, min, max, step, unit, hint, gain, disabled }: {
	label: string
	value: number
	onChange: (v: number) => void
	min?: number
	max?: number
	step?: number
	unit?: string
	hint?: string
	gain?: boolean
	disabled?: boolean
}) {
	return (
		<label className={`field ${gain ? 'field--gain' : ''} ${disabled ? 'is-disabled' : ''}`.trim()}>
			<span className="field__label">
				{label}
				{hint !== undefined && <Info text={hint} />}
			</span>
			<span className="field__control">
				<BufferedNumberInput value={Number.isFinite(value) ? value : 0} min={min} max={max} step={gain ? 1 : step} onChange={onChange} ariaLabel={label} disabled={disabled} />
				{unit !== undefined && <span className="field__unit">{unit}</span>}
			</span>
		</label>
	)
}

export function SelectField({ label, value, onChange, options, hint, disabled }: {
	label: string
	value: string
	onChange: (v: string) => void
	options: { value: string; label: string }[]
	hint?: string
	disabled?: boolean
}) {
	return (
		<label className={`field ${disabled ? 'is-disabled' : ''}`}>
			<span className="field__label">
				{label}
				{hint !== undefined && <Info text={hint} />}
			</span>
			<select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
				{options.map((o) => (
					<option key={o.value} value={o.value}>{o.label}</option>
				))}
			</select>
		</label>
	)
}

export function CheckField({ label, checked, onChange, hint, disabled }: {
	label: string
	checked: boolean
	onChange: (v: boolean) => void
	hint?: string
	disabled?: boolean
}) {
	return (
		<label className={`check-field ${disabled ? 'is-disabled' : ''}`}>
			<input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
			<span>{label}</span>
			{hint !== undefined && <Info text={hint} />}
		</label>
	)
}

export function RadioChip({ label, value, name, active, onChange, hint, disabled }: {
	label: string
	value: string
	name: string
	active: boolean
	onChange: (v: string) => void
	hint?: string
	disabled?: boolean
}) {
	return (
		<label className={`radio-chip ${active ? 'active' : ''} ${disabled ? 'is-disabled' : ''}`}>
			<input type="radio" name={name} checked={active} disabled={disabled} onChange={() => onChange(value)} />
			<span>{label}</span>
			{hint !== undefined && <Info text={hint} />}
		</label>
	)
}

/**
 * A change smaller than this is float noise, not an improvement worth reporting.
 * Collapsing it to zero is what stops an untouched metric reading as a
 * sub-0.1% regression, and keeps `-0.0%` off the screen.
 */
export const DELTA_DEAD_BAND_PERCENT = 0.5

export function relativeDelta(from: number, to: number): number | null {
	if (!Number.isFinite(from) || !Number.isFinite(to) || from === 0) return null
	const rel = ((to - from) / Math.abs(from)) * 100
	return Math.abs(rel) < DELTA_DEAD_BAND_PERCENT ? 0 : rel
}

export function Delta({ value, pct, tone }: { value: number; pct: boolean; tone?: 'good' | 'bad' | 'neutral' }) {
	const v = pct ? Math.abs(value) : value
	// absolute deltas read "smaller is better", so they threshold; percentages
	// read off the sign, which the caller can also pin explicitly
	const resolved = tone ?? (pct ? 'neutral' : (value <= 0.001 ? 'good' : 'bad'))
	const sign = value > 0 ? '+' : value < 0 ? '−' : ''
	// both branches go through fmt so thousands group and both follow the
	// same "not available" contract
	return <span className={`delta delta--${resolved}`}>{pct ? `${sign}${fmt(Math.abs(value), 1)}%` : `${sign}${fmt(v, 3)}`}</span>
}

/** Tone for a relative change in a lower-better metric: improvement is good. */
export function deltaTone(rel: number): 'good' | 'bad' | 'neutral' {
	return rel > 0 ? 'bad' : rel < 0 ? 'good' : 'neutral'
}

export function ObjectiveBars({ weights, onChange }: {
	weights: { label: string; symbol: string; value: number; hint: string }[]
	onChange: (symbol: string, value: number) => void
}) {
	const max = Math.max(1, ...weights.map((w) => w.value))
	return (
		<div className="weight-bars">
			{weights.map((w) => (
				<div className="weight-bar" key={w.symbol}>
					<span className="weight-bar__label">
						{w.label} <Info text={w.hint} />
					</span>
					<div className="weight-bar__track">
						<div className="weight-bar__fill" style={{ width: `${(w.value / max) * 100}%` }} />
					</div>
					<BufferedNumberInput
						className="mono num-input__field"
						value={Number.isFinite(w.value) ? w.value : 0}
						min={0}
						step={0.1}
						onChange={(v) => onChange(w.symbol, v)}
						ariaLabel={`${w.label} weight`}
					/>
				</div>
			))}
		</div>
	)
}

export function ObjectiveBreakdownTable({ breakdown, notSettled, baselineNote }: {
	breakdown: {
		normalized: boolean
		total: number
		terms: { key: string; name: string; raw: number; reference: number; normalized: number; weight: number; contribution: number; sharePercent: number }[]
	}
	notSettled?: boolean
	baselineNote?: string
}) {
	const dash = '\u2014'
	return (
		<div className="stack">
			<p className="faint reset-top">
				{breakdown.normalized
					? 'J = Σ wᵢ·(metricᵢ / scaleᵢ): each term is normalized against a fixed positive scale (IAE by |r₁|·T, control energy by (k·|r₁|)²·T, settling by T, overshoot by 100), so J is deterministic and 1.0 on a term means its metric equals that scale. Below 1 is better, above is worse. Weighted contributions sum to J.'
					: `J = wₑ·IAE + wᵤ·U + wₛ·Tₛ + wₒ·O with raw weighting ${baselineNote ?? '(no manual-gain baseline was used, or the baseline could not be evaluated)'}. When a run never settles, the settling term is penalized as the full horizon.`}
			</p>
			<div className="table-wrap">
				<table className="data">
				<thead>
					<tr>
						<th>Metric</th>
						<th>Raw</th>
						<th>Ref</th>
						<th>Norm.</th>
						<th>Weight</th>
						<th>Weighted</th>
						<th>% of J</th>
					</tr>
				</thead>
				<tbody>
					{breakdown.terms.map((t) => (
						<tr key={t.key}>
							<td>{t.name}</td>
							<td className="mono">{fmt(t.raw, 4)}</td>
							<td className="mono">{breakdown.normalized ? fmt(t.reference, 4) : dash}</td>
							<td className={`mono ${breakdown.normalized && t.normalized > 1.0001 ? 'delta delta--bad' : ''}`}>
								{breakdown.normalized ? fmt(t.normalized, 3) : dash}
							</td>
							<td className="mono">{fmt(t.weight, 3)}</td>
							<td className="mono">{fmt(t.contribution, 4)}</td>
							<td className="mono">{fmt(t.sharePercent, 1)}%</td>
						</tr>
					))}
				</tbody>
			</table>
			</div>
			<div className="row row--between">
				<span className="faint">{notSettled ? 'Settling never reached within the band: the raw settling term is the full horizon.' : ''}</span>
				<span className="mono">J = {fmt(breakdown.total, 4)}</span>
			</div>
		</div>
	)
}