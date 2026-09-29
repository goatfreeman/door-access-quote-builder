CONFIDENTIAL — INTERNAL CALTRON DRAFT

Not client-issued. Not approved for submission. Not a purchase authorization. Not a design, safety, test, or acceptance certification.

# Caltron quote-validation requirement application

Document status: INTERNAL REVIEW

Source revision: `Caltron_Quote_Tool_Business_Requirements v1.1.xlsx`

Applied repository: `goatfreeman/door-access-quote-builder`

Review date: 2026-09-29

## 1. Objective

Apply the Caltron quote-tool requirements to the existing Quick Quote Builder without treating old quotes as current product facts. Use deterministic rules before artificial intelligence (AI). Keep AI findings as review drafts with source evidence.

## 2. Confirmed design basis

- The requirements workbook is the governing business-requirement source.
- Historical quote-analysis Markdown files are reviewed reference evidence only.
- The application uses `CONFIRMED`, `ASSUMED`, `OPEN`, `CONFLICT`, `BLOCKED`, and `NOT APPLICABLE`.
- The source part number remains separate from the normalized lookup key.
- A qualified Caltron reviewer must approve each final compatibility decision.
- The application must not approve a design, substitution, price, safety condition, contract term, or field release.

## 3. Implemented technical result

| Control | Result | Status |
|---|---|---|
| Repository integration | The item-validation foundation is part of the existing Next.js application. | CONFIRMED |
| Quote item trigger | Adding an individual catalog item starts a product-only companion-part and compatibility review against current quote SKUs. | CONFIRMED |
| Fiber review prompt | The controlled question requires fiber mode, connector, wavelength, data-rate, patch-cable, and transceiver checks. | CONFIRMED |
| Catalog CSV import | The administrator panel imports and updates catalog items by SKU with the controlled nine-column format. | CONFIRMED |
| User boundary | `/validation` requires the existing application session. | CONFIRMED |
| Confidentiality warning | The workspace prohibits client names, locations, network details, credentials, prices, and controlled drawings. | CONFIRMED |
| Part-number control | The system preserves `sourcePartNumber` and derives `normalizedLookupKey` separately. | CONFIRMED |
| Evidence status | Domain validation permits only the six controlled status values. | CONFIRMED |
| Evidence URL control | Agent reports accept only `http` and `https` source URLs. | CONFIRMED |
| Agent separation | Jobs run in the order researcher, verifier, and tester. Later stages receive prior reports. | CONFIRMED |
| Prompt-injection control | Each prompt treats retrieved content as untrusted. Hosted execution has no local process or filesystem tools. | ASSUMED |
| Structured output | The Responses API must return a report that conforms to `agent-report.schema.json`. | CONFIRMED |
| API credentials | The server uses protected OPENAI_API_KEY environment configuration. No key is sent to the browser or stored in credential files. | CONFIRMED |
| Deterministic validation | An unintegrated domain module checks nonnegative quantity and line-extension arithmetic. The quote workspace does not call it yet. | ASSUMED — prototype only |
| Automated verification | Tests cover request normalization, URL policy, arithmetic, orchestration, role checks, hosted API output handling, job gating, hosted configuration, and the UI safety notice. | CONFIRMED |

## 4. Business-requirement traceability

