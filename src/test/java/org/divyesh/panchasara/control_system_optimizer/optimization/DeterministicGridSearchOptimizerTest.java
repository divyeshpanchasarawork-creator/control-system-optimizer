package org.divyesh.panchasara.control_system_optimizer.optimization;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
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
	void infeasibleSpaceReportedAsInfeasible() {
		OptimizationProblem neverFeasible = new OptimizationProblem() {
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
		OptimizationResult result = new DeterministicGridSearchOptimizer(
				new GridSearchConfig(new int[] { 3 })).optimize(neverFeasible);
		assertFalse(result.feasible());
	}
}