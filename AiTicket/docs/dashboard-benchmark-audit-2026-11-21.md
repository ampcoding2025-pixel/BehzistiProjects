# Management Dashboard Benchmark Audit

**Audit date:** 2026-11-21

**Scope:** AiTicket management dashboard at `management-dashboard/`, its
read-only ASP.NET analytics API, and the checked-in Didban schema/profile notes.

**Benchmark:** The KPI, HBI, drill-down, and advanced-analytics requirements in
the user-provided Social Complaints Dashboard Benchmark.

## Scope, evidence, and confidence

This is a source-code and stored-schema audit, not a live database assessment.
The repository contains a Next.js/React dashboard and ASP.NET API; no PBIX,
DAX model, or Power Query project was found. The API opens Didban SQL connections
with `ApplicationIntent.ReadOnly`; this audit performed no database writes or
schema changes. Schema and fill-rate evidence comes from checked-in read-only
scans (latest schema handoff dated 2026-11-14) and the related Didban inspection
notes (2026-11-11). The initial audit did not verify live values; subsequent
read-only checks are recorded below.

“Dashboard” below means the seven visible management pages. Additional API
capabilities are called out separately where they exist but are not wired into
those pages. No benchmark-specific HBI formula was assumed.

The source domain is Behzisti Didban (`Cookie` = case), not an assumed Social
Security domain. Product labels and business definitions should be confirmed
with stakeholders before using the dashboard for formal performance decisions.

### Implementation follow-up — 2026-11-21

After the source audit, the dashboard/API were updated to add a complaint-count
card, a full-cohort average resolution-duration KPI, filter-aware current
backlog/aging, and a department table with incoming, finished, open, aging, and
average-resolution measures. Selecting a department from that table or chart
applies the department filter and opens resolution analysis. The HBI panel
reports that no score is available and links to the measurable backlog
components; it does not invent an HBI score because validated SLA, stage-wait,
and staffing-capacity data are still missing. These changes were type-checked and the API built.

### KPI calculation verification — 2026-11-21

The overview now requests the all-case KPI row with no subject-class filter
while retaining the selected period/geography/department filters. The complaint
row uses `SubjectClassId=1` and the dedicated complaint-count KPI. Thus selecting
“شکایت” in the global filter or returning from a complaint drill no longer
duplicates complaint-only values in both rows. Finished/open labels clarify
that these are counts from the selected intake cohort. The overview median is
marked “sample limited”; its median/P90 use at most the latest 5,000 valid
completion durations, while average duration uses the full valid cohort.

Read-only API results for the YTD comparison verified the arithmetic:
all cases 25,463 = 24,313 timestamp-finished + 1,150 unfinished; complaints
6,054 = 5,313 timestamp-finished + 741 unfinished. Complaint share is 23.8%,
the complaint-cohort timestamp-finish ratio is 87.8%, the complaint pursuit
ratio is 54.3%, and mean valid completion duration is 11.8 calendar days.
The complaint total also matched the demand endpoint’s complaint-class count.
These are observed values for the tested filter/time and can change as data
changes; timestamp completion is still not an approved status-resolution
definition. Sections below describe the original audit findings unless this
follow-up says otherwise.

## Deliverable 1 — Executive Assessment

### Overall maturity

**Early operational reporting / decision-support prototype; not yet a
decision-grade root-cause system.** The dashboard has real read-only SQL
aggregates, shared filters, monthly trends, topic and provincial comparisons,
backlog aging, and explicit data-quality caveats. Its best foundation is the
combination of a usable case/workflow/taxonomy schema and API-level dimensional
filters.

The main limitations are not decorative: some displayed measures are computed
or scoped incorrectly; status, resolution, and SLA semantics are unsigned;
the visible application has no case-level or workflow-event drill-through; and
its “root cause” page generates investigation prompts rather than causal
analysis.

### Strongest existing capabilities

1. **Real, read-only case aggregates:** volume, complaint mix, monthly intake,
   completion timestamps, geographic aggregates, subject taxonomy, follow-ups,
   and backlog aging use Didban SQL rather than mock dashboard values.
2. **Useful foundations in the source schema:** `Cookie`, `Inform`,
   `CookieFlow`, `Cartable`, `CookiePursuit`, `Region`/`Area`, organizational
   units, and a multi-level subject taxonomy are documented. The stored scan
   reports about 193,000 cases, 633,000 workflow rows, and 30,000 Cartable
   rows.
3. **Useful quality disclosures:** SLA deadlines are known to be empty; the UI
   distinguishes timestamp completion from approved status closure and flags
   missing population denominators and limited reply coverage.
4. **Cross-page filters:** period, province, request class, and—after the
   follow-up—selected department persist in a shared filter context.
5. **Drill-down foundations:** department-to-resolution filtering is now
   available; taxonomy/topic explorer and the broader KPI drill endpoints
   remain unconnected to the visible pages.

### Most critical gaps

- Open inventory and aging now respect the selected period, province, class,
  and department by measuring currently unfinished cases from that intake
  cohort; this is not an all-time current-stock total.
- The new average resolution duration uses the full valid finished cohort.
  The separately displayed median/P90 still use up to the latest 5,000
  completions and are labeled as sampled.
- Monthly “finished” counts classify cases by **creation month**, not finish
  month. `inflow - finished` is therefore not a valid monthly backlog change.
- Topic shares use only the top 40 subjects as the denominator; comparison
  topics are also limited to those currently in the top 40. An “absent” prior
  topic is assigned a 100% increase.
- The critical analysis is rule-based topic ranking with generic hypotheses;
  it does not calculate contributing province/unit/stage effects or establish
  causes.
