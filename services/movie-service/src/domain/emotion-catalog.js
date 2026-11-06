export const MEDIA_TYPES = Object.freeze({
  MOVIE: 'MOVIE',
  TV: 'TV'
});

export const NEGATIVE_THEME_TERMS = Object.freeze([
  'abuse',
  'abuso',
  'assault',
  'asesinato',
  'cancer',
  'cruelty',
  'crueldad',
  'death',
  'disease',
  'enfermedad',
  'execution',
  'grief',
  'guerra',
  'horror',
  'kidnapping',
  'kill',
  'killing',
  'massacre',
  'murder',
  'muerte',
  'nightmare',
  'pesadilla',
  'rape',
  'revenge',
  'suicide',
  'suffering',
  'sufrimiento',
  'terror',
  'torture',
  'tragedia',
  'tragedy',
  'trauma',
  'violence',
  'violent',
  'violencia',
  'war'
]);

export const EMOTION_GOALS = Object.freeze({
  JOY: Object.freeze({
    key: 'JOY',
    label: 'Alegría',
    movieGenreIds: Object.freeze([35, 16, 12, 10751]),
    tvGenreIds: Object.freeze([35, 16, 10759, 10751]),
    themes: Object.freeze(['friendship', 'humor', 'celebration', 'happy ending', 'comedy'])
  }),
  CALM: Object.freeze({
    key: 'CALM',
    label: 'Calma',
    movieGenreIds: Object.freeze([16, 10749, 10751]),
    tvGenreIds: Object.freeze([16, 10751]),
    themes: Object.freeze(['nature', 'peace', 'relaxation', 'healing', 'harmony'])
  }),
  SAFETY: Object.freeze({
    key: 'SAFETY',
    label: 'Seguridad',
    movieGenreIds: Object.freeze([12, 10751, 14]),
    tvGenreIds: Object.freeze([10759, 10751, 10765]),
    themes: Object.freeze(['courage', 'bravery', 'protection', 'overcoming fear', 'heroism'])
  }),
  ACCEPTANCE: Object.freeze({
    key: 'ACCEPTANCE',
    label: 'Aceptación',
    movieGenreIds: Object.freeze([35, 10751, 16]),
    tvGenreIds: Object.freeze([35, 10751, 16]),
    themes: Object.freeze(['acceptance', 'inclusion', 'diversity', 'belonging', 'tolerance'])
  }),
  TRANQUILITY: Object.freeze({
    key: 'TRANQUILITY',
    label: 'Tranquilidad',
    movieGenreIds: Object.freeze([10751, 10749, 16]),
    tvGenreIds: Object.freeze([10751, 16]),
    themes: Object.freeze(['hope', 'peace', 'reconciliation', 'second chances', 'family'])
  }),
  EMPATHY: Object.freeze({
    key: 'EMPATHY',
    label: 'Empatía',
    movieGenreIds: Object.freeze([35, 10751, 16, 99]),
    tvGenreIds: Object.freeze([35, 10751, 16, 99]),
    themes: Object.freeze(['compassion', 'kindness', 'helping others', 'friendship', 'community'])
  }),
  MOTIVATION: Object.freeze({
    key: 'MOTIVATION',
    label: 'Motivación',
    movieGenreIds: Object.freeze([12, 28, 36, 99]),
    tvGenreIds: Object.freeze([10759, 99]),
    themes: Object.freeze(['perseverance', 'determination', 'achievement', 'personal growth', 'overcoming obstacles'])
  }),
  CLARITY: Object.freeze({
    key: 'CLARITY',
    label: 'Claridad',
    movieGenreIds: Object.freeze([99, 9648, 36]),
    tvGenreIds: Object.freeze([99, 9648]),
    themes: Object.freeze(['discovery', 'learning', 'knowledge', 'mystery', 'investigation', 'solving a mystery'])
  }),
  SELF_CONFIDENCE: Object.freeze({
    key: 'SELF_CONFIDENCE',
    label: 'Confianza personal',
    movieGenreIds: Object.freeze([35, 10749, 10751]),
    tvGenreIds: Object.freeze([35, 10751]),
    themes: Object.freeze(['self confidence', 'self acceptance', 'self esteem', 'independence', 'personal growth'])
  }),
  ENTHUSIASM: Object.freeze({
    key: 'ENTHUSIASM',
    label: 'Entusiasmo',
    movieGenreIds: Object.freeze([12, 878, 28, 14, 10402]),
    tvGenreIds: Object.freeze([10759, 10765]),
    themes: Object.freeze(['adventure', 'exploration', 'creativity', 'discovery', 'innovation'])
  })
});

const EMOTION_ALIASES = Object.freeze({
  happy: 'JOY',
  alegria: 'JOY',
  felicidad: 'JOY',
  feliz: 'JOY',
  sad: 'JOY',
  tristeza: 'JOY',
  angry: 'CALM',
  enojo: 'CALM',
  ira: 'CALM',
  calma: 'CALM',
  serenidad: 'CALM',
  fearful: 'SAFETY',
  miedo: 'SAFETY',
  seguridad: 'SAFETY',
  disgusted: 'ACCEPTANCE',
  asco: 'ACCEPTANCE',
  agrado: 'ACCEPTANCE',
  aceptacion: 'ACCEPTANCE',
  surprised: 'TRANQUILITY',
  'sorpresa negativa': 'TRANQUILITY',
  tranquilidad: 'TRANQUILITY',
  tired: 'CALM',
  neutral: 'CALM',
  desprecio: 'EMPATHY',
  respeto: 'EMPATHY',
  empatia: 'EMPATHY',
  frustracion: 'MOTIVATION',
  satisfaccion: 'MOTIVATION',
  motivacion: 'MOTIVATION',
  confusion: 'CLARITY',
  comprension: 'CLARITY',
  claridad: 'CLARITY',
  verguenza: 'SELF_CONFIDENCE',
  'aceptacion personal': 'SELF_CONFIDENCE',
  'confianza personal': 'SELF_CONFIDENCE',
  autoconfianza: 'SELF_CONFIDENCE',
  aburrimiento: 'ENTHUSIASM',
  interes: 'ENTHUSIASM',
  entusiasmo: 'ENTHUSIASM'
});

export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function getGoalForEmotion(emotion) {
  const key = EMOTION_ALIASES[normalizeText(emotion)];
  return key ? EMOTION_GOALS[key] : null;
}

export function getGoalGenres(goal, mediaType) {
  return mediaType === MEDIA_TYPES.TV ? goal.tvGenreIds : goal.movieGenreIds;
}

export function getExcludedGenreIds(mediaType) {
  return mediaType === MEDIA_TYPES.MOVIE ? Object.freeze([18, 27]) : Object.freeze([18]);
}
