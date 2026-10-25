export interface CacheSetOptions {
  ttlSeconds?: number;
}

export interface ICacheClient {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: CacheSetOptions): Promise<void>;
  delete(key: string): Promise<void>;
  deleteMany(keys: string[]): Promise<void>;
  clear?(): Promise<void>;
}
