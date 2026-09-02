# Phase 10 — Release Candidate

## Outcome

Phase 10 converts the implemented prototype into a reviewable release candidate. It restructures the README around the problem, solution, actual architecture, setup, and demo; corrects architecture documentation to match the repository; consolidates API and test evidence; adds continuous integration; and runs the complete regression suite.

## Release artifacts

- Product-first root README with quick start, portfolio workflow, one-click demo, deployment boundary, and responsible-use statement.
- Implemented system and repository diagrams in Mermaid, versioned with the source.
- Consolidated API route and error documentation.
- Traceable automated and manual test-case catalog.
- GitHub Actions checks for backend and frontend release gates.
- Dedicated screenshot capture contract under `docs/screenshots`.

## Verification status

The backend/cross-layer suite contains 64 passing tests. The frontend suite contains 20 passing tests. Python lint and compilation, frontend lint, the eight-route production build, and the dependency audit pass.

The standard live dataset contains 5,588 applications. The Phase 9 smoke journey computes Customer A from LOW 0.00 to HIGH 85.43 and leaves the active portfolio summary unchanged. The release console now provides Live Monitor, Investigations, Network Intelligence, Dealer Intelligence, Portfolio Insights, and Simulation Lab workspaces.

## Open release gate

Repository screenshots remain pending because the in-app browser capture surface was unavailable during this run. No fabricated or unrelated headless-browser images were substituted. Phase 10 should be marked complete only after real captures of the Live Monitor and completed simulation journey are saved and reviewed.

## Production boundary

The public presentation frontend is available at [jaal-drishti.vercel.app](https://jaal-drishti.vercel.app) and includes deterministic same-origin demo handlers for every judge-facing workflow. The FastAPI contract is available separately at [backend-fawn-theta-78.vercel.app](https://backend-fawn-theta-78.vercel.app). A configured `NEXT_PUBLIC_API_BASE_URL` can still route the browser to that service, but durable portfolio state requires production storage. Enterprise authentication, authorization, privacy controls, audit retention, rate limiting, PostgreSQL, governed model storage, and asynchronous heavy workloads remain production integration work.
