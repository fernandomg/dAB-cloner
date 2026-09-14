# Architecture Overview

Architecture guide for the dAppBooster installer.

## Tech Stack

| Category | Technology | Notes |
|----------|-----------|-------|
| Framework | React + Ink | Terminal UI for interactive mode |
| Language | TypeScript (strict mode) | Extends `@sindresorhus/tsconfig`. `tsconfig.json` builds `source/`; `tsconfig.tests.json` typechecks the tests |
| Arg parsing | meow | CLI flag parsing, non-interactive mode |
| Styling | Ink primitives | `<Box>`, `<Text>`, ink-gradient, ink-big-text, ink-spinner |
| Testing | Vitest + @vitest/coverage-v8 | |
| Lint + format | Biome 2 | `biome.json`; one tool for both |
| Dead code | knip | `knip.json`; entry points are `cli.tsx` and the test files |
| Node | v24.15.0+ published, 24 for development | `engines.node` is the floor, matched to what the scaffolded stacks need; `.nvmrc` is what CI uses. A stack can still ask for more through `minNodeVersion` |

## Project Structure

```
source/
  cli.tsx                     Entry point: meow arg parsing, stack resolution, mode routing
  app.tsx                     Interactive TUI: step-based state machine, threads `stack` through every step
  nonInteractive.ts           Non-interactive: validate flags → run operations → JSON
  info.ts                     --info JSON output for agent discovery (optionally filtered by stack)
  stacks/
    evm.ts                    The EVM StackConfig and its features
    canton.ts                 The Canton StackConfig (no features)
    index.ts                  stackDefinitions, stackNames, and the config/feature accessors
  operations/
    exec.ts                   exec (shell) and execFile (no shell) helpers
    cloneRepo.ts              Check stack.minNodeVersion, clone at the newest tag or at stack.ref, rm .git, git init
    createEnvFile.ts          Copy each stack's envFiles
    installPackages.ts        Stack-aware: uses stack.packageManager (pnpm)
    cleanupFiles.ts           Applies stack.prepare, removes deselected features, patches package.json — all before the install
    createInitialCommit.ts    Commits the finished scaffold (stacks that ask for it)
    installGuard.ts           Removes the partial project dir if interrupted mid-scaffold
    index.ts                  Barrel export
  components/
    steps/                    TUI step components (presentation-only)
      ProjectName.tsx         First step: prompt for the project name
      StackSelection.tsx      Pick a stack (skipped when preselectedStack is passed)
      CloneRepo/CloneRepo.tsx Clone progress display (receives stack)
      InstallationMode.tsx    Mode selection (skipped for a stack with no features)
      OptionalPackages.tsx    Feature multiselect (skipped for a stack with no features)
      FileCleanup.tsx         Cleanup progress display, runs before the install
      Install/Install.tsx     Env files, package install and baseline commit
      StepProgress.tsx        Shared runner for the operation steps: progress, errors, guard
      PostInstall.tsx         Renders the stack's postInstallComponent, or its postInstall lines
      EvmPostInstall.tsx      The EVM closing screen, including the subgraph warning
      CantonPostInstall.tsx   The Canton closing screen, including the dev-stack steps
    Ask.tsx                   Text input with validation
    Divider.tsx               Section divider
    MainTitle.tsx             Gradient title banner, with a badge for the chosen stack
    Multiselect/              Checkbox multiselect component
  types/
    types.ts                  Shared TypeScript types
  utils/
    utils.ts                  Stack-aware helpers, feature-dependency resolution, validation, path helpers
  __tests__/                  Mirrors source/ layout
```

## Key Abstractions

### Stack (`source/stacks/`)

Each stack owns a module — `source/stacks/evm.ts` and `source/stacks/canton.ts` — exporting one `StackConfig`. `source/stacks/index.ts` holds the `stackDefinitions` record, `stackNames`, and the accessors below. The types live in `source/types/types.ts`. Nothing outside `source/stacks/` and `cli.tsx` tests a stack by name.

