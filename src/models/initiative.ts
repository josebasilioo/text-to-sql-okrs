import { DataTypes, Optional } from 'sequelize';
import {
  AbstractOkrPersistable,
  auditFields,
  BaseAuditAttributes,
} from '../audit/AbstractOkrPersistable';
import { sequelize } from '../database/sequelize';

import { Collaborator } from './collaborator';
import { InitiativeUpdate } from './initiativeUpdate';
import { Okr } from './okr';

// ========================
// TIPOS
// ========================

export interface InitiativeAttributes extends BaseAuditAttributes {
  id: number;
  title: string;
  category: string;
  description: string;
  startDate?: Date | null;
  endDate?: Date | null;
  priority: number;

  ownerId: number; // FK
}

export interface InitiativeCreationAttributes
  extends Optional<
    InitiativeAttributes,
    'id' | 'description' | 'startDate' | 'endDate' | 'priority' | 'ownerId'
  > {}

// ========================
// MODEL
// ========================

export class Initiative
  extends AbstractOkrPersistable<InitiativeAttributes, InitiativeCreationAttributes>
  implements InitiativeAttributes
{
  declare id: number;

  declare title: string;
  declare category: string;
  declare description: string;
  declare startDate: Date | null;
  declare endDate: Date | null;
  declare priority: number;

  declare ownerId: number;

  // Relations
  declare owner?: Collaborator;
  declare managers?: Collaborator[];
  declare okrs?: Okr[];
  declare updates?: InitiativeUpdate[];

  // Audit fields
  declare createdBy: string | null;
  declare createdDate: Date | null;
  declare lastModifiedBy: string | null;
  declare lastModifiedDate: Date | null;
}

// ========================
// INIT
// ========================

Initiative.init(
  {
    ...auditFields,

    title: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: true },
    },

    category: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: true },
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    startDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    endDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    priority: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: -1,
    },

    ownerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'collaborators',
        key: 'id',
      },
    },
  },
  {
    sequelize,
    tableName: 'initiatives',
    modelName: 'Initiative',
    timestamps: false, // usando campos do audit
  }
);

// ========================
// RELATIONSHIPS
// ========================

// Initiative.owner (N:1)
// Initiative.belongsTo(Collaborator, {
//   foreignKey: 'ownerId',
//   as: 'owner',
// });

// // Initiative.managers (N:N)
// Initiative.belongsToMany(Collaborator, {
//   through: 'initiative_managers',
//   as: 'managers',
//   foreignKey: 'initiativeId',
//   otherKey: 'collaboratorId',
// });

// // Initiative.okrs (1:N)
// Initiative.hasMany(Okr, {
//   foreignKey: 'initiativeId',
//   as: 'okrs',
// });

// // Initiative.updates (1:N)
// Initiative.hasMany(InitiativeUpdate, {
//   foreignKey: 'initiativeId',
//   as: 'updates',
//   onDelete: 'CASCADE', // CascadeType.REMOVE
// });
