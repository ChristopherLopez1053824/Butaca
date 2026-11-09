import {
  getFavoritesCount,
  listEmotionRecords,
  listRecommendationsForEmotion
} from '../clients/services.client.js';

// Límites para acotar el trabajo de un resumen: evitan recorrer un historial
// enorme en una sola petición sin perder representatividad de los datos reales.
const MAX_EMOTION_RECORDS = 200;
const MAX_RECOMMENDATION_LOOKUPS = 30;

function dateKey(isoString) {
  return isoString.slice(0, 10);
}

async function collectEmotionRecords({ from, to, authorization }) {
  const records = [];
  let page = 1;

  while (records.length < MAX_EMOTION_RECORDS) {
    const { data, pagination } = await listEmotionRecords({
      from,
      to,
      page,
      limit: 100,
      authorization
    });

    records.push(...data);

    if (!pagination?.hasNextPage) {
      break;
    }

    page += 1;
  }

  return records;
}

function buildEmotionTimeline(records) {
  const counts = new Map();

  for (const record of records) {
    const key = `${dateKey(record.createdAt)}:${record.emotion}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([key, count]) => {
      const [date, emotion] = key.split(':');
      return { date, emotion, count };
    })
    .sort((a, b) =>
      a.date === b.date
        ? a.emotion.localeCompare(b.emotion)
        : a.date.localeCompare(b.date)
    );
}

async function buildRecommendationsByEmotion(records, { authorization }) {
  const seen = new Set();
  const uniqueRecords = [];

  for (const record of records) {
    if (seen.has(record.id)) {
      continue;
    }

    seen.add(record.id);
    uniqueRecords.push(record);

    if (uniqueRecords.length >= MAX_RECOMMENDATION_LOOKUPS) {
      break;
    }
  }

  const results = await Promise.allSettled(
    uniqueRecords.map((record) =>
      listRecommendationsForEmotion(record.id, { authorization }).then(
        (data) => ({ emotion: record.emotion, data })
      )
    )
  );

  const counts = new Map();
  let anyFailed = false;

  for (const result of results) {
    if (result.status === 'rejected') {
      anyFailed = true;
      continue;
    }

    const { emotion, data } = result.value;

    for (const recommendation of data) {
      const key = `${emotion}:${recommendation.mediaType}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  const recommendationsByEmotion = Array.from(counts.entries())
    .map(([key, count]) => {
      const [emotion, mediaType] = key.split(':');
      return { emotion, mediaType, count };
    })
    .sort((a, b) => b.count - a.count);

  return { recommendationsByEmotion, anyFailed };
}

export async function getSummary({ from, to, authorization }) {
  const unavailable = [];
  let emotionRecords = [];
  let emotionTimeline = [];

  try {
    emotionRecords = await collectEmotionRecords({ from, to, authorization });
    emotionTimeline = buildEmotionTimeline(emotionRecords);
  } catch {
    unavailable.push('emotions');
  }

  let recommendationsByEmotion = [];

  if (emotionRecords.length > 0) {
    try {
      const result = await buildRecommendationsByEmotion(emotionRecords, {
        authorization
      });

      recommendationsByEmotion = result.recommendationsByEmotion;

      if (result.anyFailed) {
        unavailable.push('movies');
      }
    } catch {
      unavailable.push('movies');
    }
  }

  let favoritesCount = 0;

  try {
    favoritesCount = await getFavoritesCount({ authorization });
  } catch {
    unavailable.push('favorites');
  }

  return {
    emotionTimeline,
    recommendationsByEmotion,
    favoritesCount,
    unavailable
  };
}
