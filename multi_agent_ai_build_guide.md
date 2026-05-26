
## Project Overview

Build a production-grade Multi-Agent AI System(Hive) where a Supervisor agent orchestrates
4 specialized worker agents (Researcher, Coder, Writer, Critic) to complete complex
tasks autonomously. Users give a natural language goal and watch agents collaborate
in real time via a live trace UI.

**Live demo will show:**
- User types: "Research the top AI frameworks in 2026 and write a blog post with code examples"
- System: Supervisor plans → Researcher searches web → Coder writes + runs code →
  Writer drafts post → Critic reviews → final polished output streamed to UI

**Stack:**
- Backend: Python 3.12, LangGraph 0.3, LangChain, FastAPI, Redis, PostgreSQL
- LLM: Claude claude-sonnet-4-20250514 via Anthropic API or any other api I am not sure about this right now
- Tools: Tavily (web search), E2B (code sandbox)
- Observability: LangSmith
- Frontend: Next.js 15, Tailwind CSS, shadcn/ui, WebSocket
- Deploy: Docker, Render (backend), Vercel (frontend)

---

## Folder Structure (build toward this)

```
hive/
├── backend/
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── state.py          # AgentState TypedDict
│   │   ├── supervisor.py     # Orchestrator agent
│   │   ├── researcher.py     # Web search agent
│   │   ├── coder.py          # Code execution agent
│   │   ├── writer.py         # Content generation agent
│   │   └── critic.py         # Quality review agent
│   ├── graph/
│   │   ├── __init__.py
│   │   └── builder.py        # LangGraph StateGraph assembly
│   ├── tools/
│   │   ├── __init__.py
│   │   ├── search.py         # Tavily web search tool
│   │   └── code_exec.py      # E2B sandbox tool
│   ├── memory/
│   │   ├── __init__.py
│   │   └── vector_store.py   # FAISS long-term memory
│   ├── api/
│   │   ├── __init__.py
│   │   ├── main.py           # FastAPI app entry point
│   │   ├── routes.py         # REST endpoints
│   │   └── websocket.py      # WebSocket streaming
│   ├── db/
│   │   ├── __init__.py
│   │   └── models.py         # SQLAlchemy models
│   ├── config.py             # Settings via pydantic-settings
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── app/
│   │   ├── page.tsx          # Main chat UI
│   │   ├── layout.tsx
│   │   └── history/
│   │       └── page.tsx      # Task history page
│   ├── components/
│   │   ├── TaskInput.tsx     # Goal input + preset templates
│   │   ├── TracePanel.tsx    # Live agent event stream
│   │   ├── OutputPanel.tsx   # Final rendered output
│   │   ├── HistorySidebar.tsx
│   │   └── AgentBadge.tsx    # Colored agent name chip
│   ├── lib/
│   │   ├── api.ts            # API client functions
│   │   └── websocket.ts      # WebSocket hook
│   ├── package.json
│   └── next.config.ts
├── docker-compose.yml
├── .github/
│   └── workflows/
│       └── deploy.yml
└── README.md
```

---

# PHASE 1 — Foundation (Days 1–4)

## Prompt to give your AI:

