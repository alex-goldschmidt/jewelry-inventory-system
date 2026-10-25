import { ICacheClient, CacheSetOptions } from "./cache.types";
import { NoopCacheClient } from "./noop.cache";

export class CacheService {
  private static client: ICacheClient = new NoopCacheClient();

  static configure(client: ICacheClient): void {
    this.client = client;
  }

  static reset(): void {
    this.client = new NoopCacheClient();
  }

  static async get<T>(key: string): Promise<T | null> {
    return await this.client.get<T>(key);
  }

  static async set<T>(
    key: string,
    value: T,
    options?: CacheSetOptions
  ): Promise<void> {
    await this.client.set(key, value, options);
  }

  static async delete(key: string): Promise<void> {
    await this.client.delete(key);
  }

  static async deleteMany(keys: string[]): Promise<void> {
    await this.client.deleteMany(keys);
  }

  static async getOrSet<T>(
    key: string,
    loader: () => Promise<T>,
    options?: CacheSetOptions
  ): Promise<T> {
    const existingValue = await this.client.get<T>(key);

    if (existingValue !== null) {
      return existingValue;
    }

    const freshValue = await loader();
    await this.client.set(key, freshValue, options);

    return freshValue;
  }
}
