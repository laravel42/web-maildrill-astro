---
name: orquestador-subagentes
description: SERIAL subagent orchestration protocol over a shared repository - one subagent at a time, one commit per task, minimal context, no deleting other agents' work, and an orchestrator verification gate between task and task. Use this skill ALWAYS when you are about to delegate work to subagents, workers, "child agents" or parallel tasks over code, or when the user talks about orchestrating, coordinating, dividing or splitting work between multiple agents, a multi-agent pipeline, or about agents "stepping on each other", breaking each other's work, causing conflicts, or leaving the repo broken. Also triggers when planning a large task that you intended to split into delegable subtasks, even if the user does not say the word "subagent".
---

# Serial subagent orchestration

Protocol for coordinating subagents that write to the same repository or
workspace, without destroying each other's work.

This file is self-contained and model-agnostic: it works as a skill, as the
orchestrator's system instruction, or as a document to paste into the prompt.
It assumes no particular tool or provider.

---

## Where this file lives

A skill that isn't installed doesn't trigger: you'd have to paste it by hand
every time, which is exactly what you don't want. Possible locations, from
most to least recommended:

- **`.claude/skills/orquestador-subagentes/SKILL.md`, inside the repository.**
  This is the default choice for team work: it goes into version control, gets
  reviewed like any other file, and reaches everyone and remote sessions with
  a plain `git pull`.
- **`~/.claude/skills/orquestador-subagentes/SKILL.md`**, if you want it in
  every one of your projects and only for yourself.

The folder name must match the `name:` in the header. After installing it,
confirm it shows up in the list of available skills: if it doesn't show up,
it doesn't exist, no matter how much the file is sitting on disk.

---

## The 5 hard rules

If you read nothing else, read this. These rules are not negotiated, not
optimized, and admit no exceptions the model decides on its own.

1. **One subagent at a time.** There are never two subagents active
   simultaneously. Never.
2. **One commit per task.** The working tree is clean and committed before
   launching the next subagent.
3. **The subagent does not delete.** It does not remove files, history, or
   changes it did not create itself in this task.
4. **The subagent does not go outside its scope.** It only touches what the
   orchestrator told it to. Anything else it reports, it does not fix.
5. **The orchestrator does not do the work, but it does verify.** It does not
   write product code; it does run the verification gate between task and
   task.

---

## First things first: does this even need orchestrating?

The protocol has a fixed cost — writing the handoff, waiting, running the
gate, updating the log — and it's paid out of the exact resource this skill
calls scarce: the orchestrator's context. For a small change, orchestrating
costs more than just doing it.

**Do not orchestrate** when the work is an obvious change in one or two files
that fits in a single head. Do it directly, with its own commit and its own
tests.

**Orchestrate** when any of these hold:

- three or more tasks come out of it with real dependencies between them;
- there are shared contracts (types, schemas, public signatures) that one task
  defines and another consumes;
- the work is long enough that the orchestrator's context would degrade or get
  compacted before finishing;
- you've already seen two agents step on each other in this repository.

At the borderline, orchestrate: the cost of doing it unnecessarily is one
extra handoff round; the cost of not doing it is lost work. What's never
acceptable is deciding the exception on the fly because it seems faster in the
moment; if you think a case deserves one, ask the person you're working with.

---

## Why this exists (read before improvising)

The classic failure of a multi-agent orchestration is not that a subagent does
its task badly: it's that **two subagents working at the same time destroy
each other's work**, and the damage is invisible until much later.

It happens even when tasks "touch different files", because the workspace
shares more than it seems:

- git's index and `HEAD` (one agent's `add`/`commit`/`checkout` captures or
  discards the other's half-written changes);
- lockfiles, `node_modules`, virtual environments, build caches, generated
  artifacts;
- config files, migrations, export barrels/indexes, routes, shared schemas and
  types;
- the disk itself: two processes rewriting the same file — the last one wins
  and the other change disappears without an error.