```
I am building a Multi-Agent AI System using Python, LangGraph, and the Anthropic API.
Help me set up Phase 1: the project foundation with a working single-agent graph.

Create the following files exactly as specified:

---

FILE: backend/requirements.txt
---
langgraph==0.3.*
langchain==0.3.*
langchain-anthropic
langchain-community
langsmith
fastapi
uvicorn[standard]
redis
psycopg2-binary
sqlalchemy
alembic
pydantic-settings
tavily-python
e2b-code-interpreter
faiss-cpu
python-dotenv
httpx

---

FILE: backend/config.py
---
Use pydantic-settings to load these env vars:
- ANTHROPIC_API_KEY
- TAVILY_API_KEY
- E2B_API_KEY
- LANGSMITH_API_KEY
- LANGSMITH_PROJECT (default: "multi-agent-system")
- REDIS_URL (default: "redis://localhost:6379")
- DATABASE_URL
- MODEL_NAME (default: "claude-sonnet-4-20250514")
- MAX_STEPS (default: 15)

Also call os.environ["LANGCHAIN_TRACING_V2"] = "true" and set the LangSmith vars
so every graph run is traced automatically.

---

FILE: backend/agents/state.py
---
Create an AgentState TypedDict with these fields:
- messages: Annotated[list, add_messages]   # LangGraph message reducer
- task: str                                  # Original user goal
- task_plan: list[str]                       # Supervisor's subtask list
- current_agent: str                         # Which agent is active
- agent_outputs: dict[str, str]              # Collected outputs per agent
- tool_calls: list[dict]                     # Log of every tool call made
- step_count: int                            # Incremented each graph step
- error_log: list[str]                       # Non-fatal errors
- final_output: str                          # Synthesized result
- run_id: str                                # UUID for this run
- status: str                                # "running" | "complete" | "error"

---

FILE: backend/tools/search.py
---
Create a LangChain tool called "web_search" using TavilySearchResults.
- max_results: 5
- Return results as a JSON string with keys: title, url, content, score
- Add a docstring explaining what the tool does (the LLM reads this)

---

FILE: backend/agents/researcher.py
---
Create a Researcher agent function that:
1. Takes AgentState as input
2. Uses Claude claude-sonnet-4-20250514 bound to [web_search] tool
3. System prompt: "You are a research specialist. Given a task, use web_search to
   find accurate, up-to-date information. Return a structured JSON with:
   { findings: [...], sources: [...], confidence: 0.0-1.0 }"
4. Returns state update: agent_outputs["researcher"] = result, step_count += 1,
   tool_calls updated with any tool calls made

---

FILE: backend/graph/builder.py
---
Create a minimal StateGraph with:
- State: AgentState
- One node: "researcher" → researcher function
- Edges: START → researcher → END
- Compile with MemorySaver checkpointer (for now)
- Export as: graph = builder.compile(checkpointer=MemorySaver())

---

FILE: backend/test_phase1.py
---
A simple test script (not pytest, just __main__) that:
1. Loads config
2. Creates a run_id with uuid4
3. Invokes the graph with task="What are the top 3 AI agent frameworks in 2026?"
4. Prints the final agent_outputs["researcher"]
5. Prints the LangSmith trace URL

Run this and confirm output before Phase 2.
```

---

# PHASE 2 — Supervisor + All Agents (Days 5–10)

## Prompt to give your AI:

