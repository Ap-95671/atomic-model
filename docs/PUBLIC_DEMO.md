# Public-demo architecture and current Railway status

The advanced local application remains loopback-only by default. A separate
bounded public ASGI/Docker mode is now implemented and container-tested; Railway
activation is blocked by the signed-in account's paid-upgrade requirement and
the owner's free/trial-only budget. **No HTTPS service is deployed.** See
[deployment status](RAILWAY_DEPLOYMENT.md) for implemented controls, tests and
exact next steps. The architecture discussion below remains background for
future live chemistry/multi-user expansion. Static frontend hosting alone does
not provide Python APIs.

A suitable future public demo can serve a built frontend and precomputed,
provenance-preserving scientific examples from a CDN. Route inexpensive,
allowlisted core models to a dedicated service with request/body limits,
per-client quotas, rate limiting, global concurrency and response/cache limits.
Keep expensive PySCF jobs disabled by default on public endpoints. Precompute
bounded example jobs instead of exposing unrestricted chemistry workloads.

If live chemistry is explicitly required later, isolate each fixed-protocol
worker in an unprivileged process/container with hard CPU/wall/RSS/disk limits,
no user code/shell, no host-file access, no secrets and no outbound network.
Use a bounded queue with cancellation/reaping, authentication/quotas, scratch
cleanup and structured observability. PySCF's `max_memory` is a workspace hint,
not a hard operating-system memory limit. The local origin check is not public
authentication, comprehensive host validation or multi-tenant isolation.

The present local service already bounds handler threads, compute slots,
catalogs, basis sizes and worker wall time, and implements actual cancellation.
Those useful local safeguards do not establish adversarial multi-tenant safety.
A deployment would still need transport security, origin/host policy, process
limits, dependency review and real load/security testing. Choose and validate
that architecture before presenting any public endpoint as production-ready.
