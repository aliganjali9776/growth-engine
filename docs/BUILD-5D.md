# BUILD 5D — Growth Channels, Portfolio and Growth Loops

Completed 2026-10-03. Scope: local browser prototype, Growth Engine by 1 Minute Manager. Browser mutations were confined to `http://localhost:3000`; no System or Strategy records were edited.

1. **What was built.** Channel portfolio/detail routes at `/scale/channels` and `/scale/channels/[id]`, loop portfolio/detail routes at `/scale/loops` and `/scale/loops/[id]`, editors, period history, evidence, decisions and cross-module relationships. Scale landing summarizes these records. Missing IDs show a recovery link.

2. **Channel model.** Seventeen categories cover digital, referral, partnership, events, direct sales, distribution and custom channels. Each channel has an owner role, audience, description, lever, funnel entry stage and optional Strategy/System references. Six lifecycle states are separate from five maturity levels. New channels begin exploring/unproven; retirement preserves history.

3. **Channel metrics.** Weekly/monthly/custom periods hold optional spend, leads, qualified leads, opportunities, customers, attributed revenue, repeat customers, impressions, clicks and custom measurements. Unknown values remain null. Conversion, qualification, repeat rate, spend per lead/qualified lead/customer and revenue/customer/qualified-demand per spend use available inputs and positive denominators. Acquisition Spend per Customer is explicitly not full CAC. Attribution is manual primary or assisted; currency is stored per period.

4. **Channel quality.** Explained descriptive signals distinguish insufficient data, weak, watch, promising and strong. Qualified demand and customer creation matter; raw reach is not sufficient. Internal period changes are evidence, not proof of causality or external benchmarks.

5. **Channel maturity.** Managers explicitly record maturity decisions. Evidence summarizes completed experiments and independent positive primary-source periods. Overlapping periods do not count as independent repetitions; mixed cadences do not inflate this count. A Win or high revenue does not automatically make a channel scalable.

6. **Channel trend.** Compatible non-overlapping periods show changes in leads, qualified leads, customers, revenue, spend and conversion percentage points. Different attribution/cadence suppresses comparison; money comparisons require matching currency. Raw counts are not normalized for period length, and the UI states that comparability remains a management judgment.

7. **Concentration.** Top-one and top-two shares use qualified demand from primary sources with exactly matching start/end dates. Assisted sources are excluded. Missing primary-period coverage is explicit; partial shares are not represented as the whole portfolio. The browser fixture produced 72% and 90% from qualified-demand counts 72/18/10.

8. **Resilience.** A conservative description considers concentration, meaningful channels, repeated customer evidence, owner distribution and paid-channel dependence. Incomplete coverage returns unknown. A concentrated portfolio can perform well while still being fragile; this distinction is visible.

9. **Channel decisions.** Explore, continue, invest, optimize, reduce, pause and retire record reason, owner, date, source review and previous/new lifecycle and maturity. Scaling/scalable changes require explicit economics and capacity review. Decision records are append-only. Linked System context is copied into the review text at decision time.

10. **Scale Readiness.** Explained weights: evidence 25%, repeatability 25%, economics 20%, funnel contribution 15%, capacity 15%. Unknown components are excluded from the score denominator and shown through separate coverage. A high score with incomplete coverage is not proof of readiness or profit. Economics uses recorded revenue/spend, not full margin or CAC/LTV.

11. **Funnel integration.** Channels reference a funnel entry stage and record manual period contribution. Funnel stage detail lists each contribution with dates and attribution, independently from the funnel's own counts. Browser verification displayed 72 attributed qualified leads without altering the funnel's 132 qualified leads.

12. **Experiment integration.** Draft experiments can be associated with channels, loops and target nodes. Started/cancelled experiment relationships are locked by transition validation. Detail pages expose associated experiment outcomes and existing learning records; no automatic outcome attribution occurs.

13. **Strategy/System integration.** Objective/KR references, role ownership and process capacity context reuse existing read-only sources. Links do not imply confirmed strategic alignment. System health, independence and founder-dependency warnings remain visible; no write is made to those stores.

14. **Growth Loop model.** Nine loop types, seven statuses, owner, hypothesis, input, value, output, re-entry mechanism, primary metric, cycle time, stated evidence level and dependency. A funnel is a conversion path; a loop must explain how output supplies later input.

15. **Loop Designer.** Ordered editable nodes have names/descriptions, owners, metrics and optional channel/funnel references. Nodes can move and be retired without deleting history. An explicitly educational referral structure creates six nodes without inventing measurements or evidence.

16. **Loop metrics.** Reuses GrowthMetric definitions and the existing custom-metric editor. Periods capture main output, input volume, observed cycle time and optional node observations. Output/input and adjacent-node ratios are descriptive; they are not a viral coefficient and require compatible business definitions.

