export interface AuthInfo {
  login: string;
  email: string;
  roles: string[];

  isPartner: boolean;
  isCommittee: boolean;
}
