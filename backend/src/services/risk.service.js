export function calculateRisk({ overdueTasks, blockedTasks, unresolvedDependencies, idsCount, staleDays, statusFlips, repeatedTaskDelays = 0 }) {
  const reasons = [];
  let score = 0;

  score += overdueTasks * 6;
  if (overdueTasks > 0) reasons.push(`${overdueTasks} overdue task(s)`);
  score += blockedTasks * 8;
  if (blockedTasks > 0) reasons.push(`${blockedTasks} blocked task(s)`);
  score += unresolvedDependencies * 5;
  if (unresolvedDependencies > 0) reasons.push(`${unresolvedDependencies} unresolved dependencies`);
  score += idsCount * 7;
  if (idsCount > 0) reasons.push(`${idsCount} active IDS record(s)`);
  if (staleDays > 7) {
    score += 15;
    reasons.push(`project inactive for ${staleDays} days`);
  }
  if (statusFlips >= 2) {
    score += 10;
    reasons.push("frequent PMO health changes");
  }
  if (repeatedTaskDelays >= 3) {
    score += 12;
    reasons.push(`${repeatedTaskDelays} recent task due date changes`);
  }

  const cappedScore = Math.min(score, 100);
  const level = cappedScore >= 70 ? "High" : cappedScore >= 40 ? "Medium" : "Low";
  const recommendations = [];
  if (overdueTasks) recommendations.push("Rebaseline due dates and owners for overdue tasks.");
  if (blockedTasks || unresolvedDependencies) recommendations.push("Run dependency-clearing session with owners.");
  if (idsCount) recommendations.push("Prioritize open IDS items in weekly governance.");
  if (staleDays > 7) recommendations.push("Enforce daily progress updates.");
  if (repeatedTaskDelays >= 3) recommendations.push("Review planning stability and freeze unnecessary schedule shifts.");

  return { score: cappedScore, level, reasons, recommendations };
}
