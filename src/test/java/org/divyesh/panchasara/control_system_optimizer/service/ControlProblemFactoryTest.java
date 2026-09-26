package org.divyesh.panchasara.control_system_optimizer.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.divyesh.panchasara.control_system_optimizer.analysis.PerformanceAnalyzer;
import org.divyesh.panchasara.control_system_optimizer.analysis.StabilityAnalyzer;
import org.divyesh.panchasara.control_system_optimizer.model.DynamicSystem;
import org.divyesh.panchasara.control_system_optimizer.optimization.Constraints;
import org.divyesh.panchasara.control_system_optimizer.optimization.EvaluationDetail;
import org.divyesh.panchasara.control_system_optimizer.optimization.ObjectiveFunction;
import org.divyesh.panchasara.control_system_optimizer.optimization.OptimizationProblem;
import org.divyesh.panchasara.control_system_optimizer.simulation.RungeKutta4Simulator;
import org.divyesh.panchasara.control_system_optimizer.simulation.SimulationSettings;
import org.divyesh.panchasara.control_system_optimizer.systems.SpringDamperSystem;
import org.junit.jupiter.api.Test;

/**
 * Covers how a candidate's constraint miss is quantified, which is what lets a
 * failed optimization report the candidate it came closest to.
 *
 * <p>The plant is a soft spring-damper (k=10) stepped to a reference of 1, so
 * without reference feedforward the proportional term leaves a standing error of
 * {@code kp/(k+kp)} that never enters the 2% settling band. That is what makes
 * the cases below distinguishable: a plain tracking candidate never settles, and
 * therefore fails any settling-time limit no matter how generous the limit is.
 */
class ControlProblemFactoryTest {

	private final ControlProblemFactory factory = new ControlProblemFactory(new StabilityAnalyzer(),
			new PerformanceAnalyzer(), new RungeKutta4Simulator());

	private static DynamicSystem system() {
		return new SpringDamperSystem(1.0, 0.5, 10.0);
	}

	private static SimulationSettings settings() {
		// rest at the origin, step the mass to a reference of 1, 10 s horizon
		return new SimulationSettings(new double[] { 0, 0 }, new double[] { 1, 0 }, 0.0, 10.0, 0.001);
	}

	/** Every stable candidate costs the same, so only the violation score can rank them. */
	private static ObjectiveFunction flatObjective() {
		return (trajectory, metrics) -> 1.0;
	}

	private EvaluationDetail detail(double[] gains, Constraints constraints, boolean feedforward) {
		OptimizationProblem problem = factory.createProblem(system(), true, feedforward, settings(), flatObjective(),
				constraints, new double[] { 0, 0 }, new double[] { 40, 20 }, new String[] { "kp", "kd" });
		return problem.evaluateDetail(gains);
	}

	private double controlEffortOf(double[] gains, Constraints constraints, boolean feedforward) {
		return factory.evaluateCandidate(system(), true, feedforward, settings(), flatObjective(), constraints, gains)
				.metrics()
				.controlEffort();
	}

	@Test
	void feasibleCandidateScoresNoViolation() {
		// feedforward cancels the static load, so the response settles and every
		// limit here is reachable
		Constraints generous = new Constraints(1e6, 1e6, 1e6, 1e6, 1e6);
		EvaluationDetail detail = detail(new double[] { 20.0, 10.5 }, generous, true);
		assertTrue(Double.isFinite(detail.cost()), "expected a settling response to be feasible");
		assertEquals(0.0, detail.violation(), 0.0);
	}

	@Test
	void violationIsTheRelativeOvershootOfTheFailedLimit() {
		double energyLimit = 700.0;
		// at these gains only the energy limit fails: overshoot, settling, peak
		// force and steady-state error all sit inside their limits
		Constraints constraints = new Constraints(50.0, 10.0, 5.0, 0.05, energyLimit);
		double[] gains = { 39.0, 10.5 };
		EvaluationDetail detail = detail(gains, constraints, true);
		assertEquals(Double.POSITIVE_INFINITY, detail.cost());

		double energy = controlEffortOf(gains, constraints, true);
		assertTrue(energy > energyLimit, "expected energy " + energy + " to exceed " + energyLimit);
		// a single failed limit, so the worst overshoot is exactly that limit's
		assertEquals(energy / energyLimit - 1.0,
				EvaluationDetail.worstRelativeOvershoot(detail.violation()), 1e-9);
	}

