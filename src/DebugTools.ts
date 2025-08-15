import { z } from "zod";
import type { ToolContext } from "./types";
import { elicitIfNeeded } from "./utils/elicitation-integration";
import { ResponseFormatter } from "./utils/response";

export function registerDebugTools(server: any, context: ToolContext) {
  const rf = new ResponseFormatter(() => null);

  server.tool(
    "debugElicitation",
    "Report runtime elicitation availability and optionally trigger a test elicitation.",
    {
      performTest: z.boolean().optional().default(false).describe("If true, attempts a simple elicitation ping")
    },
    { streaming: false },
    async ({ performTest }: { performTest?: boolean }) => {
      const agent: any = context.agent;
      const serverObj: any = (context as any).server || undefined;

      const info = {
        advertised: true,
        paths: {
          agentHasElicitInput: !!agent?.elicitInput,
          serverHasElicitInput: !!(serverObj?.elicitInput),
          contextHasElicitInput: !!(context as any)?.elicitInput,
        },
      } as any;

      if (performTest) {
        const started = Date.now();
        const result = await elicitIfNeeded(context.agent || (server as any), {
          message: "Test elicitation: please confirm to continue",
          requestedSchema: {
            type: "object",
            properties: {
              confirm: { type: "string", enum: ["OK"] },
            },
            required: ["confirm"],
          },
        });
        info.testResult = result || null;
        info.testDurationMs = Date.now() - started;
        if (!result) {
          info.note = "No elicitation response received (client may not support elicitation, or request timed out).";
        }
      }

      return rf.formatSuccess(info);
    }
  );
}
