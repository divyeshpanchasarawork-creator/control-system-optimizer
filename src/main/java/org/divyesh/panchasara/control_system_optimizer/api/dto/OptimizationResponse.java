package org.divyesh.panchasara.control_system_optimizer.api.dto;

import java.util.List;
import java.util.Map;

import org.divyesh.panchasara.control_system_optimizer.analysis.StabilityResult;
import org.divyesh.panchasara.control_system_optimizer.optimization.ConvergencePoint;

public record OptimizationResponse(
		String optimizerType,
		double[] bestGain,
		Double bestCost,
		long evaluations,
		boolean feasible,
		boolean converged,
		Long seed,
		StabilityResult stability,
		MetricsResponse metrics,
		boolean boundaryHit,
		long elapsedMillis,
		List<ConvergencePoint> convergence,
		Double[][] costSurface,
		Map<String, Object> optimizerConfig,
		ObjectiveBreakdownResponse objectiveBreakdown,
		List<ConstraintReportResponse> constraints,
		MetricSurfacesResponse metricSurfaces) {
}