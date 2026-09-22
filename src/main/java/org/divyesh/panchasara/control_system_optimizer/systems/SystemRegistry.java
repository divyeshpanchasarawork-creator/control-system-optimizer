package org.divyesh.panchasara.control_system_optimizer.systems;

import java.util.List;
import java.util.Map;

import org.divyesh.panchasara.control_system_optimizer.model.DynamicSystem;
import org.divyesh.panchasara.control_system_optimizer.model.SystemType;
import org.springframework.stereotype.Component;

/**
 * Registry that instantiates {@link DynamicSystem} implementations from their
 * names and parameter maps. Request parsing uses this so that the API layer and
 * services never depend on a concrete physical system.
 */
@Component
public final class SystemRegistry {

	private static final List<String> SPRING_DAMPER_PARAMS = List.of("mass", "damping", "springConstant");
	private static final List<String> STATE_FEEDBACK_CONTROLLERS = List.of("STATE_FEEDBACK");

	public DynamicSystem create(SystemType type, Map<String, Double> parameters) {
		return switch (type) {
			case SPRING_DAMPER -> new SpringDamperSystem(
					required(type, parameters, "mass"),
					required(type, parameters, "damping"),
					required(type, parameters, "springConstant"));
		};
	}

	/** Catalog of supported systems, served by GET /api/systems. */
	public List<SystemDescriptor> catalog() {
		return List.of(new SystemDescriptor(SystemType.SPRING_DAMPER, SPRING_DAMPER_PARAMS, STATE_FEEDBACK_CONTROLLERS));
	}

	private double required(SystemType type, Map<String, Double> parameters, String name) {
		if (parameters == null || !parameters.containsKey(name)) {
			throw new IllegalArgumentException("System " + type + " requires parameter '" + name + "'");
		}
		return parameters.get(name);
	}

	public record SystemDescriptor(SystemType type, List<String> parameterNames, List<String> controllerTypes) {
	}
}