export function shuffled(items, random = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function memorySelection(session, cardId) {
  const card = session.cards.find((entry) => entry.id === cardId);
  if (!card || session.flipped.length >= 2 || session.flipped.includes(cardId) || session.matched.includes(cardId)) return session;
  const flipped = [...session.flipped, cardId];
  if (flipped.length < 2) return { ...session, flipped };
  const first = session.cards.find((entry) => entry.id === flipped[0]);
  const match = first.pair === card.pair;
  return { ...session, flipped: match ? [] : flipped, matched: match ? [...session.matched, ...flipped] : session.matched, attempts: session.attempts + 1, turns: session.turns + (match ? 1 : 0) };
}
