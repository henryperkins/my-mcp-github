# Schema Reference

## [Common Types](https://modelcontextprotocol.io/specification/2025-06-18/schema#common-types)

### [`Annotations`](https://modelcontextprotocol.io/specification/2025-06-18/schema#annotations)

```typescript
interface Annotations {
  [audience](https://modelcontextprotocol.io/specification/2025-06-18/schema#annotations-audience)?: [Role](https://modelcontextprotocol.io/specification/2025-06-18/schema#role)[];
  [lastModified](https://modelcontextprotocol.io/specification/2025-06-18/schema#annotations-lastmodified)?: string;
  [priority](https://modelcontextprotocol.io/specification/2025-06-18/schema#annotations-priority)?: number;
}
```

**Description**: Optional annotations for the client. The client can use annotations to inform how objects are used or displayed.

- **audience**: Describes who the intended customer of this object or data is. It can include multiple entries to indicate content useful for multiple audiences (e.g., `["user", "assistant"]`).
- **lastModified**: The moment the resource was last modified, as an ISO 8601 formatted string. Should be an ISO 8601 formatted string (e.g., "2025-01-12T15:00:58Z"). Examples: last activity timestamp in an open file, timestamp when the resource was attached, etc.
- **priority**: Describes how important this data is for operating the server. A value of 1 means "most important," and indicates that the data is effectively required, while 0 means "least important," and indicates that the data is entirely optional.

---

### [`AudioContent`](https://modelcontextprotocol.io/specification/2025-06-18/schema#audiocontent)

```typescript
interface AudioContent {
  [_meta](https://modelcontextprotocol.io/specification/2025-06-18/schema#audiocontent-_meta)?: { [key: string]: unknown };
  [annotations](https://modelcontextprotocol.io/specification/2025-06-18/schema#audiocontent-annotations)?: [Annotations](https://modelcontextprotocol.io/specification/2025-06-18/schema#annotations);
  [data](https://modelcontextprotocol.io/specification/2025-06-18/schema#audiocontent-data): string;
  [mimeType](https://modelcontextprotocol.io/specification/2025-06-18/schema#audiocontent-mimetype): string;
  [type](https://modelcontextprotocol.io/specification/2025-06-18/schema#): "audio";
}
```

**Description**: Audio provided to or from an LLM.

