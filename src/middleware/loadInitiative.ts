import { NextFunction, Request, Response } from 'express';
import { Collaborator } from '../models/collaborator';
import { Initiative } from '../models/initiative';
import { InitiativeUpdate } from '../models/initiativeUpdate';
import { Okr } from '../models/okr';

export async function loadInitiative(req: Request, res: Response, next: NextFunction) {
  const id = Number(req.params.initiativeId || req.params.id);

  const initiative = await Initiative.findByPk(id, {
    include: [
      { model: Collaborator, as: 'owner' },
      { model: Collaborator, as: 'managers' },
      { model: Okr, as: 'okrs' },
      { model: InitiativeUpdate, as: 'updates' },
    ],
  });

  if (!initiative) {
    return res.status(404).json({ error: 'Initiative not found' });
  }

  req.initiative = initiative;
  next();
}
