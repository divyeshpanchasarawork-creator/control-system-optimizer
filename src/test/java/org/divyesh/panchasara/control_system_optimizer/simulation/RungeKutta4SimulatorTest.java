package org.divyesh.panchasara.control_system_optimizer.simulation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;

import org.divyesh.panchasara.control_system_optimizer.control.StateFeedbackController;
import org.divyesh.panchasara.control_system_optimizer.model.DynamicSystem;
import org.divyesh.panchasara.control_system_optimizer.model.StateSpaceModel;
import org.divyesh.panchasara.control_system_optimizer.model.SystemType;
import org.divyesh.panchasara.control_system_optimizer.systems.SpringDamperSystem;
import org.apache.commons.math3.linear.Array2DRowRealMatrix;
import org.junit.jupiter.api.Test;

class RungeKutta4SimulatorTest {

	private final RungeKutta4Simulator simulator = new RungeKutta4Simulator();

	@Test
	void integratesScalarExponentialCorrectly() {
		DynamicSystem scalar = new DynamicSystem() {
			@Override
			public int dimension() {
				return 1;
			}

			@Override
			public SystemType systemType() {
				return SystemType.SPRING_DAMPER;
			}

			@Override
			public StateSpaceModel stateSpaceModel() {
				return StateSpaceModel.of(new Array2DRowRealMatrix(new double[][] { { 1 } }),
						new Array2DRowRealMatrix(new double[][] { { 0 } }));
			}

			@Override
			public double[] derivative(double time, double[] state, double[] control) {
				return new double[] { state[0] };
			}

			@Override
			public Map<String, Double> parameters() {
				return Map.of();
			}
		};

		Trajectory result = simulator.simulate(new SimulationSetup(scalar, null, new double[] { 1.0 },
				new double[] { 0.0 }, 0.0, 1.0, 0.001));
		assertEquals(2.71828, result.finalState()[0], 1e-4);
	}

	@Test
	void unstableOpenLoopBlowsUp() {
		DynamicSystem unstable = new DynamicSystem() {
			@Override
			public int dimension() {
				return 1;
			}

			@Override
			public SystemType systemType() {
				return SystemType.SPRING_DAMPER;
			}

			@Override
			public StateSpaceModel stateSpaceModel() {
				return StateSpaceModel.of(new Array2DRowRealMatrix(new double[][] { { 0.5 } }),
						new Array2DRowRealMatrix(new double[][] { { 0 } }));
			}

			@Override
			public double[] derivative(double time, double[] state, double[] control) {
				return new double[] { 0.5 * state[0] };
			}

			@Override
			public Map<String, Double> parameters() {
				return Map.of();
			}
		};
		Trajectory result = simulator.simulate(new SimulationSetup(unstable, null, new double[] { 1 },
				new double[] { 0 }, 0.0, 5.0, 0.01));
		assertTrue(result.finalState()[0] > 5.0);
	}

	@Test
	void feedbackRegulatesToOrigin() {
		var system = new SpringDamperSystem(1.0, 0.5, 10.0);
		var controller = StateFeedbackController.of(new double[] { 10, 5 }, true);
		Trajectory result = simulator.simulate(new SimulationSetup(system, controller, new double[] { 1, 0 },
				new double[] { 0, 0 }, 0.0, 10.0, 0.01));
		assertEquals(0.0, result.finalState()[0], 5e-3);
		assertEquals(0.0, result.finalState()[1], 5e-3);
	}

	@Test
	void respectsRequestedTimestepAndHorizon() {
		var system = new SpringDamperSystem(1.0, 0.5, 10.0);
		Trajectory result = simulator.simulate(new SimulationSetup(system, null,
				new double[] { 0, 0 }, new double[] { 0, 0 }, 0.0, 1.0, 0.25));
		assertEquals(5, result.points().size());
		assertEquals(1.0, result.endTime(), 1e-9);
	}
}