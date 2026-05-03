export interface AuthenticatedUser {
  sub: string;
  appUserId: string;
  role: 'rider';
}

export interface GoogleAuthProfile {
  subject: string;
  email?: string;
  name?: string;
}
