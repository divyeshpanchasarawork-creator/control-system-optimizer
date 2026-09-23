export function LogoMark({ size = 34 }: { size?: number }) {
	return (
		<svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
			<path
				d="M5 16 H12 M14 16 C 15 8, 18 24, 20 16 C 22 8, 25 24, 27 16"
				stroke="#fff"
				strokeWidth="2.4"
				strokeLinecap="round"
				fill="none"
			/>
			<circle cx="4" cy="8" r="2" fill="#fff" opacity="0.9" />
			<circle cx="4" cy="24" r="2" fill="#fff" opacity="0.9" />
		</svg>
	)
}

export default LogoMark