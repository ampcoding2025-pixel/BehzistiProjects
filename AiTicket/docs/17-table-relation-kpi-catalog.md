# Table-Relation KPI Catalog (Didban → All Possible KPIs)

**Method:** Iterate every `DidehbanDb` table → map FK relations → form table groups → derive KPIs from each group → rank by business importance.  
**Scan date:** 2026-11-14 (read-only).  
**Scope:** 196 user tables · 310 FK edges · **115 non-empty** · **81 empty**.

**Rule used for empty data:** If a required table (or required FK column fill) is empty / unused → KPI status = **`Can't calculate (empty)`**. Do not show as a live metric.

Status keys:

| Status | Meaning |
|--------|---------|
| `Feasible now` | Tables + columns populated enough to compute |
| `Needs business rules` | Data exists; closed/eligible/SLA semantics need sign-off |
| `Weak / proxy` | Partial signal only |
| `Can't calculate (empty)` | Required table or column is empty / unused |
| `Low value / audit only` | Logs or ops telemetry, not citizen-case KPIs |

---

## 1. Schema inventory summary

| Bucket | Count | Notes |
|--------|------:|-------|
| Total tables | 196 | User tables only |
| Non-empty | 115 | Have ≥1 row |
| Empty | 81 | KPI modules that depend on them → blocked |
| FK edges | 310 | Declared relationships |
| Connected component (core OLTP) | 97 tables | Cookie-centric graph |
| SMS pair | 2 | `Sentbox` ↔ `Inbox` |
| Orphans (no FK) | 96 | Mostly `*Log`, temp copies, IVR raw |

### Hubs (most referenced / most outgoing)

- **Fact hub:** `Cookie` (29 outbound FKs; 21 inbound)
- **Workflow:** `CookieFlow`, `Cartable`
- **Citizen/geo:** `Inform` (1:1 with Cookie)
- **Lookups heavily referenced:** `UserInfo`, `Department`, `CookieStatus`, `CookieType`, taxonomy (`Subject*`), `Region`

---

## 2. Table groups (from relations)

### G1 — Case core (volume & classification)

| Table | Rows | Role |
|-------|-----:|------|
| `Cookie` | ~193,086 | Case / ticket |
| `Inform` | ~193,086 | Citizen + geo (1:1 Cookie) |
| `Subject` / `SubjectGroup` / `SubjectNature` / `SubjectClass` / `Zone` | lookups | Taxonomy |
| `SubjectPriority` | 3 | Priority lookup (FK always filled on Cookie) |
| `CookieChannel` / `CookieType` / `CookieStatus` | lookups | Channel / type / status |
| `Department` / `DepartmentChart` / `Region` / `Area` | lookups | Org + geo dims |
| `Flow` | 4 | Process template on case |

**Key relations:** Cookie → Subject* / Zone / Department / Channel / Status / Type / Flow / UserInfo / Agent; Inform → Cookie + Region/Area.

### G2 — Workflow & backlog

| Table | Rows | Role |
|-------|-----:|------|
| `CookieFlow` | ~632,837 | Status transitions + operator/citizen text + delay |
| `Cartable` | ~30,124 | Open workbasket snapshot |
| `FlowNode` | 109 | Allowed status transitions / roles |
| `TerminalStatus` | 29 | Candidate terminal statuses |
| `FeedbackStatus` | 3 | Feedback-linked statuses |

**Key relations:** CookieFlow/Cartable → Cookie + Status (+ PreStatus) + Department + taxonomy + UserInfo.

### G3 — Pursuit / follow-up

| Table | Rows | Role |
|-------|-----:|------|
| `CookiePursuit` | ~150,280 | Follow-up comments |
| `Cookie.CookiePersuitsCount` | ~29k > 0 | Denormalized pursuit signal |

**Relations:** Pursuit → Cookie, CookieFlow, Channel, UserInfo/Role.

### G4 — Citizen outbound messaging

| Table | Rows | Role |
|-------|-----:|------|
| `Sentbox` | ~208,823 | Outbound SMS/messages |
| `Inbox` | ~9,736 | Delivery/read side linked to Sentbox |
| `CookieFlow.CookieFlowReplyCitizen` | ~12,244 distinct Cookies | Citizen-facing answer text |

### G5 — Telephony

| Table | Rows | Role |
|-------|-----:|------|
| `CallReceived` | ~81,217 | Inbound call events (orphan — no FK) |
| `CallRecord` | ~31,974 | Calls linked to Cookie / Flow / Pursuit |
| `CallLog` / `CallLogLog` | large | Call telemetry / logs |

### G6 — People & access