- No stage wait-time, SLA compliance, employee performance, staff capacity,
  sentiment/CSAT, or individual case drill-through is available in the
  management UI. HBI is deliberately not scored.

### Top five improvement priorities

1. **Correct and publish KPI contracts:** separate intake cohorts from
   completion events and current backlog; expand median/P90 beyond the recent
   sample; expose numerator, denominator, date field, and population on every
   measure.
2. **Make filters consistent:** preserve the new backlog cohort semantics and
   apply selected period, geography, class, and organizational scope to every
   relevant query; show when a measure is intentionally all-time/current-stock.
3. **Implement usable drill-through:** wire the existing taxonomy/KPI APIs to
   region → department → subject → workflow and a permission-controlled,
   masked individual-case view.
4. **Resolve status and process semantics:** approve “resolved/closed,” cancel,
   noise-subject, referral/reopen, working-calendar, SLA, and deadline rules.
   Then calculate stage-level waiting time and breach rates.
5. **Build a validated operational bottleneck score only after data gates:**
   baseline backlog, aging, throughput, stage, and capacity components; label
   missing inputs and score confidence. Do not present current proxies as HBI.

## Deliverable 2 — Complete KPI Inventory and Gap Analysis

### 2.1 Visible pages and current presentation

| Page | Visible measures and visuals | Interaction / drill | Important limit |
|---|---|---|---|
| **Overview** (`/`) | Seven cards including total registered cases, complaint count/share, timestamp-finished cases, filtered open cohort, median resolution days, and cases with follow-up; HBI availability panel. Monthly intake/completion/net-change chart; top-changing-subject table; provincial case-volume bar; alerts and proposed priorities. | KPI cards link to related pages. Province chart applies province filter and opens province page. Subject links open Critical, but do not pass a selected subject. | HBI has no numeric score. Trend finish counts are grouped by creation month. |
| **Demand** (`/demand`) | Monthly intake/completion lines; top subjects; request-class pie; subject table with count, percentage change, and share. | Clicking a subject bar/row filters the local subject table only. | Share denominator is top 40 current subjects, not the complete population. No individual cases or text mining. |
| **Resolution** (`/resolution`) | Eight cards: timestamp-finished count/rate, full-cohort average days, sampled median/P90, average flow-step count, pursuit rate, and delay-proxy share. Monthly cohort trend and distribution of cases by number of flow rows. | Selected department filter carries into this page from Backlog. No row-level or per-stage drill. | Status closure and SLA are not validated; median/P90 use latest 5,000 finishes; delay is flow-row-based. |
| **Backlog** (`/backlog`) | Five selected-cohort open/age cards; age-bucket bar; top-15 department table/chart with intake, finished count/rate, average resolution duration, open count, average open age, and >90-day count. | Select department in chart/table to filter and open Resolution; no case drill. | “Open” means no FinishTime as of now, restricted to cases in the active intake period and filters. Unit rows with open stock only; unit trend remains hard-coded “stable.” |
| **Critical topics** (`/critical`) | Ranked subjects selected by period-over-period percentage change and volume; generic investigation checklist and hypothesis cards. | Select a listed subject to see its count/share/change and the same generic steps. | No actual province, department, or stage decomposition is performed on this page; hypotheses are not causes. |
| **Provinces** (`/provinces`) | Selectable metric bars and ranking table: case count, complaint share, timestamp-finish rate, median-labeled days, open count, pursuit rate. | Selecting a province changes a side panel of summary metrics. | No population denominator, district detail, complaint list, or effective case-level drill. `MedianDays` SQL expression is an average. |
| **Quality** (`/quality`) | Eight data-quality/availability indicators; quality alerts and definition list. | No source-record drill for a quality issue. | It describes coverage, not an interactive lineage or row-level remediation queue. |

### 2.2 KPI inventory and quality findings

