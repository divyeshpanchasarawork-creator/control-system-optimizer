package org.divyesh.panchasara.control_system_optimizer.control;

import org.divyesh.panchasara.control_system_optimizer.model.DynamicSystem;
import org.apache.commons.math3.linear.RealMatrix;

/**
 * Closed-loop linear system arising from state feedback u = -K*x:
 *
 * A_cl = A - B*K
 *
 * This is computed in the control layer (not inside the physical system), so it
 * applies to any DynamicSystem paired with a StateFeedbackController.
 */
public record ClosedLoopSystem(DynamicSystem openLoopSystem, StateFeedbackController controller, RealMatrix acl) {

	public static ClosedLoopSystem of(DynamicSystem system, StateFeedbackController controller) {
		if (system.stateSpaceModel().inputDimension() != controller.inputDimension()) {
			throw new IllegalArgumentException(
					"Controller input dimension does not match system input dimension");
		}
		if (controller.gainMatrix().getColumnDimension() != system.dimension()) {
			throw new IllegalArgumentException(
					"Controller gain dimension does not match system state dimension");
		}
		RealMatrix a = system.stateSpaceModel().a();
		RealMatrix b = system.stateSpaceModel().b();
		return new ClosedLoopSystem(system, controller, a.subtract(b.multiply(controller.gainMatrix())));
	}
}