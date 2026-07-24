# AI Concierge (Amazon Bedrock) — setup

An action-taking concierge agent for the .NET stack. It understands free-text requests,
searches lodges, checks availability, and manages the signed-in guest's own bookings —
pausing for explicit confirmation before it books or cancels anything.

The agent is **off by default** (`Bedrock:Enabled = false`), so the app builds and runs
unchanged until you complete the steps below.

## What was added

Backend (`backend/`)
- `Agent/AgentContracts.cs` — request/response DTOs and `BedrockOptions`.
- `Agent/AgentTools.cs` — the six tools (schemas + execution) mapped onto `HotelService`
  and `BookingService`. `create_booking` and `cancel_booking` are marked **sensitive**.
- `Agent/BedrockConciergeService.cs` — the tool-use loop (Anthropic Messages format via
  Bedrock `InvokeModel`) plus the confirmation pause/resume.
- `Controllers/AgentController.cs` — `POST /api/agent/chat`, `[Authorize]`.
- `Program.cs`, `WildernessStays.Api.csproj`, `appsettings.json` — DI, package, config.

Frontend (`frontend/`)
- `src/components/AgentConcierge.jsx` — free-text chat with a confirm/decline card.
- `src/App.jsx` — mounts the concierge app-wide (bottom-left button).

## 1. AWS prerequisites

1. **Enable model access.** In the AWS console → **Bedrock → Model access**, request access
   to the Claude model you intend to use, in the region you'll call. Access is off by default.
2. **Pick a region + model id.** Set them in config (below). Model ids and regional
   availability change over time — confirm the exact id (and whether it needs an inference-profile
   prefix such as `us.`) in the Bedrock console for your region.
3. **Credentials.** The client uses the default AWS credential chain, in this order:
   - Local dev: environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
     `AWS_REGION`) or a shared profile (`~/.aws/credentials`).
   - Deployed on AWS: attach an **IAM role** to the compute (ECS task role, EC2 instance
     profile, etc.) — no static keys needed. This is the recommended production setup.
4. **IAM permissions.** The identity needs `bedrock:InvokeModel` on the model resource. Minimal policy:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Action": "bedrock:InvokeModel",
       "Resource": "arn:aws:bedrock:*::foundation-model/anthropic.*"
     }]
   }
   ```

## 2. Configure and enable

In `backend/appsettings.json` (or environment variables / user-secrets — keep secrets out of
source control):

```json
"Bedrock": {
  "Enabled": true,
  "Region": "us-east-1",
  "ModelId": "anthropic.claude-3-5-sonnet-20241022-v2:0",
  "MaxTokens": 1024,
  "MaxToolIterations": 6
}
```

Then restore the new package and run:

```bash
cd backend
dotnet add package AWSSDK.BedrockRuntime   # pins the latest patch (csproj already references it)
dotnet run
```

The frontend needs no config — it calls `/api/agent/chat` through the existing dev proxy.

## 3. Try it

Sign in (e.g. `guest@example.com` / `guest123`), open the **Concierge** button (bottom-left),
and try: *"Find a lodge near Banff under $500 for next weekend for 2 people, then book it."*
The agent will search, pick a room, and present a **confirmation card** with the estimated
total before anything is reserved.

## How the safety model works

- **Read tools** (`search_lodges`, `get_lodge_details`, `list_my_bookings`,
  `get_cancellation_quote`) run immediately.
- **Write tools** (`create_booking`, `cancel_booking`) never run from the model alone. The
  service detects them, returns `status: "needs_confirmation"` with a real cost/refund preview,
  and only executes after the guest approves in the UI. This is enforced in code, not just the
  prompt.
- **Scoped to the guest.** Every tool runs as the JWT user; `BookingService` re-checks
  availability, capacity and ownership, so the model's arguments can't exceed what that user
  could already do.
- **Bounded loop.** `MaxToolIterations` caps tool calls per turn.

## Notes / hardening ideas

- The confirm/resume state is round-tripped to the browser as an opaque base64 token for
  simplicity. Because the action still executes server-side with full validation, tampering
  can't exceed the user's permissions — but for production, prefer caching that state
  server-side (you already run Redis) keyed by a random id, and/or sign the token (HMAC with
  the existing JWT secret).
- Consider a per-user rate limit on `/api/agent/chat` and a spending/booking cap per session.
- Responses are non-streaming (`InvokeModel`). Switch to `InvokeModelWithResponseStream` (or the
  Bedrock **Converse** API) if you want token streaming or easy multi-model support.
