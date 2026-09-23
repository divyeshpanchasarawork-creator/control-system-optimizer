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

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
	const res = await fetch(`${API_BASE}${url}`, {
		method,
		headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
		body: body !== undefined ? JSON.stringify(body) : undefined,
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
}

export const api = {
	systems: () => request<SystemDescriptor[]>('GET', '/api/systems'),
	simulate: (body: SimulationRequest) => request<SimulationResponse>('POST', '/api/simulations', body),
	stability: (body: StabilityRequest) => request<StabilityResponse>('POST', '/api/analysis/stability', body),
	optimize: (body: OptimizationRequest) => request<OptimizationResponse>('POST', '/api/optimization', body),
}
