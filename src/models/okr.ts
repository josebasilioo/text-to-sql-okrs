import { DataTypes, Optional } from 'sequelize';
import {
  AbstractOkrPersistable,
  auditFields,
  BaseAuditAttributes,
} from '../audit/AbstractOkrPersistable';
import { sequelize } from '../database/sequelize';

import { Initiative } from './initiative';
import { Kr } from './kr';

// ========================
// TIPOS
// ========================

export interface OkrAttributes extends BaseAuditAttributes {
  id: number;
  description: string;
  deadline: Date;

  initiativeId: number; // FK
}

export interface OkrCreationAttributes extends Optional<OkrAttributes, 'id' | 'initiativeId'> {}

// ========================
// MODEL
// ========================

export class Okr
  extends AbstractOkrPersistable<OkrAttributes, OkrCreationAttributes>
  implements OkrAttributes
{
  declare id: number;

  declare description: string;
  declare deadline: Date;

  declare initiativeId: number;

  // Relations
  declare initiative?: Initiative;
  declare krs?: Kr[];

  // Audit fields
  declare createdBy: string | null;
  declare createdDate: Date | null;
  declare lastModifiedBy: string | null;
  declare lastModifiedDate: Date | null;
}

// ========================
// INIT
// ========================

Okr.init(
  {
    ...auditFields,

    description: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: true },
    },

    deadline: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    initiativeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'initiatives',
        key: 'id',
      },
    },
  },
  {
    sequelize,
    tableName: 'okrs',
    modelName: 'Okr',
    timestamps: false,
  }
);

// ========================
// RELATIONSHIPS
// ========================

// Okr → Initiative (N:1)
// Okr.belongsTo(Initiative, {
//   foreignKey: 'initiativeId',
//   as: 'initiative',
// });

// // Okr → KR (1:N)
// Okr.hasMany(Kr, {
//   foreignKey: 'okrId',
//   as: 'krs',
// });