| KPI / measure | Implemented definition and source | Dimensions / display | Assessment and limitations |
|---|---|---|---|
| Total registered cases | `COUNT(*)` of `dbo.Cookie`, with configured `CookieTypeId` and selected `CookieTime` period (`QueryCore`). | Global time, province, class; overview card and monthly intake chart. | **Useful intake count**, not total complaints: it counts all included request classes. There is no dedicated total-complaints card, though complaint count can be derived from class aggregates. Eligibility and noise/cancel rules are not signed. |
| Total complaints | `SubjectClassId = 1`; contributes to complaint-share calculation and demand class aggregation; the follow-up adds a separate complaint-count card. | Overview count/share cards and demand class chart. | **Partially implemented.** Count/share now exist; eligibility and noise/cancel rules remain unsigned. |
| Complaint share | `complaints / total` for the selected intake cohort. | Overview KPI; class filter. | Numerator/denominator are identifiable, but the card gives share rather than count. A change in share can be caused by non-complaint volume, not complaint volume. |
| Timestamp-finished count | `CookieFinishTime IS NOT NULL` in the selected `CookieTime` cohort. | Overview and resolution cards; monthly creation cohort. | A timestamp proxy, **not approved status resolution**. Finished counts in monthly charts are attributed to intake month, not date of completion. |
| Finish rate | `finished / total` for the selected intake cohort. | Resolution card; province `finishRate`. | A cohort share, not “fraction closed during period” or operational close rate. Business must approve timestamp semantics and denominator. |
| Resolution duration | Calendar-day `DATEDIFF` for valid finished cases. Follow-up adds an exact SQL average across the full filtered finished intake cohort; median/P90 are selected from up to the latest 5,000 valid finishes. | Average/median/P90 resolution cards; department table; province table. | The average now represents the full eligible cohort. Median/P90 remain recent-finish samples and are labeled as such. The province field called median is still an average; calendar-day boundaries are used. |
| Monthly intake | Count cases by `YEAR/MONTH(CookieTime)`. | Monthly trend on overview, demand, resolution. | Valid as intake volume, but monthly labels and count are Gregorian. UI has no year→month→day hierarchy; no day view. |
| Monthly completion / “net change” | For each `CookieTime` month, count rows with non-null `CookieFinishTime`; net = that month’s intake minus that same cohort’s finished count. | Combined trend. | **Not a completion-event series and not backlog change.** A backlog balance change requires opening stock + arrivals − exits (or snapshots); cohort completion counts do not measure month-of-close. |
| Open cases / aging | `CookieFinishTime IS NULL`; age is `GETDATE() - CookieTime`; bins `<7`, `7–30`, `31–90`, `>90`. Follow-up applies active date, province, class, and department filters. | Backlog cards/chart; filtered overview card. | Useful proxy pending status, not approved open status. It is current unfinished stock from the selected intake cohort, not all-time stock. Cartable total is a separate whole-table count, not reconciled to Cookie. |
| Unit workload | Top 15 departments with open cases; active-cohort intake/finished count/rate, valid average resolution days, open count, average open age, and >90-day count. | Backlog chart/table; department selection filters Resolution. | Covers department-level aggregates, not normalized workload/capacity. Does not provide individual cases, stage wait, or case-mix adjusted comparisons. Unit trend remains constant `"stable"`. |
| Flow-step count | Number of `CookieFlow` rows per case, bucketed into 1–2, 3–5, 6–10, >10. | Resolution chart. | Measures flow-row counts, not named processing stages or elapsed waiting time. A flow row may not equal one meaningful processing step. |
| Delay proxy | `CookieFlowDelayTime > 0` flow rows / all joined flow rows. | Resolution card. | Weak, unvalidated proxy; denominator is **flow rows**, not cases. A case with many flow rows contributes more weight. Not SLA compliance. |
| Average flow steps | SQL averages per-case step count after joining every CookieFlow row for the case. | Resolution card. | The join repeats a case’s step count once per flow row, size-weighting cases with more steps. It is not a plain case-level average. |
| Follow-up | Cases where `CookiePersuitsCount > 0`; counts and shares over selected cohort. | Overview, resolution, province. | A measurable engagement proxy, not dissatisfaction or escalation by itself. |
| Subject volume/share | `COUNT(*)` grouped by `SubjectId`; current top 40 subject rows. Share denominator is sum of those top 40 counts. | Demand top-subject chart/table; overview top five. | **Displayed “share of total” is overstated** when subjects outside the top 40 or unclassified cases exist. Full-population count must be denominator. |
| Subject change | Current top 40 counts vs a prior range; `100*(current-prior)/prior`. If prior is zero and current positive, code sets +100%. Priority uses percent change and volume. | Demand and Critical pages; heuristic alerts. | Selection bias from current top 40 omits newly emerging low-volume subjects; zero-baseline convention is arbitrary; no small-denominator guard. For `period=all`, `PreviousPeriod` returns the same unbounded filter, so change is not a meaningful prior-period comparison. |
| Province count and ratios | Join `Cookie`→`Inform`→`Region`; aggregate case/complaint counts, timestamp-finish count, open and follow-up. | Province ranking and overview volume bar. | Province-level comparisons exist. Raw volume is not a rate per population or eligible intake. `MedianDays` is SQL `AVG`, and global backlog filters do not apply. |
| Complaint response/reply coverage | The Quality API counts distinct cookies with non-empty `CookieFlowReplyCitizen` and divides by eligible rows. | Quality indicator only in this page. | Coverage is not satisfaction, answer quality, legal validity, or successful resolution. Stored profile reports about 12,220 distinct cases (~6.3%) with reply text in the scan. |
| Satisfaction / sentiment | No dashboard calculation. Profile notes describe satisfaction statuses as nearly unused and score fields as null/zero. | None. | Cannot provide a defensible satisfaction KPI from current measured data. `CookieFlowDiscontentCount` is a possible weak signal, not CSAT. |
| SLA compliance | No SLA KPI. Deadline coverage is reported unavailable; source inspection notes deadline fields are empty. | Quality warning/definition only. | Correctly unavailable; do not relabel delay proxy as SLA. Needs approved policy, populated due dates, and working calendar. |
| Quality coverage | Null/non-null rates for finish time, subject, province, area, deadline, and citizen reply; static status badges/notes. | Quality cards, alerts. | Valuable caveat; quality percentages alone do not identify affected records or show movement over time. Geo coordinate coverage is stated as limited, not computed in this query. |
| “Critical” topic / alert / priority | Heuristics derived from subject delta, open count, top-five province concentration, follow-up change, and thresholds. | Overview alerts/priorities and Critical page. | Action prompts, not causal findings. Province concentration divides the top province by the sum of returned top-20 provinces, not necessarily all national cases. Fixed thresholds and no uncertainty/sample-size interval can mislead. |

### 2.3 Benchmark gap table

