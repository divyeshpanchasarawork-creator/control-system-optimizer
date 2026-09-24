package org.divyesh.panchasara.control_system_optimizer.api.dto;

import java.util.List;

import org.divyesh.panchasara.control_system_optimizer.analysis.PerformanceMetrics;
import org.divyesh.panchasara.control_system_optimizer.analysis.SettlingBandResult;

/**
 * JSON-safe projection of {@link PerformanceMetrics}. Non-finite values are
 * mapped to {@code null} so that responses never emit NaN/Infinity in JSON.
 */
public record MetricsResponse(
		double finalError,
		double maxAbsError,
		double iae,
		double ise,
		double overshoot,
		Double settlingTime,
		double controlEffort,
		double maxControl,
		List<SettlingBandDto> settlingTimeByBand) {

	public static MetricsResponse from(PerformanceMetrics m) {
		return from(m, List.of());
	}

	/**
	 * Builds a projection that also carries the settling time measured at several
	 * tolerance bands. Bands that never settle (or are undefined for a zero
	 * reference) map to {@code null}.
	 */
	public static MetricsResponse from(PerformanceMetrics m, List<SettlingBandResult> settlingBands) {
		List<SettlingBandDto> bands = settlingBands.stream()
				.map(s -> new SettlingBandDto(s.bandPercent(), s.settled() ? s.settlingTime() : null))
				.toList();
		return new MetricsResponse(
				m.finalError(),
				m.maxAbsError(),
				m.iae(),
				m.ise(),
				m.overshoot(),
				Double.isFinite(m.settlingTime()) ? m.settlingTime() : null,
				m.controlEffort(),
				m.maxControl(),
				bands);
	}
}