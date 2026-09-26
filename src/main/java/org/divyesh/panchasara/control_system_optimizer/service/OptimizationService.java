package org.divyesh.panchasara.control_system_optimizer.service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import org.divyesh.panchasara.control_system_optimizer.analysis.PerformanceMetrics;
import org.divyesh.panchasara.control_system_optimizer.analysis.StabilityResult;
import org.divyesh.panchasara.control_system_optimizer.analysis.SteadyState;
import org.divyesh.panchasara.control_system_optimizer.analysis.SteadyStateResolver;
import org.divyesh.panchasara.control_system_optimizer.api.dto.ConstraintReportResponse;
import org.divyesh.panchasara.control_system_optimizer.api.dto.ConstraintSpec;
import org.divyesh.panchasara.control_system_optimizer.api.dto.GainBounds;
import org.divyesh.panchasara.control_system_optimizer.api.dto.MetricsResponse;
import org.divyesh.panchasara.control_system_optimizer.api.dto.MetricSurfacesResponse;
import org.divyesh.panchasara.control_system_optimizer.api.dto.NearestMissResponse;
import org.divyesh.panchasara.control_system_optimizer.api.dto.ObjectiveBreakdownResponse;
import org.divyesh.panchasara.control_system_optimizer.api.dto.ObjectiveSpec;
import org.divyesh.panchasara.control_system_optimizer.api.dto.OptimizationRequest;
import org.divyesh.panchasara.control_system_optimizer.api.dto.OptimizationResponse;
import org.divyesh.panchasara.control_system_optimizer.api.dto.OptimizerSpec;
import org.divyesh.panchasara.control_system_optimizer.config.ControlProperties;
import org.divyesh.panchasara.control_system_optimizer.model.DynamicSystem;
import org.divyesh.panchasara.control_system_optimizer.optimization.Constraints;
import org.divyesh.panchasara.control_system_optimizer.optimization.DeterministicGridSearchOptimizer;
import org.divyesh.panchasara.control_system_optimizer.optimization.DifferentialEvolutionConfig;
import org.divyesh.panchasara.control_system_optimizer.optimization.DifferentialEvolutionOptimizer;
import org.divyesh.panchasara.control_system_optimizer.optimization.GridSearchConfig;
import org.divyesh.panchasara.control_system_optimizer.optimization.ObjectiveBreakdown;
import org.divyesh.panchasara.control_system_optimizer.optimization.ObjectiveWeights;
import org.divyesh.panchasara.control_system_optimizer.optimization.MetricReference;
import org.divyesh.panchasara.control_system_optimizer.optimization.OptimizationProblem;
import org.divyesh.panchasara.control_system_optimizer.optimization.OptimizationResult;
import org.divyesh.panchasara.control_system_optimizer.optimization.Optimizer;
import org.divyesh.panchasara.control_system_optimizer.optimization.WeightedControlObjective;
import org.divyesh.panchasara.control_system_optimizer.simulation.SimulationSettings;
import org.divyesh.panchasara.control_system_optimizer.systems.SystemRegistry;
import org.springframework.stereotype.Service;

/**
 * Runs a gain-selection optimization: builds the {@link OptimizationProblem},
 * lets a generic optimizer search the gain space, then collects diagnostics for
 * the best candidate. The optimizer itself never touches the physical system.
 *
 * <p>The objective is normalized against fixed positive scales derived from the
 * reference position, plant stiffness and horizon
 * ({@link MetricReference#fixed}) so the result is deterministic and does not
 * depend on any baseline gain. The optional steady-state-error term uses the
 * reference magnitude as its fixed scale.
 */
@Service
public class OptimizationService {

	/** Leading clause of every infeasible run's reason. */
	private static final String NO_FEASIBLE_IN_RANGE = "No feasible gain configuration was found in the searched range";

	/** Fallback when the search retained no near-miss candidate to describe. */
	private static final String NONE_WORKED =
			": every candidate either destabilizes the closed loop or violates the configured limits";

	/** Describes a near miss that responded but broke no measured limit. */
	private static final String NO_USABLE_RESPONSE =
			"did not close the loop stably or produced an invalid simulation";

	private final SystemRegistry registry;
	private final SimulationService simulationService;
	private final ControlProblemFactory problemFactory;
	private final ControlProperties properties;

	public OptimizationService(SystemRegistry registry, SimulationService simulationService,
			ControlProblemFactory problemFactory, ControlProperties properties) {
		this.registry = registry;
		this.simulationService = simulationService;
		this.problemFactory = problemFactory;
		this.properties = properties;
	}