```
Phase 1 is complete. I have a working single-agent graph. Now build Phase 2:
add the Supervisor and all 4 worker agents with full orchestration.

Current state of the project: [paste your current file tree here]

---

FILE: backend/agents/supervisor.py
---
Create a Supervisor agent that:
1. Takes AgentState as input
2. Uses Claude claude-sonnet-4-20250514 with no tools (pure reasoning)
3. System prompt:
   "You are an orchestrator. Given a user task, create a step-by-step plan and
   decide which specialist to call next. Specialists available:
   - researcher: finds information from the web
   - coder: writes and executes Python code
   - writer: produces structured long-form content
   - critic: reviews output quality and flags issues
   
   Return ONLY valid JSON in this format:
   { 
     'next_agent': 'researcher' | 'coder' | 'writer' | 'critic' | 'END',
     'task_plan': ['step1', 'step2', ...],
     'instruction': 'specific instruction for the next agent'
   }
   
   Return 'END' as next_agent when the task is fully complete."
4. Parse the JSON response
5. Return state update: current_agent = next_agent, task_plan updated if first call

---

FILE: backend/tools/code_exec.py
---
Create a LangChain tool called "execute_python" using E2B code interpreter:
- Takes Python code string as input
- Runs it in E2B sandbox
- Returns: { stdout: "...", stderr: "...", success: true/false }
- Timeout: 30 seconds
- Add error handling for sandbox connection failures

---

FILE: backend/agents/coder.py
---
Create a Coder agent that:
1. Takes AgentState as input
2. Uses Claude claude-sonnet-4-20250514 bound to [execute_python] tool
3. System prompt:
   "You are a software engineer. Write clean, working Python code for the given task.
   Always execute your code to verify it works. Return:
   { code: '...', output: '...', explanation: '...' }"
4. Gets instruction from state: state["agent_outputs"].get("supervisor_instruction", state["task"])
5. Returns state update with agent_outputs["coder"]

---

FILE: backend/agents/writer.py
---
Create a Writer agent that:
1. Takes AgentState as input
2. Uses Claude claude-sonnet-4-20250514 with no tools
3. System prompt:
   "You are a technical writer. Using the research and code provided, write
   high-quality, structured content. Format in clean markdown.
   Always include: introduction, main sections with headers, code blocks where
   relevant, and a conclusion."
4. Builds context from: agent_outputs["researcher"] + agent_outputs["coder"] (if exists)
5. Returns state update with agent_outputs["writer"]

---

FILE: backend/agents/critic.py
---
Create a Critic agent that:
1. Takes AgentState as input
2. Uses Claude claude-sonnet-4-20250514 with no tools
3. System prompt:
   "You are a quality reviewer. Compare the output against the original task.
   Return ONLY valid JSON:
   {
     'score': 1-10,
     'passed': true/false,
     'issues': ['issue1', 'issue2'],
     'suggestion': 'specific improvement instruction'
   }
   passed = true if score >= 7."
4. Evaluates agent_outputs["writer"] against state["task"]
5. Returns state update with agent_outputs["critic"]

---

FILE: backend/graph/builder.py (REWRITE)
---
Rebuild the graph with all agents and conditional routing:

Nodes: supervisor, researcher, coder, writer, critic

Routing logic (route_next function):
- Read state["current_agent"] set by supervisor
- Return the agent name, or END if current_agent == "END"

Edges:
- START → supervisor
- supervisor → route_next (conditional)
- researcher → supervisor (always return to supervisor after each worker)
- coder → supervisor
- writer → supervisor  
- critic → critic_gate (conditional)

critic_gate function:
- Read agent_outputs["critic"], parse JSON
- If passed == true → END
- If passed == false AND step_count < 2 retries → writer (loop)
- Else → END (force terminate)

Safety gate (add to every node):
- If step_count >= MAX_STEPS → force route to END

Compile with RedisCheckpointer using REDIS_URL from config.
Export: graph = compile_graph()

---

FILE: backend/test_phase2.py
---
Test the full multi-agent pipeline with:
task = "Research LangGraph vs CrewAI in 2026 and write a short technical comparison
with a Python code example showing a simple LangGraph graph"

Print each agent_output as agents complete.
Print final_output.
Print total step_count and token usage if available.
```

---

# PHASE 3 — FastAPI Backend + WebSocket (Days 11–15)

## Prompt to give your AI:

