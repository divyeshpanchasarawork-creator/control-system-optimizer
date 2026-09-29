import { createContext, useCallback, useContext, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { fmt } from '../components/common'
import { api } from '../api/client'
import type {
	OptimizationResponse,
	OptimizeRunConfig,
	OptimizerType,
	SimulationResponse,
	StabilityResponse,
	SystemDescriptor,
} from '../api/types'

/**
 * The live inputs a run's objective depends on. If any of these drift after an
 * optimization lands, its breakdown, "why" and optima no longer describe the
 * model on screen, and the result panels must say so instead of pretending.
 */
interface RunSensitiveInputs {
	mass: number
	damping: number
	springConstant: number
	tracking: boolean
	feedforward: boolean
	saturation: number
	initialState: [number, number]
	reference: [number, number]
	endTime: number
	timeStep: number
	settlingBand: number
	trackingErrorWeight: number
	controlEffortWeight: number
	settlingTimeWeight: number
	overshootWeight: number
	steadyStateErrorEnabled: boolean
	steadyStateErrorWeight: number
	constraintsEnabled: boolean
	maxControl: number
	maxOvershoot: number
	maxSettlingTime: number
	maxSteadyStateError: number
	maxControlEnergy: number
}

const neq = (a: number, b: number) => Math.abs(a - b) > 1e-9
const changed = (a: [number, number], b: [number, number]) => neq(a[0], b[0]) || neq(a[1], b[1])

function describeContextDrift(cfg: OptimizeRunConfig, live: RunSensitiveInputs): string[] {
	const out: string[] = []
	if (neq(cfg.mass, live.mass)) out.push(`mass ${fmt(cfg.mass, 2)} → ${fmt(live.mass, 2)} kg`)
	if (neq(cfg.damping, live.damping)) out.push(`damping ${fmt(cfg.damping, 2)} → ${fmt(live.damping, 2)} N·s/m`)
	if (neq(cfg.springConstant, live.springConstant)) out.push(`spring constant ${fmt(cfg.springConstant, 2)} → ${fmt(live.springConstant, 2)} N/m`)
	if (cfg.tracking !== live.tracking || cfg.feedforward !== live.feedforward || neq(cfg.saturation, live.saturation)) {
		out.push('tracking / feedforward / saturation')
	}
	if (changed(cfg.reference, live.reference) || changed(cfg.initialState, live.initialState)) out.push('reference / initial state')
	if (neq(cfg.endTime, live.endTime) || neq(cfg.timeStep, live.timeStep)) out.push('horizon / time step')
	if (neq(cfg.settlingBand, live.settlingBand)) out.push(`settling band ${fmt(cfg.settlingBand, 0)}% → ${fmt(live.settlingBand, 0)}%`)
	if (
		neq(cfg.trackingErrorWeight, live.trackingErrorWeight) ||
		neq(cfg.controlEffortWeight, live.controlEffortWeight) ||
		neq(cfg.settlingTimeWeight, live.settlingTimeWeight) ||
		neq(cfg.overshootWeight, live.overshootWeight) ||
		cfg.steadyStateErrorEnabled !== live.steadyStateErrorEnabled ||
		neq(cfg.steadyStateErrorWeight, live.steadyStateErrorWeight)
	) {
		out.push('objective weights')
	}
	const cfgLimits = [cfg.maxControl, cfg.maxOvershoot, cfg.maxSettlingTime, cfg.maxSteadyStateError, cfg.maxControlEnergy]
	const liveLimits = [live.maxControl, live.maxOvershoot, live.maxSettlingTime, live.maxSteadyStateError, live.maxControlEnergy]
	if (cfg.constraintsEnabled !== live.constraintsEnabled || cfgLimits.some((v, i) => neq(v, liveLimits[i]))) out.push('constraints')
	return out
}

export interface WorkspaceState {
	systemDescriptor: SystemDescriptor | null

	mass: number
	damping: number
	springConstant: number

	tracking: boolean
	feedforward: boolean
	manualGain: [number, number]
	optimizedGain: [number, number] | null
	useOptimized: boolean

	initialState: [number, number]
	reference: [number, number]
	endTime: number
	timeStep: number
	settlingBand: number
	saturation: number

	gainLower: [number, number]
	gainUpper: [number, number]

	optimizerType: OptimizerType
	gridResolution: number
	includeCostSurface: boolean
	populationSize: number
	maxIterations: number
	differentialWeight: number
	crossoverRate: number
	seed: number

	constraintsEnabled: boolean
	maxControl: number
	maxOvershoot: number
	maxSettlingTime: number
	maxSteadyStateError: number
	maxControlEnergy: number

	trackingErrorWeight: number
	controlEffortWeight: number
	settlingTimeWeight: number
	overshootWeight: number
	steadyStateErrorEnabled: boolean
	steadyStateErrorWeight: number

	simulation: SimulationResponse | null
	/** The gain the current simulation was computed for; the number panels may
	 * lead the live form during a recompute, so this keeps them honest. */
	simGain: [number, number] | null
	stability: StabilityResponse | null
	optimizerResult: OptimizationResponse | null
	/** The form settings the current optimizerResult was launched with. */
	optimizerConfig: OptimizeRunConfig | null
	/** A counter bumped after every completed optimization, so panels can
	 * distinguish "ran again with the same inputs" from "never re-ran". */
	optimizerRunId: number | null
	/** Human-readable list of inputs that drifted since the last optimization.
	 * Non-null only while a result exists and the model no longer matches it. */
	staleContext: string[] | null

	loading: string | null
	refreshing: boolean
	error: string | null

	update: (patch: Partial<WorkspaceState>) => void
	loadCatalog: () => Promise<void>
	runSimulation: (gain?: [number, number], options?: { silent?: boolean }) => Promise<void>
	simulateGain: (gain: [number, number], key?: string) => Promise<SimulationResponse>
	runStability: (options?: { silent?: boolean }) => Promise<void>
	runOptimization: () => Promise<void>
	applyOptimizedGain: () => void
	clearResults: () => void
	resetWorkspace: () => void
}

const WorkspaceContext = createContext<WorkspaceState | null>(null)

function isAbortError(e: unknown): boolean {
	return e instanceof Error && e.name === 'AbortError'
}

function errorMessage(e: unknown): string {
	return e instanceof Error ? e.message : String(e)
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
	const [systemDescriptor, setSystemDescriptor] = useState<SystemDescriptor | null>(null)
	const [mass, setMass] = useState(1)
	const [damping, setDamping] = useState(0.5)
	const [springConstant, setSpringConstant] = useState(2)

	const [tracking, setTracking] = useState(true)
	const [feedforward, setFeedforward] = useState(false)
	const [manualGain, setManualGain] = useState<[number, number]>([10, 5])
	const [optimizedGain, setOptimizedGain] = useState<[number, number] | null>(null)
	const [useOptimized, setUseOptimized] = useState(false)

	const [initialState, setInitialState] = useState<[number, number]>([0, 0])
	const [reference, setReference] = useState<[number, number]>([1, 0])
	const [endTime, setEndTime] = useState(10)
	const [timeStep, setTimeStep] = useState(0.01)
	const [settlingBand, setSettlingBand] = useState(5)
	const [saturation, setSaturation] = useState(0)

	const [gainLower, setGainLower] = useState<[number, number]>([0, 0])
	const [gainUpper, setGainUpper] = useState<[number, number]>([40, 20])

	const [optimizerType, setOptimizerType] = useState<OptimizerType>('GRID_SEARCH')
	const [gridResolution, setGridResolution] = useState(41)
	const [includeCostSurface, setIncludeCostSurface] = useState(true)
	const [populationSize, setPopulationSize] = useState(24)
	const [maxIterations, setMaxIterations] = useState(150)
	const [differentialWeight, setDifferentialWeight] = useState(0.7)
	const [crossoverRate, setCrossoverRate] = useState(0.9)
	const [seed, setSeed] = useState(42)

	const [constraintsEnabled, setConstraintsEnabled] = useState(false)
	const [maxControl, setMaxControl] = useState(50)
	const [maxOvershoot, setMaxOvershoot] = useState(10)
	const [maxSettlingTime, setMaxSettlingTime] = useState(5)
	const [maxSteadyStateError, setMaxSteadyStateError] = useState(0.05)
	const [maxControlEnergy, setMaxControlEnergy] = useState(40)

	const [trackingErrorWeight, setTrackingErrorWeight] = useState(1)
	const [controlEffortWeight, setControlEffortWeight] = useState(0.1)
	const [settlingTimeWeight, setSettlingTimeWeight] = useState(0.5)
	const [overshootWeight, setOvershootWeight] = useState(0.5)
	const [steadyStateErrorEnabled, setSteadyStateErrorEnabled] = useState(false)
	const [steadyStateErrorWeight, setSteadyStateErrorWeight] = useState(1)

	const [simulation, setSimulation] = useState<SimulationResponse | null>(null)
	const [simGain, setSimGain] = useState<[number, number] | null>(null)
	const [stability, setStability] = useState<StabilityResponse | null>(null)
	const [optimizerResult, setOptimizerResult] = useState<OptimizationResponse | null>(null)
	const [optimizerConfig, setOptimizerConfig] = useState<OptimizeRunConfig | null>(null)
	const [optimizerRunId, setOptimizerRunId] = useState<number | null>(null)

	const [loading, setLoading] = useState<string | null>(null)
	const [refreshing, setRefreshing] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const silentActiveRef = useRef(0)

	const beginSilent = () => {
		silentActiveRef.current += 1
		setRefreshing(true)
	}
	const endSilent = () => {
		silentActiveRef.current = Math.max(0, silentActiveRef.current - 1)
		if (silentActiveRef.current === 0) setRefreshing(false)
	}

	const loadCatalog = useCallback(async () => {
		try {
			const list = await api.systems()
			setSystemDescriptor(list[0] ?? null)
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e))
		}
	}, [])

	const runSimulation = useCallback(async (gain?: [number, number], options?: { silent?: boolean }) => {
		const silent = options?.silent ?? false
		if (silent) beginSilent()
		else setLoading('Simulating…')
		setError(null)
		try {
			const applied = gain ?? (useOptimized && optimizedGain ? optimizedGain : manualGain)
			const system = {
				type: 'SPRING_DAMPER' as const,
				parameters: { mass, damping, springConstant },
			}
			const controller = { type: 'STATE_FEEDBACK' as const, gain: applied, tracking, feedforward }
			const res = await api.simulate({
				system,
				controller,
				simulation: { initialState, reference, endTime, timeStep, settlingBand, saturation: saturation > 0 ? saturation : undefined },
			})
			setSimulation(res)
			setSimGain(Array.isArray(applied) ? [applied[0], applied[1] ?? applied[0]] : null)
		} catch (e) {
			// Drop the previous result rather than leaving it on screen. The
			// panels label their numbers with the *current* gain, so keeping the
			// old response would silently attribute stale metrics to new gains.
			if (!isAbortError(e)) {
				setSimulation(null)
				setSimGain(null)
				setStability(null)
				setError(errorMessage(e))
			}
		} finally {
			if (silent) endSilent()
			else setLoading(null)
		}
	}, [mass, damping, springConstant, tracking, feedforward, manualGain, optimizedGain, useOptimized, initialState, reference, endTime, timeStep, settlingBand, saturation])

	const simulateGain = useCallback(async (gain: [number, number], key?: string): Promise<SimulationResponse> => {
		const system = {
			type: 'SPRING_DAMPER' as const,
			parameters: { mass, damping, springConstant },
		}
		const controller = { type: 'STATE_FEEDBACK' as const, gain, tracking, feedforward }
		return api.simulate({
			system,
			controller,
			simulation: { initialState, reference, endTime, timeStep, settlingBand, saturation: saturation > 0 ? saturation : undefined },
		}, key)
	}, [mass, damping, springConstant, tracking, feedforward, initialState, reference, endTime, timeStep, settlingBand, saturation])

	const runStability = useCallback(async (options?: { silent?: boolean }) => {
		const silent = options?.silent ?? false
		if (silent) beginSilent()
		else setLoading('Analyzing stability…')
		setError(null)
		try {
			const system = {
				type: 'SPRING_DAMPER' as const,
				parameters: { mass, damping, springConstant },
			}
			const controller = {
				type: 'STATE_FEEDBACK' as const,
				gain: useOptimized && optimizedGain ? optimizedGain : manualGain,
				tracking,
				feedforward,
			}
			const res = await api.stability({ system, controller })
			setStability(res)
		} catch (e) {
			if (!isAbortError(e)) setError(errorMessage(e))
		} finally {
			if (silent) endSilent()
			else setLoading(null)
		}
	}, [mass, damping, springConstant, tracking, feedforward, manualGain, optimizedGain, useOptimized])

	const runOptimization = useCallback(async () => {
		setLoading('Optimizing gains…')
		setError(null)
		// Snapshot the exact settings this run is launched with. The form stays
		// live while the search runs and after it lands, so panels that describe
		// the run must not read the live values back.
		const config: OptimizeRunConfig = {
			optimizerType,
			gridResolution,
			populationSize,
			maxIterations,
			gainLower: [...gainLower],
			gainUpper: [...gainUpper],
			feedforward,
			saturation,
			mass,
			damping,
			springConstant,
			tracking,
			initialState: [initialState[0], initialState[1]],
			reference: [reference[0], reference[1]],
			endTime,
			timeStep,
			settlingBand,
			trackingErrorWeight,
			controlEffortWeight,
			settlingTimeWeight,
			overshootWeight,
			steadyStateErrorEnabled,
			steadyStateErrorWeight,
			constraintsEnabled,
			maxControl,
			maxOvershoot,
			maxSettlingTime,
			maxSteadyStateError,
			maxControlEnergy,
		}
		try {
			const system = {
				type: 'SPRING_DAMPER' as const,
				parameters: { mass, damping, springConstant },
			}
			const res = await api.optimize({
				system,
				controller: { type: 'STATE_FEEDBACK' as const, gain: [], tracking, feedforward },
				gainBounds: { lower: gainLower, upper: gainUpper },
				optimizer: {
					type: optimizerType,
					resolution: [gridResolution, gridResolution],
					includeCostSurface: optimizerType === 'GRID_SEARCH' ? includeCostSurface : undefined,
					populationSize: optimizerType === 'DIFFERENTIAL_EVOLUTION' ? populationSize : undefined,
					maxIterations: optimizerType === 'DIFFERENTIAL_EVOLUTION' ? maxIterations : undefined,
					differentialWeight: optimizerType === 'DIFFERENTIAL_EVOLUTION' ? differentialWeight : undefined,
					crossoverRate: optimizerType === 'DIFFERENTIAL_EVOLUTION' ? crossoverRate : undefined,
					seed: optimizerType === 'DIFFERENTIAL_EVOLUTION' ? seed : undefined,
				},
				objective: {
					trackingErrorWeight,
					controlEffortWeight,
					settlingTimeWeight,
					overshootWeight,
					steadyStateErrorWeight: steadyStateErrorEnabled ? steadyStateErrorWeight : undefined,
					steadyStateErrorScale: steadyStateErrorEnabled ? Math.abs(reference[0]) || 1 : undefined,
				},
				constraints: constraintsEnabled
					? {
						maxControl,
						maxOvershoot,
						maxSettlingTime,
						maxSteadyStateError,
						maxControlEnergy,
					}
					: undefined,
				simulation: { initialState, reference, endTime, timeStep, settlingBand, saturation: saturation > 0 ? saturation : undefined },
			})
			setOptimizerResult(res)
			setOptimizerConfig(config)
			setOptimizerRunId((n) => (n ?? 0) + 1)
			// A feasible result must carry a full two-gain vector before it is
			// allowed to replace the manual gain; never fabricate the missing
			// axis from the one that was returned.
			if (res.feasible && Array.isArray(res.bestGain) && res.bestGain.length >= 2) {
				setOptimizedGain([res.bestGain[0], res.bestGain[1]])
			}
		} catch (e) {
			if (!isAbortError(e)) setError(errorMessage(e))
		} finally {
			setLoading(null)
		}
	}, [mass, damping, springConstant, tracking, feedforward, gainLower, gainUpper, optimizerType, gridResolution, includeCostSurface, populationSize, maxIterations, differentialWeight, crossoverRate, seed, trackingErrorWeight, controlEffortWeight, settlingTimeWeight, overshootWeight, steadyStateErrorEnabled, steadyStateErrorWeight, initialState, reference, endTime, timeStep, settlingBand, saturation, constraintsEnabled, maxControl, maxOvershoot, maxSettlingTime, maxSteadyStateError, maxControlEnergy, manualGain])

	const applyOptimizedGain = useCallback(() => {
		if (optimizedGain) {
			setUseOptimized(true)
		}
	}, [optimizedGain])

	const clearResults = useCallback(() => {
		setSimulation(null)
		setSimGain(null)
		setStability(null)
		setOptimizerResult(null)
		setOptimizerConfig(null)
		setOptimizerRunId(null)
		setOptimizedGain(null)
		setUseOptimized(false)
		setError(null)
	}, [])

	const resetWorkspace = useCallback(() => {
		setMass(1)
		setDamping(0.5)
		setSpringConstant(2)
		setTracking(true)
		setFeedforward(false)
		setManualGain([10, 5])
		setOptimizedGain(null)
		setUseOptimized(false)
		setInitialState([0, 0])
		setReference([1, 0])
		setEndTime(10)
		setTimeStep(0.01)
		setSettlingBand(5)
		setSaturation(0)
		setGainLower([0, 0])
		setGainUpper([40, 20])
		setOptimizerType('GRID_SEARCH')
		setGridResolution(41)
		setIncludeCostSurface(true)
		setPopulationSize(24)
		setMaxIterations(150)
		setDifferentialWeight(0.7)
		setCrossoverRate(0.9)
		setSeed(42)
		setConstraintsEnabled(false)
		setMaxControl(50)
		setMaxOvershoot(10)
		setMaxSettlingTime(5)
		setMaxSteadyStateError(0.05)
		setMaxControlEnergy(40)
		setTrackingErrorWeight(1)
		setControlEffortWeight(0.1)
		setSettlingTimeWeight(0.5)
		setOvershootWeight(0.5)
setSteadyStateErrorEnabled(false)
		setSteadyStateErrorWeight(1)
		setSimulation(null)
		setSimGain(null)
		setStability(null)
		setOptimizerResult(null)
		setOptimizerConfig(null)
		setOptimizerRunId(null)
		setError(null)
	}, [])

	const update = useCallback((patch: Partial<WorkspaceState>) => {
		if (patch.error !== undefined) setError(patch.error)
		if (patch.mass !== undefined) setMass(patch.mass)
		if (patch.damping !== undefined) setDamping(patch.damping)
		if (patch.springConstant !== undefined) setSpringConstant(patch.springConstant)
		if (patch.tracking !== undefined) setTracking(patch.tracking)
		if (patch.feedforward !== undefined) setFeedforward(patch.feedforward)
		if (patch.manualGain !== undefined) setManualGain(patch.manualGain)
		if (patch.optimizedGain !== undefined) setOptimizedGain(patch.optimizedGain)
		if (patch.useOptimized !== undefined) setUseOptimized(patch.useOptimized)
		if (patch.initialState !== undefined) setInitialState(patch.initialState)
		if (patch.reference !== undefined) setReference(patch.reference)
		if (patch.endTime !== undefined) setEndTime(patch.endTime)
		if (patch.timeStep !== undefined) setTimeStep(patch.timeStep)
		if (patch.settlingBand !== undefined) setSettlingBand(patch.settlingBand)
		if (patch.saturation !== undefined) setSaturation(patch.saturation)
		if (patch.gainLower !== undefined) setGainLower(patch.gainLower)
		if (patch.gainUpper !== undefined) setGainUpper(patch.gainUpper)
		if (patch.optimizerType !== undefined) setOptimizerType(patch.optimizerType)
		if (patch.gridResolution !== undefined) setGridResolution(patch.gridResolution)
		if (patch.includeCostSurface !== undefined) setIncludeCostSurface(patch.includeCostSurface)
		if (patch.populationSize !== undefined) setPopulationSize(patch.populationSize)
		if (patch.maxIterations !== undefined) setMaxIterations(patch.maxIterations)
		if (patch.differentialWeight !== undefined) setDifferentialWeight(patch.differentialWeight)
		if (patch.crossoverRate !== undefined) setCrossoverRate(patch.crossoverRate)
		if (patch.seed !== undefined) setSeed(patch.seed)
		if (patch.constraintsEnabled !== undefined) setConstraintsEnabled(patch.constraintsEnabled)
		if (patch.maxControl !== undefined) setMaxControl(patch.maxControl)
		if (patch.maxOvershoot !== undefined) setMaxOvershoot(patch.maxOvershoot)
		if (patch.maxSettlingTime !== undefined) setMaxSettlingTime(patch.maxSettlingTime)
		if (patch.maxSteadyStateError !== undefined) setMaxSteadyStateError(patch.maxSteadyStateError)
		if (patch.maxControlEnergy !== undefined) setMaxControlEnergy(patch.maxControlEnergy)
		if (patch.trackingErrorWeight !== undefined) setTrackingErrorWeight(patch.trackingErrorWeight)
		if (patch.controlEffortWeight !== undefined) setControlEffortWeight(patch.controlEffortWeight)
		if (patch.settlingTimeWeight !== undefined) setSettlingTimeWeight(patch.settlingTimeWeight)
		if (patch.overshootWeight !== undefined) setOvershootWeight(patch.overshootWeight)
		if (patch.steadyStateErrorEnabled !== undefined) setSteadyStateErrorEnabled(patch.steadyStateErrorEnabled)
		if (patch.steadyStateErrorWeight !== undefined) setSteadyStateErrorWeight(patch.steadyStateErrorWeight)
	}, [])

	const staleContext = optimizerConfig && optimizerResult
		? (() => {
			const drift = describeContextDrift(optimizerConfig, {
				mass, damping, springConstant, tracking, feedforward, saturation,
				initialState, reference, endTime, timeStep, settlingBand,
				trackingErrorWeight, controlEffortWeight, settlingTimeWeight, overshootWeight,
				steadyStateErrorEnabled, steadyStateErrorWeight,
				constraintsEnabled, maxControl, maxOvershoot, maxSettlingTime, maxSteadyStateError, maxControlEnergy,
			})
			return drift.length > 0 ? drift : null
		})()
		: null

	const value: WorkspaceState = {
		systemDescriptor,
		mass,
		damping,
		springConstant,
		tracking,
		feedforward,
		manualGain,
		optimizedGain,
		useOptimized,
		initialState,
		reference,
		endTime,
		timeStep,
		settlingBand,
		saturation,
		gainLower,
		gainUpper,
		optimizerType,
		gridResolution,
		includeCostSurface,
		populationSize,
		maxIterations,
		differentialWeight,
		crossoverRate,
		seed,
		constraintsEnabled,
		maxControl,
		maxOvershoot,
		maxSettlingTime,
		maxSteadyStateError,
		maxControlEnergy,
		trackingErrorWeight,
		controlEffortWeight,
		settlingTimeWeight,
		overshootWeight,
		steadyStateErrorEnabled,
		steadyStateErrorWeight,
simulation,
		simGain,
		stability,
		optimizerResult,
		optimizerConfig,
		optimizerRunId,
		staleContext,
		loading,
		refreshing,
		error,
		update,
		loadCatalog,
		runSimulation,
		simulateGain,
		runStability,
		runOptimization,
		applyOptimizedGain,
		clearResults,
		resetWorkspace,
	}

	return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace(): WorkspaceState {
	const ctx = useContext(WorkspaceContext)
	if (!ctx) {
		throw new Error('useWorkspace must be used within a WorkspaceProvider')
	}
	return ctx
}