package org.divyesh.panchasara.control_system_optimizer.optimization;

import java.util.List;
import java.util.Map;

/**
 * Outcome of an optimization run.
 *
 * @param optimizerType  the optimizer family that produced the result
 * @param bestParameters the best parameter vector found
 * @param bestCost       the objective value at the best parameters
 * @param evaluations    total number of candidate evaluations performed
 * @param feasible       true if at least one feasible (stable, valid) candidate
 *                       was found
 * @param converged      true if the optimizer ran to completion
 * @param seed           the deterministic random seed used (null for purely
 *                       deterministic optimizers)
 * @param convergence    progress samples, best cost vs generation/milestone
 * @param costSurface    full evaluation grid for 2-D problems when requested by
 *                       the caller (null otherwise); entries may be null where a
 *                       candidate was infeasible
 * @param metricSurfaces per-cell IAE and control-effort diagnostics recorded
 *                       alongside {@code costSurface} (null unless requested)
 * @param config         effective configuration echoed back (resolution, DE
 *                       parameters, seed, ...)
 * @param nearestMiss    the closest infeasible candidate evaluated, or
 *                       {@code null} when the search found a feasible one. Lets a
 *                       failed run report what it came closest to instead of only
 *                       that it failed; the caller re-evaluates it for details.
 */
public record OptimizationResult(
		String optimizerType,
		double[] bestParameters,
		double bestCost,
		long evaluations,
		boolean feasible,
		boolean converged,
		Long seed,
		List<ConvergencePoint> convergence,
		Double[][] costSurface,
		MetricSurfaces metricSurfaces,
		Map<String, Object> config,
		double[] nearestMiss) {

	public OptimizationResult {
		convergence = convergence == null ? List.of() : List.copyOf(convergence);
		config = config == null ? Map.of() : Map.copyOf(config);
	}
}