```ts
type Stack = 'evm' | 'canton'

type StackConfig = {
  label: string
  description: string
  repoUrl: string
  ref?: string                              // tag or branch to clone; left out, the newest tag wins
  packageManager: 'pnpm'
  minNodeVersion?: string                   // checked before the clone (Canton: 24.15.0)
  prepare?: PrepareStep                     // paths and package.json keys every scaffold drops
  postInstall?: string[]                    // stack-level post-install guidance, shown for every scaffold
  postInstallComponent?: () => Promise<{ default: FC<PostInstallProps> }>  // richer wizard closing screen (EVM), imported on demand so --info and the non-interactive path never load Ink; otherwise the lines above are printed
  staging?: { label: string; paths: string[] }  // where the template keeps replacement files; removed once cleanup is done (EVM's .install-files)
  initialCommit?: boolean                   // commit the finished scaffold as the project's baseline (Canton)
  envFiles: Array<{ from: string; to: string }>
  features: Record<string, FeatureDefinition>
}

type PrepareStep = {
  label: string
  paths?: string[]            // deleted before the install
  scripts?: string[]          // package.json scripts deleted before the install
  devDependencies?: string[]  // package.json devDependencies deleted before the install
}
```

`prepare` is what a scaffold drops whatever the user picked. EVM uses it for the template's own repo files (`.github`, `.claude`, the agent docs). Canton uses it for the bulk of its scaffolding: the three in-tree libraries, `kit/`, the agent docs and `pnpm-lock.yaml`, plus the `release` and `release:dry` scripts and the `typedoc`, `postcss` and `@mermaid-js/mermaid-cli` dev-dependencies that only served them. The other five scripts it drops are not declared: `cleanupFiles` records which deleted paths were directories, so any script whose command names `kit/` goes with the folder. Both halves must go together, because knip counts a binary named in a script as used. It runs inside `cleanupFiles`, before the single package install, so the package manager never resolves a dependency the manifest is about to lose.

Installation modes are stack-aware via `getInstallationModes(stack)` — EVM offers `full` / `custom`, Canton offers none. A stack with no features returns an empty list: the wizard skips both questions and the CLI rejects `--mode` and `--features`. `default` mode needs at least one `default: false` feature, or it would equal `full`; no stack has one today.

`getStackConfig(stack)` reads the base config and overlays the env-var overrides `DAPPBOOSTER_<STACK>_REPO_URL` and `DAPPBOOSTER_<STACK>_REF` before returning — that's the single hook for retargeting either stack at a fork or pre-release branch without editing code.

`getFeatureNames(stack)`, `getFeatureEntries(stack)` and `isFeatureNameValid(stack, name)` are the per-stack feature accessors. There is no global `featureDefinitions` export — that would imply a single stack.

`FeatureName` is the union of every feature name the stacks define, declared in `source/types/types.ts`. Only EVM has features, and its `satisfies StackConfig & { features: Record<FeatureName, FeatureDefinition> }` clause requires its feature map to hold exactly those keys, so the union and the map cannot drift apart without a compile error. Renaming a feature therefore turns every stale `'oldName'` string in the codebase into a compile error. `isFeatureNameValid` is a type guard, so validated CLI input narrows from `string` to `FeatureName`.

### Feature Definitions

Stored inside each stack's `features` map. Shape:

```ts
type FeatureDefinition = {
  description: string   // --info output
  label: string         // TUI multiselect display
  packages: string[]    // dependencies the package manager removes when the feature is deselected
  default: boolean      // --info output
  postInstall?: string[] // post-install instructions for non-interactive JSON output
  paths?: string[]       // files/dirs removed when the feature is deselected
  scripts?: string[]     // package.json scripts removed when the feature is deselected
  requires?: FeatureName[] // features this one depends on (one-directional, transitive)
}
```

