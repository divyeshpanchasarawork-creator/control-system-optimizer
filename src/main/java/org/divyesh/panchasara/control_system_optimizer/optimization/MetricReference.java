package org.divyesh.panchasara.control_system_optimizer.optimization;

/**
 * Per-metric reference values used to normalize the objective terms:
 *
 * J = w1 * (IAE / ref_iae) + w2 * (U / ref_U) + w3 * (Ts / ref_Ts) + w4 * (O / ref_O)
 *
 * References come from a baseline configuration (typically the user's manual
 * gain), so every term is dimensionless. A value of 1.0 on a term means that
 * candidate exactly matches the baseline on that metric. Zero or non-finite
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

	public boolean isIdentity() {
		return this.equals(IDENTITY);
	}

	private static double guard(double value) {
		return Double.isFinite(value) && Math.abs(value) > 1e-9 ? Math.abs(value) : 1.0;
	}
}