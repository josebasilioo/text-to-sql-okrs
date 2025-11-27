import { Request } from 'express';
import { AuthInfo } from '../types/authInfo';

export class AuthInfoFake implements AuthInfo {
  login: string;
  email: string;
  roles: string[];

  constructor(req: Request) {
    this.email = req.user!.email;
    this.login = req.user!.login;
    this.roles = req.user!.roles;
  }

  get isPartner() {
    return this.roles.includes('partner');
  }

  get isCommittee() {
    return this.roles.includes('okr-committee') || this.roles.includes('admin');
  }
}
