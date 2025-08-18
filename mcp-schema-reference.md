Here's the schema reference formatted in Markdown while preserving the exact content:

---

# Schema Reference

## Common Types

### `Annotations`

```typescript
interface Annotations {
  audience?: Role[];
  lastModified?: string;
  priority?: number;
}
```

Optional annotations for the client. The client can use annotations to inform how objects are used or displayed.

- **`audience`** (Optional): Describes who the intended customer of this object or data is. It can include multiple entries to indicate content useful for multiple audiences (e.g., `["user", "assistant"]`).
- **`lastModified`** (Optional): The moment the resource was last modified, as an ISO 8601 formatted string. Should be an ISO 8601 formatted string (e.g., "2025-01-12T15:00:58Z"). Examples: last activity timestamp in an open file, timestamp when the resource was attached, etc.
- **`priority`** (Optional): Describes how important this data is for operating the server. A value of 1 means "most important," and indicates that the data is effectively required, while 0 means "least important," and indicates that the data is entirely optional.

---

### `AudioContent`

```typescript
interface AudioContent {
  _meta?: { [key: string]: unknown };
  annotations?: Annotations;
  data: string;
  mimeType: string;
  type: "audio";
}
```

Audio provided to or from an LLM.

- **`_meta`** (Optional): See [General fields: `_meta`](#meta) for notes on `_meta` usage.
- **`annotations`** (Optional): Optional annotations for the client.
- **`data`**: The base64-encoded audio data.
- **`mimeType`**: The MIME type of the audio. Different providers may support different audio types.

---

### `BlobResourceContents`

```typescript
interface BlobResourceContents {
  _meta?: { [key: string]: unknown };
  blob: string;
  mimeType?: string;
  uri: string;
}
```

The contents of a specific resource or sub-resource.

- **`_meta`** (Optional): See [General fields: `_meta`](#meta) for notes on `_meta` usage.
- **`blob`**: A base64-encoded string representing the binary data of the item.
- **`mimeType`** (Optional): The MIME type of this resource, if known.
- **`uri`**: The URI of this resource.

---

### `BooleanSchema`

```typescript
interface BooleanSchema {
  default?: boolean;
  description?: string;
  title?: string;
  type: "boolean";
}
```

---

### `ClientCapabilities`

```typescript
interface ClientCapabilities {
  elicitation?: object;
  experimental?: { [key: string]: object };
  roots?: { listChanged?: boolean };
  sampling?: object;
}
```

Capabilities a client may support. Known capabilities are defined here, in this schema, but this is not a closed set: any client can define its own, additional capabilities.

- **`elicitation`** (Optional): Present if the client supports elicitation from the server.
- **`experimental`** (Optional): Experimental, non-standard capabilities that the client supports.
- **`roots`** (Optional): Present if the client supports listing roots.
  - **`listChanged`** (Optional): Whether the client supports notifications for changes to the roots list.
- **`sampling`** (Optional): Present if the client supports sampling from an LLM.

---

### `ContentBlock`

```typescript
type ContentBlock =
  | TextContent
  | ImageContent
  | AudioContent
  | ResourceLink
  | EmbeddedResource;
```

---

### `Cursor`

```typescript
type Cursor = string;
```

An opaque token used to represent a cursor for pagination.

---

### `EmbeddedResource`

```typescript
interface EmbeddedResource {
  _meta?: { [key: string]: unknown };
  annotations?: Annotations;
  resource: TextResourceContents | BlobResourceContents;
  type: "resource";
}
```

The contents of a resource, embedded into a prompt or tool call result. It is up to the client how best to render embedded resources for the benefit of the LLM and/or the user.

- **`_meta`** (Optional): See [General fields: `_meta`](#meta) for notes on `_meta` usage.
- **`annotations`** (Optional): Optional annotations for the client.
- **`resource`**: The contents of the resource.

---

### `EmptyResult`

```typescript
type EmptyResult = Result;
```

A response that indicates success but carries no data.

---

### `EnumSchema`

```typescript
interface EnumSchema {
  description?: string;
  enum: string[];
  enumNames?: string[];
  title?: string;
  type: "string";
}
```

---

### `ImageContent`

```typescript
interface ImageContent {
  _meta?: { [key: string]: unknown };
  annotations?: Annotations;
  data: string;
  mimeType: string;
  type: "image";
}
```

An image provided to or from an LLM.

- **`_meta`** (Optional): See [General fields: `_meta`](#meta) for notes on `_meta` usage.
- **`annotations`** (Optional): Optional annotations for the client.
- **`data`**: The base64-encoded image data.
- **`mimeType`**: The MIME type of the image. Different providers may support different image types.

---

### `Implementation`

```typescript
interface Implementation {
  name: string;
  title?: string;
  version: string;
}
```

Describes the name and version of an MCP implementation, with an optional title for UI representation.

- **`name`**: Intended for programmatic or logical use, but used as a display name in past specs or fallback (if title isn't present).
- **`title`** (Optional): Intended for UI and end-user contexts — optimized to be human-readable and easily understood, even by those unfamiliar with domain-specific terminology.
- **`version`**: The version of the implementation.

---

### `JSONRPCError`

```typescript
interface JSONRPCError {
  error: {
    code: number;
    data?: unknown;
    message: string;
  };
  id: RequestId;
  jsonrpc: "2.0";
}
```

A response to a request that indicates an error occurred.

- **`error`**:
  - **`code`**: The error type that occurred.
  - **`data`** (Optional): Additional information about the error. The value of this member is defined by the sender (e.g. detailed error information, nested errors etc.).
  - **`message`**: A short description of the error. The message SHOULD be limited to a concise single sentence.

---

### `JSONRPCNotification`

```typescript
interface JSONRPCNotification {
  jsonrpc: "2.0";
  method: string;
  params?: {
    _meta?: { [key: string]: unknown };
    [key: string]: unknown;
  };
}
```

A notification which does not expect a response.

- **`params`** (Optional):
  - **`_meta`** (Optional): See [General fields: `_meta`](#meta) for notes on `_meta` usage.

---

### `JSONRPCRequest`

```typescript
interface JSONRPCRequest {
  id: RequestId;
  jsonrpc: "2.0";
  method: string;
  params?: {
    _meta?: {
      progressToken?: ProgressToken;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
}
```

A request that expects a response.

- **`params`** (Optional):
  - **`_meta`** (Optional): See [General fields: `_meta`](#meta) for notes on `_meta` usage.
    - **`progressToken`** (Optional): If specified, the caller is requesting out-of-band progress notifications for this request (as represented by notifications/progress). The value of this parameter is an opaque token that will be attached to any subsequent notifications. The receiver is not obligated to provide these notifications.

---

### `JSONRPCResponse`

```typescript
interface JSONRPCResponse {
  id: RequestId;
  jsonrpc: "2.0";
  result: Result;
}
```

A successful (non-error) response to a request.

---

### `LoggingLevel`

```typescript
type LoggingLevel =
  | "debug"
  | "info"
  | "notice"
  | "warning"
  | "error"
  | "critical"
  | "alert"
  | "emergency";
```

The severity of a log message. These map to syslog message severities, as specified in RFC-5424: [https://datatracker.ietf.org/doc/html/rfc5424#section-6.2.1](https://datatracker.ietf.org/doc/html/rfc5424#section-6.2.1).

---

### `ModelHint`

```typescript
interface ModelHint {
  name?: string;
}
```

Hints to use for model selection. Keys not declared here are currently left unspecified by the spec and are up to the client to interpret.

- **`name`** (Optional): A hint for a model name. The client SHOULD treat this as a substring of a model name; for example:
  - `claude-3-5-sonnet` should match `claude-3-5-sonnet-20241022`
  - `sonnet` should match `claude-3-5-sonnet-20241022`, `claude-3-sonnet-20240229`, etc.
  - `claude` should match any Claude model

---

### `ModelPreferences`

```typescript
interface ModelPreferences {
  costPriority?: number;
  hints?: ModelHint[];
  intelligencePriority?: number;
  speedPriority?: number;
}
```

The server's preferences for model selection, requested of the client during sampling.

- **`costPriority`** (Optional): How much to prioritize cost when selecting a model. A value of 0 means cost is not important, while a value of 1 means cost is the most important factor.
- **`hints`** (Optional): Optional hints to use for model selection. If multiple hints are specified, the client MUST evaluate them in order (such that the first match is taken). The client SHOULD prioritize these hints over the numeric priorities, but MAY still use the priorities to select from ambiguous matches.
- **`intelligencePriority`** (Optional): How much to prioritize intelligence and capabilities when selecting a model. A value of 0 means intelligence is not important, while a value of 1 means intelligence is the most important factor.
- **`speedPriority`** (Optional): How much to prioritize sampling speed (latency) when selecting a model. A value of 0 means speed is not important, while a value of 1 means speed is the most important factor.

---

### `NumberSchema`

```typescript
interface NumberSchema {
  description?: string;
  maximum?: number;
  minimum?: number;
  title?: string;
  type: "number" | "integer";
}
```

---

### `PrimitiveSchemaDefinition`

```typescript
type PrimitiveSchemaDefinition =
  | StringSchema
  | NumberSchema
  | BooleanSchema
  | EnumSchema;
```

Restricted schema definitions that only allow primitive types without nested objects or arrays.

---

### `ProgressToken`

```typescript
type ProgressToken = string | number;
```

A progress token, used to associate progress notifications with the original request.

---

### `Prompt`

```typescript
interface Prompt {
  _meta?: { [key: string]: unknown };
  arguments?: PromptArgument[];
  description?: string;
  name: string;
  title?: string;
}
```

A prompt or prompt template that the server offers.

- **`_meta`** (Optional): See [General fields: `_meta`](#meta) for notes on `_meta` usage.
- **`arguments`** (Optional): A list of arguments to use for templating the prompt.
- **`description`** (Optional): An optional description of what this prompt provides.
- **`name`**: Intended for programmatic or logical use, but used as a display name in past specs or fallback (if title isn't present).
- **`title`** (Optional): Intended for UI and end-user contexts — optimized to be human-readable and easily understood, even by those unfamiliar with domain-specific terminology.

---

### `PromptArgument`

```typescript
interface PromptArgument {
  description?: string;
  name: string;
  required?: boolean;
  title?: string;
}
```

Describes an argument that a prompt can accept.

- **`description`** (Optional): A human-readable description of the argument.
- **`name`**: Intended for programmatic or logical use, but used as a display name in past specs or fallback (if title isn't present).
- **`required`** (Optional): Whether this argument must be provided.
- **`title`** (Optional): Intended for UI and end-user contexts — optimized to be human-readable and easily understood, even by those unfamiliar with domain-specific terminology.

---

### `PromptMessage`

```typescript
interface PromptMessage {
  content: ContentBlock;
  role: Role;
}
```

Describes a message returned as part of a prompt. This is similar to `SamplingMessage`, but also supports the embedding of resources from the MCP server.

---

### `PromptReference`

```typescript
interface PromptReference {
  name: string;
  title?: string;
  type: "ref/prompt";
}
```

Identifies a prompt.

- **`name`**: Intended for programmatic or logical use, but used as a display name in past specs or fallback (if title isn't present).
- **`title`** (Optional): Intended for UI and end-user contexts — optimized to be human-readable and easily understood, even by those unfamiliar with domain-specific terminology.

---

### `RequestId`

```typescript
type RequestId = string | number;
```

A uniquely identifying ID for a request in JSON-RPC.

---

### `Resource`

```typescript
interface Resource {
  _meta?: { [key: string]: unknown };
  annotations?: Annotations;
  description?: string;
  mimeType?: string;
  name: string;
  size?: number;
  title?: string;
  uri: string;
}
```

A known resource that the server is capable of reading.

- **`_meta`** (Optional): See [General fields: `_meta`](#meta) for notes on `_meta` usage.
- **`annotations`** (Optional): Optional annotations for the client.
- **`description`** (Optional): A description of what this resource represents. This can be used by clients to improve the LLM's understanding of available resources. It can be thought of like a "hint" to the model.
- **`mimeType`** (Optional): The MIME type of this resource, if known.
- **`name`**: Intended for programmatic or logical use, but used as a display name in past specs or fallback (if title isn't present).
- **`size`** (Optional): The size of the raw resource content, in bytes (i.e., before base64 encoding or any tokenization), if known. This can be used by Hosts to display file sizes and estimate context window usage.
- **`title`** (Optional): Intended for UI and end-user contexts — optimized to be human-readable and easily understood, even by those unfamiliar with domain-specific terminology.
- **`uri`**: The URI of this resource.

---

### `ResourceContents`

```typescript
interface ResourceContents {
  _meta?: { [key: string]: unknown };
  mimeType?: string;
  uri: string;
}
```

The contents of a specific resource or sub-resource.

- **`_meta`** (Optional): See [General fields: `_meta`](#meta) for notes on `_meta` usage.
- **`mimeType`** (Optional): The MIME type of this resource, if known.
- **`uri`**: The URI of this resource.

---

### `ResourceLink`

```typescript
interface ResourceLink {
  _meta?: { [key: string]: unknown };
  annotations?: Annotations;
  description?: string;
  mimeType?: string;
  name: string;
  size?: number;
  title?: string;
  type: "resource_link";
  uri: string;
}
```

A resource that the server is capable of reading, included in a prompt or tool call result. Note: resource links returned by tools are not guaranteed to appear in the results of `resources/list` requests.

- **`_meta`** (Optional): See [General fields: `_meta`](#meta) for notes on `_meta` usage.
- **`annotations`** (Optional): Optional annotations for the client.
- **`description`** (Optional): A description of what this resource represents. This can be used by clients to improve the LLM's understanding of available resources. It can be thought of like a "hint" to the model.
- **`mimeType`** (Optional): The MIME type of this resource, if known.
- **`name`**: Intended for programmatic or logical use, but used as a display name in past specs or fallback (if title isn't present).
- **`size`** (Optional): The size of the raw resource content, in bytes (i.e., before base64 encoding or any tokenization), if known. This can be used by Hosts to display file sizes and estimate context window usage.
- **`title`** (Optional): Intended for UI and end-user contexts — optimized to be human-readable and easily understood, even by those unfamiliar with domain-specific terminology.
- **`uri`**: The URI of this resource.

---

### `ResourceTemplate`

```typescript
interface ResourceTemplate {
  _meta?: { [key: string]: unknown };
  annotations?: Annotations;
  description?: string;
  mimeType?: string;
  name: string;
  title?: string;
  uriTemplate: string;
}
```

A template description for resources available on the server.

- **`_meta`** (Optional): See [General fields: `_meta`](#meta) for notes on `_meta` usage.
- **`annotations`** (Optional): Optional annotations for the client.
- **`description`** (Optional): A description of what this template is for. This can be used by clients to improve the LLM's understanding of available resources. It can be thought of like a "hint" to the model.
- **`mimeType`** (Optional): The MIME type for all resources that match this template. This should only be included if all resources matching this template have the same type.
- **`name`**: Intended for programmatic or logical use, but used as a display name in past specs or fallback (if title isn't present).
- **`title`** (Optional): Intended for UI and end-user contexts — optimized to be human-readable and easily understood, even by those unfamiliar with domain-specific terminology.
- **`uriTemplate`**: A URI template (according to RFC 6570) that can be used to construct resource URIs.

---

### `ResourceTemplateReference`

```typescript
interface ResourceTemplateReference {
  type: "ref/resource";
  uri: string;
}
```

A reference to a resource or resource template definition.

- **`uri`**: The URI or URI template of the resource.

---

### `Result`

```typescript
interface Result {
  _meta?: { [key: string]: unknown };
  [key: string]: unknown;
}
```

- **`_meta`** (Optional): See [General fields: `_meta`](#meta) for notes on `_meta` usage.

---

### `Role`

```typescript
type Role = "user" | "assistant";
```

The sender or recipient of messages and data in a conversation.

---

### `Root`

```typescript
interface Root {
  _meta?: { [key: string]: unknown };
  name?: string;
  uri: string;
}
```

Represents a root directory or file that the server can operate on.

- **`_meta`** (Optional): See [General fields: `_meta`](#meta) for notes on `_meta` usage.
- **`name`** (Optional): An optional name for the root. This can be used to provide a human-readable identifier for the root, which may be useful for display purposes or for referencing the root in other parts of the application.
- **`uri`**: The URI identifying the root. This must start with `file://` for now. This restriction may be relaxed in future versions of the protocol to allow other URI schemes.

---

### `SamplingMessage`

```typescript
interface SamplingMessage {
  content: TextContent | ImageContent | AudioContent;
  role: Role;
}
```

Describes a message issued to or received from an LLM API.

---

### `ServerCapabilities`

```typescript
interface ServerCapabilities {
  completions?: object;
  experimental?: { [key: string]: object };
  logging?: object;
  prompts?: { listChanged?: boolean };
  resources?: { listChanged?: boolean; subscribe?: boolean };
  tools?: { listChanged?: boolean };
}
```

Capabilities that a server may support. Known capabilities are defined here, in this schema, but this is not a closed set: any server can define its own, additional capabilities.

- **`completions`** (Optional): Present if the server supports argument autocompletion suggestions.
- **`experimental`** (Optional): Experimental, non-standard capabilities that the server supports.
- **`logging`** (Optional): Present if the server supports sending log messages to the client.
- **`prompts`** (Optional): Present if the server offers any prompt templates.
  - **`listChanged`** (Optional): Whether this server supports notifications for changes to the prompt list.
- **`resources`** (Optional): Present if the server offers any resources to read.
  - **`listChanged`** (Optional): Whether this server supports notifications for changes to the resource list.
  - **`subscribe`** (Optional): Whether this server supports subscribing to resource updates.
- **`tools`** (Optional): Present if the server offers any tools to call.
  - **`listChanged`** (Optional): Whether this server supports notifications for changes to the tool list.

---

### `StringSchema`

```typescript
interface StringSchema {
  description?: string;
  format?: "uri" | "email" | "date" | "date-time";
  maxLength?: number;
  minLength?: number;
  title?: string;
  type: "string";
}
```

---

### `TextContent`

```typescript
interface TextContent {
  _meta?: { [key: string]: unknown };
  annotations?: Annotations;
  text: string;
  type: "text";
}
```

Text provided to or from an LLM.

- **`_meta`** (Optional): See [General fields: `_meta`](#meta) for notes on `_meta` usage.
- **`annotations`** (Optional): Optional annotations for the client.
- **`text`**: The text content of the message.

---

### `TextResourceContents`

```typescript
interface TextResourceContents {
  _meta?: { [key: string]: unknown };
  mimeType?: string;
  text: string;
  uri: string;
}
```

The contents of a specific resource or sub-resource.

- **`_meta`** (Optional): See [General fields: `_meta`](#meta) for notes on `_meta` usage.
- **`mimeType`** (Optional): The MIME type of this resource, if known.
- **`text`**: The text of the item. This must only be set if the item can actually be represented as text (not binary data).
- **`uri`**: The URI of this resource.

---

### `Tool`

```typescript
interface Tool {
  _meta?: { [key: string]: unknown };
  annotations?: ToolAnnotations;
  description?: string;
  inputSchema: {
    properties?: { [key: string]: object };
    required?: string[];
    type: "object";
  };
  name: string;
  outputSchema?: {
    properties?: { [key: string]: object };
    required?: string[];
    type: "object";
  };
  title?: string;
}
```

Definition for a tool the client can call.

- **`_meta`** (Optional): See [General fields: `_meta`](#meta) for notes on `_meta` usage.
- **`annotations`** (Optional): Optional additional tool information. Display name precedence order is: title, annotations.title, then name.
- **`description`** (Optional): A human-readable description of the tool. This can be used by clients to improve the LLM's understanding of available tools. It can be thought of like a "hint" to the model.
- **`inputSchema`**: A JSON Schema object defining the expected parameters for the tool.
- **`name`**: Intended for programmatic or logical use, but used as a display name in past specs or fallback (if title isn't present).
- **`outputSchema`** (Optional): An optional JSON Schema object defining the structure of the tool's output returned in the structuredContent field of a CallToolResult.
- **`title`** (Optional): Intended for UI and end-user contexts — optimized to be human-readable and easily understood, even by those unfamiliar with domain-specific terminology.

---

### `ToolAnnotations`

```typescript
interface ToolAnnotations {
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
  readOnlyHint?: boolean;
  title?: string;
}
```

Additional properties describing a Tool to clients.

- **`destructiveHint`** (Optional): If true, the tool may perform destructive updates to its environment. If false, the tool performs only additive updates. (This property is meaningful only when `readOnlyHint == false`). Default: true.
- **`idempotentHint`** (Optional): If true, calling the tool repeatedly with the same arguments will have no additional effect on the its environment. (This property is meaningful only when `readOnlyHint == false`). Default: false.
- **`openWorldHint`** (Optional): If true, this tool may interact with an "open world" of external entities. If false, the tool's domain of interaction is closed. For example, the world of a web search tool is open, whereas that of a memory tool is not. Default: true.
- **`readOnlyHint`** (Optional): If true, the tool does not modify its environment. Default: false.
- **`title`** (Optional): A human-readable title for the tool.

---

## `completion/complete`

### `CompleteRequest`

```typescript
interface CompleteRequest {
  method: "completion/complete";
  params: {
    argument: { name: string; value: string };
    context?: { arguments?: { [key: string]: string } };
    ref: PromptReference | ResourceTemplateReference;
  };
}
```

A request from the client to the server, to ask for completion options.

- **`params`**:
  - **`argument`**: The argument's information.
    - **`name`**: The name of the argument.
    - **`value`**: The value of the argument to use for completion matching.
  - **`context`** (Optional): Additional, optional context for completions.
    - **`arguments`** (Optional): Previously-resolved variables in a URI template or prompt.
  - **`ref`**: A reference to a prompt or resource template.

---

### `CompleteResult`

```typescript
interface CompleteResult {
  _meta?: { [key: string]: unknown };
  completion: {
    hasMore?: boolean;
    total?: number;
    values: string[];
  };
  [key: string]: unknown;
}
```

The server's response to a completion/complete request.

- **`_meta`** (Optional): See [General fields: `_meta`](#meta) for notes on `_meta` usage.
- **`completion`**:
  - **`hasMore`** (Optional): Indicates whether there are additional completion options beyond those provided in the current response, even if the exact total is unknown.
  - **`total`** (Optional): The total number of completion options available. This can exceed the number of values actually sent in the response.
  - **`values`**: An array of completion values. Must not exceed 100 items.

---

## `elicitation/create`

### `ElicitRequest`

```typescript
interface ElicitRequest {
  method: "elicitation/create";
  params: {
    message: string;
    requestedSchema: {
      properties: { [key: string]: PrimitiveSchemaDefinition };
      required?: string[];
      type: "object";
    };
  };
}
```

A request from the server to elicit additional information from the user via the client.

- **`params`**:
  - **`message`**: The message to present to the user.
  - **`requestedSchema`**: A restricted subset of JSON Schema. Only top-level properties are allowed, without nesting.

---

### `ElicitResult`

```typescript
interface ElicitResult {
  _meta?: { [key: string]: unknown };
  action: "accept" | "decline" | "cancel";
  content?: { [key: string]: string | number | boolean };
  [key: string]: unknown;
}
```

The client's response to an elicitation request.

- **`_meta`** (Optional): See [General fields: `_meta`](#meta) for notes on `_meta` usage.
- **`action`**: The user action in response to the elicitation.
  - `"accept"`: User submitted the form/confirmed the action.
  - `"decline"`: User explicitly declined the action.
  - `"cancel"`: User dismissed without making an explicit choice.
- **`content`** (Optional): The submitted form data, only present when action is "accept". Contains values matching the requested schema.

---

## `initialize`

### `InitializeRequest`

```typescript
interface InitializeRequest {
  method: "initialize";
  params: {
    capabilities: ClientCapabilities;
    clientInfo: Implementation;
    protocolVersion: string;
  };
}
```

This request is sent from the client to the server when it first connects, asking it to begin initialization.

- **`params`**:
  - **`capabilities`**: The capabilities of the client.
  - **`clientInfo`**: Information about the client.
  - **`protocolVersion`**: The latest version of the Model Context Protocol that the client supports. The client MAY decide to support older versions as well.

---

### `InitializeResult`

```typescript
interface InitializeResult {
  _meta?: { [key: string]: unknown };
  capabilities: ServerCapabilities;
  instructions?: string;
  protocolVersion: string;
  serverInfo: Implementation;
  [key: string]: unknown;
}
```

After receiving an initialize request from the client, the server sends this response.

- **`_meta`** (Optional): See [General fields: `_meta`](#meta) for notes on `_meta` usage.
- **`capabilities`**: The capabilities of the server.
- **`instructions`** (Optional): Instructions describing how to use the server and its features. This can be used by clients to improve the LLM's understanding of available tools, resources, etc. It can be thought of like a "hint" to the model. For example, this information MAY be added to the system prompt.
- **`protocolVersion`**: The version of the Model Context Protocol that the server wants to use. This may not match the version that the client requested. If the client cannot support this version, it MUST disconnect.
- **`serverInfo`**: Information about the server.

---

## `logging/setLevel`

### `SetLevelRequest`

```typescript
interface SetLevelRequest {
  method: "logging/setLevel";
  params: { level: LoggingLevel };
}
```

A request from the client to the server, to enable or adjust logging.

- **`params`**:
  - **`level`**: The level of logging that the client wants to receive from the server. The server should send all logs at this level and higher (i.e., more severe) to the client as notifications/message.

---

## `notifications/cancelled`

### `CancelledNotification`

```typescript
interface CancelledNotification {
  method: "notifications/cancelled";
  params: {
    reason?: string;
    requestId: RequestId;
  };
}
```

This notification can be sent by either side to indicate that it is cancelling a previously-issued request. The request SHOULD still be in-flight, but due to communication latency, it is always possible that this notification MAY arrive after the request has already finished. This notification indicates that the result will be unused, so any associated processing SHOULD cease. A client MUST NOT attempt to cancel its `initialize` request.

- **`params`**:
  - **`reason`** (Optional): An optional string describing the reason for the cancellation. This MAY be logged or presented to the user.
  - **`requestId`**: The ID of the request to cancel. This MUST correspond to the ID of a request previously issued in the same direction.

---

## `notifications/initialized`

### `InitializedNotification`

```typescript
interface InitializedNotification {
  method: "notifications/initialized";
  params?: {
    _meta?: { [key: string]: unknown };
    [key: string]: unknown;
  };
}
```

This notification is sent from the client to the server after initialization has finished.

- **`params`** (Optional):
  - **`_meta`** (Optional): See [General fields: `_meta`](#meta) for notes on `_meta` usage.

---

## `notifications/message`

### `LoggingMessageNotification`

```typescript
interface LoggingMessageNotification {
  method: "notifications/message";
  params: {
    data: unknown;
    level: LoggingLevel;
    logger?: string;
  };
}
```

Notification of a log message passed from server to client. If no logging/setLevel request has been sent from the client, the server MAY decide which messages to send automatically.

- **`params`**:
  - **`data`**: The data to be logged, such as a string message or an object. Any JSON serializable type is allowed here.
  - **`level`**: The severity of this log message.
  - **`logger`** (Optional): An optional name of the logger issuing this message.

---

## `notifications/progress`

### `ProgressNotification`

```typescript
interface ProgressNotification {
  method: "notifications/progress";
  params: {
    message?: string;
    progress: number;
    progressToken: ProgressToken;
    total?: number;
  };
}
```

An out-of-band notification used to inform the receiver of a progress update for a long-running request.

- **`params`**:
  - **`message`** (Optional): An optional message describing the current progress.
  - **`progress`**: The progress thus far. This should increase every time progress is made, even if the total is unknown.
  - **`progressToken`**: The progress token which was given in the initial request, used to associate this notification with the request that is proceeding.
  - **`total`** (Optional): Total number of items to process (or total progress required), if known.

---

## `notifications/prompts/list_changed`

### `PromptListChangedNotification`

```typescript
interface PromptListChangedNotification {
  method: "notifications/prompts/list_changed";
  params?: {
    _meta?: { [key: string]: unknown };
    [key: string]: unknown;
  };
}
```

An optional notification from the server to the client, informing it that the list of prompts it offers has changed. This may be issued by servers without any previous subscription from the client.

- **`params`** (Optional):
  - **`_meta`** (Optional): See [General fields: `_meta`](#meta) for notes on `_meta` usage.

---

## `notifications/resources/list_changed`

### `ResourceListChangedNotification`

```typescript
interface ResourceListChangedNotification {
  method: "notifications/resources/list_changed";
  params?: {
    _meta?: { [key: string]: unknown };
    [key: string]: unknown;
  };
}
```

An optional notification from the server to the client, informing it that the list of resources it can read from has changed. This may be issued by servers without any previous subscription from the client.

- **`params`** (Optional):
  - **`_meta`** (Optional): See [General fields: `_meta`](#meta) for notes on `_meta` usage.

---

## `notifications/resources/updated`

### `ResourceUpdatedNotification`

```typescript
interface ResourceUpdatedNotification {
  method: "notifications/resources/updated";
  params: { uri: string };
}
```

A notification from the server to the client, informing it that a resource has changed and may need to be read again. This should only be sent if the client previously sent a resources/subscribe request.

- **`params`**:
  - **`uri`**: The URI of the resource that has been updated. This might be a sub-resource of the one that the client actually subscribed to.

---

## `notifications/roots/list_changed`

### `RootsListChangedNotification`

```typescript
interface RootsListChangedNotification {
  method: "notifications/roots/list_changed";
  params?: {
    _meta?: { [key: string]: unknown };
    [key: string]: unknown;
  };
}
```

A notification from the client to the server, informing it that the list of roots has changed. This notification should be sent whenever the client adds, removes, or modifies any root. The server should then request an updated list of roots using the ListRootsRequest.

- **`params`** (Optional):
  - **`_meta`** (Optional): See [General fields: `_meta`](#meta) for notes on `_meta` usage.

---

## `notifications/tools/list_changed`

### `ToolListChangedNotification`

```typescript
interface ToolListChangedNotification {
  method: "notifications/tools/list_changed";
  params?: {
    _meta?: { [key: string]: unknown };
    [key: string]: unknown;
  };
}
```

An optional notification from the server to the client, informing it that the list of tools it offers has changed. This may be issued by servers without any previous subscription from the client.

- **`params`** (Optional):
  - **`_meta`** (Optional): See [General fields: `_meta`](#meta) for notes on `_meta` usage.

---

## `ping`

### `PingRequest`

```typescript
interface PingRequest {
  method: "ping";
  params?: {
    _meta?: {
      progressToken?: ProgressToken;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
}
```

A ping, issued by either the server or the client, to check that the other party is still alive. The receiver must promptly respond, or else may be disconnected.

- **`params`** (Optional):
  - **`_meta`** (Optional): See [General fields: `_meta`](#meta) for notes on `_meta` usage.
    - **`progressToken`** (Optional): If specified, the caller is requesting out-of-band progress notifications for this request (as represented by notifications/progress). The value of this parameter is an opaque token that will be attached to any subsequent notifications. The receiver is not obligated to provide these notifications.

---

## `prompts/get`

### `GetPromptRequest`

```typescript
interface GetPromptRequest {
  method: "prompts/get";
  params: {
    arguments?: { [key: string]: string };
    name: string;
  };
}
```

Used by the client to get a prompt provided by the server.

- **`params`**:
  - **`arguments`** (Optional): Arguments to use for templating the prompt.
  - **`name`**: The name of the prompt or prompt template.

---

### `GetPromptResult`

```typescript
interface GetPromptResult {
  _meta?: { [key: string]: unknown };
  description?: string;
  messages: PromptMessage[];
  [key: string]: unknown;
}
```

The server's response to a prompts/get request from the client.

- **`_meta`** (Optional): See [General fields: `_meta`](#meta) for notes on `_meta` usage.
- **`description`** (Optional): An optional description for the prompt.
- **`messages`**: The messages that make up the prompt.

---

## `prompts/list`

### `ListPromptsRequest`

```typescript
interface ListPromptsRequest {
  method: "prompts/list";
  params?: { cursor?: string };
}
```

Sent from the client to request a list of prompts and prompt templates the server has.

- **`params`** (Optional):
  - **`cursor`** (Optional): An opaque token representing the current pagination position. If provided, the server should return results starting after this cursor.

---

### `ListPromptsResult`

```typescript
interface ListPromptsResult {
  _meta?: { [key: string]: unknown };
  nextCursor?: string;
  prompts: Prompt[];
  [key: string]: unknown;
}
```

The server's response to a prompts/list request from the client.

- **`_meta`** (Optional): See [General fields: `_meta`](#meta) for notes on `_meta` usage.
- **`nextCursor`** (Optional): An opaque token representing the pagination position after the last returned result. If present, there may be more results available.
- **`prompts`**: The list of prompts.

---

## `resources/list`

### `ListResourcesRequest`

```typescript
interface ListResourcesRequest {
  method: "resources/list";
  params?: { cursor?: string };
}
```

Sent from the client to request a list of resources the server has.

- **`params`** (Optional):
  - **`cursor`** (Optional): An opaque token representing the current pagination position. If provided, the server should return results starting after this cursor.

---

### `ListResourcesResult`

```typescript
interface ListResourcesResult {
  _meta?: { [key: string]: unknown };
  nextCursor?: string;
  resources: Resource[];
  [key: string]: unknown;
}
```

The server's response to a resources/list request from the client.

- **`_meta`** (Optional): See [General fields: `_meta`](#meta) for notes on `_meta` usage.
- **`nextCursor`** (Optional): An opaque token representing the pagination position after the last returned result. If present, there may be more results available.
- **`resources`**: The list of resources.

---

## `resources/read`

### `ReadResourceRequest`

```typescript
interface ReadResourceRequest {
  method: "resources/read";
  params: { uri: string };
}
```

Sent from the client to the server, to read a specific resource URI.

- **`params`**:
  - **`uri`**: The URI of the resource to read. The URI can use any protocol; it is up to the server how to interpret it.

---

### `ReadResourceResult`

```typescript
interface ReadResourceResult {
  _meta?: { [key: string]: unknown };
  contents: (TextResourceContents | BlobResourceContents)[];
  [key: string]: unknown;
}
```

The server's response to a resources/read request from the client.

- **`_meta`** (Optional): See [General fields: `_meta`](#meta) for notes on `_meta` usage.
- **`contents`**: The contents of the resource.

---

## `resources/subscribe`

### `SubscribeRequest`

```typescript
interface SubscribeRequest {
  method: "resources/subscribe";
  params: { uri: string };
}
```

Sent from the client to request resources/updated notifications from the server whenever a particular resource changes.

- **`params`**:
  - **`uri`**: The URI of the resource to subscribe to. The URI can use any protocol; it is up to the server how to interpret it.

---

## `resources/templates/list`

### `ListResourceTemplatesRequest`

```typescript
interface ListResourceTemplatesRequest {
  method: "resources/templates/list";
  params?: { cursor?: string };
}
```

Sent from the client to request a list of resource templates the server has.

- **`params`** (Optional):
  - **`cursor`** (Optional): An opaque token representing the current pagination position. If provided, the server should return results starting after this cursor.

---

### `ListResourceTemplatesResult`

```typescript
interface ListResourceTemplatesResult {
  _meta?: { [key: string]: unknown };
  nextCursor?: string;
  resourceTemplates: ResourceTemplate[];
  [key: string]: unknown;
}
```

The server's response to a resources/templates/list request from the client.

- **`_meta`** (Optional): See [General fields: `_meta`](#meta) for notes on `_meta` usage.
- **`nextCursor`** (Optional): An opaque token representing the pagination position after the last returned result. If present, there may be more results available.
- **`resourceTemplates`**: The list of resource templates.

---

## `resources/unsubscribe`

### `UnsubscribeRequest`

```typescript
interface UnsubscribeRequest {
  method: "resources/unsubscribe";
  params: { uri: string };
}
```

Sent from the client to request cancellation of resources/updated notifications from the server. This should follow a previous resources/subscribe request.

- **`params`**:
  - **`uri`**: The URI of the resource to unsubscribe from.

---

## `roots/list`

### `ListRootsRequest`

```typescript
interface ListRootsRequest {
  method: "roots/list";
  params?: {
    _meta?: {
      progressToken?: ProgressToken;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
}
```

Sent from the server to request a list of root URIs from the client. Roots allow servers to ask for specific directories or files to operate on. A common example for roots is providing a set of repositories or directories a server should operate on. This request is typically used when the server needs to understand the file system structure or access specific locations that the client has permission to read from.

- **`params`** (Optional):
  - **`_meta`** (Optional): See [General fields: `_meta`](#meta) for notes on `_meta` usage.
    - **`progressToken`** (Optional): If specified, the caller is requesting out-of-band progress notifications for this request (as represented by notifications/progress). The value of this parameter is an opaque token that will be attached to any subsequent notifications. The receiver is not obligated to provide these notifications.

---

### `ListRootsResult`

```typescript
interface ListRootsResult {
  _meta?: { [key: string]: unknown };
  roots: Root[];
  [key: string]: unknown;
}
```

The client's response to a roots/list request from the server. This result contains an array of Root objects, each representing a root directory or file that the server can operate on.

- **`_meta`** (Optional): See [General fields: `_meta`](#meta) for notes on `_meta` usage.
- **`roots`**: The list of roots.

---

## `sampling/createMessage`

### `CreateMessageRequest`

```typescript
interface CreateMessageRequest {
  method: "sampling/createMessage";
  params: {
    includeContext?: "none" | "thisServer" | "allServers";
    maxTokens: number;
    messages: SamplingMessage[];
    metadata?: object;
    modelPreferences?: ModelPreferences;
    stopSequences?: string[];
    systemPrompt?: string;
    temperature?: number;
  };
}
```

A request from the server to sample an LLM via the client. The client has full discretion over which model to select. The client should also inform the user before beginning sampling, to allow them to inspect the request (human in the loop) and decide whether to approve it.

- **`params`**:
  - **`includeContext`** (Optional): A request to include context from one or more MCP servers (including the caller), to be attached to the prompt. The client MAY ignore this request.
  - **`maxTokens`**: The maximum number of tokens to sample, as requested by the server. The client MAY choose to sample fewer tokens than requested.
  - **`messages`**: The messages to sample from.
  - **`metadata`** (Optional): Optional metadata to pass through to the LLM provider. The format of this metadata is provider-specific.
  - **`modelPreferences`** (Optional): The server's preferences for which model to select. The client MAY ignore these preferences.
  - **`stopSequences`** (Optional): Optional stop sequences to use for sampling.
  - **`systemPrompt`** (Optional): An optional system prompt the server wants to use for sampling. The client MAY modify or omit this prompt.
  - **`temperature`** (Optional): The temperature to use for sampling.

---

### `CreateMessageResult`

```typescript
interface CreateMessageResult {
  _meta?: { [key: string]: unknown };
  content: TextContent | ImageContent | AudioContent;
  model: string;
  role: Role;
  stopReason?: string;
  [key: string]: unknown;
}
```

The client's response to a sampling/create_message request from the server. The client should inform the user before returning the sampled message, to allow them to inspect the response (human in the loop) and decide whether to allow the server to see it.

- **`_meta`** (Optional): See [General fields: `_meta`](#meta) for notes on `_meta` usage.
- **`content`**: The content of the message.
- **`model`**: The name of the model that generated the message.
- **`role`**: The role of the message.
- **`stopReason`** (Optional): The reason why sampling stopped, if known.

---

## `tools/call`

### `CallToolRequest`

```typescript
interface CallToolRequest {
  method: "tools/call";
  params: {
    arguments?: { [key: string]: unknown };
    name: string;
  };
}
```

Used by the client to invoke a tool provided by the server.

- **`params`**:
  - **`arguments`** (Optional): The arguments to pass to the tool.
  - **`name`**: The name of the tool to call.

---

### `CallToolResult`

```typescript
interface CallToolResult {
  _meta?: { [key: string]: unknown };
  content: ContentBlock[];
  isError?: boolean;
  structuredContent?: { [key: string]: unknown };
  [key: string]: unknown;
}
```

The server's response to a tool call.

- **`_meta`** (Optional): See [General fields: `_meta`](#meta) for notes on `_meta` usage.
- **`content`**: A list of content objects that represent the unstructured result of the tool call.
- **`isError`** (Optional): Whether the tool call ended in an error. If not set, this is assumed to be false (the call was successful). Any errors that originate from the tool SHOULD be reported inside the result object, with `isError` set to true, not as an MCP protocol-level error response. Otherwise, the LLM would not be able to see that an error occurred and self-correct. However, any errors in finding the tool, an error indicating that the server does not support tool calls, or any other exceptional conditions, should be reported as an MCP error response.
- **`structuredContent`** (Optional): An optional JSON object that represents the structured result of the tool call.

---

## `tools/list`

### `ListToolsRequest`

```typescript
interface ListToolsRequest {
  method: "tools/list";
  params?: { cursor?: string };
}
```

Sent from the client to request a list of tools the server has.

- **`params`** (Optional):
  - **`cursor`** (Optional): An opaque token representing the current pagination position. If provided, the server should return results starting after this cursor.

---

### `ListToolsResult`

```typescript
interface ListToolsResult {
  _meta?: { [key: string]: unknown };
  nextCursor?: string;
  tools: Tool[];
  [key: string]: unknown;
}
```

The server's response to a tools/list request from the client.

- **`_meta`** (Optional): See [General fields: `_meta`](#meta) for notes on `_meta` usage.
- **`nextCursor`** (Optional): An opaque token representing the pagination position after the last returned result. If present, there may be more results available.
- **`tools`**: The list of tools.

---
