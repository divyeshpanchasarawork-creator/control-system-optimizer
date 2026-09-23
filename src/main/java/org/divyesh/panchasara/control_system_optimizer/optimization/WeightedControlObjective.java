package org.divyesh.panchasara.control_system_optimizer.optimization;

import org.divyesh.panchasara.control_system_optimizer.analysis.PerformanceMetrics;
import org.divyesh.panchasara.control_system_optimizer.simulation.Trajectory;

/**
 * Weighted combination of tracking quality, control effort, settling time and
 * overshoot:
 *
 * J = w1*IAE + w2*controlEffort + w3*settlingTime + w4*overshoot
 *
 * Because state feedback without feedforward leaves a steady-state offset, a
 * trajectory may legitimately never settle; its settling time is NaN and is
 * penalized as settling exactly at the simulation horizon. Only numerically
 * invalid trajectories (non-finite metrics) are treated as infeasible and map to
 * {@link Double#POSITIVE_INFINITY}, so NaN never leaks into the optimizer.
 */
public final class WeightedControlObjective implements ObjectiveFunction {

	private final ObjectiveWeights weights;

	public WeightedControlObjective(ObjectiveWeights weights) {
		this.weights = weights == null ? ObjectiveWeights.DEFAULT : weights;
	}

	@Override
	public double evaluate(Trajectory trajectory, PerformanceMetrics metrics) {
		ObjectiveBreakdown b = breakdown(trajectory, metrics);
		return b == null ? Double.POSITIVE_INFINITY : b.total();
	}

	/**
	 * The per-term contributions of the objective, mirroring {@link #evaluate}.
	 * Returns {@code null} for numerically invalid metrics (they evaluate to
	 * {@link Double#POSITIVE_INFINITY}).
	 */
	public ObjectiveBreakdown breakdown(Trajectory trajectory, PerformanceMetrics metrics) {
		if (metrics == null || metrics.hasInvalidNumerics()) {
			return null;
		}
		double settling = Double.isFinite(metrics.settlingTime())
				? metrics.settlingTime()
				: trajectory.endTime();
		double tracking = weights.trackingErrorWeight() * metrics.iae();
		double effort = weights.controlEffortWeight() * metrics.controlEffort();
		double settle = weights.settlingTimeWeight() * settling;
		double overshoot = weights.overshootWeight() * metrics.overshoot();
		return new ObjectiveBreakdown(tracking, effort, settle, overshoot, tracking + effort + settle + overshoot);
	}
}