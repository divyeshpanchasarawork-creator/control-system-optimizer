package org.divyesh.panchasara.control_system_optimizer.optimization;

/**
 * Configuration of the Differential Evolution optimizer (DE/rand/1/bin).
 *
 * @param populationSize    population size (defaults to a multiple of the
 *                          parameter dimension when 0)
 * @param maxIterations     maximum number of generations
 * @param differentialWeight the mutation scale factor F
 * @param crossoverRate     binomial crossover probability CR in [0,1]
 * @param seed              deterministic random seed; the same seed and problem
 *                          always produce the same result
 */
public record DifferentialEvolutionConfig(
		int populationSize,
		int maxIterations,
		double differentialWeight,
		double crossoverRate,
		long seed) {

	/** Hard upper bound on the population size (DoS guard). */
	public static final int MAX_POPULATION = 200;
	/** Hard upper bound on the generation count (DoS guard). */
	public static final int MAX_ITERATIONS = 3000;

	public DifferentialEvolutionConfig {
		if (populationSize != 0 && populationSize < 4) {
			throw new IllegalArgumentException("populationSize must be 0 (default) or >= 4");
		}
		if (populationSize > MAX_POPULATION) {
			throw new IllegalArgumentException("populationSize cannot exceed " + MAX_POPULATION);
		}
		if (maxIterations <= 0) {
			throw new IllegalArgumentException("maxIterations must be positive");
		}
		if (maxIterations > MAX_ITERATIONS) {
			throw new IllegalArgumentException("maxIterations cannot exceed " + MAX_ITERATIONS);
		}
		if (crossoverRate < 0.0 || crossoverRate > 1.0) {
			throw new IllegalArgumentException("crossoverRate must be in [0,1]");
		}
		if (!(differentialWeight > 0.0) || !Double.isFinite(differentialWeight)) {
			throw new IllegalArgumentException("differentialWeight must be a finite positive number");
		}
	}
}