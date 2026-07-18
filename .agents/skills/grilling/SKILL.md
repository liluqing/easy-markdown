---
name: grilling
description: Grill the user one decision at a time about a plan, decision, idea, or materially ambiguous high-impact request until shared understanding is confirmed. Use when the user explicitly asks to be grilled, interviewed, challenged, or stress-tested, uses a grill trigger phrase, or when unresolved product, architecture, security, data, migration, destructive-action, or authorization decisions would materially change a repository task. Do not use for facts discoverable from the environment or low-risk reversible defaults.
---

# Grilling

Resolve a decision tree with the user before acting. Investigate facts yourself, ask only for
decisions the user owns, and do not implement the resulting plan until the user confirms the final
shared understanding.

## Decide Whether to Grill

Use this workflow when at least one of these conditions applies:

- The user explicitly asks to be grilled, interviewed, challenged, or stress-tested.
- Multiple reasonable interpretations would materially change the product outcome or work scope.
- The unresolved choice concerns product direction, architecture, dependencies, security, privacy,
  data format, migration, destructive actions, or authorization.
- A hidden assumption or contradiction could make the proposed plan unsafe or invalid.

Do not start Grilling merely because a request is informal or incomplete. Do not ask about facts
that can be discovered from the repository, environment, tools, or existing records. For a clear,
low-risk request, use a reversible reasonable default and continue through the normal repository
workflow.

## Prepare Before Asking

1. Read the relevant repository and environment state using read-only actions.
2. Separate what is known into:
   - verified facts;
   - reversible working assumptions;
   - decisions only the user can authorize or choose.
3. Build an internal dependency order for the unresolved decisions. Start with the choice whose
   answer eliminates or changes the most downstream branches.
4. Do not expose Harness terminology or ask the user to fill a template unless they request it.

## Run the Interview

Repeat this loop until the decision tree is resolved:

1. Ask exactly one unresolved decision question.
2. Lead with the recommended answer and one concise reason.
3. When useful, offer two or three mutually exclusive choices with their material trade-offs.
4. Wait for the user's response before asking the next question.
5. Update the decision tree from that answer and follow only the applicable branch.
6. Respectfully surface contradictions, missing authority, and risky assumptions instead of
   silently resolving them.

Use this compact form:

```text
推荐：<recommended decision and why>

问题：<one decision for the user>

选项（仅在有帮助时）：<two or three choices and trade-offs>
```

Never bundle several decisions into one message, even when they are related. A request for “all
details” changes the depth of the interview, not the one-question rule.

## Hold the Action Boundary

During Grilling, read-only investigation is allowed. Do not modify repository files, execute the
target operation, create Git history, contact external systems, or otherwise act on the emerging
plan. Do not treat agreement with one intermediate answer as approval of the full plan.

If the user asks to stop, summarize the decisions made and the unresolved branches. Do not perform
work that depends on an unresolved choice.

## Confirm Shared Understanding

When no material decision remains:

1. Summarize the agreed goal, target users, scope, non-goals, major decisions, acceptance signals,
   risks, unresolved items, and action authorization.
2. Ask one final question: whether this summary is the shared understanding and implementation may
   begin.
3. Wait for explicit confirmation.
4. Only after confirmation, exit Grilling and hand the agreed result to the repository Harness for
   requirement/work-item recording and execution.

If the user changes a material decision during confirmation, reopen only the affected branch and
continue one question at a time.
