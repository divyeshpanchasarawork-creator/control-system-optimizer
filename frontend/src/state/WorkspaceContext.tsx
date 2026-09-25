import { createContext, useCallback, useContext, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { api } from '../api/client'
import type {
	OptimizationResponse,
	OptimizerType,
	SimulationResponse,
	StabilityResponse,
	SystemDescriptor,
} from '../api/types'

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
	stability: StabilityResponse | null
	optimizerResult: OptimizationResponse | null

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
	const [stability, setStability] = useState<StabilityResponse | null>(null)
	const [optimizerResult, setOptimizerResult] = useState<OptimizationResponse | null>(null)

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
		} catch (e) {
			if (!isAbortError(e)) setError(errorMessage(e))
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
			if (res.feasible && Array.isArray(res.bestGain) && res.bestGain.length >= 1) {
				setOptimizedGain([res.bestGain[0] ?? 0, res.bestGain[1] ?? res.bestGain[0] ?? 0])
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
		setStability(null)
		setOptimizerResult(null)
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
		setStability(null)
		setOptimizerResult(null)
		setError(null)
	}, [])

	const update = useCallback((patch: Partial<WorkspaceState>) => {
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
		stability,
		optimizerResult,
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