	public OptimizationResponse optimize(OptimizationRequest request) {
		long startNanos = System.nanoTime();
		DynamicSystem system = registry.create(request.system().type(), request.system().parameters());
		int n = system.dimension();

		String controllerType = request.controller() == null ? "STATE_FEEDBACK" : request.controller().type();
		if (!"STATE_FEEDBACK".equalsIgnoreCase(controllerType)) {
			throw new IllegalArgumentException("Optimization currently requires a STATE_FEEDBACK controller");
		}
		boolean tracking = request.controller() != null && Boolean.TRUE.equals(request.controller().tracking());
		boolean feedforward = request.controller() != null && Boolean.TRUE.equals(request.controller().feedforward());

		GainBounds bounds = request.gainBounds();
		if (bounds.lower().length != n) {
			throw new IllegalArgumentException("Gain bounds must have " + n + " entries for this system");
		}
		if (bounds.upper().length != n) {
			throw new IllegalArgumentException("Gain bounds must have " + n + " entries for this system");
		}

		SimulationSettings simulation = simulationService.toSettings(request.simulation(), n);
		double springConstant = system.parameters().getOrDefault("springConstant", Double.NaN);
		double referencePosition = simulation.reference()[0];
		double steadyStateErrorScale = Math.abs(referencePosition);
		ObjectiveWeights weights = toWeights(request.objective());
		MetricReference reference =
				MetricReference.fixed(springConstant, referencePosition, simulation.endTime(), simulation.startTime());
		WeightedControlObjective objective =
				new WeightedControlObjective(weights, reference, steadyStateErrorScale);
		Constraints constraints = toConstraints(request.constraints());

		String[] names = new String[n];
		for (int i = 0; i < n; i++) {
			names[i] = "k" + i;
		}
		names[0] = "kp";
		if (n > 1) {
			names[1] = "kd";
		}

		OptimizationProblem problem = problemFactory.createProblem(system, tracking, feedforward, simulation, objective,
				constraints, bounds.lower(), bounds.upper(), names);

		OptimizationResult result = buildOptimizer(request.optimizer()).optimize(problem);

		boolean boundaryHit = boundaryHit(result, bounds.lower(), bounds.upper());

		return assemble(system, tracking, feedforward, simulation, objective, constraints, result, bounds, boundaryHit,
				(System.nanoTime() - startNanos) / 1_000_000);
	}

	private OptimizationResponse assemble(DynamicSystem system, boolean tracking, boolean feedforward,
			SimulationSettings simulation, WeightedControlObjective objective, Constraints constraints,
			OptimizationResult result, GainBounds bounds, boolean boundaryHit, long elapsedMillis) {
		if (!result.feasible() || result.bestParameters() == null) {
			NearestMissResponse nearestMiss = buildNearestMiss(system, tracking, feedforward, simulation, objective,
					constraints, result);
			return new OptimizationResponse(result.optimizerType(), null, null, result.evaluations(), false,
					result.converged(), result.seed(), null, null, false, elapsedMillis, result.convergence(),
					result.costSurface(), result.config(), null, null, MetricSurfacesResponse.from(result.metricSurfaces()),
					infeasibleReason(nearestMiss, bounds), nearestMiss);
		}
		ControlProblemFactory.DetailedEvaluation evaluation =
				problemFactory.evaluateCandidate(system, tracking, feedforward, simulation, objective, constraints,
						result.bestParameters());
		StabilityResult stability = evaluation.stability();
		PerformanceMetrics metrics = evaluation.metrics();
		ObjectiveBreakdown breakdown = metrics == null ? null : objective.breakdown(evaluation.trajectory(), metrics,
				evaluation.steadyStateError());
		MetricsResponse metricsResponse = metrics == null ? null
				: MetricsResponse.from(metrics, List.of(), evaluation.steadyStateError() == null ? null
						: steadyStatePosition(evaluation.steadyStateError(), simulation.reference()[0]),
						evaluation.steadyStateError());
		return new OptimizationResponse(result.optimizerType(), evaluation.gains(),
				Double.isFinite(evaluation.cost()) ? evaluation.cost() : null, result.evaluations(),
				evaluation.feasible(), result.converged(), result.seed(), stability, metricsResponse, boundaryHit,
				elapsedMillis, result.convergence(), result.costSurface(), result.config(),
				breakdown == null ? null : ObjectiveBreakdownResponse.from(breakdown),
				constraints == null || metrics == null ? null : constraintReport(constraints, evaluation),
				MetricSurfacesResponse.from(result.metricSurfaces()), null, null);
	}

