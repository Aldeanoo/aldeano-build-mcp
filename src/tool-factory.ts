// Modified for Aldeano Build MCP; derived from yuniko-software/minecraft-mcp-server. See LICENSE and docs/attribution.md.
// SPDX-License-Identifier: Apache-2.0
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z, ZodError, ZodRawShape, ZodType } from "zod";
import { BotConnection } from './bot-connection.js';
import { getToolMetadata } from './tools/tool-metadata.js';
import { serializeUntrustedContent } from './world/untrusted-content.js';

type McpContent = { type: "text"; text: string } | { type: "image"; data: string; mimeType: string };

type McpResponse = {
  content: McpContent[];
  isError?: boolean;
  [key: string]: unknown;
};

export class ToolFactory {
  constructor(
    private server: McpServer,
    private connection: BotConnection
  ) {}

  registerTool(
    name: string,
    description: string,
    schema: Record<string, unknown>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    executor: (args: any) => Promise<McpResponse>
  ): void {
    const callback = async (args: unknown): Promise<McpResponse> => {
      const connectionCheck = await this.connection.checkConnectionAndReconnect();

      if (!connectionCheck.connected) {
        return {
          content: [{ type: "text", text: connectionCheck.message! }],
          isError: true
        };
      }

      try {
        const parsedArgs = this.shouldValidateSchema(schema)
          ? this.parseArgs(schema as ZodRawShape, args)
          : args;
        return await executor(parsedArgs);
      } catch (error) {
        if (['read-chat', 'find-entity', 'list-inventory', 'find-item'].includes(name) || name.startsWith('world.')) {
          const code = error instanceof Error && 'code' in error && typeof error.code === 'string' ? error.code : undefined;
          return { ...this.createWorldResponse({ success: false, error: { code, message: error instanceof Error ? error.message : String(error) } }), isError: true };
        }
        return this.createErrorResponse(error as Error);
      }
    };
    const metadata = getToolMetadata(name);
    const modernServer = this.server as unknown as {
      registerTool?: (toolName: string, config: Record<string, unknown>, handler: (args: unknown) => Promise<McpResponse>) => unknown;
    };
    if (typeof modernServer.registerTool === 'function') {
      modernServer.registerTool(name, {
        description,
        inputSchema: schema,
        annotations: {
          readOnlyHint: metadata.risk === 'low',
          destructiveHint: metadata.destructive,
          openWorldHint: metadata.requiresMinecraft
        },
        _meta: { aldeano: metadata }
      }, callback);
    } else {
      this.server.tool(name, description, schema, callback);
    }
  }

  createResponse(text: string = ''): McpResponse {
    return {
      content: [{ type: "text", text: text ?? '' }]
    };
  }

  createWorldResponse(data: unknown): McpResponse {
    return this.createResponse(serializeUntrustedContent(data));
  }

  createImageResponse(data: Buffer | string, mimeType = 'image/png', metadata?: unknown): McpResponse {
    const encoded = Buffer.isBuffer(data) ? data.toString('base64') : data;
    return {
      content: [
        ...(metadata === undefined ? [] : [{ type: "text" as const, text: JSON.stringify(metadata) }]),
        { type: "image", data: encoded, mimeType }
      ]
    };
  }

  createErrorResponse(error: Error | string): McpResponse {
    const errorMessage = error instanceof Error ? error.message : error;
    const code = error instanceof Error && 'code' in error && typeof (error as Error & { code?: unknown }).code === 'string'
      ? (error as Error & { code: string }).code
      : undefined;
    if (code) {
      return {
        content: [{ type: "text", text: JSON.stringify({ success: false, error: { code, message: errorMessage } }) }],
        isError: true
      };
    }
    return {
      content: [{ type: "text", text: `Failed: ${errorMessage}` }],
      isError: true
    };
  }

  private shouldValidateSchema(schema: Record<string, unknown>): boolean {
    const values = Object.values(schema);
    if (values.length === 0) {
      return true;
    }

    return values.every((value) => value instanceof ZodType);
  }

  private parseArgs(schema: ZodRawShape, args: unknown): unknown {
    try {
      return z.object(schema).passthrough().parse(args ?? {});
    } catch (error) {
      if (error instanceof ZodError) {
        throw new Error(this.formatZodError(error));
      }
      throw error;
    }
  }

  private formatZodError(error: ZodError): string {
    const details = error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
        return `${path}${issue.message}`;
      })
      .join('; ');

    return `Invalid tool arguments: ${details}`;
  }
}
