import { TokenClaims } from "../utils/authClaims";

declare global {
  namespace Express {
    interface Request {
      user?: TokenClaims;
    }
  }
}

export {};
