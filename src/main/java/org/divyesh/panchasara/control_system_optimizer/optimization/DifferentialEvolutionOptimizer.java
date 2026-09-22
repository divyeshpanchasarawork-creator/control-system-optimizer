package org.divyesh.panchasara.control_system_optimizer.optimization;

import java.util.SplittableRandom;

/**
 * Differential Evolution (DE/rand/1/bin) continuous optimizer.
 *
 * <p>Infeasible candidates (returned by the problem as +INFINITY) never win a
 * replacement, but they do occupy population slots, so the search keeps moving.
 * All randomness comes from a single {@link SplittableRandom} fixed by the seed;
 * combined with the fixed iteration order and strict "&lt;" replacement rule,
 * identical (problem, bounds, config) inputs produce identical results.
 */
public final class DifferentialEvolutionOptimizer implements Optimizer {

	private static final int POPULATION_SCALE = 20;

	private final DifferentialEvolutionConfig config;

	public DifferentialEvolutionOptimizer(DifferentialEvolutionConfig config) {
		this.config = config;
	}

	@Override
	public String type() {
		return "DIFFERENTIAL_EVOLUTION";
	}

	@Override
	public OptimizationResult optimize(OptimizationProblem problem) {
		int d = problem.parameterNames().length;
		double[] lower = problem.lowerBounds();
		double[] upper = problem.upperBounds();

		int populationSize = config.populationSize() > 0 ? config.populationSize() : POPULATION_SCALE * d;
		SplittableRandom random = new SplittableRandom(config.seed());
		double f = config.differentialWeight();
		double cr = config.crossoverRate();

		double[][] population = new double[populationSize][d];
		double[] costs = new double[populationSize];
		for (int i = 0; i < populationSize; i++) {
			for (int j = 0; j < d; j++) {
				population[i][j] = lower[j] + random.nextDouble() * (upper[j] - lower[j]);
			}
			costs[i] = problem.evaluate(population[i]);
		}

		long evaluations = populationSize;
		double bestCost = Double.POSITIVE_INFINITY;
		int bestIndex = -1;
		for (int i = 0; i < populationSize; i++) {
			if (costs[i] < bestCost) {
				bestCost = costs[i];
				bestIndex = i;
			}
		}

		double[] trial = new double[d];

		for (int generation = 0; generation < config.maxIterations(); generation++) {
			for (int i = 0; i < populationSize; i++) {
				int a = distinctIndex(i, -1, -1, random, populationSize);
				int b = distinctIndex(i, a, -1, random, populationSize);
				int c = distinctIndex(i, a, b, random, populationSize);

				int jRandom = random.nextInt(d);
				for (int j = 0; j < d; j++) {
					if (j == jRandom || random.nextDouble() < cr) {
						double value = population[a][j] + f * (population[b][j] - population[c][j]);
						trial[j] = clamp(value, lower[j], upper[j]);
					} else {
						trial[j] = population[i][j];
					}
				}

				double trialCost = problem.evaluate(trial);
				evaluations++;
				if (trialCost < costs[i]) {
					System.arraycopy(trial, 0, population[i], 0, d);
					costs[i] = trialCost;
					if (trialCost < bestCost) {
						bestCost = trialCost;
						bestIndex = i;
					}
				}
			}
		}

		boolean feasible = bestIndex >= 0 && Double.isFinite(bestCost);
		double[] bestX = feasible ? population[bestIndex].clone() : null;
		return new OptimizationResult(type(), bestX, bestCost, evaluations, feasible, true, config.seed());
	}

	/** Picks a population index distinct from i, a and b (pass -1 to ignore). */
	private int distinctIndex(int i, int a, int b, SplittableRandom random, int size) {
		int candidate;
		do {
			candidate = random.nextInt(size);
		} while (candidate == i || candidate == a || candidate == b);
		return candidate;
	}

	private double clamp(double value, double lower, double upper) {
		if (Double.isNaN(value)) {
			return lower;
		}
		return Math.max(lower, Math.min(upper, value));
	}
}