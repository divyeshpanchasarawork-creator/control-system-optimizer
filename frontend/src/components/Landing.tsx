export function LogoMark({ size = 34 }: { size?: number }) {
	const ink = { stroke: 'var(--on-accent)' } as const
	const soft = { stroke: 'var(--on-accent)', opacity: 0.55 } as const
	const dot = { fill: 'var(--on-accent)' } as const
	const trace =
		'M5.5 27 L6.3 26.6 L7.2 25.4 L8 23.8 L8.9 21.9 L9.7 19.8 L10.5 17.7 L11.4 15.8 L12.2 14 L13.1 12.4 L13.9 11.1 L14.7 10.1 L15.6 9.3 L16.4 8.8 L17.3 8.5 L18.1 8.4 L18.9 8.4 L19.8 8.6 L20.6 8.9 L21.5 9.2 L22.3 9.5 L23.1 9.9 L24 10.2 L24.8 10.5 L25.7 10.7 L26.1 10.9'
	return (
		<svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
			<line x1="6" y1="27" x2="26.1" y2="27" style={soft} strokeWidth="2" strokeLinecap="round" />
			<line x1="9" y1="11" x2="26.1" y2="11" style={soft} strokeWidth="1.6" strokeLinecap="round" strokeDasharray="3 3" />
			<path d={trace} style={ink} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
			<circle cx="5" cy="26" r="2" style={dot} />
		</svg>
	)
}

export default LogoMark