| Benchmark capability | Current implementation | Status | Evidence | Gap / recommendation |
|---|---|---|---|---|
| Total complaints | Complaint class is countable and present in class aggregation; overview card is total cases and complaint share. | **Partially Implemented** | `DidbanManagementQueryService.GetOverviewAsync`, `GetDemandAsync`; overview and demand pages. | Add a complaint-count card and define eligibility/exclusions; show count with share. |
| Average complaint resolution time | No average KPI card; median/P90 proxy exists, sampled to latest 5,000 finished records. | **Partially Implemented** | `QueryCore`; `ResolutionPage`; `ProvincesPage`. | Define resolution cohort; compute full-population average/median/percentiles and label method/sample coverage. |
| Complaint trends over time | Monthly intake cohort trend, filtered by class; completion status is attached to intake month. | **Partially Implemented** | `QueryThroughput`; `DemandPage`. | Add separate received-date and finish-date series, complaint-specific defaults, day/week drill, and seasonality/comparison baseline. |
| Complainant satisfaction | No reliable satisfaction KPI; score/status data reported unusable. | **Not Supported by Available Data** | `docs/08-didban-inspection-notes.md`; quality page and API. | Capture structured post-resolution feedback with response denominator and non-response analysis. |
| Complaint status and resolution performance | `CookieFinishTime`, current status fields, follow-up, delay proxy and flow-count buckets. No validated status mapping or stage analysis in the UI. | **Partially Implemented** | `ManagementController`; `DidbanManagementQueryService`; `CookieStatus`/`CookieFlow` field map. | Approve lifecycle mapping; show status transitions, close outcomes, reopen/referral and stage dwell time. |
| Hidden Bottleneck Index (HBI) | No HBI calculation or visualization. Backlog, units, and delay proxies are separate. | **Not Implemented** | Search of dashboard/API source; backlog and resolution pages. | Define and validate component model; current capacity/SLA gaps prevent full index. See Deliverable 5. |
| Text Mining | Subject taxonomy aggregation exists; no text mining of free-form case descriptions in the management UI/API. | **Not Implemented** | `QueryTopicChanges` groups `Subject`; dashboard source has no text-analysis pipeline. | Start with privacy-reviewed Persian text preprocessing and a labeled discovery evaluation. |
| TF-IDF | No token weighting/vectorization/index in dashboard or API. | **Not Implemented** | Source search for TF-IDF/vectorization; none in application code. | A feasible offline baseline on scrubbed `CookieCaption`/`CookieText`; evaluate before operational use. |
| Jaccard Similarity | No n-gram/set similarity or duplicate-case scores. | **Not Implemented** | Application source; linkage is weak per schema notes. | Prototype normalized Persian token/ngram overlap; label as candidate duplicate, not confirmed repeat. |
| Graph Theory | No graph metrics or graph visual. Existing relational taxonomy and event data are not analyzed as a graph. | **Not Implemented** | `CookieFlow` SQL and dashboard visuals; no graph package/algorithm path. | Build a process/referral graph from validated transitions; do not use decorative subject co-occurrence. |
| Sentiment Analysis | No sentiment model; no reliable satisfaction ground truth. | **Not Supported by Available Data** for satisfaction; sentiment extraction itself is **Not Implemented**. | Didban inspection notes; no model in source. | Exploratory Persian sentiment may be tested on scrubbed text and human labels, but must not be reported as CSAT. |

## Deliverable 3 — Drill-Down and Analytical Dimension Assessment

### 3.1 Dimensions and source support

| Dimension / requested hierarchy | Data support in inspected model | Current dashboard/API | Assessment |
|---|---|---|---|
| Time: year → month → day | `Cookie.CookieTime` supports derived calendar levels; `CookieFlowTime` supports event timelines. Schema scan lists `Calandar`, but the management queries do not use a date dimension. | UI periods are 30 days, 90 days, year-to-date, and all. SQL trend groups by Gregorian year/month only. No day drill or arbitrary year/month hierarchy. | **Partially supported.** Build a shared calendar and separate intake/finish event dates. |
| Geography: country → province | `Inform.RegionId` is reported fully populated; `Region` has 33 values; `Inform.AreaId` has about 87% coverage in scan. Country is implicit aggregation, not a verified country hierarchy. | Province selector, province ranking, province count chart. No area chart/drill. | **Partially supported.** Province is good for counts; area is incomplete, and population denominators are missing. |
| Classification: main → subcategory → subject | Stored taxonomy supports `Zone → SubjectNature → SubjectGroup → Subject`; `SubjectClass` (complaint/guidance/report/suggestion) is a separate axis. | Management UI groups only `SubjectId` and class. API `/analytics/categories/tree` returns taxonomy tree but is not called by visible pages. | **Partially supported.** Taxonomy path exists; UI drill and parent-child semantics are not surfaced. Do not equate SubjectClass with taxonomy parent. |
| Status: registered → under review → referred → answered → closed | `CookieStatus` and `CookieFlow` contain status and flow time fields; approximately 30 lookup statuses are reported. Candidate labels/codes need domain approval. | No status selector, transition funnel, or status trend. Timestamp finish is used as a closure proxy. | **Partially supported in source fields; not implemented as the requested business lifecycle.** |
| Organization: organization → division → department → unit | `Department` is populated and on `Cookie`; `DepartmentChart` exists in the scan but its hierarchy relationship was not signed off. `Area` also has a department relationship. | Filterable department aggregates and department-to-resolution drill are available; no organization/division/unit drill. | **Partially supported.** Department aggregate is feasible; higher hierarchy and unit semantics need mapping. |
| Processing: department → employee → individual case | `CookieFlow` includes time/status/department and reference-to-user fields. `Agent` exists, but inspection notes show incomplete person-attribution fields; case `AgentId` is not validated as the responsible processor. | Department metrics and filter-level resolution analysis; no employee or individual case detail. | **Not supported as a reliable employee/case performance hierarchy.** Validate event assignment identity and staff history first. |
| Complaint type and subject | `SubjectClassId`, `SubjectId` and taxonomy IDs are documented; complaint class is `1`. | Global class selector; demand class pie and subject counts. | **Partially implemented.** No linked class→taxonomy drill and topic share denominators are incomplete. |
| Sentiment: positive/neutral/negative | Free-text fields exist; satisfaction statuses/scores are too sparse for ground truth. | None. | **Not implemented / not supported as satisfaction.** Experimental NLP is possible after labeling. |

