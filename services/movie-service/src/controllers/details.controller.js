import { getMovieDetails, getTvDetails } from '../clients/tmdb.client.js';

export async function getDetails(req, res, next) {
  try {
    const { tmdbId } = req.validated.params;
    const { mediaType } = req.validated.query;
    const data = mediaType === 'MOVIE'
      ? await getMovieDetails(tmdbId)
      : await getTvDetails(tmdbId);

    return res.status(200).json({
      status: 'ok',
      data
    });
  } catch (error) {
    return next(error);
  }
}
