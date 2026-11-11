# Publishing prepared patches

The **Publish prepared patch** workflow lets an agent publish a small Git diff even when
its repository connection cannot upload a large complete file. For example, changing a
few lines in a lockfile does not require sending that entire file through a tool call.

Dispatch `publish-prepared-patch.yml` on `main` with:

- `base_sha`: the exact current `main` commit used to prepare the diff.
- `patch_base64`: a base64-encoded UTF-8 Git patch, at most 60,000 encoded characters.

The workflow rejects a stale base and reuses the dependency publisher's safeguards:
patches cannot change workflows, agent instructions or environment files. It never runs
code from the patch. The workflow creates a new `codex/prepared-patch-…` branch and records
its name in the run summary. It cannot overwrite an existing branch or update `main`.

After the workflow succeeds, the agent uses its existing repository connection to open
a pull request from that branch. Opening the PR separately ensures its checks run under
the normal pull-request event. The workflow does not open or merge PRs, bypass review,
or deploy changes. It uses the job's short-lived repository token; no additional secret
or token copied into the agent's computer is required.

Review the diff for private data before dispatching: workflow inputs and published code
must be suitable for the repository's visibility. Larger patches or changes to excluded
files require the existing normal repository publication path.
