"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Building2, MapPin, Pencil, Plus, RefreshCw } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { isPlatformAdmin } from "@/lib/auth";
import { useProperty } from "@/components/platform/PropertyProvider";
import { WorkspaceShell } from "@/components/platform/WorkspaceShell";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { platformService, type PropertyDto } from "@/services/platform";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function PropertyCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="h-1 animate-pulse bg-slate-200" />
      <div className="p-5">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 animate-pulse rounded-xl bg-slate-200" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-3/4 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-16 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
        <div className="mt-4 h-4 w-24 animate-pulse rounded bg-slate-100" />
        <div className="mt-5 h-10 animate-pulse rounded-xl bg-slate-100" />
      </div>
    </div>
  );
}

function PropertyCard({
  property,
  canEdit,
  onOpen,
}: {
  property: PropertyDto;
  canEdit: boolean;
  onOpen: () => void;
}) {
  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all duration-200",
        "hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-100/40",
      )}
    >
      <div className="h-1 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 group-hover:from-emerald-400 group-hover:via-emerald-500 group-hover:to-teal-400" />

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 text-sm font-bold text-white shadow-md shadow-slate-300/50 group-hover:from-emerald-600 group-hover:to-emerald-800 group-hover:shadow-emerald-200/60">
              {initials(property.name)}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-lg font-bold leading-tight text-slate-900">
                {property.name}
              </h3>
              <span className="mt-1 inline-flex rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-600">
                {property.code}
              </span>
            </div>
          </div>

          {canEdit && (
            <button
              type="button"
              className="rounded-lg p-1.5 text-slate-300 opacity-0 transition-all hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100"
              aria-label={`Edit ${property.name}`}
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="mt-4 flex items-center gap-1.5 text-sm text-slate-500">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
          <span className="truncate">{property.city?.trim() || "Location not set"}</span>
        </div>

        {property.timezone && (
          <p className="mt-1 pl-5 text-xs text-slate-400">{property.timezone}</p>
        )}

        <div className="mt-auto pt-5">
          <Button
            className="h-10 w-full gap-2 border-slate-200 bg-white font-semibold text-slate-800 shadow-sm transition-all hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-900"
            variant="outline"
            onClick={onOpen}
          >
            Open workspace
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </div>
      </div>
    </article>
  );
}

export function PropertyPickerView() {
  const router = useRouter();
  const { user } = useAuth();
  const { setProperty } = useProperty();
  const [properties, setProperties] = useState<PropertyDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", city: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const rows = await platformService.listProperties();
      setProperties(rows);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load properties");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openWorkspace = (property: PropertyDto) => {
    setProperty({
      id: property.id,
      name: property.name,
      code: property.code,
      city: property.city,
      timezone: property.timezone,
      isDefault: property.isDefault,
    });
    router.push("/dashboard");
  };

  const handleCreate = async () => {
    if (!form.name.trim() || !form.code.trim()) return;
    setSaving(true);
    try {
      await platformService.createProperty({
        name: form.name.trim(),
        code: form.code.trim().toLowerCase(),
        city: form.city.trim(),
        isDefault: properties.length === 0,
      });
      setForm({ name: "", code: "", city: "" });
      setShowAdd(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create property");
    } finally {
      setSaving(false);
    }
  };

  return (
    <WorkspaceShell
      title="Choose your property"
      description="Each hotel or lodge runs in its own workspace. Bookings, reports, and settings stay scoped to the property you open."
      actions={
        <>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
          {isPlatformAdmin(user) && (
            <Button
              className="bg-emerald-700 hover:bg-emerald-800"
              onClick={() => setShowAdd(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add property
            </Button>
          )}
        </>
      }
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {properties.length} propert{properties.length === 1 ? "y" : "ies"} available
      </p>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{error}</p>
          {error.includes("user_property_access") && (
            <p className="mt-2 text-xs text-red-600/90">
              Run <code className="rounded bg-red-100 px-1">multi-property-schema.sql</code> and{" "}
              <code className="rounded bg-red-100 px-1">multi-property-seeds.sql</code> in Supabase.
            </p>
          )}
        </div>
      )}

      {showAdd && isPlatformAdmin(user) && (
        <div className="mt-6 rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">New property</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="Property name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="Code (e.g. bbsr)"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="City"
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            />
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              className="bg-emerald-700 hover:bg-emerald-800"
              onClick={() => void handleCreate()}
              disabled={saving}
            >
              {saving ? "Saving…" : "Create property"}
            </Button>
            <Button variant="outline" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {loading &&
          Array.from({ length: 3 }).map((_, i) => <PropertyCardSkeleton key={i} />)}

        {!loading &&
          properties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              canEdit={isPlatformAdmin(user)}
              onOpen={() => openWorkspace(property)}
            />
          ))}

        {!loading && properties.length === 0 && !error && (
          <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Building2 className="h-7 w-7" />
            </div>
            <p className="mt-4 text-base font-semibold text-slate-700">No properties yet</p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              No properties are assigned to your account. Contact an administrator to get access.
            </p>
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}
