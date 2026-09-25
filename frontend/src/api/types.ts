export type SystemType = 'SPRING_DAMPER'
export type ControllerType = 'STATE_FEEDBACK'
export type OptimizerType = 'GRID_SEARCH' | 'DIFFERENTIAL_EVOLUTION'

export interface SystemDescriptor {
	type: SystemType
	parameterNames: string[]
	controllerTypes: ControllerType[]
}

export interface SystemSpec {
	type: SystemType
	parameters: Record<string, number>
}

export interface ControllerSpec {
	type: ControllerType
	gain: number[]
	tracking: boolean
	feedforward?: boolean
}

export interface CreationSpec {
	tracking?: boolean
	feedforward?: boolean
}

export interface SimulationConfig {
	initialState: number[]
	reference: number[]
	startTime?: number
	endTime?: number
	timeStep?: number
	settlingBand?: number
	saturation?: number
}

export interface TrajectoryPointDto {
	time: number
	state: number[]
	control: number[]
	reference: number[]
}

export interface SettlingBandTime {
	bandPercent: number
	time: number | null
}

export interface MetricsResponse {
	finalError: number
	maxAbsError: number
	iae: number
	ise: number
	overshoot: number
	settlingTime: number | null
	controlEffort: number
	maxControl: number
	settlingTimeByBand?: SettlingBandTime[]
	xSS?: number | null
	eSS?: number | null
}

export interface SimulationResponse {
	systemType: SystemType
	systemParameters: Record<string, number>
	controller: ControllerSpec
	metrics: MetricsResponse
	trajectory: TrajectoryPointDto[]
}

export interface ComplexValue {
	real: number
	imag: number
}

export interface StabilityResponse {
	stable: boolean
	maxRealPart: number
	minRealPart: number
	eigenvalues: ComplexValue[]
}

export interface GainBounds {
	lower: number[]
	upper: number[]
}

export interface OptimizerSpec {
	type: OptimizerType
	resolution: number[]
	populationSize?: number
	maxIterations?: number
	differentialWeight?: number
	crossoverRate?: number
	seed?: number
	includeCostSurface?: boolean
}

export interface ObjectiveSpec {
	trackingErrorWeight: number
	controlEffortWeight: number
	settlingTimeWeight: number
	overshootWeight: number
	steadyStateErrorWeight?: number
	steadyStateErrorScale?: number
}

export interface ConstraintSpec {
	maxControl?: number
	maxOvershoot?: number
	maxSettlingTime?: number
	maxSteadyStateError?: number
	maxControlEnergy?: number
}

export interface SimulationRequest {
	system: SystemSpec
	controller: ControllerSpec
	simulation: SimulationConfig
}

export interface StabilityRequest {
	system: SystemSpec
	controller: ControllerSpec
}

export interface ConvergencePoint {
	generation: number
	bestCost: number | null
}

export interface OptimizationRequest {
	system: SystemSpec
	controller: ControllerSpec
	gainBounds: GainBounds
	optimizer: OptimizerSpec
	objective: ObjectiveSpec
	constraints?: ConstraintSpec
	simulation: SimulationConfig
	baselineGain?: number[]
}

export interface ObjectiveTerm {
	key: 'trackingError' | 'controlEffort' | 'settlingTime' | 'overshoot' | 'steadyStateError'
	name: string
	raw: number
	reference: number
	normalized: number
	weight: number
	contribution: number
	sharePercent: number
}

export interface ObjectiveBreakdown {
	normalized: boolean
	total: number
	terms: ObjectiveTerm[]
}

export interface ConstraintReport {
	id: string
	name: string
	achieved: number | null
	limit: number
	satisfied: boolean
}

export interface MetricSurfaces {
	iae: (number | null)[][]
	controlEffort: (number | null)[][]
}

export interface OptimizationResponse {
	optimizerType: OptimizerType
	bestGain: number[]
	bestCost: number | null
	evaluations: number
	feasible: boolean
	converged: boolean
	seed: number | null
	stability: StabilityResponse
	metrics: MetricsResponse
	boundaryHit: boolean
	elapsedMillis: number
	convergence: ConvergencePoint[]
	costSurface: (number | null)[][] | null
	metricSurfaces: MetricSurfaces | null
	objectiveBreakdown: ObjectiveBreakdown | null
	constraints: ConstraintReport[] | null
	optimizerConfig: Record<string, unknown>
	infeasibleReason?: string | null
}
