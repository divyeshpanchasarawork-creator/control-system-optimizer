package org.divyesh.panchasara.control_system_optimizer.optimization;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.SplittableRandom;

/**
 * Differential Evolution (DE/rand/1/bin) continuous optimizer.
 *
 * <p>Infeasible candidates (returned by the problem as +INFINITY) never win a
 * replacement, but they do occupy population slots, so the search keeps moving.
 * All randomness comes from a single {@link SplittableRandom} fixed by the seed;
 * combined with the fixed iteration order and strict "&lt;" replacement rule,
 * identical (problem, bounds, config) inputs produce identical results. The best
 * cost after every generation is recorded as a convergence series.
 *
 * <p>A run that finds nothing feasible still reports the closest infeasible
 * candidate it evaluated, ranked by {@link EvaluationDetail#violation()}, because
 * every infeasible candidate shares the same +INFINITY cost and would otherwise be
 * impossible to order. Candidates are evaluated through
 * {@link OptimizationProblem#evaluateDetail(double[])}; the extra bookkeeping does
 * not add an evaluation, since the default implementation is the same call.
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
		double nearestCost = Double.POSITIVE_INFINITY;
		double nearestViolation = Double.POSITIVE_INFINITY;
		double[] nearestX = null;
		for (int i = 0; i < populationSize; i++) {
			for (int j = 0; j < d; j++) {
				population[i][j] = lower[j] + random.nextDouble() * (upper[j] - lower[j]);
			}
			EvaluationDetail detail = problem.evaluateDetail(population[i]);
			costs[i] = detail.cost();
			if (!Double.isFinite(detail.cost())
					&& EvaluationDetail.isCloserMiss(detail, nearestViolation, nearestCost)) {
				nearestViolation = detail.violation();
				nearestCost = detail.cost();
				nearestX = population[i].clone();
			}
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
		List<ConvergencePoint> convergence = new ArrayList<>();
		convergence.add(new ConvergencePoint(0, bestCost));

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

				EvaluationDetail detail = problem.evaluateDetail(trial);
				double trialCost = detail.cost();
				evaluations++;
				if (Double.isFinite(trialCost)) {
					if (trialCost < costs[i]) {
						System.arraycopy(trial, 0, population[i], 0, d);
						costs[i] = trialCost;
						if (trialCost < bestCost) {
							bestCost = trialCost;
							bestIndex = i;
						}
					}
				} else if (EvaluationDetail.isCloserMiss(detail, nearestViolation, nearestCost)) {
					nearestViolation = detail.violation();
					nearestCost = trialCost;
					nearestX = trial.clone();
				}
			}
			convergence.add(new ConvergencePoint(generation + 1, bestCost));
		}

		Map<String, Object> configMap = new LinkedHashMap<>();
		configMap.put("populationSize", populationSize);
		configMap.put("maxIterations", config.maxIterations());
		configMap.put("differentialWeight", f);
		configMap.put("crossoverRate", cr);
		configMap.put("seed", config.seed());

		boolean feasible = bestIndex >= 0 && Double.isFinite(bestCost);
		double[] bestX = feasible ? population[bestIndex].clone() : null;
		return new OptimizationResult(type(), bestX, bestCost, evaluations, feasible, converged(convergence),
				config.seed(), convergence, null, null, configMap, feasible ? null : nearestX);
	}

	/**
	 * True when the objective stopped improving meaningfully over the trailing
	 * stretch of the run: the relative drop from the start of the trailing window
	 * to the final record is below 1e-4. A run that ends still infeasible does
	 * not count as converged.
	 */
	private boolean converged(List<ConvergencePoint> convergence) {
		if (convergence.size() < 3) {
			return true;
		}
		int window = Math.max(1, convergence.size() / 5);
		// bestCost is nullable (sanitized to null when non-finite); an infeasible
		// start or end never counts as converged
		Double startValue = convergence.get(Math.max(0, convergence.size() - window - 1)).bestCost();
		Double endValue = convergence.getLast().bestCost();
		if (startValue == null || endValue == null) {
			return false;
		}
		double start = startValue;
		double end = endValue;
		double relativeImprovement = (start - end) / Math.max(1e-12, Math.abs(start));
		return relativeImprovement < 1e-4;
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