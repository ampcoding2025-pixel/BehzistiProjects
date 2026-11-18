# AI Support & Ticketing Bot — Vendor Interview Checklist

**Vendor:** ________________________________  
**Product:** ________________________________  
**Meeting date:** ______________  
**Evaluators:** ________________________________  
**Our helpdesk today:** ________________________________  

---

## How to use

1. Bring one printed copy per evaluator.
2. Check each question when answered clearly.
3. Mark **Critical** items as blockers if unanswered.
4. Transfer scores into `02-Scorecard-Printable.html` (or the paper scorecard).
5. Request written follow-up for anything marked “Need docs”.

**Scoring (1–5):** 1 Poor · 2 Weak · 3 Acceptable · 4 Strong · 5 Excellent

---

## 1. AI & Product Capabilities (Weight 15%)

Score: ☐1  ☐2  ☐3  ☐4  ☐5     Notes: _______________________________

| # | Critical? | Question | Asked | Notes |
|---|-----------|----------|-------|-------|
| 1.1 | **YES** | What LLM / models power the bot? Can we choose or bring our own? | ☐ | |
| 1.2 | | How do you ground answers on our knowledge base / policies / past tickets? | ☐ | |
| 1.3 | | How do you detect and reduce hallucinations? Can the bot say “I don’t know”? | ☐ | |
| 1.4 | | Which languages are supported for customers and for agents? | ☐ | |
| 1.5 | | Can it classify intent, sentiment, priority, and category automatically? | ☐ | |
| 1.6 | | What KPIs do you measure (CSAT, containment, resolution, AHT)? | ☐ | |
| 1.7 | | Can agents edit answers before send? Is there human-in-the-loop mode? | ☐ | |

---

## 2. Ticketing & Workflow (Weight 12%)

Score: ☐1  ☐2  ☐3  ☐4  ☐5     Notes: _______________________________

| # | Critical? | Question | Asked | Notes |
|---|-----------|----------|-------|-------|
| 2.1 | **YES** | Which ticketing/helpdesk systems do you natively support? | ☐ | |
| 2.2 | | Can the bot create, update, comment, close, and reopen tickets with custom fields? | ☐ | |
| 2.3 | | How does routing / escalation to humans work (skills, queues, VIP, after-hours)? | ☐ | |
| 2.4 | | Does it preserve full conversation + AI decision trail inside the ticket? | ☐ | |
| 2.5 | | Can it enforce SLA timers, priorities, and business hours? | ☐ | |
| 2.6 | | Support for multi-brand / multi-department / multi-queue setups? | ☐ | |

---

## 3. Integrations & APIs (Weight 12%)

Score: ☐1  ☐2  ☐3  ☐4  ☐5     Notes: _______________________________

| # | Critical? | Question | Asked | Notes |
|---|-----------|----------|-------|-------|
| 3.1 | **YES** | Channels: web widget, WhatsApp, email, mobile app, phone IVR, social? | ☐ | |
| 3.2 | | SSO options (SAML/OIDC) and role-based admin access? | ☐ | |
| 3.3 | | REST/GraphQL APIs, webhooks, event exports — rate limits and auth? | ☐ | |
| 3.4 | | CRM / ERP / billing / identity lookups during a conversation? | ☐ | |
| 3.5 | | Can we run custom actions (API calls, scripts, approvals) from the bot? | ☐ | |
| 3.6 | | Sandbox / staging environment for integration testing? | ☐ | |

---

## 4. Architecture & Deployment (Weight 10%)

Score: ☐1  ☐2  ☐3  ☐4  ☐5     Notes: _______________________________

| # | Critical? | Question | Asked | Notes |
|---|-----------|----------|-------|-------|
| 4.1 | **YES** | Deployment: SaaS only, private cloud, on-prem, or air-gapped? | ☐ | |
| 4.2 | **YES** | Where is customer data stored and processed (country / region)? | ☐ | |
| 4.3 | | Uptime SLA, RPO/RTO, backup, and disaster recovery design? | ☐ | |
| 4.4 | | Multi-tenant isolation — how is our data separated? | ☐ | |
| 4.5 | | Can we host the knowledge base / embeddings in our cloud? | ☐ | |

---

## 5. Infrastructure & Technical Requirements (Weight 8%)

Score: ☐1  ☐2  ☐3  ☐4  ☐5     Notes: _______________________________

| # | Critical? | Question | Asked | Notes |
|---|-----------|----------|-------|-------|
| 5.1 | **YES** | What hardware/software must WE provide (servers, GPUs, VPN, firewall)? | ☐ | |
| 5.2 | | Minimum network, browser, OS, and endpoint requirements? | ☐ | |
| 5.3 | | If on-prem/hybrid: CPU, RAM, storage, GPU, OS, container/K8s needs? | ☐ | |
| 5.4 | | Dependencies on third-party cloud AI APIs — failover if provider is down? | ☐ | |
| 5.5 | | Estimated IT effort for firewall, DNS, SSO, monitoring, certificates? | ☐ | |

---

