export function validate(schemas) {
  return function validateRequest(req, res, next) {
    const validated = {};

    for (const [source, schema] of Object.entries(schemas)) {
      const result = schema.safeParse(req[source]);

      if (!result.success) {
        return next(result.error);
      }

      validated[source] = result.data;
    }

    req.validated = validated;

    return next();
  };
}
