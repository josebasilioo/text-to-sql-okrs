import { DataTypes, Model, Optional } from 'sequelize';

export interface BaseAuditAttributes {
  createdBy?: string | null;
  createdDate?: Date | null;
  lastModifiedBy?: string | null;
  lastModifiedDate?: Date | null;
}

export class AuditModel<
  TAttributes extends BaseAuditAttributes = BaseAuditAttributes,
  TCreationAttributes extends Optional<TAttributes, keyof BaseAuditAttributes> = Optional<
    TAttributes,
    keyof BaseAuditAttributes
  >,
> extends Model<TAttributes, TCreationAttributes> {
  declare createdBy: string | null;
  declare createdDate: Date | null;
  declare lastModifiedBy: string | null;
  declare lastModifiedDate: Date | null;
}

export const auditFields = {
  createdBy: { type: DataTypes.STRING, allowNull: true },
  createdDate: { type: DataTypes.DATE, allowNull: true },
  lastModifiedBy: { type: DataTypes.STRING, allowNull: true },
  lastModifiedDate: { type: DataTypes.DATE, allowNull: true },
};
