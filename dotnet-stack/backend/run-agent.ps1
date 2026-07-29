# run-agent.ps1 — start the Wilderness Stays API with the Bedrock concierge ON.
#
# These env vars OVERRIDE appsettings.json at runtime (ASP.NET Core uses "__"
# for nested keys), so the committed file stays at Enabled=false and no secret
# or flag is committed. AWS credentials are picked up automatically from your
# `aws configure` profile — nothing to set here.
#
# Usage (PowerShell, from dotnet-stack/backend):
#   ./run-agent.ps1
#
# Prereqs: Docker Postgres up (docker ps -> wilderness_postgres_net on 5434),
# and the Anthropic model access form approved in the Bedrock console.

$env:Bedrock__Enabled = "true"

# Current Claude model (Haiku 4.5 — cheapest, supports tool use). Regional
# inference-profile id ("us." prefix), required for on-demand use.
# If rejected, list what your account can call:
#   aws bedrock list-inference-profiles --region us-east-1 --query "inferenceProfileSummaries[?contains(inferenceProfileId,'anthropic')].inferenceProfileId" --output text
$env:Bedrock__ModelId = "us.anthropic.claude-haiku-4-5-20251001-v1:0"

Write-Host "Starting API with concierge ENABLED (model: $($env:Bedrock__ModelId))" -ForegroundColor Green
dotnet run
