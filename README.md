# Parallax

**An open-source AI image, video and audio studio, with an agent chat you can run on your own Hermes agent.**

One web app: studios for pictures, video, voices and music, tools built on top of them, a
community feed, a library, credits, an API for developers, and Supercomputer, an agent that
plans and makes things for you.

![The Parallax home page](docs/screenshots/home.png)

It runs with `npm run dev` and nothing else installed. The database is one SQLite file, and
without a provider key every model answers with a built-in sample file, so you can click
through the whole product for free.

| | |
|---|---|
| ![The image studio](docs/screenshots/image.png) | ![The community feed](docs/screenshots/community.png) |

## Quick start

You need Node.js 22.13 or newer (the app uses Node's built-in SQLite).

```bash
git clone https://github.com/nickvasilescu/parallax.git
cd parallax
npm ci
PARALLAX_DEMO_SEED=1 npm run dev
```

Open http://localhost:3000. You can try it as a guest with a few credits. Signing up keeps
what you made as a guest.

`PARALLAX_DEMO_SEED=1` fills a new install with four house accounts and about sixty published
pictures. Every one was made with Parallax, and each post carries the prompt that made it, so
Recreate works on all of them. Nobody can sign in as the demo accounts. Leave the variable
out for an empty feed.

## Real generations

Models are reached through one gateway, [treg.to](https://treg.to). Copy `.env.example` to
`.env.local` and set `TREG_TOKEN`. The app then runs in live mode: 39 image, video, voice and
music models, each with its own controls and an exact price shown before you press Generate.

`TREG_DAILY_BUDGET_USD` stops paid requests once that much was spent in 24 hours. Keep it low
while you try things out.

## Supercomputer, on a Hermes agent, on Orgo

Supercomputer is the agent chat at `/supercomputer`. It can run on three things:

| Engine | What answers | Needs |
|---|---|---|
| Stand-in (default) | A scripted assistant, so the screens work with no keys | Nothing |
| Built-in | Parallax runs the agent loop itself | `SUPER_MODE=live` and a model key |
| **Hermes** | Your own [Hermes](https://github.com/NousResearch/hermes-agent) agent runs the conversation | A Hermes agent, for example on an [Orgo](https://www.orgo.ai) computer |

With the Hermes engine, the agent does the thinking and Parallax gives it the studio's tools
over MCP. When the agent wants a picture, the member gets an approval card with the price and
pays with their own credits. The generation key never leaves Parallax.

![A chat running on a Hermes engine](docs/screenshots/supercomputer-hermes.png)

*The chat above ran in the test setup: a stand-in agent and a sample picture.*

**Set it up: [`docs/hermes-on-orgo.md`](docs/hermes-on-orgo.md).** It is a step-by-step guide:
turn on the agent's API server, make two secrets, join the machines, add one entry to the
agent's config, start Parallax. It also lists what to build next.

Two things to know before you start:

- The engine is tested end to end against a stand-in agent. It has not been run against a
  live Hermes agent yet. If you try it, please open an issue with what you found.
- The agent's own tools (shell, files, memory) are **not** behind Parallax's approval cards.
  Do not point a public Parallax at a personal agent. The guide explains the safe setup.

## What is in it

| Page | What it does |
|---|---|
| `/` and `/explore` | Home and the public feed |
| `/image`, `/video`, `/audio` | The three studios: pick a model, set its controls, generate |
| `/remix` | Restyle or move a picture or clip you already have |
| `/cinema` | Plan a film shot by shot and generate the shots as a batch |
| `/shorts` | Turn one idea into a short vertical video |
| `/apps` | One-purpose tools built on the models |
| `/ads` | Product ad campaigns with rounds and winners |
| `/canvas` | An open board for laying out pictures and notes (kept in the browser) |
| `/horizon` | A preview of what comes next: long-form video from one brief |
| `/guide` | How Parallax works: credits, studios and writing prompts |
| `/supercomputer` | An agent chat that can use a cloud computer and connected apps |
| `/community`, `/u/<handle>`, `/contests` | Posts, profiles, likes, saves, comments, follows |
| `/library` | Everything you made or uploaded, with folders and favourites |
| `/pricing`, `/wallet`, `/settings`, `/notifications` | Plans, credits and your account |
| `/developer`, `/mcp` | API keys, webhooks, usage, and the MCP server for agents |

## What is not real yet

- **Payments.** There is no payment processor. The top-up button adds credits for free and
  says so. It is open by default only in mock mode; a live server keeps it closed unless
  `PARALLAX_DEMO_BILLING=on`. Never turn it on for a public server.
- **Supercomputer's live mode.** `SUPER_MODE=live` can start cloud computers and connect
  outside apps, and both can cost money. It has had far less testing than the studios.
- **The Hermes engine against a real agent.** See above.
- **Canvas** boards live in the browser only. **Horizon** is a preview page.
- **The offer on the home page** (the `LAUNCH-WEEK` code and the discount badge) is sample
  marketing. Change it (search the code for `LAUNCH`) before you run this for anyone.

Each page in `docs/api/` ends with an "Open improvements" list. Those are good first changes.

## Settings

Everything is optional. Put them in `.env.local`.

| Variable | What it does |
|---|---|
| `TREG_TOKEN` | The gateway key. Without it the app runs in mock mode |
| `TREG_MODE` | Force `mock` or `live` |
| `TREG_DAILY_BUDGET_USD` | Stop paid requests after this many dollars in 24 hours |
| `PARALLAX_DATA_DIR` | Where the database and files live. Default `./data` |
| `PARALLAX_DEMO_SEED` | `1` adds the demo accounts and posts to a new data folder |
| `PARALLAX_DEMO_BILLING` | `on` opens the free top-up button and free plan changes on a live server (they are open by default in mock mode only); `off` closes them everywhere |
| `PARALLAX_ORIGIN` | The public address of the app when it runs behind a proxy or a public link, for example `https://parallax.example.com`. The server writes its links with it and accepts requests from pages at that address |
| `COOKIE_SECURE` | `1` when serving over https |
| `SUPER_MODE` | `live` lets Supercomputer use the three keys below |
| `ANTHROPIC_API_KEY`, `ORGO_API_KEY`, `COMPOSIO_API_KEY` | The agent's model, its cloud computer, and its app connections |
| `SUPER_ENGINE` | `hermes` runs the Supercomputer chat on a Hermes agent instead of the built-in loop |
| `HERMES_URL`, `HERMES_API_KEY_FILE`, `SUPER_ENGINE_TOKEN_FILE`, `SUPER_ENGINE_NAME` | Where the agent is, its key, the token it uses to call Parallax's tools, and the name members see |

## Run it for real

```bash
npm ci && npm run build
deploy/start.sh mock      # sample files. Drop "mock" for real generations.
deploy/stop.sh
```

`deploy/start.sh` runs the built app in the background with a clean environment and keeps its
data and log in `deploy/run/`. Read [`SECURITY.md`](SECURITY.md) before you put it on the
internet.

## Checks and tests

```bash
npm run typecheck
npm run lint
npm run check:registry     # every model, every combination of controls, has an exact price
npm run build
npm test
```

`npm test` starts the built app in mock mode on an empty data folder for each test file, and
removes every key from its environment, so a test can never spend money. The `.py` files test
the API (Python 3, standard library only). The `.mjs` files are browser walk-throughs; they
need Chrome and save their screenshots in `ui-shots/`. Set `UI_SIZE="390 844"` to walk through
at phone size. To run a few: `python3 tests/run.py tests/core_e2e.py tests/ui/home.mjs`.

## Where things are

| Path | What it is |
|---|---|
| `src/app/` | Pages and API routes |
| `src/server/` | Database, accounts, credits, jobs, the worker, files, the gateway |
| `src/registry/` | Every model: its controls, inputs, price and request |
| `src/components/`, `src/ui/`, `src/content/` | Screens, shared controls, and all wording |
| `migrations/` | The database tables, applied in order on first start |
| `seed/demo/` | The demo content |
| `docs/api/` | The API reference, one page per feature |
| `docs/hermes-on-orgo.md` | Running Supercomputer on a Hermes agent |
| `docs/ui/README.md`, `CONTRIBUTING.md` | How to build a screen, and how to build a feature |
| `deploy/` | Scripts to run the built app in the background, and to join it to an agent |

## How this was built

Parallax was built in a day by a swarm of coding agents working from a written product spec
and a design system, each on its own cloud computer, with one orchestrator merging the work.
The API notes in `docs/api/` and the rules in `CONTRIBUTING.md` and `docs/ui/README.md` are
the same ones the agents worked from.

## Contributing

Read [`CONTRIBUTING.md`](CONTRIBUTING.md). Agents: read [`AGENTS.md`](AGENTS.md) first.

## Licence

[MIT](LICENSE).

Parallax is an independent project. It is not affiliated with, endorsed by, or sponsored by
any company whose models, products or services it mentions or connects to. Model and product
names belong to their owners. The pictures in this repository were made with Parallax.
