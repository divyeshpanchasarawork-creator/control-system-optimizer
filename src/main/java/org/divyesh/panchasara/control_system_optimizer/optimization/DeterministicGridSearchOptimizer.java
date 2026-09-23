package org.divyesh.panchasara.control_system_optimizer.optimization;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Deterministic full Cartesian scan over the bounded parameter space.
 *
 * <p>The search visits every combination of equally-spaced samples in a fixed
 * order; ties are broken by retaining the first-found candidate, so the result
 * is fully reproducible for identical inputs. When requested, the whole
 * evaluation grid is also recorded as a cost surface (2-D problems only).
 */
public final class DeterministicGridSearchOptimizer implements Optimizer {

	private static final double MILESTONE_FRACTION = 0.02; // sample ~50 checkpoints

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

		int milestoneInterval = (int) Math.max(1L, Math.round(total * MILESTONE_FRACTION));
		List<ConvergencePoint> convergence = new ArrayList<>();
		Double[][] costSurface = config.includeCostSurface()
				? new Double[res[0]][res[1]]
				: null;
		Double[][] iaeSurface = config.includeCostSurface() ? new Double[res[0]][res[1]] : null;
		Double[][] effortSurface = config.includeCostSurface() ? new Double[res[0]][res[1]] : null;

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
			EvaluationDetail detail = problem.evaluateDetail(x);
			double cost = detail.cost();
			if (costSurface != null) {
				costSurface[index[0]][index[1]] = Double.isFinite(cost) ? cost : null;
				iaeSurface[index[0]][index[1]] = Double.isFinite(cost) ? detail.iae() : null;
				effortSurface[index[0]][index[1]] = Double.isFinite(cost) ? detail.controlEffort() : null;
			}
			if (bestX == null || cost < best) {
				best = cost;
				bestX = x.clone();
			}
			if (evaluations % milestoneInterval == 0) {
				convergence.add(new ConvergencePoint((int) (evaluations / milestoneInterval), best));
			}
			for (int i = 0; i < d; i++) {
				if (++index[i] < res[i]) {
					break;
				}
				index[i] = 0;
			}
		}
		convergence.add(new ConvergencePoint(convergence.isEmpty() ? 0 : convergence.getLast().generation() + 1, best));

		Map<String, Object> configMap = new LinkedHashMap<>();
		configMap.put("resolution", res.clone());
		configMap.put("includeCostSurface", config.includeCostSurface());

		boolean feasible = bestX != null && Double.isFinite(best);
		MetricSurfaces metricSurfaces = costSurface == null ? null
				: new MetricSurfaces(iaeSurface, effortSurface);
		return new OptimizationResult(type(), feasible ? bestX : null, best, evaluations, feasible, true, null,
				convergence, costSurface, metricSurfaces, configMap);
	}
}