import { DataTypes, Model } from 'sequelize';

export interface BaseAuditAttributes {
  id?: number;
  createdBy?: string | null;
  createdDate?: Date | null;
  lastModifiedBy?: string | null;
  lastModifiedDate?: Date | null;
}

export class AbstractOkrPersistable<
  TAttributes extends BaseAuditAttributes,
  TCreationAttributes extends Partial<TAttributes> = Partial<TAttributes>,
> extends Model<TAttributes, TCreationAttributes> {
  declare id: number;

  declare createdBy: string | null;
  declare createdDate: Date | null;
  declare lastModifiedBy: string | null;
  declare lastModifiedDate: Date | null;
}

export const auditFields = {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  createdBy: { type: DataTypes.STRING },
  createdDate: { type: DataTypes.DATE },
  lastModifiedBy: { type: DataTypes.STRING },
  lastModifiedDate: { type: DataTypes.DATE },
};
