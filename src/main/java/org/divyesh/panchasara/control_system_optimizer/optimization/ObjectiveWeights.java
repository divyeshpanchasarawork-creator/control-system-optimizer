package org.divyesh.panchasara.control_system_optimizer.optimization;

/**
 * Tunable weights of the {@link WeightedControlObjective}.
 */
public record ObjectiveWeights(
		double trackingErrorWeight,
		double controlEffortWeight,
		double settlingTimeWeight,
		double overshootWeight) {

	public static final ObjectiveWeights DEFAULT =
			new ObjectiveWeights(1.0, 0.1, 0.5, 0.5);

	public ObjectiveWeights {
		if (!Double.isFinite(trackingErrorWeight) || !Double.isFinite(controlEffortWeight)
				|| !Double.isFinite(settlingTimeWeight) || !Double.isFinite(overshootWeight)) {
			throw new IllegalArgumentException("Objective weights must be finite");
		}
	}
}