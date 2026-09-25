package org.divyesh.panchasara.control_system_optimizer.optimization;

/**
 * Configuration of a full Cartesian grid search over the parameter space.
 *
 * @param resolution        number of equally-spaced samples per parameter dimension
 * @param includeCostSurface when true (2-D problems only) the optimizer also
 *                          records the objective over the whole grid for heatmaps
 */
public record GridSearchConfig(int[] resolution, boolean includeCostSurface) {

	public GridSearchConfig {
		if (resolution == null || resolution.length == 0) {
			throw new IllegalArgumentException("Grid resolution must have at least one dimension");
		}
		if (includeCostSurface && resolution.length != 2) {
			throw new IllegalArgumentException("Cost surface is only supported for 2-D grid searches");
		}
		long cells = 1;
		for (int r : resolution) {
			if (r < 2) {
				throw new IllegalArgumentException("Grid resolution per dimension must be >= 2");
			}
			cells *= r;
			if (cells > 40_000L) {
				throw new IllegalArgumentException("Grid search is too large (max " + cells + " cells requested, limit 40k)");
			}
		}
	}

	public GridSearchConfig(int[] resolution) {
		this(resolution, false);
	}
}