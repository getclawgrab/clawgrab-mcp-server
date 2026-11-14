#!/usr/bin/env node
"use strict";

const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const API_URL = (process.env.CLAWGRAB_API_URL || "https://getclawgrab.com").replace(/\/$/, "");
const TIMEOUT = parseInt(process.env.CLAWGRAB_TIMEOUT || "60000", 10);
const VERSION = "1.1.1";
// Optional: a free ClawGrab account token unlocks the AI tools (5 a month free, unlimited on Pro).
const TOKEN = (process.env.CLAWGRAB_TOKEN || "").trim();

const NO_ACCOUNT_MSG =
  "AI outputs need a free ClawGrab account (5 a month free; Pro is $12/month for unlimited). " +
  "Sign up at https://getclawgrab.com, then set CLAWGRAB_TOKEN as shown in the README. " +
  "Transcripts (get_transcript) never need an account.";

async function callApi(endpoint, body) {
  const headers = { "Content-Type": "application/json", "User-Agent": `clawgrab-mcp/${VERSION}` };
  if (TOKEN) headers["Authorization"] = `Bearer ${TOKEN}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 401) {
        throw new Error(TOKEN
          ? "ClawGrab did not accept CLAWGRAB_TOKEN. Get a fresh token as shown in the README and update your MCP config."
          : NO_ACCOUNT_MSG);
      }
      if (res.status === 402 || res.status === 403) {
        throw new Error(`ClawGrab: ${text.slice(0, 200)} - free accounts get 5 AI outputs a month; Pro ($12/month) is unlimited: https://getclawgrab.com`);
      }
      if (res.status === 429) {
        throw new Error("ClawGrab fair-use limit reached for now. Try again later, or sign in / go Pro at https://getclawgrab.com");
      }
      throw new Error(`ClawGrab API error ${res.status}: ${text.slice(0, 200)}`);
    }

    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const server = new McpServer({
  name: "clawgrab-mcp",
  version: VERSION,
});

server.tool(
  "get_transcript",
  "Extract the transcript (spoken words) from a public video/audio URL: YouTube, TikTok, Vimeo, Dailymotion, SoundCloud, TED, Twitch and more. Instagram, X/Twitter and Facebook usually need a login and often fail. Returns the transcript text, or an honest error - it never guesses.",
  {
    url: z.string().url().describe("The video or media URL to transcribe"),
    timestamps: z.boolean().optional().default(false).describe("Include timestamps in the transcript"),
    summary: z.boolean().optional().default(false).describe("Also return an AI-generated summary"),
  },
  async ({ url, timestamps, summary }) => {
    const data = await callApi("/api/transcribe", {
      url,
      options: { timestamps, summary, clean: true },
    });

    const lines = [];
    const transcript = data.plain || data.transcript;
    if (transcript) lines.push(`## Transcript\n\n${transcript}`);
    const sum = data.summary;
    if (Array.isArray(sum) ? sum.length : sum) lines.push(`\n## Summary\n\n${Array.isArray(sum) ? sum.map((b) => `- ${b}`).join("\n") : String(sum)}`);
    if (data.platform) lines.push(`\n_Platform: ${data.platform}_`);
    if (!TOKEN && transcript) lines.push("\n_Want a summary, quotes or social posts from this? Free ClawGrab account: https://getclawgrab.com_");

    return {
      content: [{ type: "text", text: lines.join("\n") || JSON.stringify(data) }],
    };
  }
);

server.tool(
  "summarize_text",
  "Generate a short AI bullet-point summary from transcript text.",
  {
    text: z.string().min(50).describe("The transcript text to summarize"),
  },
  async ({ text }) => {
    const data = await callApi("/api/summarize", { text });
    return {
      content: [{ type: "text", text: String(data.summary || JSON.stringify(data)) }],
    };
  }
);

server.tool(
  "generate_social_posts",
  "Generate platform-optimized social media posts (Twitter/X, LinkedIn, Instagram) from transcript text.",
  {
    text: z.string().min(50).describe("The transcript text to create posts from"),
    platforms: z
      .array(z.enum(["twitter", "linkedin", "instagram"]))
      .optional()
      .default(["twitter", "linkedin", "instagram"])
      .describe("Which platforms to generate posts for"),
  },
  async ({ text, platforms }) => {
    const data = await callApi("/api/social", { text, platforms });
    const output = data.posts || data.content || data.result || JSON.stringify(data);
    return {
      content: [{ type: "text", text: String(output) }],
    };
  }
);

server.tool(
  "generate_blog_post",
  "Convert a transcript into a full SEO-optimized blog post with headings, introduction, and conclusion.",
  {
    text: z.string().min(50).describe("The transcript text to convert into a blog post"),
  },
  async ({ text }) => {
    const data = await callApi("/api/blog", { text });
    const output = data.blog || data.content || data.result || JSON.stringify(data);
    return {
      content: [{ type: "text", text: String(output) }],
    };
  }
);

server.tool(
  "extract_quotes",
  "Extract the most memorable and shareable quotes from a transcript.",
  {
    text: z.string().min(50).describe("The transcript text to extract quotes from"),
  },
  async ({ text }) => {
    const data = await callApi("/api/quotes", { text });
    const q = data.quotes;
    const output = Array.isArray(q) ? q.map((x) => `- ${x}`).join("\n") : (q || data.content || data.result || JSON.stringify(data));
    return {
      content: [{ type: "text", text: String(output) }],
    };
  }
);

server.tool(
  "translate_transcript",
  "Translate transcript text into another language.",
  {
    text: z.string().min(10).describe("The text to translate"),
    target_language: z.string().describe("Target language (e.g. 'Spanish', 'French', 'Japanese')"),
  },
  async ({ text, target_language }) => {
    const data = await callApi("/api/translate", { text, language: target_language });
    const output = data.translation || data.translated || data.result || JSON.stringify(data);
    return {
      content: [{ type: "text", text: String(output) }],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[clawgrab-mcp] Server running on stdio");
}

main().catch((err) => {
  console.error("[clawgrab-mcp] Fatal error:", err);
  process.exit(1);
});
