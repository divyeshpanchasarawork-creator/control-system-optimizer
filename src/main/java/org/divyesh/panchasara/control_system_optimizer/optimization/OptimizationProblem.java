package org.divyesh.panchasara.control_system_optimizer.optimization;

/**
 * A parameter optimization problem the optimizers can consume. It is agnostic
 * of the physical system underneath — a classic-factory wires a concrete system,
 * controller, simulator and objective behind this interface.
 */
public interface OptimizationProblem {

	/** Names of the decision parameters, one per dimension. */
	String[] parameterNames();

	/** Lower bound per parameter. */
	double[] lowerBounds();

	/** Upper bound per parameter. */
	double[] upperBounds();

	/**
	 * Evaluates the objective for a candidate parameter vector.
	 *
	 * @param candidate candidate parameters (length == parameter count)
	 * @return the cost; lower is better. Infeasible candidates must return
	 *         {@link Double#POSITIVE_INFINITY}; NaN is never a valid result.
	 */
	double evaluate(double[] candidate);

	/**
	 * Evaluates a candidate together with the tracking/control metrics that
	 * produced the cost. The default bridges to {@link #evaluate}, so problems
	 * that do not want to expose metrics inherit a metrics-free evaluation.
	 */
	default EvaluationDetail evaluateDetail(double[] candidate) {
		double cost = evaluate(candidate);
		// no detail to report on, so an infeasible candidate cannot be ranked
		// among quantified misses and takes the lowest available tier
		return new EvaluationDetail(cost, null, null,
				Double.isFinite(cost) ? 0.0 : EvaluationDetail.NO_DIAGNOSTICS);
	}
}