| Table | Rows | Role |
|-------|-----:|------|
| `Agent` | ~69,517 | Citizen/agent registry (PII-heavy) |
| `UserInfo` | ~1,538 | Operators |
| `Role` / `RoleMember` / `RoleMemberAccess` | populated | RBAC / channel-dept access |
| `Workspace` / `WorkspaceMember` | small | Tenancy |
| `TrackUsers` | ~290k | Operator tracking events |

### G7 — Evidence / attachment visits

| Table | Rows | Role |
|-------|-----:|------|
| `AttachmentVisite` | ~75,723 | Who viewed attachments for a Cookie/status |
| `DidehbanAttachment` | n/a | Separate DB — **no access** for this login |

### G8 — System / audit logs (low product priority)

`HttpLog` (~1.4M), `CookieLog`, `InformLog`, `TotalSystemLog`, `LoginLog`, many `*Log` tables.

### G9 — Empty / unused modules (block related KPIs)

Empty tables (81). High-impact empties for KPIs:

| Empty table / unused FK | Why it blocks KPIs |
|-------------------------|--------------------|
| `Gift`, `GiftType`, `AgentGift*` | Gift / incentive KPIs |
| `Personnel`, `Executer*` | HR-linked assignee / executor KPIs |
| `Mission*`, `MayorMeeting`, `MeetingMember` | Field mission KPIs |
| `CheckList*`, `Chk*` | Inspection checklist KPIs |
| `ChatRoom`, `ChatMessage`, `ChatUser` | Chat CX KPIs |
| `Referal`, `Reminder`, `NotificationSentbox` | Formal referral / reminder KPIs |
| `CookieComment*`, `CookieShare`, `CookieUserNotification` | Social/comment KPIs |
| `Dictionary`, `PursuitTemplate`, `StatusMessage` | Template/knowledge KPIs |
| `District`, `Segment` | District/segment geo KPIs (`Inform` fill = 0) |
| `AgentSocialClass`, `AgentExpertise*`, `AgentGrade*` | Agent demographic KPIs |
| `Vehicle*`, `Equip*` | Asset KPIs |
| `SubjectChild`, `SubjectIndex`, `SubjectReference` | Extra taxonomy graph KPIs |
| `CookieFieldType` (0 rows) | Custom field KPIs |
| Deadline columns on Cookie/Flow/Cartable | **0 filled** → true SLA KPIs |

Also nearly-useless for KPIs: `CookieCause` (1 row, Cookie.CauseId fill = 0), `CookieHint` (8), `FAQ` (5), `Cookie.CookieIsCritical` (27), satisfaction score fields historically null/zero.

---

## 3. KPIs derived per table group

### From G1 — Case core

| ID | KPI | Tables / fields | Status |
|----|-----|-----------------|--------|
| V1 | Total cases in period | Cookie.CookieTime | Feasible now |
| V2 | Complaint count / rate | Cookie.SubjectClassId | Feasible now |
| V3 | Guidance / report / suggestion mix | SubjectClass | Feasible now |
| V4 | Volume by Subject / Group / Nature / Zone | Cookie + Subject* | Feasible now |
| V5 | Volume by Department | Cookie.DepartmentId | Feasible now |
| V6 | Volume by Channel | CookieChannel | Feasible now |
| V7 | Volume by Region / Area | Inform.RegionId / AreaId | Feasible now (Area ~87%) |
| V8 | Volume trend (day/month/year) | CookieTime | Feasible now |
| V9 | Critical-case rate | CookieIsCritical | Weak / proxy (27 rows) |
| V10 | Priority mix | SubjectPriorityId | Feasible now (always filled; confirm business meaning) |
| V11 | Linked/repeat cases | ReferringCookieId | Weak / proxy (410) |
| V12 | Cancelled-case rate | CookieCancelTime | Can't calculate (empty) |
| V13 | Cause mix | CookieCause | Can't calculate (empty) |
| V14 | Gift / incentive cases | Gift* | Can't calculate (empty) |
| V15 | District / Segment volume | District, Segment | Can't calculate (empty) |
| V16 | Custom field analytics | CookieFieldType | Can't calculate (empty) |
| V17 | Cases with registered Agent | Cookie.AgentId (~22.6k) | Feasible now (coverage KPI) |

### From G2 — Workflow & backlog

