import { NextFunction, Request, Response } from 'express';
import { Collaborator } from '../models/collaborator';
import { Initiative } from '../models/initiative';
import { InitiativeUpdate } from '../models/initiativeUpdate';

export async function loadInitiativeUpdate(req: Request, res: Response, next: NextFunction) {
  const id = Number(req.params.updateId || req.params.id);

  const update = await InitiativeUpdate.findByPk(id, {
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
  });

  if (!update) {
    return res.status(404).json({ error: 'InitiativeUpdate not found' });
  }

  req.update = update;
  next();
}
