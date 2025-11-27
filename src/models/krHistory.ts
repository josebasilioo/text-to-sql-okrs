import { DataTypes, Optional } from 'sequelize';
import { sequelize } from '../database/sequelize';

import { Collaborator } from './collaborator';
import { Metric } from './enums/metric';
import { Kr } from './kr';

// ========================
// TIPOS
// ========================

export interface KrHistoryAttributes {
  id: number;

  krId: number;
  metric: Metric;
  direction: string;

  progress: number;
  target: number;

  date: Date;

  collaboratorId: number;
}

export interface KrHistoryCreationAttributes
  extends Optional<KrHistoryAttributes, 'id' | 'progress' | 'target' | 'date'> {}

// ========================
// MODEL
// ========================

import { Model } from 'sequelize';

export class KrHistory
  extends Model<KrHistoryAttributes, KrHistoryCreationAttributes>
  implements KrHistoryAttributes
{
  declare id: number;

  declare krId: number;
  declare metric: Metric;
  declare direction: string;

  declare progress: number;
  declare target: number;
  declare date: Date;

  declare collaboratorId: number;

  declare kr?: Kr;
  declare collaborator?: Collaborator;
}

// ========================
// INIT
// ========================

KrHistory.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true, // sequência → autoIncrement faz o equivalente
    },

    krId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'krs',
        key: 'id',
      },
    },

    metric: {
      type: DataTypes.ENUM(...Object.values(Metric)),
      allowNull: false,
      defaultValue: Metric.NUMERIC,
    },

    direction: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
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

    date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    collaboratorId: {
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
    tableName: 'kr_history',
    modelName: 'KrHistory',
    timestamps: false, // não tem auditoria
  }
);

// ========================
// RELATIONSHIPS
// ========================

// KrHistory → KR (N:1)
// KrHistory.belongsTo(Kr, {
//   foreignKey: 'krId',
//   as: 'kr',
// });

// // KrHistory → Collaborator (N:1)
// KrHistory.belongsTo(Collaborator, {
//   foreignKey: 'collaboratorId',
//   as: 'collaborator',
// });
