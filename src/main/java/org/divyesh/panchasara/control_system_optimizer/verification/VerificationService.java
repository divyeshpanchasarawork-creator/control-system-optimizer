package org.divyesh.panchasara.control_system_optimizer.verification;

import java.util.ArrayList;
import java.util.List;

import org.divyesh.panchasara.control_system_optimizer.analysis.PerformanceAnalyzer;
import org.divyesh.panchasara.control_system_optimizer.analysis.PerformanceMetrics;
import org.divyesh.panchasara.control_system_optimizer.analysis.StabilityAnalyzer;
import org.divyesh.panchasara.control_system_optimizer.analysis.StabilityResult;
import org.divyesh.panchasara.control_system_optimizer.config.ControlProperties;
import org.divyesh.panchasara.control_system_optimizer.control.ClosedLoopSystem;
import org.divyesh.panchasara.control_system_optimizer.control.StateFeedbackController;
import org.divyesh.panchasara.control_system_optimizer.optimization.DeterministicGridSearchOptimizer;
import org.divyesh.panchasara.control_system_optimizer.optimization.DifferentialEvolutionConfig;
import org.divyesh.panchasara.control_system_optimizer.optimization.DifferentialEvolutionOptimizer;
import org.divyesh.panchasara.control_system_optimizer.optimization.GridSearchConfig;
import org.divyesh.panchasara.control_system_optimizer.optimization.ObjectiveWeights;
import org.divyesh.panchasara.control_system_optimizer.optimization.OptimizationProblem;
import org.divyesh.panchasara.control_system_optimizer.optimization.OptimizationResult;
import org.divyesh.panchasara.control_system_optimizer.optimization.WeightedControlObjective;
import org.divyesh.panchasara.control_system_optimizer.service.ControlProblemFactory;
import org.divyesh.panchasara.control_system_optimizer.simulation.RungeKutta4Simulator;
import org.divyesh.panchasara.control_system_optimizer.simulation.SimulationSettings;
import org.divyesh.panchasara.control_system_optimizer.simulation.SimulationSetup;
import org.divyesh.panchasara.control_system_optimizer.simulation.Trajectory;
import org.divyesh.panchasara.control_system_optimizer.systems.SpringDamperSystem;
import org.springframework.stereotype.Service;

/**
 * The numerical-correctness harness. Reuses exactly the pipeline the app's
 * simulation, analysis and optimization endpoints use (same system class, same
 * closed-loop assembly, same stability analyzer, same RK4 simulator, same
 * objective), then compares the output against closed-form results.
 *
 * <p>Three golden configurations are checked at the analytic level (poles,
 * natural frequency, damping ratio, steady-state offset, initial control) and
 * the simulated level (RK4 metrics). Convergence, metric consistency and
 * optimizer cross-validation are reported for the tracking configuration.
 */
@Service
public final class VerificationService {

	private static final double REFERENCE = 1.0;
	private static final double END_TIME = 10.0;
	private static final double COARSE_DT = 0.01;
	private static final double FINE_DT = 0.001;

	private final RungeKutta4Simulator simulator;
	private final PerformanceAnalyzer performanceAnalyzer;
	private final StabilityAnalyzer stabilityAnalyzer;
	private final ControlProblemFactory problemFactory;
	private final ControlProperties properties;

	public VerificationService(RungeKutta4Simulator simulator, PerformanceAnalyzer performanceAnalyzer,
			StabilityAnalyzer stabilityAnalyzer, ControlProblemFactory problemFactory, ControlProperties properties) {
		this.simulator = simulator;
		this.performanceAnalyzer = performanceAnalyzer;
		this.stabilityAnalyzer = stabilityAnalyzer;
		this.problemFactory = problemFactory;
		this.properties = properties;
	}

	public VerificationReport run() {
		long startNanos = System.nanoTime();

		List<GoldenCaseResult> golden = new ArrayList<>();
		for (GoldenCase c : GoldenCase.CASES) {
			golden.add(verify(c, COARSE_DT));
		}

		List<ConvergenceCheck> convergence = timeStepConvergence(GoldenCase.CASES[1]);
		List<ConsistencyCheck> consistency = metricConsistency(GoldenCase.CASES[1]);
		List<CrossValidationCheck> crossValidation = optimizerCrossValidation(GoldenCase.CASES[1]);

		boolean allPassed = golden.stream().allMatch(GoldenCaseResult::passed)
				&& convergence.stream().allMatch(ConvergenceCheck::passed)
				&& consistency.stream().allMatch(ConsistencyCheck::passed)
				&& crossValidation.stream().allMatch(CrossValidationCheck::passed);

		return new VerificationReport(allPassed ? "PASS" : "FAIL", golden, convergence, consistency,
				crossValidation, (System.nanoTime() - startNanos) / 1_000_000);
	}

