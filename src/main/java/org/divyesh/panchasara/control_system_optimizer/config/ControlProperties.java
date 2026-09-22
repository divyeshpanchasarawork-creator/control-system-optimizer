package org.divyesh.panchasara.control_system_optimizer.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "control")
public record ControlProperties(
		Simulation simulation,
		DifferentialEvolution differentialEvolution,
		Long defaultSeed) {

	public ControlProperties {
		simulation = simulation == null ? new Simulation(10.0, 0.01) : simulation;
		differentialEvolution =
				differentialEvolution == null
						? new DifferentialEvolution(20, 1000, 0.5, 0.9)
						: differentialEvolution;
		defaultSeed = defaultSeed == null ? 42L : defaultSeed;
	}

	public record Simulation(double defaultEndTime, double defaultTimeStep) {
	}

	public record DifferentialEvolution(long populationScale, int maxIterations, double differentialWeight, double crossoverRate) {
	}
}