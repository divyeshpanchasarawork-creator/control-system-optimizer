package org.divyesh.panchasara.control_system_optimizer.optimization;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;

import org.divyesh.panchasara.control_system_optimizer.analysis.PerformanceMetrics;
import org.divyesh.panchasara.control_system_optimizer.simulation.Trajectory;
import org.divyesh.panchasara.control_system_optimizer.simulation.TrajectoryPoint;
import org.junit.jupiter.api.Test;

class WeightedControlObjectiveTest {

	private final WeightedControlObjective objective = new WeightedControlObjective(
			new ObjectiveWeights(1.0, 0.1, 0.5, 0.5));

	@Test
	void combinesMetricsLinearly() {
		var metrics = new PerformanceMetrics(0.1, 0.2, 3.0, 2.0, 10.0, 2.0, 4.0, 1.0);
		double expected = 1.0 * 3.0 + 0.1 * 4.0 + 0.5 * 2.0 + 0.5 * 10.0;
		assertEquals(expected, objective.evaluate(horizon(10, 0.01), metrics), 1e-9);
	}

	@Test
	void neverSettledPenalizedByHorizon() {
		var metrics = new PerformanceMetrics(0.1, 0.2, 3.0, 2.0, 10.0, Double.NaN, 4.0, 1.0);
		double expected = 1.0 * 3.0 + 0.1 * 4.0 + 0.5 * 10.0 + 0.5 * 10.0;
		assertEquals(expected, objective.evaluate(horizon(10, 0.01), metrics), 1e-9);
	}

	@Test
	void numericallyInvalidMetricsAreInfeasible() {
		var metrics = new PerformanceMetrics(0.1, 0.2, Double.NaN, 2.0, 10.0, 2.0, 4.0, 1.0);
		assertEquals(Double.POSITIVE_INFINITY, objective.evaluate(horizon(10, 0.01), metrics));
	}

	private Trajectory horizon(double endTime, double timeStep) {
		return new Trajectory(2, 1, List.of(
				new TrajectoryPoint(0.0, new double[] { 0, 0 }, new double[] { 0 }, new double[] { 1, 0 }),
				new TrajectoryPoint(endTime, new double[] { 1, 0 }, new double[] { 0 }, new double[] { 1, 0 })));
	}
}