import {
  queryFirstAsync,
  queryListAsync,
  insertAsync,
  executeNonQueryAsync,
} from "../config/db";
import { AuthUserDTO } from "../dtos/projections/user.projection";
import { UserDTO } from "../dtos/user.dto";
import { CreateUserRecord } from "../types/createUserRecord";

export class UserRepository {
  static readonly tableName = "user";

  static async queryAllUsers(): Promise<UserDTO[]> {
    return await queryListAsync<UserDTO>(`SELECT * FROM ${this.tableName}`);
  }

  static async queryByUserId(userId: number): Promise<UserDTO | null> {
    return await queryFirstAsync<UserDTO>(
      `SELECT * FROM ${this.tableName} WHERE userId = ?`,
      [userId]
    );
  }

  static async queryByEmail(email: string): Promise<AuthUserDTO | null> {
    return await queryFirstAsync<AuthUserDTO>(
      `SELECT userId, email, password FROM ${this.tableName} WHERE email = ?`,
      [email]
    );
  }

  static async createUser(newUser: CreateUserRecord): Promise<number> {
    return await insertAsync(
      `INSERT INTO ${this.tableName} (email, password) 
      VALUES (?, ?)`,
      [newUser.email, newUser.password]
    );
  }

  static async deleteUser(userId: number): Promise<number> {
    return await executeNonQueryAsync(
      `DELETE FROM ${this.tableName} WHERE userId = ?`,
      [userId]
    );
  }
}
