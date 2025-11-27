import { NextFunction, Request, Response } from 'express';
import { Collaborator } from '../models/collaborator';
import { Initiative } from '../models/initiative';
import { Kr } from '../models/kr';
import { Okr } from '../models/okr';

export async function loadOkr(req: Request, res: Response, next: NextFunction) {
  const id = Number(req.params.okrId || req.params.id);

  const okr = await Okr.findByPk(id, {
    include: [
      {
        model: Initiative,
        as: 'initiative',
        include: [
          { model: Collaborator, as: 'owner' },
          { model: Collaborator, as: 'managers' },
        ],
      },
      { model: Kr, as: 'krs' },
    ],
  });

  if (!okr) return res.status(404).json({ error: 'OKR not found' });

  req.okr = okr;
  next();
}
