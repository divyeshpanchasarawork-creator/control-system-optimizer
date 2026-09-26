package org.divyesh.panchasara.control_system_optimizer.optimization;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
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

	@Test
	void nearestMissIsTheClosestCandidateNotTheFirstVisited() {
		OptimizationResult result = new DifferentialEvolutionOptimizer(
				new DifferentialEvolutionConfig(60, 120, 0.5, 0.9, 11)).optimize(missesBestAt(0.8));
		assertFalse(result.feasible());
		assertNull(result.bestParameters());
		assertNotNull(result.nearestMiss());
		// 60 x 120 samples crowd far closer to the target than any arbitrary pick
		assertEquals(0.8, result.nearestMiss()[0], 1e-2);
	}

	@Test
	void nearestMissIsAbsentWhenSomethingIsFeasible() {
		OptimizationResult result = new DifferentialEvolutionOptimizer(
				new DifferentialEvolutionConfig(50, 200, 0.5, 0.9, 7)).optimize(quadratic());
		assertTrue(result.feasible());
		assertNull(result.nearestMiss());
	}

	@Test
	void nearestMissIsReproducibleForTheSameSeed() {
		var config = new DifferentialEvolutionConfig(60, 120, 0.5, 0.9, 11);
		OptimizationResult first = new DifferentialEvolutionOptimizer(config).optimize(missesBestAt(0.8));
		OptimizationResult second = new DifferentialEvolutionOptimizer(config).optimize(missesBestAt(0.8));
		assertArrayEquals(first.nearestMiss(), second.nearestMiss());
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