### 3.2 Filter and drill-through audit

**Visible global filters:** period, province, and subject class. Department
can also be selected by drilling from the backlog table/chart; it appears as a
clearable active-filter chip. Period is
translated to date ranges in the browser (`30d`, `90d`, current calendar-year
YTD, `all`). The backend `PeriodFilter` also accepts department, channel, and
zone, but the global UI has no controls for them. The filter builder filters
case `CookieTime` and applies selected filter IDs where a query uses it.

**Current UI interaction levels:**

- Province chart/list → province selection/filter → province summary page.
- Subject chart/row → local topic table filter, or generic Critical page.
- KPI cards → related aggregate page.
- Backlog department row/bar → selected department → resolution page; filter
  context is preserved across pages.
- No current path reaches an individual complaint, its status history, its
  response, or a specific responsible employee.

**API-only capability:** `/api/v1/kpis/catalog/{code}/drill` can aggregate a
KPI by department, region, channel, subject class, or subject; its parent-child
sequence ends at subject. `/api/v1/analytics/categories/tree` returns a
taxonomy hierarchy and a few recent case-caption samples for top subjects.
Neither is called from the visible management-dashboard source. These are not
equivalent to a production case-detail drill-through, and sample captions need
privacy controls.

| Existing measure/page | Current lowest reachable level | Responsible department? | Individual complaint? | Cause of poor result? |
|---|---|---:|---:|---:|
| Overview cards/trends | Whole cohort/month | No; aggregate links only | No | No |
| Demand subject mix/change | Subject; local selection only | No | No | No |
| Resolution | Cohort and flow-row count bucket | No | No | No |
| Backlog | Department aggregate (top 15); selection filters Resolution | Yes, for intake, finish, and backlog aggregates | No | No |
| Critical topics | Subject label and heuristic hypothesis | No computed breakdown | No | No |
| Province measures | Province | No | No | No |
| Quality | Aggregate field coverage | No record-level remediation | No | No |
| KPI drill API (not wired) | Region/department/class/channel/subject | Yes, aggregated | No | No |

**Recommended path:** selected period/cohort → geography → validated
organization hierarchy → complaint class/taxonomy → status transition/stage →
masked case list → authorized case timeline/detail. Preserve filter context
and IDs at each step; provide a return path and denominator at each level.

## Deliverable 4 — Root Cause Analysis Capability Assessment

“Root cause” in the current Critical page means a ranked statistical change plus
generic review steps. It does not isolate a cause. It correctly warns that
co-occurrence is not proof of causation, but does not calculate the listed
geographic, organizational, or workflow contributions.

| Management question | Current answer | Data/KPI needed | Recommended visualization and drill |
|---|---|---|---|
| Why are complaints increasing? | Monthly intake trend and taxonomy counts exist; the trend includes all classes unless filtered. Critical page ranks subject deltas but does not attribute growth. | Complaint-specific intake by created date; mix decomposition by subject/class/channel/region; comparable prior periods, denominator and noise/cancel rules. | Complaint trend with period-over-period waterfall/contribution table → class → taxonomy → province/channel → cases; flag seasonal or volume-base effects. |
| Which provinces have most significant problems? | Raw province counts and several ratios exist. UI explicitly notes no population denominator. | Population/service-user denominator or eligible service caseload; stable cohort definitions; uncertainty for small populations. | Map/ranking with both counts and population-adjusted rates; province → area → subject → case. Until denominators exist, label “volume,” not “problem rate.” |
| Which departments are causing delays? | Department intake/finish counts and average completion duration, open count and average age are now available with a department filter drill. No stage-wait decomposition or case-mix adjustment. | Assigned-unit history, event timestamps, queue entry/exit, valid close status, staffing/capacity, SLA calendar. | Department scatter: arrivals vs completions, backlog age, p50/p90 dwell; select unit → stage → masked cases. Phrase as association until case-mix adjusted. |
| At which processing stages do cases accumulate? | Only number-of-flow-rows buckets and a delay-row proxy. | Ordered status/department events with consistent event meanings and timestamps; current stage snapshot. | Status-transition Sankey/funnel plus stage queue count and p50/p90 dwell; stage → unit → case timeline. |
| Which subjects are growing fastest? | Top-subject comparison is present, but only current top 40; all-period comparison is invalid. | Full subject universe with zero-filled prior periods, seasonality and minimum-volume/confidence rules. | Emerging-subject rank by absolute and percentage change; subject → province/unit/channel and de-identified sample text. |
| What problems generate repeated complaints? | Linked-reference fields are sparse (about 410 populated in scan); no similarity code. | Validated reference links and/or scrubbed text similarity, person/case privacy policy, duplicate labels. | Candidate duplicate clusters with Jaccard/embedding score and human confirmation; distinguish repeat contacts from duplicate submissions. |
| Are cases closed quickly but not resolved? | No; timestamp finish is not approved closure, and outcome/satisfaction is not usable. | Approved closure status, reopen/return events, response and outcome, citizen feedback with response rate. | Cohort resolution + reopen/return within defined window + dissatisfaction/feedback, with status/event timeline. |
| Which organizational units perform worst? | Department intake, finish rate/time, open volume, and aging can now be compared; no capacity adjustment, reliable employee measure, or case-mix adjustment. | Organization hierarchy, valid work assignment and staffing/FTE availability, case complexity and eligible workload. | Fair peer comparison with workload, throughput, aging, delay and case mix; department → unit → responsible role, not public employee league tables by default. |
| What are common sources of public dissatisfaction? | No valid satisfaction score; flow discontent count is a weak proxy and not used by current management pages. | Structured feedback, validated outcome labels, sentiment annotation, response/non-response metadata. | Complaint subject × verified outcome/feedback; privacy-filtered text themes. Never substitute text sentiment or `DiscontentCount` for CSAT without validation. |

