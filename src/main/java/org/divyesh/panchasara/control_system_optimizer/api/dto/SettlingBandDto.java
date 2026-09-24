package org.divyesh.panchasara.control_system_optimizer.api.dto;

/**
 * Settling time measured at one tolerance band, null-safe for JSON.
 *
 * @param bandPercent the settling tolerance band as a percentage of the
 *                    reference position (2, 5, 10, 50)
 * @param time        seconds to settle within that band, or {@code null} if the
 *                    response never settles (or the reference is zero)
 */
public record SettlingBandDto(int bandPercent, Double time) {
}