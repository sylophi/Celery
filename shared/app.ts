// App identity, shared by the build config (forge.config.ts) and
// runtime code so a rename can't leave a stale copy behind in one of
// them (a stale feed repo would silently kill auto-update).
export const APP_BUNDLE_ID = "com.sylophi.celery";
// GitHub repo: release publishing (forge) and the update feed (main)
// must point at the same place.
export const REPO = { owner: "sylophi", name: "celery" };
export const REPO_SLUG = `${REPO.owner}/${REPO.name}`;