When that happens there is no conflict message. Code is simply missing, and
since the final commit is huge and mixes two tasks, there is no longer any way
to know what was lost or to revert it without losing the good part.
Serializing costs wall-clock time; losing work costs the entire session.
**Serialize.**

The second most expensive failure is uncommitted work. A change that only
lives in the working tree is not protected: any later git operation, any
careless subagent, and any cleanup will sweep it away. **Uncommitted work is
unprotected work.**

### Serializing isn't the only answer: isolating exists too

Everything above holds **given a single shared working tree**. That's a
property of the setup, not a law of nature. If each subagent works in its own
git worktree, its own clone, or its own container, it doesn't share the index,
`HEAD`, or disk, and parallelism stops destroying work.

What isolation costs:

- you have to merge at the end, and conflicts come back — but they come back
  **visible**, as git conflicts someone resolves, instead of as code that
  disappears without warning;
- every worktree needs its own dependencies installed, which for large
  projects isn't free in time or disk space;
- verifying stops being a single `git status`: there are as many states as
  there are worktrees.

**The default is still serial**, because it's the setup that needs no prep and
because the verification gate is much simpler with a single tree. But if
you're really about to launch a lot of genuinely parallel work, the right
answer is to isolate, not to speed up the series. If you do, each isolated
branch still needs its own contract, its own gate, and its own commit per
task: the only thing that changes is that there are several series at once,
not that the protocol disappears.

---

## The orchestrator's role

The orchestrator is a coordinator, not an implementer. Its scarce resource is
its own context: if it gets dirty implementing, it loses the plan and the
session degrades exactly when judgment is needed most.

**It does:**
- break the goal down into serial tasks and order them by dependency;
- write each subagent's handoff with minimal context;
- launch a subagent, wait, read its report;
- run the verification gate (read-only commands, tests, `git status`,
  `git diff`);
- commit or revert when the gate requires it;
- keep the log;
- decide whether to continue, correct, or stop and ask the user.

**It does not do:**
- write or edit product code, not even "one quick line";
- expand a task's scope midway through;
- read the entire repository "for context";
- launch the next subagent without having closed the previous one.

