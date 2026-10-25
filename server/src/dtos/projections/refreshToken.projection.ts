import { DbProjection } from "../../types/dbTypes/dbProjection";

export type RevokedFlag = 0 | 1;

export type RevokedStatus = DbProjection<{
  isRevoked: RevokedFlag;
  expiration: string | Date;
}>;
