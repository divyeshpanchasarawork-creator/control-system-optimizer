package org.divyesh.panchasara.control_system_optimizer.optimization;

/**
 * Configuration of a full Cartesian grid search over the parameter space.
 *
 * @param resolution number of equally-spaced samples per parameter dimension
 */
public record GridSearchConfig(int[] resolution) {

	public GridSearchConfig {
		if (resolution == null || resolution.length == 0) {
			throw new IllegalArgumentException("Grid resolution must have at least one dimension");
		}
		for (int r : resolution) {
			if (r < 2) {
				throw new IllegalArgumentException("Grid resolution per dimension must be >= 2");
			}
		}
	}
}