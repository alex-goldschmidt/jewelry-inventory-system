import { hash, Options, Algorithm } from "@node-rs/argon2";

export async function hashPassword(password: string): Promise<string> {
  try {
    //options config: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
    const options: Options = {
      algorithm: Algorithm.Argon2id,
      memoryCost: 19 * 1024,
      timeCost: 2,
      parallelism: 1,
    };
    const hashedPassword = await hash(password, options);
    return hashedPassword;
  } catch (err) {
    console.error("Hashing failed:", err);
    throw err;
  }
}