When adding a new feature, add its name to the `FeatureName` union in `source/types/types.ts` and an entry to the stack's `features` map. Programmatic consumers pick it up automatically. Feature cleanup is data-driven from `paths` and `scripts`, and removal of its `packages` is data-driven too (see the Operations Layer below), so a new feature usually needs no code. The one exception is EVM's `demo` and `subgraph`, which restore replacement source files from the template's staging directory. The CLI `--help` text in `cli.tsx` maintains its own copy either way.

`packages` are always removed by the package manager (`pnpm remove`), which updates package.json and the lockfile together. Nothing hand-edits dependencies.

**Feature dependencies (`requires`)** are resolved by pure helpers in `utils.ts`. `resolveSelectedFeatures(stack, selected)` expands a selection to include every transitive requirement; `resolveModeFeatures(stack, mode, customSelection)` maps a mode to its kept-feature list (full → all, default → the `default: true` set, custom → the resolved selection), each with its `requires` resolved. The non-interactive path resolves it in `validate`; the interactive path resolves it once in `app.tsx` and passes the result to every step, so the review screen lists exactly what gets installed. `applyFeatureToggle(stack, selection, toggled, action)` keeps the interactive multiselect consistent: selecting a feature pulls its requirements in, deselecting one cascades its dependents out. No feature declares `requires` today (the machinery remains for future use); `--info` surfaces each feature's `requires` so agents can resolve dependencies themselves.

### Operations Layer (`source/operations/`)

Plain async functions, no UI dependencies. Each operation that varies per stack takes `stack: Stack` as its first argument. Multi-step operations accept an optional `onProgress` callback for the TUI; the non-interactive path omits it.

| Function | What it does |
|---|---|
| `cloneRepo(stack, projectName, onProgress?)` | Fails first when the running Node is below `stack.minNodeVersion`, before anything touches the disk. Then clones. Without `stack.ref` (both stacks today): shallow clone with `--no-checkout`, `git fetch --tags`, then `git checkout $(git describe --tags …)` (shell required for `$()`). With `stack.ref` — which today only `DAPPBOOSTER_<STACK>_REF` sets — that tag or branch wins over the latest tag: `git fetch --depth 1 origin <ref>` then `git checkout FETCH_HEAD`, no shell. Removes `.git` and reinitializes with `git init`. Uses `execFile` everywhere except the latest-tag shell substitution. |
| `createEnvFile(stack, projectFolder)` | Copies every entry from `stack.envFiles`. |
| `installPackages(stack, projectFolder, mode, features, onProgress?)` | Uses `stack.packageManager`. Nothing to remove (full mode, or a selection that drops no packages): `<pm> install`. Otherwise `<pm> remove`, which prunes the manifest and the lockfile together, then `<pm> run postinstall` **only if the template defines that script** — the Canton template does not. Runs after `cleanupFiles`, so it resolves the pruned manifest once. `execFile` only — never shell. |
| `cleanupFiles(stack, projectFolder, mode, features, onProgress?)` | Config-driven for both stacks, and runs **before** the install. First the stack's `prepare` paths, dropped from every scaffold. Then, in `default` and `custom` modes, it loops the stack's features and for each one the user left out removes its `paths` and collects its `scripts`. Removed **directories** also strip scripts by command target: any script whose command invokes a removed directory is dropped, so dropping `vocs` strips a script that runs `docs/`. Removed *files* never strip scripts, so a script that merely mentions `CLAUDE.md` survives. package.json is then patched in a single pass — the `prepare` scripts and dev-dependencies, plus the deselected features' scripts — read once and written only when a value changed. Feature dependencies are left to `installPackages`; `prepare` dev-dependencies are deleted here, because the package manager must never see them. A stack with a `staging` group additionally restores the demo-free home page from the staged copies when `demo` or `subgraph` is dropped, and the staging directory (EVM's `.install-files`) goes last, once the restores no longer need it. |

