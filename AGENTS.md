# AGENTS.md

## Scratch space

Throwaway files belong in `.scratch/` at the repo root. Use it freely for
request payloads, server logs, build artifacts you only need once, scratch
scripts, or anything else disposable.

- **Do not** use `/tmp`, `$TMPDIR`, `/var/folders/...`, or any other external
  temp directory for this project. Keep scratch inside the worktree.
- **Do not** ask before writing there. The folder is inside the workspace, so
  these writes need no permission prompt, and its contents are gitignored.
- The folder is tracked only via `.scratch/.gitkeep`, so it exists in a fresh
  clone. Recreate it with `mkdir -p .scratch` if it is ever missing.
- Clean up after yourself when a task finishes; nothing there is durable, and
  it should not become a second `target/` or `dist/`.
- Real deliverables still go in their proper place in the source tree. `.scratch/`
  is for things that are meant to be thrown away.