| ID | KPI | Tables / fields | Status |
|----|-----|-----------------|--------|
| R1 | Resolution / finish rate | CookieFinishTime (~98.5%) | Needs business rules |
| R2 | Avg / median resolution time | Finish − CookieTime | Needs business rules |
| R3 | Open backlog size | Cartable and/or Finish IS NULL | Needs business rules |
| R4 | Backlog aging | CartableTime / CookieTime | Needs business rules |
| R5 | Throughput (opened vs finished) | CookieTime vs FinishTime | Feasible now |
| R6 | Status mix / funnel | CookieStatus + Flow transitions | Needs business rules |
| R7 | Redistribution rate | statuses like 40 / flow Pre→Next | Needs business rules |
| R8 | Referral / escalate rate | status 31; ReferToUserId | Weak — ReferToUserId = 0 filled |
| R9 | True SLA compliance | *DeadlineTime | Can't calculate (empty) |
| R10 | Delay incidence / avg delay | CookieFlowDelayTime (>0 on ~351k flows) | Weak / proxy |
| R11 | Discontent signal rate | CookieFlowDiscontentCount | Weak / proxy (semantics TBD) |
| R12 | First-response time | first CookieFlow after CookieTime | Needs business rules |
| R13 | Steps per case | COUNT(CookieFlow)/Cookie | Feasible now |
| R14 | Terminal-status attainment | TerminalStatus ∩ CookieStatus | Needs business rules |

### From G3 — Pursuit

| ID | KPI | Status |
|----|-----|--------|
| P1 | Pursuit rate (% cases with pursuits) | Feasible now |
| P2 | Avg pursuits per pursued case | Feasible now |
| P3 | Pursuit reply coverage | Can't calculate (empty replies) |
| P4 | Template-driven pursuits | Can't calculate (`PursuitTemplate` empty) |

### From G4 — Citizen answers / SMS

| ID | KPI | Status |
|----|-----|--------|
| A1 | Historical answer availability (% Cookies with citizen reply) | Feasible now (~6.3%) |
| A2 | Answer coverage by Subject/Dept/Region | Feasible now |
| A3 | Outbound SMS volume | Feasible now (Sentbox) |
| A4 | SMS delivery / inbox ratio | Weak / proxy (Inbox ≪ Sentbox; semantics TBD) |
| A5 | FAQ knowledge coverage | Can't calculate (FAQ=5, negligible) |
| A6 | Dictionary / regulation KPIs | Can't calculate (Dictionary empty) |

### From G5 — Telephony

| ID | KPI | Status |
|----|-----|--------|
| T1 | Inbound call volume | Feasible now (CallReceived) |
| T2 | Calls linked to cases | Feasible now (CallRecord→Cookie) |
| T3 | Call-to-case conversion | Needs business rules (join rules) |
| T4 | Calls per pursuit / flow step | Feasible now |

### From G6 — Org / operator / agent

| ID | KPI | Status |
|----|-----|--------|
| O1 | Workload by Department (open/closed/incoming) | Feasible now |
| O2 | Workload by operator (UserInfo) | Feasible now (PII/RBAC) |
| O3 | Org hierarchy performance | Feasible now (DepartmentChart) |
| O4 | Role/channel access coverage | Feasible now (RoleMemberAccess) |
| O5 | Agent-linked case share | Feasible now |
| O6 | Personnel / executor productivity | Can't calculate (Personnel/Executer empty) |
| O7 | Agent social class / grade / expertise mix | Can't calculate (empty) |
| O8 | Operator activity from TrackUsers | Low value / audit-ish |

### From G7 — Attachments

| ID | KPI | Status |
|----|-----|--------|
| E1 | Attachment view events per case | Feasible now (visits only) |
| E2 | Evidence completeness / file KPIs | Can't calculate (Attachment DB inaccessible) |

### From G8 — Logs

| ID | KPI | Status |
|----|-----|--------|
| L1 | API/HTTP error rates | Low value / audit only |
| L2 | Login / access audit counts | Low value / audit only |
| L3 | Entity change volume (CookieLog…) | Low value / audit only |

### From G9 — Empty modules (explicit non-KPIs)

| ID | Would-be KPI | Blocker |
|----|--------------|---------|
| X1 | Mission completion / field visit KPIs | Mission* empty |
| X2 | Checklist compliance | CheckList* empty |
| X3 | Chat response time / CSAT via chat | Chat* empty |
| X4 | Formal referral cycle time | Referal empty |
| X5 | Reminder SLA | Reminder empty |
| X6 | Internal comment disagreement rate | CookieComment* empty |
| X7 | Case sharing / collaboration rate | CookieShare empty |
| X8 | Vehicle/equip utilization | Vehicle*/Equip* empty |
| X9 | Citizen satisfaction score | Score fields historically unusable |
| X10 | True deadline SLA | Deadline columns empty |

---

## 4. Master prioritized list (most → least important)

Importance ranking for **Behzisti Didban analytics** (citizen case platform): decision usefulness × data readiness.

### Tier 1 — Must have (executive + ops)

