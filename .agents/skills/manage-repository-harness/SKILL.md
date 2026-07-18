---
name: manage-repository-harness
description: Translate casual natural-language requests into safe, traceable Easy Markdown repository work; manage requirements, work items, ADRs, documentation governance, quality gates, memoryless Agent handoffs, and standing Git automation. Use when exploring, proposing, accepting, planning, resuming, implementing, reviewing, validating, or handing off repository work; automatically handle safe branch, commit, push, PR, and protected merge stages for authorized implementation, and route explicit grilling requests or materially ambiguous high-impact decisions through the grilling skill before acting.
---

# Manage the Repository Harness

Use the repository as persistent memory. Let the user speak naturally while the Agent handles
classification, records, execution state, and evidence in the background.

## Treat Natural Language as the Interface

- Never require the user to mention REQ, WORK, ADR, a status value, or a template.
- Infer the requested mode from ordinary wording and context: explore, explain, diagnose, plan,
  change, review, resume, wait, or perform an explicitly named Git/release action.
- Read the repository and environment for discoverable facts before asking a question.
- Recover a matching active WORK and continue it when the user says “继续” or otherwise asks to
  resume; do not rely on chat memory.
- When the outcome and authority are clear, make reversible, low-risk assumptions and advance all
  safe in-scope steps. State any material assumption in the WORK or handoff.
- A clear instruction from an authorized owner can constitute acceptance of the described
  requirement without a magic word such as `accepted`. Record that interpretation and its evidence
  in the REQ; never turn an ambiguous product decision into acceptance yourself.
- Invoke [the Grilling skill](../grilling/SKILL.md) for explicit grill/stress-test requests or an
  unresolved high-impact product, architecture, security, data, migration, destructive-action, or
  authorization decision. Ask one decision at a time and do not implement until the user confirms
  the final shared understanding.

Natural-language authorization remains scoped to the requested outcome. A clear implementation
request invokes the repository's standing Git workflow for safe branch creation, checkpoint
commits, handoff pushes, Draft PR maintenance, and protected conditional merge; do not ask for each
stage again. A read-only request or explicit “do not commit/push” constraint does not invoke those
actions. Publish, release, deployment, tags, deletion, bulk migration, remote reconfiguration, and
history rewriting remain outside ordinary implementation authorization.

## Follow the Standing Git Workflow

Before any Git write, read
[git-workflow.md](../../../docs/harness/git-workflow.md) and apply its current gates. In summary:

1. For authorized implementation, automatically create the focused WORK branch from the exact
   verified base SHA, or resume it only after validating ancestry and its commit set. Use
   `codex/WORK-YYYY-NNN-<slug>` for Agent work.
2. Record base ref/SHA, owned paths, and each target path's initial state. A pre-modified, staged,
   or untracked file is wholly protected; use an isolated clean worktree or a provably Agent-only
   patch instead of staging its path. Never use broad staging to absorb user files or hunks.
3. Automatically commit a single-intent checkpoint only after the applicable diff, secret,
   abnormal-file, documentation, and quality checks pass. Link the WORK/REQ in the message.
4. Before any network access, enumerate every raw and Git-resolved fetch/push URL, configured
   `insteadOf`/`pushInsteadOf` rewrite, scheme, and multivalue endpoint; require every effective
   endpoint and rewrite to match the active machine policy. Then push at pause, handoff, or PR-ready
   points only when URLs and refspec match. Apply the strictest intersection of branch-point base, the
   current fetched protected tip, and candidate policy; governance or remote-execution paths require
   independent approval before push. Unreviewed branch CI must have no production secrets,
   privileged/write token, persisted credentials, or mutable external includes. Create or update one
   Draft PR after first push.
5. Move the PR to Ready only for a `done`, archived WORK after the delivery-ready gates.
   `abandoned` is a separate terminal state and must never become Ready or merge. Automatically
   Squash Merge only for
   trivial/standard changes when changed files, current CI, non-author approval, risk evidence,
   real `main` protection, and an atomic expected-head operation all match the exact head SHA.
   Significant/emergency changes require responsible-owner review and never auto-merge.
6. Record branch/upstream/HEAD, uncommitted state, last commit/push, PR/check/review state, skipped
   stages, and the next safe action in the WORK handoff.

Do not ask about facts discoverable from Git or the hosting platform. Wait or hand off while CI,
review, or a merge queue is pending. Ask one minimal decision only when the accepted outcome is
blocked by ambiguous file ownership, controlled data, abnormal files, a failed gate requiring an
exception, missing identity/trusted remote/credentials, an actual upstream non-fast-forward or
conflict, or absent protection requiring a user decision. Credentials and secrets are hard blocks,
never an “include anyway” choice. Never automatically force push, rewrite shared history, bypass
checks, release, deploy, tag, or change remotes/protection. A repository without a trusted initial
commit, exact base SHA, or active Git policy is bootstrap-limited: edit and validate, but do not
branch, commit, push, create a PR, or merge. If all three exist but the trusted remote is temporarily
unavailable, local branch/commit may continue; record push/PR/merge as `not-run`.

