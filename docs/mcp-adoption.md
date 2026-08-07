# Adopt a workflow with n8n MCP

This path is designed for someone who wants to attach a template to Codex and
have the agent create a reviewed copy in their n8n development project.

## Attach the starter workflow

Attach:

`workflows/finance/invoice-exception-triage/workflow.json`

Then use this prompt:

```text
Use the official n8n skills and my connected n8n MCP server. Review the attached
workflow before creating anything. Explain its input contract, policy decisions,
security assumptions, and production extension points. Find my development
project, translate the template into current n8n Workflow SDK code, validate it,
create it as an unpublished workflow, fetch it again to verify every connection,
and prepare representative test data. Do not publish or run downstream side
effects. Tell me exactly what I must configure before testing.
```

## Expected agent sequence

1. Load the official n8n lifecycle, node configuration, expression, error
   handling, and credential skills.
2. Read the current Workflow SDK reference through MCP.
3. Discover current node types instead of relying on remembered parameters.
4. Translate the attached JSON into current SDK code.
5. Validate before creation.
6. Create the workflow as a draft in the development project.
7. Fetch the created workflow and verify the connection graph.
8. Prepare pinned test data and explain any real side effects before testing.
9. Leave publishing as an explicit human decision.

## Attach a different workflow

Use the same prompt with any `workflow.json` in the catalog. Include the companion
README so the agent receives the business context and ROI assumptions alongside
the technical workflow.
