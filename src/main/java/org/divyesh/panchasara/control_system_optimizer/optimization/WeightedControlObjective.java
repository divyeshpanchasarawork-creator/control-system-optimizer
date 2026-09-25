package org.divyesh.panchasara.control_system_optimizer.optimization;

import org.divyesh.panchasara.control_system_optimizer.analysis.PerformanceMetrics;
import org.divyesh.panchasara.control_system_optimizer.simulation.Trajectory;

/**
 * Weighted combination of tracking quality, control effort, settling time,
 * overshoot and an optional analytic steady-state error:
 *
 * J = w1 * (IAE/ref1) + w2 * (U/ref2) + w3 * (Ts/ref3) + w4 * (O/ref4) [+ w5 * (e_ss/ref5)]
 *
 * With {@link MetricReference#IDENTITY} references (the raw form) the first four
 * terms are the unnormalized metrics. With fixed scales from
 * {@link MetricReference#fixed} every term is dimensionless, trade-offs are
 * expressed in shared units and the objective is deterministic across runs. The
 * steady-state term is only active when its weight is non-null <i>and</i> an
 * analytic steady-state error is available (state tracking without feedforward,
 * or feedforward where it evaluates to ~0).
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
	private final double steadyStateErrorScale;

	public WeightedControlObjective(ObjectiveWeights weights) {
		this(weights, MetricReference.IDENTITY, 1.0);
	}

	/**
	 * @param weights   the per-metric weights
	 * @param reference normalization references; use
	 *                  {@link MetricReference#IDENTITY} for an unnormalized objective
	 */
	public WeightedControlObjective(ObjectiveWeights weights, MetricReference reference) {
		this(weights, reference, 1.0);
	}

	/**
	 * @param steadyStateErrorScale fixed positive scale for the steady-state-error
	 *                              term (typically the reference magnitude |r1|)
	 */
	public WeightedControlObjective(ObjectiveWeights weights, MetricReference reference,
			double steadyStateErrorScale) {
		this.weights = weights == null ? ObjectiveWeights.DEFAULT : weights;
		this.reference = reference == null ? MetricReference.IDENTITY : reference;
		this.steadyStateErrorScale = Double.isFinite(steadyStateErrorScale) && steadyStateErrorScale > 0.0
				? steadyStateErrorScale
				: 1.0;
	}

	@Override
	public double evaluate(Trajectory trajectory, PerformanceMetrics metrics) {
		return evaluate(trajectory, metrics, null);
	}

	@Override
	public double evaluate(Trajectory trajectory, PerformanceMetrics metrics, Double steadyStateError) {
		ObjectiveBreakdown b = breakdown(trajectory, metrics, steadyStateError);
		return b == null ? Double.POSITIVE_INFINITY : b.total();
	}

	/**
	 * The per-term contributions of the objective, mirroring {@link #evaluate}.
	 * Returns {@code null} for numerically invalid metrics (they evaluate to
	 * {@link Double#POSITIVE_INFINITY}). Without a steady-state error the
	 * optional fifth term is omitted.
	 */
	public ObjectiveBreakdown breakdown(Trajectory trajectory, PerformanceMetrics metrics) {
		return breakdown(trajectory, metrics, null);
	}

	/**
	 * @param steadyStateError analytic steady-state tracking error magnitude, or
	 *                         {@code null} when undefined / not applicable
	 */
	public ObjectiveBreakdown breakdown(Trajectory trajectory, PerformanceMetrics metrics, Double steadyStateError) {
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
		ObjectiveTerm steadyState = null;
		Double steadyStateWeight = weights.steadyStateErrorWeight();
		if (steadyStateWeight != null && Double.isFinite(steadyStateError)) {
			steadyState = term(steadyStateError, steadyStateErrorScale, steadyStateWeight);
			total += steadyState.contribution();
		}
		return new ObjectiveBreakdown(tracking, effort, settle, overshoot, steadyState, !reference.isIdentity(), total);
	}

	private ObjectiveTerm term(double raw, double referenceValue, double weight) {
		double normalized = raw / referenceValue;
		return new ObjectiveTerm(raw, referenceValue, normalized, weight, weight * normalized);
	}

	ObjectiveWeights weights() {
		return weights;
	}

	double steadyStateErrorScale() {
		return steadyStateErrorScale;
	}
}