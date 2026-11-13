# ClawGrab MCP Server

An MCP (Model Context Protocol) server that lets Claude Desktop, Cursor, OpenClaw and other MCP clients
get the transcript (the spoken words) of a public video link through the ClawGrab API at https://getclawgrab.com,
plus a few text helpers (summary, social posts, blog draft, quotes, translation).

It is a thin client: every tool is one HTTPS POST to `getclawgrab.com`. No scraping code runs on your machine.

## Tools

| Tool | What it does | API call |
|------|--------------|----------|
| `get_transcript` | Transcript of a public video/audio URL | `POST /api/transcribe` |
| `summarize_text` | Short bullet summary of transcript text | `POST /api/summarize` |
| `generate_social_posts` | X / LinkedIn / Instagram post drafts from transcript text | `POST /api/social` |
| `generate_blog_post` | Blog post draft from transcript text | `POST /api/blog` |
| `extract_quotes` | 3-5 quotable lines from transcript text | `POST /api/quotes` |
| `translate_transcript` | Translate transcript text | `POST /api/translate` |

## What works (honestly)

Best: public YouTube, TikTok, Vimeo, Dailymotion, SoundCloud, TED, Twitch, Kick, Streamable, PeerTube,
BitChute, Bandcamp, Substack and direct audio/video file links.
Often fails: Instagram, X/Twitter, Facebook, Reddit, LinkedIn (they need a login).
Never: private, members-only, age-gated or login-only videos.
Not every public video works: if a platform blocks the server or there are no captions you get an error, not a guess.

## Cost and limits

| What | Cost |
|------|------|
| `get_transcript` | Free, no API key, no account. Fair-use limit; when it is hit you get HTTP 429 until later. |
| AI tools (summary, social posts, blog, quotes, translation) | Need a ClawGrab account: **5 AI outputs a month free**, unlimited on **Pro, $12/month** (reasonable use). |

Without a token the AI tools return a short "sign up free" message instead of a result.

### Get your token (one time)

1. Create a free account at https://getclawgrab.com.
2. Exchange your email and password for your account token:

```bash
curl -s -X POST https://getclawgrab.com/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"you@example.com\",\"password\":\"YOUR_PASSWORD\"}"
```

3. Copy the `token` value from the reply into `CLAWGRAB_TOKEN` (below). Treat it like a password.

## Install

**Claude Desktop, one click:** download `clawgrab.mcpb` from the
[latest release](https://github.com/getclawgrab/clawgrab-mcp-server/releases/latest) and open it. Claude Desktop asks for the
optional token.

**Claude Desktop, by config** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "clawgrab": {
      "command": "npx",
      "args": ["-y", "github:getclawgrab/clawgrab-mcp-server"],
      "env": { "CLAWGRAB_TOKEN": "optional: your account token" }
    }
  }
}
```

OpenClaw node host (`openclaw.json`):

```json5
{
  nodeHost: {
    mcp: {
      servers: {
        clawgrab: { command: "npx", args: ["-y", "github:getclawgrab/clawgrab-mcp-server"], toolFilter: { include: ["get_transcript"] } },
      },
    },
  },
}
```

(OpenClaw users can also skip MCP entirely and use the one-file ClawGrab skill: https://getclawgrab.com/guides/openclaw.html)

## Configuration (all optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAWGRAB_TOKEN` | none | Your ClawGrab account token; unlocks the AI tools |
| `CLAWGRAB_API_URL` | `https://getclawgrab.com` | API base URL |
| `CLAWGRAB_TIMEOUT` | `60000` | Request timeout in ms |

## Privacy

Only the URL or text you pass to a tool is sent, to `getclawgrab.com`. The server sees your IP like any website;
its rate-limit counter stores a hash of it, requested links appear in server logs (deleted within 7 days), and a
transcript is cached for up to 24 hours. AI features and speech-to-text use Groq as a processor.
Policy: https://getclawgrab.com/privacy

## About

ClawGrab is an independent product by Eric West - hello@getclawgrab.com - https://getclawgrab.com

MIT licence.
