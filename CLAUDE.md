# order-manager — agent rules

## Shared checkout protection (CRITICAL)

This directory is a SHARED working copy: the developer, interactive Claude Code
sessions, and background automation (issue→PR bots) all operate on this same
folder, and a Vite dev server often serves it live via the accxui symlink.

If you are an automation or background agent (issue→PR bot, scheduled task,
headless session):

- NEVER run `git stash`, `git reset --hard`, `git checkout <branch>`,
  `git clean`, or anything else that mutates this checkout's HEAD, index, or
  working tree. Uncommitted work belonging to the developer or another session
  is routinely present here; these commands destroy it.
- ALWAYS do your work in an isolated worktree instead:
  `git worktree add .claude/worktrees/<task-name> origin/main`
  then operate exclusively inside that directory and remove it when done.
- If you find this checkout dirty, that is not yours to clean. Leave it alone.

Interactive sessions: commit or push work-in-progress early — background
automation has destroyed uncommitted work in this checkout before.
