package org.divyesh.panchasara.control_system_optimizer.service;

import org.divyesh.panchasara.control_system_optimizer.analysis.PerformanceAnalyzer;
import org.divyesh.panchasara.control_system_optimizer.analysis.PerformanceMetrics;
import org.divyesh.panchasara.control_system_optimizer.analysis.StabilityAnalyzer;
import org.divyesh.panchasara.control_system_optimizer.analysis.StabilityResult;
import org.divyesh.panchasara.control_system_optimizer.control.ClosedLoopSystem;
import org.divyesh.panchasara.control_system_optimizer.control.StateFeedbackController;
import org.divyesh.panchasara.control_system_optimizer.model.DynamicSystem;
import org.divyesh.panchasara.control_system_optimizer.optimization.Constraints;
import org.divyesh.panchasara.control_system_optimizer.optimization.EvaluationDetail;
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
	 * is false); candidates that destabilize the closed loop, produce invalid
	 * simulations or violate the given hard constraints receive +INFINITY.
	 */
	public OptimizationProblem createProblem(DynamicSystem system, boolean tracking, SimulationSettings simulation,
			ObjectiveFunction objective, Constraints constraints, double[] lowerBounds, double[] upperBounds,
			String[] parameterNames) {
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
				return evaluateCandidate(system, tracking, simulation, objective, constraints, candidate).cost();
			}

			@Override
			public EvaluationDetail evaluateDetail(double[] candidate) {
				DetailedEvaluation evaluation =
						evaluateCandidate(system, tracking, simulation, objective, constraints, candidate);
				PerformanceMetrics metrics = evaluation.metrics();
				return new EvaluationDetail(evaluation.cost(),
						applicationScalar(metrics.iae()), applicationScalar(metrics.controlEffort()));
			}
		};
	}

	private Double applicationScalar(double value) {
		return Double.isFinite(value) ? value : null;
	}

	/**
	 * Full evaluation of a candidate, including stability and metrics. Used to
	 * build the diagnostic payload of an optimization response.
	 *
	 * @param constraints optional hard limits; a violating candidate is treated
	 *                    as infeasible while its metrics are kept for reporting
	 */
	public DetailedEvaluation evaluateCandidate(DynamicSystem system, boolean tracking, SimulationSettings simulation,
			ObjectiveFunction objective, Constraints constraints, double[] gains) {
		if (gains == null || gains.length != system.dimension()) {
			return DetailedEvaluation.infeasible(constraints);
		}
		try {
			StateFeedbackController controller = StateFeedbackController.of(gains, tracking);
			ClosedLoopSystem closedLoop = ClosedLoopSystem.of(system, controller);
			StabilityResult stability = stabilityAnalyzer.analyze(closedLoop.acl());
			if (!stability.stable()) {
				return new DetailedEvaluation(controller, stability, null, null, Double.POSITIVE_INFINITY, constraints);
			}
			SimulationSetup setup = new SimulationSetup(system, controller, simulation.initialState(),
					simulation.reference(), simulation.startTime(), simulation.endTime(), simulation.timeStep());
			Trajectory trajectory = simulator.simulate(setup);
			PerformanceMetrics metrics =
					performanceAnalyzer.analyze(trajectory, simulation.settlingBandFraction());
			double cost = objective.evaluate(trajectory, metrics);
			if (Double.isNaN(cost) || cost == Double.NEGATIVE_INFINITY) {
				return new DetailedEvaluation(controller, stability, metrics, trajectory, Double.POSITIVE_INFINITY,
						constraints);
			}
			Constraints.ConstraintReport report = constraints == null ? null
					: constraints.check(metrics.maxControl(), metrics.overshoot(), metrics.settlingTime());
			if (report != null && !allSatisfied(report)) {
				return new DetailedEvaluation(controller, stability, metrics, trajectory, Double.POSITIVE_INFINITY,
						constraints);
			}
			return new DetailedEvaluation(controller, stability, metrics, trajectory, cost, constraints);
		} catch (RuntimeException e) {
			return DetailedEvaluation.infeasible(constraints);
		}
	}

	private boolean allSatisfied(Constraints.ConstraintReport report) {
		return (report.maxControl() == null || report.maxControl().satisfied())
				&& (report.maxOvershoot() == null || report.maxOvershoot().satisfied())
				&& (report.maxSettlingTime() == null || report.maxSettlingTime().satisfied());
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
		final Constraints constraints;

		private DetailedEvaluation(StateFeedbackController controller, StabilityResult stability,
				PerformanceMetrics metrics, Trajectory trajectory, double cost, Constraints constraints) {
			this.controller = controller;
			this.stability = stability;
			this.metrics = metrics;
			this.trajectory = trajectory;
			this.cost = cost;
			this.constraints = constraints;
		}

		static DetailedEvaluation infeasible(Constraints constraints) {
			return new DetailedEvaluation(null, null, null, null, Double.POSITIVE_INFINITY, constraints);
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

		/** The constraint report for this candidate, or null when not enforced. */
		public Constraints.ConstraintReport constraintReport() {
			return constraints == null ? null
					: constraints.check(metrics == null ? Double.NaN : metrics.maxControl(),
							metrics == null ? Double.NaN : metrics.overshoot(),
							metrics == null ? Double.NaN : metrics.settlingTime());
		}
	}
}