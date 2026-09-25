package org.divyesh.panchasara.control_system_optimizer.optimization;

/**
 * Per-metric reference values used to normalize the objective terms:
 *
 * J = w1 * (IAE / ref_iae) + w2 * (U / ref_U) + w3 * (Ts / ref_Ts) + w4 * (O / ref_O)
 *
 * References come from fixed positive scales derived a priori from the problem
 * (reference magnitude, plant stiffness and the simulation horizon), so every
 * term is dimensionless and the objective is deterministic — it does not depend
 * on which baseline gain the user happens to enter. A value of 1.0 on a term
 * means the candidate's metric matches that fixed scale. Zero or non-finite
 * references fall back to 1.0 to keep the division safe.
 */
public record MetricReference(double iae, double controlEffort, double settlingTime, double overshoot) {

	/** Identity reference: each metric is divided by 1, i.e. an unnormalized objective. */
	public static final MetricReference IDENTITY = new MetricReference(1.0, 1.0, 1.0, 1.0);

	public MetricReference {
		iae = guard(iae);
		controlEffort = guard(controlEffort);
		settlingTime = guard(settlingTime);
		overshoot = guard(overshoot);
	}

	/**
	 * Fixed positive scales derived from the reference position {@code r1}, the
	 * plant stiffness {@code k} and the simulation horizon:
	 *
	 * <pre>
	 *   IAE scale   = |r1|                       * T
	 *   U scale     = (k * |r1|)^2               * T   (spring force at reference * horizon)
	 *   Ts scale    = T
	 *   O scale     = 100 (percent)
	 * </pre>
	 *
	 * Each scale is guarded to a positive value (falls back to 1.0 for a zero or
	 * non-finite reference/horizon).
	 *
	 * @param springConstant  the plant stiffness {@code k}
	 * @param referencePosition the reference position {@code r1}
	 * @param endTime         simulation end time
	 * @param startTime       simulation start time
	 */
	public static MetricReference fixed(double springConstant, double referencePosition, double endTime,
			double startTime) {
		double horizon = Math.max(endTime - startTime, 1e-9);
		double r = Math.abs(referencePosition);
		double forceScale = Math.abs(springConstant * referencePosition);
		return new MetricReference(
				r * horizon,
				forceScale * forceScale * horizon,
				horizon,
				100.0);
	}

	public boolean isIdentity() {
		return this.equals(IDENTITY);
	}

	private static double guard(double value) {
		return Double.isFinite(value) && Math.abs(value) > 1e-9 ? Math.abs(value) : 1.0;
	}
}