#### Interrupt safety (`installGuard`)

`source/operations/installGuard.ts` makes a Ctrl+C or a failure mid-scaffold leave no partial directory behind. `beginInstall(projectFolder)` is called the instant disk work starts (before `cloneRepo`) and registers `SIGINT`/`SIGTERM` handlers; `completeInstall()` is called once cleanup finishes; `abortInstall()` is called when an operation throws — it removes the partial directory and sets `process.exitCode = 1`, so a failed interactive run reports failure to the shell instead of exiting 0. The three interactive operation steps (`CloneRepo`, `Install`, `FileCleanup`) all call it from their `catch`. On an interrupt while a scaffold is in progress, the handler removes the project directory; after `completeInstall` it is a no-op, so a finished project (or a Ctrl+C on the post-install screen) is never deleted. It only ever removes a directory created this run — both entry paths reject a pre-existing directory up front — so user data is never touched. Both paths wire it in: the non-interactive runner brackets its operation block, and interactively `CloneRepo` calls `beginInstall` while `Install`, the last operation step, calls `completeInstall`.

### Shell Execution (`source/operations/exec.ts`)

Two helpers with different security profiles:

- **`execFile(file, args, options)`** — wraps `child_process.spawn` without a shell. Arguments are passed as an array, so user input cannot be interpreted as shell metacharacters. Use this whenever user-provided values (e.g., `projectName`) appear in the command.
- **`exec(command, options)`** — wraps `child_process.spawn` to run `/bin/sh -c <command>` (spawns a shell). Only for commands that require shell features like `$(...)` substitution. Never interpolate user input into the command string.

Both helpers use `spawn` with stdout ignored and stderr piped. They do not capture or return stdout — output is not buffered for the caller. They throw on non-zero exit codes with the stderr message, or report the signal name when the process is killed by a signal.

### Security

- User input (`projectName`) is validated against `/^[a-zA-Z0-9_][a-zA-Z0-9_-]*$/` before any use. The leading character cannot be a dash, or git would read the name as an option rather than a directory.
- Operations use `execFile` (no shell) for commands that include user input or stack-config values.
- `exec` (shell) is reserved for the tag-latest checkout (`git checkout $(git describe …)`); it never receives user input in the command string.
- Stack `repoUrl` and `ref` may come from the environment (`DAPPBOOSTER_<STACK>_REPO_URL`, `DAPPBOOSTER_<STACK>_REF`) but are passed to git via `execFile`, not interpolated into shell strings.
- Child process stdout is ignored and stderr is piped (captured for error diagnostics only), guaranteeing clean JSON on the parent's stdout.

## Data Flow

### Non-interactive (agent)

```
CLI flags (string)
  → meow parses to typed flags
  → resolveStackFlag merges --canton / --evm / --stack and rejects conflicts
  → validate() converts to { stack, name, mode, features: FeatureName[] }
  → operations receive typed args (stack first)
  → JSON output to stdout
```

**Routing:** `source/cli.tsx`

```
conflicting stack flags  →  JSON error → exit 1
--info  →  source/info.ts → print JSON (optionally filtered by stack) → exit 0
--ni / !isTTY  →  source/nonInteractive.ts → validate → operations → JSON
default  →  dynamic import ink + App (preselectedStack passed if resolved) → TUI
```

**Non-interactive validation order:**
1. `--stack` (if explicit) is a valid stack name (else error). When unset, defaults to `evm`.
2. `--name` required
3. `--name` matches `/^[a-zA-Z0-9_][a-zA-Z0-9_-]*$/` — a leading dash is rejected because git would read the name as an option
4. Stack with no modes (`getInstallationModes(stack)` is empty, i.e. Canton): `--mode` and `--features` are rejected by name, then skip to step 10 with `mode: 'full'` and no features
5. `--mode` required
6. `--mode` is `full`, `default`, or `custom`
7. `--mode` is one of the modes the stack offers — the same list `--info` reports (so `default` is rejected for `evm`)
8. Full / default mode: skip to step 10 (features come from the mode, `--features` ignored)
9. Custom mode: `--features` required, parses to a non-empty list (rejects trailing commas, whitespace-only entries), and every name is valid **for the selected stack**
10. Project directory does not already exist

