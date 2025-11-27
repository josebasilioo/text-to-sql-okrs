import { DataTypes, Optional } from 'sequelize';
import {
  AbstractOkrPersistable,
  auditFields,
  BaseAuditAttributes,
} from '../audit/AbstractOkrPersistable';
import { sequelize } from '../database/sequelize';

import { Initiative } from './initiative';

// ========================
// TIPOS
// ========================

export interface InitiativeUpdateAttributes extends BaseAuditAttributes {
  id: number;

  yearMonth: string; // "YYYY-MM"

  highlights: string;
  brutalFacts: string;
  nextSteps: string;

  initiativeId: number;
}

export interface InitiativeUpdateCreationAttributes
  extends Optional<InitiativeUpdateAttributes, 'id' | 'highlights' | 'brutalFacts' | 'nextSteps'> {}

// ========================
// MODEL
// ========================

export class InitiativeUpdate
  extends AbstractOkrPersistable<InitiativeUpdateAttributes, InitiativeUpdateCreationAttributes>
  implements InitiativeUpdateAttributes
{
  declare id: number;

  declare yearMonth: string;
  declare highlights: string;
  declare brutalFacts: string;
  declare nextSteps: string;

  declare initiativeId: number;

  declare initiative?: Initiative;

  // Audit
  declare createdBy: string | null;
  declare createdDate: Date | null;
  declare lastModifiedBy: string | null;
  declare lastModifiedDate: Date | null;
}

// ========================
// INIT
// ========================

InitiativeUpdate.init(
  {
    ...auditFields,

    yearMonth: {
      type: DataTypes.STRING(7), // ex: "2025-03"
      allowNull: false,
      validate: {
        is: /^\d{4}-\d{2}$/,
      },
      defaultValue: () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      },
    },

    highlights: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '',
    },

    brutalFacts: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '',
    },

    nextSteps: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '',
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
    tableName: 'initiative_updates',
    modelName: 'InitiativeUpdate',
    timestamps: false,
  }
);

// ========================
// RELATIONSHIPS
// ========================

// InitiativeUpdate.belongsTo(Initiative, {
//   foreignKey: 'initiativeId',
//   as: 'initiative',
// });