- **_meta**: See [General fields: `_meta`](https://modelcontextprotocol.io/specification/2025-06-18/basic/index#meta) for notes on `_meta` usage.
- **annotations**: Optional annotations for the client.
- **data**: The base64-encoded audio data.
- **mimeType**: The MIME type of the audio. Different providers may support different audio types.

---

### [`BlobResourceContents`](https://modelcontextprotocol.io/specification/2025-06-18/schema#blobresourcecontents)

```typescript
interface BlobResourceContents {
  [_meta](https://modelcontextprotocol.io/specification/2025-06-18/schema#blobresourcecontents-_meta)?: { [key: string]: unknown };
  [blob](https://modelcontextprotocol.io/specification/2025-06-18/schema#blobresourcecontents-blob): string;
  [mimeType](https://modelcontextprotocol.io/specification/2025-06-18/schema#blobresourcecontents-mimetype)?: string;
  [uri](https://modelcontextprotocol.io/specification/2025-06-18/schema#blobresourcecontents-uri): string;
}
```

**Description**: The contents of a specific resource or sub-resource.

- **_meta**: See [General fields: `_meta`](https://modelcontextprotocol.io/specification/2025-06-18/basic/index#meta) for notes on `_meta` usage.
- **blob**: A base64-encoded string representing the binary data of the item.
- **mimeType**: The MIME type of this resource, if known.
- **uri**: The URI of this resource.

---

### [`BooleanSchema`](https://modelcontextprotocol.io/specification/2025-06-18/schema#booleanschema)

```typescript
interface BooleanSchema {
  [default](https://modelcontextprotocol.io/specification/2025-06-18/schema#)?: boolean;
  [description](https://modelcontextprotocol.io/specification/2025-06-18/schema#)?: string;
  [title](https://modelcontextprotocol.io/specification/2025-06-18/schema#)?: string;
  [type](https://modelcontextprotocol.io/specification/2025-06-18/schema#): "boolean";
}
```

---

### [`ClientCapabilities`](https://modelcontextprotocol.io/specification/2025-06-18/schema#clientcapabilities)

```typescript
interface ClientCapabilities {
  [elicitation](https://modelcontextprotocol.io/specification/2025-06-18/schema#clientcapabilities-elicitation)?: object;
  [experimental](https://modelcontextprotocol.io/specification/2025-06-18/schema#clientcapabilities-experimental)?: { [key: string]: object };
  [roots](https://modelcontextprotocol.io/specification/2025-06-18/schema#clientcapabilities-roots)?: { listChanged?: boolean };
  [sampling](https://modelcontextprotocol.io/specification/2025-06-18/schema#clientcapabilities-sampling)?: object;
}
```

**Description**: Capabilities a client may support. Known capabilities are defined here, in this schema, but this is not a closed set: any client can define its own, additional capabilities.

- **elicitation**: Present if the client supports elicitation from the server.
- **experimental**: Experimental, non-standard capabilities that the client supports.
- **roots**: Present if the client supports listing roots.
  - **listChanged?**: boolean - Whether the client supports notifications for changes to the roots list.
- **sampling**: Present if the client supports sampling from an LLM.

---

### [`ContentBlock`](https://modelcontextprotocol.io/specification/2025-06-18/schema#contentblock)

```typescript
ContentBlock:
  | [TextContent](https://modelcontextprotocol.io/specification/2025-06-18/schema#textcontent)
  | [ImageContent](https://modelcontextprotocol.io/specification/2025-06-18/schema#imagecontent)
  | [AudioContent](https://modelcontextprotocol.io/specification/2025-06-18/schema#audiocontent)
  | [ResourceLink](https://modelcontextprotocol.io/specification/2025-06-18/schema#resourcelink)
  | [EmbeddedResource](https://modelcontextprotocol.io/specification/2025-06-18/schema#embeddedresource)
```

---

### [`Cursor`](https://modelcontextprotocol.io/specification/2025-06-18/schema#cursor)

```typescript
Cursor: string
```

**Description**: An opaque token used to represent a cursor for pagination.

---

### [`EmbeddedResource`](https://modelcontextprotocol.io/specification/2025-06-18/schema#embeddedresource)

```typescript
interface EmbeddedResource {
  [_meta](https://modelcontextprotocol.io/specification/2025-06-18/schema#embeddedresource-_meta)?: { [key: string]: unknown };
  [annotations](https://modelcontextprotocol.io/specification/2025-06-18/schema#embeddedresource-annotations)?: [Annotations](https://modelcontextprotocol.io/specification/2025-06-18/schema#annotations);
  [resource](https://modelcontextprotocol.io/specification/2025-06-18/schema#): [TextResourceContents](https://modelcontextprotocol.io/specification/2025-06-18/schema#textresourcecontents) | [BlobResourceContents](https://modelcontextprotocol.io/specification/2025-06-18/schema#blobresourcecontents);
  [type](https://modelcontextprotocol.io/specification/2025-06-18/schema#): "resource";
}
```

**Description**: The contents of a resource, embedded into a prompt or tool call result. It is up to the client how best to render embedded resources for the benefit of the LLM and/or the user.

- **_meta**: See [General fields: `_meta`](https://modelcontextprotocol.io/specification/2025-06-18/basic/index#meta) for notes on `_meta` usage.
- **annotations**: Optional annotations for the client.

---

### [`EmptyResult`](https://modelcontextprotocol.io/specification/2025-06-18/schema#emptyresult)

```typescript
EmptyResult: [Result](https://modelcontextprotocol.io/specification/2025-06-18/schema#result)
```

**Description**: A response that indicates success but carries no data.

---

### [`EnumSchema`](https://modelcontextprotocol.io/specification/2025-06-18/schema#enumschema)

```typescript
interface EnumSchema {
  [description](https://modelcontextprotocol.io/specification/2025-06-18/schema#)?: string;
  [enum](https://modelcontextprotocol.io/specification/2025-06-18/schema#): string[];
  [enumNames](https://modelcontextprotocol.io/specification/2025-06-18/schema#)?: string[];
  [title](https://modelcontextprotocol.io/specification/2025-06-18/schema#)?: string;
  [type](https://modelcontextprotocol.io/specification/2025-06-18/schema#): "string";
}
```

---

### [`ImageContent`](https://modelcontextprotocol.io/specification/2025-06-18/schema#imagecontent)

```typescript
interface ImageContent {
  [_meta](https://modelcontextprotocol.io/specification/2025-06-18/schema#imagecontent-_meta)?: { [key: string]: unknown };
  [annotations](https://modelcontextprotocol.io/specification/2025-06-18/schema#imagecontent-annotations)?: [Annotations](https://modelcontextprotocol.io/specification/2025-06-18/schema#annotations);
  [data](https://modelcontextprotocol.io/specification/2025-06-18/schema#imagecontent-data): string;
  [mimeType](https://modelcontextprotocol.io/specification/2025-06-18/schema#imagecontent-mimetype): string;
  [type](https://modelcontextprotocol.io/specification/2025-06-18/schema#): "image";
}
```

**Description**: An image provided to or from an LLM.

- **_meta**: See [General fields: `_meta`](https://modelcontextprotocol.io/specification/2025-06-18/basic/index#meta) for notes on `_meta` usage.
- **annotations**: Optional annotations for the client.
- **data**: The base64-encoded image data.
- **mimeType**: The MIME type of the image. Different providers may support different image types.

---

### [`Implementation`](https://modelcontextprotocol.io/specification/2025-06-18/schema#implementation)

```typescript
interface Implementation {
  [name](https://modelcontextprotocol.io/specification/2025-06-18/schema#implementation-name): string;
  [title](https://modelcontextprotocol.io/specification/2025-06-18/schema#implementation-title)?: string;
  [version](https://modelcontextprotocol.io/specification/2025-06-18/schema#): string;
}
```

**Description**: Describes the name and version of an MCP implementation, with an optional title for UI representation.

- **name**: Intended for programmatic or logical use, but used as a display name in past specs or fallback (if title isn’t present).
- **title**: Intended for UI and end-user contexts — optimized to be human-readable and easily understood, even by those unfamiliar with domain-specific terminology. If not provided, the name should be used for display (except for Tool, where `annotations.title` should be given precedence over using `name`, if present).

---

### [`JSONRPCError`](https://modelcontextprotocol.io/specification/2025-06-18/schema#jsonrpcerror)

```typescript
interface JSONRPCError {
  [error](https://modelcontextprotocol.io/specification/2025-06-18/schema#jsonrpcerror-error): { code: number; data?: unknown; message: string };
  [id](https://modelcontextprotocol.io/specification/2025-06-18/schema#): [RequestId](https://modelcontextprotocol.io/specification/2025-06-18/schema#requestid);
  [jsonrpc](https://modelcontextprotocol.io/specification/2025-06-18/schema#): "2.0";
}
```

**Description**: A response to a request that indicates an error occurred.

- **error**:
  - **code**: number - The error type that occurred.
  - **data?**: unknown - Additional information about the error. The value of this member is defined by the sender (e.g. detailed error information, nested errors etc.).
  - **message**: string - A short description of the error. The message SHOULD be limited to a concise single sentence.

---

### [`JSONRPCNotification`](https://modelcontextprotocol.io/specification/2025-06-18/schema#jsonrpcnotification)

```typescript
interface JSONRPCNotification {
  [jsonrpc](https://modelcontextprotocol.io/specification/2025-06-18/schema#): "2.0";
  [method](https://modelcontextprotocol.io/specification/2025-06-18/schema#): string;
  [params](https://modelcontextprotocol.io/specification/2025-06-18/schema#jsonrpcnotification-params)?: { _meta?: { [key: string]: unknown }; [key: string]: unknown };
}
```

**Description**: A notification which does not expect a response.

- **params**:
  - **[key: string]**: unknown
  - **_meta?**: { [key: string]: unknown } - See [General fields: `_meta`](https://modelcontextprotocol.io/specification/2025-06-18/basic/index#meta) for notes on `_meta` usage.

---

### [`JSONRPCRequest`](https://modelcontextprotocol.io/specification/2025-06-18/schema#jsonrpcrequest)

```typescript
interface JSONRPCRequest {
  [id](https://modelcontextprotocol.io/specification/2025-06-18/schema#): [RequestId](https://modelcontextprotocol.io/specification/2025-06-18/schema#requestid);
  [jsonrpc](https://modelcontextprotocol.io/specification/2025-06-18/schema#): "2.0";
  [method](https://modelcontextprotocol.io/specification/2025-06-18/schema#): string;
  [params](https://modelcontextprotocol.io/specification/2025-06-18/schema#jsonrpcrequest-params)?: {
    _meta?: { progressToken?: [ProgressToken](https://modelcontextprotocol.io/specification/2025-06-18/schema#progresstoken); [key: string]: unknown };
    [key: string]: unknown;
  };
}
```

**Description**: A request that expects a response.

- **params**:
  - **[key: string]**: unknown
  - **_meta?**: { progressToken?: [ProgressToken](https://modelcontextprotocol.io/specification/2025-06-18/schema#progresstoken); [key: string]: unknown } - See [General fields: `_meta`](https://modelcontextprotocol.io/specification/2025-06-18/basic/index#meta) for notes on `_meta` usage.
    - **progressToken?**: [ProgressToken](https://modelcontextprotocol.io/specification/2025-06-18/schema#progresstoken) - If specified, the caller is requesting out-of-band progress notifications for this request (as represented by notifications/progress). The value of this parameter is an opaque token that will be attached to any subsequent notifications. The receiver is not obligated to provide these notifications.

---

### [`JSONRPCResponse`](https://modelcontextprotocol.io/specification/2025-06-18/schema#jsonrpcresponse)

```typescript
interface JSONRPCResponse {
  [id](https://modelcontextprotocol.io/specification/2025-06-18/schema#): [RequestId](https://modelcontextprotocol.io/specification/2025-06-18/schema#requestid);
  [jsonrpc](https://modelcontextprotocol.io/specification/2025-06-18/schema#): "2.0";
  [result](https://modelcontextprotocol.io/specification/2025-06-18/schema#): [Result](https://modelcontextprotocol.io/specification/2025-06-18/schema#result);
}
```

**Description**: A successful (non-error) response to a request.

---

### [`LoggingLevel`](https://modelcontextprotocol.io/specification/2025-06-18/schema#logginglevel)

```typescript
LoggingLevel:
  | "debug"
  | "info"
  | "notice"
  | "warning"
  | "error"
  | "critical"
  | "alert"
  | "emergency"
```

**Description**: The severity of a log message. These map to syslog message severities, as specified in RFC-5424: [https://datatracker.ietf.org/doc/html/rfc5424#section-6.2.1](https://datatracker.ietf.org/doc/html/rfc5424#section-6.2.1)

---

### [`ModelHint`](https://modelcontextprotocol.io/specification/2025-06-18/schema#modelhint)

```typescript
interface ModelHint {
  [name](https://modelcontextprotocol.io/specification/2025-06-18/schema#modelhint-name)?: string;
}
```

**Description**: Hints to use for model selection. Keys not declared here are currently left unspecified by the spec and are up to the client to interpret.

- **name**: A hint for a model name. The client SHOULD treat this as a substring of a model name; for example:
  - `claude-3-5-sonnet` should match `claude-3-5-sonnet-20241022`
  - `sonnet` should match `claude-3-5-sonnet-20241022`, `claude-3-sonnet-20240229`, etc.
  - `claude` should match any Claude model
  The client MAY also map the string to a different provider’s model name or a different model family, as long as it fills a similar niche; for example:
  - `gemini-1.5-flash` could match `claude-3-haiku-20240307`

---

### [`ModelPreferences`](https://modelcontextprotocol.io/specification/2025-06-18/schema#modelpreferences)

```typescript
interface ModelPreferences {
  [costPriority](https://modelcontextprotocol.io/specification/2025-06-18/schema#modelpreferences-costpriority)?: number;
  [hints](https://modelcontextprotocol.io/specification/2025-06-18/schema#modelpreferences-hints)?: [ModelHint](https://modelcontextprotocol.io/specification/2025-06-18/schema#modelhint)[];
  [intelligencePriority](https://modelcontextprotocol.io/specification/2025-06-18/schema#modelpreferences-intelligencepriority)?: number;
  [speedPriority](https://modelcontextprotocol.io/specification/2025-06-18/schema#modelpreferences-speedpriority)?: number;
}
```

**Description**: The server’s preferences for model selection, requested of the client during sampling. Because LLMs can vary along multiple dimensions, choosing the "best" model is rarely straightforward. Different models excel in different areas—some are faster but less capable, others are more capable but more expensive, and so on. This interface allows servers to express their priorities across multiple dimensions to help clients make an appropriate selection for their use case. These preferences are always advisory. The client MAY ignore them. It is also up to the client to decide how to interpret these preferences and how to balance them against other considerations.

- **costPriority**: How much to prioritize cost when selecting a model. A value of 0 means cost is not important, while a value of 1 means cost is the most important factor.
- **hints**: Optional hints to use for model selection. If multiple hints are specified, the client MUST evaluate them in order (such that the first match is taken). The client SHOULD prioritize these hints over the numeric priorities, but MAY still use the priorities to select from ambiguous matches.
- **intelligencePriority**: How much to prioritize intelligence and capabilities when selecting a model. A value of 0 means intelligence is not important, while a value of 1 means intelligence is the most important factor.
- **speedPriority**: How much to prioritize sampling speed (latency) when selecting a model. A value of 0 means speed is not important, while a value of 1 means speed is the most important factor.

---

### [`NumberSchema`](https://modelcontextprotocol.io/specification/2025-06-18/schema#numberschema)

```typescript
interface NumberSchema {
  [description](https://modelcontextprotocol.io/specification/2025-06-18/schema#)?: string;
  [maximum](https://modelcontextprotocol.io/specification/2025-06-18/schema#)?: number;
  [minimum](https://modelcontextprotocol.io/specification/2025-06-18/schema#)?: number;
  [title](https://modelcontextprotocol.io/specification/2025-06-18/schema#)?: string;
  [type](https://modelcontextprotocol.io/specification/2025-06-18/schema#): "number" | "integer";
}
```

---

### [`PrimitiveSchemaDefinition`](https://modelcontextprotocol.io/specification/2025-06-18/schema#primitiveschemadefinition)

```typescript
PrimitiveSchemaDefinition:
  | [StringSchema](https://modelcontextprotocol.io/specification/2025-06-18/schema#stringschema)
  | [NumberSchema](https://modelcontextprotocol.io/specification/2025-06-18/schema#numberschema)
  | [BooleanSchema](https://modelcontextprotocol.io/specification/2025-06-18/schema#booleanschema)
  | [EnumSchema](https://modelcontextprotocol.io/specification/2025-06-18/schema#enumschema)
```

**Description**: Restricted schema definitions that only allow primitive types without nested objects or arrays.

---

### [`ProgressToken`](https://modelcontextprotocol.io/specification/2025-06-18/schema#progresstoken)

```typescript
ProgressToken: string | number
```

**Description**: A progress token, used to associate progress notifications with the original request.

---

### [`Prompt`](https://modelcontextprotocol.io/specification/2025-06-18/schema#prompt)

```typescript
interface Prompt {
  [_meta](https://modelcontextprotocol.io/specification/2025-06-18/schema#prompt-_meta)?: { [key: string]: unknown };
  [arguments](https://modelcontextprotocol.io/specification/2025-06-18/schema#prompt-arguments)?: [PromptArgument](https://modelcontextprotocol.io/specification/2025-06-18/schema#promptargument)[];
  [description](https://modelcontextprotocol.io/specification/2025-06-18/schema#prompt-description)?: string;
  [name](https://modelcontextprotocol.io/specification/2025-06-18/schema#prompt-name): string;
  [title](https://modelcontextprotocol.io/specification/2025-06-18/schema#prompt-title)?: string;
}
```

**Description**: A prompt or prompt template that the server offers.

- **_meta**: See [General fields: `_meta`](https://modelcontextprotocol.io/specification/2025-06-18/basic/index#meta) for notes on `_meta` usage.
- **arguments**: A list of arguments to use for templating the prompt.
- **description**: An optional description of what this prompt provides.
- **name**: Intended for programmatic or logical use, but used as a display name in past specs or fallback (if title isn’t present).
- **title**: Intended for UI and end-user contexts — optimized to be human-readable and easily understood, even by those unfamiliar with domain-specific terminology. If not provided, the name should be used for display (except for Tool, where `annotations.title` should be given precedence over using `name`, if present).

---

### [`PromptArgument`](https://modelcontextprotocol.io/specification/2025-06-18/schema#promptargument)

```typescript
interface PromptArgument {
  [description](https://modelcontextprotocol.io/specification/2025-06-18/schema#promptargument-description)?: string;
  [name](https://modelcontextprotocol.io/specification/2025-06-18/schema#promptargument-name): string;
  [required](https://modelcontextprotocol.io/specification/2025-06-18/schema#promptargument-required)?: boolean;
  [title](https://modelcontextprotocol.io/specification/2025-06-18/schema#promptargument-title)?: string;
}
```

**Description**: Describes an argument that a prompt can accept.

- **description**: A human-readable description of the argument.
- **name**: Intended for programmatic or logical use, but used as a display name in past specs or fallback (if title isn’t present).
- **required**: Whether this argument must be provided.
- **title**: Intended for UI and end-user contexts — optimized to be human-readable and easily understood, even by those unfamiliar with domain-specific terminology. If not provided, the name should be used for display (except for Tool, where `annotations.title` should be given precedence over using `name`, if present).

---

### [`PromptMessage`](https://modelcontextprotocol.io/specification/2025-06-18/schema#promptmessage)

```typescript
interface PromptMessage {
  [content](https://modelcontextprotocol.io/specification/2025-06-18/schema#): [ContentBlock](https://modelcontextprotocol.io/specification/2025-06-18/schema#contentblock);
  [role](https://modelcontextprotocol.io/specification/2025-06-18/schema#): [Role](https://modelcontextprotocol.io/specification/2025-06-18/schema#role);
}
```

**Description**: Describes a message returned as part of a prompt. This is similar to `SamplingMessage`, but also supports the embedding of resources from the MCP server.

---

### [`PromptReference`](https://modelcontextprotocol.io/specification/2025-06-18/schema#promptreference)

```typescript
interface PromptReference {
  [name](https://modelcontextprotocol.io/specification/2025-06-18/schema#promptreference-name): string;
  [title](https://modelcontextprotocol.io/specification/2025-06-18/schema#promptreference-title)?: string;
  [type](https://modelcontextprotocol.io/specification/2025-06-18/schema#): "ref/prompt";
}
```

**Description**: Identifies a prompt.

- **name**: Intended for programmatic or logical use, but used as a display name in past specs or fallback (if title isn’t present).
- **title**: Intended for UI and end-user contexts — optimized to be human-readable and easily understood, even by those unfamiliar with domain-specific terminology. If not provided, the name should be used for display (except for Tool, where `annotations.title` should be given precedence over using `name`, if present).

---

### [`RequestId`](https://modelcontextprotocol.io/specification/2025-06-18/schema#requestid)

```typescript
RequestId: string | number
```

**Description**: A uniquely identifying ID for a request in JSON-RPC.

---

### [`Resource`](https://modelcontextprotocol.io/specification/2025-06-18/schema#resource)

```typescript
interface Resource {
  [_meta](https://modelcontextprotocol.io/specification/2025-06-18/schema#resource-_meta)?: { [key: string]: unknown };
  [annotations](https://modelcontextprotocol.io/specification/2025-06-18/schema#resource-annotations)?: [Annotations](https://modelcontextprotocol.io/specification/2025-06-18/schema#annotations);
  [description](https://modelcontextprotocol.io/specification/2025-06-18/schema#resource-description)?: string;
  [mimeType](https://modelcontextprotocol.io/specification/2025-06-18/schema#resource-mimetype)?: string;
  [name](https://modelcontextprotocol.io/specification/2025-06-18/schema#resource-name): string;
  [size](https://modelcontextprotocol.io/specification/2025-06-18/schema#resource-size)?: number;
  [title](https://modelcontextprotocol.io/specification/2025-06-18/schema#resource-title)?: string;
  [uri](https://modelcontextprotocol.io/specification/2025-06-18/schema#resource-uri): string;
}
```

**Description**: A known resource that the server is capable of reading.

- **_meta**: See [General fields: `_meta`](https://modelcontextprotocol.io/specification/2025-06-18/basic/index#meta) for notes on `_meta` usage.
- **annotations**: Optional annotations for the client.
- **description**: A description of what this resource represents. This can be used by clients to improve the LLM’s understanding of available resources. It can be thought of like a "hint" to the model.
- **mimeType**: The MIME type of this resource, if known.
- **name**: Intended for programmatic or logical use, but used as a display name in past specs or fallback (if title isn’t present).
- **size**: The size of the raw resource content, in bytes (i.e., before base64 encoding or any tokenization), if known. This can be used by Hosts to display file sizes and estimate context window usage.
- **title**: Intended for UI and end-user contexts — optimized to be human-readable and easily understood, even by those unfamiliar with domain-specific terminology. If not provided, the name should be used for display (except for Tool, where `annotations.title` should be given precedence over using `name`, if present).
- **uri**: The URI of this resource.

---

### [`ResourceContents`](https://modelcontextprotocol.io/specification/2025-06-18/schema#resourcecontents)

```typescript
interface ResourceContents {
  [_meta](https://modelcontextprotocol.io/specification/2025-06-18/schema#resourcecontents-_meta)?: { [key: string]: unknown };
  [mimeType](https://modelcontextprotocol.io/specification/2025-06-18/schema#resourcecontents-mimetype)?: string;
  [uri](https://modelcontextprotocol.io/specification/2025-06-18/schema#resourcecontents-uri): string;
}
```

**Description**: The contents of a specific resource or sub-resource.

- **_meta**: See [General fields: `_meta`](https://modelcontextprotocol.io/specification/2025-06-18/basic/index#meta) for notes on `_meta` usage.
- **mimeType**: The MIME type of this resource, if known.
- **uri**: The URI of this resource.

---

### [`ResourceLink`](https://modelcontextprotocol.io/specification/2025-06-18/schema#resourcelink)

```typescript
interface ResourceLink {
  [_meta](https://modelcontextprotocol.io/specification/2025-06-18/schema#resourcelink-_meta)?: { [key: string]: unknown };
  [annotations](https://modelcontextprotocol.io/specification/2025-06-18/schema#resourcelink-annotations)?: [Annotations](https://modelcontextprotocol.io/specification/2025-06-18/schema#annotations);
  [description](https://modelcontextprotocol.io/specification/2025-06-18/schema#resourcelink-description)?: string;
  [mimeType](https://modelcontextprotocol.io/specification/2025-06-18/schema#resourcelink-mimetype)?: string;
  [name](https://modelcontextprotocol.io/specification/2025-06-18/schema#resourcelink-name): string;
  [size](https://modelcontextprotocol.io/specification/2025-06-18/schema#resourcelink-size)?: number;
  [title](https://modelcontextprotocol.io/specification/2025-06-18/schema#resourcelink-title)?: string;
  [type](https://modelcontextprotocol.io/specification/2025-06-18/schema#): "resource_link";
  [uri](https://modelcontextprotocol.io/specification/2025-06-18/schema#resourcelink-uri): string;
}
```

**Description**: A resource that the server is capable of reading, included in a prompt or tool call result. Note: resource links returned by tools are not guaranteed to appear in the results of `resources/list` requests.

- **_meta**: See [General fields: `_meta`](https://modelcontextprotocol.io/specification/2025-06-18/basic/index#meta) for notes on `_meta` usage.
- **annotations**: Optional annotations for the client.
- **description**: A description of what this resource represents. This can be used by clients to improve the LLM’s understanding of available resources. It can be thought of like a "hint" to the model.
- **mimeType**: The MIME type of this resource, if known.
- **name**: Intended for programmatic or logical use, but used as a display name in past specs or fallback (if title isn’t present).
- **size**: The size of the raw resource content, in bytes (i.e., before base64 encoding or any tokenization), if known. This can be used by Hosts to display file sizes and estimate context window usage.
- **title**: Intended for UI and end-user contexts — optimized to be human-readable and easily understood, even by those unfamiliar with domain-specific terminology. If not provided, the name should be used for display (except for Tool, where `annotations.title` should be given precedence over using `name`, if present).
- **uri**: The URI of this resource.

---

### [`ResourceTemplate`](https://modelcontextprotocol.io/specification/2025-06-18/schema#resourcetemplate)

```typescript
interface ResourceTemplate {
  [_meta](https://modelcontextprotocol.io/specification/2025-06-18/schema#resourcetemplate-_meta)?: { [key: string]: unknown };
  [annotations](https://modelcontextprotocol.io/specification/2025-06-18/schema#resourcetemplate-annotations)?: [Annotations](https://modelcontextprotocol.io/specification/2025-06-18/schema#annotations);
  [description](https://modelcontextprotocol.io/specification/2025-06-18/schema#resourcetemplate-description)?: string;
  [mimeType](https://modelcontextprotocol.io/specification/2025-06-18/schema#resourcetemplate-mimetype)?: string;
  [name](https://modelcontextprotocol.io/specification/2025-06-18/schema#resourcetemplate-name): string;
  [title](https://modelcontextprotocol.io/specification/2025-06-18/schema#resourcetemplate-title)?: string;
  [uriTemplate](https://modelcontextprotocol.io/specification/2025-06-18/schema#resourcetemplate-uritemplate): string;
}
```

**Description**: A template description for resources available on the server.

- **_meta**: See [General fields: `_meta`](https://modelcontextprotocol.io/specification/2025-06-18/basic/index#meta) for notes on `_meta` usage.
- **annotations**: Optional annotations for the client.
- **description**: A description of what this template is for. This can be used by clients to improve the LLM’s understanding of available resources. It can be thought of like a "hint" to the model.
- **mimeType**: The MIME type for all resources that match this template. This should only be included if all resources matching this template have the same type.
- **name**: Intended for programmatic or logical use, but used as a display name in past specs or fallback (if title isn’t present).
- **title**: Intended for UI and end-user contexts — optimized to be human-readable and easily understood, even by those unfamiliar with domain-specific terminology. If not provided, the name should be used for display (except for Tool, where `annotations.title` should be given precedence over using `name`, if present).
- **uriTemplate**: A URI template (according to RFC 6570) that can be used to construct resource URIs.

---

### [`ResourceTemplateReference`](https://modelcontextprotocol.io/specification/2025-06-18/schema#resourcetemplatereference)

```typescript
interface ResourceTemplateReference {
  [type](https://modelcontextprotocol.io/specification/2025-06-18/schema#): "ref/resource";
  [uri](https://modelcontextprotocol.io/specification/2025-06-18/schema#resourcetemplatereference-uri): string;
}
```

**Description**: A reference to a resource or resource template definition.

- **uri**: The URI or URI template of the resource.

---

### [`Result`](https://modelcontextprotocol.io/specification/2025-06-18/schema#result)

```typescript
interface Result {
  [_meta](https://modelcontextprotocol.io/specification/2025-06-18/schema#result-_meta)?: { [key: string]: unknown };
  [key: string]: unknown;
}
```

- **_meta**: See [General fields: `_meta`](https://modelcontextprotocol.io/specification/2025-06-18/basic/index#meta) for notes on `_meta` usage.

---

### [`Role`](https://modelcontextprotocol.io/specification/2025-06-18/schema#role)

```typescript
Role: "user" | "assistant"
```

**Description**: The sender or recipient of messages and data in a conversation.

---

### [`Root`](https://modelcontextprotocol.io/specification/2025-06-18/schema#root)

```typescript
interface Root {
  [_meta](https://modelcontextprotocol.io/specification/2025-06-18/schema#root-_meta)?: { [key: string]: unknown };
  [name](https://modelcontextprotocol.io/specification/2025-06-18/schema#root-name)?: string;
  [uri](https://modelcontextprotocol.io/specification/2025-06-18/schema#root-uri): string;
}
```

**Description**: Represents a root directory or file that the server can operate on.

- **_meta**: See [General fields: `_meta`](https://modelcontextprotocol.io/specification/2025-06-18/basic/index#meta) for notes on `_meta` usage.
- **name**: An optional name for the root. This can be used to provide a human-readable identifier for the root, which may be useful for display purposes or for referencing the root in other parts of the application.
- **uri**: The URI identifying the root. This _must_ start with file:// for now. This restriction may be relaxed in future versions of the protocol to allow other URI schemes.

---

### [`SamplingMessage`](https://modelcontextprotocol.io/specification/2025-06-18/schema#samplingmessage)

```typescript
interface SamplingMessage {
  [content](https://modelcontextprotocol.io/specification/2025-06-18/schema#): [TextContent](https://modelcontextprotocol.io/specification/2025-06-18/schema#textcontent) | [ImageContent](https://modelcontextprotocol.io/specification/2025-06-18/schema#imagecontent) | [AudioContent](https://modelcontextprotocol.io/specification/2025-06-18/schema#audiocontent);
  [role](https://modelcontextprotocol.io/specification/2025-06-18/schema#): [Role](https://modelcontextprotocol.io/specification/2025-06-18/schema#role);
}
```

**Description**: Describes a message issued to or received from an LLM API.

---

### [`ServerCapabilities`](https://modelcontextprotocol.io/specification/2025-06-18/schema#servercapabilities)

```typescript
interface ServerCapabilities {
  [completions](https://modelcontextprotocol.io/specification/2025-06-18/schema#servercapabilities-completions)?: object;
  [experimental](https://modelcontextprotocol.io/specification/2025-06-18/schema#servercapabilities-experimental)?: { [key: string]: object };
  [logging](https://modelcontextprotocol.io/specification/2025-06-18/schema#servercapabilities-logging)?: object;
  [prompts](https://modelcontextprotocol.io/specification/2025-06-18/schema#servercapabilities-prompts)?: { listChanged?: boolean };
  [resources](https://modelcontextprotocol.io/specification/2025-06-18/schema#servercapabilities-resources)?: { listChanged?: boolean; subscribe?: boolean };
  [tools](https://modelcontextprotocol.io/specification/2025-06-18/schema#servercapabilities-tools)?: { listChanged?: boolean };
}
```

**Description**: Capabilities that a server may support. Known capabilities are defined here, in this schema, but this is not a closed set: any server can define its own, additional capabilities.

- **completions**: Present if the server supports argument autocompletion suggestions.
- **experimental**: Experimental, non-standard capabilities that the server supports.
- **logging**: Present if the server supports sending log messages to the client.
- **prompts**: Present if the server offers any prompt templates.
  - **listChanged?**: boolean - Whether this server supports notifications for changes to the prompt list.
- **resources**: Present if the server offers any resources to read.
  - **listChanged?**: boolean - Whether this server supports notifications for changes to the resource list.
  - **subscribe?**: boolean - Whether this server supports subscribing to resource updates.
- **tools**: Present if the server offers any tools to call.
  - **listChanged?**: boolean - Whether this server supports notifications for changes to the tool list.

---

### [`StringSchema`](https://modelcontextprotocol.io/specification/2025-06-18/schema#stringschema)

```typescript
interface StringSchema {
  [description](https://modelcontextprotocol.io/specification/2025-06-18/schema#)?: string;
  [format](https://modelcontextprotocol.io/specification/2025-06-18/schema#)?: "uri" | "email" | "date" | "date-time";
  [maxLength](https://modelcontextprotocol.io/specification/2025-06-18/schema#)?: number;
  [minLength](https://modelcontextprotocol.io/specification/2025-06-18/schema#)?: number;
  [title](https://modelcontextprotocol.io/specification/2025-06-18/schema#)?: string;
  [type](https://modelcontextprotocol.io/specification/2025-06-18/schema#): "string";
}
```

---

### [`TextContent`](https://modelcontextprotocol.io/specification/2025-06-18/schema#textcontent)

```typescript
interface TextContent {
  [_meta](https://modelcontextprotocol.io/specification/2025-06-18/schema#textcontent-_meta)?: { [key: string]: unknown };
  [annotations](https://modelcontextprotocol.io/specification/2025-06-18/schema#textcontent-annotations)?: [Annotations](https://modelcontextprotocol.io/specification/2025-06-18/schema#annotations);
  [text](https://modelcontextprotocol.io/specification/2025-06-18/schema#textcontent-text): string;
  [type](https://modelcontextprotocol.io/specification/2025-06-18/schema#): "text";
}
```

**Description**: Text provided to or from an LLM.

- **_meta**: See [General fields: `_meta`](https://modelcontextprotocol.io/specification/2025-06-18/basic/index#meta) for notes on `_meta` usage.
- **annotations**: Optional annotations for the client.
- **text**: The text content of the message.

---

### [`TextResourceContents`](https://modelcontextprotocol.io/specification/2025-06-18/schema#textresourcecontents)

```typescript
interface TextResourceContents {
  [_meta](https://modelcontextprotocol.io/specification/2025-06-18/schema#textresourcecontents-_meta)?: { [key: string]: unknown };
  [mimeType](https://modelcontextprotocol.io/specification/2025-06-18/schema#textresourcecontents-mimetype)?: string;
  [text](https://modelcontextprotocol.io/specification/2025-06-18/schema#textresourcecontents-text): string;
  [uri](https://modelcontextprotocol.io/specification/2025-06-18/schema#textresourcecontents-uri): string;
}
```

**Description**: The contents of a specific resource or sub-resource.

- **_meta**: See [General fields: `_meta`](https://modelcontextprotocol.io/specification/2025-06-18/basic/index#meta) for notes on `_meta` usage.
- **mimeType**: The MIME type of this resource, if known.
- **text**: The text of the item. This must only be set if the item can actually be represented as text (not binary data).
- **uri**: The URI of this resource.

---

### [`Tool`](https://modelcontextprotocol.io/specification/2025-06-18/schema#tool)

```typescript
interface Tool {
  [_meta](https://modelcontextprotocol.io/specification/2025-06-18/schema#tool-_meta)?: { [key: string]: unknown };
  [annotations](https://modelcontextprotocol.io/specification/2025-06-18/schema#tool-annotations)?: [ToolAnnotations](https://modelcontextprotocol.io/specification/2025-06-18/schema#toolannotations);
  [description](https://modelcontextprotocol.io/specification/2025-06-18/schema#tool-description)?: string;
  [inputSchema](https://modelcontextprotocol.io/specification/2025-06-18/schema#tool-inputschema): {
    properties?: { [key: string]: object };
    required?: string[];
    type: "object";
  };
  [name](https://modelcontextprotocol.io/specification/2025-06-18/schema#tool-name): string;
  [outputSchema](https://modelcontextprotocol.io/specification/2025-06-18/schema#tool-outputschema)?: {
    properties?: { [key: string]: object };
    required?: string[];
    type: "object";
  };
  [title](https://modelcontextprotocol.io/specification/2025-06-18/schema#tool-title)?: string;
}
```

**Description**: Definition for a tool the client can call.

- **_meta**: See [General fields: `_meta`](https://modelcontextprotocol.io/specification/2025-06-18/basic/index#meta) for notes on `_meta` usage.
- **annotations**: Optional additional tool information. Display name precedence order is: title, annotations.title, then name.
- **description**: A human-readable description of the tool. This can be used by clients to improve the LLM’s understanding of available tools. It can be thought of like a "hint" to the model.
- **inputSchema**: A JSON Schema object defining the expected parameters for the tool.
- **name**: Intended for programmatic or logical use, but used as a display name in past specs or fallback (if title isn’t present).
- **outputSchema**: An optional JSON Schema object defining the structure of the tool’s output returned in the structuredContent field of a CallToolResult.
- **title**: Intended for UI and end-user contexts — optimized to be human-readable and easily understood, even by those unfamiliar with domain-specific terminology. If not provided, the name should be used for display (except for Tool, where `annotations.title` should be given precedence over using `name`, if present).

---

### [`ToolAnnotations`](https://modelcontextprotocol.io/specification/2025-06-18/schema#toolannotations)

```typescript
interface ToolAnnotations {
  [destructiveHint](https://modelcontextprotocol.io/specification/2025-06-18/schema#toolannotations-destructivehint)?: boolean;
  [idempotentHint](https://modelcontextprotocol.io/specification/2025-06-18/schema#toolannotations-idempotenthint)?: boolean;
  [openWorldHint](https://modelcontextprotocol.io/specification/2025-06-18/schema#toolannotations-openworldhint)?: boolean;
  [readOnlyHint](https://modelcontextprotocol.io/specification/2025-06-18/schema#toolannotations-readonlyhint)?: boolean;
  [title](https://modelcontextprotocol.io/specification/2025-06-18/schema#toolannotations-title)?: string;
}
```

**Description**: Additional properties describing a Tool to clients. NOTE: all properties in ToolAnnotations are **hints**. They are not guaranteed to provide a faithful description of tool behavior (including descriptive properties like `title`). Clients should never make tool use decisions based on ToolAnnotations received from untrusted servers.

- **destructiveHint**: If true, the tool may perform destructive updates to its environment. If false, the tool performs only additive updates. (This property is meaningful only when `readOnlyHint == false`) Default: true
- **idempotentHint**: If true, calling the tool repeatedly with the same arguments will have no additional effect on its environment. (This property is meaningful only when `readOnlyHint == false`) Default: false
- **openWorldHint**: If true, this tool may interact with an "open world" of external entities. If false, the tool’s domain of interaction is closed. For example, the world of a web search tool is open, whereas that of a memory tool is not. Default: true
- **readOnlyHint**: If true, the tool does not modify its environment. Default: false
- **title**: A human-readable title for the tool.

---

## [`completion/complete`](https://modelcontextprotocol.io/specification/2025-06-18/schema#completion%2Fcomplete)

### [`CompleteRequest`](https://modelcontextprotocol.io/specification/2025-06-18/schema#completerequest)

```typescript
interface CompleteRequest {
  [method](https://modelcontextprotocol.io/specification/2025-06-18/schema#): "completion/complete";
  [params](https://modelcontextprotocol.io/specification/2025-06-18/schema#completerequest-params): {
    argument: { name: string; value: string };
    context?: { arguments?: { [key: string]: string } };
    ref: [PromptReference](https://modelcontextprotocol.io/specification/2025-06-18/schema#promptreference) | [ResourceTemplateReference](https://modelcontextprotocol.io/specification/2025-06-18/schema#resourcetemplatereference);
  };
}
```

**Description**: A request from the client to the server, to ask for completion options.

- **params**:
  - **argument**: { name: string; value: string } - The argument’s information
    - **name**: string - The name of the argument
    - **value**: string - The value of the argument to use for completion matching.
  - **context?**: { arguments?: { [key: string]: string } } - Additional, optional context for completions
    - **arguments?**: { [key: string]: string } - Previously-resolved variables in a URI template or prompt.
  - **ref**: [PromptReference](https://modelcontextprotocol.io/specification/2025-06-18/schema#promptreference) | [ResourceTemplateReference](https://modelcontextprotocol.io/specification/2025-06-18/schema#resourcetemplatereference)

### [`CompleteResult`](https://modelcontextprotocol.io/specification/2025-06-18/schema#completeresult)

```typescript
interface CompleteResult {
  [_meta](https://modelcontextprotocol.io/specification/2025-06-18/schema#completeresult-_meta)?: { [key: string]: unknown };
  [completion](https://modelcontextprotocol.io/specification/2025-06-18/schema#completeresult-completion): { hasMore?: boolean; total?: number; values: string[] };
  [key: string]: unknown;
}
```

**Description**: The server’s response to a completion/complete request

- **_meta**: See [General fields: `_meta`](https://modelcontextprotocol.io/specification/2025-06-18/basic/index#meta) for notes on `_meta` usage.
- **completion**:
  - **hasMore?**: boolean - Indicates whether there are additional completion options beyond those provided in the current response, even if the exact total is unknown.
  - **total?**: number - The total number of completion options available. This can exceed the number of values actually sent in the response.
  - **values**: string[] - An array of completion values. Must not exceed 100 items.

---

## [`elicitation/create`](https://modelcontextprotocol.io/specification/2025-06-18/schema#elicitation%2Fcreate)

### [`ElicitRequest`](https://modelcontextprotocol.io/specification/2025-06-18/schema#elicitrequest)

```typescript
interface ElicitRequest {
  [method](https://modelcontextprotocol.io/specification/2025-06-18/schema#): "elicitation/create";
  [params](https://modelcontextprotocol.io/specification/2025-06-18/schema#elicitrequest-params): {
    message: string;
    requestedSchema: {
      properties: { [key: string]: [PrimitiveSchemaDefinition](https://modelcontextprotocol.io/specification/2025-06-18/schema#primitiveschemadefinition) };
      required?: string[];
      type: "object";
    };
  };
}
```

**Description**: A request from the server to elicit additional information from the user via the client.

- **params**:
  - **message**: string - The message to present to the user.
  - **requestedSchema**: { properties: { [key: string]: [PrimitiveSchemaDefinition](https://modelcontextprotocol.io/specification/2025-06-18/schema#primitiveschemadefinition) }; required?: string[]; type: "object"; } - A restricted subset of JSON Schema. Only top-level properties are allowed, without nesting.

### [`ElicitResult`](https://modelcontextprotocol.io/specification/2025-06-18/schema#elicitresult)

```typescript
interface ElicitResult {
  [_meta](https://modelcontextprotocol.io/specification/2025-06-18/schema#elicitresult-_meta)?: { [key: string]: unknown };
  [action](https://modelcontextprotocol.io/specification/2025-06-18/schema#elicitresult-action): "accept" | "decline" | "cancel";
  [content](https://modelcontextprotocol.io/specification/2025-06-18/schema#elicitresult-content)?: { [key: string]: string | number | boolean };
  [key: string]: unknown;
}
```

**Description**: The client’s response to an elicitation request.

- **_meta**: See [General fields: `_meta`](https://modelcontextprotocol.io/specification/2025-06-18/basic/index#meta) for notes on `_meta` usage.
- **action**: The user action in response to the elicitation.
  - "accept": User submitted the form/confirmed the action
  - "decline": User explicitly declined the action
  - "cancel": User dismissed without making an explicit choice
- **content**: The submitted form data, only present when action is "accept". Contains values matching the requested schema.

---

## [`initialize`](https://modelcontextprotocol.io/specification/2025-06-18/schema#initialize)

### [`InitializeRequest`](https://modelcontextprotocol.io/specification/2025-06-18/schema#initializerequest)

```typescript
interface InitializeRequest {
  [method](https://modelcontextprotocol.io/specification/2025-06-18/schema#): "initialize";
  [params](https://modelcontextprotocol.io/specification/2025-06-18/schema#initializerequest-params): {
    capabilities: [ClientCapabilities](https://modelcontextprotocol.io/specification/2025-06-18/schema#clientcapabilities);
    clientInfo: [Implementation](https://modelcontextprotocol.io/specification/2025-06-18/schema#implementation);
    protocolVersion: string;
  };
}
```

**Description**: This request is sent from the client to the server when it first connects, asking it to begin initialization.

- **params**:
  - **capabilities**: [ClientCapabilities](https://modelcontextprotocol.io/specification/2025-06-18/schema#clientcapabilities)
  - **clientInfo**: [Implementation](https://modelcontextprotocol.io/specification/2025-06-18/schema#implementation)
  - **protocolVersion**: string - The latest version of the Model Context Protocol that the client supports. The client MAY decide to support older versions as well.

### [`InitializeResult`](https://modelcontextprotocol.io/specification/2025-06-18/schema#initializeresult)

```typescript
interface InitializeResult {
  [_meta](https://modelcontextprotocol.io/specification/2025-06-18/schema#initializeresult-_meta)?: { [key: string]: unknown };
  [capabilities](https://modelcontextprotocol.io/specification/2025-06-18/schema#): [ServerCapabilities](https://modelcontextprotocol.io/specification/2025-06-18/schema#servercapabilities);
  [instructions](https://modelcontextprotocol.io/specification/2025-06-18/schema#initializeresult-instructions)?: string;
  [protocolVersion](https://modelcontextprotocol.io/specification/2025-06-18/schema#initializeresult-protocolversion): string;
  [serverInfo](https://modelcontextprotocol.io/specification/2025-06-18/schema#): [Implementation](https://modelcontextprotocol.io/specification/2025-06-18/schema#implementation);
  [key: string]: unknown;
}
```

**Description**: After receiving an initialize request from the client, the server sends this response.

- **_meta**: See [General fields: `_meta`](https://modelcontextprotocol.io/specification/2025-06-18/basic/index#meta) for notes on `_meta` usage.
- **instructions**: Instructions describing how to use the server and its features. This can be used by clients to improve the LLM’s understanding of available tools, resources, etc. It can be thought of like a "hint" to the model. For example, this information MAY be added to the system prompt.
- **protocolVersion**: The version of the Model Context Protocol that the server wants to use. This may not match the version that the client requested. If the client cannot support this version, it MUST disconnect.

---

## [`logging/setLevel`](https://modelcontextprotocol.io/specification/2025-06-18/schema#logging%2Fsetlevel)

### [`SetLevelRequest`](https://modelcontextprotocol.io/specification/2025-06-18/schema#setlevelrequest)

```typescript
interface SetLevelRequest {
  [method](https://modelcontextprotocol.io/specification/2025-06-18/schema#): "logging/setLevel";
  [params](https://modelcontextprotocol.io/specification/2025-06-18/schema#setlevelrequest-params): { level: [LoggingLevel](https://modelcontextprotocol.io/specification/2025-06-18/schema#logginglevel) };
}
```

**Description**: A request from the client to the server, to enable or adjust logging.

- **params**:
  - **level**: [LoggingLevel](https://modelcontextprotocol.io/specification/2025-06-18/schema#logginglevel) - The level of logging that the client wants to receive from the server. The server should send all logs at this level and higher (i.e., more severe) to the client as notifications/message.

---

## [`notifications/cancelled`](https://modelcontextprotocol.io/specification/2025-06-18/schema#notifications%2Fcancelled)

### [`CancelledNotification`](https://modelcontextprotocol.io/specification/2025-06-18/schema#cancellednotification)

```typescript
interface CancelledNotification {
  [method](https://modelcontextprotocol.io/specification/2025-06-18/schema#): "notifications/cancelled";
  [params](https://modelcontextprotocol.io/specification/2025-06-18/schema#cancellednotification-params): { reason?: string; requestId: [RequestId](https://modelcontextprotocol.io/specification/2025-06-18/schema#requestid) };
}
```

**Description**: This notification can be sent by either side to indicate that it is cancelling a previously-issued request. The request SHOULD still be in-flight, but due to communication latency, it is always possible that this notification MAY arrive after the request has already finished. This notification indicates that the result will be unused, so any associated processing SHOULD cease. A client MUST NOT attempt to cancel its `initialize` request.

- **params**:
  - **reason?**: string - An optional string describing the reason for the cancellation. This MAY be logged or presented to the user.
  - **requestId**: [RequestId](https://modelcontextprotocol.io/specification/2025-06-18/schema#requestid) - The ID of the request to cancel. This MUST correspond to the ID of a request previously issued in the same direction.

---

## [`notifications/initialized`](https://modelcontextprotocol.io/specification/2025-06-18/schema#notifications%2Finitialized)

### [`InitializedNotification`](https://modelcontextprotocol.io/specification/2025-06-18/schema#initializednotification)

```typescript
interface InitializedNotification {
  [method](https://modelcontextprotocol.io/specification/2025-06-18/schema#): "notifications/initialized";
  [params](https://modelcontextprotocol.io/specification/2025-06-18/schema#initializednotification-params)?: { _meta?: { [key: string]: unknown }; [key: string]: unknown };
}
```

**Description**: This notification is sent from the client to the server after initialization has finished.

- **params**:
  - **[key: string]**: unknown
  - **_meta?**: { [key: string]: unknown } - See [General fields: `_meta`](https://modelcontextprotocol.io/specification/2025-06-18/basic/index#meta) for notes on `_meta` usage.

---

## [`notifications/message`](https://modelcontextprotocol.io/specification/2025-06-18/schema#notifications%2Fmessage)

### [`LoggingMessageNotification`](https://modelcontextprotocol.io/specification/2025-06-18/schema#loggingmessagenotification)

```typescript
interface LoggingMessageNotification {
  [method](https://modelcontextprotocol.io/specification/2025-06-18/schema#): "notifications/message";
  [params](https://modelcontextprotocol.io/specification/2025-06-18/schema#loggingmessagenotification-params): { data: unknown; level: [LoggingLevel](https://modelcontextprotocol.io/specification/2025-06-18/schema#logginglevel); logger?: string };
}
```

**Description**: Notification of a log message passed from server to client. If no logging/setLevel request has been sent from the client, the server MAY decide which messages to send automatically.

- **params**:
  - **data**: unknown - The data to be logged, such as a string message or an object. Any JSON serializable type is allowed here.
  - **level**: [LoggingLevel](https://modelcontextprotocol.io/specification/2025-06-18/schema#logginglevel) - The severity of this log message.
  - **logger?**: string - An optional name of the logger issuing this message.

---

## [`notifications/progress`](https://modelcontextprotocol.io/specification/2025-06-18/schema#notifications%2Fprogress)

### [`ProgressNotification`](https://modelcontextprotocol.io/specification/2025-06-18/schema#progressnotification)

```typescript
interface ProgressNotification {
  [method](https://modelcontextprotocol.io/specification/2025-06-18/schema#): "notifications/progress";
  [params](https://modelcontextprotocol.io/specification/2025-06-18/schema#progressnotification-params): {
    message?: string;
    progress: number;
    progressToken: [ProgressToken](https://modelcontextprotocol.io/specification/2025-06-18/schema#progresstoken);
    total?: number;
  };
}
```

**Description**: An out-of-band notification used to inform the receiver of a progress update for a long-running request.

- **params**:
  - **message?**: string - An optional message describing the current progress.
  - **progress**: number - The progress thus far. This should increase every time progress is made, even if the total is unknown.
  - **progressToken**: [ProgressToken](https://modelcontextprotocol.io/specification/2025-06-18/schema#progresstoken) - The progress token which was given in the initial request, used to associate this notification with the request that is proceeding.
  - **total?**: number - Total number of items to process (or total progress required), if known.

---

## [`notifications/prompts/list_changed`](https://modelcontextprotocol.io/specification/2025-06-18/schema#notifications%2Fprompts%2Flist-changed)

### [`PromptListChangedNotification`](https://modelcontextprotocol.io/specification/2025-06-18/schema#promptlistchangednotification)

```typescript
interface PromptListChangedNotification {
  [method](https://modelcontextprotocol.io/specification/2025-06-18/schema#): "notifications/prompts/list_changed";
  [params](https://modelcontextprotocol.io/specification/2025-06-18/schema#promptlistchangednotification-params)?: { _meta?: { [key: string]: unknown }; [key: string]: unknown };
}
```

**Description**: An optional notification from the server to the client, informing it that the list of prompts it offers has changed. This may be issued by servers without any previous subscription from the client.

- **params**:
  - **[key: string]**: unknown
  - **_meta?**: { [key: string]: unknown } - See [General fields: `_meta`](https://modelcontextprotocol.io/specification/2025-06-18/basic/index#meta) for notes on `_meta` usage.

---

## [`notifications/resources/list_changed`](https://modelcontextprotocol.io/specification/2025-06-18/schema#notifications%2Fresources%2Flist-changed)

### [`ResourceListChangedNotification`](https://modelcontextprotocol.io/specification/2025-06-18/schema#resourcelistchangednotification)

```typescript
interface ResourceListChangedNotification {
  [method](https://modelcontextprotocol.io/specification/2025-06-18/schema#): "notifications/resources/list_changed";
  [params](https://modelcontextprotocol.io/specification/2025-06-18/schema#resourcelistchangednotification-params)?: { _meta?: { [key: string]: unknown }; [key: string]: unknown };
}
```

**Description**: An optional notification from the server to the client, informing it that the list of resources it can read from has changed. This may be issued by servers without any previous subscription from the client.

- **params**:
  - **[key: string]**: unknown
  - **_meta?**: { [key: string]: unknown } - See [General fields: `_meta`](https://modelcontextprotocol.io/specification/2025-06-18/basic/index#meta) for notes on `_meta` usage.

---

## [`notifications/resources/updated`](https://modelcontextprotocol.io/specification/2025-06-18/schema#notifications%2Fresources%2Fupdated)

### [`ResourceUpdatedNotification`](https://modelcontextprotocol.io/specification/2025-06-18/schema#resourceupdatednotification)

```typescript
interface ResourceUpdatedNotification {
  [method](https://modelcontextprotocol.io/specification/2025-06-18/schema#): "notifications/resources/updated";
  [params](https://modelcontextprotocol.io/specification/2025-06-18/schema#resourceupdatednotification-params): { uri: string };
}
```

**Description**: A notification from the server to the client, informing it that a resource has changed and may need to be read again. This should only be sent if the client previously sent a resources/subscribe request.

- **params**:
  - **uri**: string - The URI of the resource that has been updated. This might be a sub-resource of the one that the client actually subscribed to.

---

## [`notifications/roots/list_changed`](https://modelcontextprotocol.io/specification/2025-06-18/schema#notifications%2Froots%2Flist-changed)

### [`RootsListChangedNotification`](https://modelcontextprotocol.io/specification/2025-06-18/schema#rootslistchangednotification)

```typescript
interface RootsListChangedNotification {
  [method](https://modelcontextprotocol.io/specification/2025-06-18/schema#): "notifications/roots/list_changed";
  [params](https://modelcontextprotocol.io/specification/2025-06-18/schema#rootslistchangednotification-params)?: { _meta?: { [key: string]: unknown }; [key: string]: unknown };
}
```

**Description**: A notification from the client to the server, informing it that the list of roots has changed. This notification should be sent whenever the client adds, removes, or modifies any root. The server should then request an updated list of roots using the ListRootsRequest.

- **params**:
  - **[key: string]**: unknown
  - **_meta?**: { [key: string]: unknown } - See [General fields: `_meta`](https://modelcontextprotocol.io/specification/2025-06-18/basic/index#meta) for notes on `_meta` usage.

---

## [`notifications/tools/list_changed`](https://modelcontextprotocol.io/specification/2025-06-18/schema#notifications%2Ftools%2Flist-changed)

### [`ToolListChangedNotification`](https://modelcontextprotocol.io/specification/2025-06-18/schema#toollistchangednotification)

```typescript
interface ToolListChangedNotification {
  [method](https://modelcontextprotocol.io/specification/2025-06-18/schema#): "notifications/tools/list_changed";
  [params](https://modelcontextprotocol.io/specification/2025-06-18/schema#toollistchangednotification-params)?: { _meta?: { [key: string]: unknown }; [key: string]: unknown };
}
```

**Description**: An optional notification from the server to the client, informing it that the list of tools it offers has changed. This may be issued by servers without any previous subscription from the client.

- **params**:
  - **[key: string]**: unknown
  - **_meta?**: { [key: string]: unknown } - See [General fields: `_meta`](https://modelcontextprotocol.io/specification/2025-06-18/basic/index#meta) for notes on `_meta` usage.

---

## [`ping`](https://modelcontextprotocol.io/specification/2025-06-18/schema#ping)

### [`PingRequest`](https://modelcontextprotocol.io/specification/2025-06-18/schema#pingrequest)

```typescript
interface PingRequest {
  [method](https://modelcontextprotocol.io/specification/2025-06-18/schema#): "ping";
  [params](https://modelcontextprotocol.io/specification/2025-06-18/schema#pingrequest-params)?: {
    _meta?: { progressToken?: [ProgressToken](https://modelcontextprotocol.io/specification/2025-06-18/schema#progresstoken); [key: string]: unknown };
    [key: string]: unknown;
  };
}
```

**Description**: A ping, issued by either the server or the client, to check that the other party is still alive. The receiver must promptly respond, or else may be disconnected.

- **params**:
  - **[key: string]**: unknown
  - **_meta?**: { progressToken?: [ProgressToken](https://modelcontextprotocol.io/specification/2025-06-18/schema#progresstoken); [key: string]: unknown } - See [General fields: `_meta`](https://modelcontextprotocol.io/specification/2025-06-18/basic/index#meta) for notes on `_meta` usage.
    - **progressToken?**: [ProgressToken](https://modelcontextprotocol.io/specification/2025-06-18/schema#progresstoken) - If specified, the caller is requesting out-of-band progress notifications for this request (as represented by notifications/progress). The value of this parameter is an opaque token that will be attached to any subsequent notifications. The receiver is not obligated to provide these notifications.

---

## [`prompts/get`](https://modelcontextprotocol.io/specification/2025-06-18/schema#prompts%2Fget)

### [`GetPromptRequest`](https://modelcontextprotocol.io/specification/2025-06-18/schema#getpromptrequest)

```typescript
interface GetPromptRequest {
  [method](https://modelcontextprotocol.io/specification/2025-06-18/schema#): "prompts/get";
  [params](https://modelcontextprotocol.io/specification/2025-06-18/schema#getpromptrequest-params): { arguments?: { [key: string]: string }; name: string };
}
```

**Description**: Used by the client to get a prompt provided by the server.

- **params**:
  - **arguments?**: { [key: string]: string } - Arguments to use for templating the prompt.
  - **name**: string - The name of the prompt or prompt template.

### [`GetPromptResult`](https://modelcontextprotocol.io/specification/2025-06-18/schema#getpromptresult)

```typescript
interface GetPromptResult {
  [_meta](https://modelcontextprotocol.io/specification/2025-06-18/schema#getpromptresult-_meta)?: { [key: string]: unknown };
  [description](https://modelcontextprotocol.io/specification/2025-06-18/schema#getpromptresult-description)?: string;
  [messages](https://modelcontextprotocol.io/specification/2025-06-18/schema#): [PromptMessage](https://modelcontextprotocol.io/specification/2025-06-18/schema#promptmessage)[];
  [key: string]: unknown;
}
```

**Description**: The server’s response to a prompts/get request from the client.

- **_meta**: See [General fields: `_meta`](https://modelcontextprotocol.io/specification/2025-06-18/basic/index#meta) for notes on `_meta` usage.
- **description**: An optional description for the prompt.

---

## [`prompts/list`](https://modelcontextprotocol.io/specification/2025-06-18/schema#prompts%2Flist)

### [`ListPromptsRequest`](https://modelcontextprotocol.io/specification/2025-06-18/schema#listpromptsrequest)

```typescript
interface ListPromptsRequest {
  [method](https://modelcontextprotocol.io/specification/2025-06-18/schema#): "prompts/list";
  [params](https://modelcontextprotocol.io/specification/2025-06-18/schema#listpromptsrequest-params)?: { cursor?: string };
}
```

**Description**: Sent from the client to request a list of prompts and prompt templates the server has.

- **params**:
  - **cursor?**: string - An opaque token representing the current pagination position. If provided, the server should return results starting after this cursor.

### [`ListPromptsResult`](https://modelcontextprotocol.io/specification/2025-06-18/schema#listpromptsresult)

```typescript
interface ListPromptsResult {
  [_meta](https://modelcontextprotocol.io/specification/2025-06-18/schema#listpromptsresult-_meta)?: { [key: string]: unknown };
  [nextCursor](https://modelcontextprotocol.io/specification/2025-06-18/schema#listpromptsresult-nextcursor)?: string;
  [prompts](https://modelcontextprotocol.io/specification/2025-06-18/schema#): [Prompt](https://modelcontextprotocol.io/specification/2025-06-18/schema#prompt)[];
  [key: string]: unknown;
}
```

**Description**: The server’s response to a prompts/list request from the client.

- **_meta**: See [General fields: `_meta`](https://modelcontextprotocol.io/specification/2025-06-18/basic/index#meta) for notes on `_meta` usage.
- **nextCursor**: An opaque token representing the pagination position after the last returned result. If present, there may be more results available.

---

## [`resources/list`](https://modelcontextprotocol.io/specification/2025-06-18/schema#resources%2Flist)

### [`ListResourcesRequest`](https://modelcontextprotocol.io/specification/2025-06-18/schema#listresourcesrequest)

```typescript
interface ListResourcesRequest {
  [method](https://modelcontextprotocol.io/specification/2025-06-18/schema#): "resources/list";
  [params](https://modelcontextprotocol.io/specification/2025-06-18/schema#listresourcesrequest-params)?: { cursor?: string };
}
```

**Description**: Sent from the client to request a list of resources the server has.

- **params**:
  - **cursor?**: string - An opaque token representing the current pagination position. If provided, the server should return results starting after this cursor.

### [`ListResourcesResult`](https://modelcontextprotocol.io/specification/2025-06-18/schema#listresourcesresult)

```typescript
interface ListResourcesResult {
  [_meta](https://modelcontextprotocol.io/specification/2025-06-18/schema#listresourcesresult-_meta)?: { [key: string]: unknown };
  [nextCursor](https://modelcontextprotocol.io/specification/2025-06-18/schema#listresourcesresult-nextcursor)?: string;
  [resources](https://modelcontextprotocol.io/specification/2025-06-18/schema#): [Resource](https://modelcontextprotocol.io/specification/2025-06-18/schema#resource)[];
  [key: string]: unknown;
}
```

**Description**: The server’s response to a resources/list request from the client.

- **_meta**: See [General fields: `_meta`](https://modelcontextprotocol.io/specification/2025-06-18/basic/index#meta) for notes on `_meta` usage.
- **nextCursor**: An opaque token representing the pagination position after the last returned result. If present, there may be more results available.

---

## [`resources/read`](https://modelcontextprotocol.io/specification/2025-06-18/schema#resources%2Fread)

### [`ReadResourceRequest`](https://modelcontextprotocol.io/specification/2025-06-18/schema#readresourcerequest)

```typescript
interface ReadResourceRequest {
  [method](https://modelcontextprotocol.io/specification/2025-06-18/schema#): "resources/read";
  [params](https://modelcontextprotocol.io/specification/2025-06-18/schema#readresourcerequest-params): { uri: string };
}
```

**Description**: Sent from the client to the server, to read a specific resource URI.

- **params**:
  - **uri**: string - The URI of the resource to read. The URI can use any protocol; it is up to the server how to interpret it.

### [`ReadResourceResult`](https://modelcontextprotocol.io/specification/2025-06-18/schema#readresourceresult)

```typescript
interface ReadResourceResult {
  [_meta](https://modelcontextprotocol.io/specification/2025-06-18/schema#readresourceresult-_meta)?: { [key: string]: unknown };
  [contents](https://modelcontextprotocol.io/specification/2025-06-18/schema#): ([TextResourceContents](https://modelcontextprotocol.io/specification/2025-06-18/schema#textresourcecontents) | [BlobResourceContents](https://modelcontextprotocol.io/specification/2025-06-18/schema#blobresourcecontents))[];
  [key: string]: unknown;
}
```

**Description**: The server’s response to a resources/read request from the client.

- **_meta**: See [General fields: `_meta`](https://modelcontextprotocol.io/specification/2025-06-18/basic/index#meta) for notes on `_meta` usage.

---

## [`resources/subscribe`](https://modelcontextprotocol.io/specification/2025-06-18/schema#resources%2Fsubscribe)

### [`SubscribeRequest`](https://modelcontextprotocol.io/specification/2025-06-18/schema#subscriberequest)

```typescript
interface SubscribeRequest {
  [method](https://modelcontextprotocol.io/specification/2025-06-18/schema#): "resources/subscribe";
  [params](https://modelcontextprotocol.io/specification/2025-06-18/schema#subscriberequest-params): { uri: string };
}
```

**Description**: Sent from the client to request resources/updated notifications from the server whenever a particular resource changes.

- **params**:
  - **uri**: string - The URI of the resource to subscribe to. The URI can use any protocol; it is up to the server how to interpret it.

---

## [`resources/templates/list`](https://modelcontextprotocol.io/specification/2025-06-18/schema#resources%2Ftemplates%2Flist)

### [`ListResourceTemplatesRequest`](https://modelcontextprotocol.io/specification/2025-06-18/schema#listresourcetemplatesrequest)

```typescript
interface ListResourceTemplatesRequest {
  [method](https://modelcontextprotocol.io/specification/2025-06-18/schema#): "resources/templates/list";
  [params](https://modelcontextprotocol.io/specification/2025-06-18/schema#listresourcetemplatesrequest-params)?: { cursor?: string };
}
```

**Description**: Sent from the client to request a list of resource templates the server has.

- **params**:
  - **cursor?**: string - An opaque token representing the current pagination position. If provided, the server should return results starting after this cursor.

### [`ListResourceTemplatesResult`](https://modelcontextprotocol.io/specification/2025-06-18/schema#listresourcetemplatesresult)

```typescript
interface ListResourceTemplatesResult {
  [_meta](https://modelcontextprotocol.io/specification/2025-06-18/schema#listresourcetemplatesresult-_meta)?: { [key: string]: unknown };
  [nextCursor](https://modelcontextprotocol.io/specification/2025-06-18/schema#listresourcetemplatesresult-nextcursor)?: string;
  [resourceTemplates](https://modelcontextprotocol.io/specification/2025-06-18/schema#): [ResourceTemplate](https://modelcontextprotocol.io/specification/2025-06-18/schema#resourcetemplate)[];
  [key: string]: unknown;
}
```

**Description**: The server’s response to a resources/templates/list request from the client.

- **_meta**: See [General fields: `_meta`](https://modelcontextprotocol.io/specification/2025-06-18/basic/index#meta) for notes on `_meta` usage.
- **nextCursor**: An opaque token representing the pagination position after the last returned result. If present, there may be more results available.

---

## [`resources/unsubscribe`](https://modelcontextprotocol.io/specification/2025-06-18/schema#resources%2Funsubscribe)

### [`UnsubscribeRequest`](https://modelcontextprotocol.io/specification/2025-06-18/schema#unsubscriberequest)

```typescript
interface UnsubscribeRequest {
  [method](https://modelcontextprotocol.io/specification/2025-06-18/schema#): "resources/unsubscribe";
  [params](https://modelcontextprotocol.io/specification/2025-06-18/schema#unsubscriberequest-params): { uri: string };
}
```

**Description**: Sent from the client to request cancellation of resources/updated notifications from the server. This should follow a previous resources/subscribe request.

- **params**:
  - **uri**: string - The URI of the resource to unsubscribe from.

---

## [`roots/list`](https://modelcontextprotocol.io/specification/2025-06-18/schema#roots%2Flist)

### [`ListRootsRequest`](https://modelcontextprotocol.io/specification/2025-06-18/schema#listrootsrequest)

```typescript
interface ListRootsRequest {
  [method](https://modelcontextprotocol.io/specification/2025-06-18/schema#): "roots/list";
  [params](https://modelcontextprotocol.io/specification/2025-06-18/schema#listrootsrequest-params)?: {
    _meta?: { progressToken?: [ProgressToken](https://modelcontextprotocol.io/specification/2025-06-18/schema#progresstoken); [key: string]: unknown };
    [key: string]: unknown;
  };
}
```

**Description**: Sent from the server to request a list of root URIs from the client. Roots allow servers to ask for specific directories or files to operate on. A common example for roots is providing a set of repositories or directories a server should operate on. This request is typically used when the server needs to understand the file system structure or access specific locations that the client has permission to read from.

- **params**:
  - **[key: string]**: unknown
  - **_meta?**: { progressToken?: [ProgressToken](https://modelcontextprotocol.io/specification/2025-06-18/schema#progresstoken); [key: string]: unknown } - See [General fields: `_meta`](https://modelcontextprotocol.io/specification/2025-06-18/basic/index#meta) for notes on `_meta` usage.
    - **progressToken?**: [ProgressToken](https://modelcontextprotocol.io/specification/2025-06-18/schema#progresstoken) - If specified, the caller is requesting out-of-band progress notifications for this request (as represented by notifications/progress). The value of this parameter is an opaque token that will be attached to any subsequent notifications. The receiver is not obligated to provide these notifications.

### [`ListRootsResult`](https://modelcontextprotocol.io/specification/2025-06-18/schema#listrootsresult)

```typescript
interface ListRootsResult {
  [_meta](https://modelcontextprotocol.io/specification/2025-06-18/schema#listrootsresult-_meta)?: { [key: string]: unknown };
  [roots](https://modelcontextprotocol.io/specification/2025-06-18/schema#): [Root](https://modelcontextprotocol.io/specification/2025-06-18/schema#root)[];
  [key: string]: unknown;
}
```

**Description**: The client’s response to a roots/list request from the server. This result contains an array of Root objects, each representing a root directory or file that the server can operate on.

- **_meta**: See [General fields: `_meta`](https://modelcontextprotocol.io/specification/2025-06-18/basic/index#meta) for notes on `_meta` usage.

---

## [`sampling/createMessage`](https://modelcontextprotocol.io/specification/2025-06-18/schema#sampling%2Fcreatemessage)

### [`CreateMessageRequest`](https://modelcontextprotocol.io/specification/2025-06-18/schema#createmessagerequest)

```typescript
interface CreateMessageRequest {
  [method](https://modelcontextprotocol.io/specification/2025-06-18/schema#): "sampling/createMessage";
  [params](https://modelcontextprotocol.io/specification/2025-06-18/schema#createmessagerequest-params): {
    includeContext?: "none" | "thisServer" | "allServers";
    maxTokens: number;
    messages: [SamplingMessage](https://modelcontextprotocol.io/specification/2025-06-18/schema#samplingmessage)[];
    metadata?: object;
    modelPreferences?: [ModelPreferences](https://modelcontextprotocol.io/specification/2025-06-18/schema#modelpreferences);
    stopSequences?: string[];
    systemPrompt?: string;
    temperature?: number;
  };
}
```

**Description**: A request from the server to sample an LLM via the client. The client has full discretion over which model to select. The client should also inform the user before beginning sampling, to allow them to inspect the request (human in the loop) and decide whether to approve it.

- **params**:
  - **includeContext?**: "none" | "thisServer" | "allServers" - A request to include context from one or more MCP servers (including the caller), to be attached to the prompt. The client MAY ignore this request.
  - **maxTokens**: number - The maximum number of tokens to sample, as requested by the server. The client MAY choose to sample fewer tokens than requested.
  - **messages**: [SamplingMessage](https://modelcontextprotocol.io/specification/2025-06-18/schema#samplingmessage)[]
  - **metadata?**: object - Optional metadata to pass through to the LLM provider. The format of this metadata is provider-specific.
  - **modelPreferences?**: [ModelPreferences](https://modelcontextprotocol.io/specification/2025-06-18/schema#modelpreferences) - The server’s preferences for which model to select. The client MAY ignore these preferences.
  - **stopSequences?**: string[]
  - **systemPrompt?**: string - An optional system prompt the server wants to use for sampling. The client MAY modify or omit this prompt.
  - **temperature?**: number

### [`CreateMessageResult`](https://modelcontextprotocol.io/specification/2025-06-18/schema#createmessageresult)

```typescript
interface CreateMessageResult {
  [_meta](https://modelcontextprotocol.io/specification/2025-06-18/schema#createmessageresult-_meta)?: { [key: string]: unknown };
  [content](https://modelcontextprotocol.io/specification/2025-06-18/schema#): [TextContent](https://modelcontextprotocol.io/specification/2025-06-18/schema#textcontent) | [ImageContent](https://modelcontextprotocol.io/specification/2025-06-18/schema#imagecontent) | [AudioContent](https://modelcontextprotocol.io/specification/2025-06-18/schema#audiocontent);
  [model](https://modelcontextprotocol.io/specification/2025-06-18/schema#createmessageresult-model): string;
  [role](https://modelcontextprotocol.io/specification/2025-06-18/schema#): [Role](https://modelcontextprotocol.io/specification/2025-06-18/schema#role);
  [stopReason](https://modelcontextprotocol.io/specification/2025-06-18/schema#createmessageresult-stopreason)?: string;
  [key: string]: unknown;
}
```

**Description**: The client’s response to a sampling/create_message request from the server. The client should inform the user before returning the sampled message, to allow them to inspect the response (human in the loop) and decide whether to allow the server to see it.

- **_meta**: See [General fields: `_meta`](https://modelcontextprotocol.io/specification/2025-06-18/basic/index#meta) for notes on `_meta` usage.
- **model**: The name of the model that generated the message.
- **stopReason**: The reason why sampling stopped, if known.

---

## [`tools/call`](https://modelcontextprotocol.io/specification/2025-06-18/schema#tools%2Fcall)

### [`CallToolRequest`](https://modelcontextprotocol.io/specification/2025-06-18/schema#calltoolrequest)

```typescript
interface CallToolRequest {
  [method](https://modelcontextprotocol.io/specification/2025-06-18/schema#): "tools/call";
  [params](https://modelcontextprotocol.io/specification/2025-06-18/schema#): { arguments?: { [key: string]: unknown }; name: string };
}
```

**Description**: Used by the client to invoke a tool provided by the server.

### [`CallToolResult`](https://modelcontextprotocol.io/specification/2025-06-18/schema#calltoolresult)

```typescript
interface CallToolResult {
  [_meta](https://modelcontextprotocol.io/specification/2025-06-18/schema#calltoolresult-_meta)?: { [key: string]: unknown };
  [content](https://modelcontextprotocol.io/specification/2025-06-18/schema#calltoolresult-content): [ContentBlock](https://modelcontextprotocol.io/specification/2025-06-18/schema#contentblock)[];
  [isError](https://modelcontextprotocol.io/specification/2025-06-18/schema#calltoolresult-iserror)?: boolean;
  [structuredContent](https://modelcontextprotocol.io/specification/2025-06-18/schema#calltoolresult-structuredcontent)?: { [key: string]: unknown };
  [key: string]: unknown;
}
```

**Description**: The server’s response to a tool call.

- **_meta**: See [General fields: `_meta`](https://modelcontextprotocol.io/specification/2025-06-18/basic/index#meta) for notes on `_meta` usage.
- **content**: A list of content objects that represent the unstructured result of the tool call.
- **isError**: Whether the tool call ended in an error. If not set, this is assumed to be false (the call was successful). Any errors that originate from the tool SHOULD be reported inside the result object, with `isError` set to true, _not_ as an MCP protocol-level error response. Otherwise, the LLM would not be able to see that an error occurred and self-correct. However, any errors in _finding_ the tool, an error indicating that the server does not support tool calls, or any other exceptional conditions, should be reported as an MCP error response.
- **structuredContent**: An optional JSON object that represents the structured result of the tool call.

---

## [`tools/list`](https://modelcontextprotocol.io/specification/2025-06-18/schema#tools%2Flist)

### [`ListToolsRequest`](https://modelcontextprotocol.io/specification/2025-06-18/schema#listtoolsrequest)

```typescript
interface ListToolsRequest {
  [method](https://modelcontextprotocol.io/specification/2025-06-18/schema#): "tools/list";
  [params](https://modelcontextprotocol.io/specification/2025-06-18/schema#listtoolsrequest-params)?: { cursor?: string };
}
```

**Description**: Sent from the client to request a list of tools the server has.

- **params**:
  - **cursor?**: string - An opaque token representing the current pagination position. If provided, the server should return results starting after this cursor.

### [`ListToolsResult`](https://modelcontextprotocol.io/specification/2025-06-18/schema#listtoolsresult)

```typescript
interface ListToolsResult {
  [_meta](https://modelcontextprotocol.io/specification/2025-06-18/schema#listtoolsresult-_meta)?: { [key: string]: unknown };
  [nextCursor](https://modelcontextprotocol.io/specification/2025-06-18/schema#listtoolsresult-nextcursor)?: string;
  [tools](https://modelcontextprotocol.io/specification/2025-06-18/schema#): [Tool](https://modelcontextprotocol.io/specification/2025-06-18/schema#tool)[];
  [key: string]: unknown;
}
```

**Description**: The server’s response to a tools/list request from the client.

- **_meta**: See [General fields: `_meta`](https://modelcontextprotocol.io/specification/2025-06-18/basic/index#meta) for notes on `_meta` usage.
- **nextCursor**: An opaque token representing the pagination position after the last returned result. If present, there may be more results available.

---

This reformatted version maintains the exact content of the original schema reference while improving readability with consistent formatting, proper code blocks, and structured descriptions. If you need further adjustments or have specific formatting preferences, please let me know!
