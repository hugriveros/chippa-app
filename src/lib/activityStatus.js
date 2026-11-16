export function activityStatus(state, id, userId = state?.activeUserId) {
  const member = state?.memberData?.[userId] || {};
  const shared = state?.shared || {};
  const game = shared.game || {};
  if (member.completedActivities?.[id]) return true;
  const conditions = {
    moment: member.moment?.ready,
    letters: member.letters?.length > 0,
    questions: member.questions?.length > 0,
    same: game.sameFinished || game.sameIndex >= 7,
    trivia: game.triviaFinished || game.triviaIndex >= 5,
    story: game.storyFinished || game.storyIndex >= 7,
    memory: game.matchedPairs >= 4,
    missions: shared.missions?.length >= 4,
    next: Boolean(shared.selectedPlan),
    plans: shared.plans?.length > 0,
    capsule: member.memories?.length > 0 || shared.memories?.some((entry) => entry.ownerId === userId && entry.id !== 'memory-welcome'),
    future: member.future?.length > 0,
    playlist: shared.songs?.some((entry) => entry.ownerId === userId),
    'memory-bingo': member.bingo?.completed,
    'couple-quiz': member.coupleQuiz?.completed,
    'guess-the-place': member.placeGame?.completed
  };
  return Boolean(conditions[id]);
}

export function completionRecord(member, ids, now = new Date().toISOString()) {
  return { ...member, completedActivities: { ...member.completedActivities, ...Object.fromEntries(ids.filter((id) => !member.completedActivities?.[id]).map((id) => [id, now])) } };
}

export const premiumKey = (identity) => `chippa-premium-simulation-v1:${identity}`;
export function loadSimulatedPremium(identity) {
  try { const value = JSON.parse(localStorage.getItem(premiumKey(identity)) || 'null'); return value?.status === 'active' && value?.simulated === true; } catch { return false; }
}
