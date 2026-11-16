import { localDateValue } from './format.js';

export const DEMO_KEY = 'chippa-demo-v1';

export function createDemoState() {
  const created = new Date();
  return {
    mode: 'demo',
    experience: {
      id: 'demo-experience-1', title: 'Una tarde que se alargó',
      date: localDateValue(), place: 'Barrio Lastarria',
      description: 'Una cita, dos versiones y muchos recuerdos.', emoji: '🌷',
      status: 'active', createdBy: 'demo-luna',
      invitationCode: 'CHIPPA-24', invitationAccepted: true,
      cover: '', song: ''
    },
    participants: [
      { id: 'demo-luna', name: 'Luna', avatar: '🌙' },
      { id: 'demo-tomi', name: 'Tomi', avatar: '🧸' }
    ],
    activeUserId: 'demo-luna',
    experienceArchives: [],
    memberData: {
      'demo-luna': {
        moment: { favorite: 'Nos reímos tanto que se nos enfrió el café.', emoji: '☕', words: ['inesperada', 'divertida', 'cálida'], song: 'Brillas', artist: 'León Larregui', ready: false, share: false },
        same: {}, stories: {}, trivia: {}, letters: [], questions: [], future: [], preferences: {}, votes: {}
      },
      'demo-tomi': {
        moment: { favorite: '', emoji: '✨', words: [], song: '', artist: '', ready: false, share: false },
        same: {}, stories: {}, trivia: {}, letters: [], questions: [], future: [], preferences: {}, votes: {}
      }
    },
    shared: {
      memories: [
        { id: 'memory-welcome', ownerId: 'demo-luna', type: 'note', text: 'Los mejores momentos merecen quedarse.', createdAt: created.toISOString(), shared: true }
      ],
      songs: [], plans: [], missions: [], stamps: ['Barrio Lastarria'],
      game: { sameIndex: 0, storyIndex: 0, triviaIndex: 0, matchedPairs: 0, memoryBest: null },
      letterHistory: [], favorites: [], selectedPlan: null
    }
  };
}

export function loadDemoState() {
  try {
    const stored = localStorage.getItem(DEMO_KEY);
    return stored ? { ...createDemoState(), ...JSON.parse(stored) } : createDemoState();
  } catch {
    return createDemoState();
  }
}

export function saveDemoState(state) {
  try { localStorage.setItem(DEMO_KEY, JSON.stringify(state)); }
  catch { /* El prototipo sigue siendo utilizable aunque el navegador bloquee LocalStorage. */ }
}

export function resetDemoState() {
  localStorage.removeItem(DEMO_KEY);
  return createDemoState();
}
