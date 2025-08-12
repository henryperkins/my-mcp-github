---
title: Agents · Cloudflare Agents docs
description: The Agents SDK enables you to build and deploy AI-powered agents
  that can autonomously perform tasks, communicate with clients in real time,
  call AI models, persist state, schedule tasks, run asynchronous workflows,
  browse the web, query data from your database, support human-in-the-loop
  interactions, and a lot more.
lastUpdated: 2025-03-18T12:13:40.000Z
chatbotDeprioritize: false
source_url:
  html: https://developers.cloudflare.com/agents/
  md: https://developers.cloudflare.com/agents/index.md
---

The Agents SDK enables you to build and deploy AI-powered agents that can autonomously perform tasks, communicate with clients in real time, call AI models, persist state, schedule tasks, run asynchronous workflows, browse the web, query data from your database, support human-in-the-loop interactions, and [a lot more](https://developers.cloudflare.com/agents/api-reference/).

### Ship your first Agent

To use the Agent starter template and create your first Agent with the Agents SDK:

```sh
# install it
npm create cloudflare@latest agents-starter -- --template=cloudflare/agents-starter
# and deploy it
npx wrangler@latest deploy
```

Head to the guide on [building a chat agent](https://developers.cloudflare.com/agents/getting-started/build-a-chat-agent) to learn how the starter project is built and how to use it as a foundation for your own agents.

If you're already building on [Workers](https://developers.cloudflare.com/workers/), you can install the \`agents\` package directly into an existing project:

```sh
npm i agents
```

And then define your first Agent by creating a class that extends the \`Agent\` class:

* JavaScript

  ```js
  import { Agent, AgentNamespace } from "agents";

  export class MyAgent extends Agent {
    // Define methods on the Agent:
    // https://developers.cloudflare.com/agents/api-reference/agents-api/
    //
    // Every Agent has built in state via this.setState and this.sql
    // Built-in scheduling via this.schedule
    // Agents support WebSockets, HTTP requests, state synchronization and
    // can run for seconds, minutes or hours: as long as the tasks need.
  }
  ```

* TypeScript

  ```ts
  import { Agent, AgentNamespace } from 'agents';

  export class MyAgent extends Agent {
    // Define methods on the Agent:
    // https://developers.cloudflare.com/agents/api-reference/agents-api/
    //
    // Every Agent has built in state via this.setState and this.sql
    // Built-in scheduling via this.schedule
    // Agents support WebSockets, HTTP requests, state synchronization and
    // can run for seconds, minutes or hours: as long as the tasks need.
  }
```

Dive into the [Agent SDK reference](https://developers.cloudflare.com/agents/api-reference/agents-api/) to learn more about how to use the Agents SDK package and defining an \`Agent\`.

### Why build agents on Cloudflare?

We built the Agents SDK with a few things in mind:

* **Batteries (state) included**: Agents come with [built-in state management](https://developers.cloudflare.com/agents/api-reference/store-and-sync-state/), with the ability to automatically sync state between an Agent and clients, trigger events on state changes, and read+write to each Agent's SQL database.
* **Communicative**: You can connect to an Agent via [WebSockets](https://developers.cloudflare.com/agents/api-reference/websockets/) and stream updates back to client in real-time. Handle a long-running response from a reasoning model, the results of an [asynchronous workflow](https://developers.cloudflare.com/agents/api-reference/run-workflows/), or build a chat app that builds on the \`useAgent\` hook included in the Agents SDK.
* **Extensible**: Agents are code. Use the [AI models](https://developers.cloudflare.com/agents/api-reference/using-ai-models/) you want, bring-your-own headless browser service, pull data from your database hosted in another cloud, add your own methods to your Agent and call them.

Agents built with Agents SDK can be deployed directly to Cloudflare and run on top of [Durable Objects](https://developers.cloudflare.com/durable-objects/) — which you can think of as stateful micro-servers that can scale to tens of millions — and are able to run wherever they need to. Run your Agents close to a user for low-latency interactivity, close to your data for throughput, and/or anywhere in between.

***

### Build on the Cloudflare Platform

**[Workers](https://developers.cloudflare.com/workers/)**

Build serverless applications and deploy instantly across the globe for exceptional performance, reliability, and scale.

**[AI Gateway](https://developers.cloudflare.com/ai-gateway/)**

Observe and control your AI applications with caching, rate limiting, request retries, model fallback, and more.

**[Vectorize](https://developers.cloudflare.com/vectorize/)**

Build full-stack AI applications with Vectorize, Cloudflare’s vector database. Adding Vectorize enables you to perform tasks such as semantic search, recommendations, anomaly detection or can be used to provide context and memory to an LLM.

**[Workers AI](https://developers.cloudflare.com/workers-ai/)**

Run machine learning models, powered by serverless GPUs, on Cloudflare's global network.

**[Workflows](https://developers.cloudflare.com/workflows/)**

Build stateful agents that guarantee executions, including automatic retries, persistent state that runs for minutes, hours, days, or weeks.








<page>
---
title: Schedule tasks · Cloudflare Agents docs
description: An Agent can schedule tasks to be run in the future by calling
  this.schedule(when, callback, data), where when can be a delay, a Date, or a
  cron string; callback the function name to call, and data is an object of data
  to pass to the function.
lastUpdated: 2025-04-06T14:39:24.000Z
chatbotDeprioritize: false
source_url:
  html: https://developers.cloudflare.com/agents/api-reference/schedule-tasks/
  md: https://developers.cloudflare.com/agents/api-reference/schedule-tasks/index.md
---

An Agent can schedule tasks to be run in the future by calling \`this.schedule(when, callback, data)\`, where \`when\` can be a delay, a \`Date\`, or a cron string; \`callback\` the function name to call, and \`data\` is an object of data to pass to the function.

Scheduled tasks can do anything a request or message from a user can: make requests, query databases, send emails, read+write state: scheduled tasks can invoke any regular method on your Agent.

### Scheduling tasks

You can call \`this.schedule\` within any method on an Agent, and schedule tens-of-thousands of tasks per individual Agent:

* JavaScript

  ```js
  import { Agent } from "agents";

  export class SchedulingAgent extends Agent {
    async onRequest(request) {
      // Handle an incoming request
      // Schedule a task 5 minutes from now
      // Calls the "checkFlights" method
      let { taskId } = await this.schedule(600, "checkFlights", {
        flight: "DL264",
        date: "2025-02-23",
      });
      return Response.json({ taskId });
    }

    async checkFlights(data) {
      // Invoked when our scheduled task runs
      // We can also call this.schedule here to schedule another task
    }
  }
  ```

* TypeScript

  ```ts
  import { Agent } from "agents"

  export class SchedulingAgent extends Agent {
    async onRequest(request) {
      // Handle an incoming request
      // Schedule a task 5 minutes from now
      // Calls the "checkFlights" method
      let { taskId } = await this.schedule(600, "checkFlights", { flight: "DL264", date: "2025-02-23" });
      return Response.json({ taskId });
    }

    async checkFlights(data) {
      // Invoked when our scheduled task runs
      // We can also call this.schedule here to schedule another task
    }
  }
  ```

Warning

Tasks that set a callback for a method that does not exist will throw an exception: ensure that the method named in the \`callback\` argument of \`this.schedule\` exists on your \`Agent\` class.

You can schedule tasks in multiple ways:

* JavaScript

  ```js
  // schedule a task to run in 10 seconds
  let task = await this.schedule(10, "someTask", { message: "hello" });

  // schedule a task to run at a specific date
  let task = await this.schedule(new Date("2025-01-01"), "someTask", {});

  // schedule a task to run every 10 seconds
  let { id } = await this.schedule("*/10 * * * *", "someTask", {
    message: "hello",
  });

  // schedule a task to run every 10 seconds, but only on Mondays
  let task = await this.schedule("0 0 * * 1", "someTask", { message: "hello" });

  // cancel a scheduled task
  this.cancelSchedule(task.id);
  ```

* TypeScript

  ```ts
  // schedule a task to run in 10 seconds
  let task = await this.schedule(10, "someTask", { message: "hello" });

  // schedule a task to run at a specific date
  let task = await this.schedule(new Date("2025-01-01"), "someTask", {});

  // schedule a task to run every 10 seconds
  let { id } = await this.schedule("*/10 * * * *", "someTask", { message: "hello" });

  // schedule a task to run every 10 seconds, but only on Mondays
  let task = await this.schedule("0 0 * * 1", "someTask", { message: "hello" });

  // cancel a scheduled task
  this.cancelSchedule(task.id);
  ```

Calling \`await this.schedule\` returns a \`Schedule\`, which includes the task's randomly generated \`id\`. You can use this \`id\` to retrieve or cancel the task in the future. It also provides a \`type\` property that indicates the type of schedule, for example, one of \`"scheduled" | "delayed" | "cron"\`.

Maximum scheduled tasks

Each task is mapped to a row in the Agent's underlying [SQLite database](https://developers.cloudflare.com/durable-objects/api/storage-api/), which means that each task can be up to 2 MB in size. The maximum number of tasks must be \`(task_size * tasks) + all_other_state < maximum_database_size\` (currently 1GB per Agent).

### Managing scheduled tasks

You can get, cancel and filter across scheduled tasks within an Agent using the scheduling API:

* JavaScript

  ```js
  // Get a specific schedule by ID
  // Returns undefined if the task does not exist
  let task = await this.getSchedule(task.id);

  // Get all scheduled tasks
  // Returns an array of Schedule objects
  let tasks = this.getSchedules();

  // Cancel a task by its ID
  // Returns true if the task was cancelled, false if it did not exist
  await this.cancelSchedule(task.id);

  // Filter for specific tasks
  // e.g. all tasks starting in the next hour
  let tasks = this.getSchedules({
    timeRange: {
      start: new Date(Date.now()),
      end: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  ```

* TypeScript

  ```ts
  // Get a specific schedule by ID
  // Returns undefined if the task does not exist
  let task = await this.getSchedule(task.id)

  // Get all scheduled tasks
  // Returns an array of Schedule objects
  let tasks = this.getSchedules();

  // Cancel a task by its ID
  // Returns true if the task was cancelled, false if it did not exist
  await this.cancelSchedule(task.id);

  // Filter for specific tasks
  // e.g. all tasks starting in the next hour
  let tasks = this.getSchedules({
    timeRange: {
      start: new Date(Date.now()),
      end: new Date(Date.now() + 60 * 60 * 1000),
    }
  });
  ```

</page>

<page>
---
title: Store and sync state · Cloudflare Agents docs
description: Every Agent has built-in state management capabilities, including
  built-in storage and synchronization between the Agent and frontend
  applications.
lastUpdated: 2025-06-19T13:27:22.000Z
chatbotDeprioritize: false
source_url:
  html: https://developers.cloudflare.com/agents/api-reference/store-and-sync-state/
  md: https://developers.cloudflare.com/agents/api-reference/store-and-sync-state/index.md
---

Every Agent has built-in state management capabilities, including built-in storage and synchronization between the Agent and frontend applications.

State within an Agent is:

* Persisted across Agent restarts: data is permanently stored within an Agent.
* Automatically serialized/deserialized: you can store any JSON-serializable data.
* Immediately consistent within the Agent: read your own writes.
* Thread-safe for concurrent updates
* Fast: state is colocated wherever the Agent is running. Reads and writes do not need to traverse the network.

Agent state is stored in a SQL database that is embedded within each individual Agent instance: you can interact with it using the higher-level \`this.setState\` API (recommended), which allows you to sync state and trigger events on state changes, or by directly querying the database with \`this.sql\`.

#### State API

Every Agent has built-in state management capabilities. You can set and update the Agent's state directly using \`this.setState\`:

* JavaScript

  ```js
  import { Agent } from "agents";

  export class MyAgent extends Agent {
    // Update state in response to events
    async incrementCounter() {
      this.setState({
        ...this.state,
        counter: this.state.counter + 1,
      });
    }

    // Handle incoming messages
    async onMessage(message) {
      if (message.type === "update") {
        this.setState({
          ...this.state,
          ...message.data,
        });
      }
    }

    // Handle state updates
    onStateUpdate(state, source) {
      console.log("state updated", state);
    }
  }
  ```

* TypeScript

  ```ts
  import { Agent } from "agents";

  export class MyAgent extends Agent {
    // Update state in response to events
    async incrementCounter() {
      this.setState({
        ...this.state,
        counter: this.state.counter + 1,
      });
    }

    // Handle incoming messages
    async onMessage(message) {
      if (message.type === "update") {
        this.setState({
          ...this.state,
          ...message.data,
        });
      }
    }

    // Handle state updates
    onStateUpdate(state, source: "server" | Connection) {
      console.log("state updated", state);
    }
  }
  ```

If you're using TypeScript, you can also provide a type for your Agent's state by passing in a type as a [type parameter](https://www.typescriptlang.org/docs/handbook/2/generics.html#using-type-parameters-in-generic-constraints) as the *second* type parameter to the \`Agent\` class definition.

* JavaScript

  ```js
  import { Agent } from "agents";

  // Define a type for your Agent's state
  // Pass in the type of your Agent's state
  export class MyAgent extends Agent {
    // This allows this.setState and the onStateUpdate method to
    // be typed:
    async onStateUpdate(state) {
      console.log("state updated", state);
    }

    async someOtherMethod() {
      this.setState({
        ...this.state,
        price: this.state.price + 10,
      });
    }
  }
  ```

* TypeScript

  ```ts
  import { Agent } from "agents";

  interface Env {}

  // Define a type for your Agent's state
  interface FlightRecord {
    id: string;
    departureIata: string;
    arrival: Date;
    arrivalIata: string;
    price: number;
  }

  // Pass in the type of your Agent's state
  export class MyAgent extends Agent<Env, FlightRecord> {
    // This allows this.setState and the onStateUpdate method to
    // be typed:
     async onStateUpdate(state: FlightRecord) {
      console.log("state updated", state);
    }

    async someOtherMethod() {
      this.setState({
        ...this.state,
        price: this.state.price + 10,
      });
    }
  }
  ```

### Set the initial state for an Agent

You can also set the initial state for an Agent via the \`initialState\` property on the \`Agent\` class:

* JavaScript

  ```js
  class MyAgent extends Agent {
    // Set a default, initial state
    initialState = {
      counter: 0,
      text: "",
      color: "#3B82F6",
    };

    doSomething() {
      console.log(this.state); // {counter: 0, text: "", color: "#3B82F6"}, if you haven't set the state yet
    }
  }
  ```

* TypeScript

  ```ts
  type State = {
    counter: number;
    text: string;
    color: string;
  };

  class MyAgent extends Agent<Env, State> {
    // Set a default, initial state
    initialState = {
      counter: 0,
      text: "",
      color: "#3B82F6",
    };

    doSomething() {
      console.log(this.state); // {counter: 0, text: "", color: "#3B82F6"}, if you haven't set the state yet
    }
  }
  ```

Any initial state is synced to clients connecting via [the \`useAgent\` hook](#synchronizing-state).

### Synchronizing state

Clients can connect to an Agent and stay synchronized with its state using the React hooks provided as part of \`agents/react\`.

A React application can call \`useAgent\` to connect to a named Agent over WebSockets at

* JavaScript

  ```js
  import { useState } from "react";
  import { useAgent } from "agents/react";

  function StateInterface() {
    const [state, setState] = useState({ counter: 0 });

    const agent = useAgent({
      agent: "thinking-agent",
      name: "my-agent",
      onStateUpdate: (newState) => setState(newState),
    });

    const increment = () => {
      agent.setState({ counter: state.counter + 1 });
    };

    return (
      <div>
        <div>Count: {state.counter}</div>
        <button onClick={increment}>Increment</button>
      </div>
    );
  }
  ```

* TypeScript

  ```ts
  import { useState } from "react";
  import { useAgent } from "agents/react";

  function StateInterface() {
    const [state, setState] = useState({ counter: 0 });

    const agent = useAgent({
      agent: "thinking-agent",
      name: "my-agent",
      onStateUpdate: (newState) => setState(newState),
    });

    const increment = () => {
      agent.setState({ counter: state.counter + 1 });
    };

    return (
      <div>
        <div>Count: {state.counter}</div>
        <button onClick={increment}>Increment</button>
      </div>
    );
  }
  ```

The state synchronization system:

* Automatically syncs the Agent's state to all connected clients
* Handles client disconnections and reconnections gracefully
* Provides immediate local updates
* Supports multiple simultaneous client connections

Common use cases:

* Real-time collaborative features
* Multi-window/tab synchronization
* Live updates across multiple devices
* Maintaining consistent UI state across clients
* When new clients connect, they automatically receive the current state from the Agent, ensuring all clients start with the latest data.

### SQL API

Every individual Agent instance has its own SQL (SQLite) database that runs *within the same context* as the Agent itself. This means that inserting or querying data within your Agent is effectively zero-latency: the Agent doesn't have to round-trip across a continent or the world to access its own data.

You can access the SQL API within any method on an Agent via \`this.sql\`. The SQL API accepts template literals, and

* JavaScript

  ```js
  export class MyAgent extends Agent {
    async onRequest(request) {
      let userId = new URL(request.url).searchParams.get("userId");

      // 'users' is just an example here: you can create arbitrary tables and define your own schemas
      // within each Agent's database using SQL (SQLite syntax).
      let user = await this.sql\`SELECT * FROM users WHERE id = ${userId}\`;
      return Response.json(user);
    }
  }
  ```

* TypeScript

  ```ts
  export class MyAgent extends Agent<Env> {
    async onRequest(request: Request) {
      let userId = new URL(request.url).searchParams.get('userId');

      // 'users' is just an example here: you can create arbitrary tables and define your own schemas
      // within each Agent's database using SQL (SQLite syntax).
      let user = await this.sql\`SELECT * FROM users WHERE id = ${userId}\`
      return Response.json(user)
    }
  }
  ```

You can also supply a [TypeScript type argument](https://www.typescriptlang.org/docs/handbook/2/generics.html#using-type-parameters-in-generic-constraints) to the query, which will be used to infer the type of the result:

```ts
type User = {
  id: string;
  name: string;
  email: string;
};

export class MyAgent extends Agent<Env> {
  async onRequest(request: Request) {
    let userId = new URL(request.url).searchParams.get('userId');
    // Supply the type parameter to the query when calling this.sql
    // This assumes the results returns one or more User rows with "id", "name", and "email" columns
    const user = await this.sql<User>\`SELECT * FROM users WHERE id = ${userId}\`;
    return Response.json(user)
  }
}
```

You do not need to specify an array type (\`User[]\` or \`Array<User>\`) as \`this.sql\` will always return an array of the specified type.

Providing a type parameter does not validate that the result matches your type definition. In TypeScript, properties (fields) that do not exist or conform to the type you provided will be dropped. If you need to validate incoming events, we recommend a library such as [zod](https://zod.dev/) or your own validator logic.

Note

Learn more about the zero-latency SQL storage that powers both Agents and Durable Objects [on our blog](https://blog.cloudflare.com/sqlite-in-durable-objects/).

The SQL API exposed to an Agent is similar to the one [within Durable Objects](https://developers.cloudflare.com/durable-objects/api/storage-api/#sql-api): Durable Object SQL methods available on \`this.ctx.storage.sql\`. You can use the same SQL queries with the Agent's database, create tables, and query data, just as you would with Durable Objects or [D1](https://developers.cloudflare.com/d1/).

### Use Agent state as model context

You can combine the state and SQL APIs in your Agent with its ability to [call AI models](https://developers.cloudflare.com/agents/api-reference/using-ai-models/) to include historical context within your prompts to a model. Modern Large Language Models (LLMs) often have very large context windows (up to millions of tokens), which allows you to pull relevant context into your prompt directly.

For example, you can use an Agent's built-in SQL database to pull history, query a model with it, and append to that history ahead of the next call to the model:

* JavaScript

  ```js
  export class ReasoningAgent extends Agent {
    async callReasoningModel(prompt) {
      let result = this
        .sql\`SELECT * FROM history WHERE user = ${prompt.userId} ORDER BY timestamp DESC LIMIT 1000\`;
      let context = [];
      for await (const row of result) {
        context.push(row.entry);
      }

      const client = new OpenAI({
        apiKey: this.env.OPENAI_API_KEY,
      });

      // Combine user history with the current prompt
      const systemPrompt = prompt.system || "You are a helpful assistant.";
      const userPrompt = \`${prompt.user}\n\nUser history:\n${context.join("\n")}\`;

      try {
        const completion = await client.chat.completions.create({
          model: this.env.MODEL || "o3-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        });

        // Store the response in history
        this
          .sql\`INSERT INTO history (timestamp, user, entry) VALUES (${new Date()}, ${prompt.userId}, ${completion.choices[0].message.content})\`;

        return completion.choices[0].message.content;
      } catch (error) {
        console.error("Error calling reasoning model:", error);
        throw error;
      }
    }
  }
  ```

* TypeScript

  ```ts
  export class ReasoningAgent extends Agent<Env> {
    async callReasoningModel(prompt: Prompt) {
      let result = this.sql<History>\`SELECT * FROM history WHERE user = ${prompt.userId} ORDER BY timestamp DESC LIMIT 1000\`;
      let context = [];
      for await (const row of result) {
        context.push(row.entry);
      }

      const client = new OpenAI({
        apiKey: this.env.OPENAI_API_KEY,
      });

      // Combine user history with the current prompt
      const systemPrompt = prompt.system || 'You are a helpful assistant.';
      const userPrompt = \`${prompt.user}\n\nUser history:\n${context.join('\n')}\`;

      try {
        const completion = await client.chat.completions.create({
          model: this.env.MODEL || 'o3-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        });

        // Store the response in history
        this
          .sql\`INSERT INTO history (timestamp, user, entry) VALUES (${new Date()}, ${prompt.userId}, ${completion.choices[0].message.content})\`;

        return completion.choices[0].message.content;
      } catch (error) {
        console.error('Error calling reasoning model:', error);
        throw error;
      }
    }
  }
  ```

This works because each instance of an Agent has its *own* database, the state stored in that database is private to that Agent: whether it's acting on behalf of a single user, a room or channel, or a deep research tool. By default, you don't have to manage contention or reach out over the network to a centralized database to retrieve and store state.

### Next steps

* Review the [API documentation](https://developers.cloudflare.com/agents/api-reference/agents-api/) for the Agents class to learn how to define them.
* [Build a chat Agent](https://developers.cloudflare.com/agents/getting-started/build-a-chat-agent/) using the Agents SDK and deploy it to Workers.
* Learn more [using WebSockets](https://developers.cloudflare.com/agents/api-reference/websockets/) to build interactive Agents and stream data back from your Agent.
* [Orchestrate asynchronous workflows](https://developers.cloudflare.com/agents/api-reference/run-workflows) from your Agent by combining the Agents SDK and [Workflows](https://developers.cloudflare.com/workflows).

</page>

<page>
---
title: Using AI Models · Cloudflare Agents docs
description: "Agents can communicate with AI models hosted on any provider, including:"
lastUpdated: 2025-05-16T16:37:37.000Z
chatbotDeprioritize: false
source_url:
  html: https://developers.cloudflare.com/agents/api-reference/using-ai-models/
  md: https://developers.cloudflare.com/agents/api-reference/using-ai-models/index.md
---

Agents can communicate with AI models hosted on any provider, including:

* [Workers AI](https://developers.cloudflare.com/workers-ai/)
* The [AI SDK](https://sdk.vercel.ai/docs/ai-sdk-core/overview)
* [OpenAI](https://platform.openai.com/docs/quickstart?language=javascript)
* [Anthropic](https://docs.anthropic.com/en/api/client-sdks#typescript)
* [Google's Gemini](https://ai.google.dev/gemini-api/docs/openai)

You can also use the model routing features in [AI Gateway](https://developers.cloudflare.com/ai-gateway/) to route across providers, eval responses, and manage AI provider rate limits.

Because Agents are built on top of [Durable Objects](https://developers.cloudflare.com/durable-objects/), each Agent or chat session is associated with a stateful compute instance. Traditional serverless architectures often present challenges for persistent connections needed in real-time applications like chat.

A user can disconnect during a long-running response from a modern reasoning model (such as \`o3-mini\` or DeepSeek R1), or lose conversational context when refreshing the browser. Instead of relying on request-response patterns and managing an external database to track & store conversation state, state can be stored directly within the Agent. If a client disconnects, the Agent can write to its own distributed storage, and catch the client up as soon as it reconnects: even if it's hours or days later.

## Calling AI Models

You can call models from any method within an Agent, including from HTTP requests using the [\`onRequest\`](https://developers.cloudflare.com/agents/api-reference/agents-api/) handler, when a [scheduled task](https://developers.cloudflare.com/agents/api-reference/schedule-tasks/) runs, when handling a WebSocket message in the [\`onMessage\`](https://developers.cloudflare.com/agents/api-reference/websockets/) handler, or from any of your own methods.

Importantly, Agents can call AI models on their own — autonomously — and can handle long-running responses that can take minutes (or longer) to respond in full.

### Long-running model requests

Modern [reasoning models](https://platform.openai.com/docs/guides/reasoning) or "thinking" model can take some time to both generate a response *and* stream the response back to the client.

Instead of buffering the entire response, or risking the client disconnecting, you can stream the response back to the client by using the [WebSocket API](https://developers.cloudflare.com/agents/api-reference/websockets/).

* JavaScript

  ```js
  import { Agent } from "agents";
  import { OpenAI } from "openai";

  export class MyAgent extends Agent {
    async onConnect(connection, ctx) {
      //
    }

    async onMessage(connection, message) {
      let msg = JSON.parse(message);
      // This can run as long as it needs to, and return as many messages as it needs to!
      await queryReasoningModel(connection, msg.prompt);
    }

    async queryReasoningModel(connection, userPrompt) {
      const client = new OpenAI({
        apiKey: this.env.OPENAI_API_KEY,
      });

      try {
        const stream = await client.chat.completions.create({
          model: this.env.MODEL || "o3-mini",
          messages: [{ role: "user", content: userPrompt }],
          stream: true,
        });

        // Stream responses back as WebSocket messages
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            connection.send(JSON.stringify({ type: "chunk", content }));
          }
        }

        // Send completion message
        connection.send(JSON.stringify({ type: "done" }));
      } catch (error) {
        connection.send(JSON.stringify({ type: "error", error: error }));
      }
    }
  }
  ```

* TypeScript

  ```ts
  import { Agent } from "agents";
  import { OpenAI } from "openai";

  export class MyAgent extends Agent<Env> {
    async onConnect(connection: Connection, ctx: ConnectionContext) {
      //
    }

    async onMessage(connection: Connection, message: WSMessage) {
      let msg = JSON.parse(message);
      // This can run as long as it needs to, and return as many messages as it needs to!
      await queryReasoningModel(connection, msg.prompt);
    }

    async queryReasoningModel(connection: Connection, userPrompt: string) {
      const client = new OpenAI({
        apiKey: this.env.OPENAI_API_KEY,
      });

      try {
        const stream = await client.chat.completions.create({
          model: this.env.MODEL || "o3-mini",
          messages: [{ role: "user", content: userPrompt }],
          stream: true,
        });

        // Stream responses back as WebSocket messages
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            connection.send(JSON.stringify({ type: "chunk", content }));
          }
        }

        // Send completion message
        connection.send(JSON.stringify({ type: "done" }));
      } catch (error) {
        connection.send(JSON.stringify({ type: "error", error: error }));
      }
    }
  }
  ```

You can also persist AI model responses back to [Agent's internal state](https://developers.cloudflare.com/agents/api-reference/store-and-sync-state/) by using the \`this.setState\` method. For example, if you run a [scheduled task](https://developers.cloudflare.com/agents/api-reference/schedule-tasks/), you can store the output of the task and read it later. Or, if a user disconnects, read the message history back and send it to the user when they reconnect.

### Workers AI

### Hosted models

You can use [any of the models available in Workers AI](https://developers.cloudflare.com/workers-ai/models/) within your Agent by [configuring a binding](https://developers.cloudflare.com/workers-ai/configuration/bindings/).

Workers AI supports streaming responses out-of-the-box by setting \`stream: true\`, and we strongly recommend using them to avoid buffering and delaying responses, especially for larger models or reasoning models that require more time to generate a response.

* JavaScript

  ```js
  import { Agent } from "agents";

  export class MyAgent extends Agent {
    async onRequest(request) {
      const response = await env.AI.run(
        "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
        {
          prompt: "Build me a Cloudflare Worker that returns JSON.",
          stream: true, // Stream a response and don't block the client!
        },
      );

      // Return the stream
      return new Response(answer, {
        headers: { "content-type": "text/event-stream" },
      });
    }
  }
  ```

* TypeScript

  ```ts
  import { Agent } from "agents";

  interface Env {
    AI: Ai;
  }

  export class MyAgent extends Agent<Env> {
    async onRequest(request: Request) {
      const response = await env.AI.run(
        "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
        {
          prompt: "Build me a Cloudflare Worker that returns JSON.",
          stream: true, // Stream a response and don't block the client!
        },
      );

      // Return the stream
      return new Response(answer, {
        headers: { "content-type": "text/event-stream" },
      });
    }
  }
  ```

Your Wrangler configuration will need an \`ai\` binding added:

* wrangler.jsonc

  ```jsonc
  {
    "ai": {
      "binding": "AI"
    }
  }
  ```

* wrangler.toml

  ```toml
  [ai]
  binding = "AI"
  ```

### Model routing

You can also use the model routing features in [AI Gateway](https://developers.cloudflare.com/ai-gateway/) directly from an Agent by specifying a [\`gateway\` configuration](https://developers.cloudflare.com/ai-gateway/providers/workersai/) when calling the AI binding.

Note

Model routing allows you to route requests to different AI models based on whether they are reachable, rate-limiting your client, and/or if you've exceeded your cost budget for a specific provider.

* JavaScript

  ```js
  import { Agent } from "agents";

  export class MyAgent extends Agent {
    async onRequest(request) {
      const response = await env.AI.run(
        "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
        {
          prompt: "Build me a Cloudflare Worker that returns JSON.",
        },
        {
          gateway: {
            id: "{gateway_id}", // Specify your AI Gateway ID here
            skipCache: false,
            cacheTtl: 3360,
          },
        },
      );

      return Response.json(response);
    }
  }
  ```

* TypeScript

  ```ts
  import { Agent } from "agents";

  interface Env {
    AI: Ai;
  }

  export class MyAgent extends Agent<Env> {
    async onRequest(request: Request) {
      const response = await env.AI.run(
        "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
        {
          prompt: "Build me a Cloudflare Worker that returns JSON.",
        },
        {
          gateway: {
            id: "{gateway_id}", // Specify your AI Gateway ID here
            skipCache: false,
            cacheTtl: 3360,
          },
        },
      );

      return Response.json(response);
    }
  }
  ```

Your Wrangler configuration will need an \`ai\` binding added. This is shared across both Workers AI and AI Gateway.

* wrangler.jsonc

  ```jsonc
  {
    "ai": {
      "binding": "AI"
    }
  }
  ```

* wrangler.toml

  ```toml
  [ai]
  binding = "AI"
  ```

Visit the [AI Gateway documentation](https://developers.cloudflare.com/ai-gateway/) to learn how to configure a gateway and retrieve a gateway ID.

### AI SDK

The [AI SDK](https://sdk.vercel.ai/docs/introduction) provides a unified API for using AI models, including for text generation, tool calling, structured responses, image generation, and more.

To use the AI SDK, install the \`ai\` package and use it within your Agent. The example below shows how it use it to generate text on request, but you can use it from any method within your Agent, including WebSocket handlers, as part of a scheduled task, or even when the Agent is initialized.

* npm

  ```sh
  npm i ai @ai-sdk/openai
  ```

* yarn

  ```sh
  yarn add ai @ai-sdk/openai
  ```

* pnpm

  ```sh
  pnpm add ai @ai-sdk/openai
  ```

- JavaScript

  ```js
  import { Agent } from "agents";
  import { generateText } from "ai";
  import { openai } from "@ai-sdk/openai";

  export class MyAgent extends Agent {
    async onRequest(request) {
      const { text } = await generateText({
        model: openai("o3-mini"),
        prompt: "Build me an AI agent on Cloudflare Workers",
      });

      return Response.json({ modelResponse: text });
    }
  }
  ```

- TypeScript

  ```ts
  import { Agent } from "agents";
  import { generateText } from "ai";
  import { openai } from "@ai-sdk/openai";

  export class MyAgent extends Agent<Env> {
    async onRequest(request: Request): Promise<Response> {
      const { text } = await generateText({
        model: openai("o3-mini"),
        prompt: "Build me an AI agent on Cloudflare Workers",
      });

      return Response.json({ modelResponse: text });
    }
  }
  ```

### OpenAI compatible endpoints

Agents can call models across any service, including those that support the OpenAI API. For example, you can use the OpenAI SDK to use one of [Google's Gemini models](https://ai.google.dev/gemini-api/docs/openai#node.js) directly from your Agent.

Agents can stream responses back over HTTP using Server Sent Events (SSE) from within an \`onRequest\` handler, or by using the native [WebSockets](https://developers.cloudflare.com/agents/api-reference/websockets/) API in your Agent to responses back to a client, which is especially useful for larger models that can take over 30+ seconds to reply.

* JavaScript

  ```js
  import { Agent } from "agents";
  import { OpenAI } from "openai";

  export class MyAgent extends Agent {
    async onRequest(request) {
      const openai = new OpenAI({
        apiKey: this.env.GEMINI_API_KEY,
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      });

      // Create a TransformStream to handle streaming data
      let { readable, writable } = new TransformStream();
      let writer = writable.getWriter();
      const textEncoder = new TextEncoder();

      // Use ctx.waitUntil to run the async function in the background
      // so that it doesn't block the streaming response
      ctx.waitUntil(
        (async () => {
          const stream = await openai.chat.completions.create({
            model: "4o",
            messages: [
              { role: "user", content: "Write me a Cloudflare Worker." },
            ],
            stream: true,
          });

          // loop over the data as it is streamed and write to the writeable
          for await (const part of stream) {
            writer.write(
              textEncoder.encode(part.choices[0]?.delta?.content || ""),
            );
          }
          writer.close();
        })(),
      );

      // Return the readable stream back to the client
      return new Response(readable);
    }
  }
  ```

* TypeScript

  ```ts
  import { Agent } from "agents";
  import { OpenAI } from "openai";

  export class MyAgent extends Agent<Env> {
    async onRequest(request: Request): Promise<Response> {
      const openai = new OpenAI({
        apiKey: this.env.GEMINI_API_KEY,
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      });

      // Create a TransformStream to handle streaming data
      let { readable, writable } = new TransformStream();
      let writer = writable.getWriter();
      const textEncoder = new TextEncoder();

      // Use ctx.waitUntil to run the async function in the background
      // so that it doesn't block the streaming response
      ctx.waitUntil(
        (async () => {
          const stream = await openai.chat.completions.create({
            model: "4o",
            messages: [
              { role: "user", content: "Write me a Cloudflare Worker." },
            ],
            stream: true,
          });

          // loop over the data as it is streamed and write to the writeable
          for await (const part of stream) {
            writer.write(
              textEncoder.encode(part.choices[0]?.delta?.content || ""),
            );
          }
          writer.close();
        })(),
      );

      // Return the readable stream back to the client
      return new Response(readable);
    }
  }
  ```

</page>

<page>
---
title: Using WebSockets · Cloudflare Agents docs
description: Users and clients can connect to an Agent directly over WebSockets,
  allowing long-running, bi-directional communication with your Agent as it
  operates.
lastUpdated: 2025-03-18T12:13:40.000Z
chatbotDeprioritize: false
source_url:
  html: https://developers.cloudflare.com/agents/api-reference/websockets/
  md: https://developers.cloudflare.com/agents/api-reference/websockets/index.md
---

Users and clients can connect to an Agent directly over WebSockets, allowing long-running, bi-directional communication with your Agent as it operates.

To enable an Agent to accept WebSockets, define \`onConnect\` and \`onMessage\` methods on your Agent.

* \`onConnect(connection: Connection, ctx: ConnectionContext)\` is called when a client establishes a new WebSocket connection. The original HTTP request, including request headers, cookies, and the URL itself, are available on \`ctx.request\`.
* \`onMessage(connection: Connection, message: WSMessage)\` is called for each incoming WebSocket message. Messages are one of \`ArrayBuffer | ArrayBufferView | string\`, and you can send messages back to a client using \`connection.send()\`. You can distinguish between client connections by checking \`connection.id\`, which is unique for each connected client.

Here's an example of an Agent that echoes back any message it receives:

* JavaScript

  ```js
  import { Agent, Connection } from "agents";

  export class ChatAgent extends Agent {
    async onConnect(connection, ctx) {
      // Connections are automatically accepted by the SDK.
      // You can also explicitly close a connection here with connection.close()
      // Access the Request on ctx.request to inspect headers, cookies and the URL
    }

    async onMessage(connection, message) {
      // const response = await longRunningAITask(message)
      await connection.send(message);
    }
  }
  ```

* TypeScript

  ```ts
  import { Agent, Connection } from "agents";

  export class ChatAgent extends Agent {
    async onConnect(connection: Connection, ctx: ConnectionContext) {
      // Connections are automatically accepted by the SDK.
      // You can also explicitly close a connection here with connection.close()
      // Access the Request on ctx.request to inspect headers, cookies and the URL
    }

    async onMessage(connection: Connection, message: WSMessage) {
      // const response = await longRunningAITask(message)
      await connection.send(message)
    }
  }
  ```

### Connecting clients

The Agent framework includes a useful helper package for connecting directly to your Agent (or other Agents) from a client application. Import \`agents/client\`, create an instance of \`AgentClient\` and use it to connect to an instance of your Agent:

* JavaScript

  ```js
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
    }),
  );
  ```

* TypeScript

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

React-based applications can import \`agents/react\` and use the \`useAgent\` hook to connect to an instance of an Agent directly:

* JavaScript

  ```js
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
        }),
      );
    };

    return (
      <div className="agent-interface">
        <button onClick={inquire}>Seek Understanding</button>
      </div>
    );
  }
  ```

* TypeScript

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

The \`useAgent\` hook automatically handles the lifecycle of the connection, ensuring that it is properly initialized and cleaned up when the component mounts and unmounts. You can also [combine \`useAgent\` with \`useState\`](https://developers.cloudflare.com/agents/api-reference/store-and-sync-state/) to automatically synchronize state across all clients connected to your Agent.

### Handling WebSocket events

Define \`onError\` and \`onClose\` methods on your Agent to explicitly handle WebSocket client errors and close events. Log errors, clean up state, and/or emit metrics:

* JavaScript

  ```js
  import { Agent, Connection } from "agents";

  export class ChatAgent extends Agent {
    // onConnect and onMessage methods
    // ...

    // WebSocket error and disconnection (close) handling.
    async onError(connection, error) {
      console.error(\`WS error: ${error}\`);
    }
    async onClose(connection, code, reason, wasClean) {
      console.log(\`WS closed: ${code} - ${reason} - wasClean: ${wasClean}\`);
      connection.close();
    }
  }
  ```

* TypeScript

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

</page>

<page>
---
title: Calling LLMs · Cloudflare Agents docs
description: Different LLM providers offer models optimized for specific types
  of tasks. When building AI systems, choosing the right model is crucial for
  both performance and cost efficiency.
lastUpdated: 2025-02-25T13:55:21.000Z
chatbotDeprioritize: false
source_url:
  html: https://developers.cloudflare.com/agents/concepts/calling-llms/
  md: https://developers.cloudflare.com/agents/concepts/calling-llms/index.md
---

### Understanding LLM providers and model types

Different LLM providers offer models optimized for specific types of tasks. When building AI systems, choosing the right model is crucial for both performance and cost efficiency.

#### Reasoning Models

Models like OpenAI's o1, Anthropic's Claude, and DeepSeek's R1 are particularly well-suited for complex reasoning tasks. These models excel at:

* Breaking down problems into steps
* Following complex instructions
* Maintaining context across long conversations
* Generating code and technical content

For example, when implementing a travel booking system, you might use a reasoning model to analyze travel requirements and generate appropriate booking strategies.

#### Instruction Models

Models like GPT-4 and Claude Instant are optimized for following straightforward instructions efficiently. They work well for:

* Content generation
* Simple classification tasks
* Basic question answering
* Text transformation

These models are often more cost-effective for straightforward tasks that do not require complex reasoning.

</page>

<page>
---
title: Human in the Loop · Cloudflare Agents docs
description: Human-in-the-Loop (HITL) workflows integrate human judgment and
  oversight into automated processes. These workflows pause at critical points
  for human review, validation, or decision-making before proceeding. This
  approach combines the efficiency of automation with human expertise and
  oversight where it matters most.
lastUpdated: 2025-04-30T09:59:18.000Z
chatbotDeprioritize: false
source_url:
  html: https://developers.cloudflare.com/agents/concepts/human-in-the-loop/
  md: https://developers.cloudflare.com/agents/concepts/human-in-the-loop/index.md
---

### What is Human-in-the-Loop?

Human-in-the-Loop (HITL) workflows integrate human judgment and oversight into automated processes. These workflows pause at critical points for human review, validation, or decision-making before proceeding. This approach combines the efficiency of automation with human expertise and oversight where it matters most.

![A human-in-the-loop diagram](https://developers.cloudflare.com/_astro/human-in-the-loop.C2xls7fV_1vt7N8.svg)

#### Understanding Human-in-the-Loop workflows

In a Human-in-the-Loop workflow, processes are not fully automated. Instead, they include designated checkpoints where human intervention is required. For example, in a travel booking system, a human may want to confirm the travel before an agent follows through with a transaction. The workflow manages this interaction, ensuring that:

1. The process pauses at appropriate review points
2. Human reviewers receive necessary context
3. The system maintains state during the review period
4. Review decisions are properly incorporated
5. The process continues once approval is received

### Best practices for Human-in-the-Loop workflows

#### Long-Term State Persistence

Human review processes do not operate on predictable timelines. A reviewer might need days or weeks to make a decision, especially for complex cases requiring additional investigation or multiple approvals. Your system needs to maintain perfect state consistency throughout this period, including:

* The original request and context
* All intermediate decisions and actions
* Any partial progress or temporary states
* Review history and feedback

Tip

[Durable Objects](https://developers.cloudflare.com/durable-objects/) provide an ideal solution for managing state in Human-in-the-Loop workflows, offering persistent compute instances that maintain state for hours, weeks, or months.

#### Continuous Improvement Through Evals

Human reviewers play a crucial role in evaluating and improving LLM performance. Implement a systematic evaluation process where human feedback is collected not just on the final output, but on the LLM's decision-making process. This can include:

* Decision Quality Assessment: Have reviewers evaluate the LLM's reasoning process and decision points, not just the final output.
* Edge Case Identification: Use human expertise to identify scenarios where the LLM's performance could be improved.
* Feedback Collection: Gather structured feedback that can be used to fine-tune the LLM or adjust the workflow. [AI Gateway](https://developers.cloudflare.com/ai-gateway/evaluations/add-human-feedback/) can be a useful tool for setting up an LLM feedback loop.

#### Error handling and recovery

Robust error handling is essential for maintaining workflow integrity. Your system should gracefully handle various failure scenarios, including reviewer unavailability, system outages, or conflicting reviews. Implement clear escalation paths for handling exceptional cases that fall outside normal parameters.

The system should maintain stability during paused states, ensuring that no work is lost even during extended review periods. Consider implementing automatic checkpointing that allows workflows to be resumed from the last stable state after any interruption.

</page>

<page>
---
title: Tools · Cloudflare Agents docs
description: Tools enable AI systems to interact with external services and
  perform actions. They provide a structured way for agents and workflows to
  invoke APIs, manipulate data, and integrate with external systems. Tools form
  the bridge between AI decision-making capabilities and real-world actions.
lastUpdated: 2025-02-28T20:23:07.000Z
chatbotDeprioritize: false
source_url:
  html: https://developers.cloudflare.com/agents/concepts/tools/
  md: https://developers.cloudflare.com/agents/concepts/tools/index.md
---

### What are tools?

Tools enable AI systems to interact with external services and perform actions. They provide a structured way for agents and workflows to invoke APIs, manipulate data, and integrate with external systems. Tools form the bridge between AI decision-making capabilities and real-world actions.

### Understanding tools

In an AI system, tools are typically implemented as function calls that the AI can use to accomplish specific tasks. For example, a travel booking agent might have tools for:

* Searching flight availability
* Checking hotel rates
* Processing payments
* Sending confirmation emails

Each tool has a defined interface specifying its inputs, outputs, and expected behavior. This allows the AI system to understand when and how to use each tool appropriately.

### Common tool patterns

#### API integration tools

The most common type of tools are those that wrap external APIs. These tools handle the complexity of API authentication, request formatting, and response parsing, presenting a clean interface to the AI system.

#### Model Context Protocol (MCP)

The [Model Context Protocol](https://modelcontextprotocol.io/introduction) provides a standardized way to define and interact with tools. Think of it as an abstraction on top of APIs designed for LLMs to interact with external resources. MCP defines a consistent interface for:

* **Tool Discovery**: Systems can dynamically discover available tools
* **Parameter Validation**: Tools specify their input requirements using JSON Schema
* **Error Handling**: Standardized error reporting and recovery
* **State Management**: Tools can maintain state across invocations

#### Data processing tools

Tools that handle data transformation and analysis are essential for many AI workflows. These might include:

* CSV parsing and analysis
* Image processing
* Text extraction
* Data validation

</page>

<page>
---
title: Agents · Cloudflare Agents docs
description: An agent is an AI system that can autonomously execute tasks by
  making decisions about tool usage and process flow. Unlike traditional
  automation that follows predefined paths, agents can dynamically adapt their
  approach based on context and intermediate results. Agents are also distinct
  from co-pilots (e.g. traditional chat applications) in that they can fully
  automate a task, as opposed to simply augmenting and extending human input.
lastUpdated: 2025-02-25T13:55:21.000Z
chatbotDeprioritize: false
source_url:
  html: https://developers.cloudflare.com/agents/concepts/what-are-agents/
  md: https://developers.cloudflare.com/agents/concepts/what-are-agents/index.md
---

### What are agents?

An agent is an AI system that can autonomously execute tasks by making decisions about tool usage and process flow. Unlike traditional automation that follows predefined paths, agents can dynamically adapt their approach based on context and intermediate results. Agents are also distinct from co-pilots (e.g. traditional chat applications) in that they can fully automate a task, as opposed to simply augmenting and extending human input.

* **Agents** → non-linear, non-deterministic (can change from run to run)
* **Workflows** → linear, deterministic execution paths
* **Co-pilots** → augmentative AI assistance requiring human intervention

### Example: Booking vacations

If this is your first time working with, or interacting with agents, this example will illustrate how an agent works within a context like booking a vacation. If you are already familiar with the topic, read on.

Imagine you're trying to book a vacation. You need to research flights, find hotels, check restaurant reviews, and keep track of your budget.

#### Traditional workflow automation

A traditional automation system follows a predetermined sequence:

* Takes specific inputs (dates, location, budget)
* Calls predefined API endpoints in a fixed order
* Returns results based on hardcoded criteria
* Cannot adapt if unexpected situations arise

![Traditional workflow automation diagram](https://developers.cloudflare.com/_astro/workflow-automation.D1rsykgR_15theP.svg)

#### AI Co-pilot

A co-pilot acts as an intelligent assistant that:

* Provides hotel and itinerary recommendations based on your preferences
* Can understand and respond to natural language queries
* Offers guidance and suggestions
* Requires human decision-making and action for execution

![A co-pilot diagram](https://developers.cloudflare.com/_astro/co-pilot.BZ_kRuK6_Z9KfL9.svg)

#### Agent

An agent combines AI's ability to make judgements and call the relevant tools to execute the task. An agent's output will be nondeterministic given:

* Real-time availability and pricing changes
* Dynamic prioritization of constraints
* Ability to recover from failures
* Adaptive decision-making based on intermediate results

![An agent diagram](https://developers.cloudflare.com/_astro/agent-workflow.5VDKtHdO_ALLGh.svg)

An agents can dynamically generate an itinerary and execute on booking reservations, similarly to what you would expect from a travel agent.

### Three primary components of agent systems:

* **Decision Engine**: Usually an LLM (Large Language Model) that determines action steps
* **Tool Integration**: APIs, functions, and services the agent can utilize
* **Memory System**: Maintains context and tracks task progress

#### How agents work

Agents operate in a continuous loop of:

1. **Observing** the current state or task
2. **Planning** what actions to take, using AI for reasoning
3. **Executing** those actions using available tools (often APIs or [MCPs](https://modelcontextprotocol.io/introduction))
4. **Learning** from the results (storing results in memory, updating task progress, and preparing for next iteration)

</page>

<page>
---
title: Workflows · Cloudflare Agents docs
description: A workflow is the orchestration layer that coordinates how an
  agent's components work together. It defines the structured paths through
  which tasks are processed, tools are called, and results are managed. While
  agents make dynamic decisions about what to do, workflows provide the
  underlying framework that governs how those decisions are executed.
lastUpdated: 2025-02-25T13:55:21.000Z
chatbotDeprioritize: false
source_url:
  html: https://developers.cloudflare.com/agents/concepts/workflows/
  md: https://developers.cloudflare.com/agents/concepts/workflows/index.md
---

## What are workflows?

A workflow is the orchestration layer that coordinates how an agent's components work together. It defines the structured paths through which tasks are processed, tools are called, and results are managed. While agents make dynamic decisions about what to do, workflows provide the underlying framework that governs how those decisions are executed.

### Understanding workflows in agent systems

Think of a workflow like the operating procedures of a company. The company (agent) can make various decisions, but how those decisions get implemented follows established processes (workflows). For example, when you book a flight through a travel agent, they might make different decisions about which flights to recommend, but the process of actually booking the flight follows a fixed sequence of steps.

Let's examine a basic agent workflow:

### Core components of a workflow

A workflow typically consists of several key elements:

1. **Input Processing** The workflow defines how inputs are received and validated before being processed by the agent. This includes standardizing formats, checking permissions, and ensuring all required information is present.
2. **Tool Integration** Workflows manage how external tools and services are accessed. They handle authentication, rate limiting, error recovery, and ensuring tools are used in the correct sequence.
3. **State Management** The workflow maintains the state of ongoing processes, tracking progress through multiple steps and ensuring consistency across operations.
4. **Output Handling** Results from the agent's actions are processed according to defined rules, whether that means storing data, triggering notifications, or formatting responses.

</page>

<page>
---
title: Build a Chat Agent · Cloudflare Agents docs
description: A starter template for building AI-powered chat agents using
  Cloudflare's Agent platform, powered by the Agents SDK. This project provides
  a foundation for creating interactive chat experiences with AI, complete with
  a modern UI and tool integration capabilities.
lastUpdated: 2025-03-18T12:13:40.000Z
chatbotDeprioritize: false
source_url:
  html: https://developers.cloudflare.com/agents/getting-started/build-a-chat-agent/
  md: https://developers.cloudflare.com/agents/getting-started/build-a-chat-agent/index.md
---

</page>

<page>
---
title: Prompt an AI model · Cloudflare Agents docs
description: Use the Workers "mega prompt" to build a Agents using your
  preferred AI tools and/or IDEs. The prompt understands the Agents SDK APIs,
  best practices and guidelines, and makes it easier to build valid Agents and
  Workers.
lastUpdated: 2025-03-18T12:13:40.000Z
chatbotDeprioritize: false
source_url:
  html: https://developers.cloudflare.com/agents/getting-started/prompting/
  md: https://developers.cloudflare.com/agents/getting-started/prompting/index.md
---

</page>

<page>
---
title: Testing your Agents · Cloudflare Agents docs
description: Because Agents run on Cloudflare Workers and Durable Objects, they
  can be tested using the same tools and techniques as Workers and Durable
  Objects.
lastUpdated: 2025-05-16T16:37:37.000Z
chatbotDeprioritize: false
source_url:
  html: https://developers.cloudflare.com/agents/getting-started/testing-your-agent/
  md: https://developers.cloudflare.com/agents/getting-started/testing-your-agent/index.md
---

Because Agents run on Cloudflare Workers and Durable Objects, they can be tested using the same tools and techniques as Workers and Durable Objects.

## Writing and running tests

### Setup

Note

The \`agents-starter\` template and new Cloudflare Workers projects already include the relevant \`vitest\` and \`@cloudflare/vitest-pool-workers\` packages, as well as a valid \`vitest.config.js\` file.

Before you write your first test, install the necessary packages:

```sh
npm install vitest@~3.0.0 --save-dev --save-exact
npm install @cloudflare/vitest-pool-workers --save-dev
```

Ensure that your \`vitest.config.js\` file is identical to the following:

```js
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" },
      },
    },
  },
});
```

### Add the Agent configuration

Add a \`durableObjects\` configuration to \`vitest.config.js\` with the name of your Agent class:

```js
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        main: "./src/index.ts",
        miniflare: {
          durableObjects: {
            NAME: "MyAgent",
          },
        },
      },
    },
  },
});
```

### Write a test

Note

Review the [Vitest documentation](https://vitest.dev/) for more information on testing, including the test API reference and advanced testing techniques.

Tests use the \`vitest\` framework. A basic test suite for your Agent can validate how your Agent responds to requests, but can also unit test your Agent's methods and state.

```ts
import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
  SELF,
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src";
import { Env } from "../src";

interface ProvidedEnv extends Env {}

describe("make a request to my Agent", () => {
  // Unit testing approach
  it("responds with state", async () => {
    // Provide a valid URL that your Worker can use to route to your Agent
    // If you are using routeAgentRequest, this will be /agent/:agent/:name
    const request = new Request<unknown, IncomingRequestCfProperties>(
      "http://example.com/agent/my-agent/agent-123",
    );
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(await response.text()).toMatchObject({ hello: "from your agent" });
  });

  it("also responds with state", async () => {
    const request = new Request("http://example.com/agent/my-agent/agent-123");
    const response = await SELF.fetch(request);
    expect(await response.text()).toMatchObject({ hello: "from your agent" });
  });
});
```

### Run tests

Running tests is done using the \`vitest\` CLI:

```sh
$ npm run test
# or run vitest directly
$ npx vitest
```

```sh
  MyAgent
    ✓ should return a greeting (1 ms)

Test Files  1 passed (1)
```

Review the [documentation on testing](https://developers.cloudflare.com/workers/testing/vitest-integration/write-your-first-test/) for additional examples and test configuration.

## Running Agents locally

You can also run an Agent locally using the \`wrangler\` CLI:

```sh
$ npx wrangler dev
```

```sh
Your Worker and resources are simulated locally via Miniflare. For more information, see: https://developers.cloudflare.com/workers/testing/local-development.

Your worker has access to the following bindings:
- Durable Objects:
  - MyAgent: MyAgent
  Starting local server...
[wrangler:inf] Ready on http://localhost:53645
```

This spins up a local development server that runs the same runtime as Cloudflare Workers, and allows you to iterate on your Agent's code and test it locally without deploying it.

Visit the [\`wrangler dev\`](https://developers.cloudflare.com/workers/wrangler/commands/#dev) docs to review the CLI flags and configuration options.

</page>

<page>
---
title: Build a Human-in-the-loop Agent · Cloudflare Agents docs
description: Implement human-in-the-loop functionality using Cloudflare Agents,
  allowing AI agents to request human approval before executing certain actions
lastUpdated: 2025-02-25T13:55:21.000Z
chatbotDeprioritize: false
source_url:
  html: https://developers.cloudflare.com/agents/guides/anthropic-agent-patterns/
  md: https://developers.cloudflare.com/agents/guides/anthropic-agent-patterns/index.md
---

</page>

<page>
---
title: Build a Remote MCP Client · Cloudflare Agents docs
description: Build an AI Agent that acts as a remote MCP client.
lastUpdated: 2025-04-09T15:16:54.000Z
chatbotDeprioritize: false
source_url:
  html: https://developers.cloudflare.com/agents/guides/build-mcp-client/
  md: https://developers.cloudflare.com/agents/guides/build-mcp-client/index.md
---

</page>

<page>
---
title: Implement Effective Agent Patterns · Cloudflare Agents docs
description: Implement common agent patterns using the Agents SDK framework.
lastUpdated: 2025-03-18T12:13:40.000Z
chatbotDeprioritize: false
source_url:
  html: https://developers.cloudflare.com/agents/guides/human-in-the-loop/
  md: https://developers.cloudflare.com/agents/guides/human-in-the-loop/index.md
---

</page>

<page>
---
title: Build a Remote MCP server · Cloudflare Agents docs
description: "This guide will show you how to deploy your own remote MCP server
  on Cloudflare, with two options:"
lastUpdated: 2025-04-30T00:49:56.000Z
chatbotDeprioritize: false
source_url:
  html: https://developers.cloudflare.com/agents/guides/remote-mcp-server/
  md: https://developers.cloudflare.com/agents/guides/remote-mcp-server/index.md
---

## Deploy your first MCP server

This guide will show you how to deploy your own remote MCP server on Cloudflare, with two options:

* **Without authentication** — anyone can connect and use the server (no login required).
* **With [authentication and authorization](https://developers.cloudflare.com/agents/guides/remote-mcp-server/#add-authentication)** — users sign in before accessing tools, and you can control which tools an agent can call based on the user's permissions.

You can start by deploying a [public MCP server](https://github.com/cloudflare/ai/tree/main/demos/remote-mcp-authless) without authentication, then add user authentication and scoped authorization later. If you already know your server will require authentication, you can skip ahead to the [next section](https://developers.cloudflare.com/agents/guides/remote-mcp-server/#add-authentication).

The button below will guide you through everything you need to do to deploy this [example MCP server](https://github.com/cloudflare/ai/tree/main/demos/remote-mcp-authless) to your Cloudflare account:

[![Deploy to Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/ai/tree/main/demos/remote-mcp-authless)

Once deployed, this server will be live at your workers.dev subdomain (e.g. remote-mcp-server-authless.your-account.workers.dev/sse). You can connect to it immediately using the [AI Playground](https://playground.ai.cloudflare.com/) (a remote MCP client), [MCP inspector](https://github.com/modelcontextprotocol/inspector) or [other MCP clients](https://developers.cloudflare.com/agents/guides/remote-mcp-server/#connect-your-remote-mcp-server-to-claude-and-other-mcp-clients-via-a-local-proxy). Then, once you're ready, you can customize the MCP server and add your own [tools](https://developers.cloudflare.com/agents/model-context-protocol/tools/).

If you're using the "Deploy to Cloudflare" button, a new git repository will be set up on your GitHub or GitLab account for your MCP server, configured to automatically deploy to Cloudflare each time you push a change or merge a pull request to the main branch of the repository. You can then clone this repository, [develop locally](https://developers.cloudflare.com/agents/guides/remote-mcp-server/#local-development), and start writing code and building.

### Set up and deploy your MCP server via CLI

Alternatively, you can use the command line as shown below to create a new MCP Server on your local machine.

* npm

  ```sh
  npm create cloudflare@latest -- my-mcp-server --template=cloudflare/ai/demos/remote-mcp-authless
  ```

* yarn

  ```sh
  yarn create cloudflare my-mcp-server --template=cloudflare/ai/demos/remote-mcp-authless
  ```

* pnpm

  ```sh
  pnpm create cloudflare@latest my-mcp-server --template=cloudflare/ai/demos/remote-mcp-authless
  ```

Now, you have the MCP server setup, with dependencies installed. Move into that project folder:

```sh
cd my-mcp-server
```

#### Local development

In the directory of your new project, run the following command to start the development server:

```sh
npm start
```

Your MCP server is now running on \`http://localhost:8787/sse\`.

In a new terminal, run the [MCP inspector](https://github.com/modelcontextprotocol/inspector). The MCP inspector is an interactive MCP client that allows you to connect to your MCP server and invoke tools from a web browser.

```sh
npx @modelcontextprotocol/inspector@latest
```

Open the MCP inspector in your web browser:

```sh
open http://localhost:5173
```

In the inspector, enter the URL of your MCP server, \`http://localhost:8787/sse\`, and click **Connect**. You should see the "List Tools" button, which will list the tools that your MCP server exposes.

![MCP inspector — authenticated](https://developers.cloudflare.com/_astro/mcp-inspector-authenticated.BCabYwDA_ezC3N.webp)

#### Deploy your MCP server

You can deploy your MCP server to Cloudflare using the following [Wrangler CLI command](https://developers.cloudflare.com/workers/wrangler) within the example project:

```sh
npx wrangler@latest deploy
```

If you have already [connected a git repository](https://developers.cloudflare.com/workers/ci-cd/builds/) to the Worker with your MCP server, you can deploy your MCP server by pushing a change or merging a pull request to the main branch of the repository.

After deploying, take the URL of your deployed MCP server, and enter it in the MCP inspector running on \`http://localhost:5173\`. You now have a remote MCP server, deployed to Cloudflare, that MCP clients can connect to.

### Connect your Remote MCP server to Claude and other MCP Clients via a local proxy

Now that your MCP server is running, you can use the [\`mcp-remote\` local proxy](https://www.npmjs.com/package/mcp-remote) to connect Claude Desktop or other MCP clients to it — even though these tools aren't yet *remote* MCP clients, and don't support remote transport or authorization on the client side. This lets you test what an interaction with your MCP server will be like with a real MCP client.

Update your Claude Desktop configuration to point to the URL of your MCP server. You can use either the \`localhost:8787/sse\` URL, or the URL of your deployed MCP server:

```json
{
  "mcpServers": {
    "math": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://your-worker-name.your-account.workers.dev/sse"
      ]
    }
  }
}
```

Restart Claude Desktop after updating your config file to load the MCP Server. Once this is done, Claude will be able to make calls to your remote MCP server. You can test this by asking Claude to use one of your tools. For example: "Could you use the math tool to add 23 and 19?". Claude should invoke the tool and show the result generated by the MCP server.

Learn more about other ways of using remote MCP servers with MCP clients here in [this section](https://developers.cloudflare.com/agents/guides/test-remote-mcp-server).

## Add Authentication

Now that you’ve deployed a public MCP server, let’s walk through how to enable user authentication using OAuth.

The public server example you deployed earlier allows any client to connect and invoke tools without logging in. To add authentication, you’ll update your MCP server to act as an OAuth provider, handling secure login flows and issuing access tokens that MCP clients can use to make authenticated tool calls.

This is especially useful if users already need to log in to use your service. Once authentication is enabled, users can sign in with their existing account and grant their AI agent permission to interact with the tools exposed by your MCP server, using scoped permissions.

In this example, we use GitHub as an OAuth provider, but you can connect your MCP server with any [OAuth provider](https://developers.cloudflare.com/agents/model-context-protocol/authorization/#2-third-party-oauth-provider) that supports the OAuth 2.0 specification, including Google, Slack, [Stytch](https://developers.cloudflare.com/agents/model-context-protocol/authorization/#stytch), [Auth0](https://developers.cloudflare.com/agents/model-context-protocol/authorization/#stytch), [WorkOS](https://developers.cloudflare.com/agents/model-context-protocol/authorization/#stytch), and more.

### Step 1 — Create and deploy a new MCP server

Run the following command to create a new MCP server:

* npm

  ```sh
  npm create cloudflare@latest -- my-mcp-server-github-auth --template=cloudflare/ai/demos/remote-mcp-github-oauth
  ```

* yarn

  ```sh
  yarn create cloudflare my-mcp-server-github-auth --template=cloudflare/ai/demos/remote-mcp-github-oauth
  ```

* pnpm

  ```sh
  pnpm create cloudflare@latest my-mcp-server-github-auth --template=cloudflare/ai/demos/remote-mcp-github-oauth
  ```

Now, you have the MCP server setup, with dependencies installed. Move into that project folder:

```sh
cd my-mcp-server-github-auth
```

Then, run the following command to deploy the MCP server:

```sh
npx wrangler@latest deploy
```

You'll notice that in the example MCP server, if you open \`src/index.ts\`, the primary difference is that the \`defaultHandler\` is set to the \`GitHubHandler\`:

```ts
import GitHubHandler from "./github-handler";

export default new OAuthProvider({
  apiRoute: "/sse",
  apiHandler: MyMCP.Router,
  defaultHandler: GitHubHandler,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
});
```

This will ensure that your users are redirected to GitHub to authenticate. To get this working though, you need to create OAuth client apps in the steps below.

### Step 2 — Create an OAuth App

You'll need to create two [GitHub OAuth Apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app) to use GitHub as an authentication provider for your MCP server — one for local development, and one for production.

#### First create a new OAuth App for local development

Navigate to [github.com/settings/developers](https://github.com/settings/developers) to create a new OAuth App with the following settings:

* **Application name**: \`My MCP Server (local)\`
* **Homepage URL**: \`http://localhost:8787\`
* **Authorization callback URL**: \`http://localhost:8787/callback\`

For the OAuth app you just created, add the client ID of the OAuth app as \`GITHUB_CLIENT_ID\` and generate a client secret, adding it as \`GITHUB_CLIENT_SECRET\` to a \`.dev.vars\` file in the root of your project, which [will be used to set secrets in local development](https://developers.cloudflare.com/workers/configuration/secrets/).

```sh
touch .dev.vars
echo 'GITHUB_CLIENT_ID="your-client-id"' >> .dev.vars
echo 'GITHUB_CLIENT_SECRET="your-client-secret"' >> .dev.vars
cat .dev.vars
```

#### Next, run your MCP server locally

Run the following command to start the development server:

```sh
npm start
```

Your MCP server is now running on \`http://localhost:8787/sse\`.

In a new terminal, run the [MCP inspector](https://github.com/modelcontextprotocol/inspector). The MCP inspector is an interactive MCP client that allows you to connect to your MCP server and invoke tools from a web browser.

```sh
npx @modelcontextprotocol/inspector@latest
```

Open the MCP inspector in your web browser:

```sh
open http://localhost:5173
```

In the inspector, enter the URL of your MCP server, \`http://localhost:8787/sse\`, and click **Connect**:

You should be redirected to a GitHub login or authorization page. After authorizing the MCP Client (the inspector) access to your GitHub account, you will be redirected back to the inspector. You should see the "List Tools" button, which will list the tools that your MCP server exposes.

#### Second — create a new OAuth App for production

You'll need to repeat these steps to create a new OAuth App for production.

Navigate to [github.com/settings/developers](https://github.com/settings/developers) to create a new OAuth App with the following settings:

* **Application name**: \`My MCP Server (production)\`
* **Homepage URL**: Enter the workers.dev URL of your deployed MCP server (ex: \`worker-name.account-name.workers.dev\`)
* **Authorization callback URL**: Enter the \`/callback\` path of the workers.dev URL of your deployed MCP server (ex: \`worker-name.account-name.workers.dev/callback\`)

For the OAuth app you just created, add the client ID and client secret, using Wrangler CLI:

```sh
wrangler secret put GITHUB_CLIENT_ID
```

```sh
wrangler secret put GITHUB_CLIENT_SECRET
```

#### Finally, connect to your MCP server

Now that you've added the ID and secret of your production OAuth app, you should now be able to connect to your MCP server running at \`worker-name.account-name.workers.dev/sse\` using the [AI Playground](https://playground.ai.cloudflare.com/), MCP inspector or ([other MCP clients](https://developers.cloudflare.com/agents/guides/remote-mcp-server/#connect-your-mcp-server-to-claude-and-other-mcp-clients)), and authenticate with GitHub.

## Next steps

* Add [tools](https://developers.cloudflare.com/agents/model-context-protocol/tools/) to your MCP server.
* Customize your MCP Server's [authentication and authorization](https://developers.cloudflare.com/agents/model-context-protocol/authorization/).

</page>

<page>
---
title: Test a Remote MCP Server · Cloudflare Agents docs
description: Remote, authorized connections are an evolving part of the Model
  Context Protocol (MCP) specification. Not all MCP clients support remote
  connections yet.
lastUpdated: 2025-03-20T23:42:46.000Z
chatbotDeprioritize: false
source_url:
  html: https://developers.cloudflare.com/agents/guides/test-remote-mcp-server/
  md: https://developers.cloudflare.com/agents/guides/test-remote-mcp-server/index.md
---

Remote, authorized connections are an evolving part of the [Model Context Protocol (MCP) specification](https://spec.modelcontextprotocol.io/specification/draft/basic/authorization/). Not all MCP clients support remote connections yet.

This guide will show you options for how to start using your remote MCP server with MCP clients that support remote connections. If you haven't yet created and deployed a remote MCP server, you should follow the [Build a Remote MCP Server](https://developers.cloudflare.com/agents/guides/remote-mcp-server/) guide first.

## The Model Context Protocol (MCP) inspector

The [\`@modelcontextprotocol/inspector\` package](https://github.com/modelcontextprotocol/inspector) is a visual testing tool for MCP servers.

You can run it locally by running the following command:

```bash
npx @modelcontextprotocol/inspector
```

Then, enter the URL of your remote MCP server. You can use an MCP server running on your local machine on localhost, or you can use a remote MCP server running on Cloudflare.

![MCP inspector](https://developers.cloudflare.com/_astro/mcp-inspector-enter-url.Chu-Nz-A_Z2xJ68.webp)

Once you have authenticated, you will be redirected back to the inspector. You should see the "List Tools" button, which will list the tools that your MCP server exposes.

![MCP inspector — authenticated](https://developers.cloudflare.com/_astro/mcp-inspector-authenticated.BCabYwDA_ezC3N.webp)

## Connect your remote MCP server to Claude Desktop via a local proxy

Even though [Claude Desktop](https://claude.ai/download) doesn't yet support remote MCP clients, you can use the [\`mcp-remote\` local proxy](https://www.npmjs.com/package/mcp-remote) to connect it to your remote MCP server. This lets you to test what an interaction with your remote MCP server will be like with a real-world MCP client.

1. Open Claude Desktop and navigate to Settings -> Developer -> Edit Config. This opens the configuration file that controls which MCP servers Claude can access.
2. Replace the content with a configuration like this:

```json
{
  "mcpServers": {
    "math": {
      "command": "npx",
      "args": ["mcp-remote", "http://my-mcp-server.my-account.workers.dev/sse"]
    }
  }
}
```

This tells Claude to communicate with your MCP server running at \`http://localhost:8787/sse\`.

1. Save the file and restart Claude Desktop (command/ctrl + R). When Claude restarts, a browser window will open showing your OAuth login page. Complete the authorization flow to grant Claude access to your MCP server.

Once authenticated, you'll be able to see your tools by clicking the tools icon in the bottom right corner of Claude's interface.

## Connect your remote MCP server to Cursor

To connect [Cursor](https://www.cursor.com/) with your remote MCP server, choose \`Type\`: "Command" and in the \`Command\` field, combine the command and args fields into one (e.g.\`npx mcp-remote https://your-worker-name.your-account.workers.dev/sse\`).

## Connect your remote MCP server to Windsurf

You can connect your remote MCP server to [Windsurf](https://codeium.com/windsurf) by editing the [\`mcp_config.json\` file](https://docs.codeium.com/windsurf/mcp), and adding the following configuration:

```json
{
  "mcpServers": {
    "math": {
      "command": "npx",
      "args": ["mcp-remote", "http://my-mcp-server.my-account.workers.dev/sse"]
    }
  }
}
```

</page>

<page>
---
title: Authorization · Cloudflare Agents docs
description: When building a Model Context Protocol (MCP) server, you need both
  a way to allow users to login (authentication) and allow them to grant the MCP
  client access to resources on their account (authorization).
lastUpdated: 2025-05-14T14:20:47.000Z
chatbotDeprioritize: true
source_url:
  html: https://developers.cloudflare.com/agents/model-context-protocol/authorization/
  md: https://developers.cloudflare.com/agents/model-context-protocol/authorization/index.md
---

When building a [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server, you need both a way to allow users to login (authentication) and allow them to grant the MCP client access to resources on their account (authorization).

The Model Context Protocol uses [a subset of OAuth 2.1 for authorization](https://spec.modelcontextprotocol.io/specification/draft/basic/authorization/). OAuth allows your users to grant limited access to resources, without them having to share API keys or other credentials.

Cloudflare provides an [OAuth Provider Library](https://github.com/cloudflare/workers-oauth-provider) that implements the provider side of the OAuth 2.1 protocol, allowing you to easily add authorization to your MCP server.

You can use the OAuth Provider Library in three ways:

1. **Your Worker handles authorization itself.** Your MCP server, running on Cloudflare, handles the complete OAuth flow. ([Example](https://developers.cloudflare.com/agents/guides/remote-mcp-server/))
2. **Integrate directly with a third-party OAuth provider**, such as GitHub or Google.
3. **Integrate with your own OAuth provider**, including authorization-as-a-service providers you might already rely on, such as Stytch, Auth0, or WorkOS.

The following sections describe each of these options and link to runnable code examples for each.

## Authorization options

### (1) Your MCP Server handles authorization and authentication itself

Your MCP Server, using the [OAuth Provider Library](https://github.com/cloudflare/workers-oauth-provider), can handle the complete OAuth authorization flow, without any third-party involvement.

The [Workers OAuth Provider Library](https://github.com/cloudflare/workers-oauth-provider) is a Cloudflare Worker that implements a [\`fetch()\` handler](https://developers.cloudflare.com/workers/runtime-apis/handlers/fetch/), and handles incoming requests to your MCP server.

You provide your own handlers for your MCP Server's API, and authentication and authorization logic, and URI paths for the OAuth endpoints, as shown below:

```ts
export default new OAuthProvider({
  apiRoute: "/mcp",
  // Your MCP server:
  apiHandler: MyMCPServer.Router,
  // Your handler for authentication and authorization:
  defaultHandler: MyAuthHandler,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
});
```

Refer to the [getting started example](https://developers.cloudflare.com/agents/guides/remote-mcp-server/) for a complete example of the \`OAuthProvider\` in use, with a mock authentication flow.

The authorization flow in this case works like this:

```mermaid
sequenceDiagram
    participant B as User-Agent (Browser)
    participant C as MCP Client
    participant M as MCP Server (your Worker)

    C->>M: MCP Request
    M->>C: HTTP 401 Unauthorized
    Note over C: Generate code_verifier and code_challenge
    C->>B: Open browser with authorization URL + code_challenge
    B->>M: GET /authorize
    Note over M: User logs in and authorizes
    M->>B: Redirect to callback URL with auth code
    B->>C: Callback with authorization code
    C->>M: Token Request with code + code_verifier
    M->>C: Access Token (+ Refresh Token)
    C->>M: MCP Request with Access Token
    Note over C,M: Begin standard MCP message exchange
```

Remember — [authentication is different from authorization](https://www.cloudflare.com/learning/access-management/authn-vs-authz/). Your MCP Server can handle authorization itself, while still relying on an external authentication service to first authenticate users. The [example](https://developers.cloudflare.com/agents/guides/remote-mcp-server) in getting started provides a mock authentication flow. You will need to implement your own authentication handler — either handling authentication yourself, or using an external authentication services.

### (2) Third-party OAuth Provider

The [OAuth Provider Library](https://github.com/cloudflare/workers-oauth-provider) can be configured to use a third-party OAuth provider, such as GitHub or Google. You can see a complete example of this in the [GitHub example](https://developers.cloudflare.com/agents/guides/remote-mcp-server/#add-authentication).

When you use a third-party OAuth provider, you must provide a handler to the \`OAuthProvider\` that implements the OAuth flow for the third-party provider.

```ts
import MyAuthHandler from "./auth-handler";

export default new OAuthProvider({
  apiRoute: "/mcp",
  // Your MCP server:
  apiHandler: MyMCPServer.Router,
  // Replace this handler with your own handler for authentication and authorization with the third-party provider:
  
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
});
```

Note that as [defined in the Model Context Protocol specification](https://spec.modelcontextprotocol.io/specification/draft/basic/authorization/#292-flow-description) when you use a third-party OAuth provider, the MCP Server (your Worker) generates and issues its own token to the MCP client:

```mermaid
sequenceDiagram
    participant B as User-Agent (Browser)
    participant C as MCP Client
    participant M as MCP Server (your Worker)
    participant T as Third-Party Auth Server

    C->>M: Initial OAuth Request
    M->>B: Redirect to Third-Party /authorize
    B->>T: Authorization Request
    Note over T: User authorizes
    T->>B: Redirect to MCP Server callback
    B->>M: Authorization code
    M->>T: Exchange code for token
    T->>M: Third-party access token
    Note over M: Generate bound MCP token
    M->>B: Redirect to MCP Client callback
    B->>C: MCP authorization code
    C->>M: Exchange code for token
    M->>C: MCP access token
```

Read the docs for the [Workers oAuth Provider Library](https://github.com/cloudflare/workers-oauth-provider) for more details.

### (3) Bring your own OAuth Provider

If your application already implements an OAuth Provider itself, or you use [Stytch](https://stytch.com/), [Auth0](https://auth0.com/), [WorkOS](https://workos.com/), or authorization-as-a-service provider, you can use this in the same way that you would use a third-party OAuth provider, described above in (2).

You can use the auth provider to:

* Allow users to authenticate to your MCP server through email, social logins, SSO (single sign-on), and MFA (multi-factor authentication).
* Define scopes and permissions that directly map to your MCP tools.
* Present users with a consent page corresponding with the requested permissions.
* Enforce the permissions so that agents can only invoke permitted tools.

#### Stytch

Get started with a [remote MCP server that uses Stytch](https://stytch.com/docs/guides/connected-apps/mcp-servers) to allow users to sign in with email, Google login or enterprise SSO and authorize their AI agent to view and manage their company's OKRs on their behalf. Stytch will handle restricting the scopes granted to the AI agent based on the user's role and permissions within their organization. When authorizing the MCP Client, each user will see a consent page that outlines the permissions that the agent is requesting that they are able to grant based on their role.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/ai/tree/main/demos/mcp-stytch-b2b-okr-manager)

For more consumer use cases, deploy a remote MCP server for a To Do app that uses Stytch for authentication and MCP client authorization. Users can sign in with email and immediately access the To Do lists associated with their account, and grant access to any AI assistant to help them manage their tasks.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/ai/tree/main/demos/mcp-stytch-consumer-todo-list)

#### Auth0

Get started with a remote MCP server that uses Auth0 to authenticate users through email, social logins, or enterprise SSO to interact with their todos and personal data through AI agents. The MCP server securely connects to API endpoints on behalf of users, showing exactly which resources the agent will be able to access once it gets consent from the user. In this implementation, access tokens are automatically refreshed during long running interactions.

To set it up, first deploy the protected API endpoint:

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/ai/tree/main/demos/remote-mcp-auth0/todos-api)

Then, deploy the MCP server that handles authentication through Auth0 and securely connects AI agents to your API endpoint.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/ai/tree/main/demos/remote-mcp-auth0/mcp-auth0-oidc)

#### WorkOS

Get started with a remote MCP server that uses WorkOS's AuthKit to authenticate users and manage the permissions granted to AI agents. In this example, the MCP server dynamically exposes tools based on the user's role and access rights. All authenticated users get access to the \`add\` tool, but only users who have been assigned the \`image_generation\` permission in WorkOS can grant the AI agent access to the image generation tool. This showcases how MCP servers can conditionally expose capabilities to AI agents based on the authenticated user's role and permission.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/ai/tree/main/demos/remote-mcp-authkit)

## Using Authentication Context in Your MCP Server

When a user authenticates to your MCP server through Cloudflare's OAuth Provider, their identity information and tokens are made available through the \`props\` parameter.

```js
export class MyMCP extends McpAgent<Env, unknown, AuthContext> {
  async init() {
    this.server.tool("userInfo", "Get user information", {}, async () => ({
      content: [{ type: "text", text: \`Hello, ${this.props.claims.name || "user"}!\` }],
    }));
  }
}
```

The authentication context can be used for:

* Accessing user-specific data by using the user ID (this.props.claims.sub) as a key
* Checking user permissions before performing operations
* Customizing responses based on user preferences or attributes
* Using authentication tokens to make requests to external services on behalf of the user
* Ensuring consistency when users interact with your application through different interfaces (dashboard, API, MCP server)

## Implementing Permission-Based Access for MCP Tools

You can implement fine-grained authorization controls for your MCP tools based on user permissions. This allows you to restrict access to certain tools based on the user's role or specific permissions.

```js
// Create a wrapper function to check permissions
function requirePermission(permission, handler) {
  return async (request, context) => {
    // Check if user has the required permission
    const userPermissions = context.props.permissions || [];
    if (!userPermissions.includes(permission)) {
      return {
        content: [{ type: "text", text: \`Permission denied: requires ${permission}\` }],
        status: 403
      };
    }

    // If permission check passes, execute the handler
    return handler(request, context);
  };
}

// Use the wrapper with your MCP tools
async init() {
  // Basic tools available to all authenticated users
  this.server.tool("basicTool", "Available to all users", {}, async () => {
    // Implementation for all users
  });

  // Protected tool using the permission wrapper
  this.server.tool(
    "adminAction",
    "Administrative action requiring special permission",
    { /* parameters */ },
    requirePermission("admin", async (req) => {
      // Only executes if user has "admin" permission
      return {
        content: [{ type: "text", text: "Admin action completed" }]
      };
    })
  );

  // Conditionally register tools based on user permissions
  if (this.props.permissions?.includes("special_feature")) {
    this.server.tool("specialTool", "Special feature", {}, async () => {
      // This tool only appears for users with the special_feature permission
    });
  }
}
```

Benefits:

* Authorization check at the tool level ensures proper access control
* Allows you to define permission checks once and reuse them across tools
* Provides clear feedback to users when permission is denied
* Can choose to only present tools that the agent is able to call

## Next steps

* [Learn how to use the Workers OAuth Provider Library](https://github.com/cloudflare/workers-oauth-provider)
* Learn how to use a third-party OAuth provider, using the [GitHub](https://developers.cloudflare.com/agents/guides/remote-mcp-server/#add-authentication) example MCP server.

</page>

<page>
---
title: McpAgent — API Reference · Cloudflare Agents docs
description: "When you build MCP Servers on Cloudflare, you extend the McpAgent
  class, from the Agents SDK, like this:"
lastUpdated: 2025-06-05T09:34:13.000Z
chatbotDeprioritize: false
source_url:
  html: https://developers.cloudflare.com/agents/model-context-protocol/mcp-agent-api/
  md: https://developers.cloudflare.com/agents/model-context-protocol/mcp-agent-api/index.md
---

When you build MCP Servers on Cloudflare, you extend the [\`McpAgent\` class](https://github.com/cloudflare/agents/blob/5881c5d23a7f4580600029f69307cfc94743e6b8/packages/agents/src/mcp.ts), from the Agents SDK, like this:

* JavaScript

  ```js
  import { McpAgent } from "agents/mcp";
  import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
  import { z } from "zod";

  export class MyMCP extends McpAgent {
    server = new McpServer({ name: "Demo", version: "1.0.0" });

    async init() {
      this.server.tool(
        "add",
        { a: z.number(), b: z.number() },
        async ({ a, b }) => ({
          content: [{ type: "text", text: String(a + b) }],
        }),
      );
    }
  }
  ```

* TypeScript

  ```ts
  import { McpAgent } from "agents/mcp";
  import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
  import { z } from "zod";

  export class MyMCP extends McpAgent {
    server = new McpServer({ name: "Demo", version: "1.0.0" });

    async init() {
      this.server.tool(
        "add",
        { a: z.number(), b: z.number() },
        async ({ a, b }) => ({
          content: [{ type: "text", text: String(a + b) }],
        }),
      );
    }
  }
  ```

This means that each instance of your MCP server has its own durable state, backed by a [Durable Object](https://developers.cloudflare.com/durable-objects/), with its own [SQL database](https://developers.cloudflare.com/agents/api-reference/store-and-sync-state).

Your MCP server doesn't necessarily have to be an Agent. You can build MCP servers that are stateless, and just add [tools](https://developers.cloudflare.com/agents/model-context-protocol/tools) to your MCP server using the \`@modelcontextprotocol/typescript-sdk\` package.

But if you want your MCP server to:

* remember previous tool calls, and responses it provided
* provide a game to the MCP client, remembering the state of the game board, previous moves, and the score
* cache the state of a previous external API call, so that subsequent tool calls can reuse it
* do anything that an Agent can do, but allow MCP clients to communicate with it

You can use the APIs below in order to do so.

#### Hibernation Support

\`McpAgent\` instances automatically support [WebSockets Hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/#websocket-hibernation-api), allowing stateful MCP servers to sleep during inactive periods while preserving their state. This means your agents only consume compute resources when actively processing requests, optimizing costs while maintaining the full context and conversation history.

Hibernation is enabled by default and requires no additional configuration.

#### Authentication & Authorization

The McpAgent class provides seamless integration with the [OAuth Provider Library](https://github.com/cloudflare/workers-oauth-provider) for [authentication and authorization](https://developers.cloudflare.com/agents/model-context-protocol/authorization/).

When a user authenticates to your MCP server, their identity information and tokens are made available through the \`props\` parameter, allowing you to:

* access user-specific data
* check user permissions before performing operations
* customize responses based on user attributes
* use authentication tokens to make requests to external services on behalf of the user

### State synchronization APIs

The \`McpAgent\` class makes the following subset of methods from the [Agents SDK](https://developers.cloudflare.com/agents/api-reference/agents-api/) available:

* [\`state\`](https://developers.cloudflare.com/agents/api-reference/store-and-sync-state/)
* [\`initialState\`](https://developers.cloudflare.com/agents/api-reference/store-and-sync-state/#set-the-initial-state-for-an-agent)
* [\`setState\`](https://developers.cloudflare.com/agents/api-reference/store-and-sync-state/)
* [\`onStateUpdate\`](https://developers.cloudflare.com/agents/api-reference/store-and-sync-state/#synchronizing-state)
* [\`sql\`](https://developers.cloudflare.com/agents/api-reference/agents-api/#sql-api)

State resets after the session ends

Currently, each client session is backed by an instance of the \`McpAgent\` class. This is handled automatically for you, as shown in the [getting started guide](https://developers.cloudflare.com/agents/guides/remote-mcp-server). This means that when the same client reconnects, they will start a new session, and the state will be reset.

For example, the following code implements an MCP server that remembers a counter value, and updates the counter when the \`add\` tool is called:

* JavaScript

  ```js
  import { McpAgent } from "agents/mcp";
  import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
  import { z } from "zod";

  export class MyMCP extends McpAgent {
    server = new McpServer({
      name: "Demo",
      version: "1.0.0",
    });

    initialState = {
      counter: 1,
    };

    async init() {
      this.server.resource(\`counter\`, \`mcp://resource/counter\`, (uri) => {
        return {
          contents: [{ uri: uri.href, text: String(this.state.counter) }],
        };
      });

      this.server.tool(
        "add",
        "Add to the counter, stored in the MCP",
        { a: z.number() },
        async ({ a }) => {
          this.setState({ ...this.state, counter: this.state.counter + a });

          return {
            content: [
              {
                type: "text",
                text: String(\`Added ${a}, total is now ${this.state.counter}\`),
              },
            ],
          };
        },
      );
    }

    onStateUpdate(state) {
      console.log({ stateUpdate: state });
    }
  }
  ```

* TypeScript

  ```ts
  import { McpAgent } from "agents/mcp";
  import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
  import { z } from "zod";

  type State = { counter: number };

  export class MyMCP extends McpAgent<Env, State, {}> {
    server = new McpServer({
      name: "Demo",
      version: "1.0.0",
    });

    initialState: State = {
      counter: 1,
    };

    async init() {
      this.server.resource(\`counter\`, \`mcp://resource/counter\`, (uri) => {
        return {
          contents: [{ uri: uri.href, text: String(this.state.counter) }],
        };
      });

      this.server.tool(
        "add",
        "Add to the counter, stored in the MCP",
        { a: z.number() },
        async ({ a }) => {
          this.setState({ ...this.state, counter: this.state.counter + a });

          return {
            content: [
              {
                type: "text",
                text: String(\`Added ${a}, total is now ${this.state.counter}\`),
              },
            ],
          };
        },
      );
    }

    onStateUpdate(state: State) {
      console.log({ stateUpdate: state });
    }
  }
  ```

### Not yet supported APIs

The following APIs from the Agents SDK are not yet available on \`McpAgent\`:

* [WebSocket APIs](https://developers.cloudflare.com/agents/api-reference/websockets/) (\`onMessage\`, \`onError\`, \`onClose\`, \`onConnect\`)
* [Scheduling APIs](https://developers.cloudflare.com/agents/api-reference/schedule-tasks/) \`this.schedule\`

</page>

<page>
---
title: Cloudflare's own MCP servers · Cloudflare Agents docs
description: Cloudflare runs a catalog of managed remote MCP Servers which you
  can connect to using OAuth on clients like Claude, Windsurf, our own AI
  Playground or any SDK that supports MCP.
lastUpdated: 2025-06-19T13:27:22.000Z
chatbotDeprioritize: false
source_url:
  html: https://developers.cloudflare.com/agents/model-context-protocol/mcp-servers-for-cloudflare/
  md: https://developers.cloudflare.com/agents/model-context-protocol/mcp-servers-for-cloudflare/index.md
---

Cloudflare runs a catalog of managed remote MCP Servers which you can connect to using OAuth on clients like [Claude](https://modelcontextprotocol.io/quickstart/user), [Windsurf](https://docs.windsurf.com/windsurf/cascade/mcp), our own [AI Playground](https://playground.ai.cloudflare.com/) or any [SDK that supports MCP](https://github.com/cloudflare/agents/tree/main/packages/agents/src/mcp).

These MCP servers allow your MCP Client to read configurations from your account, process information, make suggestions based on data, and even make those suggested changes for you. All of these actions can happen across Cloudflare's many services including application development, security and performance.

| Server Name | Description | Server URL |
| - | - | - |
| [Documentation server](https://github.com/cloudflare/mcp-server-cloudflare/tree/main/apps/docs-vectorize) | Get up to date reference information on Cloudflare | \`https://docs.mcp.cloudflare.com/sse\` |
| [Workers Bindings server](https://github.com/cloudflare/mcp-server-cloudflare/tree/main/apps/workers-bindings) | Build Workers applications with storage, AI, and compute primitives | \`https://bindings.mcp.cloudflare.com/sse\` |
| [Workers Builds server](https://github.com/cloudflare/mcp-server-cloudflare/tree/main/apps/workers-builds) | Get insights and manage your Cloudflare Workers Builds | \`https://builds.mcp.cloudflare.com/sse\` |
| [Observability server](https://github.com/cloudflare/mcp-server-cloudflare/tree/main/apps/workers-observability) | Debug and get insight into your application's logs and analytics | \`https://observability.mcp.cloudflare.com/sse\` |
| [Radar server](https://github.com/cloudflare/mcp-server-cloudflare/tree/main/apps/radar) | Get global Internet traffic insights, trends, URL scans, and other utilities | \`https://radar.mcp.cloudflare.com/sse\` |
| [Container server](https://github.com/cloudflare/mcp-server-cloudflare/tree/main/apps/sandbox-container) | Spin up a sandbox development environment | \`https://containers.mcp.cloudflare.com/sse\` |
| [Browser rendering server](https://github.com/cloudflare/mcp-server-cloudflare/tree/main/apps/browser-rendering) | Fetch web pages, convert them to markdown and take screenshots | \`https://browser.mcp.cloudflare.com/sse\` |
| [Logpush server](https://github.com/cloudflare/mcp-server-cloudflare/tree/main/apps/logpush) | Get quick summaries for Logpush job health | \`https://logs.mcp.cloudflare.com/sse\` |
| [AI Gateway server](https://github.com/cloudflare/mcp-server-cloudflare/tree/main/apps/ai-gateway) | Search your logs, get details about the prompts and responses | \`https://ai-gateway.mcp.cloudflare.com/sse\` |
| [AutoRAG server](https://github.com/cloudflare/mcp-server-cloudflare/tree/main/apps/autorag) | List and search documents on your AutoRAGs | \`https://autorag.mcp.cloudflare.com/sse\` |
| [Audit Logs server](https://github.com/cloudflare/mcp-server-cloudflare/tree/main/apps/auditlogs) | Query audit logs and generate reports for review | \`https://auditlogs.mcp.cloudflare.com/sse\` |
| [DNS Analytics server](https://github.com/cloudflare/mcp-server-cloudflare/tree/main/apps/dns-analytics) | Optimize DNS performance and debug issues based on current set up | \`https://dns-analytics.mcp.cloudflare.com/sse\` |
| [Digital Experience Monitoring server](https://github.com/cloudflare/mcp-server-cloudflare/tree/main/apps/dex-analysis) | Get quick insight on critical applications for your organization | \`https://dex.mcp.cloudflare.com/sse\` |
| [Cloudflare One CASB server](https://github.com/cloudflare/mcp-server-cloudflare/tree/main/apps/cloudflare-one-casb) | Quickly identify any security misconfigurations for SaaS applications to safeguard users & data | \`https://casb.mcp.cloudflare.com/sse\` |
| [GraphQL server](https://github.com/cloudflare/mcp-server-cloudflare/tree/main/apps/graphql/) | Get analytics data using Cloudflare’s GraphQL API | \`https://graphql.mcp.cloudflare.com/sse\` |

Check our [GitHub page](https://github.com/cloudflare/mcp-server-cloudflare) to know how to use Cloudflare's remote MCP servers with different MCP clients.

</page>

<page>
---
title: Tools · Cloudflare Agents docs
description: Model Context Protocol (MCP) tools are functions that a MCP Server
  provides and MCP clients can call.
lastUpdated: 2025-03-25T10:04:19.000Z
chatbotDeprioritize: false
source_url:
  html: https://developers.cloudflare.com/agents/model-context-protocol/tools/
  md: https://developers.cloudflare.com/agents/model-context-protocol/tools/index.md
---

Model Context Protocol (MCP) tools are functions that a [MCP Server](https://developers.cloudflare.com/agents/model-context-protocol) provides and MCP clients can call.

When you build MCP Servers with the \`@cloudflare/model-context-protocol\` package, you can define tools the [same way as shown in the \`@modelcontextprotocol/typescript-sdk\` package's examples](https://github.com/modelcontextprotocol/typescript-sdk?tab=readme-ov-file#tools).

For example, the following code from [this example MCP server](https://github.com/cloudflare/ai/tree/main/demos/remote-mcp-server) defines a simple MCP server that adds two numbers together:

* JavaScript

  ```js
  import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
  import { McpAgent } from "agents/mcp";

  export class MyMCP extends McpAgent {
    server = new McpServer({ name: "Demo", version: "1.0.0" });
    async init() {
      this.server.tool(
        "add",
        { a: z.number(), b: z.number() },
        async ({ a, b }) => ({
          content: [{ type: "text", text: String(a + b) }],
        }),
      );
    }
  }
  ```

* TypeScript

  ```ts
  import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
  import { McpAgent } from "agents/mcp";

  export class MyMCP extends McpAgent {
    server = new McpServer({ name: "Demo", version: "1.0.0" });
    async init() {
      this.server.tool(
        "add",
        { a: z.number(), b: z.number() },
        async ({ a, b }) => ({
          content: [{ type: "text", text: String(a + b) }],
        }),
      );
    }
  }
  ```

</page>

<page>
---
title: Transport · Cloudflare Agents docs
description: "The Model Context Protocol (MCP) specification defines three
  standard transport mechanisms for communication between clients and servers:"
lastUpdated: 2025-05-01T13:39:24.000Z
chatbotDeprioritize: false
source_url:
  html: https://developers.cloudflare.com/agents/model-context-protocol/transport/
  md: https://developers.cloudflare.com/agents/model-context-protocol/transport/index.md
---

The Model Context Protocol (MCP) specification defines three standard [transport mechanisms](https://spec.modelcontextprotocol.io/specification/draft/basic/transports/) for communication between clients and servers:

1. **stdio, communication over standard in and standard out** — designed for local MCP connections.
2. **Server-Sent Events (SSE)** — Currently supported by most remote MCP clients, but is expected to be replaced by Streamable HTTP over time. It requires two endpoints: one for sending requests, another for receiving streamed responses.
3. **Streamable HTTP** — New transport method [introduced](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http) in March 2025. It simplifies the communication by using a single HTTP endpoint for bidirectional messaging. It is currently gaining adoption among remote MCP clients, but it is expected to become the standard transport in the future.

MCP servers built with the [Agents SDK](https://developers.cloudflare.com/agents) can support both remote transport methods (SSE and Streamable HTTP), with the [\`McpAgent\` class](https://github.com/cloudflare/agents/blob/2f82f51784f4e27292249747b5fbeeef94305552/packages/agents/src/mcp.ts) automatically handling the transport configuration.

## Implementing remote MCP transport

If you're building a new MCP server or upgrading an existing one on Cloudflare, we recommend supporting both remote transport methods (SSE and Streamable HTTP) concurrently to ensure compatibility with all MCP clients.

#### Get started quickly

You can use the "Deploy to Cloudflare" button to create a remote MCP server that automatically supports both SSE and Streamable HTTP transport methods.

[![Deploy to Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/ai/tree/main/demos/remote-mcp-authless)

#### Remote MCP server (without authentication)

If you're manually configuring your MCP server, here's how to use the \`McpAgent\` class to handle both transport methods:

* JavaScript

  ```js
  export default {
    fetch(request: Request, env: Env, ctx: ExecutionContext) {
      const { pathname } = new URL(request.url);

      if (pathname.startsWith('/sse')) {
        return MyMcpAgent.serveSSE('/sse').fetch(request, env, ctx);
      }

      if (pathname.startsWith('/mcp')) {
        return MyMcpAgent.serve('/mcp').fetch(request, env, ctx);
      }
    },
  };
  ```

* TypeScript

  ```ts
  export default {
    fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response> {
      const { pathname } = new URL(request.url);

      if (pathname.startsWith('/sse')) {
        return MyMcpAgent.serveSSE('/sse').fetch(request, env, ctx);
      }

      if (pathname.startsWith('/mcp')) {
        return MyMcpAgent.serve('/mcp').fetch(request, env, ctx);
      }

      // Handle case where no path matches
      return new Response('Not found', { status: 404 });
    },
  };
  ```

* Hono

  ```ts
  const app = new Hono()

  app.mount('/sse', MyMCP.serveSSE('/sse').fetch, { replaceRequest: false })
  app.mount('/mcp', MyMCP.serve('/mcp').fetch, { replaceRequest: false )

  export default app
  ```

#### MCP Server with Authentication

If your MCP server implements authentication & authorization using the [Workers OAuth Provider](https://github.com/cloudflare/workers-oauth-provider) Library, then you can configure it to support both transport methods using the \`apiHandlers\` property.

```js
export default new OAuthProvider({
  apiHandlers: {
    '/sse': MyMCP.serveSSE('/sse'),
    '/mcp': MyMCP.serve('/mcp'),
  },
  // ... other OAuth configuration
})
```

### Upgrading an Existing Remote MCP Server

If you've already built a remote MCP server using the Cloudflare Agents SDK, make the following changes to support the new Streamable HTTP transport while maintaining compatibility with remote MCP clients using SSE:

* Use \`MyMcpAgent.serveSSE('/sse')\` for the existing SSE transport. Previously, this would have been \`MyMcpAgent.mount('/sse')\`, which has been kept as an alias.
* Add a new path with \`MyMcpAgent.serve('/mcp')\` to support the new Streamable HTTP transport.

If you have an MCP server with authentication/authorization using the Workers OAuth Provider, [update the configuration](https://developers.cloudflare.com/agents/model-context-protocol/transport/#mcp-server-with-authentication) to use the \`apiHandlers\` property, which replaces \`apiRoute\` and \`apiHandler\`.

Note

To use apiHandlers, update to @cloudflare/workers-oauth-provider v0.0.4 or later.

With these few changes, your MCP server will support both transport methods, making it compatible with both existing and new clients.

### Testing with MCP Clients

While most MCP clients have not yet adopted the new Streamable HTTP transport, you can start testing it today using [\`mcp-remote\`](https://www.npmjs.com/package/mcp-remote), an adapter that lets MCP clients that otherwise only support local connections work with remote MCP servers.

Follow [this guide](https://developers.cloudflare.com/agents/guides/test-remote-mcp-server/) for instructions on how to connect to your remote MCP server from Claude Desktop, Cursor, Windsurf, and other local MCP clients, using the [\`mcp-remote\` local proxy](https://www.npmjs.com/package/mcp-remote).

</page>

<page>
---
title: Limits · Cloudflare Agents docs
description: Limits that apply to authoring, deploying, and running Agents are
  detailed below.
lastUpdated: 2025-05-01T13:39:24.000Z
chatbotDeprioritize: false
source_url:
  html: https://developers.cloudflare.com/agents/platform/limits/
  md: https://developers.cloudflare.com/agents/platform/limits/index.md
---

Limits that apply to authoring, deploying, and running Agents are detailed below.

Many limits are inherited from those applied to Workers scripts and/or Durable Objects, and are detailed in the [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) documentation.

| Feature | Limit |
| - | - |
| Max concurrent (running) Agents per account | Tens of millions+ [1](#user-content-fn-1) |
| Max definitions per account | \~250,000+ [2](#user-content-fn-2) |
| Max state stored per unique Agent | 1 GB |
| Max compute time per Agent | 30 seconds (refreshed per HTTP request / incoming WebSocket message) [3](#user-content-fn-3) |
| Duration (wall clock) per step [3](#user-content-fn-3) | Unlimited (for example, waiting on a database call or an LLM response) |

***

Need a higher limit?

To request an adjustment to a limit, complete the [Limit Increase Request Form](https://forms.gle/ukpeZVLWLnKeixDu7). If the limit can be increased, Cloudflare will contact you with next steps.

## Footnotes

1. Yes, really. You can have tens of millions of Agents running concurrently, as each Agent is mapped to a [unique Durable Object](https://developers.cloudflare.com/durable-objects/what-are-durable-objects/) (actor). [↩](#user-content-fnref-1)

2. You can deploy up to [500 scripts per account](https://developers.cloudflare.com/workers/platform/limits/), but each script (project) can define multiple Agents. Each deployed script can be up to 10 MB on the [Workers Paid Plan](https://developers.cloudflare.com/workers/platform/pricing/#workers) [↩](#user-content-fnref-2)

3. Compute (CPU) time per Agent is limited to 30 seconds, but this is refreshed when an Agent receives a new HTTP request, runs a [scheduled task](https://developers.cloudflare.com/agents/api-reference/schedule-tasks/), or an incoming WebSocket message. [↩](#user-content-fnref-3) [↩2](#user-content-fnref-3-2)

</page>

<page>
---
title: Prompt Engineering · Cloudflare Agents docs
description: Learn how to prompt engineer your AI models & tools when building
  Agents & Workers on Cloudflare.
lastUpdated: 2025-02-25T13:55:21.000Z
chatbotDeprioritize: false
source_url:
  html: https://developers.cloudflare.com/agents/platform/prompting/
  md: https://developers.cloudflare.com/agents/platform/prompting/index.md
---

</page>

<page>
---
title: prompt.txt · Cloudflare Agents docs
description: Provide context to your AI models & tools when building on Cloudflare.
lastUpdated: 2025-02-28T08:13:41.000Z
chatbotDeprioritize: false
source_url:
  html: https://developers.cloudflare.com/agents/platform/prompttxt/
  md: https://developers.cloudflare.com/agents/platform/prompttxt/index.md
---

</page>
```