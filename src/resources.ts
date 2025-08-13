// src/resources.ts
export function registerResources(server: any, getClient: () => any) {
  server.resource(
    "indexes/{indexName}",
    "Index definition + stats",
    async ({ indexName }: any) => {
      const c = getClient();
      const def = await c.getIndex(indexName);
      const stats = await c.getIndexStats(indexName);
      return {
        uri: `indexes/${indexName}`,
        mimeType: "application/json",
        metadata: {
          fieldCount: def?.fields?.length ?? 0,
          documentCount: stats?.documentCount ?? undefined,
        },
        contents: [{
          uri: `indexes/${indexName}`,
          mimeType: "application/json",
          text: JSON.stringify(def, null, 2),
        }],
      };
    }
  );

  server.resource(
    "servicestats",
    "Service-level statistics and quotas",
    async () => {
      const c = getClient();
      const stats = await c.getServiceStatistics();
      return {
        uri: "servicestats",
        mimeType: "application/json",
        contents: [{
          uri: "servicestats",
          mimeType: "application/json",
          text: JSON.stringify(stats, null, 2),
        }],
      };
    }
  );
}