	/**
	 * Describes the closest infeasible candidate of a failed run, or null when the
	 * search retained none. The optimizer already paid to evaluate it, but it kept
	 * only the parameter vector, so the metrics behind the verdict are recomputed
	 * once here — one extra simulation on a run that has already failed.
	 */
	private NearestMissResponse buildNearestMiss(DynamicSystem system, boolean tracking, boolean feedforward,
			SimulationSettings simulation, WeightedControlObjective objective, Constraints constraints,
			OptimizationResult result) {
		double[] gains = result.nearestMiss();
		if (gains == null) {
			return null;
		}
		ControlProblemFactory.DetailedEvaluation evaluation =
				problemFactory.evaluateCandidate(system, tracking, feedforward, simulation, objective, constraints, gains);
		PerformanceMetrics metrics = evaluation.metrics();
		return new NearestMissResponse(gains, metrics == null ? null : MetricsResponse.from(metrics),
				violatedConstraints(constraints, evaluation));
	}

	/** Only the enforced limits this candidate actually missed, in declaration order. */
	private List<ConstraintReportResponse> violatedConstraints(Constraints constraints,
			ControlProblemFactory.DetailedEvaluation evaluation) {
		if (constraints == null) {
			return List.of();
		}
		List<ConstraintReportResponse> violated = new ArrayList<>(5);
		for (ConstraintReportResponse limit : constraintReport(constraints, evaluation)) {
			if (!limit.satisfied()) {
				violated.add(limit);
			}
		}
		return violated;
	}

	/**
	 * Position that corresponds to a tracking error magnitude: for a pure
	 * proportional error this is {@code reference - |error|} (below the
	 * reference), which is what a user recognizes as the "settled" line.
	 */
	private double steadyStatePosition(double errorMagnitude, double reference) {
		return reference - Math.abs(errorMagnitude);
	}

	/**
	 * Explains why the run found no feasible gain, driven by the near-miss
	 * candidate: it names only the limits that actually stood in the way and gives
	 * the value that missed each one. When the search retained no near miss there
	 * is nothing more specific to say than the fact that no candidate worked, so
	 * it falls back to describing the space and the configured limits.
	 */
	private String infeasibleReason(NearestMissResponse nearestMiss, GainBounds bounds) {
		StringBuilder reason = new StringBuilder(NO_FEASIBLE_IN_RANGE);
		appendSearchedRange(reason, bounds);
		if (nearestMiss == null) {
			return reason.append(NONE_WORKED).toString();
		}
		reason.append(". Closest candidate K = ").append(gainVector(nearestMiss.gain())).append(' ');
		if (nearestMiss.violatedConstraints().isEmpty()) {
			return reason.append(NO_USABLE_RESPONSE).toString();
		}
		reason.append("missed: ");
		List<ConstraintReportResponse> violated = nearestMiss.violatedConstraints();
		for (int i = 0; i < violated.size(); i++) {
			if (i > 0) {
				reason.append("; ");
			}
			reason.append(describe(violated.get(i)));
		}
		return reason.append('.').toString();
	}

	/** One violated limit as a clause, e.g. {@code "control energy 98.9 exceeds the limit of 40"}. */
	private String describe(ConstraintReportResponse limit) {
		Double achieved = limit.achieved();
		if (achieved == null || !Double.isFinite(achieved)) {
			// e.g. a settling-time limit on a response that never settles
			return limit.name() + " was never reached (limit " + amount(limit.limit()) + ")";
		}
		return limit.name() + " " + amount(achieved) + " exceeds the limit of " + amount(limit.limit());
	}

	private void appendSearchedRange(StringBuilder reason, GainBounds bounds) {
		if (bounds == null || bounds.lower() == null || bounds.lower().length == 0
				|| bounds.lower().length != bounds.upper().length) {
			return;
		}
		reason.append(" (");
		for (int i = 0; i < bounds.lower().length; i++) {
			if (i > 0) {
				reason.append(", ");
			}
			reason.append(i == 0 ? "kp" : "kd").append(" in [").append(amount(bounds.lower()[i])).append(", ")
					.append(amount(bounds.upper()[i])).append(']');
		}
		reason.append(')');
	}

	private String gainVector(double[] gains) {
		StringBuilder text = new StringBuilder("[");
		for (int i = 0; i < gains.length; i++) {
			if (i > 0) {
				text.append(", ");
			}
			text.append(amount(gains[i]));
		}
		return text.append(']').toString();
	}

	/**
	 * Compact, locale-independent number for prose. Rounds to four significant
	 * digits to shed floating-point noise, then drops the trailing zeros that
	 * {@code %g} pads in, so bounds read "kp in [0, 30]" rather than
	 * "kp in [0.0000, 30.00]".
	 */
	private String amount(double value) {
		if (!Double.isFinite(value)) {
			return "undefined";
		}
		BigDecimal rounded = new BigDecimal(String.format(Locale.ROOT, "%.4g", value));
		return rounded.stripTrailingZeros().toPlainString();
	}

