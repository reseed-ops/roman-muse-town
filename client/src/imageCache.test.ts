import { expect, test } from "bun:test";
import { purgeImageCaches } from "./imageCache";

// A tiny CacheStorage: names to lists of request urls.
function fakeCaches(initial: Record<string, string[]>) {
  const store = new Map(Object.entries(initial).map(([name, urls]) => [name, new Set(urls)]));
  return {
    store,
    impl: {
      async keys() { return [...store.keys()]; },
      async open(name: string) {
        const urls = store.get(name)!;
        return {
          async keys() { return [...urls].map((url) => ({ url })); },
          async delete(request: { url: string }) { return urls.delete(request.url); },
        };
      },
    } as unknown as CacheStorage,
  };
}

test("Task 64: deleting a postcard purges that image from every cache, and only that one", async () => {
  const { store, impl } = fakeCaches({
    a: ["https://town.test/blobs/postcards%2Fone.jpg?t=x&e=1&s=y", "https://town.test/blobs/postcards%2Ftwo.jpg?t=x&e=1&s=y", "https://town.test/main-abcdef12.js"],
    b: ["https://town.test/blobs/postcards%2Fone.jpg?t=x&e=2&s=z"],
  });
  expect(await purgeImageCaches("https://town.test/blobs/postcards%2Fone.jpg?t=x&e=9&s=q", impl)).toBe(2);
  expect([...store.get("a")!]).toEqual(["https://town.test/blobs/postcards%2Ftwo.jpg?t=x&e=1&s=y", "https://town.test/main-abcdef12.js"]);
  expect([...store.get("b")!]).toEqual([]);
});

test("Task 64: a restore or reset purges every private image and nothing else; a missing or broken cache is harmless", async () => {
  const { store, impl } = fakeCaches({ a: ["https://town.test/blobs/x.jpg?e=1", "https://town.test/blobs/y.jpg?e=1", "https://town.test/index.html"] });
  expect(await purgeImageCaches(undefined, impl)).toBe(2);
  expect([...store.get("a")!]).toEqual(["https://town.test/index.html"]);
  expect(await purgeImageCaches(undefined, undefined)).toBe(0);
  expect(await purgeImageCaches(undefined, { keys: async () => { throw new Error("blocked"); } } as unknown as CacheStorage)).toBe(0);
});
