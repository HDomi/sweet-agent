# sweet-shrink

> MCP middleware. Wrap any MCP server. Cut the prose. Keep the substance.

`sweet-shrink` is a stdio proxy for the [Model Context Protocol](https://modelcontextprotocol.io). It sits between Claude (or any MCP client) and an upstream MCP server, and compresses the prose fields (`description`, etc.) using the same boundaries as the [sweet](../..) skill — preserving code, URLs, paths, and identifiers while stripping articles, filler, hedging, and pleasantries.

The result: tool catalogs that the model burns fewer tokens to read, with no change to tool semantics.

## Install

```bash
npm install -g sweet-shrink
# or run directly via npx
npx sweet-shrink <upstream-command> [...args]
```

## Use it

Wrap any MCP server in your Claude Code (or other client) config:

```jsonc
{
  "mcpServers": {
    "fs-shrunk": {
      "command": "npx",
      "args": [
        "sweet-shrink",
        "npx", "@modelcontextprotocol/server-filesystem", "/path/to/dir"
      ]
    }
  }
}
```

The proxy spawns the upstream as a subprocess, intercepts `tools/list`, `prompts/list`, `resources/list` responses, and rewrites the `description` fields (and anything else you list in `SWEET_SHRINK_FIELDS`).

## What it does NOT touch

By design, v1 is conservative:

- **Request bodies** going to the upstream are passed through unchanged.
- **Tool call responses** (`tools/call`) are passed through unchanged. We don't want to risk silently mutating the data the upstream returns to the model.
- **Identifiers, URLs, paths, and code-looking tokens** inside any prose are preserved exactly. Same boundaries as the parent sweet skill.

## Configuration

| Env var | Default | What |
|---|---|---|
| `SWEET_SHRINK_FIELDS` | `description` | Comma-separated list of field names to compress |
| `SWEET_SHRINK_DEBUG` | `0` | Set to `1` to log per-field compression deltas to stderr |

## Status

Pre-1.0 — the compression rules and field set may change. Part of [sweet-agent](https://github.com/HDomi/sweet-agent); see the parent repo for the full skill suite (`sweet`, `sweet-commit`, `sweet-review`, `sweet-compress`, `sweet-stats`, `sweet-help`, `sweetcrew`).

**Not published to npm.** The `npm install -g sweet-shrink` / `npx sweet-shrink` lines above will not resolve — that name is unclaimed and this project does not own it. Run it from a repo clone instead:

```jsonc
{
  "mcpServers": {
    "fs-shrunk": {
      "command": "node",
      "args": [
        "/abs/path/to/sweet-agent/src/mcp-servers/sweet-shrink/index.js",
        "npx", "@modelcontextprotocol/server-filesystem", "/path/to/dir"
      ]
    }
  }
}
```

`bin/install.js --with-mcp-shrink="<upstream cmd>"` wires exactly this for you.

## License

MIT.
