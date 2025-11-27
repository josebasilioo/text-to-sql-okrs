import { NextFunction, Request, Response } from 'express';
import { Collaborator } from '../models/collaborator';
import { Kr } from '../models/kr';
import { KrHistory } from '../models/krHistory';

export async function loadKrHistory(req: Request, res: Response, next: NextFunction) {
  const id = Number(req.params.historyId || req.params.id);

  const krHistory = await KrHistory.findByPk(id, {
    include: [
      {
        model: Kr,
        as: 'kr',
      },
      {
        model: Collaborator,
        as: 'collaborator',
      },
    ],
  });

  if (!krHistory) {
    return res.status(404).json({ error: 'KrHistory not found' });
  }

  req.krHistory = krHistory;
  next();
}