## Deliverable 5 — HBI Design Proposal

### Existing state

No HBI is implemented. Current open-case counts, age buckets, unit open counts,
flow-row delay proxy, and incoming/finished counts are separate signals. The
data profile documents empty deadline fields, unconfirmed delay semantics, and
no staffing-capacity measure. Current backlog queries do not consistently use
the global filters. It would be misleading to label any current card or
threshold as an HBI.

### Proposed version 0.1 (design only; not an organization-approved KPI)

Calculate for each organizational unit \(u\) and weekly/monthly reference
period \(t\), using a defined cohort, a **0–100 relative risk score**:

`HBI(u,t) = 0.30*A + 0.25*W + 0.20*I + 0.15*G + 0.10*C`

where each component is a 0–100 normalized risk measure:

- **A — aging/SLA risk:** preferably share of unresolved eligible cases past
  approved SLA; before SLA exists, use a clearly named age-over-target share
  (e.g., >30 or >90 days) as an aging proxy, not an SLA breach.
- **W — stage waiting risk:** p90 time waiting at the unit’s current workflow
  stage, relative to a validated stage target.
- **I — inflow/outflow imbalance:** `max(0, arrivals - resolved exits) /
  max(arrivals, 1)` over the same period, with “resolved exits” based on the
  approved closure event and date.
- **G — backlog growth:** positive change in point-in-time unresolved stock:
  `max(0, B_t - B_(t-1)) / max(B_(t-1), 1)`.
- **C — capacity load:** assigned unresolved weighted workload divided by
  available effective capacity (e.g., staffed FTE-adjusted standard capacity),
  with approved case complexity weights.

**Normalization:** for each component, transform higher raw risk to higher
score and normalize against comparable peer units over a rolling baseline
(e.g., percentile rank, clipped to 0–100). Add absolute guardrails based on
approved SLA/operating targets so a uniformly poor system is not shown as
healthy merely because every unit is equally poor. Version baselines and
targets; publish the raw component values alongside the score.

**Weights:** the 30/25/20/15/10 weights above are an initial proposal, not
empirical or approved weights. Run a sensitivity analysis and review weights
with operations. Do not allow the composite to conceal a critical SLA breach:
show component flags separately and allow an approved red-flag override.

**Coverage and confidence gate:** do not silently renormalize away missing
components. Publish the composite only when at least 4/5 components are
available and at least 80% of the planned weight is covered; otherwise show
“insufficient data” plus component coverage. If a component uses a proxy, mark
the score provisional and display the proxy. The current schema/profile does
not meet this gate: SLA, capacity, historical backlog snapshots, and validated
stage dwell are missing or unconfirmed.

**Initial interpretation bands (pilot only):**

- Low: `<40`
- Medium: `40–69`
- High: `≥70`

These are relative-risk triage thresholds, not policy thresholds. Calibrate
them against retrospective known bottlenecks and operations review before
production. Recalibrate by comparing precision, false-alert rate, and
operational usefulness; retain historical score versions.

### Required fields and feasibility

| Component | Required data | Current evidence / blocker |
|---|---|---|
| A | Case ID, current open status, create time, approved SLA target/calendar | `CookieTime` and finish timestamp exist; open is a proxy. Deadline fields are documented as empty. Age counts exist but current scope/filter is incorrect. |
| W | Ordered stage/status and unit assignment events with start/end time | `CookieFlowTime`, status and department fields are documented. Event semantics, order, reassignment, and stage boundaries need validation; current UI only counts flow rows. |
| I | Intake event/date and approved resolution/exit event/date | Cookie create/finish timestamps exist; timestamp finish is not approved closure and current chart uses creation cohorts for both series. |
| G | Consistent point-in-time unresolved inventory for each prior period | Current query computes only “now”; historical snapshots/warehouse not identified. Reconstructable from complete event history only after validation. |
| C | Staffing capacity by unit/time, effective FTE/availability, assignment and complexity | No validated staffing/capacity measure. Agent table existence alone is not capacity; person-attribution fields have documented gaps. |

### HBI presentation / drill specification

Show HBI score, risk band, data coverage, last trustworthy source watermark,
and component values in a unit × period table and trend. Pair a scatter of
backlog load vs throughput with a stage-aging heatmap. Selecting a unit opens
stage → queue age → subject/class → privacy-controlled case list. Add
“suggested action” only from validated operational rules and record owner,
due date, and subsequent remeasurement. Never treat a high index as proof of
individual fault.

## Deliverable 6 — Advanced Analytics Feasibility

