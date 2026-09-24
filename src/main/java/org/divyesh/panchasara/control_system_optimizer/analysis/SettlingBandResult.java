package org.divyesh.panchasara.control_system_optimizer.analysis;

/**
 * Settling time measured at a single tolerance band.
 *
 * @param bandPercent  the settling tolerance band as a percentage of the
 *                     reference position (e.g. 5 for a 5% band)
 * @param settlingTime seconds to settle within that band, or
 *                     {@link Double#NaN} if the response never settles; NaN also
 *                     when the reference is zero and a band is undefined
 */
public record SettlingBandResult(int bandPercent, double settlingTime) {

	/** True when the response settled within this band. */
	public boolean settled() {
		return Double.isFinite(settlingTime);
	}
}