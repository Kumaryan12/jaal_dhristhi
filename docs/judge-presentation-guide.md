# Judge Presentation Guide

## One-sentence message

**JaalDrishti reveals coordinated lending risk that individual application checks cannot see, then gives a human analyst traceable evidence and an actionable recommendation.**

## Three-minute live walkthrough

Open `http://localhost:3000/demo`, select **Presentation view**, and keep the page at the top.

| Time | Screen | Talk track |
|---|---|---|
| 0:00–0:25 | Scenario context | “Most lending systems assess an application as an individual record. Emerging risk often exists between records—in shared identities, concentrated dealers, and application timing.” |
| 0:25–0:50 | Five-stage processing path | “We receive the application, discover shared identities, form the relationship network, calculate explainable risk, and route the evidence to a human decision.” |
| 0:50–1:05 | Simulation button | “This is a live, isolated backend computation. The score you are about to see is not scripted in the interface.” Select **Start Simulation**. |
| 1:05–1:35 | Live process outputs | “Six applications are created, device and dealer identities are resolved, the graph is assembled, the two-hour burst is evaluated, and evidence is converted into a review action.” |
| 1:35–2:00 | LOW-to-HIGH comparison | “Customer A looks LOW risk in isolation. The borrower has not changed; the connected context has. Five linked applicants push the ecosystem assessment to HIGH.” |
| 2:00–2:30 | Evidence cards and graph | “The system can show exactly why: six applicants share one device, they concentrate at one dealer, and the activity occurs inside two hours.” |
| 2:30–2:50 | Explanation and action | “Rules, graph signals, temporal signals, and ML support the score. The ranked evidence recommends enhanced verification, but the final lending action remains human-authorized.” |
| 2:50–3:00 | Judge conclusion | “JaalDrishti is an integration layer for earlier intervention. It does not replace the lending system or the analyst—it reveals the ecosystem both were missing.” |

## The process in plain language

1. **Observe:** ingest applications and their device, account, dealer, location, and event-time identifiers.
2. **Resolve:** convert repeated identifiers into weighted, evidence-backed relationships.
3. **Connect:** represent customers and shared entities as a graph.
4. **Detect:** calculate bursts, velocity, recency, network growth, and graph concentration without using future information.
5. **Explain:** combine transparent policy evidence with a versioned ML probability into a bounded risk score.
6. **Decide:** show the analyst the ranked signals, thresholds, involved entities, and recommended action.

## Likely judge questions

### Is the demo score hardcoded?

No. The button calls `POST /api/v1/demo/simulate`. The backend creates a separately namespaced scenario, resolves its graph, calculates temporal features, applies the risk engine, and returns the before/after states and explanations.

### Why use a graph instead of only a tabular model?

A row describes one application. A graph preserves relationships across applications, including shared devices, accounts, dealers, and locations. Those relationships are the product signal that an isolated row loses.

### What does time add?

A shared identifier may be benign over a long period. Six linked applications inside two hours carry a different operational meaning. Point-in-time temporal features distinguish established reuse from rapid emergence and avoid future leakage.

### Is this an autonomous rejection engine?

No. It is a decision-support layer. High-risk evidence routes an application to enhanced verification; a human analyst retains final authority.

### Where is AI used?

The production score is hybrid: deterministic rules, graph evidence, temporal evidence, and a versioned ML probability. High-confidence evidence floors cannot be erased by model output, and the displayed explanation remains grounded in inspectable signals.

### Can it integrate with an existing lender?

Yes. The intelligence layer is exposed through a versioned FastAPI contract and can sit beside an LOS or LMS. The current prototype uses synthetic data and SQLite; enterprise identity, governance, and production storage are explicit deployment boundaries.

## Before presenting

- Confirm `http://127.0.0.1:8000/health` reports `dataset_ready: true`.
- Confirm `http://localhost:3000/` and `/demo` load successfully.
- Use a desktop viewport and select **Presentation view**.
- Run the simulation once before the session to confirm the API connection, then select **Run a fresh scenario** during the presentation.
- Keep the core contrast crisp: **individual view versus ecosystem view**.
- Say “risk intelligence” or “enhanced verification,” not “automatic fraud rejection.”
