import Link from "next/link";
import { Activity, ArrowUpRight, Database, FileText, Monitor, Package } from "lucide-react";
import type { CatalogItem, DraftQuote, SavedQuote, UserSessionRecord } from "@/lib/types";
import type { AdminProject } from "@/lib/admin-projects";

type AdminConsoleProps = {
  projects: AdminProject[];
  databaseStatus: {
    provider: string;
    persistent: boolean;
  };
  items: CatalogItem[];
  quotes: SavedQuote[];
  drafts: DraftQuote[];
  sessions: UserSessionRecord[];
  adminName: string;
};

const statFormatter = new Intl.NumberFormat("en-US");
const moneyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function AdminConsole({ projects, databaseStatus, items, quotes, drafts, sessions, adminName }: AdminConsoleProps) {
  const activeItems = items.filter((item) => !item.deletedAt);
  const activeQuotes = quotes.filter((quote) => !quote.deletedAt);
  const deletedQuotes = quotes.filter((quote) => quote.deletedAt);
  const liveSessions = sessions.filter((session) => !session.endedAt && Date.now() - new Date(session.lastSeenAt).getTime() < 12 * 60 * 60 * 1000);
  const activeDrafts = drafts.filter((draft) => draft.kind === "current" || draft.kind === "saved");
  const totalQuoted = activeQuotes.reduce((sum, quote) => sum + quote.total, 0);
  const recentQuotes = [...activeQuotes].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5);

  return (
    <main className="min-h-screen bg-stone-100 text-stone-950">
      <header className="border-b border-stone-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-normal text-teal-700">Admin Console</p>
            <h1 className="text-2xl font-black">Project Operations</h1>
            <p className="mt-1 text-sm text-stone-600">Welcome back, {adminName}. Monitor QQB now and future apps as they come online.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="button-secondary" href="/">
              Open QQB
              <ArrowUpRight size={16} />
            </Link>
            <Link className="button-secondary" href="/settings">
              Settings
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-4 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <AdminStat icon={Database} label="Database" value={databaseStatus.persistent ? "Connected" : "Offline"} detail={databaseStatus.provider} tone={databaseStatus.persistent ? "good" : "warn"} />
          <AdminStat icon={FileText} label="Active quotes" value={statFormatter.format(activeQuotes.length)} detail={`${moneyFormatter.format(totalQuoted)} quoted`} />
          <AdminStat icon={Monitor} label="Live sessions" value={statFormatter.format(liveSessions.length)} detail={`${statFormatter.format(activeDrafts.length)} draft workspaces`} />
          <AdminStat icon={Package} label="Catalog items" value={statFormatter.format(activeItems.length)} detail={`${statFormatter.format(items.length - activeItems.length)} deleted/recovery`} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Managed Projects</h2>
                <p>Central list for QQB and future apps.</p>
              </div>
            </div>
            <div className="grid gap-3 p-4">
              {projects.map((project) => (
                <div key={project.id} className="grid gap-3 rounded-lg border border-stone-200 bg-stone-50 p-4 md:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-black">{project.name}</h3>
                      <span className={`rounded-full px-2 py-1 text-xs font-black uppercase tracking-normal ${project.status === "active" ? "bg-teal-100 text-teal-900" : "bg-stone-200 text-stone-700"}`}>{project.status}</span>
                    </div>
                    <p className="mt-1 text-sm text-stone-600">{project.description}</p>
                    <div className="mt-3 grid gap-2 text-sm text-stone-600 sm:grid-cols-2">
                      <p><strong className="text-stone-950">Owner:</strong> {project.owner}</p>
                      <p><strong className="text-stone-950">API:</strong> {project.apiBase || "Not connected"}</p>
                    </div>
                  </div>
                  {project.appUrl !== "#" ? (
                    <Link className="button-secondary h-fit" href={project.appUrl}>
                      Open
                      <ArrowUpRight size={16} />
                    </Link>
                  ) : (
                    <button className="button-secondary h-fit" disabled>
                      Planned
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>QQB Health</h2>
                <p>Operational snapshot from the current database.</p>
              </div>
            </div>
            <div className="grid gap-3 p-4">
              <HealthRow label="Deleted quotes in recovery" value={statFormatter.format(deletedQuotes.length)} />
              <HealthRow label="Quote revisions tracked" value={statFormatter.format(activeQuotes.reduce((sum, quote) => sum + (quote.revisions?.length ?? 0), 0))} />
              <HealthRow label="Server-tracked devices" value={statFormatter.format(sessions.length)} />
              <HealthRow label="Database mode" value={databaseStatus.persistent ? databaseStatus.provider : "Not connected"} />
            </div>
          </section>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Recent Quotes</h2>
                <p>Last updated quote records.</p>
              </div>
            </div>
            <div className="grid gap-2 p-4">
              {recentQuotes.length ? (
                recentQuotes.map((quote) => (
                  <div key={quote.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-lg border border-stone-200 bg-white p-3">
                    <div className="min-w-0">
                      <p className="truncate font-black">{quote.meta.customer || "Unnamed customer"}</p>
                      <p className="truncate text-sm text-stone-600">{quote.meta.project || "No project"} / {quote.meta.quoteNumber}</p>
                      <p className="text-xs font-bold text-stone-500">Updated {new Date(quote.updatedAt).toLocaleString()}</p>
                    </div>
                    <strong>{moneyFormatter.format(quote.total)}</strong>
                  </div>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-6 text-center text-stone-500">No quotes yet.</p>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Active Devices</h2>
                <p>Current app-level sessions.</p>
              </div>
            </div>
            <div className="grid gap-2 p-4">
              {liveSessions.length ? (
                liveSessions.map((session) => (
                  <div key={session.id} className="rounded-lg border border-stone-200 bg-white p-3">
                    <p className="font-black">{session.userName}</p>
                    <p className="text-sm text-stone-600">{session.deviceName}</p>
                    <p className="text-xs font-bold text-stone-500">Last seen {new Date(session.lastSeenAt).toLocaleString()}</p>
                  </div>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-6 text-center text-stone-500">No live sessions.</p>
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function AdminStat({ icon: Icon, label, value, detail, tone = "neutral" }: { icon: typeof Activity; label: string; value: string; detail: string; tone?: "neutral" | "good" | "warn" }) {
  const iconClass = tone === "good" ? "bg-teal-100 text-teal-900" : tone === "warn" ? "bg-red-100 text-red-900" : "bg-stone-100 text-stone-700";
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className={`grid size-10 place-items-center rounded-lg ${iconClass}`}>
        <Icon size={18} />
      </div>
      <p className="mt-4 text-xs font-black uppercase tracking-normal text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
      <p className="mt-1 text-sm text-stone-600">{detail}</p>
    </div>
  );
}

function HealthRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white p-3">
      <span className="text-sm font-bold text-stone-600">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