| Technique | Implemented today? | Current-data feasibility | Dependencies and responsible use |
|---|---|---|---|
| Text Mining | **No.** Current “topics” are pre-coded `Subject` lookup groups, not text-derived themes. | **Feasible for exploration.** Schema notes report `CookieCaption`/`CookieText` nearly complete. | PII scrubbing, Persian normalization/tokenization, noise-subject handling, human-reviewed clusters, stability/quality metrics. Keep taxonomy reporting separate from discovered text themes. |
| TF-IDF | **No.** No vectorization/index or term weighting in the management code. | **Feasible** on scrubbed captions/text using an offline baseline. | Stop-word/character normalization for Persian; evaluate precision and usefulness against analyst-labeled samples; avoid leaking raw text into logs or external services. |
| Jaccard similarity | **No.** No token-set/ngram matching. | **Feasible as a candidate-duplicate baseline** on normalized text; source-linked case IDs alone are sparse. | Normalize scripts, digits, stopwords and common templates; evaluate against adjudicated duplicate pairs. Similarity is not proof of a repeated complaint or same complainant. |
| Graph Theory | **No.** Taxonomy SQL tree and workflow-row buckets are not graph analytics. | **Feasible conditionally.** Taxonomy relations are present; `CookieFlow` can potentially supply directed status/unit transitions. | Verify event order, real transition edges, reassignment meaning and cardinality. Start with transition frequencies, referral loops, centrality only when meaningful. Avoid exposing PII in nodes. |
| Sentiment Analysis | **No.** No model or labeled evaluation set. | **Exploratory text polarity is technically possible** on scrubbed Persian text; **satisfaction KPI is not supported** by present labels/scores. | Create representative human labels, measure precision/recall by class and topic, monitor drift and uncertainty. Separate sentiment from satisfaction, resolution quality, and CSAT. |
| Process mining (HBI enabler) | No stage-transition analysis in the visible UI. | Potentially feasible from `CookieFlow` timestamps/statuses. | Validate event log completeness and status mapping; identify rework, loops, waits and handoffs; no causal claims without further design. |

The management chatbot also calls an OpenAI-compatible LLM when configured,
with a local fallback. It supplies a compact overview response fetched without
the dashboard’s active filters. This is a conversational interface to selected
aggregate KPIs, not text mining, sentiment analysis, graph analytics, or a
validated predictive model; its context may differ from the filtered page a
user is viewing. The repository’s analytics toolkit documentation describes
several other techniques as future/prototype options; that is planning
documentation, not evidence that they are implemented.

## Deliverable 7 — Recommended Dashboard Architecture

Build on the current pages and shared API; do not replace the UI before
correcting measure contracts.

| Page / decision | KPIs and visuals | Required filters and drill path |
|---|---|---|
| **Executive overview** — where is the risk? | Eligible case count, complaint count/share, resolved exits by finish date, open stock, backlog growth, verified SLA compliance (only after data gate), data freshness/coverage. Intake vs completion event lines; alert queue ranked by absolute impact and risk. | Period, class, province, channel, department; overview → province/unit → subject/stage. Current stock must be explicitly “as of” timestamp. |
| **Demand & emerging issues** — what is increasing? | Complaint-specific intake series; class mix; full-universe subject counts, absolute change and rate change; seasonality and noise-subject share. | Year → month → day; class → taxonomy hierarchy → province/channel → scrubbed sample text/cases. |
| **Workflow & bottlenecks** — where does work wait? | Current-stage queue, stage dwell p50/p90, age and SLA breach, referrals/reopens, arrivals vs exits, provisional HBI components. | Unit → stage/status → subject/class → masked cases and timeline. |
| **Organizational performance** — which units need support? | Department workload, throughput, backlog aging, case mix, completion outcomes, capacity-adjusted load when capacity exists. Avoid raw employee league tables until attribution and fairness are validated. | Organization chart → division → department → unit; region and period; compare matched peers. |
| **Geography** — where is the rate or volume high? | Counts plus population/service-user denominator rates, uncertainty/sample size, subject and backlog mix. | Country aggregate → province → area → subject and responsible unit. Until denominator exists, call metrics volume/share, not incidence/problem rate. |
| **Resolution and public outcome** — was it actually resolved? | Approved status-close rate, duration distribution, first response, reopening/re-referral, citizen reply coverage, feedback response rate and CSAT when collected. | Intake cohort vs finish cohort selection; status → stage → unit → restricted case record. |
| **Data quality and definitions** — can decisions be trusted? | Numerator/denominator, field coverage, duplicate/join checks, rule version, source watermark, known exclusions and API freshness. | Metric → source field/query → affected row samples with access controls. |

**Shared interaction requirements:** visible denominator and date basis for each
rate; cohort vs stock selector; explicit `as-of` timestamp; consistent filters;
selected hierarchy breadcrumb; export that preserves filters; accessible table
equivalents; sample-size and data-quality warnings. Do not show satisfaction,
SLA, or HBI as decision-grade until their respective data gates pass.

**Refresh:** management pages fetch API data when mounted or filters change.
Management query endpoints are direct queries in the inspected service. The
separate general analytics service has a three-minute memory cache, but it is
not the same as a scheduled source refresh. `Meta.generatedAt` is set when the
API response is generated, not a verified source-data watermark. The visible
shell does not pass a `updatedAt` value to the top bar. Add an actual source
watermark/refresh-status measure rather than presenting response time as
database freshness.

## Deliverable 8 — Prioritized Implementation Roadmap

Complexity and value are qualitative estimates for planning, not committed
delivery estimates.

### Phase 1 — Existing data and infrastructure

| Recommendation | Complexity | Business value | Acceptance evidence |
|---|---|---|---|
| Correct metric calculations: full-population duration distribution; correct average/median names; fix case-level flow-step aggregation; denominators use all eligible cases; avoid current-top-40 bias and arbitrary zero-base +100%. | Medium | **Very high** — removes misleading management signals. | Unit tests for numerator/denominator and known synthetic data; API definition includes cohort and sample size. |
| Separate intake-cohort trend from completion-event trend; do not label intake-minus-cohort-finish as backlog change. | Medium | **Very high** | Month-end test reconciles event-based arrivals/exits and stock change. |
| Apply consistent filter scope to open stock, backlog age, unit rows, province metrics, and overview open count; show explicit exceptions. | Medium | **Very high** | Cross-filter test matrix for date, region, class, department; verify stock semantics remain current-state. |
| Handle `all` comparison as unavailable or compare against a clearly defined prior historical window; add minimum baseline count and absolute change. | Low | High | API returns explicit `comparisonUnavailable`/reason instead of same-period comparison. |
| Surface complaint count and definition alongside share; clarify eligible case vs complaint, timestamp finish vs resolved. | Low | High | KPI contract and UI labels match tested SQL. |
| Wire taxonomy explorer and KPI drill API into the dashboard with preserved IDs, filters, and parent context. | Medium | High | Browser path reaches subject aggregation; no claim of individual case drill until implemented. |
| Add source freshness and last-successful-query/source-watermark semantics. | Low/Medium | High | UI differentiates response-generated time from data source watermark and errors. |
| Replace heuristic critical cards’ “cause” language with observed contribution breakdown and clear hypothesis labels. | Medium | High | Every alert links to its underlying aggregate and its denominator. |

