package org.divyesh.panchasara.control_system_optimizer.analysis;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;

import org.divyesh.panchasara.control_system_optimizer.simulation.Trajectory;
import org.divyesh.panchasara.control_system_optimizer.simulation.TrajectoryPoint;
import org.junit.jupiter.api.Test;

class PerformanceAnalyzerTest {

	private final PerformanceAnalyzer analyzer = new PerformanceAnalyzer();

	@Test
	void computesMetricsOnSyntheticTrajectory() {
		// reference r = [1,0]; error magnitudes 0.3, 0.05, 0.01, 0.01 at t = 0..3
		Trajectory trajectory = trajectory(new double[][] {
				{ 0.0, 1.3, 0 },
				{ 1.0, 1.05, 0 },
				{ 2.0, 1.01, 0 },
				{ 3.0, 1.01, 0 }
		}, new double[] { 1.0, 0.0 });

		PerformanceMetrics m = analyzer.analyze(trajectory);

		assertEquals(0.01, m.finalError(), 1e-9);
		assertEquals(0.3, m.maxAbsError(), 1e-9);
		assertEquals(0.215, m.iae(), 1e-9);
		assertEquals(0.04765, m.ise(), 1e-9);
		assertEquals(30.0, m.overshoot(), 1e-9);
		assertEquals(2.0, m.settlingTime(), 1e-9); // settles after last 2% violation at t=1
		assertEquals(0.0, m.controlEffort(), 1e-9);
		assertEquals(0.0, m.maxControl(), 1e-9);
	}

	@Test
	void neverSettledYieldsNaN() {
		// error stays above the 2% band on every sample
		Trajectory trajectory = trajectory(new double[][] {
				{ 0.0, 1.8, 0 },
				{ 1.0, 1.8, 0 },
				{ 2.0, 1.8, 0 }
		}, new double[] { 1.0, 0.0 });

		PerformanceMetrics m = analyzer.analyze(trajectory);
		assertTrue(Double.isNaN(m.settlingTime()));
	}

	@Test
	void zeroReferenceGivesDefinedOvershoot() {
		Trajectory trajectory = trajectory(new double[][] {
				{ 0.0, 0.5, 0 },
				{ 1.0, 0.2, 0 },
				{ 2.0, 0.0, 0 }
		}, new double[] { 0.0, 0.0 });

		PerformanceMetrics m = analyzer.analyze(trajectory);
		assertEquals(0.0, m.overshoot(), 1e-9);
		assertTrue(Double.isNaN(m.settlingTime())); // zero reference has no 2% band
	}

	@Test
	void measuresControlEffort() {
		Trajectory trajectory = trajectory(new double[][] {
				{ 0.0, 0, 1 },
				{ 1.0, 0, 2 },
				{ 2.0, 0, 4 }
		}, new double[] { 0.0, 0.0 });

		PerformanceMetrics m = analyzer.analyze(trajectory);
		assertEquals(12.5, m.controlEffort(), 1e-9);
		assertEquals(4.0, m.maxControl(), 1e-9);
	}

	@Test
	void defaultBandMatchesExplicitTwoPercent() {
		Trajectory trajectory = trajectory(new double[][] {
				{ 0.0, 1.3, 0 },
				{ 1.0, 1.05, 0 },
				{ 2.0, 1.01, 0 },
				{ 3.0, 1.01, 0 }
		}, new double[] { 1.0, 0.0 });
		assertEquals(analyzer.analyze(trajectory), analyzer.analyze(trajectory, 0.02));
	}

	@Test
	void settlingBandsReportsMultipleBandsInOnePass() {
		// position errors 1.0, 0.4, 0.08, 0.08 against reference [1,0]
		Trajectory trajectory = trajectory(new double[][] {
				{ 0.0, 2.0, 0 },
				{ 1.0, 1.4, 0 },
				{ 2.0, 1.08, 0 },
				{ 3.0, 1.08, 0 }
		}, new double[] { 1.0, 0.0 });

		List<SettlingBandResult> bands = analyzer.settlingBands(trajectory, 2, 5, 10, 50);

		assertEquals(4, bands.size());
		assertEquals(2, bands.get(0).bandPercent());
		assertTrue(Double.isNaN(bands.get(0).settlingTime())); // 0.08 stays above the 2% band
		assertEquals(5, bands.get(1).bandPercent());
		assertTrue(Double.isNaN(bands.get(1).settlingTime())); // 0.08 stays above the 5% band
		assertEquals(10, bands.get(2).bandPercent());
		assertEquals(2.0, bands.get(2).settlingTime(), 1e-9); // only the first two samples violate
		assertEquals(50, bands.get(3).bandPercent());
		assertEquals(1.0, bands.get(3).settlingTime(), 1e-9); // only the first sample violates
	}

	@Test
	void settlingBandsAreUndefinedForZeroReference() {
		Trajectory trajectory = trajectory(new double[][] {
				{ 0.0, 0.5, 0 },
				{ 1.0, 0.2, 0 }
		}, new double[] { 0.0, 0.0 });

		List<SettlingBandResult> bands = analyzer.settlingBands(trajectory, 2, 5, 10, 50);
		for (SettlingBandResult band : bands) {
			assertTrue(Double.isNaN(band.settlingTime()));
		}
	}

	@Test
	void widerBandReportsEarlierOrEqualSettling() {
		Trajectory trajectory = trajectory(new double[][] {
				{ 0.0, 1.3, 0 },
				{ 1.0, 1.05, 0 },
				{ 2.0, 1.01, 0 },
				{ 3.0, 1.01, 0 }
		}, new double[] { 1.0, 0.0 });

		PerformanceMetrics twoPercent = analyzer.analyze(trajectory, 0.02);
		PerformanceMetrics tenPercent = analyzer.analyze(trajectory, 0.10);

		// with a 10% band the t=1 sample (5% error) never counts as a violation,
		// so settling moves to t=1
		assertEquals(1.0, tenPercent.settlingTime(), 1e-9);
		assertTrue(tenPercent.settlingTime() <= twoPercent.settlingTime());
	}

	private Trajectory trajectory(double[][] samples, double[] reference) {
		List<TrajectoryPoint> points = java.util.Arrays.stream(samples)
				.map(s -> new TrajectoryPoint(s[0], new double[] { s[1], 0.0 }, new double[] { s[2] }, reference))
				.toList();
		return new Trajectory(2, 1, points);
	}
}