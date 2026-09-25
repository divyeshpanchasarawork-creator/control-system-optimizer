package org.divyesh.panchasara.control_system_optimizer.optimization;

/**
 * Tunable weights of the {@link WeightedControlObjective}. The first four terms
 * map to IAE, control effort, settling time and overshoot; the optional fifth
 * ({@code steadyStateErrorWeight}) maps to the analytic steady-state tracking
 * error and is {@code null} when the term is disabled, so the default objective
 * is exactly the four-term weighted sum.
 */
public record ObjectiveWeights(
		double trackingErrorWeight,
		double controlEffortWeight,
		double settlingTimeWeight,
		double overshootWeight,
		Double steadyStateErrorWeight) {

	public static final ObjectiveWeights DEFAULT =
			new ObjectiveWeights(1.0, 0.1, 0.5, 0.5, null);

	public ObjectiveWeights(double trackingErrorWeight, double controlEffortWeight, double settlingTimeWeight,
			double overshootWeight) {
		this(trackingErrorWeight, controlEffortWeight, settlingTimeWeight, overshootWeight, null);
	}

	public ObjectiveWeights {
		if (!Double.isFinite(trackingErrorWeight) || !Double.isFinite(controlEffortWeight)
				|| !Double.isFinite(settlingTimeWeight) || !Double.isFinite(overshootWeight)
				|| (steadyStateErrorWeight != null && !Double.isFinite(steadyStateErrorWeight))) {
			throw new IllegalArgumentException("Objective weights must be finite (or null when disabled)");
		}
	}
}