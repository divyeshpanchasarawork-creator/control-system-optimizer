package org.divyesh.panchasara.control_system_optimizer.service;

import java.util.List;

import org.divyesh.panchasara.control_system_optimizer.analysis.PerformanceAnalyzer;
import org.divyesh.panchasara.control_system_optimizer.analysis.PerformanceMetrics;
import org.divyesh.panchasara.control_system_optimizer.api.dto.ControllerSpec;
import org.divyesh.panchasara.control_system_optimizer.api.dto.MetricsResponse;
import org.divyesh.panchasara.control_system_optimizer.api.dto.SimulationConfig;
import org.divyesh.panchasara.control_system_optimizer.api.dto.SimulationRequest;
import org.divyesh.panchasara.control_system_optimizer.api.dto.SimulationResponse;
import org.divyesh.panchasara.control_system_optimizer.api.dto.TrajectoryPointDto;
import org.divyesh.panchasara.control_system_optimizer.config.ControlProperties;
import org.divyesh.panchasara.control_system_optimizer.control.Controller;
import org.divyesh.panchasara.control_system_optimizer.control.StateFeedbackController;
import org.divyesh.panchasara.control_system_optimizer.model.DynamicSystem;
import org.divyesh.panchasara.control_system_optimizer.simulation.RungeKutta4Simulator;
import org.divyesh.panchasara.control_system_optimizer.simulation.SimulationSettings;
import org.divyesh.panchasara.control_system_optimizer.simulation.SimulationSetup;
import org.divyesh.panchasara.control_system_optimizer.simulation.Trajectory;
import org.divyesh.panchasara.control_system_optimizer.simulation.TrajectoryPoint;
import org.divyesh.panchasara.control_system_optimizer.systems.SystemRegistry;
import org.springframework.stereotype.Service;

/**
 * Runs a single closed-loop simulation and its performance metrics.
 */
@Service
public class SimulationService {

	private final SystemRegistry registry;
	private final RungeKutta4Simulator simulator;
	private final PerformanceAnalyzer performanceAnalyzer;
	private final ControlProperties properties;

	public SimulationService(SystemRegistry registry, RungeKutta4Simulator simulator,
			PerformanceAnalyzer performanceAnalyzer, ControlProperties properties) {
		this.registry = registry;
		this.simulator = simulator;
		this.performanceAnalyzer = performanceAnalyzer;
		this.properties = properties;
	}

	public SimulationResponse simulate(SimulationRequest request) {
		DynamicSystem system = registry.create(request.system().type(), request.system().parameters());
		Controller controller = buildController(request.controller(), system.dimension());
		SimulationSettings settings = toSettings(request.simulation(), system.dimension());

		Trajectory trajectory = simulator.simulate(new SimulationSetup(system, controller,
				settings.initialState(), settings.reference(), settings.startTime(), settings.endTime(), settings.timeStep()));
		PerformanceMetrics metrics = performanceAnalyzer.analyze(trajectory, settings.settlingBandFraction());

		List<TrajectoryPointDto> points = trajectory.points().stream()
				.map(p -> new TrajectoryPointDto(p.time(), p.state(), p.control(), p.reference()))
				.toList();

		return new SimulationResponse(system.systemType(), system.parameters(), request.controller(),
				MetricsResponse.from(metrics), points);
	}

	Controller buildController(ControllerSpec spec, int dimension) {
		if (spec == null) {
			return null;
		}
		if (!"STATE_FEEDBACK".equalsIgnoreCase(spec.type())) {
			throw new IllegalArgumentException("Unsupported controller type '" + spec.type() + "' (supported: STATE_FEEDBACK)");
		}
		double[] gains = spec.gain();
		if (gains == null || gains.length != dimension) {
			throw new IllegalArgumentException(
					"State feedback controller requires " + dimension + " gains");
		}
		return StateFeedbackController.of(gains, spec.tracking());
	}

	SimulationSettings toSettings(SimulationConfig config, int dimension) {
		double[] state = config.initialState();
		double[] ref = config.reference();
		if (state == null || ref == null) {
			throw new IllegalArgumentException("Initial state and reference are required");
		}
		if (state.length != dimension || ref.length != dimension) {
			throw new IllegalArgumentException("Initial state and reference must have dimension " + dimension);
		}
		double startTime = config.startTime() == null ? 0.0 : config.startTime();
		double endTime = config.endTime() == null ? properties.simulation().defaultEndTime() : config.endTime();
		double timeStep = config.timeStep() == null ? properties.simulation().defaultTimeStep() : config.timeStep();
		double settlingBandFraction = (config.settlingBand() == null ? 2.0 : config.settlingBand()) / 100.0;
		return new SimulationSettings(state, ref, startTime, endTime, timeStep, settlingBandFraction);
	}
}