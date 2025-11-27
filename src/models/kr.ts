import { DataTypes, Optional } from 'sequelize';
import {
  AbstractOkrPersistable,
  auditFields,
  BaseAuditAttributes,
} from '../audit/AbstractOkrPersistable';
import { sequelize } from '../database/sequelize';

import { Collaborator } from './collaborator';
import { Metric } from './enums/metric';
import { KrHistory } from './krHistory';
import { Okr } from './okr';

// ========================
// TIPOS
// ========================

export interface KrAttributes extends BaseAuditAttributes {
  id: number;

  title: string;
  metric: Metric;
  direction: string;

  progress: number;
  target: number;

  okrId: number; // FK (NotNull)

  bookmarked: boolean;
  bookmarkedById?: number | null; // FK nullable
}

export interface KrCreationAttributes
  extends Optional<KrAttributes, 'id' | 'progress' | 'target' | 'bookmarked' | 'bookmarkedById'> {}

// ========================
// MODEL
// ========================

export class Kr
  extends AbstractOkrPersistable<KrAttributes, KrCreationAttributes>
  implements KrAttributes
{
  declare id: number;

  declare title: string;
  declare metric: Metric;
  declare direction: string;
  declare progress: number;
  declare target: number;

  declare okrId: number;

  declare bookmarked: boolean;
  declare bookmarkedById: number | null;

  // Relationships
  declare okr?: Okr;
  declare bookmarkedBy?: Collaborator;
  declare krHistory?: KrHistory[];

  // Audit fields
  declare createdBy: string | null;
  declare createdDate: Date | null;
  declare lastModifiedBy: string | null;
  declare lastModifiedDate: Date | null;
}

// ========================
// INIT
// ========================

Kr.init(
  {
    ...auditFields,

    title: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: true },
    },

    metric: {
      type: DataTypes.ENUM(...Object.values(Metric)),
      allowNull: false,
      defaultValue: Metric.NUMERIC,
    },

    direction: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: true },
    },

    progress: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0,
    },

    target: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0,
    },

    okrId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'okrs',
        key: 'id',
      },
    },

    bookmarked: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    bookmarkedById: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'collaborators',
        key: 'id',
      },
    },
  },
  {
    sequelize,
    tableName: 'krs',
    modelName: 'Kr',
    timestamps: false,
  }
);

// ========================
// RELATIONSHIPS
// ========================

// KR → OKR (N:1)
// Kr.belongsTo(Okr, {
//   foreignKey: 'okrId',
//   as: 'okr',
// });

// // KR → Collaborator (N:1)
// Kr.belongsTo(Collaborator, {
//   foreignKey: 'bookmarkedById',
//   as: 'bookmarkedBy',
// });

// // KR → KRHistory (1:N)
// Kr.hasMany(KrHistory, {
//   foreignKey: 'krId',
//   as: 'krHistory',
//   onDelete: 'CASCADE', // CascadeType.REMOVE
// });
