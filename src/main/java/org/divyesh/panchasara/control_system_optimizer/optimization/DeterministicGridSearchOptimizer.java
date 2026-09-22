package org.divyesh.panchasara.control_system_optimizer.optimization;

/**
 * Deterministic full Cartesian scan over the bounded parameter space.
 *
 * The search visits every combination of equally-spaced samples; ties are
 * broken by retaining the first-found candidate and evaluations happen in a
 * fixed order, so the result is fully reproducible for identical inputs.
 */
public final class DeterministicGridSearchOptimizer implements Optimizer {

	private final GridSearchConfig config;

	public DeterministicGridSearchOptimizer(GridSearchConfig config) {
		this.config = config;
	}

	@Override
	public String type() {
		return "GRID_SEARCH";
	}

	@Override
	public OptimizationResult optimize(OptimizationProblem problem) {
		int d = problem.parameterNames().length;
		if (config.resolution().length != d) {
			throw new IllegalArgumentException(
					"Grid resolution has " + config.resolution().length + " dimensions but the problem has " + d);
		}
		double[] lower = problem.lowerBounds();
		double[] upper = problem.upperBounds();
		int[] res = config.resolution();

		double[] spacing = new double[d];
		long total = 1;
		for (int i = 0; i < d; i++) {
			spacing[i] = (upper[i] - lower[i]) / (res[i] - 1);
			total *= res[i];
		}

		int[] index = new int[d];
		double best = Double.POSITIVE_INFINITY;
		double[] bestX = null;
		long evaluations = 0;

		for (long step = 0; step < total; step++) {
			double[] x = new double[d];
			for (int i = 0; i < d; i++) {
				x[i] = lower[i] + index[i] * spacing[i];
			}
			evaluations++;
			double cost = problem.evaluate(x);
			if (bestX == null || cost < best) {
				best = cost;
				bestX = x.clone();
			}
			for (int i = 0; i < d; i++) {
				if (++index[i] < res[i]) {
					break;
				}
				index[i] = 0;
			}
		}

		boolean feasible = bestX != null && Double.isFinite(best);
		return new OptimizationResult(type(), feasible ? bestX : null, best, evaluations, feasible, true, null);
	}
}