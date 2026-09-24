package org.divyesh.panchasara.control_system_optimizer.optimization;

/**
 * The four per-metric contributions that sum to the objective cost J. Each term
 * carries raw, normalized and weighted views so a UI can show exactly why one
 * gain beats another:
 *
 * <pre>
 *   normalizedᵢ = rawᵢ / referenceᵢ     (reference is 1.0 when unnormalized)
 *   contributionᵢ = weightᵢ * normalizedᵢ
 *   J = Σ contributionᵢ
 * </pre>
 *
 * @param normalized true when the terms were normalized against a baseline
 *                   configuration's metrics (non-identity references)
 */
public record ObjectiveBreakdown(
		ObjectiveTerm trackingError,
		ObjectiveTerm controlEffort,
		ObjectiveTerm settlingTime,
		ObjectiveTerm overshoot,
		boolean normalized,
		double total) {

	/** Convenience: whether the normalized value on a term is larger than 1 (worse than baseline). */
	public boolean anyWorseThanBaseline() {
		return exceeds(trackingError) || exceeds(controlEffort) || exceeds(settlingTime) || exceeds(overshoot);
	}

	private static boolean exceeds(ObjectiveTerm term) {
		return term.normalized() > 1.0 + 1e-9;
	}
}