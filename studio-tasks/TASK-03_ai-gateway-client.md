# TASK-03: Enterprise AI Gateway Client

> **Phase:** 1 — Foundation | **Priority:** P0 | **Effort:** 6 hours

## Objective

Build the backend `gateway.js` module that communicates with the corporate AI Gateway proxy. This module is the single point of contact between the Studio and any LLM. No API keys are stored locally.

## Prerequisites

- TASK-01 complete (Express server running)
- Corporate Gateway URL available (or mock endpoint for dev)

## Acceptance Criteria

- [ ] `gateway.js` reads `GATEWAY_URL` from `studio/.env`
- [ ] Sends structured payloads: system prompt (from SKILL.md) + user message + file context
- [ ] Supports streaming responses via SSE to the frontend
- [ ] All interactions logged to `studio/logs/ai-audit.jsonl`
- [ ] Graceful error handling with retry (3 attempts, exponential backoff)
- [ ] Mock gateway mode for local development (no real API calls)

## Configuration

```env
# studio/.env
GATEWAY_URL=https://ai-gateway.yourcompany.com/v1/chat
GATEWAY_AUTH_MODE=HEADER_TOKEN
GATEWAY_TOKEN=<set-by-IT-or-SSO>
GATEWAY_MOCK=true  # Set to false in production
```

## Implementation Steps

### Step 1: Create `server/gateway.js`
Core functions:
- `sendToGateway(skillPath, userMessage, contextFiles[])` — Main entry point
- `buildPayload(systemPrompt, userMessage, context)` — Constructs the chat completion request
- `streamResponse(res, gatewayStream)` — Pipes SSE chunks to the Express response
- `logInteraction(entry)` — Appends to `studio/logs/ai-audit.jsonl`

### Step 2: Create `server/skill-loader.js`
Reads a SKILL.md file and extracts its content as the system prompt:
- `loadSkill(skillName)` — Reads `.agents/skills/<skillName>/SKILL.md`
- Returns the full markdown content as a string
- Caches loaded skills in memory (Map) to avoid repeated disk reads

### Step 3: Create `server/context-builder.js`
Gathers relevant file context for the AI based on the current action:
- `buildContext(featureId, action)` — Returns an array of file contents
- For `/specify`: Reads `constitution.md` + `sfdx-project.json`
- For `/clarify`: Reads `spec.md` + `constitution.md`
- For `/plan`: Reads `spec.md` + `clarification-report.md`
- For `/stories`: Reads `plan.md` + `data-model.md` + `spec.md`
- For `/e2e-story`: Reads `task_story_NN.md` + E2E SKILL.md schema

### Step 4: Create `server/audit-logger.js`
Append-only JSONL logger:
```json
{"ts":"2026-05-13T14:30:00Z","user":"local","mode":"QA","skill":"sfspeckit-e2e-story","feature":"001","prompt_tokens":2400,"completion_tokens":1800}
```

### Step 5: Create Mock Gateway for Development
When `GATEWAY_MOCK=true`:
- Returns canned responses for each skill type
- Simulates streaming with 50ms delays between chunks
- Allows offline development without a real gateway

### Step 6: Create API Route — `POST /api/chat`
Express route that:
1. Receives `{ skill, message, featureId }` from the frontend
2. Loads the skill's SKILL.md as system prompt
3. Builds file context for the feature
4. Sends to gateway and streams response back
5. Logs the interaction

## Files Created

| File | Action |
|------|--------|
| `studio/server/gateway.js` | NEW |
| `studio/server/skill-loader.js` | NEW |
| `studio/server/context-builder.js` | NEW |
| `studio/server/audit-logger.js` | NEW |
| `studio/server/mocks/gateway-mock.js` | NEW |
| `studio/.env` | NEW |
| `studio/.env.example` | NEW |

## Definition of Done

- [ ] `POST /api/chat` returns a streamed AI response
- [ ] Mock mode works without any network calls
- [ ] Every interaction creates a line in `studio/logs/ai-audit.jsonl`
- [ ] Errors from the gateway are caught and returned as structured JSON
- [ ] No API keys exist in any committed file (`.env` is in `.gitignore`)