The kept-feature list is derived from the mode via `resolveModeFeatures` (see
[feature definitions](#feature-definitions)); for custom mode this expands the selection
with `resolveSelectedFeatures` so any feature dependencies are pulled in before the operations run
and before the result is reported.

**Non-interactive execution order:**
`cloneRepo` → `cleanupFiles` → `createEnvFile` → `installPackages` → `createInitialCommit` (stacks whose config sets `initialCommit`) → success JSON

Cleanup runs **before** the install on purpose: it prunes package.json, so the package manager resolves the pruned manifest once and the lockfile it writes matches. The reverse order left the generated project with a lockfile listing packages its package.json no longer had, which fails a frozen-lockfile install. It is also what makes Canton's `prepare` step work: the library folders and the old lockfile are gone before the resolve, so the same manifest resolves the three `@bootnodedev/*` libraries from npm instead of linking the local folders. The baseline commit runs last, so it captures that lockfile.

Any error produces `{ "success": false, "error": "..." }` and exit code 1. `reportFailure` is the only place that prints it: it sets `process.exitCode = 1` and returns a `ReportedError`, which `fail()` throws. `cli.tsx` ignores that error type and reports anything else. Nothing calls `process.exit()` directly, so stdout flushes before the process terminates when piped.

**Success output:**
```json
{
  "success": true,
  "stack": "evm|canton",
  "projectName": "...",
  "mode": "full|default|custom",
  "features": ["..."],
  "path": "/absolute/path",
  "postInstall": ["..."]
}
```

For full mode, `features` lists all of the stack's feature names; for custom mode, the selected ones plus any dependencies they pulled in. A stack with no features always reports `"mode": "full"` and an empty `features` list.

### Interactive (human)

```
User input via Ink components
  → useState in App.tsx (stack, projectName, setupType, selectedFeatures)
  → passed as props to step components
  → components convert MultiSelectItem[] → FeatureName[]
  → operations receive typed args (stack first)
  → Ink renders progress/status
```

All questions come **before** any disk work, mirroring the non-interactive path — so abandoning the wizard while answering leaves nothing behind.

```
Questions (no disk):  ProjectName → [StackSelection] → [InstallationMode → OptionalPackages (custom only) → Confirmation]
Operations (disk):    CloneRepo → FileCleanup → Install → PostInstall
```

The last bracketed group is dropped for a stack whose `getInstallationModes` list is empty: with nothing to choose there is nothing to review, so a Canton run asks for the project name and then scaffolds.

Each operation step renders through the shared `StepProgress` component, which owns the step list, the running/done/error display and the failure path (`abortInstall`), so every step reports a failure the same way. `Install` covers env files, the package install and the baseline commit, and calls `completeInstall` when the scaffold is finished.

`Confirmation` shows the plan as one line per setting (`describeInstallPlan`), each value highlighted, and is the last side-effect-free step. **Yes** starts the operations; **No** loops back to the first question (state is reset and the question steps are re-keyed so they re-mount fresh). When `cli.tsx` resolves a stack flag, it passes `preselectedStack` to `<App>`, which skips the `StackSelection` step.

Nothing is lost by dropping `Confirmation` for a featureless stack: the project name is validated as it is typed, and an interrupt or a failure during the operations removes the partial directory (see installGuard below).

Once operations begin, `CloneRepo` calls `beginInstall` (see [interrupt safety](#interrupt-safety-installguard)) and `FileCleanup` calls `completeInstall` on success, so a Ctrl+C mid-scaffold removes the partial directory while a finished project is left intact.

Components are presentation-only — they call operations via `useEffect` and render status. Components receive `MultiSelectItem[]` for feature selection (TUI concern), then derive the kept-feature `FeatureName[]` via `resolveModeFeatures(stack, mode, selected)` before calling operations — so `full`/`default` resolve correctly even though the multiselect is skipped. The `OptionalPackages` multiselect pre-checks `default: true` features and enforces feature dependencies live via `applyFeatureToggle`. `PostInstall` names no stack: it renders the stack's own `postInstallComponent` when there is one (EVM's, which adds the subgraph warning when applicable), and otherwise prints a `cd` line and the stack's `postInstall` lines.

## Extending the Installer

### How to Add a New Stack

1. **`source/types/types.ts`** — add a `Stack` union member.
2. **`source/stacks/<name>.ts`** — export a `StackConfig`: `label`, `description`, `repoUrl`, optional `ref`, `packageManager`, `envFiles`, `features`. Add `minNodeVersion` when the scaffold needs a newer Node than the installer, `prepare` for what every scaffold drops, `staging` for replacement files, and `initialCommit` for a baseline commit. `cleanupFiles` and `cloneRepo` read all of it, so they need no new branch.
3. **`source/stacks/index.ts`** — add the module to the `stackDefinitions` record.
4. **Post-install** — a stack with a short message needs nothing: `PostInstall.tsx` prints its `postInstall` lines. For a richer screen, add a component and set `postInstallComponent` to a function that imports it (`() => import('../components/steps/MyPostInstall.js')`), so the stack config stays free of terminal UI.
5. **`source/cli.tsx`** — add a shortcut flag (e.g. `--myStack`) and extend `resolveStackFlag`; update `--help` text.
6. **Tests** — add per-stack assertions to `nonInteractive.test.ts`, `info.test.ts`, `cloneRepo.test.ts`, `installPackages.test.ts`, `cleanupFiles.test.ts`, `createEnvFile.test.ts`.
7. **Verify** — `pnpm build && pnpm lint && pnpm test`. Smoke-test with `DAPPBOOSTER_<STACK>_REPO_URL=file:///path/to/local/clone`.

### How to Add a New Feature to an Existing Stack

1. **`source/types/types.ts`** — add the name to the `FeatureName` union.
2. **`source/stacks/<name>.ts`** — add an entry to the stack's `features` map (leave one out and the file will not compile). The `default` flag governs both the custom-mode pre-check and `default`-mode membership: `default: true` for "kept by the recommended install", `default: false` for "removed by default / opt-in". List the feature's `paths`, `scripts` and `packages`; cleanup and the install read all three, so no new code is needed. If it depends on another feature, add `requires` — resolution is automatic in both paths.
3. **`source/operations/cleanupFiles.ts`** — only needed when the feature has to put a replacement file back, the way EVM's `demo` and `subgraph` copy from `.install-files`.
4. **Post-install** — extend the stack's `postInstall` lines or its `postInstallComponent` if needed.
5. **`source/cli.tsx`** — update the `--help` text.
6. **Tests** — add assertions in the relevant test files. nonInteractive, info, installPackages, and utils tests pick up new features automatically through `stackDefinitions`.
7. **Verify** — `pnpm build && pnpm lint && pnpm test`.

> Adding the first feature to a stack that had none also turns its wizard questions and its `--mode` / `--features` flags back on, because `getInstallationModes` stops returning an empty list.

### How to Add a New Operation

1. Create `source/operations/newOperation.ts` — export an async function. Use `execFile` for commands with user input, `exec` only when shell features are needed. If behavior depends on the stack, take `stack: Stack` as the first argument.
2. Export from `source/operations/index.ts`.
3. Call from `source/nonInteractive.ts` (in the execution sequence) and from the relevant TUI component.
4. Add tests in `source/__tests__/operations/newOperation.test.ts` — mock `exec`/`execFile` to verify correct commands.
