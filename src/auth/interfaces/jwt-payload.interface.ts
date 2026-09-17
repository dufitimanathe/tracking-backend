export type JwtTokenType = 'access' | 'refresh';

export interface AuthJwtPayload {
  sub: string;
  email?: string;
  type: JwtTokenType;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
