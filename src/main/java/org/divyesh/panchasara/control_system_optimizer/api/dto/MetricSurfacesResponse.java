package org.divyesh.panchasara.control_system_optimizer.api.dto;

/**
 * Per-cell IAE and control-effort diagnostics recorded over a grid search's
 * cost surface. Cells where the candidate was infeasible are null. Mirrors
 * {@code MetricSurfaces} for API consumers.
 */
public record MetricSurfacesResponse(Double[][] iae, Double[][] controlEffort) {

	public static MetricSurfacesResponse from(
			org.divyesh.panchasara.control_system_optimizer.optimization.MetricSurfaces surfaces) {
		return surfaces == null ? null : new MetricSurfacesResponse(surfaces.iae(), surfaces.controlEffort());
	}
}