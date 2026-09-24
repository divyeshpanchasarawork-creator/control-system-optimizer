package org.divyesh.panchasara.control_system_optimizer.verification;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
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
 * Cross-cutting numerical checks: RK4 convergence with the step size, metric
 * agreement between the direct simulation path and the optimization scoring
 * path, and agreement between the two optimizer families.
 */
@TestInstance(Lifecycle.PER_CLASS)
class VerificationServiceTest {

	private final VerificationService service = new VerificationService(
			new RungeKutta4Simulator(),
			new PerformanceAnalyzer(),
			new StabilityAnalyzer(),
			new ControlProblemFactory(new StabilityAnalyzer(), new PerformanceAnalyzer(), new RungeKutta4Simulator()),
			new ControlProperties(null, null, null));

	private VerificationReport cachedReport;

	private VerificationReport report() {
		if (cachedReport == null) {
			cachedReport = service.run();
		}
		return cachedReport;
	}

	@Test
	void wholeReportPasses() {
		VerificationReport report = report();
		assertEquals("PASS", report.status(), report.toString());
	}

	@Test
	void metricsConvergeAsTheStepShrinks() {
		VerificationReport report = report();
		assertTrue(report.convergence().size() >= 3);
		for (ConvergenceCheck check : report.convergence()) {
			assertTrue(check.passed(), check::toString);
			assertTrue(check.relativeDifference() <= 1e-2,
					() -> check.name() + " drifts " + check.relativeDifference());
		}
		// IAE and control effort are integrals over the same response; the coarse
		// step must not be meaningfully smaller than the fine one.
		assertTrue(fine("IAE", report) <= coarse("IAE", report) * 1.001);
	}

	@Test
	void simulationAndOptimizationPathsAgree() {
		VerificationReport report = report();
		for (ConsistencyCheck check : report.consistency()) {
			assertTrue(check.passed(), check::toString);
		}
	}

	@Test
	void bothOptimizersAreFeasibleReproducibleAndClose() {
		VerificationReport report = report();
		assertNotNull(report.crossValidation());
		assertEquals(2, report.crossValidation().size());
		for (CrossValidationCheck check : report.crossValidation()) {
			assertTrue(check.passed(), check::toString);
			assertEquals(check.bestCost(), check.reproducedCost(), 1e-6);
		}
	}

	private static double coarse(String name, VerificationReport report) {
		return report.convergence().stream().filter(c -> c.name().equals(name)).findFirst().orElseThrow()
				.coarseValue();
	}

	private static double fine(String name, VerificationReport report) {
		return report.convergence().stream().filter(c -> c.name().equals(name)).findFirst().orElseThrow()
				.fineValue();
	}
}