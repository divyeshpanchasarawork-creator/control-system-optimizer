package org.divyesh.panchasara.control_system_optimizer.api.dto;

/**
 * Optimizer selection.
 *
 * @param type               "GRID_SEARCH" or "DIFFERENTIAL_EVOLUTION"
 * @param resolution         grid steps per dimension (grid search only)
 * @param populationSize     DE population (0 = scale by dimension)
 * @param maxIterations      DE generations
 * @param differentialWeight DE mutation factor F
 * @param crossoverRate      DE crossover probability CR
 * @param seed               DE random seed (deterministic; defaults to the
 *                           framework default when absent)
 */
public record OptimizerSpec(
		String type,
		int[] resolution,
		Integer populationSize,
		Integer maxIterations,
		Double differentialWeight,
		Double crossoverRate,
		Long seed) {

	public OptimizerSpec {
		if (type == null || type.isBlank()) {
			type = "GRID_SEARCH";
		}
	}
}