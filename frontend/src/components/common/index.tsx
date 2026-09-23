import type { ReactNode } from 'react'

const FALLBACK = 'Not available'

export function fmt(n: number | null | undefined, digits = 3, fallback = FALLBACK): string {
	if (n === null || n === undefined || Number.isNaN(n) || !Number.isFinite(n)) return fallback
	const s = n < 0 ? '-' : ''
	const a = Math.abs(n)
	return s + a.toLocaleString('en-US', { maximumFractionDigits: digits })
}

export function fmtCompact(n: number | null | undefined, fallback = FALLBACK): string {
	if (n === null || n === undefined || Number.isNaN(n) || !Number.isFinite(n)) return fallback
	return Intl.NumberFormat('en-US', { notation: 'compact' }).format(n)
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

export function MetricCard({ label, value, sub, tone = 'neutral', hint }: {
	label: string
	value: ReactNode
	sub?: ReactNode
	tone?: 'good' | 'bad' | 'neutral'
	hint?: string
}) {
	return (
		<div className="metric-card">
			<span className="metric-card__label">
				{label}
				{hint !== undefined && <Info text={hint} />}
			</span>
			<span className={`metric-card__value metric-card__value--${tone}`}>{value}</span>
			{sub !== undefined && <span className="metric-card__sub">{sub}</span>}
		</div>
	)
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'good' | 'bad' | 'neutral' }) {
	return <span className={`badge badge--${tone}`}>{children}</span>
}

export function Callout({ tone, children }: { tone: 'info' | 'warn' | 'error'; children: ReactNode }) {
	return <div className={`callout callout--${tone}`}>{children}</div>
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
	return (
		<details className="learn">
			<summary className="learn__summary">
				<span className="learn__tag">Learn</span>
				{title}
			</summary>
			<div className="learn__body">{children}</div>
		</details>
	)
}

export function NumberField({ label, value, onChange, min, max, step, unit, hint }: {
	label: string
	value: number
	onChange: (v: number) => void
	min?: number
	max?: number
	step?: number
	unit?: string
	hint?: string
}) {
	return (
		<label className="field">
			<span className="field__label">
				{label}
				{hint !== undefined && <Info text={hint} />}
			</span>
			<span className="field__control">
				<input
					type="number"
					value={Number.isFinite(value) ? value : ''}
					min={min}
					max={max}
					step={step}
					onChange={(e) => onChange(parseFloat(e.target.value))}
				/>
				{unit !== undefined && <span className="field__unit">{unit}</span>}
			</span>
		</label>
	)
}

export function GainField({ name, value, onChange, min, max, unit, hint }: {
	name: string
	value: number
	onChange: (v: number) => void
	min?: number
	max?: number
	unit?: string
	hint?: string
}) {
	return (
		<label className="field field--gain">
			<span className="field__label">
				{name}
				{hint !== undefined && <Info text={hint} />}
			</span>
			<span className="field__control">
				<input
					type="number"
					value={Number.isFinite(value) ? value : ''}
					min={min}
					max={max}
					step={1}
					onChange={(e) => onChange(parseFloat(e.target.value))}
				/>
				{unit !== undefined && <span className="field__unit">{unit}</span>}
			</span>
		</label>
	)
}

export function SelectField({ label, value, onChange, options, hint }: {
	label: string
	value: string
	onChange: (v: string) => void
	options: { value: string; label: string }[]
	hint?: string
}) {
	return (
		<label className="field">
			<span className="field__label">
				{label}
				{hint !== undefined && <Info text={hint} />}
			</span>
			<select value={value} onChange={(e) => onChange(e.target.value)}>
				{options.map((o) => (
					<option key={o.value} value={o.value}>{o.label}</option>
				))}
			</select>
		</label>
	)
}

export function CheckField({ label, checked, onChange, hint }: {
	label: string
	checked: boolean
	onChange: (v: boolean) => void
	hint?: string
}) {
	return (
		<label className="check-field">
			<input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
			<span>{label}</span>
			{hint !== undefined && <Info text={hint} />}
		</label>
	)
}

export function RadioChip({ label, value, active, onChange, hint }: {
	label: string
	value: string
	active: boolean
	onChange: (v: string) => void
	hint?: string
}) {
	return (
		<label className={`radio-chip ${active ? 'active' : ''}`}>
			<input type="radio" name={value} checked={active} onChange={() => onChange(value)} />
			<span>{label}</span>
			{hint !== undefined && <Info text={hint} />}
		</label>
	)
}

export function Delta({ value, pct }: { value: number; pct: boolean }) {
	const v = pct ? Math.abs(value) : value
	const tone = pct ? 'neutral' : (value <= 0.001 ? 'good' : 'bad')
	const sign = value > 0 ? '+' : value < 0 ? '−' : ''
	return <span className={`delta delta--${tone}`}>{pct ? `${sign}${Math.abs(value).toFixed(1)}%` : `${sign}${fmt(v, 3)}`}</span>
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
					<input
						className="mono"
						style={{ width: 70, textAlign: 'right', border: 'none', background: 'none', color: 'var(--text)', fontWeight: 600 }}
						type="number"
						min={0}
						step={0.1}
						value={Number.isFinite(w.value) ? w.value : 0}
						onChange={(e) => onChange(w.symbol, parseFloat(e.target.value))}
					/>
				</div>
			))}
		</div>
	)
}