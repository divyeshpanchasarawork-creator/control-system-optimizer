package org.divyesh.panchasara.control_system_optimizer.optimization;

/**
 * A per-candidate evaluation that, in addition to the scalar cost, carries the
 * tracking and control metrics that produced it. {@code iae} and
 * {@code controlEffort} are {@code null} for infeasible candidates. The default
 * {@link OptimizationProblem#evaluateDetail(double[])} bridges to
 * {@link OptimizationProblem#evaluate(double[])}, so optimizers only pay for the
 * extra detail when they opt in.
 *
 * <p>{@code violation} quantifies <em>how far</em> a candidate missed its
 * constraints, and exists purely so a search that finds nothing feasible can
 * still report the closest thing it saw. It is {@code 0} for a feasible
 * candidate, and otherwise a non-negative "badness" score where a larger value
 * is a worse miss; infeasible candidates all share
 * {@link Double#POSITIVE_INFINITY} as their cost, so without this field their
 * costs are indistinguishable and any comparison among them is arbitrary.
 * Producing the score is the problem's job — see
 * {@link ControlProblemFactory} for the scoring policy.
 *
 * <p>The score is a worst-case ranking key with a tier prefix, so that ordinary
 * {@code <} ordering yields the intended ranking:
 *
 * <pre>
 *   violation = tier * TIER_STEP + worstRelativeOvershoot
 * </pre>
 *
 * <p>The measured term is the <em>worst</em> relative overshoot rather than the
 * sum, because "closest to satisfying every limit" is what a user means by
 * nearest. A sum lets a candidate trade a tenfold miss on one limit for a twofold
 * saving on another and still win, which reports a near miss that is clearly
 * worse on the dimension the user cares most about.
 */
public record EvaluationDetail(double cost, Double iae, Double controlEffort, double violation) {

	/** Place value of the ranking tier; larger than any capped overshoot. */
	public static final double TIER_STEP = 1e6;

	/**
	 * Ceiling on a single limit's relative overshoot, keeping the measured term
	 * strictly below {@link #TIER_STEP} so the tier always orders first.
	 */
	public static final double REL_CAP = 999.0;

	/**
	 * A candidate that missed at least one limit it could not be measured against —
	 * a settling-time limit on a response that never settles, say. Preferred over
	 * any candidate whose misses are all quantified, because a number is
	 * actionable where "never settled" is only a symptom.
	 */
	public static final double UNQUANTIFIED = TIER_STEP;

	/**
	 * A candidate that produced no metrics at all — a destabilized loop, or a
	 * problem that does not implement
	 * {@link OptimizationProblem#evaluateDetail(double[])}. Sits above
	 * {@link #UNQUANTIFIED} because "it destabilized" is the least informative
	 * thing a failed run can report.
	 */
	public static final double NO_DIAGNOSTICS = 2 * TIER_STEP;

	/**
	 * The worst relative overshoot carried by a violation score, recovering the
	 * measured ranking key exactly. Exposed so diagnostics and tests can read the
	 * ranking without knowing how it is packed.
	 */
	public static double worstRelativeOvershoot(double violation) {
		return violation % TIER_STEP;
	}

	/**
	 * Orders an infeasible candidate against the incumbent near miss: the smaller
	 * {@code violation} wins, and cost breaks a tie between equal violations.
	 *
	 * <p>The comparison is strict on both counts, so an exact tie retains the
	 * incumbent and the caller keeps the first candidate it encountered — which
	 * is what makes the grid scan and the seeded DE run reproducible.
	 */
	public static boolean isCloserMiss(EvaluationDetail candidate, double nearestViolation, double nearestCost) {
		if (candidate.violation() != nearestViolation) {
			return candidate.violation() < nearestViolation;
		}
		return candidate.cost() < nearestCost;
	}
}