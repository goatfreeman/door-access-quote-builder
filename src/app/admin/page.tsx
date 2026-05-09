import { redirect } from "next/navigation";
import { AdminConsole } from "@/components/admin-console";
import { adminProjects } from "@/lib/admin-projects";
import type { CatalogItem, DraftQuote, SavedQuote, UserSessionRecord } from "@/lib/types";
import { getSessionUser } from "@/lib/server/auth";
import { getStoreStatus, readCollection } from "@/lib/server/nosql-store";

async function readArray<T>(collection: "items" | "quotes" | "drafts" | "sessions") {
  const value = await readCollection(collection);
  return Array.isArray(value) ? (value as T[]) : [];
}

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");

  const [items, quotes, drafts, sessions] = await Promise.all([
    readArray<CatalogItem>("items"),
    readArray<SavedQuote>("quotes"),
    readArray<DraftQuote>("drafts"),
    readArray<UserSessionRecord>("sessions"),
  ]);

  return <AdminConsole projects={adminProjects} databaseStatus={getStoreStatus()} items={items} quotes={quotes} drafts={drafts} sessions={sessions} adminName={user.name} />;
}
