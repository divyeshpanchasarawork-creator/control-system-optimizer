import { createContext, useCallback, useContext, useReducer, useRef } from 'react'
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

/** Everything the reducer owns: the workspace inputs plus its result slots and
 * per-operation busy/error flags. `staleContext` stays derived on top of these. */
interface WorkspaceData {
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

	loading: string | null
	refreshing: boolean
	/** Per-operation error slots: a failed simulation or stability analysis
	 * lands here, a failed optimization in `optError`, so a tab-local failure
	 * never contaminates the other tabs' panels via one global message. */
	simError: string | null
	optError: string | null
	/** Reserved for app-level loads (the system catalog at boot). */
	error: string | null
}

interface WorkspaceActions {
	update: (patch: Partial<WorkspaceData>) => void
	loadCatalog: () => Promise<void>
	runSimulation: (gain?: [number, number], options?: { silent?: boolean }) => Promise<void>
	simulateGain: (gain: [number, number], key?: string) => Promise<SimulationResponse>
	runStability: (options?: { silent?: boolean }) => Promise<void>
	runOptimization: () => Promise<void>
	applyOptimizedGain: () => void
	resetWorkspace: () => void
}

export interface WorkspaceState extends WorkspaceData, WorkspaceActions {
	/** Human-readable list of inputs that drifted since the last optimization.
	 * Non-null only while a result exists and the model no longer matches it. */
	staleContext: string[] | null
}

const initialData: WorkspaceData = {
	systemDescriptor: null,

	mass: 1,
	damping: 0.5,
	springConstant: 2,

	tracking: true,
	feedforward: false,
	manualGain: [10, 5],
	optimizedGain: null,
	useOptimized: false,

	initialState: [0, 0],
	reference: [1, 0],
	endTime: 10,
	timeStep: 0.01,
	settlingBand: 5,
	saturation: 0,

	gainLower: [0, 0],
	gainUpper: [40, 20],

	optimizerType: 'GRID_SEARCH',
	gridResolution: 41,
	includeCostSurface: true,
	populationSize: 24,
	maxIterations: 150,
	differentialWeight: 0.7,
	crossoverRate: 0.9,
	seed: 42,

	constraintsEnabled: false,
	maxControl: 50,
	maxOvershoot: 10,
	maxSettlingTime: 5,
	maxSteadyStateError: 0.05,
	maxControlEnergy: 40,

	trackingErrorWeight: 1,
	controlEffortWeight: 0.1,
	settlingTimeWeight: 0.5,
	overshootWeight: 0.5,
	steadyStateErrorEnabled: false,
	steadyStateErrorWeight: 1,

	simulation: null,
	simGain: null,
	stability: null,
	optimizerResult: null,
	optimizerConfig: null,
	optimizerRunId: null,

	loading: null,
	refreshing: false,
	simError: null,
	optError: null,
	error: null,
}

type Action =
	| { type: 'PATCH'; patch: Partial<WorkspaceData> }
	| { type: 'CATALOG'; descriptor: SystemDescriptor | null }
	| { type: 'CATALOG_FAIL'; error: string }
	| { type: 'RESET' }

function reducer(state: WorkspaceData, action: Action): WorkspaceData {
	switch (action.type) {
		case 'PATCH':
			return { ...state, ...action.patch }
		case 'CATALOG':
			return { ...state, systemDescriptor: action.descriptor, error: null }
		case 'CATALOG_FAIL':
			return { ...state, error: action.error }
		case 'RESET':
			return { ...initialData }
	}
}

const WorkspaceContext = createContext<WorkspaceState | null>(null)

function isAbortError(e: unknown): boolean {
	return e instanceof Error && e.name === 'AbortError'
}

