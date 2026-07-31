# MCP server (read-only) — setup & testing

This exposes Wilderness Stays lodge search to any **MCP client** (Claude Desktop, the MCP
Inspector, etc.) over HTTP. It's **read-only** — two tools, no auth, no bookings — so it's a
safe way to learn MCP. Booking tools (which need a signed-in user) come later.

Unlike the Bedrock agent, there is **no AI inside this server**. It just publishes what the app
can do; the AI lives in whatever client connects.

## What was added

- `backend/Mcp/LodgeMcpTools.cs` — the two tools (`search_lodges`, `get_lodge_details`),
  each wrapping the existing `HotelService`.
- `backend/WildernessStays.Api.csproj` — the `ModelContextProtocol.AspNetCore` package.
- `backend/Program.cs` — registers the MCP server and maps it at `/mcp`.

## Run it

Same as the normal .NET stack (the MCP package restores automatically from nuget.org):

```bash
docker compose up -d                       # Postgres + Redis
dotnet pack core -c Release -o local-packages   # skip if local-packages already has 1.3.0
cd backend
dotnet run                                 # API on http://localhost:3001, MCP at /mcp
```

The MCP endpoint is `http://localhost:3001/mcp`.

## Test it with the MCP Inspector

The Inspector is a free UI that connects to any MCP server and lets you click each tool.

```bash
npx @modelcontextprotocol/inspector
```

In the Inspector:

1. Set **Transport** to **Streamable HTTP**.
2. Set the URL to `http://localhost:3001/mcp` and click **Connect**.
3. Open the **Tools** tab → you should see `search_lodges` and `get_lodge_details`.
4. Run `search_lodges` with, say, `place = "Banff"` → you'll get a JSON list of lodges with ids.
5. Copy a `hotelId` into `get_lodge_details` to see that lodge's rooms.

## Connect Claude Desktop (optional)

Claude Desktop can connect to a remote/HTTP MCP server through its connector settings
(point it at `http://localhost:3001/mcp`). Once connected, you can ask Claude things like
"search Wilderness Stays for a lodge near Jasper" and it will call these tools directly.

## Security notes (before exposing beyond localhost)

- **Host validation.** The app currently uses `"AllowedHosts": "*"`. For anything past local
  dev, restrict it to your real host name(s) — MCP over HTTP is a browser-reachable endpoint,
  and loopback-only host validation guards against DNS-rebinding attacks.
- **CORS.** Only enable browser cross-origin access to `/mcp` if you specifically need it.
- **Read-only for now.** These tools can't change data, so there's no auth yet. When we add
  booking/cancel tools, they'll require the same JWT sign-in the rest of the API uses, and the
  MCP endpoint will need an auth layer.
