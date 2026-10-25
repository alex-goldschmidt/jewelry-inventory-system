import { CacheService, NoopCacheClient } from "../../src/cache";

describe("CacheService", () => {
  beforeEach(() => {
    CacheService.reset();
  });

  afterEach(() => {
    CacheService.reset();
    jest.restoreAllMocks();
  });

  it("returns null by default when no cache client is configured", async () => {
    const result = await CacheService.get("items:all");

    expect(result).toBeNull();
  });

  it("uses the configured cache client", async () => {
    const client = new NoopCacheClient();
    const get = jest.spyOn(client, "get").mockResolvedValueOnce({ itemId: 1 });
    const set = jest.spyOn(client, "set");
    CacheService.configure(client);

    await CacheService.set("items:1", { itemId: 1 });

    const result = await CacheService.get<{ itemId: number }>("items:1");

    expect(result).toEqual({ itemId: 1 });
    expect(get).toHaveBeenCalledWith("items:1");
    expect(set).toHaveBeenCalledWith("items:1", { itemId: 1 }, undefined);
  });

  it("loads and caches a missing value", async () => {
    const client = new NoopCacheClient();
    jest.spyOn(client, "get")
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(["cached result"]);
    const set = jest.spyOn(client, "set");
    CacheService.configure(client);
    const loader = jest.fn(async () => ["cached result"]);

    const firstResult = await CacheService.getOrSet("items:all", loader);
    const secondResult = await CacheService.getOrSet("items:all", loader);

    expect(firstResult).toEqual(["cached result"]);
    expect(secondResult).toEqual(["cached result"]);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith("items:all", ["cached result"], undefined);
  });
});