function errorMessage(e: unknown): string {
	return e instanceof Error ? e.message : String(e)
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
	const [data, dispatch] = useReducer(reducer, initialData)
	// Callbacks read the freshest snapshot through the ref so they stay stable
	// (dispatch never changes) instead of rebuilding on every keystroke.
	const dataRef = useRef(data)
	dataRef.current = data

	const silentRef = useRef(0)
	const beginSilent = () => {
		silentRef.current += 1
		dispatch({ type: 'PATCH', patch: { refreshing: true } })
	}
	const endSilent = () => {
		silentRef.current = Math.max(0, silentRef.current - 1)
		if (silentRef.current === 0) dispatch({ type: 'PATCH', patch: { refreshing: false } })
	}

	const update = useCallback((patch: Partial<WorkspaceData>) => {
		dispatch({ type: 'PATCH', patch })
	}, [])

	const loadCatalog = useCallback(async () => {
		try {
			const list = await api.systems()
			dispatch({ type: 'CATALOG', descriptor: list[0] ?? null })
		} catch (e) {
			dispatch({ type: 'CATALOG_FAIL', error: errorMessage(e) })
		}
	}, [])

	const runSimulation = useCallback(async (gain?: [number, number], options?: { silent?: boolean }) => {
		const s = dataRef.current
		const silent = options?.silent ?? false
		if (silent) beginSilent()
		else dispatch({ type: 'PATCH', patch: { loading: 'Simulating…' } })
		dispatch({ type: 'PATCH', patch: { simError: null } })
		try {
			const applied = gain ?? (s.useOptimized && s.optimizedGain ? s.optimizedGain : s.manualGain)
			const system = {
				type: 'SPRING_DAMPER' as const,
				parameters: { mass: s.mass, damping: s.damping, springConstant: s.springConstant },
			}
			const controller = { type: 'STATE_FEEDBACK' as const, gain: applied, tracking: s.tracking, feedforward: s.feedforward }
			const res = await api.simulate({
				system,
				controller,
				simulation: { initialState: s.initialState, reference: s.reference, endTime: s.endTime, timeStep: s.timeStep, settlingBand: s.settlingBand, saturation: s.saturation > 0 ? s.saturation : undefined },
			})
			dispatch({ type: 'PATCH', patch: { simulation: res, simGain: Array.isArray(applied) ? [applied[0], applied[1] ?? applied[0]] : null } })
		} catch (e) {
			// Drop the previous result rather than leaving it on screen. The
			// panels label their numbers with the *current* gain, so keeping the
			// old response would silently attribute stale metrics to new gains.
			if (!isAbortError(e)) {
				dispatch({ type: 'PATCH', patch: { simulation: null, simGain: null, stability: null, simError: errorMessage(e) } })
			}
		} finally {
			if (silent) endSilent()
			else dispatch({ type: 'PATCH', patch: { loading: null } })
		}
	}, [])

	const simulateGain = useCallback(async (gain: [number, number], key?: string): Promise<SimulationResponse> => {
		const s = dataRef.current
		const system = {
			type: 'SPRING_DAMPER' as const,
			parameters: { mass: s.mass, damping: s.damping, springConstant: s.springConstant },
		}
		const controller = { type: 'STATE_FEEDBACK' as const, gain, tracking: s.tracking, feedforward: s.feedforward }
		return api.simulate({
			system,
			controller,
			simulation: { initialState: s.initialState, reference: s.reference, endTime: s.endTime, timeStep: s.timeStep, settlingBand: s.settlingBand, saturation: s.saturation > 0 ? s.saturation : undefined },
		}, key)
	}, [])

	const runStability = useCallback(async (options?: { silent?: boolean }) => {
		const s = dataRef.current
		const silent = options?.silent ?? false
		if (silent) beginSilent()
		else dispatch({ type: 'PATCH', patch: { loading: 'Analyzing stability…' } })
		dispatch({ type: 'PATCH', patch: { simError: null } })
		try {
			const system = {
				type: 'SPRING_DAMPER' as const,
				parameters: { mass: s.mass, damping: s.damping, springConstant: s.springConstant },
			}
			const controller = {
				type: 'STATE_FEEDBACK' as const,
				gain: s.useOptimized && s.optimizedGain ? s.optimizedGain : s.manualGain,
				tracking: s.tracking,
				feedforward: s.feedforward,
			}
			const res = await api.stability({ system, controller })
			dispatch({ type: 'PATCH', patch: { stability: res } })
		} catch (e) {
			if (!isAbortError(e)) dispatch({ type: 'PATCH', patch: { simError: errorMessage(e) } })
		} finally {
			if (silent) endSilent()
			else dispatch({ type: 'PATCH', patch: { loading: null } })
		}
	}, [])

	const runOptimization = useCallback(async () => {
		const s = dataRef.current
		dispatch({ type: 'PATCH', patch: { loading: 'Optimizing gains…', optError: null } })
		// Snapshot the exact settings this run is launched with. The form stays
		// live while the search runs and after it lands, so panels that describe
		// the run must not read the live values back.
		const config: OptimizeRunConfig = {
			optimizerType: s.optimizerType,
			gridResolution: s.gridResolution,
			populationSize: s.populationSize,
			maxIterations: s.maxIterations,
			gainLower: [...s.gainLower],
			gainUpper: [...s.gainUpper],
			feedforward: s.feedforward,
			saturation: s.saturation,
			mass: s.mass,
			damping: s.damping,
			springConstant: s.springConstant,
			tracking: s.tracking,
			initialState: [s.initialState[0], s.initialState[1]],
			reference: [s.reference[0], s.reference[1]],
			endTime: s.endTime,
			timeStep: s.timeStep,
			settlingBand: s.settlingBand,
			trackingErrorWeight: s.trackingErrorWeight,
			controlEffortWeight: s.controlEffortWeight,
			settlingTimeWeight: s.settlingTimeWeight,
			overshootWeight: s.overshootWeight,
			steadyStateErrorEnabled: s.steadyStateErrorEnabled,
			steadyStateErrorWeight: s.steadyStateErrorWeight,
			constraintsEnabled: s.constraintsEnabled,
			maxControl: s.maxControl,
			maxOvershoot: s.maxOvershoot,
			maxSettlingTime: s.maxSettlingTime,
			maxSteadyStateError: s.maxSteadyStateError,
			maxControlEnergy: s.maxControlEnergy,
		}
		try {
			const system = {
				type: 'SPRING_DAMPER' as const,
				parameters: { mass: s.mass, damping: s.damping, springConstant: s.springConstant },
			}
			const res = await api.optimize({
				system,
				controller: { type: 'STATE_FEEDBACK' as const, gain: [], tracking: s.tracking, feedforward: s.feedforward },
				gainBounds: { lower: s.gainLower, upper: s.gainUpper },
				optimizer: {
					type: s.optimizerType,
					resolution: [s.gridResolution, s.gridResolution],
					includeCostSurface: s.optimizerType === 'GRID_SEARCH' ? s.includeCostSurface : undefined,
					populationSize: s.optimizerType === 'DIFFERENTIAL_EVOLUTION' ? s.populationSize : undefined,
					maxIterations: s.optimizerType === 'DIFFERENTIAL_EVOLUTION' ? s.maxIterations : undefined,
					differentialWeight: s.optimizerType === 'DIFFERENTIAL_EVOLUTION' ? s.differentialWeight : undefined,
					crossoverRate: s.optimizerType === 'DIFFERENTIAL_EVOLUTION' ? s.crossoverRate : undefined,
					seed: s.optimizerType === 'DIFFERENTIAL_EVOLUTION' ? s.seed : undefined,
				},
				objective: {
					trackingErrorWeight: s.trackingErrorWeight,
					controlEffortWeight: s.controlEffortWeight,
					settlingTimeWeight: s.settlingTimeWeight,
					overshootWeight: s.overshootWeight,
					steadyStateErrorWeight: s.steadyStateErrorEnabled ? s.steadyStateErrorWeight : undefined,
					steadyStateErrorScale: s.steadyStateErrorEnabled ? Math.abs(s.reference[0]) || 1 : undefined,
				},
				constraints: s.constraintsEnabled
					? {
						maxControl: s.maxControl,
						maxOvershoot: s.maxOvershoot,
						maxSettlingTime: s.maxSettlingTime,
						maxSteadyStateError: s.maxSteadyStateError,
						maxControlEnergy: s.maxControlEnergy,
					}
					: undefined,
				simulation: { initialState: s.initialState, reference: s.reference, endTime: s.endTime, timeStep: s.timeStep, settlingBand: s.settlingBand, saturation: s.saturation > 0 ? s.saturation : undefined },
			})
			// A feasible result must carry a full two-gain vector before it is
			// allowed to replace the manual gain; never fabricate the missing
			// axis from the one that was returned. A later infeasible run yields
			// no new gain, so the previous one cannot be claimed by the new
			// result either.
			const newGain: [number, number] | null = res.feasible && Array.isArray(res.bestGain) && res.bestGain.length >= 2
				? [res.bestGain[0], res.bestGain[1]]
				: null
			dispatch({
				type: 'PATCH',
				patch: {
					optimizerResult: res,
					optimizerConfig: config,
					optimizerRunId: (s.optimizerRunId ?? 0) + 1,
					optimizedGain: newGain,
				},
			})
		} catch (e) {
			if (!isAbortError(e)) dispatch({ type: 'PATCH', patch: { optError: errorMessage(e) } })
		} finally {
			dispatch({ type: 'PATCH', patch: { loading: null } })
		}
	}, [])

	const applyOptimizedGain = useCallback(() => {
		if (dataRef.current.optimizedGain) {
			dispatch({ type: 'PATCH', patch: { useOptimized: true } })
		}
	}, [])

	const resetWorkspace = useCallback(() => {
		dispatch({ type: 'RESET' })
	}, [])

	const staleContext = data.optimizerConfig && data.optimizerResult
		? (() => {
			const drift = describeContextDrift(data.optimizerConfig, {
				mass: data.mass, damping: data.damping, springConstant: data.springConstant, tracking: data.tracking, feedforward: data.feedforward, saturation: data.saturation,
				initialState: data.initialState, reference: data.reference, endTime: data.endTime, timeStep: data.timeStep, settlingBand: data.settlingBand,
				trackingErrorWeight: data.trackingErrorWeight, controlEffortWeight: data.controlEffortWeight, settlingTimeWeight: data.settlingTimeWeight, overshootWeight: data.overshootWeight,
				steadyStateErrorEnabled: data.steadyStateErrorEnabled, steadyStateErrorWeight: data.steadyStateErrorWeight,
				constraintsEnabled: data.constraintsEnabled, maxControl: data.maxControl, maxOvershoot: data.maxOvershoot, maxSettlingTime: data.maxSettlingTime, maxSteadyStateError: data.maxSteadyStateError, maxControlEnergy: data.maxControlEnergy,
			})
			return drift.length > 0 ? drift : null
		})()
		: null

	const value: WorkspaceState = {
		...data,
		staleContext,
		update,
		loadCatalog,
		runSimulation,
		simulateGain,
		runStability,
		runOptimization,
		applyOptimizedGain,
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