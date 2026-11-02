
# Project Information

This repository contains the source code for https://beep8.xyz/.

The website is primarily static HTML, CSS and JavaScript. It is hosted on Cloudflare Pages and maintained through GitHub.

## Git Workflow

- This directory is already a Git repository cloned through GitHub Desktop.
- Git and the `origin` remote are already configured.
- DO NOT run `git init`, clone the repository again, or replace the remote.
- Use the existing Git repository for all version-control operations.
- Before editing, inspect `git status` and preserve any existing user changes.
- Work on the currently checked-out branch unless instructed otherwise.
- After completing changes, inspect the diff and run appropriate checks.
- Stage only files related to the task.
- Create a Git commit with a descriptive message after completing a successful task.
- Never use force pushes, destructive resets, or history rewrites without explicit permission.
- Do not push to GitHub unless explicitly instructed to deploy or publish.
- When instructed to deploy, push the current branch to its configured upstream.
- If authentication prevents pushing, report the issue. GitHub Desktop can handle the push instead.

## Deployment

- Cloudflare Pages deploys the website from the connected GitHub repository.
- Pushing to the configured production branch triggers a production deployment when automatic deployments are enabled.
- Do not assume a local commit has deployed the website.
- Avoid introducing unnecessary build tools, frameworks, or dependencies.

## General

- Preserve existing functionality unless changes are requested.
- Do not introduce secrets or credentials into the repository.
- Explain any unsuccessful Git operations.