## 6. Security, Privacy & Compliance (Weight 12%)

Score: ☐1  ☐2  ☐3  ☐4  ☐5     Notes: _______________________________

| # | Critical? | Question | Asked | Notes |
|---|-----------|----------|-------|-------|
| 6.1 | **YES** | Certifications: SOC 2, ISO 27001, GDPR, HIPAA, local laws? | ☐ | |
| 6.2 | | Encryption in transit/at rest? Customer-managed keys? | ☐ | |
| 6.3 | **YES** | Is customer data used to train shared models? Can we forbid it contractually? | ☐ | |
| 6.4 | | PII redaction, retention policies, right-to-delete, and data export? | ☐ | |
| 6.5 | | Admin audit logs, session security, MFA, IP allowlists? | ☐ | |
| 6.6 | | Pen-test / vulnerability process and latest report availability? | ☐ | |

---

## 7. Scalability & Performance (Weight 8%)

Score: ☐1  ☐2  ☐3  ☐4  ☐5     Notes: _______________________________

| # | Critical? | Question | Asked | Notes |
|---|-----------|----------|-------|-------|
| 7.1 | **YES** | Max concurrent conversations and tickets/day at our expected volume? | ☐ | |
| 7.2 | | Typical and p95 response latency for AI replies? | ☐ | |
| 7.3 | | Hard rate limits, fair-use policies, and overage behavior? | ☐ | |
| 7.4 | | How does performance degrade under peak load? | ☐ | |

---

## 8. Implementation & Resources (Weight 8%)

Score: ☐1  ☐2  ☐3  ☐4  ☐5     Notes: _______________________________

| # | Critical? | Question | Asked | Notes |
|---|-----------|----------|-------|-------|
| 8.1 | **YES** | Typical implementation timeline from contract to go-live? | ☐ | |
| 8.2 | **YES** | What roles do YOU provide vs what roles WE must staff? | ☐ | |
| 8.3 | | What content/data must we prepare (KB, macros, historical tickets)? | ☐ | |
| 8.4 | | Migration from our current helpdesk / chatbot — tools and risks? | ☐ | |
| 8.5 | | Pilot / PoC scope, success criteria, and duration? | ☐ | |

---

## 9. Support, SLA & Training (Weight 5%)

Score: ☐1  ☐2  ☐3  ☐4  ☐5     Notes: _______________________________

| # | Critical? | Question | Asked | Notes |
|---|-----------|----------|-------|-------|
| 9.1 | | Support channels, hours, severity definitions, response/resolve SLAs? | ☐ | |
| 9.2 | | Dedicated CSM / technical account manager included? | ☐ | |
| 9.3 | | Admin training, agent training, and documentation quality? | ☐ | |
| 9.4 | | Incident communication process and status page? | ☐ | |

---

## 10. Pricing, Contract & TCO (Weight 10%)

Score: ☐1  ☐2  ☐3  ☐4  ☐5     Notes: _______________________________

| # | Critical? | Question | Asked | Notes |
|---|-----------|----------|-------|-------|
| 10.1 | **YES** | Pricing model: seats, conversations, resolutions, tokens, modules? | ☐ | |
| 10.2 | **YES** | Year-1 vs Year-2+ cost: license + implementation + training + overages? | ☐ | |
| 10.3 | | What is included vs add-ons (channels, analytics, premium models, SSO)? | ☐ | |
| 10.4 | **YES** | Contract term, renewal uplift, early termination, data return/deletion? | ☐ | |
| 10.5 | | Exit plan: export tickets, conversations, configs, and knowledge? | ☐ | |
| 10.6 | | References from similar industry / volume customers we can call? | ☐ | |

---

## Resources & Ownership Matrix

| Workstream | Vendor owns | We own | Est. effort / cost |
|------------|-------------|--------|--------------------|
| Project delivery / PM | | | |
| Knowledge & content | | | |
| IT / security (SSO, network, DLP) | | | |
| Agent operations & QA | | | |
| Data & analytics / KPIs | | | |
| Ongoing admin & prompt maintenance | | | |

---

## Documents to Request in Writing Before Signing

- [ ] Architecture + data-residency diagram
- [ ] Security pack (SOC2 / ISO / GDPR + data-use policy)
- [ ] Integration list + sandbox access details
- [ ] Implementation plan + RACI (vendor vs us)
- [ ] Year-1 and Year-2 commercial quote with unit economics
- [ ] Overage rules and volume discounts
- [ ] Paid add-ons list
- [ ] Contract draft: term, uplift, termination, liability, SLA credits
- [ ] PoC proposal: scope, duration, success metrics, conversion pricing
- [ ] 2–3 customer references

---

## Meeting Notes & Next Actions

**Key risks:**  
_________________________________________________________________

**Promises made by vendor:**  
_________________________________________________________________

**Follow-ups / owners / deadlines:**  
_________________________________________________________________

**Preliminary recommendation:** ☐ Strong  ☐ Conditional  ☐ Weak  ☐ Not recommended  ☐ Hold (critical gaps)
