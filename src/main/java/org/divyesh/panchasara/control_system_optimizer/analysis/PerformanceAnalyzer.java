package org.divyesh.panchasara.control_system_optimizer.analysis;

import java.util.List;

import org.divyesh.panchasara.control_system_optimizer.simulation.Trajectory;
import org.divyesh.panchasara.control_system_optimizer.simulation.TrajectoryPoint;
import org.springframework.stereotype.Component;

/**
 * Computes {@link PerformanceMetrics} from a simulated trajectory.
 *
 * <p>All definitions are documented on {@link PerformanceMetrics}; integrals are
 * evaluated with the trapezoid rule over the recorded samples. Overshoot is
 * computed from the first state only (position for the spring-damper system);
 * for a zero reference it is defined as 0.0 because a percentage is undefined.
 */
@Component
public final class PerformanceAnalyzer {

	private static final double SETTLING_BAND = 0.02; // 2% of reference norm

	public PerformanceMetrics analyze(Trajectory trajectory) {
		List<TrajectoryPoint> points = trajectory.points();
		int n = points.size();

		double referenceNorm0 = norm(points.getFirst().reference());
		double settlingBand = SETTLING_BAND * referenceNorm0;
		int lastViolation = -1;

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
			double eNorm = norm(errorOf(p));
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

		double finalError = norm(errorOf(points.getLast()));

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

	private double[] errorOf(TrajectoryPoint p) {
		double[] e = new double[p.state().length];
		for (int j = 0; j < p.state().length; j++) {
			e[j] = p.state()[j] - p.reference()[j];
		}
		return e;
	}

	private double norm(double[] v) {
		double sum = 0.0;
		for (double d : v) {
			sum += d * d;
		}
		return Math.sqrt(sum);
	}
}