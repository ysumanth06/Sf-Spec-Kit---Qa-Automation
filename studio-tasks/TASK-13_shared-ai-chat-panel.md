# TASK-13: Shared AI Chat Panel

> **Phase:** 4 — Polish & Enterprise | **Priority:** P1 | **Effort:** 6 hours

## Objective

Build the shared AI Chat Panel — the "Cursor-like" sidebar that is available in both TPO and QA modes. It is context-aware and pre-loaded with the relevant skill for the current screen.

## Prerequisites

- TASK-03 complete (AI Gateway client functional)
- TASK-06 through TASK-12 complete (all screens exist to provide context)

## Acceptance Criteria

- [ ] Chat panel is a collapsible right sidebar available on every screen
- [ ] AI responses stream in real-time (word by word, not all at once)
- [ ] Chat is context-aware: it knows which screen/feature/story the user is on
- [ ] Supports markdown rendering in responses (code blocks, tables, lists)
- [ ] Chat history persists per session (cleared on app restart)
- [ ] "Clear Chat" button resets the conversation
- [ ] System prompt automatically changes based on the active screen

## Context Awareness Rules

| Current Screen | System Prompt (Skill) | Auto-Attached Context |
|---------------|----------------------|----------------------|
| Feature Dashboard | `sfspeckit-specify` | `constitution.md` |
| Clarification Center | `sfspeckit-clarify` | `spec.md` |
| Architecture Viewer | `sfspeckit-plan` | `spec.md` + `plan.md` |
| Story Board | `sfspeckit-stories` | `plan.md` + story files |
| Test Dashboard | `sfspeckit-e2e` (main) | E2E schema reference |
| Story Test Generator | `sfspeckit-e2e-story` | Active story file |
| Visual Test Editor | `sfspeckit-e2e` | Current `.test.json` |
| RCA Triage | `sfspeckit-e2e-discover` | Failed test + error logs |
| Quality Scoring | `sfspeckit-score` | Feature code inventory |

## Implementation Steps

### Step 1: Create `client/src/shared/AIChatPanel.jsx`
- **Collapsible sidebar** (360px wide, slides in/out)
- **Toggle button** in the header (chat bubble icon)
- **Message list:** Scrollable, alternating user/AI bubbles
- **Input area:** Textarea with "Send" button and Enter-to-submit
- **Streaming indicator:** Animated dots while AI is responding
- **Context badge:** Shows which skill is active (e.g., "Using: sfspeckit-e2e-story")

### Step 2: Create `client/src/shared/ChatMessage.jsx`
Individual message bubble:
- **User messages:** Right-aligned, accent color background
- **AI messages:** Left-aligned, surface color background
- **Markdown rendering:** Support for code blocks, tables, lists, bold/italic
- **Code blocks:** Syntax highlighting + "Copy" button
- **Action buttons:** When AI suggests a file to create, show "Apply" button

### Step 3: Create `client/src/context/ChatContext.jsx`
React Context for chat state:
- `messages[]` — Chat history
- `activeSkill` — Current skill name (changes with screen navigation)
- `activeContext` — File contents attached to the prompt
- `isStreaming` — Whether AI is currently responding
- `sendMessage(text)` — Sends user message to gateway
- `clearChat()` — Resets conversation

### Step 4: Create Streaming Handler
When user sends a message:
1. Add user message to `messages[]`
2. Call `POST /api/chat` with `{ skill, message, featureId, context }`
3. Read the SSE/streaming response chunk by chunk
4. Append each chunk to the AI message in real-time
5. On completion, finalize the message

### Step 5: Context Auto-Detection
Hook into React Router to detect the current route:
- When route changes, update `activeSkill` and `activeContext`
- Show a subtle notification: "Context updated: now using sfspeckit-plan"

## Files Created

| File | Action |
|------|--------|
| `client/src/shared/AIChatPanel.jsx` | NEW |
| `client/src/shared/ChatMessage.jsx` | NEW |
| `client/src/context/ChatContext.jsx` | NEW |
| `client/src/shared/MarkdownRenderer.jsx` | NEW |

## Definition of Done

- [ ] Chat panel opens/closes smoothly without layout shift
- [ ] AI responses stream word-by-word in real-time
- [ ] Context changes automatically when navigating between screens
- [ ] Markdown renders correctly (especially code blocks and tables)
- [ ] Chat history is maintained within a session
- [ ] "Apply" button on AI-suggested code actually writes to the filesystem