```
Phase 2 is complete. All agents work. Now build Phase 3: the FastAPI backend with
REST endpoints and WebSocket streaming so the frontend can connect.

---

FILE: backend/db/models.py
---
SQLAlchemy models:
- TaskRun table:
  - id: UUID primary key
  - task: Text
  - status: String (running/complete/error)
  - final_output: Text nullable
  - step_count: Integer default 0
  - token_cost_usd: Float nullable
  - created_at: DateTime default now
  - completed_at: DateTime nullable
  - trace_url: String nullable (LangSmith URL)

Include create_all() function and async session factory using DATABASE_URL.

---

FILE: backend/api/websocket.py
---
WebSocket manager class:
- ConnectionManager with dict of run_id → WebSocket connections
- connect(run_id, websocket) method
- disconnect(run_id) method  
- send_event(run_id, event: dict) async method

Event schema (all events must have these fields):
{
  "type": "agent_start" | "tool_call" | "tool_result" | "agent_end" | "complete" | "error",
  "agent": "supervisor" | "researcher" | "coder" | "writer" | "critic",
  "data": { ... type-specific payload ... },
  "step": int,
  "timestamp": ISO string
}

---

FILE: backend/api/routes.py
---
FastAPI router with these endpoints:

POST /api/runs
  Body: { "task": "string" }
  - Creates TaskRun in DB with status "running"
  - Launches graph.astream() in background task
  - Returns: { "run_id": "uuid", "status": "running" }

GET /api/runs/{run_id}
  - Returns TaskRun from DB as JSON

GET /api/runs
  - Returns last 20 TaskRuns ordered by created_at desc

POST /api/runs/{run_id}/interrupt
  Body: { "instruction": "string" }
  - Uses LangGraph interrupt to inject a human message into the running graph
  - Returns: { "status": "interrupted" }

DELETE /api/runs/{run_id}
  - Deletes TaskRun from DB

---

FILE: backend/api/main.py
---
FastAPI app setup:
- Import router from routes.py
- Add WebSocket endpoint: WS /ws/{run_id}
  - On connect: register with ConnectionManager
  - On disconnect: deregister
  - Keep alive (ping every 30s)
- Add CORS middleware: allow all origins in dev (restrict in prod)
- Add lifespan handler: create DB tables on startup
- Health check: GET /health → { "status": "ok" }

The background task that runs the graph must:
1. Call graph.astream(state, config={"configurable": {"thread_id": run_id}})
2. For each event in the stream:
   a. Parse the LangGraph event (node name, state delta)
   b. Map to WebSocket event schema
   c. Call manager.send_event(run_id, event)
3. On completion: update TaskRun in DB, set status="complete", final_output, completed_at
4. On exception: update status="error", send error event to WebSocket

---

FILE: backend/Dockerfile
---
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]

---

FILE: docker-compose.yml
---
Services:
- backend: build from ./backend, port 8000:8000, env_file .env,
  depends_on redis, postgres
- redis: redis:7-alpine, port 6379:6379
- postgres: postgres:16-alpine, port 5432:5432,
  env POSTGRES_DB=multiagent POSTGRES_USER=user POSTGRES_PASSWORD=password
  volume: pgdata

---

FILE: .env.example
---
ANTHROPIC_API_KEY=your_key_here
TAVILY_API_KEY=your_key_here
E2B_API_KEY=your_key_here
LANGSMITH_API_KEY=your_key_here
LANGSMITH_PROJECT=multi-agent-system
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://user:password@localhost:5432/multiagent
MODEL_NAME=claude-sonnet-4-20250514
MAX_STEPS=15

Test all endpoints with:
curl -X POST http://localhost:8000/api/runs -H "Content-Type: application/json" \
  -d '{"task": "Research what is LangGraph and write a 3 paragraph summary"}'

Then connect to WS: wscat -c ws://localhost:8000/ws/{run_id}
and watch events stream in real time.
```

---

# PHASE 4 — Next.js Frontend (Days 16–24)

## Prompt to give your AI:

