import { 
  type Persister, 
  type PersistedQuery, 
  type PersistedClient 
} from "@tanstack/react-query-persist-client";
import { get, set, del } from "idb-keyval";

/**
 * Stage 1: Robust IndexedDB Persister (Note 2)
 * High performance storage for massive product lists.
 */
export function createIDBPersister(idbKey = "nabdh-pos-cache"): Persister {
  return {
    async persistClient(persistClient: PersistedClient) {
      await set(idbKey, persistClient);
    },
    async restoreClient() {
      return await get<PersistedClient>(idbKey);
    },
    async removeClient() {
      await del(idbKey);
    },
  };
}
