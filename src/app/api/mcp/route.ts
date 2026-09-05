import { handleMcpRequest } from "@/server/mcp/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = handleMcpRequest;
export const POST = handleMcpRequest;
