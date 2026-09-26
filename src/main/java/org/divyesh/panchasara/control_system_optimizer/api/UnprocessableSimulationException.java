package org.divyesh.panchasara.control_system_optimizer.api;

/**
 * A well-formed request that cannot produce a meaningful result, such as a
 * gain set whose closed loop diverges past the finite range. Reported as
 * HTTP 422 so the client can tell it apart from a malformed request.
 */
public class UnprocessableSimulationException extends RuntimeException {

	public UnprocessableSimulationException(String message) {
		super(message);
	}
}
