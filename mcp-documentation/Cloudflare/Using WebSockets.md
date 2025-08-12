---
title: "Using WebSockets"
source: "https://developers.cloudflare.com/agents/api-reference/websockets/"
author:
  - "[[Authorization]]"
published: 2025-03-18
created: 2025-08-09
description: "Users and clients can connect to an Agent directly over WebSockets, allowing long-running, bi-directional communication with your Agent as it operates."
tags:
  - "clippings"
---
[Skip to content](https://developers.cloudflare.com/agents/api-reference/websockets/#_top)

Users and clients can connect to an Agent directly over WebSockets, allowing long-running, bi-directional communication with your Agent as it operates.

To enable an Agent to accept WebSockets, define `onConnect` and `onMessage` methods on your Agent.

- `onConnect(connection: Connection, ctx: ConnectionContext)` is called when a client establishes a new WebSocket connection. The original HTTP request, including request headers, cookies, and the URL itself, are available on `ctx.request`.
- `onMessage(connection: Connection, message: WSMessage)` is called for each incoming WebSocket message. Messages are one of `ArrayBuffer | ArrayBufferView | string`, and you can send messages back to a client using `connection.send()`. You can distinguish between client connections by checking `connection.id`, which is unique for each connected client.

Here's an example of an Agent that echoes back any message it receives:

- [JavaScript](https://developers.cloudflare.com/agents/api-reference/websockets/#tab-panel-871)
- [TypeScript](https://developers.cloudflare.com/agents/api-reference/websockets/#tab-panel-872)

### Connecting clients

The Agent framework includes a useful helper package for connecting directly to your Agent (or other Agents) from a client application. Import `agents/client`, create an instance of `AgentClient` and use it to connect to an instance of your Agent:

- [JavaScript](https://developers.cloudflare.com/agents/api-reference/websockets/#tab-panel-873)
- [TypeScript](https://developers.cloudflare.com/agents/api-reference/websockets/#tab-panel-874)

```ts
import { AgentClient } from "agents/client";

const connection = new AgentClient({
  agent: "dialogue-agent",
  name: "insight-seeker",
});

connection.addEventListener("message", (event) => {
  console.log("Received:", event.data);
});

connection.send(
  JSON.stringify({
    type: "inquiry",
    content: "What patterns do you see?",
  })
);
```

### React clients

React-based applications can import `agents/react` and use the `useAgent` hook to connect to an instance of an Agent directly:

- [JavaScript](https://developers.cloudflare.com/agents/api-reference/websockets/#tab-panel-877)
- [TypeScript](https://developers.cloudflare.com/agents/api-reference/websockets/#tab-panel-878)

```ts
import { useAgent } from "agents/react";

function AgentInterface() {
  const connection = useAgent({
    agent: "dialogue-agent",
    name: "insight-seeker",
    onMessage: (message) => {
      console.log("Understanding received:", message.data);
    },
    onOpen: () => console.log("Connection established"),
    onClose: () => console.log("Connection closed"),
  });

  const inquire = () => {
    connection.send(
      JSON.stringify({
        type: "inquiry",
        content: "What insights have you gathered?",
      })
    );
  };

  return (
    <div className="agent-interface">
      <button onClick={inquire}>Seek Understanding</button>
    </div>
  );
}
```

The `useAgent` hook automatically handles the lifecycle of the connection, ensuring that it is properly initialized and cleaned up when the component mounts and unmounts. You can also [combine `useAgent` with `useState`](https://developers.cloudflare.com/agents/api-reference/store-and-sync-state/) to automatically synchronize state across all clients connected to your Agent.

Define `onError` and `onClose` methods on your Agent to explicitly handle WebSocket client errors and close events. Log errors, clean up state, and/or emit metrics:

- [JavaScript](https://developers.cloudflare.com/agents/api-reference/websockets/#tab-panel-875)
- [TypeScript](https://developers.cloudflare.com/agents/api-reference/websockets/#tab-panel-876)

```ts
import { Agent, Connection } from "agents";

export class ChatAgent extends Agent {
   // onConnect and onMessage methods
  // ...

  // WebSocket error and disconnection (close) handling.
  async onError(connection: Connection, error: unknown): Promise<void> {
    console.error(\`WS error: ${error}\`);
  }
  async onClose(connection: Connection, code: number, reason: string, wasClean: boolean): Promise<void> {
    console.log(\`WS closed: ${code} - ${reason} - wasClean: ${wasClean}\`);
    connection.close();
  }
}
```