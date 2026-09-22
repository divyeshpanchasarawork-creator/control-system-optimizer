package org.divyesh.panchasara.control_system_optimizer.service;

import org.divyesh.panchasara.control_system_optimizer.analysis.PerformanceAnalyzer;
import org.divyesh.panchasara.control_system_optimizer.analysis.PerformanceMetrics;
import org.divyesh.panchasara.control_system_optimizer.analysis.StabilityAnalyzer;
import org.divyesh.panchasara.control_system_optimizer.analysis.StabilityResult;
import org.divyesh.panchasara.control_system_optimizer.control.ClosedLoopSystem;
import org.divyesh.panchasara.control_system_optimizer.control.StateFeedbackController;
import org.divyesh.panchasara.control_system_optimizer.model.DynamicSystem;
import org.divyesh.panchasara.control_system_optimizer.optimization.ObjectiveFunction;
import org.divyesh.panchasara.control_system_optimizer.optimization.OptimizationProblem;
import org.divyesh.panchasara.control_system_optimizer.simulation.RungeKutta4Simulator;
import org.divyesh.panchasara.control_system_optimizer.simulation.SimulationSettings;
import org.divyesh.panchasara.control_system_optimizer.simulation.SimulationSetup;
import org.divyesh.panchasara.control_system_optimizer.simulation.Trajectory;
import org.springframework.stereotype.Component;

/**
 * Builds {@link OptimizationProblem}s for state-feedback gain vectors. This is
 * the single place where a concrete system, controller, simulator, stability
 * check and objective are combined — the optimizers themselves stay generic.
 */
@Component
public final class ControlProblemFactory {

	private final StabilityAnalyzer stabilityAnalyzer;
	private final PerformanceAnalyzer performanceAnalyzer;
	private final RungeKutta4Simulator simulator;

	public ControlProblemFactory(StabilityAnalyzer stabilityAnalyzer, PerformanceAnalyzer performanceAnalyzer,
			RungeKutta4Simulator simulator) {
		this.stabilityAnalyzer = stabilityAnalyzer;
		this.performanceAnalyzer = performanceAnalyzer;
		this.simulator = simulator;
	}

	/**
	 * Creates a problem whose decision variables are the state-feedback gains.
	 * A candidate gain vector K maps to u = -K(x - r) (or u = -Kx when tracking
	 * is false); candidates that destabilize the closed loop or produce invalid
	 * simulations receive +INFINITY.
	 */
	public OptimizationProblem createProblem(DynamicSystem system, boolean tracking, SimulationSettings simulation,
			ObjectiveFunction objective, double[] lowerBounds, double[] upperBounds, String[] parameterNames) {
		return new OptimizationProblem() {
			@Override
			public String[] parameterNames() {
				return parameterNames;
			}

			@Override
			public double[] lowerBounds() {
				return lowerBounds;
			}

			@Override
			public double[] upperBounds() {
				return upperBounds;
			}

			@Override
			public double evaluate(double[] candidate) {
				return evaluateCandidate(system, tracking, simulation, objective, candidate).cost();
			}
		};
	}

	/**
	 * Full evaluation of a candidate, including stability and metrics. Used to
	 * build the diagnostic payload of an optimization response.
	 */
	public DetailedEvaluation evaluateCandidate(DynamicSystem system, boolean tracking, SimulationSettings simulation,
			ObjectiveFunction objective, double[] gains) {
		if (gains == null || gains.length != system.dimension()) {
			return DetailedEvaluation.infeasible();
		}
		try {
			StateFeedbackController controller = StateFeedbackController.of(gains, tracking);
			ClosedLoopSystem closedLoop = ClosedLoopSystem.of(system, controller);
			StabilityResult stability = stabilityAnalyzer.analyze(closedLoop.acl());
			if (!stability.stable()) {
				return new DetailedEvaluation(controller, stability, null, null, Double.POSITIVE_INFINITY);
			}
			SimulationSetup setup = new SimulationSetup(system, controller, simulation.initialState(),
					simulation.reference(), simulation.startTime(), simulation.endTime(), simulation.timeStep());
			Trajectory trajectory = simulator.simulate(setup);
			PerformanceMetrics metrics = performanceAnalyzer.analyze(trajectory);
			double cost = objective.evaluate(trajectory, metrics);
			if (Double.isNaN(cost) || cost == Double.NEGATIVE_INFINITY) {
				return new DetailedEvaluation(controller, stability, metrics, trajectory, Double.POSITIVE_INFINITY);
			}
			return new DetailedEvaluation(controller, stability, metrics, trajectory, cost);
		} catch (RuntimeException e) {
			return DetailedEvaluation.infeasible();
		}
	}

	/**
	 * Diagnostic record of a single candidate evaluation.
	 */
	public static final class DetailedEvaluation {
		final StateFeedbackController controller;
		final StabilityResult stability;
		final PerformanceMetrics metrics;
		final Trajectory trajectory;
		final double cost;

		private DetailedEvaluation(StateFeedbackController controller, StabilityResult stability,
				PerformanceMetrics metrics, Trajectory trajectory, double cost) {
			this.controller = controller;
			this.stability = stability;
			this.metrics = metrics;
			this.trajectory = trajectory;
			this.cost = cost;
		}

		static DetailedEvaluation infeasible() {
			return new DetailedEvaluation(null, null, null, null, Double.POSITIVE_INFINITY);
		}

		public boolean feasible() {
			return controller != null && Double.isFinite(cost);
		}

		public double[] gains() {
			return controller == null ? null : controller.gainMatrix().getRow(0);
		}

		public StabilityResult stability() {
			return stability;
		}

		public PerformanceMetrics metrics() {
			return metrics;
		}

		public Trajectory trajectory() {
			return trajectory;
		}

		public double cost() {
			return cost;
		}
	}
}