17. **Loop readiness.** Active/strengthening requires at least two active nodes, a valid owner in the editor, a primary metric, evidence and a re-entry explanation. The browser rejected activation without evidence, then accepted activation after explicit evidence capture. Evidence readiness is distinct from measured performance strength.

18. **Loop strength.** Unproven, weak, emerging, repeatable and strong use measured output, comparable trend, readiness and leakage. Repeated strength requires three positive non-overlapping periods with matching primary metric/name/unit and node structure. Changed node definitions suppress trend comparison. These are transparent rules, not statistical causal claims.

19. **Loop leakage.** Record a node, explanation and severity; retain the record and mark it resolved. Open leakage informs strength/attention. A leakage can create an inbox idea or candidate constraint, preserving the primary growth constraint. The test fixture created an idea for irregular referral requests.

20. **Loop history.** Explicitly completed periods freeze loop and node definitions plus metric label/unit. Historical output, cycle time, observations and ratios remain tied to that snapshot. Two browser periods showed output 2 → 3, delta +1 and latest output/input 15%.

21. **Idea/Experiment integration.** Leakage-created ideas retain node/leakage links. Existing ideas, constraints and draft experiments can register channel/loop associations. GrowthLearning is linked by ID rather than copied into a competing learning store. UI verification attached an existing learning and EXP-3 to the referral loop/node.

22. **Needs Attention.** Signals cover missing owners, stale active-channel periods, scaling without repeated evidence, spend without qualified demand, rising cost without demand growth, falling conversion, incomplete active-loop readiness, absent evidence, declining output, weak loops without experiments and critical leakage. Portfolio concentration is separately highlighted.

23. **Historical integrity.** Transition guards reject edits/deletion of completed periods, evidence and decision history; nodes/channels/loops are retained through lifecycle changes. New periods must first be drafts. Initial channel maturity cannot bypass its exploring/unproven starting state through generic persistence. Current source role labels can change because external roles remain read-only references; historical channel/node/metric definitions are frozen.

24. **Persistence and architecture.** `lib/scale/network/{model,logic,validation,mutations}.ts` separates models/calculations/validation/commands. Client UI lives in five Scale components. Optional `networkData` extends the existing `growth-engine.scale.v1` store, preserving older Scale, experiment and funnel data. Existing safe persistence/recovery remains in use. This is origin-local storage, with no server backup, authentication or multi-user synchronization.

25. **Tests/results.** `npm.cmd test`: **468 passed, 0 failed**, including 35 network tests and the earlier 433 tests. Coverage includes creation, unknown values, ratios, concentration, no automatic maturity, links, decisions, activation gate, leakage, immutable history, refresh serialization, old-store compatibility, overlapping evidence and changed loop structure. `npx.cmd tsc --noEmit` passed. Production build passed. Test and build runs were sequential.

26. **Browser QA.** Production server on port 3000. Created three labeled synthetic channels, four completed channel periods, one decision, a six-node loop, evidence, two loop periods, a leakage and an idea; reused existing learning and draft experiment. Confirmed concentration 72%/90%, channel qualified-demand delta +12, conversion delta about +0.9 points, unknown spend, locked historical fields, activation guard, primary-constraint preservation, funnel contribution, refresh, Scale summary, category filtering and missing-ID recovery. Desktop 1440×1000, tablet 768×1024 and mobile 390×844 were inspected; tested pages had no document-level horizontal overflow. Captured console contained no warnings/errors or hydration errors. Nine routes and 17 referenced JS/CSS assets returned HTTP 200. This is scoped UI QA, not an exhaustive browser/device compatibility certification.

27. **Dependencies.** No dependencies added. Existing Next.js 16.3.5, React, shared drawers/forms and local styling are reused.

28. **Issues encountered.** Browser automation initially matched seven identically labeled owner selectors in the loop designer; scoping the loop owner resolved the test ambiguity. Review found that overlapping periods could overstate repeatability and changed loop structures could produce misleading comparisons; both were hardened with regression tests. No unresolved startup/build/console errors were observed. Attribution remains manual; period cohorts and business definitions still need human review. Cost metrics do not include unrecorded costs, profit, or lifetime value.

29. **Remaining for BUILD 5E.** No Build 5E features were started. Await its specific brief. Full CAC/LTV, multi-touch attribution, cohorts, automated attribution, viral coefficients, forecasting, the final Scale Executive Dashboard, AI advisor, backend and authentication remain outside 5D. Operational deployment would also require persistence, access control and recovery work beyond this local prototype.

## Browser evidence

![Channel portfolio desktop](build5d-channels-desktop.jpg)

![Loop structure desktop](build5d-loop-desktop.jpg)
