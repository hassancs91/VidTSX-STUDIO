import { execSync } from "child_process";
import type { ProviderId } from "./types";

export interface ClaudeSubscriptionStatus {
  installed: boolean;
  version?: string;
}

export function detectClaudeSubscription(): ClaudeSubscriptionStatus {
  try {
    const output = execSync("claude --version", { encoding: "utf-8", timeout: 5000 });
    const version = output.trim();
    return { installed: true, version };
  } catch {
    return { installed: false };
  }
}

const HTTP_ERROR_MESSAGES: Record<number, string> = {
  401: "Invalid API key or expired session. Check your settings.",
  429: "Rate limit reached. Please wait and try again.",
  404: "Model not found. Check the model name in your provider settings.",
};

export function getHumanReadableError(error: unknown, providerId: ProviderId): string {
  if (error instanceof Error) {
    const statusMatch = error.message.match(/(\d{3})/);
    if (statusMatch) {
      const status = Number(statusMatch[1]);
      if (HTTP_ERROR_MESSAGES[status]) {
        return HTTP_ERROR_MESSAGES[status];
      }
    }

    if ("status" in error && typeof (error as Record<string, unknown>).status === "number") {
      const status = (error as Record<string, unknown>).status as number;
      if (HTTP_ERROR_MESSAGES[status]) {
        return HTTP_ERROR_MESSAGES[status];
      }
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function isCliNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return msg.includes("enoent") ||
    msg.includes("command not found") ||
    msg.includes("is not recognized") ||
    msg.includes("not found");
}

export function getStatusCode(error: unknown): number | undefined {
  if (error instanceof Error && "status" in error && typeof (error as Record<string, unknown>).status === "number") {
    return (error as Record<string, unknown>).status as number;
  }
  return undefined;
}

/**
 * Extract HTML code from LLM output that may contain markdown fences or conversational text.
 * Returns clean HTML ready to save as an .html file.
 */
export function extractHtmlCode(text: string): string {
  // Try to extract from markdown code fences
  const fenceMatch = text.match(/```html\s*\n([\s\S]*?)```/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }

  // Try to find <!DOCTYPE html> or <html
  const doctypeIndex = text.indexOf("<!DOCTYPE html>");
  if (doctypeIndex >= 0) {
    const closingIndex = text.lastIndexOf("</html>");
    if (closingIndex > doctypeIndex) {
      return text.slice(doctypeIndex, closingIndex + "</html>".length).trim();
    }
    return text.slice(doctypeIndex).trim();
  }

  const htmlTagIndex = text.indexOf("<html");
  if (htmlTagIndex >= 0) {
    const closingIndex = text.lastIndexOf("</html>");
    if (closingIndex > htmlTagIndex) {
      return text.slice(htmlTagIndex, closingIndex + "</html>".length).trim();
    }
    return text.slice(htmlTagIndex).trim();
  }

  // Already clean or no HTML markers found
  return text.trim();
}

/**
 * Extract TSX code from LLM output that may contain markdown fences or conversational text.
 * Returns clean TSX code ready to save as a .tsx file.
 */
export function extractTsxCode(text: string): string {
  // Try to extract from markdown code fences
  const fenceMatch = text.match(/```(?:tsx|typescript|jsx|ts)?\s*\n([\s\S]*?)```/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }

  // If no fences, try to find the code starting from the first import statement
  const importIndex = text.indexOf("import ");
  if (importIndex > 0) {
    return text.slice(importIndex).trim();
  }

  // Already clean
  return text.trim();
}
