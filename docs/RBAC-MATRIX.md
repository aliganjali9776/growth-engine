# BUILD 7C — RBAC matrix

Default grants are migrated for built-in roles only. Custom grants remain database-authoritative. Business titles never grant permissions.

Owner: all permissions, with last-Owner protection and Agent safety gates.
Admin: all except organization.archive and roles.manage; cannot assign/demote Owner.
Consultant: all business views and ordinary create/edit plus System organization/business-role edits; Agent ask/diagnose/recommend/prepare.
Manager and Editor: ordinary business create/edit, check-ins/reviews and Agent preparation; no organization-structure edits, cycle management, KR target changes, archives or approvals. Manager currently uses organization-wide operational scope; assigned-resource grants are deferred.
Viewer: module views and the read-only access matrix; no Agent ask/write/prepare/approve/execute, audit or member administration.

| Permission                | Owner | Admin | Consultant | Manager | Editor | Viewer |
| ------------------------- | ----- | ----- | ---------- | ------- | ------ | ------ |
| organization.view         | Yes   | Yes   | Yes        | Yes     | Yes    | Yes    |
| organization.update       | Yes   | Yes   | —          | —       | —      | —      |
| organization.archive      | Yes   | —     | —          | —       | —      | —      |
| members.view              | Yes   | Yes   | —          | —       | —      | —      |
| members.invite            | Yes   | Yes   | —          | —       | —      | —      |
| members.change_role       | Yes   | Yes   | —          | —       | —      | —      |
| members.suspend           | Yes   | Yes   | —          | —       | —      | —      |
| members.remove            | Yes   | Yes   | —          | —       | —      | —      |
| roles.view                | Yes   | Yes   | Yes        | Yes     | Yes    | Yes    |
| roles.manage              | Yes   | —     | —          | —       | —      | —      |
| audit.view                | Yes   | Yes   | —          | —       | —      | —      |
| system.view               | Yes   | Yes   | Yes        | Yes     | Yes    | Yes    |
| system.edit               | Yes   | Yes   | Yes        | Yes     | Yes    | —      |
| system.create             | Yes   | Yes   | Yes        | Yes     | Yes    | —      |
| system.archive            | Yes   | Yes   | —          | —       | —      | —      |
| system.approve            | Yes   | Yes   | —          | —       | —      | —      |
| system.organization.edit  | Yes   | Yes   | Yes        | —       | —      | —      |
| system.roles.edit         | Yes   | Yes   | Yes        | —       | —      | —      |
| system.process.edit       | Yes   | Yes   | Yes        | Yes     | Yes    | —      |
| system.sop.edit           | Yes   | Yes   | Yes        | Yes     | Yes    | —      |
| system.sop.approve        | Yes   | Yes   | —          | —       | —      | —      |
| system.kpi.edit           | Yes   | Yes   | Yes        | Yes     | Yes    | —      |
| system.improvement.edit   | Yes   | Yes   | Yes        | Yes     | Yes    | —      |
| strategy.view             | Yes   | Yes   | Yes        | Yes     | Yes    | Yes    |
| strategy.edit             | Yes   | Yes   | Yes        | Yes     | Yes    | —      |
| strategy.create           | Yes   | Yes   | Yes        | Yes     | Yes    | —      |
| strategy.archive          | Yes   | Yes   | —          | —       | —      | —      |
| strategy.approve          | Yes   | Yes   | —          | —       | —      | —      |
| strategy.cycle.manage     | Yes   | Yes   | —          | —       | —      | —      |
| strategy.objective.edit   | Yes   | Yes   | Yes        | Yes     | Yes    | —      |
| strategy.kr.edit          | Yes   | Yes   | Yes        | Yes     | Yes    | —      |
| strategy.kr.target_change | Yes   | Yes   | —          | —       | —      | —      |
| strategy.initiative.edit  | Yes   | Yes   | Yes        | Yes     | Yes    | —      |
| strategy.review.edit      | Yes   | Yes   | Yes        | Yes     | Yes    | —      |
| strategy.adapt.edit       | Yes   | Yes   | Yes        | Yes     | Yes    | —      |
| scale.view                | Yes   | Yes   | Yes        | Yes     | Yes    | Yes    |
| scale.edit                | Yes   | Yes   | Yes        | Yes     | Yes    | —      |
| scale.create              | Yes   | Yes   | Yes        | Yes     | Yes    | —      |
| scale.archive             | Yes   | Yes   | —          | —       | —      | —      |
| scale.approve             | Yes   | Yes   | —          | —       | —      | —      |
| scale.constraint.edit     | Yes   | Yes   | Yes        | Yes     | Yes    | —      |
| scale.experiment.edit     | Yes   | Yes   | Yes        | Yes     | Yes    | —      |
| scale.funnel.edit         | Yes   | Yes   | Yes        | Yes     | Yes    | —      |
| scale.channel.edit        | Yes   | Yes   | Yes        | Yes     | Yes    | —      |
| scale.loop.edit           | Yes   | Yes   | Yes        | Yes     | Yes    | —      |
| scale.readiness.edit      | Yes   | Yes   | Yes        | Yes     | Yes    | —      |
| scale.decision.approve    | Yes   | Yes   | —          | —       | —      | —      |
| agent.view                | Yes   | Yes   | Yes        | Yes     | Yes    | Yes    |
| agent.ask                 | Yes   | Yes   | Yes        | Yes     | Yes    | —      |
| agent.diagnose            | Yes   | Yes   | Yes        | Yes     | Yes    | —      |
| agent.recommend           | Yes   | Yes   | Yes        | Yes     | Yes    | —      |
| agent.prepare             | Yes   | Yes   | Yes        | Yes     | Yes    | —      |
| agent.approve             | Yes   | Yes   | —          | —       | —      | —      |
| agent.execute             | Yes   | Yes   | —          | —       | —      | —      |
| agent.audit.view          | Yes   | Yes   | —          | —       | —      | —      |

Agent preparation and execution additionally require all mapped target-domain permissions. Approval also requires the corresponding module.approve permission. Real server execution is disabled in 7C as required by scope section 110.
