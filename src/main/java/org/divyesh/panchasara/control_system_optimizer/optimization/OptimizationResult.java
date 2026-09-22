package org.divyesh.panchasara.control_system_optimizer.optimization;

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
 */
public record OptimizationResult(
		String optimizerType,
		double[] bestParameters,
		double bestCost,
		long evaluations,
		boolean feasible,
		boolean converged,
		Long seed) {
}