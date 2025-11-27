// src/types/express.d.ts
import type { AuthInfo } from '../auth/AuthInfo'; // sua interface AuthInfo
import type { Collaborator } from '../models/Collaborator';
import type { Initiative } from '../models/Initiative';
import type { InitiativeUpdate } from '../models/InitiativeUpdate';
import type { Kr } from '../models/Kr';
import type { KrHistory } from '../models/KrHistory';
import type { Okr } from '../models/Okr';

declare global {
  namespace Express {
    interface Request {
      user?: {
        email: string;
        login: string;
        roles: string[];
      };
      auth?: AuthInfo;

      // os carregamentos por loaders
      kr?: Kr;
      okr?: Okr;
      initiative?: Initiative;
      update?: InitiativeUpdate;
      collaborator?: Collaborator;
      krHistory?: KrHistory;
    }
  }
}
