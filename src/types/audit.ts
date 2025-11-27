import { CreateOptions, UpdateOptions } from 'sequelize';

export interface AuditCreateOptions extends CreateOptions {
  user?: string;
}

export interface AuditUpdateOptions extends UpdateOptions {
  user?: string;
}
