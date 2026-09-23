package org.divyesh.panchasara.control_system_optimizer.optimization;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class DifferentialEvolutionOptimizerTest {

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
	void recordsConvergencePerGeneration() {
		var config = new DifferentialEvolutionConfig(40, 25, 0.5, 0.9, 42);
		OptimizationResult result = new DifferentialEvolutionOptimizer(config).optimize(quadratic());
		// initial best + one entry per generation
		org.junit.jupiter.api.Assertions.assertEquals(26, result.convergence().size());
		org.junit.jupiter.api.Assertions.assertEquals(0, result.convergence().getFirst().generation());
		org.junit.jupiter.api.Assertions.assertEquals(25, result.convergence().getLast().generation());
	}

	@Test
	void sameSeedProducesIdenticalResult() {
		var config = new DifferentialEvolutionConfig(40, 200, 0.5, 0.9, 42);
		OptimizationResult first = new DifferentialEvolutionOptimizer(config).optimize(quadratic());
		OptimizationResult second = new DifferentialEvolutionOptimizer(config).optimize(quadratic());
		assertArrayEquals(first.bestParameters(), second.bestParameters());
		assertTrue(first.bestCost() == second.bestCost());
	}

	@Test
	void neverLeavesBoundsEvenWithInfeasibleRegions() {
		var infeasible = new OptimizationProblem() {
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
				// infeasible when x < 0.2; otherwise a shallow valley near (1.5, 3)
				if (candidate[0] < 0.2) {
					return Double.POSITIVE_INFINITY;
				}
				double dx = candidate[0] - 1.5;
				double dy = candidate[1] - 3.0;
				return 0.01 * (dx * dx + dy * dy);
			}
		};
		OptimizationResult result = new DifferentialEvolutionOptimizer(
				new DifferentialEvolutionConfig(40, 200, 0.5, 0.9, 5)).optimize(infeasible);
		assertTrue(result.feasible());
		assertTrue(result.bestParameters()[0] >= 0.0 && result.bestParameters()[1] >= 0.0);
		assertTrue(result.bestParameters()[0] <= 2.0 && result.bestParameters()[1] <= 4.0);
	}

	@Test
	void convergesToKnownMinimum() {
		var config = new DifferentialEvolutionConfig(50, 500, 0.5, 0.9, 7);
		OptimizationResult result = new DifferentialEvolutionOptimizer(config).optimize(quadratic());
		assertTrue(result.feasible());
		assertTrue(result.bestCost() < 1e-3, "DE cost was " + result.bestCost());
		assertTrue(Math.abs(result.bestParameters()[0] - 1.0) < 0.05);
		assertTrue(Math.abs(result.bestParameters()[1] - 2.0) < 0.05);
	}
}