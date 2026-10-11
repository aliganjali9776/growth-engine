# BUILD 5E — Scalability readiness, capacity and decisions

Verified locally on 2026-10-04. This is a local-first implementation; it does not introduce a backend or execute business decisions outside the app.

1. **Built:** readiness portfolio/detail, capacity workspace, explicit scale decisions, preparation items, scenario analysis and assessment history. Routes: `/scale/readiness`, `/scale/readiness/[id]`, `/scale/capacity`, `/scale/scale-decisions`.
2. **Candidate architecture:** optional `readinessData` extension of the existing Scale store; separate candidate, capacity area, scenario, financial assessment, investment need, preparation item, decision and snapshot records. Domain code is under `lib/scale/readiness`; editors and views are under `components/scale`.
3. **Dimensions:** demand 15%, repeatability 15%, economics 10%, sales 10%, delivery 15%, team 10%, process 10%, founder independence 5%, finance 5%, data 5%.
4. **Demand evidence:** source-specific evidence from channels, loops, completed experiments, validated ideas, funnel periods or explicitly entered management evidence. Independent positive periods are distinguished from a single result.
5. **Repeatability:** unproven/early/repeatable assessment; one successful event cannot establish repeatability. Experiment lineage is disclosed rather than treated as independent replication.
6. **Economics:** current scoring uses known channel revenue/spend; absent comparable economics stays unknown. Funnel calculations support scenario requirements. This is not a margin, profitability or cash-flow model; economics for other source types is limited.
7. **Sales capacity:** current capacity/load, scenario requirement, utilization and gap, with units, period, owner and source. A mapped funnel stage can supply the required volume.
8. **Delivery capacity:** operational areas include projects, consulting, service hours, fulfillment, manufacturing, inventory, suppliers, logistics and other business-model-specific resources.
9. **Team capacity:** explicit role/resource capacity and critical-role gaps. Different units are not aggregated. No workforce scheduling.
10. **Process readiness:** only candidate-linked processes contribute standardization, adoption and KPI signals; missing components remain unknown. Process health is also displayed and can produce a risk.
11. **Founder independence:** linked process independence and recorded founder dependency both matter; high dependency remains a risk even when a test score is high.
12. **Financial capacity:** seven qualitative categories, each with evidence; unknown, strong, adequate, watch and constrained. Numeric cash forecasts are not invented.
13. **Formula:** weighted mean of known components, normalized by known weight. Coverage is shown separately; unknown does not become zero or automatically mean readiness.
14. **Confidence:** combines evidence depth, coverage and source coverage. Management-only evidence is capped. Completeness is a separate checklist, not the readiness score.
15. **Scale gate:** insufficient data / hold / prepare / ready for review; readiness requires adequate evidence, capacity and coverage. It never records a management decision automatically.
16. **Capacity gaps:** required minus available, with current/projected utilization. Default operational thresholds are 70% and 90%, configurable; explicit target loads override the linear scenario assumption.
17. **What breaks first:** risks ranked by severity and relative capacity gap. The UI discloses the basis; this is not a prediction of failure timing.
18. **Next constraint:** the next ranked risk is shown as a potential bottleneck after the first is resolved.
19. **Decision:** Scale now / Prepare then scale / Experiment more / Hold / Stop, with reviewer role, reason and review acknowledgement. Each decision captures the current assessment.
20. **Preparation:** category, owner, due date, status, process link and notes. Completion updates progress, not the readiness score. Investment needs can be qualitative or carry a rough amount and unit.
21. **Growth/capacity matrix:** high/low evidence against high/low capacity, with unknowns kept separate.
22. **Snapshots:** stored copies of the assessment, scenario, capacity, finance, preparation and selected source context; later source edits do not rewrite earlier records. A new assessment does not change the explicit decision.
23. **System integration:** read-only linked process health, standards, adoption, KPI, ownership, independence and 30-day test context.
24. **Strategy integration:** read-only objective, key result, priority and cycle context. A link alone is not claimed to prove strategic alignment.
25. **Growth integration:** entries from channel, loop, positive completed experiment, funnel and constraint views; Scale home summarizes candidates, preparation and bottlenecks.
26. **Persistence:** optional store extension keeps older data compatible. Runtime validation and transition checks guard references, numeric values, status changes and immutable history. Browser test data was created only on localhost.
27. **Tests:** all 497 tests passed, including 29 readiness tests. Coverage includes A–W domain scenarios, unknown values, gate behavior, capacity, independent evidence, snapshots, persistence and a 10-candidate/20-area dataset. Production build and TypeScript passed. No dependency was added.
28. **Browser QA:** created a candidate linked to a channel and System process; created a 2x funnel scenario; entered sales, delivery and team capacity; saved financial readiness; recorded Prepare then scale; added and completed preparation; reassessed and refreshed. Original assessment remained 48 with delivery as first risk; changing delivery capacity from 12 to 30 produced 60 with sales as first risk. The earlier decision remained intact. Scale home showed one completed preparation item. Desktop 1440px, tablet 768px and mobile 390px showed no document-level horizontal overflow; navigation has its own horizontal scroll. Console error/warning inspection was empty. Four readiness routes returned HTTP 200 (the missing-record route uses an application-level missing state).
29. **Dependencies:** unchanged; existing Next.js, React, UI and test tooling only.
30. **Issues encountered:** fixed duplicate React sibling keys that caused duplicate financial forms; fixed date-input handling so preparation due dates persist; fixed floating-point rounding in funnel backsolve that could overstate required volumes. Remaining presentation limitations: a few evidence strings expose English enum values, and capacity/decision routes reuse a long shared workspace. Browser verification covered the listed workflow, not every possible source and business model. Snapshot source context is selected context, not a full historical clone of System/Strategy stores.
31. **BUILD 5F:** the final Scale executive dashboard and cross-portfolio decision presentation remain outside 5E. Advanced finance, cash flow, scheduling, inventory optimization, ERP, AI forecasting/advice, backend and authentication were not introduced.

## Verification artifacts

- `.build5e-tests.txt`: latest complete test run.
- `.build5e-build.txt`: production build output.
- `build5e-current.jpg`: local browser view.

The local application runs at http://127.0.0.1:3000/scale/readiness. Localhost has the acceptance-test records; its browser storage is separate from 127.0.0.1.