	private boolean boundaryHit(OptimizationResult result, double[] lower, double[] upper) {
		if (result.bestParameters() == null) {
			return false;
		}
		for (int i = 0; i < result.bestParameters().length; i++) {
			double value = result.bestParameters()[i];
			if (Double.isFinite(value) && (Math.abs(value - lower[i]) < 1e-9 || Math.abs(value - upper[i]) < 1e-9)) {
				return true;
			}
		}
		return false;
	}

	private List<ConstraintReportResponse> constraintReport(Constraints constraints,
			ControlProblemFactory.DetailedEvaluation evaluation) {
		Constraints.ConstraintReport report = evaluation.constraintReport();
		if (report == null) {
			return List.of();
		}
		List<ConstraintReportResponse> list = new ArrayList<>(5);
		addIfPresent(list, report.maxControl());
		addIfPresent(list, report.maxOvershoot());
		addIfPresent(list, report.maxSettlingTime());
		addIfPresent(list, report.maxSteadyStateError());
		addIfPresent(list, report.maxControlEnergy());
		return list;
	}

	private void addIfPresent(List<ConstraintReportResponse> list, Constraints.ControlLimit limit) {
		if (limit != null) {
			list.add(new ConstraintReportResponse(limit.id(), limit.name(), limit.achieved(), limit.limit(),
					limit.satisfied()));
		}
	}

	private Constraints toConstraints(ConstraintSpec spec) {
		if (spec == null) {
			return null;
		}
		if (spec.maxControl() == null && spec.maxOvershoot() == null && spec.maxSettlingTime() == null
				&& spec.maxSteadyStateError() == null && spec.maxControlEnergy() == null) {
			return null;
		}
		return new Constraints(spec.maxControl(), spec.maxOvershoot(), spec.maxSettlingTime(),
				spec.maxSteadyStateError(), spec.maxControlEnergy());
	}

	private Optimizer buildOptimizer(OptimizerSpec spec) {
		String type = spec.type() == null ? "GRID_SEARCH" : spec.type().toUpperCase();
		return switch (type) {
			case "GRID_SEARCH" -> {
				int[] resolution = spec.resolution();
				if (resolution == null || resolution.length == 0) {
					throw new IllegalArgumentException("GRID_SEARCH requires a per-dimension resolution");
				}
				yield new DeterministicGridSearchOptimizer(
						new GridSearchConfig(resolution, Boolean.TRUE.equals(spec.includeCostSurface())));
			}
			case "DIFFERENTIAL_EVOLUTION" -> {
				ControlProperties.DifferentialEvolution defaults = properties.differentialEvolution();
				long seed = spec.seed() == null ? properties.defaultSeed() : spec.seed();
				int populationSize = spec.populationSize() == null ? 0 : spec.populationSize();
				int maxIterations = spec.maxIterations() == null ? defaults.maxIterations() : spec.maxIterations();
				double weight = spec.differentialWeight() == null ? defaults.differentialWeight() : spec.differentialWeight();
				double crossover = spec.crossoverRate() == null ? defaults.crossoverRate() : spec.crossoverRate();
				yield new DifferentialEvolutionOptimizer(
						new DifferentialEvolutionConfig(populationSize, maxIterations, weight, crossover, seed));
			}
			default -> throw new IllegalArgumentException(
					"Unsupported optimizer type '" + spec.type() + "' (supported: GRID_SEARCH, DIFFERENTIAL_EVOLUTION)");
		};
	}

	private ObjectiveWeights toWeights(ObjectiveSpec spec) {
		ObjectiveWeights defaults = ObjectiveWeights.DEFAULT;
		ObjectiveWeights weights = new ObjectiveWeights(
				spec.trackingErrorWeight() == null ? defaults.trackingErrorWeight() : spec.trackingErrorWeight(),
				spec.controlEffortWeight() == null ? defaults.controlEffortWeight() : spec.controlEffortWeight(),
				spec.settlingTimeWeight() == null ? defaults.settlingTimeWeight() : spec.settlingTimeWeight(),
				spec.overshootWeight() == null ? defaults.overshootWeight() : spec.overshootWeight());
		if (spec.steadyStateErrorWeight() != null) {
			return new ObjectiveWeights(weights.trackingErrorWeight(), weights.controlEffortWeight(),
					weights.settlingTimeWeight(), weights.overshootWeight(), spec.steadyStateErrorWeight());
		}
		return weights;
	}
}