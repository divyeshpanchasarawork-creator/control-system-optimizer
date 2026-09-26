package org.divyesh.panchasara.control_system_optimizer.api.dto;

import java.util.List;

import org.divyesh.panchasara.control_system_optimizer.analysis.PerformanceMetrics;
import org.divyesh.panchasara.control_system_optimizer.analysis.SettlingBandResult;

/**
 * JSON-safe projection of {@link PerformanceMetrics}. Non-finite values are
 * mapped to {@code null} so that responses never emit NaN/Infinity in JSON.
 */
public record MetricsResponse(
		Double finalError,
		Double maxAbsError,
		Double iae,
		Double ise,
		Double overshoot,
		Double settlingTime,
		Double controlEffort,
		Double maxControl,
		List<SettlingBandDto> settlingTimeByBand,
		Double xSS,
		Double eSS) {

	public static MetricsResponse from(PerformanceMetrics m) {
		return from(m, List.of());
	}

	/**
	 * Builds a projection that also carries the settling time measured at several
	 * tolerance bands. Bands that never settle (or are undefined for a zero
	 * reference) map to {@code null}.
	 */
	public static MetricsResponse from(PerformanceMetrics m, List<SettlingBandResult> settlingBands) {
		return from(m, settlingBands, null, null);
	}

	/**
	 * @param xSS analytic steady-state position (nullable)
	 * @param eSS analytic steady-state tracking error magnitude (nullable)
	 */
	public static MetricsResponse from(PerformanceMetrics m, List<SettlingBandResult> settlingBands, Double xSS,
			Double eSS) {
		List<SettlingBandDto> bands = settlingBands.stream()
				.map(s -> new SettlingBandDto(s.bandPercent(), s.settled() ? finiteOrNull(s.settlingTime()) : null))
				.toList();
		return new MetricsResponse(
				finiteOrNull(m.finalError()),
				finiteOrNull(m.maxAbsError()),
				finiteOrNull(m.iae()),
				finiteOrNull(m.ise()),
				finiteOrNull(m.overshoot()),
				finiteOrNull(m.settlingTime()),
				finiteOrNull(m.controlEffort()),
				finiteOrNull(m.maxControl()),
				bands,
				finiteOrNull(xSS),
				finiteOrNull(eSS));
	}

	/**
	 * NaN and both infinities are not representable in JSON, so every numeric field
	 * passes through this guard before it reaches the response body.
	 */
	private static Double finiteOrNull(double value) {
		return Double.isFinite(value) ? value : null;
	}

	private static Double finiteOrNull(Double value) {
		return value != null && Double.isFinite(value) ? value : null;
	}
}