| Requirement | Current application result | Status | Next controlled increment |
|---|---|---|---|
| `BR-001` | Administrator catalog CSV import is implemented. Multi-file project-document upload, hashing, scanning, and source classification are not implemented. | ASSUMED — catalog slice only | Add controlled project-source ingestion and a source register. |
| `BR-002` | Compatibility reports contain evidence. A cited security-scope summary is not implemented. | OPEN | Add document extraction and requirement evidence. |
| `BR-003` | The existing application authors equipment and labor quotes. The full Caltron section model is incomplete. | ASSUMED | Add subsystem, location, assumptions, terms, custom sections, and source-row identity. |
| `BR-004` | Existing quote pricing remains active. `RULE-014` verifies line arithmetic. The divisor and cent-rounding policy remains unresolved. | CONFLICT | Obtain Finance and Estimating approval for the rounding sequence. |
| `BR-005` | The compatibility workspace and three-agent evidence workflow are implemented. Only the initial arithmetic rule slice is deterministic. | ASSUMED | Implement approved rules `RULE-001` through `RULE-005`, then the approved rule backlog. |
| `BR-006` | A versioned standard-terms library is not implemented. | OPEN | Add immutable terms versions and quote references. |
| `BR-007` | Standard and project-specific assumption suggestions are not implemented. | OPEN | Add cited scope-boundary findings and user disposition. |
| `BR-008` | Existing quote revisions support historical snapshots. A single-writer edit lease is not implemented. | OPEN | Add lease acquisition, heartbeat, expiry, takeover reason, and audit event. |
| `BR-009` | Current browser exports do not constitute an approved formula-preserving Caltron Excel export. | OPEN | Obtain the approved template and implement formula export plus recalculation checks. |
| `BR-010` | Workbook re-import and row-level comparison are not implemented. | OPEN | Add immutable export manifests and re-import differences. |
| `BR-011` | The approved Caltron visual and structural template was not supplied. | BLOCKED | Obtain and approve the blank workbook template. |
| `BR-012` | Historical records are not automatically promoted to current facts. Tagged source sets and approved learning corrections are not implemented. | OPEN | Add reviewed evidence-set and correction records. |

## 5. Initial rule coverage

| Rule | Current state | Status |
|---|---|---|
| `RULE-001` | Fiber Equipment Compatability Validation is specified but not executable. | OPEN |
| `RULE-002` | Door Hardware Compatability Validation is specified but not executable. | OPEN |
| `RULE-003` | Camera Equipment Compatability Validation is specified but not executable. | OPEN |
| `RULE-004` | Software License Validation is specified but not executable. | OPEN |
| `RULE-005` | Pricing Validation is blocked by the missing approved pricebook. | BLOCKED |
| `RULE-014` | Proposed negative-quantity and extension checks exist as an unintegrated domain module. `RULE-014` is from the draft build plan, not a populated governing-workbook rule row. | ASSUMED — prototype only |

The source spelling `Compatability` is retained for `RULE-001` through `RULE-003` to preserve traceability.

## 6. Interface-control table

| Source device | Source signal | Destination | Required action | Cable or protocol | Power source | Test step | Status |
|---|---|---|---|---|---|---|---|
| Authenticated browser | Product identifiers and question | `/api/validation/codex` | Validate fields and start controlled review | HTTPS / JSON | User workstation | Submit valid and invalid requests | CONFIRMED |
| Next.js server | Product research request | OpenAI Responses API | Use hosted web search and strict structured reports | HTTPS / JSON | Vercel function | Mock configured, missing-key, and API failure cases | CONFIRMED |
| Researcher | Structured report | Verifier | Supply evidence for independent verification | Internal JSON | Application server | Verify role order and prior-report transfer | CONFIRMED |
| Verifier | Structured report | Tester | Supply independently checked findings | Internal JSON | Application server | Verify both prior reports reach tester | CONFIRMED |
| Tester | Final draft status and test steps | Browser | Display evidence and qualified-review notice | HTTPS / JSON | Application server | Verify all statuses, findings, and URLs render | ASSUMED — browser acceptance test required |
| Quote line fixture | Quantity and unit values | Deterministic prototype module | Check extensions with proposed `RULE-014` logic | Internal TypeScript call | Application server | Run arithmetic and negative-quantity fixtures | ASSUMED — not connected to quote workspace |

## 7. Assumptions and deviations

- `ASSUMED`: The deploy target is a standard Vercel Node.js function using hosted OpenAI research with non-sensitive product identifiers only.
- `REQUIRED`: Enable hosted validation and set a protected server API key as described below. No CLI installation, persistent login, local process, isolation assertion, or persistent filesystem is used by the adapter.
- `DEVIATION`: The current API runs the three agents synchronously. Each stage has an 85-second timeout and follows request cancellation. A durable queue, retry policy, and job history remain future work.
- `REQUIRED`: Historical quote analyses must not establish current compatibility, lifecycle, price, or approval.
- `REQUIRED`: Do not enable external AI processing for confidential records until Cybersecurity and the Manager approve the data boundary.

