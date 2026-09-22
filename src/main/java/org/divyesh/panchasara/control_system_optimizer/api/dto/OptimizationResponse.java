package org.divyesh.panchasara.control_system_optimizer.api.dto;

import org.divyesh.panchasara.control_system_optimizer.analysis.StabilityResult;

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
		long elapsedMillis) {
}