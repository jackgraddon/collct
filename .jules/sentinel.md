## 2026-06-03 - [Authorization Bypass/Path Traversal in Blob Serving]
**Vulnerability:** The `/api/avatar/[...pathname]` endpoint allowed serving ANY blob from the storage by providing its pathname, as it lacked a prefix restriction. This enabled unauthorized access to private photos by simply providing their path (e.g., `/api/avatar/photos/user/123/secret.jpg`).
**Learning:** Using `blob.serve(event, pathname)` with an unfiltered `getRouterParam` is dangerous if the storage contains mixed-access or multi-tenant data.
**Prevention:** Always validate and enforce path prefixes when serving files from a shared blob storage via a dynamic route.