	@Test
	void worstMissDecidesRatherThanTheTotal() {
		// Two candidates, both unable to settle, trading a large miss on one limit
		// against a smaller one on another. The balanced candidate misses neither
		// limit by more than the other does, so it must win even though the
		// lopsided one has the smaller total.
		Constraints tightSteadyState = new Constraints(null, null, null, 0.25, 300.0);
		Constraints balanced = new Constraints(null, null, null, 0.4, 600.0);

		// a low proportional gain is cheap but stands off badly
		double lopsided = detail(new double[] { 8.0, 20.0 }, tightSteadyState, false).violation();
		// a mid gain is over on both, but never by as much as 8 is on error
		double even = detail(new double[] { 20.0, 20.0 }, balanced, false).violation();
		assertTrue(even < lopsided, "balanced " + even + " should beat lopsided " + lopsided);
	}

	@Test
	void theWorstMissDecidesNotTheCount() {
		double[] gains = { 39.0, 10.5 };
		// the same energy overshoot, once as the only failure and once alongside a
		// second, milder miss: the worst limit is what the score reports either way
		Constraints onlyEnergy = new Constraints(50.0, 10.0, 5.0, 0.05, 700.0);
		Constraints energyAndSettling = new Constraints(50.0, 10.0, 0.5, 0.05, 700.0);

		double single = EvaluationDetail.worstRelativeOvershoot(detail(gains, onlyEnergy, true).violation());
		double withSettling = EvaluationDetail.worstRelativeOvershoot(
				detail(gains, energyAndSettling, true).violation());
		assertTrue(single > 0.0 && single < EvaluationDetail.UNQUANTIFIED,
				"a measured miss should be quantified, was " + single);
		assertEquals(single, withSettling, 1e-9);
	}

	@Test
	void aMeasuredMissBeatsAnUnmeasurableOne() {
		// neither candidate settles without feedforward, so a settling limit is a
		// miss neither can be measured against; the other candidate at least fails
		// a limit it can quote a number for
		double unquantified = detail(new double[] { 20.0, 20.0 },
				new Constraints(null, null, 5.0, null, null), false).violation();
		double measured = detail(new double[] { 20.0, 20.0 },
				new Constraints(null, null, null, 0.05, null), false).violation();
		assertEquals(EvaluationDetail.UNQUANTIFIED, unquantified, 0.0);
		assertTrue(measured > 0.0 && measured < EvaluationDetail.UNQUANTIFIED,
				"expected a quantified miss, was " + measured);
		assertTrue(measured < unquantified, "measured " + measured + " should beat unmeasured " + unquantified);
	}

	@Test
	void responseThatNeverSettlesIsUnquantifiable() {
		// no feedforward, so the standing error keeps the response outside the
		// settling band: the limit fails with no achieved value to measure
		Constraints constraints = new Constraints(null, null, 5.0, null, null);
		EvaluationDetail detail = detail(new double[] { 10.0, 0.0 }, constraints, false);
		assertEquals(Double.POSITIVE_INFINITY, detail.cost());
		assertEquals(EvaluationDetail.UNQUANTIFIED, detail.violation(), 0.0);
	}

	@Test
	void standingErrorMakesSettlingUnsatisfiableHoweverLooseTheLimit() {
		// the standing error is kp/(k+kp), so the 2% band is out of reach for every
		// gain in range and the settling limit fails even at an absurd 1e9
		Constraints absurd = new Constraints(1e9, 1e9, 1e9, 1e9, 1e9);
		EvaluationDetail detail = detail(new double[] { 40.0, 20.0 }, absurd, false);
		assertEquals(Double.POSITIVE_INFINITY, detail.cost());
		assertEquals(EvaluationDetail.UNQUANTIFIED, detail.violation(), 0.0);
	}

	@Test
	void destabilizedGainRanksBelowAnyRespondingCandidate() {
		Constraints constraints = new Constraints(50.0, 10.0, 5.0, 0.05, 40.0);
		EvaluationDetail unstable = detail(new double[] { 0.0, -10.0 }, constraints, false);
		assertEquals(Double.POSITIVE_INFINITY, unstable.cost());
		assertEquals(EvaluationDetail.NO_DIAGNOSTICS, unstable.violation(), 0.0);
		assertNull(unstable.iae());
	}

	@Test
	void noEnforcedConstraintsStillQuantifyTheSearch() {
		// nothing to compare against, so any stable candidate is feasible outright
		EvaluationDetail detail = detail(new double[] { 20.0, 4.0 }, null, false);
		assertTrue(Double.isFinite(detail.cost()));
		assertEquals(0.0, detail.violation(), 0.0);
		assertNotNull(detail.iae());
	}
}
