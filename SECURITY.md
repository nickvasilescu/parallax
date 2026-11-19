# Security

Parallax is young software. Treat it as a starting point, not a hardened service.

**Reporting a problem.** Please do not open a public issue for a security problem. Use
GitHub's "Report a vulnerability" button on this repository (Security tab), and include the
steps to reproduce it.

**Before you put it on the internet**

- Serve it over HTTPS and set `COOKIE_SECURE=1` and `PARALLAX_ORIGIN`.
- Set `TREG_DAILY_BUDGET_USD`. It caps what the server can spend in a day.
- Payments are not connected. Credits are granted by the app itself; do not sell them.
- If the agent runs on a Hermes agent, read the warning in
  [`docs/hermes-on-orgo.md`](docs/hermes-on-orgo.md): the agent's own tools are not behind
  Parallax's approval cards. Use a narrow agent for anything public.
- Keys live in `.env.local` or in files named by `*_FILE` settings. Never commit them.