### Phase 2 — Additional modeling, business rules, or ETL

| Recommendation | Complexity | Business value | Required decision/data |
|---|---|---|---|
| Approve eligibility, noise/cancellation rules, timestamp-vs-status resolution, closed-status set, referral/reopen semantics. | Medium (business + data QA) | **Very high** | Signed metric specification; reconcile sample cases with operations. |
| Model event-level workflow with normalized status, unit, assignment, entry/exit timestamps and current-stage snapshot. | High | **Very high** | Validate CookieFlow order, repeat events, timezone/calendar, missing transitions. |
| Implement SLA calendar, due timestamps, pause rules, service class and working-time calculation. | High | **Very high** | Policy targets and populated/derivable deadline facts; never infer official SLA from delay proxy. |
| Build verified organization chart mapping and effective-dated unit hierarchy. | Medium/High | High | Validate DepartmentChart parent/child semantics and organizational changes. |
| Add staffing capacity/FTE availability and case assignment history, with case complexity weights. | High | **Very high for HBI** | Staffed hours, absences, queues/ownership and fair normalization. |
| Create a complaint detail/timeline endpoint and UI with RBAC, audit logging, masking and purpose limitation. | High | High | Permission model and PII controls; no broad exposure of citizens or employee data. |
| Capture structured post-resolution satisfaction/outcome and response-denominator metadata. | Medium/High | High | Survey policy, response rates, sampling/non-response bias, validated outcome categories. |
| Add historical inventory snapshots if event history cannot reliably reconstruct backlog. | Medium/High | High | Snapshot retention, reconciliation to source and late-arriving correction policy. |
| Obtain population/service caseload denominator and effective dates for geographic rates. | Medium | High | Authoritative denominator by province/area and reference period. |

### Phase 3 — Advanced analytics, NLP, or machine learning

| Recommendation | Complexity | Business value | Preconditions |
|---|---|---|---|
| Persian text normalization + TF-IDF/keyword and topic-discovery baseline, then human-reviewed topic clusters. | Medium | Medium/High | PII review, labels, noise handling, offline evaluation and reproducibility. |
| Jaccard/ngram duplicate-candidate service, then embedding similarity only if baseline limitations justify it. | Medium/High | High | Adjudicated duplicate pairs, privacy policy, precision thresholds and human confirmation. |
| Process mining / transition graph for stage loops, handoffs, rework and wait-time outliers. | High | High | Validated event log, timestamps, unit identities, case-link integrity. |
| Sentiment classifier for exploratory themes only; not satisfaction proxy without validation. | High | Medium | Persian annotated dataset, class balance, calibration, bias/drift reviews. |
| HBI scoring service, retrospective backtest, sensitivity analysis and action/remeasure loop. | High | **Very high if validated** | SLA, capacity and/or approved proxy components, historical stock, signed targets, score coverage gate. |
| Anomaly detection/seasonality forecasts for complaint inflow and stage queues. | Medium/High | Medium/High | Correct event series, historical periods, seasonality baseline, alert false-positive control. |

## Evidence references

- Dashboard routes/pages: `management-dashboard/src/app/`; page components in
  `management-dashboard/src/components/pages/`.
- KPI and visual definitions: `OverviewPage.tsx`, `DemandPage.tsx`,
  `ResolutionPage.tsx`, `BacklogPage.tsx`, `CriticalPage.tsx`,
  `ProvincesPage.tsx`, `QualityPage.tsx`.
- Frontend DTOs/API bindings and filters:
  `management-dashboard/src/data/api.ts`,
  `management-dashboard/src/data/filters.ts`,
  `management-dashboard/src/components/layout/TopBar.tsx`.
- Management API SQL and metric logic:
  `api/AiTicket.Api/Modules/Management/ManagementController.cs`,
  `ManagementDtos.cs`, and `DidbanManagementQueryService.cs`.
- Filter contract: `api/AiTicket.Api/Modules/Analytics/SqlFilterBuilder.cs`.
- API-only drill: `api/AiTicket.Api/Modules/Kpis/KpisController.cs` and
  `DidbanKpiCatalogQueryService.Drill.cs`.
- API-only category/topic explorers:
  `api/AiTicket.Api/Modules/Analytics/AnalyticsController.cs`,
  `DidbanAnalyticsQueryService.Category.cs`, and
  `DidbanAnalyticsQueryService.Topics.cs`.
- Read-only DB connection behavior:
  `api/AiTicket.Api/Infrastructure/Didban/SqlDidbanConnectionFactory.cs`.
- Stored data evidence and business-rule caveats:
  `docs/_schema_scan/schema-handoff-summary.json`,
  `docs/_schema_scan/fill_rates.json`,
  `docs/08-didban-inspection-notes.md`,
  `docs/12-didban-field-map.md`, and `docs/04-kpi-dictionary.md`.
- Existing analytical planning (not evidence of implementation):
  `docs/10-analytics-ai-toolkit.md`, `docs/15-decision-action-loop.md`,
  `docs/16-decision-kpi-priority.md`.