## Start Every Task

1. Locate the repository root.
2. Read [AGENTS.md](../../../AGENTS.md), [README.md](../../../README.md), and the relevant
   product, technical, requirement, work-item, and ADR files.
3. Inspect Git status and diff. Treat modified, staged, and untracked files as protected user
   work unless the task clearly owns them.
4. Search `docs/work/active/` for the same task. Resume an existing WORK instead of creating a
   duplicate.
5. Infer the user's requested mode, classify the change, and determine the smallest required
   records before editing.
6. For authorized implementation, apply the standing Git workflow and create/resume the focused
   branch when the repository has a trusted committed baseline, exact base SHA, and active policy.

Do not use chat history as the source of truth. If repository sources conflict, record the
conflict in the WORK and request a decision instead of silently choosing one.

## Classify the Change

| Class | Criteria | Required records |
| --- | --- | --- |
| Trivial | Typo, link, or small clarification with no behavior, contract, data, dependency, or architecture change | No REQ; create a lightweight `requirement: none` WORK before automatic commit/PR. A same-session, explicit local/no-Git edit may omit WORK |
| Standard | User-visible behavior, bug fix, test behavior, or multi-file implementation | Accepted/in-progress REQ and one active WORK |
| Significant | Architecture, runtime dependency, security boundary, data format, IPC, Git behavior, or repository governance | Standard records; add ADR when product architecture is affected |
| Emergency | Data loss, security exposure, or blocking failure | Create WORK first; complete REQ, evidence, and retrospective before merge |

Use [the detailed workflow](../../../docs/harness/development-workflow.md) when classification is
unclear. Prefer the lighter class only when the change truly cannot affect behavior or decisions.

## Create and Approve a Requirement

Run:

```text
node scripts/harness/new-requirement.mjs --title "Title" --type feature --owner "Owner"
```

Complete the generated REQ using the Definition of Ready in
[quality-gates.md](../../../docs/harness/quality-gates.md). Link existing FR/US/product documents;
do not duplicate them. Leave the status as `proposed` until an authorized product or project owner
accepts it. Their clear natural-language instruction can be acceptance when scope and authority are
unambiguous; record the wording or evidence in the decision log. An Agent may draft and challenge a
requirement but must not self-approve an ambiguous product decision.

## Plan or Resume Work

Create a WORK only when no matching active item exists:

```text
node scripts/harness/new-work-item.mjs --title "Title" --requirement REQ-YYYY-NNN --owner "Owner"
```

Before implementation, fill the context snapshot, protected user changes, scope, non-goals, plan,
acceptance mapping, and validation plan. Change the WORK status to `in-progress` when execution
starts. Update it after any scope change, important decision, blocker, validation result, or change
to the next action.

Keep REQ as the owner of “why and what,” WORK as the owner of “how and current state,” and product
or technical baselines as the owner of current system truth.

## Record a Decision

For a product architecture, dependency, security boundary, data format, IPC, or Git behavior
decision, run:

```text
node scripts/harness/new-adr.mjs --title "Decision title"
```

Keep the ADR `Proposed` during evaluation. Record options, trade-offs, security/data effects,
validation, and rollback. Mark it `Accepted` only after the responsible reviewers decide. Update the
technical baseline after acceptance. Repository-process-only choices belong in `docs/harness/` and
do not need a product architecture ADR.

## Validate, Hand Off, and Close

1. Map every acceptance criterion to implementation or evidence.
2. Run risk-proportionate tests and:

   ```text
   node scripts/harness/check-harness.mjs
   ```

3. Record exact commands, outcomes, skipped checks, and residual risk in the WORK.
4. Update product/technical baselines and ADRs for facts changed by the implementation.
5. Review the complete diff and exclude unrelated changes, secrets, debug files, and unresolved
   placeholders.
6. Write the handoff fields defined in
   [agent-handoff.md](../../../docs/harness/agent-handoff.md), even when the work is complete.
7. Choose exactly one terminal path:
   - For completed work, set status to `done`, archive it, then run the Harness check again against
     the archived state. Only this path may proceed toward Ready/merge.
   - For stopped work, record the reason, retained artifacts, unmet acceptance, residual risks, and
     follow-up owner; set status to `abandoned`, archive it, then run the Harness check again.
     Keep/close any remote handoff as Draft and never mark it Ready or merge it.

   Archive with:

   ```text
   node scripts/harness/archive-work-item.mjs --id WORK-YYYY-NNN
   ```
8. Apply the standing Git workflow after the post-archive Harness check. For `done`, create the final
   eligible checkpoint commit, push at the handoff point, update the Draft/Ready PR, and merge only
   when every protection gate is verified. For `abandoned`, preserve only the permitted terminal
   evidence and do not enter Ready/merge.

Never claim a test passed if it was not run. Never expand Git automation beyond the authorized
task's files and branch. Never automatically force push, rewrite shared history, bypass protection,
publish, release, deploy, tag, delete user data, or change remote configuration.
