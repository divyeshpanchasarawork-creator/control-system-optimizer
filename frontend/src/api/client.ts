import type {
	OptimizationRequest,
	OptimizationResponse,
	SimulationRequest,
	SimulationResponse,
	StabilityRequest,
	StabilityResponse,
	SystemDescriptor,
} from './types'

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')

const enum REQUEST_TIMEOUT_MS {
	simulate = 60_000,
	stability = 20_000,
	optimize = 120_000,
}

async function request<T>(
	method: string,
	url: string,
	body: unknown,
	timeoutMs: number,
	supersedeKey?: string,
): Promise<T> {
	// a new call to the same endpoint supersedes any in-flight one (stale
	// responses from rapid input edits are aborted instead of applied)
	if (supersedeKey !== undefined) {
		const prior = inflight.get(supersedeKey)
		if (prior) prior.abort()
	}

	const controller = new AbortController()
	if (supersedeKey !== undefined) inflight.set(supersedeKey, controller)
	let timedOut = false
	const timer = setTimeout(() => {
		timedOut = true
		controller.abort()
	}, timeoutMs)
	try {
		const res = await fetch(`${API_BASE}${url}`, {
			method,
			headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
			body: body !== undefined ? JSON.stringify(body) : undefined,
			signal: controller.signal,
		})
		if (!res.ok) {
			const text = await res.text().catch(() => '')
			let detail = text
			try {
				const json = JSON.parse(text)
				detail = json.detail || json.message || text
			} catch {
				/* keep raw text */
			}
			throw new Error(`Request failed (${res.status}): ${detail}`)
		}
		return (await res.json()) as T
	} catch (e) {
		if (controller.signal.aborted && timedOut) {
			throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s`)
		}
		// a supersede/mount abort is silent — the caller ignores AbortError
		throw e
	} finally {
		clearTimeout(timer)
		if (supersedeKey !== undefined && inflight.get(supersedeKey) === controller) {
			inflight.delete(supersedeKey)
		}
	}
}

const inflight = new Map<string, AbortController>()

export const api = {
	systems: () => request<SystemDescriptor[]>('GET', '/api/systems', undefined, REQUEST_TIMEOUT_MS.stability),
	simulate: (body: SimulationRequest) =>
		request<SimulationResponse>('POST', '/api/simulations', body, REQUEST_TIMEOUT_MS.simulate, '/api/simulations'),
	stability: (body: StabilityRequest) =>
		request<StabilityResponse>('POST', '/api/analysis/stability', body, REQUEST_TIMEOUT_MS.stability, '/api/analysis/stability'),
	optimize: (body: OptimizationRequest) =>
		request<OptimizationResponse>('POST', '/api/optimization', body, REQUEST_TIMEOUT_MS.optimize, '/api/optimization'),
}