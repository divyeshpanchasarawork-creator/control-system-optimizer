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

export function SpringDamperFigure() {
	return (
		<svg className="spring-fig" viewBox="0 0 700 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Animated mass, spring and damper simulation">
			<defs>
				<linearGradient id="massGrad" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0" stopColor="#4a4a60" />
					<stop offset="1" stopColor="#2e2e3e" />
				</linearGradient>
			</defs>

			<g stroke-linecap="round" stroke-linejoin="round">
				<line className="ground" x1="40" y1="250" x2="660" y2="250" />
				<line className="wall" x1="60" y1="120" x2="60" y2="250" />
				<line className="wall" x1="48" y1="120" x2="72" y2="120" />

				{/* spring: wall to mass */}
				<path className="spring" d="M60 222 H82 C 85 214, 91 230, 94 222 C 97 214, 103 230, 106 222 C 109 214, 115 230, 118 222 C 121 214, 127 230, 130 222" transform="translate(0,0)" />

				{/* animating mass */}
				<g className="animate-mass">
					<rect className="mass" x="170" y="190" width="86" height="60" rx="8" />
					{/* wheels */}
					<circle cx="190" cy="254" r="7" fill="#56566e" stroke="#6a6a82" strokeWidth="1.5" />
					<circle cx="236" cy="254" r="7" fill="#56566e" stroke="#6a6a82" strokeWidth="1.5" />
					{/* label */}
					<text x="213" y="222" textAnchor="middle" fontSize="15" fontWeight="600" fill="#c9c9da">m</text>
				</g>

				{/* dashpot: mass to dashpot rod */}
				<line className="spring" x1="256" y1="222" x2="302" y2="222" />

				{/* dashpot housing */}
				<g className="animate-rod">
					<rect x="296" y="200" width="54" height="44" rx="6" fill="#3a3a4d" stroke="#6a6a82" strokeWidth="1.5" />
					<line x1="300" y1="200" x2="300" y2="244" className="rod" stroke="#8a8aa2" strokeWidth="2" />
					<line x1="346" y1="200" x2="346" y2="244" className="rod" stroke="#8a8aa2" strokeWidth="2" />
					<line x1="340" y1="214" x2="400" y2="214" stroke="#b4b4c4" strokeWidth="2.5" />
					<text x="323" y="232" textAnchor="middle" fontSize="12" fontWeight="600" fill="#8a8aa2">c</text>
				</g>

				{/* dashpot anchor to right wall */}
				<line className="ground" x1="400" y1="214" x2="660" y2="214" strokeDasharray="6 4" />

				<line x1="660" y1="120" x2="660" y2="250" className="wall" />
				<line x1="648" y1="120" x2="672" y2="120" className="wall" />

				{/* reference amplitude marker */}
				<line x1="60" y1="180" x2="60" y2="190" stroke="#b4b4c4" strokeWidth="2" />
			</g>

			{/* mini trajectory preview */}
			<g transform="translate(60, 20)">
				<rect x="-6" y="-6" width="240" height="70" rx="10" fill="#14141d" stroke="#2a2a38" strokeWidth="1.5" />
				<line x1="0" y1="54" x2="228" y2="54" stroke="#4a4a60" strokeWidth="1.5" strokeDasharray="4 4" />
				<path className="output-line" d="M0 54 C 45 54, 60 8, 100 12 C 140 16, 150 48, 190 50 C 205 50, 216 50, 228 50" />
				<circle className="output-tip animate-tip" r="5" cx="26" cy="54" />
			</g>
		</svg>
	)
}

export function LandingHero({ onEnter }: { onEnter: () => void }) {
	return (
		<section className="hero">
			<div className="hero__inner">
				<div className="hero__copy">
					<span className="hero__mark"><LogoMark size={28} /></span>
					<p className="hero__eyebrow">Linear control · in your browser</p>
					<h1 className="hero__title">
						Tune a spring damper the way a <em>control engineer</em> does.
					</h1>
					<p className="hero__subtitle">
						Run physics-accurate simulations, watch the closed-loop poles move,
						search for the best feedback gains, and compare every trade-off. No math required.
					</p>
					<div className="hero__cta-row">
						<button className="hero__cta hero__cta--primary" onClick={onEnter}>
							Go to lab
							<span aria-hidden="true">→</span>
						</button>
					</div>
				</div>
				<div className="hero__figure">
					<SpringDamperFigure />
					<p className="hero__figure-caption">The mass m rides on spring stiffness k and damping c; a state-feedback controller u = −K(x − r) drives it to the reference.</p>
				</div>
			</div>
		</section>
	)
}