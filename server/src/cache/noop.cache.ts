import { ICacheClient, CacheSetOptions } from "./cache.types";

export class NoopCacheClient implements ICacheClient {
  async get<T>(_key: string): Promise<T | null> {
    return null;
  }

  async set<T>(
    _key: string,
    _value: T,
    _options?: CacheSetOptions
  ): Promise<void> {
    return;
  }

  async delete(_key: string): Promise<void> {
    return;
  }

  async deleteMany(_keys: string[]): Promise<void> {
    return;
  }

  async clear(): Promise<void> {
    return;
  }
}
