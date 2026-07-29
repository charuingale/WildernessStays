#!/usr/bin/env bash
# run-agent.sh — start the Wilderness Stays API with the Bedrock concierge ON.
# (bash / Git Bash version of run-agent.ps1)
#
# These env vars OVERRIDE appsettings.json at runtime (ASP.NET Core uses "__"
# for nested keys), so the committed file stays at Enabled=false. AWS creds are
# picked up automatically from your `aws configure` profile.
#
# Usage (from dotnet-stack/backend):   bash run-agent.sh   (or ./run-agent.sh)
#
# Prereqs: Docker Postgres up (docker ps -> wilderness_postgres_net on 5434),
# and the Anthropic model-access form approved in the Bedrock console.

export Bedrock__Enabled=true

# Current Claude model (Haiku 4.5 — cheapest, supports tool use). This is a
# regional inference-profile id (the "us." prefix), which Bedrock requires for
# on-demand use of current Claude models.
# If this id is ever rejected, list what YOUR account can call with:
#   aws bedrock list-inference-profiles --region us-east-1 \
#     --query "inferenceProfileSummaries[?contains(inferenceProfileId,'anthropic')].inferenceProfileId" \
#     --output text
export Bedrock__ModelId="us.anthropic.claude-haiku-4-5-20251001-v1:0"

echo "Starting API with concierge ENABLED (model: $Bedrock__ModelId)"
dotnet run
