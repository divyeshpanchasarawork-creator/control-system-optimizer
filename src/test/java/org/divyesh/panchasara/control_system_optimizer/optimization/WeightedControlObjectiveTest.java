package org.divyesh.panchasara.control_system_optimizer.optimization;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

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

	@Test
	void breakdownSumsToObjective() {
		var metrics = new PerformanceMetrics(0.1, 0.2, 3.0, 2.0, 10.0, 2.0, 4.0, 1.0);
		ObjectiveBreakdown b = objective.breakdown(horizon(10, 0.01), metrics);
		assertFalse(b.normalized());
		assertEquals(1.0 * 3.0, b.trackingError().contribution(), 1e-9);
		assertEquals(0.1 * 4.0, b.controlEffort().contribution(), 1e-9);
		assertEquals(0.5 * 2.0, b.settlingTime().contribution(), 1e-9);
		assertEquals(0.5 * 10.0, b.overshoot().contribution(), 1e-9);
		assertEquals(b.trackingError().contribution() + b.controlEffort().contribution() + b.settlingTime().contribution()
				+ b.overshoot().contribution(), b.total(), 1e-9);
		assertEquals(objective.evaluate(horizon(10, 0.01), metrics), b.total(), 1e-9);
	}

	@Test
	void breakdownPenalizesUnsettledAtHorizon() {
		var metrics = new PerformanceMetrics(0.1, 0.2, 3.0, 2.0, 10.0, Double.NaN, 4.0, 1.0);
		ObjectiveBreakdown b = objective.breakdown(horizon(10, 0.01), metrics);
		assertEquals(0.5 * 10.0, b.settlingTime().contribution(), 1e-9);
	}

	@Test
	void breakdownIsNullForInvalidMetrics() {
		var metrics = new PerformanceMetrics(0.1, 0.2, Double.NaN, 2.0, 10.0, 2.0, 4.0, 1.0);
		assertEquals(null, objective.breakdown(horizon(10, 0.01), metrics));
	}

	@Test
	void normalizationDividesEachTermByItsReference() {
		WeightedControlObjective normalized = new WeightedControlObjective(
				new ObjectiveWeights(2.0, 0.5, 1.0, 3.0),
				new MetricReference(10.0, 5.0, 4.0, 20.0));
		var metrics = new PerformanceMetrics(0.1, 0.2, 6.0, 2.0, 8.0, 2.0, 4.0, 1.0); // IAE 6, U 4, Ts 2, O 8
		// normalized: 6/10, 4/5, 2/4, 8/20; weighted: 2*0.6 + 0.5*0.8 + 1*0.5 + 3*0.4
		double expected = 1.2 + 0.4 + 0.5 + 1.2;
		ObjectiveBreakdown b = normalized.breakdown(horizon(10, 0.01), metrics);
		assertTrue(b.normalized());
		assertEquals(0.6, b.trackingError().normalized(), 1e-9);
		assertEquals(10.0, b.trackingError().reference(), 1e-9);
		assertEquals(1.2, b.trackingError().contribution(), 1e-9);
		assertEquals(3.0, b.overshoot().weight(), 1e-9);
		assertEquals(expected, b.total(), 1e-9);
		assertEquals(expected, normalized.evaluate(horizon(10, 0.01), metrics), 1e-9);
	}

	private Trajectory horizon(double endTime, double timeStep) {
		return new Trajectory(2, 1, List.of(
				new TrajectoryPoint(0.0, new double[] { 0, 0 }, new double[] { 0 }, new double[] { 1, 0 }),
				new TrajectoryPoint(endTime, new double[] { 1, 0 }, new double[] { 0 }, new double[] { 1, 0 })));
	}
}