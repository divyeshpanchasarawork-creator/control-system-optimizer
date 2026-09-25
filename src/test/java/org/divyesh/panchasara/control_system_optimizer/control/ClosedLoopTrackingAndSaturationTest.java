package org.divyesh.panchasara.control_system_optimizer.control;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.divyesh.panchasara.control_system_optimizer.analysis.SteadyStateResolver;
import org.divyesh.panchasara.control_system_optimizer.simulation.RungeKutta4Simulator;
import org.divyesh.panchasara.control_system_optimizer.simulation.SimulationSetup;
import org.divyesh.panchasara.control_system_optimizer.simulation.Trajectory;
import org.divyesh.panchasara.control_system_optimizer.simulation.TrajectoryPoint;
import org.divyesh.panchasara.control_system_optimizer.systems.SpringDamperSystem;
import org.junit.jupiter.api.Test;

/**
 * Closed-loop checks for the tracking feature set: the analytic steady-state
 * offset matches a full RK4 simulation, feedforward tracking cancels the
 * spring load, and a bounded actuator saturation is respected by the
 * integrator.
 */
class ClosedLoopTrackingAndSaturationTest {

	private final RungeKutta4Simulator simulator = new RungeKutta4Simulator();

	private static final double[] GAINS = { 10, 5 };
	private static final SpringDamperSystem PLANT = new SpringDamperSystem(1.0, 0.5, 10.0);
	private static final double[] REFERENCE = { 1.0, 0.0 };
	private static final double[] ORIGIN = new double[] { 0.0, 0.0 };

	@Test
	void pdTrackingOffsetMatchesAnalyticSteadyState() {
		// u = -K(x - r) leaves a static offset: x_ss = Kp*r1/(k+Kp) = 10/20 = 0.5
		var controller = StateFeedbackController.of(GAINS, true);
		Trajectory trajectory = simulator
				.simulate(new SimulationSetup(PLANT, controller, ORIGIN, REFERENCE, 0.0, 30.0, 0.01));
		assertEquals(0.5, trajectory.finalState()[0], 5e-3);
		double finalError = Math.abs(REFERENCE[0] - trajectory.finalState()[0]);
		assertEquals(0.5, finalError, 5e-3);
		assertEquals(SteadyStateResolver.resolve(GAINS, 10.0, 1.0, true, false).eSS(), finalError, 5e-3);
	}

	@Test
	void feedforwardTrackingDrivesOffsetToZero() {
		// u = -K(x - r) + k*r1 cancels the spring's static load: x_ss -> r1 = 1
		var controller = StateFeedbackController.of(GAINS, true, 10.0);
		Trajectory trajectory = simulator
				.simulate(new SimulationSetup(PLANT, controller, ORIGIN, REFERENCE, 0.0, 20.0, 0.01));
		assertEquals(1.0, trajectory.finalState()[0], 2e-3);
		double finalError = Math.abs(REFERENCE[0] - trajectory.finalState()[0]);
		assertEquals(SteadyStateResolver.resolve(GAINS, 10.0, 1.0, true, true).eSS(), finalError, 2e-3);
	}

	@Test
	void saturationClampsActuatorOutput() {
		double saturation = 0.2;
		var controller = StateFeedbackController.of(GAINS, true, 10.0);
		Trajectory trajectory = simulator.simulate(new SimulationSetup(PLANT, controller, ORIGIN, REFERENCE, 0.0, 8.0,
				0.005, saturation));

		for (TrajectoryPoint point : trajectory.points()) {
			for (double u : point.control()) {
				assertTrue(Math.abs(u) <= saturation + 1e-9);
			}
		}
	}
}