If something needs fixing, launch a corrective subagent with a narrow scope.
The only surgery the orchestrator performs directly is git surgery
(committing what's in scope, reverting a bad commit) and log bookkeeping.

**Contract decisions are not delegated.** Choosing the shape of a public
signature, the name of a field, whether something gets resolved server-side or
client-side: the orchestrator decides that, and it travels written into the
handoff. A subagent that has to invent the contract will invent a different
one than what the next task expects, and the collision shows up two tasks
later.

---

## Cycle per task

Repeat this full cycle, one task at a time, until done.

### 0. Setup (once, at the start)

- Detect and note in the log the project's real commands: build, test, lint,
  typecheck. They get reused identically at every gate; rediscovering them
  each time produces inconsistent verifications.
- **Check what each command actually covers.** A `typecheck` that only looks
  at one folder doesn't protect the rest, and a gate that runs it over the
  rest of the repository is calling something green that it never looked at.
  Note the real coverage, not just the command's name.
- Record the **baseline**: the current commit (`git rev-parse HEAD`) and
  what's already red before starting. Without this, a failure that already
  existed ends up being blamed on a subagent.
- **Save the NAMES of what's red, not just the count.** "Same or better than
  the baseline" compared by counters is falsifiable: three reds before and
  three reds after passes the check even if they're three different reds,
  which is a perfect regression in disguise. With the names, a new red stands
  out.
- Confirm the working branch. Do not switch branches mid-chain.

### 1. Decompose

Each task must be the smallest unit that leaves the repository in a
committable state. Criteria:

- a single verifiable deliverable;
- scope expressible as an explicit list of files or folders;
- when done, the project builds / tests pass the same as or better than the
  baseline;
- if two tasks need to touch the same file, **they are not two tasks**: they
  are one, or they are two but strictly ordered.

Order by real dependency: contracts, types, and schemas first; consumers
after.

**A task with no verification command is not a task.** If you can't write
down what gets run to know it went well, it isn't defined well enough to
delegate. That usually means it's missing its own tests within scope, not that
it needs to be verified "by eye" afterward.

### 2. Prior snapshot

Before launching: note `HEAD` and confirm `git status` is clean. If there are
loose changes from a previous step, resolve them now (commit if in scope, or
stop and ask). Never start a subagent on a dirty tree.

### 3. Handoff

Send the subagent exactly this structure, with the contract of rules pasted
at the end (see below):

```
TASK: <short id> — <goal in one sentence, single deliverable>

SCOPE (you may only modify these files/paths):
- <path 1>
- <path 2>

OUT OF SCOPE (do not touch, even if it seems necessary):
- <what's already done, what another task will do, everything else>

NEEDED CONTEXT:
- <invariants, conventions, function signatures or contracts it must respect>
- <contract decisions already made, with a one-line reason for each>
- <files it can READ to orient itself: paths, not pasted contents>
- <what the environment does NOT allow: no network, no database, no credentials>

DONE WHEN:
- <verifiable criterion 1>
- <verifiable criterion 2>
- <verification command that must pass, with the exact baseline number>

COMMIT: when done, commit on branch <branch> with message "<type>(<id>): <summary>"

[SUBAGENT CONTRACT — paste in full]
```

Two details that save a whole extra round:

- **State the environment's limits.** If there's no network, if the database
  doesn't exist, if a credential is missing: write it down. A subagent that
  discovers it midway improvises, and what it improvises is usually pretending
  it worked.
- **Give the exact baseline number** ("there are currently 421 tests across 21
  files, all green"). That way the subagent can verify for itself that it
  broke nothing, instead of reporting "tests pass" without knowing how many
  passed before.

### 4. Execution

Launch **one** subagent. Wait for it to finish. Do not launch anything else
while it's active: not another implementer, not a "research agent in
parallel", not an early reviewer.

**While a subagent is active, the working tree belongs to it.** The
orchestrator does not touch it, and doesn't let anything else touch it either.
This matters because there are automations that will ask to: a hook that
warns about uncommitted changes, a formatter on save, a watcher, a scheduled
task. The answer to all of them, while the subagent is working, is **no**:
committing its half-written edit splits its work into two commits, one of
them unverified and neither individually revertible. It is exactly the
failure this skill exists to prevent, just dressed up as a best practice.

If a warning like that shows up, check it without modifying anything
(`git status`, `git log`) and respond with the real state: what's uncommitted,
whose it is, and that the verified work is already safe.

### 5. Report

Require the subagent to give a short, structured report (format in the
contract). The report is information, not verification.

### 6. Verification gate

**Mandatory before launching the next subagent.** The orchestrator runs the
commands itself; it does not accept the subagent's "it's done, everything
works". A subagent that broke something almost never knows it broke it.

Minimum checklist:

- [ ] `git status` — clean tree (or only known ignorable artifacts).
- [ ] `git log` — the task's commit exists, on the right branch.
- [ ] `git diff <previous_HEAD>..HEAD --stat` — the touched files are within
      the declared scope. Any file outside the list is a violation, even if
      the change looks good.
- [ ] `git diff <previous_HEAD>..HEAD --diff-filter=D` — nothing unauthorized
      was deleted.
- [ ] Prior history is intact: `previous_HEAD` is still an ancestor of `HEAD`
      (no amend, rebase, or reset over what was already done).
- [ ] Build / tests / lint: no new red compared to the baseline's NAMES.
- [ ] If the diff changed a shared contract (type, schema, public signature),
      check that existing consumers still compile.

And one step that is not mechanical and that none of the above substitutes
for:

- [ ] **Read the diff of the tests.** If the commit touches a test file that
      already existed, look at what changed there BEFORE calling the gate
      good.

This last one pays off the most, because a subagent's most common failure
sails right through the rest of the list unnoticed: **adjusting a test's
assertion so it passes, instead of fixing the code**. That produces a green
commit, within scope, with nothing deleted and history intact. It's a
regression, and the mechanical gate lets it through.

How to check it without burning context: `--numstat` on the test paths. A new
file shows up as `N 0` — pure addition, no prior assertion touched — and
there's nothing to read there. If there are deleted lines, read **that** diff
and confirm what changed are comments or assertions that the new contract
made literally obsolete, not an expectation lowered until it passed.

**When the task adds tests, check that they bite.** A new, green test file
proves nothing by itself: it might just be checking its own reflection.
Temporarily undo the product change — a backup copy, or
`git show <previous_HEAD>:<file>` — rerun just those tests, and confirm they
go red. Restore afterward and verify the tree ended up identical (`sha256sum`,
`git status`). It costs a minute and it's the only real proof that the new
coverage is real.

Possible outcomes:

- **Passes** → note in the log (id, scope, commit, green) and continue.
- **Work was left uncommitted but within scope** → the orchestrator commits
  and continues. This is closing out, not "extra work".
- **Changes outside scope** → separate: commit what was in scope, revert the
  rest, and note what was found as a future task.
- **It broke something** → see "When something goes wrong".

---

## The subagent contract

Block to paste literally into every handoff. It's written so any model can
understand it, without tool-specific jargon. Translate it if the subagent
operates in another language, but do not summarize it.

```
RULES FOR THIS TASK (mandatory, they take priority over your judgment):

1. SCOPE. Modify only the files listed in SCOPE. If you think something else
   needs touching, do NOT touch it: finish what you can and report it. A
   correct fix outside scope is still an error, because nobody is reviewing
   it and it can collide with another task.

2. YOU DO NOT DELETE. It is forbidden to:
   - remove files, functions, tests, or config you did not create yourself in
     this task;
   - `git reset --hard`, `git checkout -- .`, `git restore .`, `git clean -fd`,
     `git stash drop/clear`;
   - `git commit --amend`, `git rebase`, `git push --force`;
   - rewrite an entire file when a targeted edit would do (that silently
     deletes code you didn't understand);
   - reformat, reorder imports, or "clean up" files on your own initiative;
   - destructive data operations (drop/truncate, rewriting already-applied
     migrations, overwriting the user's data files).
   If the work REQUIRES deleting something, do not delete it: report it and
   stop there.

3. YOU DO NOT EXPAND SCOPE. Do not refactor along the way, do not update
   dependencies, do not fix bugs you happen to find, do not add unrequested
   improvements. Note them under FINDINGS.

4. COMMIT. When you finish, leave the tree clean: commit your work on the
   indicated branch. One commit per task. No force push, do not touch prior
   commits. If you cannot leave it working, still make a commit marked
   `wip(<id>):` and say so in the report — never leave uncommitted changes.

5. YOU DO NOT LAUNCH SUBAGENTS. You execute the task; you do not delegate or
   open parallel work.

6. IF YOU GET BLOCKED, YOU STOP. In the face of ambiguity, a missing contract,
   or anything that contradicts these rules: stop and report. Do not guess,
   do not improvise a redesign.

7. YOU DO NOT CHANGE AN EXISTING TEST TO MAKE IT PASS. If a baseline test goes
   red because of your change, the fix goes in your code, not in the
   assertion. You may ADD cases. You may modify an existing assertion only if
   the contract change makes it literally obsolete, and in that case say so
   explicitly in the report, with the before and the after.

8. YOU DO NOT FAKE RESULTS. Any number, measurement, or output you did not
   obtain by actually running something must NOT be written as if you had. If
   you couldn't run something — no network, a missing credential, the service
   doesn't exist — say so in VERIFICATION in those words. A report that says
   "I couldn't measure this" is useful; one with invented figures poisons
   every decision made after it. If what you deliver produces output for a
   person, that output also has to distinguish what was measured from what
   was simulated.

FINAL REPORT (reply with exactly these sections, brief):
- DONE: what was finished, in one or two sentences.
- FILES: list of modified/created files.
- COMMIT: hash and message.
- VERIFICATION: commands you ran and their literal result. State explicitly
  what you could NOT run and why.
- FINDINGS: problems seen out of scope and NOT touched.
- BLOCKERS: what you couldn't do and why.
```

---

## What information to pass, and what not to

Passing extra context is not free: it dilutes the instruction, drags in old
ideas already discarded, and is the usual cause of a subagent going out of
scope "because it read it in the history". The goal is for the subagent to
have just enough to decide well and nothing that invites it to wander.

**Pass:**
- goal, scope, and out-of-scope;
- invariants and conventions it must respect (naming, layers, error style,
  public contracts);
- exact signatures/types it must fit;
- contract decisions already made, with a one-line reason for each;
- the environment's limits (no network, no database, no credentials);
- **paths** of relevant files so it can read them itself if needed;
- the done criterion and the verification command, with the baseline number.

**Do not pass:**
- the conversation history with the user;
- discarded decisions, already-closed design debates;
- the full repository tree or long dumps of code it can read on its own;
- full reports from previous subagents (one line is enough: "task T3 already
  left `authClient` with this contract: …");
- the entire global plan. Each subagent needs its task, not the roadmap.

Practical rule: if you can't explain why a piece of data changes what the
subagent is going to do, don't include it.

---

## Commits

- **One per task.** The commit is the point of return; without it, one error
  forces you to undo the good work too.
- Message that identifies the task: `feat(T4): session validation`,
  `fix(T7): …`, `wip(T9): …`.
- No `--amend`, no rebase, no force-push over what's already closed. Linear,
  stable history is what makes the gate verifiable.
- Generated artifacts (builds, dependencies, cache) are not committed; if they
  dirty `git status`, add them to `.gitignore` as its own task, not in
  passing. In the meantime, note in the log which ones are known ignorables,
  or the gate will never be able to demand a clean tree.
- **The push is done by the orchestrator, after the gate.** Never the
  subagent, and never before verifying: a bad commit that's still local gets
  reverted without anyone noticing; a published one doesn't.

**When the task can't yield a green commit:** it happens — a large change
that only compiles at the end, a two-step migration. In that case:

1. commit `wip(<id>):` anyway, to protect the work;
2. note in the log that the chain is red and which task closes it;
3. do not interleave unrelated tasks in the middle of a red chain;
4. if the chain can be isolated, do it on its own branch and merge it once
   green.

**Cap: two red tasks in a row.** If by the third the chain still can't show a
green commit, stop and re-plan. A long red chain has no verified points of
return: it is exactly the state this skill is trying to get out of, just built
up slowly.

What is never acceptable is moving on to the next task with uncommitted
changes in the tree.

---

## When something goes wrong

Diagnose first: compare `HEAD` against the prior snapshot. The commit-per-task
discipline keeps the response always bounded.

- **The subagent broke something** → `git revert <commit>` and relaunch the
  task with a narrower scope and a contract more explicit about what failed.
  On a working branch that hasn't gone out anywhere yet and whose bad commit
  is the latest one, moving the branch back to the previous commit also works
  and leaves cleaner history; as soon as there are commits on top of it, or
  the branch is published, revert and nothing else.
- **It touched files outside scope** → revert that commit, and relaunch,
  splitting: one task for what was in scope, another (later) for what was
  found.
- **It deleted something** → recover from the previous commit. Log the
  incident: if it repeats, the contract isn't being pasted in full.
- **Two tasks conflict** → a sign the decomposition was wrong. Re-split the
  work, do not force the merge.
- **The subagent says there was nothing to do** → that's not a failure, and
  neither is the lack of a commit. Verify yourself that it was indeed already
  done, note it in the log, and move on. What's not acceptable is taking it at
  face value without checking.
- **Something broke and it's unclear which commit caused it** → stop. Do not
  launch more subagents onto a state that isn't understood; ask the user for
  help.

Stopping rule: two consecutive failures on the same task mean the problem is
the plan, not the subagent. Stop and re-plan with the user.

---

## Log

The orchestrator's context degrades or gets compacted in long sessions. The
log is the real state of the orchestration, outside the context window.

Plain file (e.g. `.orquestacion/bitacora.md`), one line per task:

```
T1 | session types           | src/types/auth.ts            | a1b2c3d | green
T2 | auth client             | src/lib/authClient.ts        | e4f5g6h | green
T3 | route guard             | src/middleware.ts            | —       | reverted: touched src/app/
T4 | route guard (retry)     | src/middleware.ts            | i7j8k9l | green
```

At the very top: branch, the project's verification commands **with what each
one actually covers**, the baseline with the names of what was already red,
and the contract decisions made by the orchestrator.

### Findings need a place of their own

The contract requires the subagent to report what it saw and did not touch.
If that stays only in the report, it gets lost: the report lives in context
and context gets compacted. Keep them **numbered** at the end of the log,
each one with what it is, where it is, and why it wasn't touched:

```
H1 — routes/search.js ignores `sort`. Fixed by T2.
H2 — the typecheck doesn't cover server/. Outside this chain; affects the
     whole repo.
H3 — parsing depends on fixed column positions. Next fragile spot.
```

A number lets you reference a finding in a commit, in a later task, or in the
handoff to the next session without describing it all over again. And it
makes visible when a finding has survived three chains without anyone picking
it up, which is information about the project, not about the orchestration.

**Verify findings before propagating them.** A report can exaggerate or get
the cause wrong. If the finding can be checked in a minute, check it and note
what you measured: a poorly copied finding turns into the spec for a future
task, and by then it costs a lot more to fix.

When resuming a session, read the log before anything else.

---

## Anti-patterns

Mistakes this protocol exists to prevent. If you catch yourself reasoning like
this, the conclusion is wrong.

- *"These are different files, I can launch them in parallel."* They aren't:
  they share git's index, lockfiles, artifacts, and contracts. This is exactly
  the case that destroys work.
- *"It's just a read-only subagent, it doesn't write anything."* Read-only
  agents install dependencies, run builds, and touch the index more than you'd
  think. If a case seems to warrant an exception, ask the user; don't decide
  it yourself.
- *"I'll pass all the context just in case."* It dilutes the task and causes
  out-of-scope changes.
- *"I'll commit everything together at the end."* Leaves the orchestration
  with no points of return.
- *"I'll just fix it myself, it's faster than explaining it."* True short
  term, and that's exactly why the orchestrator ends up with no context left
  to coordinate.
- *"The subagent said the tests pass."* That's a report, not a verification.
  Run the commands.
- *"The tests are green, the gate passes."* Green checking what, exactly? A
  new test file can be green without biting into anything, and an assertion
  lowered to fit also comes up green.
- *"The hook is asking me to commit, so I'll commit."* With a subagent in
  flight, that commit splits its work in two. The tree is theirs until they
  report.
- *"Since I was already in there, I took the chance to…"* An invisible,
  unreviewed change that collides with the next task.
- *"I couldn't run it, but the result would be this."* This is the most
  expensive way to lie, because it looks like completed work and it propagates
  into every decision made after it.

---

## Operational summary

```
before starting:
    does this really need orchestrating? (<3 tasks and no contracts → just do it)
    baseline: commit + NAMES of what's already red + what each command covers

for each task:
    snapshot (HEAD + clean status)
    minimal handoff + contract + environment limits + baseline number
    launch ONE subagent
    (the tree is theirs: no hook, watcher, or orchestrator touches it)
    read report
    gate: status / diff in scope / nothing deleted / history intact /
          no new red / READ the test diff / do they bite?
    commit or revert
    push (orchestrator only, only after the gate)
    log + numbered findings
    → next
```
