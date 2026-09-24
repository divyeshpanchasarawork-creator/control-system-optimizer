package org.divyesh.panchasara.control_system_optimizer.verification;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.divyesh.panchasara.control_system_optimizer.analysis.PerformanceAnalyzer;
import org.divyesh.panchasara.control_system_optimizer.analysis.StabilityAnalyzer;
import org.divyesh.panchasara.control_system_optimizer.config.ControlProperties;
import org.divyesh.panchasara.control_system_optimizer.service.ControlProblemFactory;
import org.divyesh.panchasara.control_system_optimizer.simulation.RungeKutta4Simulator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.TestInstance.Lifecycle;

/**
 * Locks the three golden configurations to the closed-form values from the
 * numerical-correctness spec. Exercises the exact same pipeline the app uses:
 * A_cl = A - BK, the shared eigenvalue analyzer, RK4 at dt = 0.01 and the
 * scalar position-error metrics.
 */
@TestInstance(Lifecycle.PER_CLASS)
class GoldenSystemTest {

	private final VerificationService service = new VerificationService(
			new RungeKutta4Simulator(),
			new PerformanceAnalyzer(),
			new StabilityAnalyzer(),
			new ControlProblemFactory(new StabilityAnalyzer(), new PerformanceAnalyzer(), new RungeKutta4Simulator()),
			new ControlProperties(null, null, null));

	private VerificationReport cachedReport;

	@Test
	void golden1OpenLoopPolesMatchClosedForm() {
		GoldenCaseResult r = caseResult("golden-1");
		// m=1 c=0.5 k=2, K=[0,0]: sigma = c/2m = 0.25, wn = sqrt(k/m) = sqrt(2)
		assertPoles(r, -0.25, 1.3919, 1.4142, 0.1768);
		assertEquals(16.0, r.settlingEstimateSeconds(), 1e-3);
		assertTrue(r.analyzerStable());
		assertEquals(0.0, r.idealPosition(), 1e-3);
		assertEquals(1.0, r.steadyStateError(), 1e-3);
		assertEquals(0.0, r.analyticControlAtZero(), 1e-3);
		assertEquals(0.0, r.measuredControlAtZero(), 1e-3);
		assertEquals(1.0, r.simulatedFinalError(), 1e-3);
		assertEquals(1.0, r.simulatedMaxAbsError(), 1e-6);
	}

	@Test
	void golden2TrackingSteadyStateAndPolesMatchClosedForm() {
		GoldenCaseResult r = caseResult("golden-2");
		// m=1 c=0.5 k=2, K=[10,5]: sigma = (c+Kd)/2m = 2.75, wn = sqrt((k+Kp)/m) = sqrt(12)
		assertPoles(r, -2.75, 2.1065, 3.4641, 0.7939);
		assertEquals(4.0 / 2.75, r.settlingEstimateSeconds(), 1e-3);
		assertTrue(r.analyzerStable());
		assertEquals(10.0 / 12.0, r.idealPosition(), 1e-3);
		assertEquals(2.0 / 12.0, r.steadyStateError(), 1e-3);
		assertEquals(10.0, r.analyticControlAtZero(), 1e-3);
		assertEquals(10.0, r.measuredControlAtZero(), 1e-3);
		assertEquals(2.0 / 12.0, r.simulatedFinalError(), 2e-3);
		assertEquals(1.0, r.simulatedMaxAbsError(), 1e-6);
	}

	@Test
	void golden3HeavierPlantMatchesClosedForm() {
		GoldenCaseResult r = caseResult("golden-3");
		// m=5 c=2 k=10, Kp=8.8889 Kd=14.1414: sigma = (2+14.1414)/10 = 1.6141
		// wn = sqrt(18.8889/5) = sqrt(3.7778) = 1.9437
		assertPoles(r, -1.6141, 1.0835, 1.9437, 0.8303);
		assertTrue(r.analyzerStable());
		assertEquals(8.8889 / 18.8889, r.idealPosition(), 1e-3);
		assertEquals(10.0 / 18.8889, r.steadyStateError(), 1e-3);
		assertEquals(8.8889, r.analyticControlAtZero(), 1e-3);
		assertEquals(8.8889, r.measuredControlAtZero(), 1e-3);
		assertEquals(10.0 / 18.8889, r.simulatedFinalError(), 2e-3);
		assertEquals(1.0, r.simulatedMaxAbsError(), 1e-6);
	}

	@Test
	void everyGoldenCaseReportsPass() {
		for (GoldenCaseResult r : service().goldenCases()) {
			assertTrue(r.passed(), r.id() + " should pass its analytic checks: " + r);
		}
	}

	private GoldenCaseResult caseResult(String id) {
		return service().goldenCases().stream()
				.filter(r -> r.id().equals(id))
				.findFirst()
				.orElseThrow();
	}

	private VerificationReport service() {
		if (cachedReport == null) {
			cachedReport = service.run();
		}
		return cachedReport;
	}

	private static void assertPoles(GoldenCaseResult r, double poleRe, double poleIm, double omegaN, double zeta) {
		assertEquals(poleRe, r.poleRe(), 1e-3);
		assertEquals(poleIm, r.poleIm(), 1e-3);
		assertEquals(omegaN, r.omegaN(), 1e-3);
		assertEquals(zeta, r.zeta(), 1e-3);
	}
}