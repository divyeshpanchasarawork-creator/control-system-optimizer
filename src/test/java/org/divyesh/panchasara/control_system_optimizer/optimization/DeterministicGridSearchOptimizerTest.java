package org.divyesh.panchasara.control_system_optimizer.optimization;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class DeterministicGridSearchOptimizerTest {

	private OptimizationProblem quadratic() {
		return new OptimizationProblem() {
			@Override
			public String[] parameterNames() {
				return new String[] { "x", "y" };
			}

			@Override
			public double[] lowerBounds() {
				return new double[] { 0, 0 };
			}

			@Override
			public double[] upperBounds() {
				return new double[] { 2, 4 };
			}

			@Override
			public double evaluate(double[] candidate) {
				double dx = candidate[0] - 1.0;
				double dy = candidate[1] - 2.0;
				return dx * dx + dy * dy;
			}
		};
	}

	@Test
	void findsKnownMinimumOnGrid() {
		// Grid 3 x 5 contains the minimum (1,2) exactly.
		DeterministicGridSearchOptimizer optimizer =
				new DeterministicGridSearchOptimizer(new GridSearchConfig(new int[] { 3, 5 }));
		OptimizationResult result = optimizer.optimize(quadratic());

		assertTrue(result.feasible());
		assertEquals(0.0, result.bestCost(), 1e-12);
		assertArrayEquals(new double[] { 1.0, 2.0 }, result.bestParameters(), 1e-12);
		assertEquals(15, result.evaluations());
	}

	@Test
	void isDeterministic() {
		var config = new GridSearchConfig(new int[] { 10, 10 });
		OptimizationResult first = new DeterministicGridSearchOptimizer(config).optimize(quadratic());
		OptimizationResult second = new DeterministicGridSearchOptimizer(config).optimize(quadratic());
		assertArrayEquals(first.bestParameters(), second.bestParameters());
		assertEquals(first.bestCost(), second.bestCost(), 0.0);
	}

	@Test
	void optionalCostSurfaceIsReturnedFor2D() {
		OptimizationResult result = new DeterministicGridSearchOptimizer(
				new GridSearchConfig(new int[] { 3, 5 }, true)).optimize(quadratic());
		Double[][] surface = result.costSurface();
		assertNotNull(surface);
		assertEquals(3, surface.length);
		assertEquals(5, surface[0].length);
		// minimum (1,2) sits at index (1,2) with cost 0
		assertEquals(0.0, surface[1][2], 1e-12);
	}

	@Test
	void infeasibleSpaceReportedAsInfeasible() {
		OptimizationResult result = new DeterministicGridSearchOptimizer(
				new GridSearchConfig(new int[] { 3 })).optimize(neverFeasible());
		assertFalse(result.feasible());
	}

	@Test
	void nearestMissIsTheClosestCandidateNotTheFirstVisited() {
		// grid over [0,1] with 5 points: 0, 0.25, 0.5, 0.75, 1.0
		OptimizationResult result = new DeterministicGridSearchOptimizer(
				new GridSearchConfig(new int[] { 5 })).optimize(missesBestAt(0.8));
		assertFalse(result.feasible());
		assertNull(result.bestParameters());
		assertNotNull(result.nearestMiss());
		// 0.75 misses by 0.05, closer than the first-visited 0.0 (0.8) or 1.0 (0.2)
		assertArrayEquals(new double[] { 0.75 }, result.nearestMiss(), 1e-12);
	}

	@Test
	void nearestMissIsAbsentWhenSomethingIsFeasible() {
		OptimizationResult result = new DeterministicGridSearchOptimizer(
				new GridSearchConfig(new int[] { 3, 5 })).optimize(quadratic());
		assertTrue(result.feasible());
		assertNull(result.nearestMiss());
	}

	@Test
	void problemWithoutDetailKeepsTheFirstInfeasibleCandidate() {
		// The default bridge cannot quantify a miss, so it must not invent an
		// ordering: every candidate ties and the first one visited is retained.
		OptimizationResult first = new DeterministicGridSearchOptimizer(
				new GridSearchConfig(new int[] { 3 })).optimize(neverFeasible());
		OptimizationResult second = new DeterministicGridSearchOptimizer(
				new GridSearchConfig(new int[] { 3 })).optimize(neverFeasible());
		assertArrayEquals(new double[] { 0.0 }, first.nearestMiss(), 1e-12);
		assertArrayEquals(first.nearestMiss(), second.nearestMiss());
	}

	/** Nothing is ever feasible. */
	private OptimizationProblem neverFeasible() {
		return new OptimizationProblem() {
			@Override
			public String[] parameterNames() {
				return new String[] { "x" };
			}

			@Override
			public double[] lowerBounds() {
				return new double[] { 0 };
			}

			@Override
			public double[] upperBounds() {
				return new double[] { 1 };
			}

			@Override
			public double evaluate(double[] candidate) {
				return Double.POSITIVE_INFINITY;
			}
		};
	}

	/**
	 * Every candidate is infeasible with an identical cost, so only the violation
	 * score can order them: the closest one to {@code target} is the near miss.
	 */
	private OptimizationProblem missesBestAt(double target) {
		return new OptimizationProblem() {
			@Override
			public String[] parameterNames() {
				return new String[] { "x" };
			}

			@Override
			public double[] lowerBounds() {
				return new double[] { 0 };
			}

			@Override
			public double[] upperBounds() {
				return new double[] { 1 };
			}

			@Override
			public double evaluate(double[] candidate) {
				return Double.POSITIVE_INFINITY;
			}

			@Override
			public EvaluationDetail evaluateDetail(double[] candidate) {
				return new EvaluationDetail(Double.POSITIVE_INFINITY, null, null, Math.abs(candidate[0] - target));
			}
		};
	}
}