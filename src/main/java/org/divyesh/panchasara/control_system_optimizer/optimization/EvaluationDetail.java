package org.divyesh.panchasara.control_system_optimizer.optimization;

/**
 * A per-candidate evaluation that, in addition to the scalar cost, carries the
 * tracking and control metrics that produced it. {@code iae} and
 * {@code controlEffort} are {@code null} for infeasible candidates. The default
 * {@link OptimizationProblem#evaluateDetail(double[])} bridges to
 * {@link OptimizationProblem#evaluate(double[])}, so optimizers only pay for the
 * extra detail when they opt in.
 */
public record EvaluationDetail(double cost, Double iae, Double controlEffort) {
}