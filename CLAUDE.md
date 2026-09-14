<!-- starter-kit: v2026.09 -->

# Agent Configuration

> Claude Code reads this file natively. Other agents (Cursor, Windsurf, etc.) read `AGENTS.md`, which points here. This file is the single source of truth for the project's conventions, stack, and working rules.

---

## What This Is

A CLI installer tool for dAppBooster projects. It supports two **stacks** and two **modes**:

- **Stacks:** `evm` (the original dAppBooster for EVM chains) and `canton` (dAppBooster for Canton: Daml ledger, off-chain services). Each stack declares its own source repository, an optional `ref` to clone (without it the newest tag wins), package manager, env files, an optional `prepare` step, and features. Only EVM has features; Canton has none, so it takes neither `--mode` nor `--features`, and the wizard asks it nothing but the project name.
- **Interactive** (default): React + Ink TUI that prompts for the project name first, then the stack, then — for a stack that has features — the installation mode, the optional packages and a review step, then clone → cleanup → install → post-install. The stack prompt is skipped when `--canton`, `--evm`, or `--stack` is supplied.
- **Non-interactive**: Flag-driven (`--ni` or auto-detected when not a TTY) for AI agents and CI. Outputs JSON to stdout. Run `--info` for stack + feature discovery, then `--canton`/`--evm` (or `--stack`) + `--name`, plus `--mode` [+ `--features`] when the stack's `modes` list is not empty. Omitting a stack flag in non-interactive mode defaults to `evm` for backward compatibility.

## Stack & Conventions

