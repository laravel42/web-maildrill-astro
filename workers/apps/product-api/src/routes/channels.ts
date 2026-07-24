import type { FastifyInstance } from "fastify";
import { authenticate } from "@maildrill/authz";
import { getChannelSenders } from "@maildrill/product";

const TAG = ["Channels"];

export async function channelRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get(
    "/v1/channels/senders",
    { schema: { tags: TAG, summary: "Configured outbound sender display per channel" } },
    async () => getChannelSenders(),
  );
}
