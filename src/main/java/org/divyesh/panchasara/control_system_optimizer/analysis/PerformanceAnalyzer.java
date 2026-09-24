package org.divyesh.panchasara.control_system_optimizer.analysis;

import java.util.ArrayList;
import java.util.List;

import org.divyesh.panchasara.control_system_optimizer.simulation.Trajectory;
import org.divyesh.panchasara.control_system_optimizer.simulation.TrajectoryPoint;
import org.springframework.stereotype.Component;

/**
 * Computes {@link PerformanceMetrics} from a simulated trajectory.
 *
 * <p>All tracking quantities use the scalar position error e(t) = x1(t) - r1(t)
 * (the first state is position for the spring-damper system), so metrics carry
 * position units and never mix in velocity. Integrals are evaluated with the
 * trapezoid rule over the recorded samples. Overshoot is computed from the
 * first state only; for a zero reference it is defined as 0.0 because a
 * percentage is undefined. Settling time can also be reported at several
 * tolerance bands in a single pass (see {@link #settlingBands}).
 */
@Component
public final class PerformanceAnalyzer {

	private static final double DEFAULT_SETTLING_BAND = 0.02; // 2% of reference position

	/** Band percentages surfaced to the UI so measured settling is visible at once. */
	public static final int[] DISPLAY_BANDS_PERCENT = { 2, 5, 10, 50 };

	public PerformanceMetrics analyze(Trajectory trajectory) {
		return analyze(trajectory, DEFAULT_SETTLING_BAND);
	}

	/**
	 * Time-domain analysis with an explicit settling tolerance band.
	 *
	 * @param trajectory            the simulated trajectory
	 * @param settlingBandFraction  settling tolerance as a fraction of the
	 *                              reference position (0.02 = 2%); the smaller the
	 *                              fraction the stricter the definition of settled
	 */
	public PerformanceMetrics analyze(Trajectory trajectory, double settlingBandFraction) {
		List<TrajectoryPoint> points = trajectory.points();
		int n = points.size();

		double referenceNorm0 = Math.abs(positionOf(points.getFirst().reference()));
		double settlingBand = settlingBandFraction * referenceNorm0;
		int lastViolation = -1;

		double finalError = Math.abs(positionErrorOf(points.get(n - 1)));

		double maxAbsError = 0.0;
		double iae = 0.0;
		double ise = 0.0;
		double controlEffort = 0.0;
		double maxControl = 0.0;
		double prevT = points.getFirst().time();
		double prevError = 0.0;
		double prevControl = 0.0;

		for (int i = 0; i < n; i++) {
			TrajectoryPoint p = points.get(i);
			double eNorm = Math.abs(positionErrorOf(p));
			double uNorm = norm(p.control());

			maxAbsError = Math.max(maxAbsError, eNorm);
			maxControl = Math.max(maxControl, uNorm);

			if (i > 0) {
				double dt = p.time() - prevT;
				iae += 0.5 * dt * (eNorm + prevError);
				ise += 0.5 * dt * (eNorm * eNorm + prevError * prevError);
				controlEffort += 0.5 * dt * (uNorm * uNorm + prevControl * prevControl);
			}

			if (settlingBand > 0.0 && eNorm > settlingBand) {
				lastViolation = i;
			}

			prevT = p.time();
			prevError = eNorm;
			prevControl = uNorm;
		}

		double maxPos = Double.NEGATIVE_INFINITY;
		for (TrajectoryPoint p : points) {
			maxPos = Math.max(maxPos, p.state()[0]);
		}
		double overshoot = 0.0;
		if (referenceNorm0 > 0.0) {
			double referenceFirst = points.getFirst().reference()[0];
			overshoot = Math.max(0.0, (maxPos - referenceFirst) / Math.abs(referenceFirst) * 100.0);
		}

		double settlingTime = Double.NaN;
		if (settlingBand > 0.0) {
			if (lastViolation < 0) {
				settlingTime = points.getFirst().time();
			} else if (lastViolation + 1 < n) {
				settlingTime = points.get(lastViolation + 1).time();
			}
		}

		return new PerformanceMetrics(finalError, maxAbsError, iae, ise, overshoot, settlingTime,
				controlEffort, maxControl);
	}

	/**
	 * Settling time at each requested band (percentage of the reference position),
	 * computed in a single pass over the trajectory. Uses the same first-violation
	 * rule as {@link #analyze}; a time of {@link Double#NaN} means the response
	 * never settled within that band, and a zero reference yields NaN everywhere.
	 *
	 * @param trajectory  the simulated trajectory
	 * @param bandPercents the settling band percentages to report (e.g. 2, 5, 10)
	 */
	public List<SettlingBandResult> settlingBands(Trajectory trajectory, int... bandPercents) {
		if (bandPercents == null || bandPercents.length == 0) {
			return List.of();
		}
		List<TrajectoryPoint> points = trajectory.points();
		int n = points.size();
		double referenceNorm0 = Math.abs(positionOf(points.getFirst().reference()));

		int[] lastViolation = new int[bandPercents.length];
		java.util.Arrays.fill(lastViolation, -1);
		for (int i = 0; i < n; i++) {
			double eNorm = Math.abs(positionErrorOf(points.get(i)));
			for (int b = 0; b < bandPercents.length; b++) {
				double band = (bandPercents[b] / 100.0) * referenceNorm0;
				if (band > 0.0 && eNorm > band) {
					lastViolation[b] = i;
				}
			}
		}

		List<SettlingBandResult> results = new ArrayList<>(bandPercents.length);
		for (int b = 0; b < bandPercents.length; b++) {
			double band = (bandPercents[b] / 100.0) * referenceNorm0;
			double settlingTime = Double.NaN;
			if (band > 0.0) {
				if (lastViolation[b] < 0) {
					settlingTime = points.getFirst().time();
				} else if (lastViolation[b] + 1 < n) {
					settlingTime = points.get(lastViolation[b] + 1).time();
				}
			}
			results.add(new SettlingBandResult(bandPercents[b], settlingTime));
		}
		return results;
	}

	private static double positionOf(double[] state) {
		return state == null || state.length == 0 ? 0.0 : state[0];
	}

	private static double positionErrorOf(TrajectoryPoint p) {
		return positionOf(p.state()) - positionOf(p.reference());
	}

	private double norm(double[] v) {
		double sum = 0.0;
		for (double d : v) {
			sum += d * d;
		}
		return Math.sqrt(sum);
	}
}