import {
  MEDIA_TYPES,
  NEGATIVE_THEME_TERMS,
  getExcludedGenreIds,
  normalizeText
} from '../domain/emotion-catalog.js';

const HORROR_GENRE_ID = 27;

function round(value) {
  return Math.round(value * 100) / 100;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSearchText(candidate) {
  return normalizeText(`${candidate.title ?? ''} ${candidate.overview ?? ''}`);
}

function countTermMatches(text, terms) {
  if (text.length === 0) {
    return 0;
  }

  return terms.reduce((count, term) => {
    const normalizedTerm = normalizeText(term);
    if (normalizedTerm.length === 0) {
      return count;
    }

    const pattern = new RegExp(`\\b${escapeRegExp(normalizedTerm)}\\b`);
    return pattern.test(text) ? count + 1 : count;
  }, 0);
}

export function getThemeMatchCounts(candidate, goal) {
  const text = buildSearchText(candidate);

  return {
    positive: countTermMatches(text, goal.themes),
    negative: countTermMatches(text, NEGATIVE_THEME_TERMS)
  };
}

export function isCandidateExcluded(candidate, mediaType, goal) {
  const genreIds = Array.isArray(candidate.genreIds) ? candidate.genreIds : [];
  const excludedGenreIds = getExcludedGenreIds(mediaType);

  if (excludedGenreIds.some((genreId) => genreIds.includes(genreId))) {
    return true;
  }

  if (mediaType === MEDIA_TYPES.MOVIE && genreIds.includes(HORROR_GENRE_ID)) {
    return true;
  }

  const { positive, negative } = getThemeMatchCounts(candidate, goal);

  return negative >= 2 && negative > positive;
}

export function scoreGenres(genreIds, goalGenreIds) {
  if (!Array.isArray(genreIds) || goalGenreIds.length === 0) {
    return 0;
  }

  const bestRank = goalGenreIds.findIndex((genreId) => genreIds.includes(genreId));

  if (bestRank === -1) {
    return 0;
  }

  return round(((goalGenreIds.length - bestRank) / goalGenreIds.length) * 40);
}

export function scoreThemes(candidate, goal, { keywordMatch = false } = {}) {
  const { positive, negative } = getThemeMatchCounts(candidate, goal);
  const totalMatches = positive + negative;
  const textScore = totalMatches === 0 ? 0 : (positive / totalMatches) * 20;
  const keywordScore = keywordMatch ? 20 : 0;

  return round(keywordScore + textScore);
}

export function scoreQuality(voteAverage, voteCount) {
  const average = clamp(Number(voteAverage) || 0, 0, 10);
  const votes = Math.max(Number(voteCount) || 0, 0);
  const confidence = Math.min(1, Math.log10(votes + 1) / 4);
  const averageScore = (average / 10) * 10;
  const confidenceScore = confidence * 10;

  return round(averageScore + confidenceScore);
}

export function scoreCandidate(candidate, goal, { mediaType, keywordMatch = false } = {}) {
  const goalGenreIds = mediaType === MEDIA_TYPES.TV
    ? goal.tvGenreIds
    : goal.movieGenreIds;
  const genreScore = scoreGenres(candidate.genreIds, goalGenreIds);
  const thematicScore = scoreThemes(candidate, goal, { keywordMatch });
  const qualityScore = scoreQuality(candidate.voteAverage, candidate.voteCount);
  const { positive, negative } = getThemeMatchCounts(candidate, goal);

  return {
    totalScore: round(genreScore + thematicScore + qualityScore),
    genreScore,
    thematicScore,
    qualityScore,
    positiveThemeMatches: positive,
    negativeThemeMatches: negative
  };
}
