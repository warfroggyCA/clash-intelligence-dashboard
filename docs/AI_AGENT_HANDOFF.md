# Syncing Agent Changes with Your Local Repo

The agent works in a temporary environment and cannot push directly to your GitHub remote. Use one of the workflows below to transfer the committed changes on the `work` branch to your own machine and publish them.

## 1. Export a patch bundle from the agent session
1. Run the following in the agent container to create a bundle file:
   ```bash
   git bundle create agent-war-center.bundle HEAD
   ```
2. Download `agent-war-center.bundle` from the session (e.g., via the "Download" button in the workspace file browser).
3. On your local machine, apply the bundle:
   ```bash
   git clone <repo-url> clash-intelligence-dashboard
   cd clash-intelligence-dashboard
   git bundle verify /path/to/agent-war-center.bundle
   git pull /path/to/agent-war-center.bundle HEAD
   ```
4. After the pull succeeds, push to GitHub:
   ```bash
   git push origin HEAD:main
   ```

## 2. Generate a diff that can be applied locally
1. In the agent environment, export the diff:
   ```bash
   git diff --binary origin/main...HEAD > war-center.patch
   ```
2. Download `war-center.patch` to your machine.
3. Apply and commit locally:
   ```bash
   git apply war-center.patch
   git status  # review the applied changes
   git commit -am "Unify war prep and planning into single War Center page"
   git push origin main
   ```

## 3. Pull directly from the agent via GitHub Codespaces or SSH
If you have shell access to the agent container (e.g., through Codespaces), add your GitHub remote and push:
```bash
git remote add origin git@github.com:<your-org>/<repo>.git
git push origin HEAD:main
```
> Make sure your SSH key is available in the environment or use a PAT over HTTPS. This gives you an immediate push of the committed state.

---

Pick whichever method matches your tooling. The key point is that all desired work is already committed on the `work` branch in this environment; you simply need to transfer those commits to a location that can reach your GitHub remote.
