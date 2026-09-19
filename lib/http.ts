/**
 * Response and request helpers shared by every route.
 *
 * Error shape, from the v2 API design:
 *   { "error": { "code", "message", "retryable", "retry_after"? } }
 * `retryable` is what a module keys on: a retryable failure is never a licence
 * decision, so the install keeps its current state and tries again later.
 */
export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

export class ApiError extends Error {
  status: number;
  code: string;
  retryable: boolean;
  retryAfter?: number;
  constructor(status: number, code: string, message: string, retryable = false, retryAfter?: number) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryable = retryable;
    this.retryAfter = retryAfter;
  }
}

export function errorResponse(e: ApiError): Response {
  const headers: Record<string, string> = {};
  if (e.retryAfter) headers["retry-after"] = String(e.retryAfter);
  return json(
    { error: { code: e.code, message: e.message, retryable: e.retryable, ...(e.retryAfter ? { retry_after: e.retryAfter } : {}) } },
    e.status,
    headers,
  );
}

/** Unexpected failures are 503 + retryable: an outage must never read as "unlicensed". */
export function handle(fn: () => Promise<Response>): Promise<Response> {
  return fn().catch((e: unknown) => {
    if (e instanceof ApiError) return errorResponse(e);
    const code = (e as { code?: string })?.code;
    console.error("[licensing]", code ?? "", e instanceof Error ? e.message : e);
    return errorResponse(new ApiError(503, "unavailable", "The licensing service is temporarily unavailable.", true, 60));
  });
}

export const MAX_BODY_BYTES = 16 * 1024;

/** Read the raw body with a size cap. The raw text is what request HMACs cover. */
export async function readRaw(req: Request, max = MAX_BODY_BYTES): Promise<string> {
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > max) throw new ApiError(413, "payload_too_large", "Request body is too large.");
  const text = await req.text();
  if (Buffer.byteLength(text) > max) throw new ApiError(413, "payload_too_large", "Request body is too large.");
  return text;
}

export function parseObject(raw: string): Record<string, unknown> {
  if (raw.trim() === "") return {};
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    throw new ApiError(400, "invalid_json", "Request body is not valid JSON.");
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new ApiError(400, "invalid_json", "Request body must be a JSON object.");
  return v as Record<string, unknown>;
}

export function str(o: Record<string, unknown>, k: string, opts: { required?: boolean; max?: number } = {}): string {
  const v = o[k];
  if (v === undefined || v === null || v === "") {
    if (opts.required) throw new ApiError(422, "invalid_request", `"${k}" is required.`);
    return "";
  }
  if (typeof v !== "string" && typeof v !== "number") throw new ApiError(422, "invalid_request", `"${k}" must be a string.`);
  const s = String(v).trim();
  if (s.length > (opts.max ?? 255)) throw new ApiError(422, "invalid_request", `"${k}" is too long.`);
  return s;
}

export function int(o: Record<string, unknown>, k: string): number | null {
  const v = o[k];
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isInteger(n)) throw new ApiError(422, "invalid_request", `"${k}" must be an integer.`);
  return n;
}

export function bool(o: Record<string, unknown>, k: string): boolean | null {
  const v = o[k];
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "boolean") return v;
  if (v === 1 || v === "1" || v === "true" || v === "on") return true;
  if (v === 0 || v === "0" || v === "false" || v === "off") return false;
  throw new ApiError(422, "invalid_request", `"${k}" must be a boolean.`);
}

/** An ISO date/time, "" / null to clear, or undefined to leave unchanged. */
export function date(o: Record<string, unknown>, k: string): string | null | undefined {
  if (!(k in o)) return undefined;
  const v = o[k];
  if (v === null || v === "" || v === "0000-00-00") return null;
  if (typeof v !== "string") throw new ApiError(422, "invalid_request", `"${k}" must be a date.`);
  const t = Date.parse(v);
  if (Number.isNaN(t)) throw new ApiError(422, "invalid_request", `"${k}" must be a date.`);
  return new Date(t).toISOString();
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown").slice(0, 100);
}
