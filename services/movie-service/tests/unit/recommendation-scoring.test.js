import { describe, expect, it } from 'vitest';
import {
  EMOTION_GOALS,
  getExcludedGenreIds,
  getGoalForEmotion,
  getGoalGenres
} from '../../src/domain/emotion-catalog.js';
import {
  isCandidateExcluded,
  scoreCandidate,
  scoreGenres,
  scoreQuality,
  scoreThemes
} from '../../src/services/recommendation-scoring.service.js';

const JOY = EMOTION_GOALS.JOY;

describe('emotion catalog', () => {
  it('normaliza emociones con mayúsculas y acentos', () => {
    expect(getGoalForEmotion('HAPPY')).toBe(JOY);
    expect(getGoalForEmotion('Alegría')).toBe(JOY);
    expect(getGoalForEmotion('TRISTEZA')).toBe(JOY);
  });

  it('mapea las emociones del enum sin objetivo explícito', () => {
    expect(getGoalForEmotion('TIRED')).toBe(EMOTION_GOALS.CALM);
    expect(getGoalForEmotion('NEUTRAL')).toBe(EMOTION_GOALS.CALM);
  });

  it('devuelve null para emociones desconocidas', () => {
    expect(getGoalForEmotion('EUFORIA')).toBeNull();
  });

  it('usa los géneros correctos según el tipo de medio', () => {
    expect(getGoalGenres(JOY, 'MOVIE')).toEqual([35, 16, 12, 10751]);
    expect(getGoalGenres(JOY, 'TV')).toEqual([35, 16, 10759, 10751]);
    expect(getExcludedGenreIds('MOVIE')).toEqual([18, 27]);
    expect(getExcludedGenreIds('TV')).toEqual([18]);
  });
});

describe('recommendation scoring', () => {
  it('prioriza los géneros en el orden aprobado', () => {
    expect(scoreGenres([35], JOY.movieGenreIds)).toBe(40);
    expect(scoreGenres([16], JOY.movieGenreIds)).toBe(30);
    expect(scoreGenres([12], JOY.movieGenreIds)).toBe(20);
    expect(scoreGenres([10751], JOY.movieGenreIds)).toBe(10);
    expect(scoreGenres([18], JOY.movieGenreIds)).toBe(0);
  });

  it('calcula la calidad con promedio y confianza por votos', () => {
    expect(scoreQuality(10, 10000)).toBe(20);
    expect(scoreQuality(0, 0)).toBe(0);
    expect(scoreQuality(8, 999)).toBeGreaterThan(scoreQuality(8, 10));
  });

  it('combina coincidencia de keyword y texto positivo', () => {
    const candidate = {
      title: 'Amigos',
      overview: 'Una historia de friendship y humor'
    };

    expect(scoreThemes(candidate, JOY, { keywordMatch: true })).toBe(40);
    expect(scoreThemes(candidate, JOY, { keywordMatch: false })).toBe(20);
  });

  it('excluye Drama, Horror en películas y predominio negativo', () => {
    expect(isCandidateExcluded({ genreIds: [18], overview: '' }, 'MOVIE', JOY)).toBe(true);
    expect(isCandidateExcluded({ genreIds: [27], overview: '' }, 'MOVIE', JOY)).toBe(true);
    expect(isCandidateExcluded({ genreIds: [27], overview: 'friendship' }, 'TV', JOY)).toBe(false);
    expect(isCandidateExcluded({
      genreIds: [35],
      overview: 'murder death violence friendship'
    }, 'MOVIE', JOY)).toBe(true);
  });

  it('suma los tres componentes sobre 100', () => {
    const candidate = {
      genreIds: [35],
      title: 'Amigos',
      overview: 'friendship humor',
      voteAverage: 10,
      voteCount: 10000
    };

    expect(scoreCandidate(candidate, JOY, {
      mediaType: 'MOVIE',
      keywordMatch: true
    })).toMatchObject({
      totalScore: 100,
      genreScore: 40,
      thematicScore: 40,
      qualityScore: 20
    });
  });
});
