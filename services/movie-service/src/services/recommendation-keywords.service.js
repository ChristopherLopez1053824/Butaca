import { searchKeywords } from '../clients/tmdb.client.js';
import { normalizeText } from '../domain/emotion-catalog.js';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map();

function getCached(key, now) {
  const entry = cache.get(key);

  if (!entry || entry.expiresAt <= now) {
    cache.delete(key);
    return undefined;
  }

  return entry.value;
}

function setCached(key, value, now) {
  cache.set(key, {
    value,
    expiresAt: now + CACHE_TTL_MS
  });
}

async function resolveKeywordId(term, { search, now }) {
  const normalizedTerm = normalizeText(term);
  const cached = getCached(normalizedTerm, now);

  if (cached !== undefined) {
    return cached;
  }

  const response = await search(normalizedTerm);
  const match = response.results.find((keyword) => (
    normalizeText(keyword.name) === normalizedTerm
  ));
  const keywordId = match?.id ?? null;

  setCached(normalizedTerm, keywordId, now);
  return keywordId;
}

export async function resolveKeywordIds(terms, { search = searchKeywords, now = Date.now() } = {}) {
  const uniqueTerms = [...new Set(terms.map(normalizeText).filter(Boolean))];
  const keywordIds = await Promise.all(
    uniqueTerms.map((term) => resolveKeywordId(term, { search, now }))
  );

  return [...new Set(keywordIds.filter((keywordId) => Number.isInteger(keywordId)))];
}

export function clearKeywordCache() {
  cache.clear();
}
