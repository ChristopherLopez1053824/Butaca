import { getBibleInfo, getPassage } from '../clients/bible.client.js';
import { env } from '../config/env.js';
import { getReferencesForEmotion } from '../domain/emotion-verse-catalog.js';
import { AppError, ERROR_CODES } from '../errors.js';

function unsupportedEmotionError(emotion) {
  return new AppError({
    statusCode: 400,
    code: ERROR_CODES.VALIDATION_ERROR,
    message: `No hay contenido bíblico configurado para la emoción "${emotion}"`
  });
}

function translationMismatchError(requested, actual) {
  return new AppError({
    statusCode: 400,
    code: ERROR_CODES.VALIDATION_ERROR,
    message: `La traducción "${requested}" no está disponible; este servicio solo tiene configurada "${actual}"`
  });
}

function pickReference(references) {
  const index = Math.floor(Math.random() * references.length);
  return references[index];
}

export async function getVerseForEmotion(emotion, { requestedTranslation } = {}) {
  const references = getReferencesForEmotion(emotion);

  if (!references || references.length === 0) {
    throw unsupportedEmotionError(emotion);
  }

  const bible = await getBibleInfo();

  if (
    requestedTranslation
    && requestedTranslation.toUpperCase() !== bible.abbreviation.toUpperCase()
  ) {
    throw translationMismatchError(requestedTranslation, bible.abbreviation);
  }

  const reference = pickReference(references);
  const passage = await getPassage(reference.id);

  return {
    provider: env.BIBLE_API_PROVIDER,
    translation: bible.abbreviation,
    translationName: bible.name,
    externalId: reference.id,
    reference: passage.reference,
    theme: reference.theme,
    text: passage.content,
    copyright: passage.copyright
  };
}

export const verseService = Object.freeze({ getVerseForEmotion });

export default verseService;
