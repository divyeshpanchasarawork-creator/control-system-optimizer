package org.divyesh.panchasara.control_system_optimizer.api.dto;

/**
 * One enforced constraint with the achieved value of the best candidate.
 * {@code achieved} is null when the metric is undefined (e.g. settling time
 * when the system never settles).
 *
 * @param id        stable machine-readable identifier
 * @param name      human-readable label
 * @param achieved  value the best candidate achieved (null if undefined)
 * @param limit     the allowed limit
 * @param satisfied true if {@code achieved <= limit}
 */
public record ConstraintReportResponse(String id, String name, Double achieved, Double limit, boolean satisfied) {
}