```
Phase 3 is complete. Backend API and WebSocket are working. Now build Phase 4:
the Next.js 15 frontend with live agent trace UI.

Backend base URL: http://localhost:8000

---

Setup commands to run first:
npx create-next-app@latest frontend --typescript --tailwind --app --src-dir no
cd frontend
npx shadcn@latest init
npx shadcn@latest add button textarea badge card scroll-area separator toast

npm install react-markdown remark-gfm react-syntax-highlighter
npm install @types/react-syntax-highlighter
npm install lucide-react
npm install date-fns

---

FILE: frontend/lib/api.ts
---
Typed API client:
- createRun(task: string): Promise<{ run_id: string, status: string }>
  POST /api/runs
- getRun(runId: string): Promise<TaskRun>
  GET /api/runs/{run_id}
- getRuns(): Promise<TaskRun[]>
  GET /api/runs
- interruptRun(runId: string, instruction: string): Promise<void>
  POST /api/runs/{run_id}/interrupt

TypeScript types:
- TaskRun: { id, task, status, final_output, step_count, token_cost_usd, created_at }
- AgentEvent: { type, agent, data, step, timestamp }

---

FILE: frontend/lib/websocket.ts
---
Custom React hook: useAgentStream(runId: string | null)

Returns: { events: AgentEvent[], isConnected: boolean, isComplete: boolean }

Behavior:
- When runId is set, open WebSocket to ws://localhost:8000/ws/{runId}
- Append each incoming event to events array
- Set isConnected on open, false on close
- Set isComplete when event.type === "complete"
- Auto-reconnect once on unexpected disconnect (not on manual close)
- Clean up WebSocket on runId change or unmount

---

FILE: frontend/components/AgentBadge.tsx
---
Small colored chip showing agent name.
Color map:
- supervisor: purple (#534AB7 bg, white text)
- researcher: blue (#185FA5 bg, white text)
- coder: teal (#0F6E56 bg, white text)
- writer: amber (#854F0B bg, white text)
- critic: coral (#993C1D bg, white text)

Props: { agent: string, size?: "sm" | "md" }

---

FILE: frontend/components/TaskInput.tsx
---
Task input component:
- Large textarea (min 3 rows) with placeholder "Describe your goal in detail..."
- Preset template buttons (small, clickable chips):
  1. "Write a technical blog post about X"
  2. "Research and compare X vs Y"
  3. "Debug and explain this code: [paste here]"
  4. "Build a business plan for X"
- Submit button: "Run agents" with a play icon
- Disabled state when a run is in progress (show spinner)
- Props: { onSubmit: (task: string) => void, isRunning: boolean }

---

FILE: frontend/components/TracePanel.tsx
---
Live agent trace panel (right column):
- Header: "Agent trace" with live green dot when streaming
- Scrollable list of AgentEvent items, newest at bottom (auto-scroll)
- Each event renders as:
  - agent_start: "[AgentBadge] started" with timestamp
  - tool_call: "[AgentBadge] called tool_name" + collapsible args JSON
  - tool_result: "← result" in muted text, collapsible result JSON
  - agent_end: "[AgentBadge] finished" 
  - complete: green "✓ Complete in X steps" banner
  - error: red "✗ Error: message" banner
- Empty state: "Waiting for agents to start..."
- Props: { events: AgentEvent[], isConnected: boolean }

---

FILE: frontend/components/OutputPanel.tsx
---
Final output display (left column, below input):
- Shows nothing until an agent_end event for "writer" arrives
- Streams writer output as it arrives (render partial markdown)
- Uses react-markdown with remark-gfm for full markdown rendering
- Uses react-syntax-highlighter (dark theme) for code blocks
- "Copy output" button top-right
- Token cost display: "~$0.0XX" if available
- Props: { output: string, isStreaming: boolean, tokenCost?: number }

---

FILE: frontend/components/HistorySidebar.tsx
---
Left sidebar (collapsible on mobile):
- Header: "History"
- List of past TaskRuns from GET /api/runs
- Each item: truncated task text + status badge + time ago
- Click to load a past run (fetch its result and display in OutputPanel)
- Refresh button
- Props: { runs: TaskRun[], onSelect: (run: TaskRun) => void }

---

FILE: frontend/app/page.tsx
---
Main page layout — two column on desktop, stacked on mobile:

Left column (flex: 2):
- HistorySidebar (collapsible)
- TaskInput
- OutputPanel

Right column (flex: 1, sticky):
- TracePanel

State managed in this component:
- currentRunId: string | null
- currentOutput: string
- isRunning: boolean
- runs: TaskRun[]

Flow:
1. User submits task → call createRun(task) → set currentRunId
2. useAgentStream(currentRunId) starts receiving events
3. When event.agent === "writer" && event.type === "agent_end":
   extract output from event.data and set currentOutput
4. When isComplete: set isRunning = false, refresh runs list
5. Show pause button while isRunning — calls interruptRun with a user-typed instruction

---

FILE: frontend/next.config.ts
---
Set up API proxy so /api/* and /ws/* in dev forward to http://localhost:8000:
rewrites: [
  { source: '/api/:path*', destination: 'http://localhost:8000/api/:path*' },
  { source: '/ws/:path*', destination: 'http://localhost:8000/ws/:path*' }
]
```

---

# PHASE 5 — Deploy + Polish (Days 25–30)

## Prompt to give your AI:

