package org.divyesh.panchasara.control_system_optimizer.api.dto;

/**
 * Controller configuration.
 *
 * @param type        controller family; "STATE_FEEDBACK" for version 1
 * @param gain        feedback gains (required for STATE_FEEDBACK simulations,
 *                    omitted/empty when the optimizer should choose them)
 * @param tracking    if true the controller tracks the reference (u = -K(x - r)),
 *                    otherwise it regulates to the origin (u = -Kx); defaults to true
 * @param feedforward if true the controller adds reference feedforward
 *                    (+ k*r1 using the same spring constant on the measured
 *                    reference position, canceling the static load:
 *                    u = -K(x - r) + k*r1); defaults to false
 */
public record ControllerSpec(String type, double[] gain, Boolean tracking, Boolean feedforward) {

	public ControllerSpec {
		if (type == null || type.isBlank()) {
			type = "STATE_FEEDBACK";
		}
		tracking = tracking == null ? Boolean.TRUE : tracking;
		feedforward = feedforward == null ? Boolean.FALSE : feedforward;
	}
}