## 8. Risks

| Risk | Required control | Status |
|---|---|---|
| Public research receives confidential project data | Enforce the product-only input boundary and complete cybersecurity review. | BLOCKED for confidential data |
| Manufacturer web evidence changes | Store retrieval date, excerpt, URL, and hash in a durable evidence record. | OPEN |
| Synchronous jobs exceed hosting limits | Configure the 300-second function duration; use a durable queue if longer reviews are needed. | OPEN |
| AI output appears approved | Keep the draft notice and add reviewer disposition and audit records. | OPEN |
| Direct changes reach production without review | Use feature branches and pull requests. Enable protected-branch rules. | OPEN — repository administrator |
| Dependency audit reports known vulnerabilities | Review dependency paths and approve safe upgrades before production. | OPEN |

## 9. Required decisions

1. Approve the hosted API data boundary for the intended product-only inputs.
2. Approve the manufacturer and product-family scope.
3. Approve the source-domain policy.
4. Approve the pricing divisor and cent-rounding sequence.
5. Supply the approved quote workbook and representative source workbooks.
6. Approve the rule, severity, reviewer, and override matrix.
7. Enable branch protection that requires a reviewed pull request and passing checks before merge.

## 10. Source records

1. `Caltron_Quote_Tool_Business_Requirements v1.1.xlsx`, revision `v1.1`, sheets `Requirements`, `Rules Catalog`, `Process Flow`, and `Data Dictionary`.
2. `C:\CaltronAI\Quote_Item_Validation_Tool_Build_Plan.md`, document `CALTRON-QVT-BUILD-PLAN-001`, revision `DRAFT 0`.
3. `https://github.com/goatfreeman/door-access-quote-builder`, baseline commit `cc71dfd4006ba26d60a74ad3a81d8f58f7614765`.

The supplied historical quote-analysis Markdown files remain reference evidence. They are not current product facts.
## 11. Hosted validation deployment

The existing GET/POST `/api/validation/codex` endpoint is retained for client compatibility. Its implementation runs in a standard Vercel Node.js function and calls `POST https://api.openai.com/v1/responses` with server-side fetch. The researcher, independent verifier, and tester each use hosted `web_search` and `text.format` with `type: json_schema`, `strict: true`, and the bundled report schema. Responses are not stored (`store: false`). No SDK or new dependency is required.

Set these protected server environment variables in the applicable Vercel environments and redeploy:

- `OPENAI_API_KEY`: required project API key with Responses/model access. Never prefix it with `NEXT_PUBLIC_` or put it in client code.
- `OPENAI_VALIDATION_ENABLED=true`: opt in to hosted validation. When unset, legacy `CODEX_VALIDATION_ENABLED=true` is accepted. An explicit new flag takes precedence.
- `OPENAI_VALIDATION_MODEL`: optional; defaults to `gpt-5-mini`. An override must support Responses, hosted web search, and structured outputs.

`CODEX_VALIDATION_ISOLATED` is ignored. The route exports `maxDuration = 300`; configure a Vercel function duration allowance that accommodates three sequential 85-second calls plus authentication and evidence checks. The in-memory job gate limits only one warm instance, not all deployed instances. Status checks are configuration-only and do not incur API requests: `provider=openai`, `configured` and `available` reflect usable local settings, not proven upstream access. Legacy `installed=true` means the hosted adapter is present, `authenticated` aliases configured, and `version=null`. No raw environment values are returned. A failed review reports a fixed, actionable error without upstream bodies or diagnostics. Existing response envelopes, authorization, role order, status reconciliation, and public evidence checks remain intact.

Mocked tests verify the transport and failure cases without credentials or billable calls. A live deployment smoke test still requires the configured Vercel environment and account access.

API references: [hosted web search](https://developers.openai.com/api/docs/guides/tools-web-search), [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
