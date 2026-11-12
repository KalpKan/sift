#!/bin/sh
# Vercel "Ignored Build Step" (vercel.json ignoreCommand runs this).
# Exit 0 = skip the build, exit 1 = build. ANY other exit code fails the
# deployment (incident 2026-11-12), so every path below ends in 0 or 1.
#
# Build unless nothing outside docs/scripts/ios/STATUS.md/*.md changed since
# the last deployed commit:
#   - VERCEL_GIT_PREVIOUS_SHA unset (first deploy): build. Never fall back to
#     HEAD^, which only sees the tip commit and lets a trailing docs commit hide
#     code commits pushed with it.
#   - previous commit missing from Vercel's shallow clone: build (git diff
#     would exit 128 and fail the deploy).
[ -n "$VERCEL_GIT_PREVIOUS_SHA" ] || exit 1
git cat-file -e "$VERCEL_GIT_PREVIOUS_SHA^{commit}" 2>/dev/null || exit 1
if git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" HEAD -- . ":(exclude)docs" ":(exclude)scripts" ":(exclude)STATUS.md" ":(exclude)ios" ":(exclude)*.md"; then
  exit 0
fi
exit 1
