export function errorBody(code, message) {
  return { status: 'error', code, message };
}

export function proxyError(timedOut, route) {
  if (timedOut) {
    return {
      statusCode: 504,
      body: errorBody('GATEWAY_TIMEOUT', `El servicio ${route} tardó demasiado en responder`)
    };
  }

  return {
    statusCode: 503,
    body: errorBody('SERVICE_UNAVAILABLE', `El servicio ${route} no está disponible`)
  };
}