```
Phase 4 is complete. The full app works locally. Now set up deployment and polish.

---

FILE: .github/workflows/deploy.yml
---
GitHub Actions workflow:
Trigger: push to main branch

Jobs:
1. test:
   - Python 3.12
   - pip install -r backend/requirements.txt
   - Run: python backend/test_phase2.py (or pytest if tests exist)

2. deploy-backend (needs: test):
   - Deploy to Render using Render Deploy Hook
   - Secret: RENDER_DEPLOY_HOOK_URL

3. deploy-frontend (needs: test):
   - Deploy to Vercel using Vercel CLI
   - Secrets: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID

---

FILE: README.md
---
Write a complete README with these sections:

## Multi-Agent AI System
One line: what it does and why it's interesting.

## Demo
[placeholder for Loom video link and live URL]

## Architecture
Describe the Supervisor → Worker pattern.
Include a simple ASCII diagram:

User Goal
    ↓
Supervisor (plans + routes)
    ├──→ Researcher (Tavily web search)
    ├──→ Coder (E2B Python sandbox)
    ├──→ Writer (structured markdown)
    └──→ Critic (quality gate, loops back)
    ↓
Final Output (streamed to UI)

## Tech Stack
List all technologies with one-line descriptions.

## Key Engineering Decisions
3-5 bullet points explaining WHY you made specific architectural choices.
Examples: why LangGraph over CrewAI, why Redis checkpointing, why separate
Critic loop, why WebSocket over polling.
(THIS IS WHAT INTERVIEWERS READ. Be specific.)

## Local Setup
Step by step:
1. Clone repo
2. cp .env.example .env and fill in keys
3. docker-compose up -d
4. cd frontend && npm install && npm run dev
5. Open http://localhost:3000

## Project Structure
Paste the folder tree from this document.

## What I Learned / Challenges
2-3 honest paragraphs about what was hard and how you solved it.
Interviewers value this more than a polished feature list.

---

FINAL CHECKLIST before publishing:

[ ] All env vars are in .env.example with placeholder values (never commit real keys)
[ ] .env is in .gitignore
[ ] docker-compose up runs with zero manual steps
[ ] Live demo URL works and doesn't crash on the preset templates
[ ] LangSmith dashboard shows traces for every run
[ ] GitHub repo is public
[ ] Record a 2-minute Loom: type a task → watch agents work → show final output
[ ] Post the Loom link on LinkedIn with 3 lines about what you built
[ ] Add project to resume under Projects with: tech stack, what it does, GitHub link
```

---

# Interview Talking Points

When asked about this project in interviews, answer these:

**"Walk me through your architecture."**
"I used a Supervisor pattern with LangGraph. The Supervisor receives the user goal,
breaks it into a task plan, and routes to specialized workers — Researcher, Coder,
Writer, and Critic. Each worker has narrow responsibility and returns control to the
Supervisor. The Critic creates a quality gate that can loop the Writer for up to 2
retries before the graph terminates."

**"Why LangGraph over AutoGPT or CrewAI?"**
"LangGraph treats state as a first-class citizen with typed TypedDict schemas and
Redis checkpointing. CrewAI is good for quick prototypes but gives you less control
over the execution graph. AutoGPT has no structured state. In production you need
to be able to pause, resume, and debug specific graph states — LangGraph's
checkpointing and LangSmith tracing make that possible."

**"How did you handle failures and infinite loops?"**
"Three layers: a step counter guardrail that hard-terminates at 15 steps, a Critic
retry budget of max 2 loops, and Redis-backed checkpointing so a server restart
doesn't lose mid-run state. Each agent also has error handling that writes to
error_log in state rather than crashing the graph."

**"What was the hardest part?"**
"State schema design. Once you have 10 nodes reading and writing the same
AgentState TypedDict, any schema change breaks LangGraph's type checking on
checkpointed state. I learned to design the schema carefully upfront instead of
evolving it ad-hoc."

**"How does the real-time UI work?"**
"FastAPI's WebSocket endpoint subscribes to LangGraph's .astream() generator.
Each graph node event gets mapped to a typed event schema and pushed to the
connected browser via WebSocket. The frontend accumulates these events in a React
state array and renders them as a live trace log."

---

# Key API Keys You Need

| Service | Get it at | Free tier |
|---------|-----------|-----------|
| Anthropic | console.anthropic.com | $5 credit |
| Tavily | tavily.com | 1000 searches/month |
| E2B | e2b.dev | 100 hours/month |
| LangSmith | smith.langchain.com | Free for personal |

---

*Built following 2026 production multi-agent architecture standards.
LangGraph 0.3 | Claude claude-sonnet-4-20250514 | FastAPI | Next.js 15*
