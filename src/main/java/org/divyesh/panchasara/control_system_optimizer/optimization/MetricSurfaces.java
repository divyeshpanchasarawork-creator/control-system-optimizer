package org.divyesh.panchasara.control_system_optimizer.optimization;

/**
 * Per-cell diagnostic surfaces recorded alongside a cost surface: the IAE and
 * the control effort of every grid cell, or null where that cell was
 * infeasible.
 */
public record MetricSurfaces(Double[][] iae, Double[][] controlEffort) {
}