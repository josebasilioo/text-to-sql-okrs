import { Collaborator } from './collaborator';
import { Initiative } from './initiative';
import { InitiativeUpdate } from './initiativeUpdate';
import { Kr } from './kr';
import { KrHistory } from './krHistory';
import { Okr } from './okr';

export function initAssociations() {
  // ============================
  // Initiative relations
  // ============================

  Initiative.belongsTo(Collaborator, {
    foreignKey: 'ownerId',
    as: 'owner',
  });

  Initiative.belongsToMany(Collaborator, {
    through: 'initiative_managers',
    as: 'managers',
    foreignKey: 'initiativeId',
    otherKey: 'collaboratorId',
  });

  Initiative.hasMany(Okr, {
    foreignKey: 'initiativeId',
    as: 'okrs',
  });

  Initiative.hasMany(InitiativeUpdate, {
    foreignKey: 'initiativeId',
    as: 'updates',
    onDelete: 'CASCADE',
  });

  // ============================
  // OKR relations
  // ============================

  Okr.belongsTo(Initiative, {
    foreignKey: 'initiativeId',
    as: 'initiative',
  });

  Okr.hasMany(Kr, {
    foreignKey: 'okrId',
    as: 'krs',
  });

  // ============================
  // KR relations
  // ============================

  Kr.belongsTo(Okr, {
    foreignKey: 'okrId',
    as: 'okr',
  });

  Kr.belongsTo(Collaborator, {
    foreignKey: 'bookmarkedById',
    as: 'bookmarkedBy',
  });

  Kr.hasMany(KrHistory, {
    foreignKey: 'krId',
    as: 'krHistory',
    onDelete: 'CASCADE',
  });

  // ============================
  // KR History
  // ============================

  KrHistory.belongsTo(Kr, {
    foreignKey: 'krId',
    as: 'kr',
  });

  KrHistory.belongsTo(Collaborator, {
    foreignKey: 'collaboratorId',
    as: 'collaborator',
  });

  // ============================
  // Initiative Update
  // ============================

  InitiativeUpdate.belongsTo(Initiative, {
    foreignKey: 'initiativeId',
    as: 'initiative',
  });
}