| Rank | KPI | Status | Why high |
|-----:|-----|--------|----------|
| 1 | V1 Total cases | Feasible now | Primary demand signal |
| 2 | V2 Complaint count / rate | Feasible now | Core Behzisti mix |
| 3 | R1 Resolution / finish rate | Needs business rules | Outcome quality |
| 4 | R2 Resolution time (avg/median) | Needs business rules | Citizen wait |
| 5 | R3 / R4 Backlog size & aging | Needs business rules | Ops pressure |
| 6 | V4 Volume by taxonomy (Nature/Group/Subject) | Feasible now | Policy targeting |
| 7 | V5 / O1 Volume & workload by Department | Feasible now | Accountability |
| 8 | V7 Volume by Region | Feasible now | Equity / geo |
| 9 | R5 Throughput (in vs out) | Feasible now | Capacity |
| 10 | V8 Trend over time | Feasible now | Seasonality / planning |

### Tier 2 — High value (service quality)

| Rank | KPI | Status |
|-----:|-----|--------|
| 11 | R12 First-response time | Needs business rules |
| 12 | A1 / A2 Answer availability & coverage | Feasible now |
| 13 | P1 / P2 Pursuit intensity | Feasible now |
| 14 | R7 Redistribution / reopen proxy | Needs business rules |
| 15 | V6 Channel mix | Feasible now |
| 16 | R13 Steps per case | Feasible now |
| 17 | R10 Delay proxy | Weak / proxy |
| 18 | R11 Discontent proxy | Weak / proxy |
| 19 | V3 Non-complaint mix | Feasible now |
| 20 | V10 Priority mix | Feasible now (confirm meaning) |

### Tier 3 — Useful supporting

| Rank | KPI | Status |
|-----:|-----|--------|
| 21 | T1–T3 Call volumes & call→case | Feasible / needs rules |
| 22 | A3 SMS outbound volume | Feasible now |
| 23 | O2 Operator workload | Feasible now (RBAC) |
| 24 | O3 Hierarchy rollup | Feasible now |
| 25 | E1 Attachment visit rate | Feasible now |
| 26 | V17 Agent-linked case share | Feasible now |
| 27 | R6 Status funnel | Needs business rules |
| 28 | A4 SMS delivery proxy | Weak / proxy |
| 29 | V11 Repeat/linked cases | Weak / proxy |
| 30 | O4 Access coverage | Feasible now |

### Tier 4 — Low priority / audit

| Rank | KPI | Status |
|-----:|-----|--------|
| 31–35 | L1–L3 log/audit KPIs, TrackUsers activity | Low value / audit only |
| 36 | V9 Critical rate | Weak (rare) |
| 37 | CookieHint usage | Negligible volume |

### Tier 5 — Can't calculate (empty) — do not ship as live KPIs

Show in UI only as **Unavailable / empty source**, never as 0% green.

| Rank | KPI | Empty blocker |
|-----:|-----|---------------|
| — | R9 True SLA compliance | Deadline columns = 0 |
| — | V12 Cancel rate | CookieCancelTime empty |
| — | V13 Cause mix | CookieCause unused |
| — | V14 Gift KPIs | Gift* empty |
| — | V15 District/Segment | District/Segment empty |
| — | V16 Custom fields | CookieFieldType empty |
| — | O6 Personnel productivity | Personnel/Executer empty |
| — | O7 Agent demographics KPIs | AgentSocialClass/Grade/Expertise empty |
| — | P3 Pursuit replies | replies empty |
| — | P4 Pursuit templates | PursuitTemplate empty |
| — | A5/A6 FAQ/Dictionary | empty/negligible |
| — | E2 Attachment file KPIs | Attachment DB no access |
| — | X1–X8 Mission/Checklist/Chat/Referral/Reminder/Comment/Share/Asset | tables empty |
| — | X9 Satisfaction score | unusable scores |
| — | R8 ReferToUser escalation | ReferToUserId never filled |

---

## 5. Recommended product rule

1. **Build Tier 1–2** first (already largely aligned with Executive / Analytics pages).  
2. For every Tier 5 item: badge **`Can't calculate (empty table/field)`** with the blocking table name.  
3. Do **not** invent SLA or CSAT from empty deadlines/scores.  
4. Re-run this scan when empty modules start receiving data — promote KPIs automatically when `rows > 0` and fill rate clears a threshold.

---

## 6. Artifacts from this scan

Raw scan outputs (local, not for commit of secrets):

- `docs/_schema_scan/tables.json`
- `docs/_schema_scan/fks.json`
- `docs/_schema_scan/columns.json`
- `docs/_schema_scan/table_relations.json`
- `docs/_schema_scan/fill_rates.json`

Interactive view: canvas `didban-relation-kpi-catalog.canvas.tsx`.
