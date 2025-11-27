import { NextFunction, Request, Response } from 'express';
import { Collaborator } from '../models/collaborator';
import { Initiative } from '../models/initiative';
import { Kr } from '../models/kr';
import { KrHistory } from '../models/krHistory';
import { Okr } from '../models/okr';

export async function loadKr(req: Request, res: Response, next: NextFunction) {
  const id = Number(req.params.krId || req.params.id);

  const kr = await Kr.findByPk(id, {
    include: [
      {
        model: Okr,
        as: 'okr',
        include: [
          {
            model: Initiative,
            as: 'initiative',
            include: [
              { model: Collaborator, as: 'owner' },
              { model: Collaborator, as: 'managers' },
            ],
          },
        ],
      },
      {
        model: KrHistory,
        as: 'krHistory',
        include: [{ model: Collaborator, as: 'collaborator' }],
      },
      { model: Collaborator, as: 'bookmarkedBy' },
    ],
  });

  if (!kr) return res.status(404).json({ error: 'KR not found' });

  req.kr = kr;
  next();
}
