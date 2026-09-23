package org.divyesh.panchasara.control_system_optimizer.service;

import java.util.ArrayList;
import java.util.List;

import org.divyesh.panchasara.control_system_optimizer.analysis.PerformanceMetrics;
import org.divyesh.panchasara.control_system_optimizer.analysis.StabilityResult;
import org.divyesh.panchasara.control_system_optimizer.api.dto.ConstraintReportResponse;
import org.divyesh.panchasara.control_system_optimizer.api.dto.ConstraintSpec;
import org.divyesh.panchasara.control_system_optimizer.api.dto.GainBounds;
import org.divyesh.panchasara.control_system_optimizer.api.dto.MetricsResponse;
import org.divyesh.panchasara.control_system_optimizer.api.dto.MetricSurfacesResponse;
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
 */
@Service
public class OptimizationService {

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

		GainBounds bounds = request.gainBounds();
		if (bounds.lower().length != n) {
			throw new IllegalArgumentException("Gain bounds must have " + n + " entries for this system");
		}
		if (bounds.upper().length != n) {
			throw new IllegalArgumentException("Gain bounds must have " + n + " entries for this system");
		}

		SimulationSettings simulation = simulationService.toSettings(request.simulation(), n);
		WeightedControlObjective objective = new WeightedControlObjective(toWeights(request.objective()));
		Constraints constraints = toConstraints(request.constraints());

		String[] names = new String[n];
		for (int i = 0; i < n; i++) {
			names[i] = "k" + i;
		}
		names[0] = "kp";
		if (n > 1) {
			names[1] = "kd";
		}

		OptimizationProblem problem = problemFactory.createProblem(system, tracking, simulation, objective, constraints,
				bounds.lower(), bounds.upper(), names);

		OptimizationResult result = buildOptimizer(request.optimizer()).optimize(problem);

		return assemble(system, tracking, simulation, objective, constraints, result,
				(System.nanoTime() - startNanos) / 1_000_000);
	}

	private OptimizationResponse assemble(DynamicSystem system, boolean tracking, SimulationSettings simulation,
			WeightedControlObjective objective, Constraints constraints, OptimizationResult result, long elapsedMillis) {
		if (!result.feasible() || result.bestParameters() == null) {
			return new OptimizationResponse(result.optimizerType(), null, null, result.evaluations(), false,
					result.converged(), result.seed(), null, null, elapsedMillis, result.convergence(),
					result.costSurface(), result.config(), null, null, MetricSurfacesResponse.from(result.metricSurfaces()));
		}
		ControlProblemFactory.DetailedEvaluation evaluation =
				problemFactory.evaluateCandidate(system, tracking, simulation, objective, constraints, result.bestParameters());
		StabilityResult stability = evaluation.stability();
		PerformanceMetrics metrics = evaluation.metrics();
		ObjectiveBreakdown breakdown = metrics == null ? null : objective.breakdown(evaluation.trajectory(), metrics);
		return new OptimizationResponse(result.optimizerType(), evaluation.gains(),
				Double.isFinite(evaluation.cost()) ? evaluation.cost() : null, result.evaluations(),
				evaluation.feasible(), result.converged(), result.seed(), stability,
				metrics == null ? null : MetricsResponse.from(metrics), elapsedMillis, result.convergence(),
				result.costSurface(), result.config(),
				breakdown == null ? null : ObjectiveBreakdownResponse.from(breakdown),
				constraints == null || metrics == null ? null : constraintReport(constraints, evaluation),
				MetricSurfacesResponse.from(result.metricSurfaces()));
	}

	private List<ConstraintReportResponse> constraintReport(Constraints constraints,
			ControlProblemFactory.DetailedEvaluation evaluation) {
		Constraints.ConstraintReport report = evaluation.constraintReport();
		List<ConstraintReportResponse> list = new ArrayList<>(3);
		if (report.maxControl() != null) {
			var limit = report.maxControl();
			list.add(new ConstraintReportResponse(limit.id(), limit.name(), limit.achieved(), limit.limit(),
					limit.satisfied()));
		}
		if (report.maxOvershoot() != null) {
			var limit = report.maxOvershoot();
			list.add(new ConstraintReportResponse(limit.id(), limit.name(), limit.achieved(), limit.limit(),
					limit.satisfied()));
		}
		if (report.maxSettlingTime() != null) {
			var limit = report.maxSettlingTime();
			list.add(new ConstraintReportResponse(limit.id(), limit.name(), limit.achieved(), limit.limit(),
					limit.satisfied()));
		}
		return list;
	}

	private Constraints toConstraints(ConstraintSpec spec) {
		if (spec == null) {
			return null;
		}
		if (spec.maxControl() == null && spec.maxOvershoot() == null && spec.maxSettlingTime() == null) {
			return null;
		}
		return new Constraints(spec.maxControl(), spec.maxOvershoot(), spec.maxSettlingTime());
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
		return new ObjectiveWeights(
				spec.trackingErrorWeight() == null ? defaults.trackingErrorWeight() : spec.trackingErrorWeight(),
				spec.controlEffortWeight() == null ? defaults.controlEffortWeight() : spec.controlEffortWeight(),
				spec.settlingTimeWeight() == null ? defaults.settlingTimeWeight() : spec.settlingTimeWeight(),
				spec.overshootWeight() == null ? defaults.overshootWeight() : spec.overshootWeight());
	}
}