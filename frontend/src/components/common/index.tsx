import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
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
			<button type="button" className="num-input__step" tabIndex={-1} aria-label="decrease" disabled={disabled} onClick={() => bump(-1)}>
				<svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden><path d="M5 12h14" /></svg>
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
			<button type="button" className="num-input__step" tabIndex={-1} aria-label="increase" disabled={disabled} onClick={() => bump(1)}>
				<svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
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
					{title !== undefined && <h3 className="panel__title">{title}</h3>}
					{right}
				</header>
			)}
			<div className="panel__body">{children}</div>
		</section>
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

export function SectionLabel({ children }: { children: ReactNode }) {
	return <p className="section-label">{children}</p>
}

export function MetricCard({ label, value, sub, tone = 'neutral', hint }: {
	label: string
	value: ReactNode
	sub?: ReactNode
	tone?: 'good' | 'bad' | 'neutral'
	hint?: string
}) {
	const [open, setOpen] = useState(false)
	return (
		<div className={`metric-card metric-card--${tone}`}>
			<span className="metric-card__label">
				{label}
				{hint !== undefined && (
					<button
						type="button"
						className="info"
						aria-label={`About ${label}`}
						onClick={() => setOpen((o) => !o)}
					>
						<span className="info__glyph" aria-hidden="true">i</span>
					</button>
				)}
			</span>
			<span className={`metric-card__value metric-card__value--${tone}`}>{value}</span>
			{sub !== undefined && <span className="metric-card__sub">{sub}</span>}
			{hint !== undefined && open && <span className="metric-card__pop" role="tooltip">{hint}</span>}
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
	return (
		<span className="info" tabIndex={0} title={text}>
			<span className="info__glyph" aria-hidden="true">i</span>
			<span className="info__tip">{text}</span>
		</span>
	)
}

export function Learn({ title, children }: { title: string; children: ReactNode }) {
	const [open, setOpen] = useState(false)
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
						transition={{ duration: 0.22, ease: 'easeOut' }}
					>
						{children}
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

export function NumberField({ label, value, onChange, min, max, step, unit, hint, disabled }: {
	label: string
	value: number
	onChange: (v: number) => void
	min?: number
	max?: number
	step?: number
	unit?: string
	hint?: string
	disabled?: boolean
}) {
	return (
		<label className={`field ${disabled ? 'is-disabled' : ''}`}>
			<span className="field__label">
				{label}
				{hint !== undefined && <Info text={hint} />}
			</span>
			<span className="field__control">
				<BufferedNumberInput value={Number.isFinite(value) ? value : 0} min={min} max={max} step={step} onChange={onChange} ariaLabel={label} disabled={disabled} />
				{unit !== undefined && <span className="field__unit">{unit}</span>}
			</span>
		</label>
	)
}

export function GainField({ name, value, onChange, min, max, unit, hint, disabled }: {
	name: string
	value: number
	onChange: (v: number) => void
	min?: number
	max?: number
	unit?: string
	hint?: string
	disabled?: boolean
}) {
	return (
		<label className={`field field--gain ${disabled ? 'is-disabled' : ''}`}>
			<span className="field__label">
				{name}
				{hint !== undefined && <Info text={hint} />}
			</span>
			<span className="field__control">
				<BufferedNumberInput value={Number.isFinite(value) ? value : 0} min={min} max={max} step={1} onChange={onChange} ariaLabel={name} disabled={disabled} />
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

export function RadioChip({ label, value, active, onChange, hint, disabled }: {
	label: string
	value: string
	active: boolean
	onChange: (v: string) => void
	hint?: string
	disabled?: boolean
}) {
	return (
		<label className={`radio-chip ${active ? 'active' : ''} ${disabled ? 'is-disabled' : ''}`}>
			<input type="radio" name={value} checked={active} disabled={disabled} onChange={() => onChange(value)} />
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
	return <span className={`delta delta--${resolved}`}>{pct ? `${sign}${Math.abs(value).toFixed(1)}%` : `${sign}${fmt(v, 3)}`}</span>
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
			<div className="row row--between">
				<span className="faint">{notSettled ? 'Settling never reached within the band: the raw settling term is the full horizon.' : ''}</span>
				<span className="mono">J = {fmt(breakdown.total, 4)}</span>
			</div>
		</div>
	)
}