| Category | Technology | Notes |
|----------|-----------|-------|
| Language | TypeScript (strict mode) | Extends `@sindresorhus/tsconfig` |
| Framework | React + Ink | Terminal UI framework |
| Arg parsing | meow | CLI flag parsing for non-interactive mode |
| Package manager | pnpm | Never npm or yarn |
| Linting/formatting | Biome 2 | Run `pnpm lint` before committing |
| Testing | Vitest + @vitest/coverage-v8 | |
| Dead code | knip | `pnpm knip` fails on unused files, exports, and dependencies |
| Secret scanning | gitleaks | Pinned in `.gitleaks-version`; the hooks install it into `bin/` |
| Git hooks | husky + lint-staged + commitlint | Installed by `pnpm i`; see [Git hooks](#git-hooks) |
| Node | v24.15.0+ | `engines.node` is the published floor, matched to what the scaffolded stacks need; `.nvmrc` (24) is what CI and development use |
| Naming | camelCase vars/functions, PascalCase components/types | Biome enforces the same two cases for filenames |

## Code Style

- **Semicolons:** as needed (Biome `asNeeded` — omitted unless required by ASI)
- **Quotes:** single
- **Print width:** 100
- **Trailing commas:** all (Biome default)
- **Indent:** spaces, width 2
- **Imports:** explicit `.js` extensions (ESM, `"type": "module"`)

## Working Rules

- Use **pnpm** only (never npm or yarn), for this installer and for both scaffolded projects
- Treat `dist/` as build output — never edit directly
- User input (`projectName`) must never be interpolated into shell command strings — use `execFile` (args array) instead
- `source/stacks/` is the single source of truth for stack and feature metadata: one module per stack, with `source/stacks/index.ts` holding the record and the accessors. All programmatic consumers read it through `getStackConfig(stack)`. CLI `--help` text maintains its own copy.
- No file outside `source/stacks/` and `source/cli.tsx` may test a stack by name. Add a `StackConfig` field instead.
- Stack overrides come from env vars `DAPPBOOSTER_<STACK>_REPO_URL` and `DAPPBOOSTER_<STACK>_REF` (read inside `getStackConfig`) — useful for forks and pre-release testing.
- Components are presentation-only — business logic lives in `source/operations/`. Every operation that varies per stack takes `stack` as its first argument.

## Architecture

See [architecture.md](./architecture.md) for the full architecture guide, including data flow, how to add features, and security patterns.

Entry: `source/cli.tsx` — parses args with `meow`, routes between interactive and non-interactive paths.

- **Interactive path**: `source/app.tsx` — step-based state machine that renders each installer step in sequence via React + Ink
- **Non-interactive path**: `source/nonInteractive.ts` — validates flags, runs operations sequentially, outputs JSON

Key directories:

- `source/operations/` — business logic as plain async functions, shared by both paths
- `source/components/steps/` — TUI step components, presentation-only
- `source/components/` — reusable UI components (Ask, Divider, MainTitle, Multiselect)
- `source/__tests__/` — vitest test suite

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm build` | Compile `source/` to `dist/` |
| `pnpm dev` | The same, in watch mode |
| `pnpm typecheck` | Types only, no output. Two passes: `source/` for the build, then the tests |
| `pnpm test` | Run the vitest suite |
| `pnpm test:coverage` | The same, with a coverage report |
| `pnpm lint` | Biome check, warnings included |
| `pnpm lint:fix` | Biome check with `--write` |
| `pnpm knip` | Report unused files, exports, and dependencies |

Run the built CLI from a scratch directory. It scaffolds the new project into the folder it is
started from, so `node dist/cli.js` in this repo would write into the repo itself.

## Demo recording

`demo.svg` in the readme is an animated SVG of a real wizard run. Regenerate it after any change to
the terminal UI:

```shell
pnpm build
./scripts/record-demo.py
```

The script scaffolds a real EVM project into a temporary directory, so it needs network and takes a
few minutes. It cleans up after itself and overwrites `demo.svg`.

Things worth knowing before touching it:

- The conversion is [svg-term-cli](https://github.com/marionebl/svg-term-cli), run through
  `pnpm dlx`. It is not a dependency. The flags `--window --width 92 --height 23 --padding 10`
  produce the committed geometry; change them and the readme's `<img>` size needs to change too.
- `asciinema` cannot be scripted here. It ignores piped stdin, `script` refuses to start unless its
  own stdin is a tty, and `node-pty` has no prebuilt binary for this machine. The script uses
  Python's standard-library `pty` instead, which needs nothing installed.
- It waits for each prompt to appear in the output rather than sleeping a fixed time, so it does not
  break when a step gets slower.
- A `pnpm` shim on `PATH` makes `pnpm dlx dappbooster` run `dist/cli.js`. The recorded command line
  is the real one while the code being demoed is the working tree.
- The recording is trimmed to 15 seconds so the loop stays short. Beyond that it is the package
  install, which is a long stretch of near-static output and reads as a frozen image.
- Output within 150ms is merged into one frame. That cuts the file roughly five-fold, because the
  spinner redraws every 80ms. It changes when bytes are flushed, never which bytes.

## Testing

- **Framework:** Vitest + V8 coverage
- **Run tests:** `pnpm test` / `pnpm test:coverage`
- **Structure:** `source/__tests__/` mirrors `source/` layout. Operations tests live in `source/__tests__/operations/`
- **What to test:** Non-interactive agentic flow (validation, JSON output), operations (correct shell commands), config, utils
- **What not to test:** React/Ink components
- **Mocking pattern:** Operations tests mock `exec`/`execFile` from `source/operations/exec.js`. `exec.test.ts` mocks `child_process.spawn` directly to test the helpers themselves. Non-interactive tests mock the entire operations layer
- **Coverage:** Focus on the agentic interface. Test files and `source/components/` are excluded from coverage

## Git hooks

`pnpm i` installs three hooks through husky:

- **commit-msg** runs commitlint against the message.
- **pre-commit** runs lint-staged in two passes. `.lintstagedrc.format.mjs` lets Biome write the
  staged files first; `.lintstagedrc.mjs` then runs the read-only gates (typecheck, tests, knip).
  The split exists because a reformat landing mid-parse makes the gates fail at random. It finishes
  by scanning the staged changes for secrets.
- **pre-push** runs lint, typecheck and tests, then scans the outgoing commits for secrets.

Secret scanning uses a pinned gitleaks. `scripts/install-gitleaks.sh` downloads that exact release
into `bin/` and verifies its sha256, so local runs and CI apply the same version and rules. To scan
the history by hand:

```shell
./scripts/install-gitleaks.sh
./bin/gitleaks git --redact --verbose --exit-code 1 .
```

## Continuous integration

`.github/workflows/pr.yml` runs on every pull request: Biome, then typecheck and build and knip,
then the test suite on `.nvmrc` and again on the Node 24.15.0 floor, then commitlint over both the commit
range and the PR title, then gitleaks over the full history. A retitle only re-runs commitlint.

`pr-assign.yml` assigns the author to their own pull request. `add-to-project.yml` adds new issues
and pull requests to the project board; it needs the `ADD_TO_PROJECT_PAT` secret, because the
built-in token cannot write org projects.

## Commit Standards

Use [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): subject`.

- **Scope** is optional: `feat: add login` and `feat(auth): add login` are both valid
- **Subject** uses imperative mood, lowercase after the colon, no trailing period
- **Body** (optional): separated by a blank line, explains *what* and *why*

Allowed types, enforced by `commitlint.config.js`: `build`, `chore`, `ci`, `docs`, `feat`, `fix`,
`hotfix`, `perf`, `refactor`, `release`, `revert`, `style`, `test`, `wip`.

## PR Workflow

- Every PR must reference an issue (`Closes #`)

  > No related issue? Use `No related issue.` as the first line of the Summary section.

- Mirror the issue's acceptance criteria in the PR
- Self-review your diff before requesting peer review
- Keep PRs small and focused — one issue, one PR
- PR titles use the same conventional commit format, and CI checks them
- The `create-pr` skill at `.claude/skills/create-pr/` reads
  [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md) and fills every section

## Label Conventions

GitHub form dropdowns (like the Priority field in issue templates) only work through the web UI. When issues are created via `gh` CLI or REST API, dropdown values become unstructured body text — not queryable, not consistent. **Labels are the API-reliable mechanism for structured metadata.**

**Priority** (bugs, features, and epics):

| Label | Description |
|-------|-------------|
| `priority: critical` | Blocking work, system down, or security issue |
| `priority: high` | Must be addressed in current sprint |
| `priority: medium` | Should be addressed soon |
| `priority: low` | Nice to have, can wait |

Labels are queryable: `gh issue list --label "priority: high"`.

The `create-issue` skill at `.claude/skills/create-issue/` applies these labels automatically when creating issues via CLI. Bug, feature, and epic templates include a Priority dropdown for web UI users, but labels are the source of truth for programmatic workflows.

## Guardrails

- Do not commit secrets, API keys, or credentials. The hooks run gitleaks; do not bypass them with
  `--no-verify`
- Do not modify CI/CD pipelines without team review
- Do not skip tests or linting to make a build pass
- Pin third-party GitHub Actions to a commit SHA with the version in a trailing comment
- Raising `engines.node` breaks installs for everyone below the new floor; treat it as a release
  decision, not a cleanup
- `ink` and `react` stay on 5 and 18: `ink-divider` still depends on `ink` 5, so moving to `ink` 7
  would load two copies of the renderer
- When in doubt, ask — don't assume

## Change Strategy

- Prefer small, focused diffs over broad refactors
- Preserve existing UX unless the task explicitly changes it
- Avoid introducing new patterns when a project pattern already exists
- Update docs only when behavior or workflow changes

## Validation Checklist

Run all five before declaring work done. CI runs the same set.

- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- `pnpm knip`

## Release

GitHub Actions workflow (`.github/workflows/release.yml`) triggers on GitHub release events. Pre-releases do a dry-run; full releases publish to npm.

It publishes with `npm publish`, not `pnpm publish`, because npm is what supports OIDC trusted publishers. That is also why the job asks for `id-token: write` instead of carrying an npm token.
