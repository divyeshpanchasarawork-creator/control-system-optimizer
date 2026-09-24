package org.divyesh.panchasara.control_system_optimizer.optimization;

import org.divyesh.panchasara.control_system_optimizer.analysis.PerformanceMetrics;
import org.divyesh.panchasara.control_system_optimizer.simulation.Trajectory;

/**
 * Weighted combination of tracking quality, control effort, settling time and
 * overshoot:
 *
 * J = w1 * (IAE/ref1) + w2 * (U/ref2) + w3 * (Ts/ref3) + w4 * (O/ref4)
 *
 * With identity references (the default, no baseline provided) the terms are
 * just the raw metrics. With references from a baseline configuration every
 * term is dimensionless and 1.0 on a term means the candidate matches the
 * baseline on that metric, so weights express trade-offs in shared units.
 *
 * Because state feedback without feedforward leaves a steady-state offset, a
 * trajectory may legitimately never settle; its settling time is NaN and is
 * penalized as settling exactly at the simulation horizon. Only numerically
 * invalid trajectories (non-finite metrics) are treated as infeasible and map to
 * {@link Double#POSITIVE_INFINITY}, so NaN never leaks into the optimizer.
 */
public final class WeightedControlObjective implements ObjectiveFunction {

	private final ObjectiveWeights weights;
	private final MetricReference reference;

	public WeightedControlObjective(ObjectiveWeights weights) {
		this(weights, MetricReference.IDENTITY);
	}

	/**
	 * @param weights   the per-metric weights
	 * @param reference normalization references; use
	 *                  {@link MetricReference#IDENTITY} for an unnormalized objective
	 */
	public WeightedControlObjective(ObjectiveWeights weights, MetricReference reference) {
		this.weights = weights == null ? ObjectiveWeights.DEFAULT : weights;
		this.reference = reference == null ? MetricReference.IDENTITY : reference;
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
		ObjectiveTerm tracking = term(metrics.iae(), reference.iae(), weights.trackingErrorWeight());
		ObjectiveTerm effort = term(metrics.controlEffort(), reference.controlEffort(), weights.controlEffortWeight());
		ObjectiveTerm settle = term(settling, reference.settlingTime(), weights.settlingTimeWeight());
		ObjectiveTerm overshoot = term(metrics.overshoot(), reference.overshoot(), weights.overshootWeight());
		double total = tracking.contribution() + effort.contribution() + settle.contribution()
				+ overshoot.contribution();
		return new ObjectiveBreakdown(tracking, effort, settle, overshoot, !reference.isIdentity(), total);
	}

	private ObjectiveTerm term(double raw, double referenceValue, double weight) {
		double normalized = raw / referenceValue;
		return new ObjectiveTerm(raw, referenceValue, normalized, weight, weight * normalized);
	}

	ObjectiveWeights weights() {
		return weights;
	}
}