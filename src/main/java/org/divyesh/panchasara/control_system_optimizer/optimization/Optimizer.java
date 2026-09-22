package org.divyesh.panchasara.control_system_optimizer.optimization;

/**
 * Generic optimizer abstraction. Optimizers operate on an
 * {@link OptimizationProblem} and never know anything about the underlying
 * physical system.
 */
public interface Optimizer {

	/** Human-readable optimizer type, echoed in API responses. */
	String type();

	/**
	 * Runs the optimization.
	 *
	 * @param problem the problem to solve
	 * @return the best parameters and supporting diagnostics
	 */
	OptimizationResult optimize(OptimizationProblem problem);
}