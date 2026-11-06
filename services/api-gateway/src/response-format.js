// Emotion Service responde con { success, data } y { success: false, error }.
// El Gateway lo convierte al formato común del contrato para que el frontend
// reciba siempre { status, data } o { status, code, message }.

const CODE_MAP = {
  INVALID_PARAMETERS: 'VALIDATION_ERROR',
  INVALID_DATE_RANGE: 'VALIDATION_ERROR',
  EMOTION_NOT_FOUND: 'NOT_FOUND',
  INTERNAL_SERVER_ERROR: 'INTERNAL_ERROR'
};

export function toCommonFormat(body) {
  if (!body || typeof body !== 'object' || typeof body.success !== 'boolean') {
    return body;
  }

  if (body.success) {
    const { success, ...rest } = body;
    return { status: 'ok', ...rest };
  }

  const error = body.error ?? {};
  const result = {
    status: 'error',
    code: CODE_MAP[error.code] ?? error.code ?? 'INTERNAL_ERROR',
    message: error.message ?? 'Ocurrió un error inesperado'
  };

  if (error.details !== undefined) {
    result.details = error.details;
  }

  return result;
}