	private GoldenCaseResult verify(GoldenCase c, double dt) {
		SpringDamperSystem system = new SpringDamperSystem(c.m(), c.c(), c.k());
		double[] gains = c.gains();
		StateFeedbackController controller = StateFeedbackController.of(gains, true);
		ClosedLoopSystem closedLoop = ClosedLoopSystem.of(system, controller);

		// Closed-form second-order descriptors of A_cl = [[0,1],[-(k+kp)/m, -(c+kd)/m]].
		double sigma = (c.c() + c.kd()) / (2.0 * c.m());
		double omegaN = Math.sqrt((c.k() + c.kp()) / c.m());
		double poleRe = -sigma;
		double poleIm = omegaN > sigma ? Math.sqrt(omegaN * omegaN - sigma * sigma) : Double.NaN;
		double zeta = omegaN > 1e-12 ? sigma / omegaN : Double.NaN;
		Double settlingEstimate = sigma > 1e-12 ? 4.0 / sigma : null;

		double idealPosition = REFERENCE * c.kp() / (c.k() + c.kp());
		double steadyStateError = REFERENCE - idealPosition;
		double controlAtZero = REFERENCE * c.kp();

		StabilityResult stability = stabilityAnalyzer.analyze(closedLoop.acl());

		Trajectory trajectory = simulate(system, gains, dt);
		PerformanceMetrics metrics = performanceAnalyzer.analyze(trajectory, 0.02);
		double measuredControlAtZero = trajectory.points().getFirst().control()[0];

		boolean passed = near(stability.maxRealPart(), poleRe, 1e-6)
				&& Double.isFinite(poleIm) && near(Math.abs(poleImOf(stability)), poleIm, 1e-6)
				&& near(omegaN, Math.hypot(poleRe, poleIm), 1e-6)
				&& stability.stable() == (sigma > 0.0)
				&& near(measuredControlAtZero, controlAtZero, 1e-3)
				&& near(metrics.finalError(), steadyStateError, 1e-2)
				&& near(metrics.maxAbsError(), REFERENCE, 1e-6);

		return new GoldenCaseResult(c.id(), c.name(), c.m(), c.c(), c.k(), gains,
				poleRe, Double.isFinite(poleIm) ? poleIm : null, omegaN, zeta, settlingEstimate,
				idealPosition, steadyStateError, controlAtZero,
				stability.stable(),
				metrics.finalError(), metrics.maxAbsError(), metrics.iae(), metrics.ise(),
				metrics.overshoot(), metrics.controlEffort(), metrics.maxControl(),
				Double.isFinite(metrics.settlingTime()) ? metrics.settlingTime() : null,
				measuredControlAtZero, passed);
	}

	private List<ConvergenceCheck> timeStepConvergence(GoldenCase c) {
		PerformanceMetrics coarse = metricsOf(c, COARSE_DT);
		PerformanceMetrics fine = metricsOf(c, FINE_DT);
		List<ConvergenceCheck> checks = new ArrayList<>();
		checks.add(convergenceOf("IAE", coarse.iae(), fine.iae()));
		checks.add(convergenceOf("Control effort", coarse.controlEffort(), fine.controlEffort()));
		checks.add(convergenceOf("Final error", coarse.finalError(), fine.finalError()));
		return checks;
	}

	private ConvergenceCheck convergenceOf(String name, double coarse, double fine) {
		double absolute = Math.abs(coarse - fine);
		double relative = Math.abs(fine) > 1e-12 ? absolute / Math.abs(fine) : absolute;
		return new ConvergenceCheck(name, coarse, fine, absolute, relative, relative <= 1e-2);
	}

	private List<ConsistencyCheck> metricConsistency(GoldenCase c) {
		SpringDamperSystem system = new SpringDamperSystem(c.m(), c.c(), c.k());
		SimulationSettings settings = settings(c);
		PerformanceMetrics direct = performanceAnalyzer.analyze(simulate(system, c.gains(), COARSE_DT), 0.02);

		WeightedControlObjective objective = new WeightedControlObjective(ObjectiveWeights.DEFAULT);
		ControlProblemFactory.DetailedEvaluation evaluation = problemFactory.evaluateCandidate(system, true, false, settings,
				objective, null, c.gains());
		PerformanceMetrics viaClosedLoop = evaluation.metrics();

		return List.of(
				consistencyOf("IAE", direct.iae(), viaClosedLoop.iae()),
				consistencyOf("Control effort", direct.controlEffort(), viaClosedLoop.controlEffort()),
				consistencyOf("Final error", direct.finalError(), viaClosedLoop.finalError()));
	}

