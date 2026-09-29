"use client";

import { ArrowLeft, CheckCircle2, ExternalLink, FlaskConical, Search, ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import type { CompatibilityResult, EvidenceStatus } from "@/lib/validation/domain";

type StatusResponse = {
  enabled: boolean;
  installed?: boolean;
  authenticated?: boolean;
  version?: string | null;
  accountDetail?: string;
};

const confidentialityNotice = "Do not enter client names, project locations, device locations, network details, credentials, prices, or controlled drawings. Enter product identifiers and a compatibility question only.";

const statusClasses: Record<EvidenceStatus, string> = {
  CONFIRMED: "border-emerald-200 bg-emerald-50 text-emerald-900",
  ASSUMED: "border-sky-200 bg-sky-50 text-sky-900",
  OPEN: "border-amber-200 bg-amber-50 text-amber-900",
  CONFLICT: "border-orange-200 bg-orange-50 text-orange-900",
  BLOCKED: "border-red-200 bg-red-50 text-red-900",
  "NOT APPLICABLE": "border-stone-200 bg-stone-50 text-stone-700",
};

export function ValidationWorkspace() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [manufacturer, setManufacturer] = useState("");
  const [sourcePartNumber, setSourcePartNumber] = useState("");
  const [description, setDescription] = useState("");
  const [relatedItems, setRelatedItems] = useState("");
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<CompatibilityResult | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    fetch("/api/validation/codex", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as StatusResponse & { error?: string };
        if (!response.ok) throw new Error(payload.error || "Could not read Codex status");
        setStatus(payload);
      })
      .catch((statusError) => setError(statusError instanceof Error ? statusError.message : "Could not read Codex status"));
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setRunning(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/validation/codex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manufacturer,
          sourcePartNumber,
          description,
          relatedItems: relatedItems.split(/[,\n]/).map((item) => item.trim()).filter(Boolean),
          question,
        }),
      });
      const payload = (await response.json()) as { data?: CompatibilityResult; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "Compatibility review failed");
      setResult(payload.data);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Compatibility review failed");
    } finally {
      setRunning(false);
    }
  };

  const ready = Boolean(status?.enabled && status.installed && status.authenticated);

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-6 text-stone-950">
      <div className="mx-auto grid max-w-6xl gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-teal-800">CONFIDENTIAL — INTERNAL CALTRON DRAFT</p>
            <h1 className="mt-1 text-3xl font-black">Item Compatibility Review</h1>
            <p className="mt-1 text-sm text-stone-600">Researcher → Verifier → Tester. Every result remains a draft.</p>
          </div>
          <a className="button-secondary" href="/">
            <ArrowLeft size={16} />
            Quote Builder
          </a>
        </div>

        <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-950">
          {confidentialityNotice}
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Codex connection</h2>
              <p>The server checks the separately authorized Codex CLI session. It does not read or store account credentials.</p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-black ${ready ? statusClasses.CONFIRMED : statusClasses.OPEN}`}>
              {status === null ? "CHECKING" : ready ? "READY" : "OPEN"}
            </span>
          </div>
          <div className="grid gap-2 p-4 text-sm text-stone-700 sm:grid-cols-3">
            <p><strong className="text-stone-950">Feature:</strong> {status?.enabled ? "Enabled" : "Disabled"}</p>
            <p><strong className="text-stone-950">CLI:</strong> {status?.installed ? status.version : "Not available"}</p>
            <p><strong className="text-stone-950">Account:</strong> {status?.accountDetail ?? "Checking"}</p>
          </div>
        </section>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <form className="panel" onSubmit={submit}>
            <div className="panel-header">
              <div>
                <h2>Compatibility question</h2>
                <p>Keep each source identifier exactly as shown on the quote or product record.</p>
              </div>
            </div>
            <div className="grid gap-4 p-4">
              <label className="field">
                <span>Manufacturer</span>
                <input className="input" value={manufacturer} onChange={(event) => setManufacturer(event.target.value)} required maxLength={160} />
              </label>
              <label className="field">
                <span>Source part number</span>
                <input className="input font-mono" value={sourcePartNumber} onChange={(event) => setSourcePartNumber(event.target.value)} required maxLength={160} />
              </label>
              <label className="field">
                <span>Source description</span>
                <textarea className="textarea" value={description} onChange={(event) => setDescription(event.target.value)} required maxLength={1_000} />
              </label>
              <label className="field">
                <span>Related product identifiers</span>
                <textarea className="textarea" value={relatedItems} onChange={(event) => setRelatedItems(event.target.value)} placeholder="One per line or comma-separated" />
              </label>
              <label className="field">
                <span>Compatibility question</span>
                <textarea className="textarea" value={question} onChange={(event) => setQuestion(event.target.value)} required maxLength={2_000} />
              </label>
              <button className="button-primary" disabled={!ready || running} type="submit">
                <Search size={17} />
                {running ? "Running three-stage review…" : "Run Compatibility Review"}
              </button>
              {!ready ? <p className="text-sm font-bold text-amber-800">Set `CODEX_VALIDATION_ENABLED=true` and authorize the Codex CLI on this server.</p> : null}
              {error ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-900">{error}</p> : null}
            </div>
          </form>

          <section className="grid gap-4">
            {!result ? <AgentPipeline /> : (
              <>
                <div className="panel p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase text-stone-500">Draft final status</p>
                      <h2 className="mt-1 text-2xl font-black">{result.finalStatus}</h2>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClasses[result.finalStatus]}`}>{result.finalStatus}</span>
                  </div>
                  <p className="mt-3 text-sm font-bold text-stone-700">{result.decisionNotice}</p>
                </div>
                {result.reports.map((report) => (
                  <article className="panel" key={report.role}>
                    <div className="panel-header">
                      <div>
                        <p className="text-xs font-black uppercase text-stone-500">{report.role}</p>
                        <h2>{report.summary}</h2>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClasses[report.status]}`}>{report.status}</span>
                    </div>
                    <div className="grid gap-3 p-4">
                      {report.findings.map((finding, index) => (
                        <div className="rounded-lg border border-stone-200 bg-stone-50 p-3" key={`${report.role}-${index}`}>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <p className="font-black">{finding.title}</p>
                            <span className={`rounded-full border px-2 py-1 text-[11px] font-black ${statusClasses[finding.status]}`}>{finding.status}</span>
                          </div>
                          <p className="mt-2 text-sm text-stone-700">{finding.detail}</p>
                          {finding.affectedItems.length ? <p className="mt-2 text-sm"><strong>Affected items:</strong> {finding.affectedItems.join(", ")}</p> : null}
                          {finding.evidence.length ? (
                            <div className="mt-2">
                              <p className="text-xs font-black uppercase text-stone-500">Finding evidence</p>
                              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-stone-700">
                                {finding.evidence.map((evidence, evidenceIndex) => <li key={evidenceIndex}>{evidence}</li>)}
                              </ul>
                            </div>
                          ) : null}
                          <p className="mt-2 text-sm"><strong>Required action:</strong> {finding.recommendedAction}</p>
                        </div>
                      ))}
                      <div>
                        <p className="text-xs font-black uppercase text-stone-500">Sources</p>
                        <div className="mt-2 grid gap-1">
                          {report.sources.map((source) => (
                            <a className="flex items-center gap-2 break-all text-sm font-bold text-teal-800 underline" href={source} key={source} target="_blank" rel="noreferrer">
                              <ExternalLink size={14} />
                              {source}
                            </a>
                          ))}
                          {!report.sources.length ? <p className="text-sm font-bold text-amber-800">No web source was supplied.</p> : null}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function AgentPipeline() {
  return (
    <section className="panel p-4">
      <h2 className="text-xl font-black">Independent review chain</h2>
      <p className="mt-1 text-sm text-stone-600">Each stage receives a distinct task. The verifier must check the evidence independently.</p>
      <div className="mt-4 grid gap-3">
        <PipelineStage icon={Search} title="Researcher" detail="Find current manufacturer pages, manuals, data sheets, and lifecycle notices." />
        <PipelineStage icon={ShieldCheck} title="Verifier" detail="Check the source and claim independently. Record conflicts and missing facts." />
        <PipelineStage icon={FlaskConical} title="Tester" detail="Challenge the conclusion and define a measurable test and pass criterion." />
      </div>
      <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-950">A qualified Caltron reviewer must approve the final compatibility decision.</p>
    </section>
  );
}

function PipelineStage({ icon: Icon, title, detail }: { icon: typeof CheckCircle2; title: string; detail: string }) {
  return (
    <div className="flex gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
      <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-teal-100 text-teal-900"><Icon size={19} /></div>
      <div>
        <p className="font-black">{title}</p>
        <p className="mt-1 text-sm text-stone-600">{detail}</p>
      </div>
    </div>
  );
}