---
title: "Agents SDK adds MCP Elicitation support, http-streamable suppport, task queues, email integration and more"
source: "https://developers.cloudflare.com/changelog/2025-08-05-agents-mcp-update/"
author:
  - "[[Cloudflare Docs]]"
published: 2025-08-04
created: 2025-08-15
description: "Major update brings  MCP elicitation, enhanced transport options,auto transport selection, improved error handling, and reliable prop updates, task queues, and email support"
tags:
  - "clippings"
---
[Skip to content](https://developers.cloudflare.com/changelog/2025-08-05-agents-mcp-update/#_top)

[← Back to all posts](https://developers.cloudflare.com/changelog/)

[Agents](https://developers.cloudflare.com/agents/) [Workers](https://developers.cloudflare.com/workers/)

The latest releases of [@cloudflare/agents ↗](https://github.com/cloudflare/agents) brings major improvements to MCP transport protocols support and agents connectivity. Key updates include:

MCP servers can now request user input during tool execution, enabling interactive workflows like confirmations, forms, and multi-step processes. This feature uses durable storage to preserve elicitation state even during agent hibernation, ensuring seamless user interactions across agent lifecycle events.

```ts
// Request user confirmation via elicitation
const confirmation = await this.elicitInput({
  message: \`Are you sure you want to increment the counter by ${amount}?\`,
  requestedSchema: {
    type: "object",
    properties: {
      confirmed: {
        type: "boolean",
        title: "Confirm increment",
        description: "Check to confirm the increment",
      },
    },
    required: ["confirmed"],
  },
});
```

Check out our [demo ↗](https://github.com/whoiskatrin/agents/tree/main/examples/mcp-elicitation-demo) to see elicitation in action.

MCP now supports HTTP streamable transport which is recommended over SSE. This transport type offers:

- **Better performance**: More efficient data streaming and reduced overhead
- **Improved reliability**: Enhanced connection stability and error recover- **Automatic fallback**: If streamable transport is not available, it gracefully falls back to SSE

```ts
export default MyMCP.serve("/mcp", {
  binding: "MyMCP",
});
```

The SDK automatically selects the best available transport method, gracefully falling back from streamable-http to SSE when needed.

Significant improvements to MCP server connections and transport reliability:

- **Auto transport selection**: Automatically determines the best transport method, falling back from streamable-http to SSE as needed
- **Improved error handling**: Better connection state management and error reporting for MCP servers
- **Reliable prop updates**: Centralized agent property updates ensure consistency across different contexts

You can use `.queue()` to enqueue background work — ideal for tasks like processing user messages, sending notifications etc.

```ts
class MyAgent extends Agent {
  doSomethingExpensive(payload) {
    // a long running process that you want to run in the background
  }

  queueSomething() {
    await this.queue("doSomethingExpensive", somePayload); // this will NOT block further execution, and runs in the background
    await this.queue("doSomethingExpensive", someOtherPayload); // the callback will NOT run until the previous callback is complete
    // ... call as many times as you want
  }
}
```

Want to try it yourself? Just define a method like processMessage in your agent, and you’re ready to scale.

Want to build an AI agent that can receive and respond to emails automatically? With the new email adapter and onEmail lifecycle method, now you can.

```ts
export class EmailAgent extends Agent {
  async onEmail(email: AgentEmail) {
    const raw = await email.getRaw();
    const parsed = await PostalMime.parse(raw);

    // create a response based on the email contents
    // and then send a reply

    await this.replyToEmail(email, {
      fromName: "Email Agent",
      body: \`Thanks for your email! You've sent us "${parsed.subject}". We'll process it shortly.\`,
    });
  }
}
```

You route incoming mail like this:

```ts
export default {
  async email(email, env) {
    await routeAgentEmail(email, env, {
      resolver: createAddressBasedEmailResolver("EmailAgent"),
    });
  },
};
```

You can find a full example [here ↗](https://github.com/cloudflare/agents/tree/main/examples/email-agent).

Custom methods are now automatically wrapped with the agent's context, so calling `getCurrentAgent()` should work regardless of where in an agent's lifecycle it's called. Previously this would not work on RPC calls, but now just works out of the box.

```ts
export class MyAgent extends Agent {
  async suggestReply(message) {
    // getCurrentAgent() now correctly works, even when called inside an RPC method
    const { agent } = getCurrentAgent()!;
    return generateText({
      prompt: \`Suggest a reply to: "${message}" from "${agent.name}"\`,
      tools: [replyWithEmoji],
    });
  }
}
```

Try it out and tell us what you build!