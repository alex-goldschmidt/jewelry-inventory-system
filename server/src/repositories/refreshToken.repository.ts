import {
  executeNonQueryAsync,
  insertAsync,
  queryFirstAsync,
} from "../config/db";
import {
  RevokedFlag,
  RevokedStatus,
} from "../dtos/projections/refreshToken.projection";

export class RefreshTokenRepository {
  static readonly tableName = "refreshToken";

  static async createRefreshTokenRecord(
    tokenHash: string,
    userId: number,
    expiration: Date
  ): Promise<number> {
    return await insertAsync(
      `INSERT INTO ${this.tableName} (tokenHash, userId, expiration) 
        VALUES (?, ?, ?)`,
      [tokenHash, userId, expiration]
    );
  }

  static async updateTokenRevokedStatus(
    tokenHash: string,
    isRevoked: RevokedFlag = 0,
    userId?: number
  ): Promise<number> {
    let userIdClause = "";
    let params: (string | RevokedFlag | number)[] = [isRevoked, tokenHash];
    if (userId) {
      userIdClause = "and userId = ?";
      params.push(userId);
    }

    return await executeNonQueryAsync(
      `UPDATE ${this.tableName} SET isRevoked = ?
        WHERE tokenHash = ? ${userIdClause}`,
      params
    );
  }

  static async revokeActiveTokenByHash(
    tokenHash: string,
    userId: number
  ): Promise<number> {
    return await executeNonQueryAsync(
      `UPDATE ${this.tableName} SET isRevoked = 1
        WHERE tokenHash = ? AND userId = ? AND isRevoked = 0`,
      [tokenHash, userId]
    );
  }

  static async revokeAllActiveTokensForUser(userId: number): Promise<number> {
    return await executeNonQueryAsync(
      `UPDATE ${this.tableName} SET isRevoked = 1
        WHERE userId = ? AND isRevoked = 0`,
      [userId]
    );
  }

  static async queryByUserIdAndTokenHash(
    userId: number,
    tokenHash: string
  ): Promise<RevokedStatus | null> {
    return await queryFirstAsync<RevokedStatus>(
      `SELECT isRevoked, expiration FROM ${this.tableName} WHERE userId = ? AND tokenHash = ?`,
      [userId, tokenHash]
    );
  }
}
