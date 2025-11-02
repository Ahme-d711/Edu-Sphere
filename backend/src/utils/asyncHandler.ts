import type { Request, Response, NextFunction } from 'express';

// دعم أي نوع إرجاع (وليس void فقط)
// eslint-disable-next-line no-unused-vars
type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export const asyncHandler = (fn: AsyncHandler) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);