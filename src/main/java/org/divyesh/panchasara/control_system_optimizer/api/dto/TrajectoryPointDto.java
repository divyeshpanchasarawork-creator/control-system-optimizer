package org.divyesh.panchasara.control_system_optimizer.api.dto;

/**
 * JSON-safe view of one trajectory sample.
 */
public record TrajectoryPointDto(double time, double[] state, double[] control, double[] reference) {
}