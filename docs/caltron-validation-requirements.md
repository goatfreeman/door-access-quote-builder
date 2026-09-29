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
| User boundary | `/validation` requires the existing application session. | CONFIRMED |
| Confidentiality warning | The workspace prohibits client names, locations, network details, credentials, prices, and controlled drawings. | CONFIRMED |
| Part-number control | The system preserves `sourcePartNumber` and derives `normalizedLookupKey` separately. | CONFIRMED |
| Evidence status | Domain validation permits only the six controlled status values. | CONFIRMED |
| Evidence URL control | Agent reports accept only `http` and `https` source URLs. | CONFIRMED |
| Agent separation | Jobs run in the order researcher, verifier, and tester. Later stages receive prior reports. | CONFIRMED |
| Prompt-injection control | Each prompt treats retrieved content as untrusted. All execution remains blocked without an operating-system or container isolation assertion. | ASSUMED |
| Structured output | Codex must return a report that conforms to `agent-report.schema.json`. | CONFIRMED |
| Codex credentials | The server uses the separately authorized CLI session. The application does not read or store credential files. | CONFIRMED |
| Deterministic validation | An unintegrated domain module checks nonnegative quantity and line-extension arithmetic. The quote workspace does not call it yet. | ASSUMED — prototype only |
| Automated verification | Tests cover request normalization, URL policy, arithmetic, orchestration, role checks, CLI output handling, job gating, production gating, and the UI safety notice. | CONFIRMED |

## 4. Business-requirement traceability

| Requirement | Current application result | Status | Next controlled increment |
|---|---|---|---|
| `BR-001` | Existing quote records are available. Multi-file upload, hashing, scanning, and source classification are not implemented. | OPEN | Add controlled source ingestion and a source register. |
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
| Next.js server | CLI status request | Codex CLI | Check installed version and authorized account state | Local process | Application server | Run status check with authorized and unauthorized sessions | CONFIRMED |
| Researcher | Structured report | Verifier | Supply evidence for independent verification | Internal JSON | Application server | Verify role order and prior-report transfer | CONFIRMED |
| Verifier | Structured report | Tester | Supply independently checked findings | Internal JSON | Application server | Verify both prior reports reach tester | CONFIRMED |
| Tester | Final draft status and test steps | Browser | Display evidence and qualified-review notice | HTTPS / JSON | Application server | Verify all statuses, findings, and URLs render | ASSUMED — browser acceptance test required |
| Quote line fixture | Quantity and unit values | Deterministic prototype module | Check extensions with proposed `RULE-014` logic | Internal TypeScript call | Application server | Run arithmetic and negative-quantity fixtures | ASSUMED — not connected to quote workspace |

## 7. Assumptions and deviations

- `ASSUMED`: The first deploy target for CLI-backed research is an isolated local Node.js pilot with non-sensitive product identifiers only.
- `DEVIATION`: A standard Vercel runtime cannot use the locally authorized Codex CLI session.
- `REQUIRED`: Every execution mode remains disabled unless `CODEX_VALIDATION_ISOLATED=true`. This setting is an administrator assertion. It does not create isolation. A separate operating-system account or container must limit filesystem and credential access.
- `DEVIATION`: The current API runs the three agents synchronously. A production release needs a durable queue, cancellation, retry limits, and job history.
- `REQUIRED`: Historical quote analyses must not establish current compatibility, lifecycle, price, or approval.
- `REQUIRED`: Do not enable external AI processing for confidential records until Cybersecurity and the Manager approve the data boundary.

## 8. Risks

| Risk | Required control | Status |
|---|---|---|
| Public research receives confidential project data | Enforce the product-only input boundary and complete cybersecurity review. | BLOCKED for confidential data |
| Manufacturer web evidence changes | Store retrieval date, excerpt, URL, and hash in a durable evidence record. | OPEN |
| Synchronous jobs exceed hosting limits | Use a durable worker queue on an approved self-hosted platform. | OPEN |
| AI output appears approved | Keep the draft notice and add reviewer disposition and audit records. | OPEN |
| Direct changes reach production without review | Use feature branches and pull requests. Enable protected-branch rules. | OPEN — repository administrator |
| Dependency audit reports known vulnerabilities | Review dependency paths and approve safe upgrades before production. | OPEN |

## 9. Required decisions

1. Select the approved self-hosted or private model boundary.
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