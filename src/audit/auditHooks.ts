import { Model } from 'sequelize';
import { AuditCreateOptions, AuditUpdateOptions } from '../types/audit';

export const auditHooks = {
  beforeCreate: (instance: Model<any, any>, options: AuditCreateOptions) => {
    const user = options.user ?? 'system';

    instance.set({
      createdBy: user,
      lastModifiedBy: user,
      createdDate: new Date(),
      lastModifiedDate: new Date(),
    });
  },

  beforeUpdate: (instance: Model<any, any>, options: AuditUpdateOptions) => {
    const user = options.user ?? 'system';

    instance.set({
      lastModifiedBy: user,
      lastModifiedDate: new Date(),
    });
  },
};
