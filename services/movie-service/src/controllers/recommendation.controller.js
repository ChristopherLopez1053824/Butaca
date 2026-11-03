import { recommendationService } from '../services/recommendation.service.js';

export async function generateRecommendations(req, res, next) {
  try {
    const { emotionRecordId, cursor } = req.validated.body;
    const result = await recommendationService.generate({
      userId: req.auth.userId,
      emotionRecordId,
      cursor,
      authorization: req.headers.authorization
    });

    return res.status(200).json({
      status: 'ok',
      data: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    return next(error);
  }
}

export async function listRecommendations(req, res, next) {
  try {
    const {
      emotionRecordId,
      from,
      to,
      page,
      limit
    } = req.validated.query;
    const result = await recommendationService.list({
      userId: req.auth.userId,
      emotionRecordId,
      from,
      to,
      page,
      limit
    });

    return res.status(200).json({
      status: 'ok',
      data: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    return next(error);
  }
}
