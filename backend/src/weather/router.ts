import { Router, type NextFunction, type Request, type Response } from 'express';
import { HttpError } from '../httpError';
import { getCurrentWeather } from './service';

function queryParam(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export const weatherRouter = Router();

weatherRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await getCurrentWeather({
      city: queryParam(req.query.city),
      latitude: queryParam(req.query.latitude),
      longitude: queryParam(req.query.longitude),
    });

    res.json(report);
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }

    next(error);
  }
});
