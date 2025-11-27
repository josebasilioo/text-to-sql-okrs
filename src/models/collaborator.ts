import { DataTypes, Optional } from 'sequelize';
import { AbstractOkrPersistable, auditFields } from '../audit/AbstractOkrPersistable';
import { sequelize } from '../database/sequelize';

// ========== Interfaces ==========

export interface CollaboratorAttributes {
  id: number;
  login: string;
  name: string;
  email: string;
  active: boolean;

  createdBy?: string | null;
  createdDate?: Date | null;
  lastModifiedBy?: string | null;
  lastModifiedDate?: Date | null;
}

export interface CollaboratorCreationAttributes
  extends Optional<CollaboratorAttributes, 'id' | 'active'> {}

// ========== Model ==========

export class Collaborator
  extends AbstractOkrPersistable<CollaboratorAttributes, CollaboratorCreationAttributes>
  implements CollaboratorAttributes
{
  declare id: number;
  declare login: string;
  declare name: string;
  declare email: string;
  declare active: boolean;

  declare createdBy: string | null;
  declare createdDate: Date | null;
  declare lastModifiedBy: string | null;
  declare lastModifiedDate: Date | null;
}

// ========== Initialization ==========
Collaborator.init(
  {
    login: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },

    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },

    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        isEmail: true,
      },
    },

    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },

    ...auditFields,
  },
  {
    sequelize,
    tableName: 'collaborators',
    modelName: 'Collaborator',
    timestamps: false, // usamos createdDate/lastModifiedDate
  }
);
