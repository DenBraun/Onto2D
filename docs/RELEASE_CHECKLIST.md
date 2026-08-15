# Release Checklist

Use this checklist before tagging the first kernel release or publishing any
`@onto2d/*` workspace.

## Required evidence

- [ ] The release commit is reviewed and the worktree is clean.
- [ ] `npm ci --ignore-scripts` succeeds from the committed lockfile.
- [ ] `npm test`, `npm run check`, and `npm run build` pass.
- [ ] `npm run check:goldens` passes and the canonical fixtures receive an
  [independent review](REVIEW_GUIDE.md#independent-golden-review).
- [ ] All Ubuntu, macOS, and Windows jobs pass on Node.js 22 and 24.
- [ ] `npm audit --audit-level=high` reports no known vulnerability.
- [ ] `npm pack --dry-run --json --workspaces` contains only intended runtime,
  type, README, schema, package-manifest, and license files.
- [ ] Fresh temporary-project imports succeed from the packed tarballs.
- [ ] `CHANGELOG.md`, package versions, and release notes agree.

## GitHub release

1. Commit the complete reviewed release candidate.
2. Wait for every required CI matrix job to pass on that exact commit.
3. Confirm independent review of the frozen canonical and skeleton fixtures.
4. Replace `Unreleased` in the changelog with the release date.
5. Create the annotated `v0.1.0` tag and publish a GitHub release from it.

## Optional npm publication

The root workspace is private. Publish only the scoped workspaces, with public
access, after the GitHub release commit is fixed. Publish the dependency-free
kernel, schemas, and scientific boundary before adapters that depend on the
kernel. Verify each registry tarball after publication.