	private ConsistencyCheck consistencyOf(String name, double direct, double closedLoop) {
		return new ConsistencyCheck(name, direct, closedLoop, Math.abs(direct - closedLoop) <= 1e-6);
	}

	private List<CrossValidationCheck> optimizerCrossValidation(GoldenCase c) {
		SpringDamperSystem system = new SpringDamperSystem(c.m(), c.c(), c.k());
		SimulationSettings settings = settings(c);
		WeightedControlObjective objective = new WeightedControlObjective(ObjectiveWeights.DEFAULT);
		double[] lower = { 0.0, 0.0 };
		double[] upper = { 30.0, 10.0 };

		OptimizationProblem problem = problemFactory.createProblem(system, true, false, settings, objective, null, lower,
				upper, new String[] { "kp", "kd" });

		OptimizationResult grid = new DeterministicGridSearchOptimizer(new GridSearchConfig(new int[] { 16, 11 }))
				.optimize(problem);
		OptimizationResult de = new DifferentialEvolutionOptimizer(
				new DifferentialEvolutionConfig(12, 150,
						properties.differentialEvolution().differentialWeight(),
						properties.differentialEvolution().crossoverRate(),
						properties.defaultSeed()))
				.optimize(problem);

		if (!grid.feasible() || !de.feasible()) {
			return List.of();
		}
		double better = Math.min(grid.bestCost(), de.bestCost());
		CrossValidationCheck gridCheck = crossValidationOf("GRID_SEARCH", problem, grid, better, objective, system,
				settings);
		CrossValidationCheck deCheck = crossValidationOf("DIFFERENTIAL_EVOLUTION", problem, de, better, objective, system,
				settings);
		return List.of(gridCheck, deCheck);
	}

	private CrossValidationCheck crossValidationOf(String optimizer, OptimizationProblem problem,
			OptimizationResult result, double bestOther, WeightedControlObjective objective, SpringDamperSystem system,
			SimulationSettings settings) {
		ControlProblemFactory.DetailedEvaluation evaluation = problemFactory.evaluateCandidate(system, true, false, settings,
				objective, null, result.bestParameters());
		double reproduced = evaluation.cost();
		double gap = Math.abs(result.bestCost() - bestOther);
		double tolerance = Math.max(bestOther * 0.10, 1e-6);
		boolean passed = evaluatedCostMatches(problem, result.bestParameters(), result.bestCost(), reproduced)
				&& gap <= tolerance;
		return new CrossValidationCheck(optimizer, result.bestCost(), result.bestParameters(), reproduced, gap, passed);
	}

	private boolean evaluatedCostMatches(OptimizationProblem problem, double[] gains, double reported, double reproduced) {
		if (!Double.isFinite(reported)) {
			return false;
		}
		return Math.abs(problem.evaluate(gains) - reported) <= 1e-6;
	}

	private PerformanceMetrics metricsOf(GoldenCase c, double dt) {
		SpringDamperSystem system = new SpringDamperSystem(c.m(), c.c(), c.k());
		return performanceAnalyzer.analyze(simulate(system, c.gains(), dt), 0.02);
	}

	private Trajectory simulate(SpringDamperSystem system, double[] gains, double dt) {
		StateFeedbackController controller = StateFeedbackController.of(gains, true);
		SimulationSetup setup = new SimulationSetup(system, controller, new double[] { 0.0, 0.0 },
				new double[] { REFERENCE, 0.0 }, 0.0, END_TIME, dt);
		return simulator.simulate(setup);
	}

	private SimulationSettings settings(GoldenCase c) {
		return new SimulationSettings(new double[] { 0.0, 0.0 }, new double[] { REFERENCE, 0.0 }, 0.0, END_TIME,
				COARSE_DT, 0.02);
	}

	private double poleImOf(StabilityResult stability) {
		for (var eigenvalue : stability.eigenvalues()) {
			if (Math.abs(eigenvalue.imag()) > 1e-9) {
				return eigenvalue.imag();
			}
		}
		return Double.NaN;
	}

	private boolean near(double actual, double expected, double tolerance) {
		return Math.abs(actual - expected) <= tolerance;
	}
}