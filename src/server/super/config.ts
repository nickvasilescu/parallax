import "server-only";

import { readFileSync } from "node:fs";
import { ApiError } from "../errors";

/**
 * Settings for the agent chat. Each outside service is live only when SUPER_MODE=live
 * and its own key is set; otherwise that one service runs as a mock.
 *
 * The assistant itself can also run on an outside engine: a Hermes agent (SUPER_ENGINE=hermes).
 * Then Hermes does the thinking and Parallax serves it our tools; see `hermes.ts`.
 */

export type Service = "llm" | "computer" | "connectors";

const KEYS: Record<Service, string> = {
  llm: "ANTHROPIC_API_KEY",
  computer: "ORGO_API_KEY",
  connectors: "COMPOSIO_API_KEY",
};

export function serviceMode(service: Service): "live" | "mock" {
  if (service === "llm" && hermesEngine()) return "live";
  return process.env.SUPER_MODE === "live" && !!process.env[KEYS[service]] ? "live" : "mock";
}

/** A secret from NAME, or from the file that NAME_FILE names. Never logged. */
export function secret(name: string): string | null {
  const direct = process.env[name]?.trim();
  if (direct) return direct;
  const file = process.env[`${name}_FILE`]?.trim();
  if (!file) return null;
  try {
    return readFileSync(file, "utf8").trim() || null;
  } catch {
    return null;
  }
}

export interface HermesEngine {
  /** Where the agent's API server answers, with no trailing slash. */
  url: string;
  /** The agent's own API key. */
  key: string;
  /** What the agent must show us when it calls our tools. */
  token: string;
  model: string;
  /** The name members see in the composer. */
  name: string;
  /** The name our tool server has in the agent's settings; its tools are `mcp__<name>__<tool>`. */
  mcpName: string;
}

let warned = false;

/** The Hermes engine's settings, or null when the built-in engine is in charge. */
export function hermesEngine(): HermesEngine | null {
  if ((process.env.SUPER_ENGINE ?? "").trim().toLowerCase() !== "hermes") return null;
  let url: string | null = null;
  try {
    const u = new URL(process.env.HERMES_URL ?? "");
    if (u.protocol === "http:" || u.protocol === "https:") url = (u.origin + u.pathname).replace(/\/+$/, "");
  } catch {
    /* not an address */
  }
  const key = secret("HERMES_API_KEY");
  const token = secret("SUPER_ENGINE_TOKEN");
  if (!url || !key || !token || token.length < 24) {
    if (!warned) {
      warned = true;
      const missing = [!url && "HERMES_URL", !key && "HERMES_API_KEY", (!token || token.length < 24) && "SUPER_ENGINE_TOKEN (24+ characters)"].filter(Boolean);
      console.error(`[super] SUPER_ENGINE=hermes is set but incomplete (${missing.join(", ")}). Using the built-in engine.`);
    }
    return null;
  }
  return {
    url,
    key,
    token,
    model: process.env.HERMES_MODEL?.trim() || "hermes-agent",
    name: (process.env.SUPER_ENGINE_NAME?.trim() || "Hermes").slice(0, 40),
    mcpName: (process.env.HERMES_MCP_NAME?.trim() || "parallax").replace(/[^A-Za-z0-9_]/g, "_"),
  };
}

/**
 * True when a chat turn can reach something that costs the operator money or runs code for
 * them: a live model, a cloud computer, app connections, or a Hermes agent with its own tools.
 */
export function agentLive(): boolean {
  return hermesEngine() !== null || (Object.keys(KEYS) as Service[]).some((s) => serviceMode(s) === "live");
}

/**
 * Who may use the agent while it is live. AGENT_ALLOWED_EMAILS lists member emails, comma
 * separated, or "*" for every signed-in member. Guests never qualify. Unset means nobody: a
 * live agent stays closed until the operator names who may use it. In mock mode everyone may.
 */
export function agentAllowed(user: { email: string | null; isGuest: boolean }): boolean {
  if (!agentLive()) return true;
  if (user.isGuest || !user.email) return false;
  const list = (process.env.AGENT_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes("*") || list.includes(user.email.toLowerCase());
}

export const AGENT_RESTRICTED = "The live agent on this server is open only to members the operator has approved.";

export function requireAgentAccess(user: { email: string | null; isGuest: boolean }) {
  if (!agentAllowed(user)) throw new ApiError(403, "agent_restricted", AGENT_RESTRICTED);
}

function num(name: string, fallback: number, min: number, max: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.min(max, Math.max(min, n)) : fallback;
}

export const limits = {
  /** Model calls in one turn before it is cut off. */
  maxSteps: () => num("SUPER_MAX_STEPS", 12, 1, 50),
  /** Working time of one turn, not counting time spent waiting for the member. */
  turnMs: () => num("SUPER_TURN_MS", 5 * 60_000, 5_000, 30 * 60_000),
  /** How long an approval card waits before it expires. */
  approvalMs: () => num("SUPER_APPROVAL_MS", 30 * 60_000, 10_000, 24 * 3_600_000),
  /** How long a generation may take before the turn stops waiting for it. */
  jobWaitMs: () => num("SUPER_JOB_WAIT_MS", 10 * 60_000, 5_000, 60 * 60_000),
  /** Idle minutes before a member's computer is suspended. */
  computerIdleMs: () => num("SUPER_COMPUTER_IDLE_MIN", 20, 1, 24 * 60) * 60_000,
  maxSchedules: 10,
  maxChats: 500,
};

/** The assistant's own model choices. `auto` lets the server pick. */
export const LLM_MODELS = [
  { id: "auto", name: "Auto", description: "Picks the model for you.", tier: "standard" },
  { id: "claude-opus-5-5", name: "Claude Opus 5.5", description: "Strongest planning and tool use.", tier: "high" },
  { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", description: "Fast and capable for everyday work.", tier: "medium" },
  { id: "claude-haiku-5-5", name: "Claude Haiku 5.5", description: "Quickest replies for simple asks.", tier: "low" },
] as const;

export function resolveLlmModel(setting: string): string {
  if (setting && setting !== "auto" && LLM_MODELS.some((m) => m.id === setting)) return setting;
  return process.env.SUPER_LLM_MODEL || "claude-opus-5-5";
}

export const MODES = [
  { id: "ask", name: "Ask before generating", description: "Shows the model, prompt and price, and waits for your yes before spending credits." },
  { id: "auto", name: "Generate without asking", description: "Starts generations straight away and spends credits as it goes." },
] as const;
export type Mode = "ask" | "auto";
