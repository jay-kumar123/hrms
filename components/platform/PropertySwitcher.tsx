"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronDown, Loader2 } from "lucide-react";
import { usePropertyOptional } from "@/components/platform/PropertyProvider";
import { cn } from "@/lib/utils";
import { platformService, type PropertyDto } from "@/services/platform";

function toSession(property: PropertyDto) {
  return {
    id: property.id,
    name: property.name,
    code: property.code,
    city: property.city,
    timezone: property.timezone,
    isDefault: property.isDefault,
  };
}

export function PropertySwitcher({ className }: { className?: string }) {
  const router = useRouter();
  const propertyCtx = usePropertyOptional();
  const [open, setOpen] = useState(false);
  const [properties, setProperties] = useState<PropertyDto[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = propertyCtx?.property;

  useEffect(() => {
    if (!propertyCtx || !open) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const rows = await platformService.listProperties();
        if (!cancelled) setProperties(rows);
      } catch {
        if (!cancelled) setProperties([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [propertyCtx, open]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!propertyCtx) return null;

  const handleSelect = (property: PropertyDto) => {
    propertyCtx.setProperty(toSession(property));
    setOpen(false);
    router.push("/dashboard");
  };

  const handleOpenPicker = () => {
    setOpen(false);
    router.push("/properties");
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex max-w-[220px] items-center gap-2 rounded-lg border border-white/10 px-2.5 py-1.5 text-left transition-colors sm:max-w-[260px]",
          "hover:bg-white/10",
          open && "bg-white/10",
        )}
      >
        <Building2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-white sm:text-xs">
          {current?.name ?? "Select property"}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-neutral-400 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Switch property"
          className="absolute right-0 z-50 mt-1.5 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        >
          <div className="border-b border-slate-100 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Your properties
            </p>
            {current && (
              <p className="mt-0.5 truncate text-xs text-slate-500">
                Current: <span className="font-medium text-slate-700">{current.name}</span>
              </p>
            )}
          </div>

          <div className="max-h-56 overflow-y-auto py-1">
            {loading ? (
              <div className="flex items-center gap-2 px-3 py-3 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                Loading properties…
              </div>
            ) : properties.length === 0 ? (
              <p className="px-3 py-3 text-sm text-slate-500">No properties assigned to your account.</p>
            ) : (
              properties.map((property) => {
                const isSelected = current?.id === property.id;

                return (
                  <button
                    key={property.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleSelect(property)}
                    className={cn(
                      "flex w-full items-start gap-3 px-3 py-2.5 text-left transition hover:bg-emerald-50",
                      isSelected && "bg-emerald-50/80",
                    )}
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-bold text-slate-600">
                      {property.code.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{property.name}</p>
                      <p className="truncate text-xs text-slate-500">
                        {property.city?.trim() || "—"} · {property.code.toUpperCase()}
                      </p>
                    </div>
                    {isSelected ? <Check className="mt-1 h-4 w-4 shrink-0 text-emerald-600" /> : null}
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-slate-100 p-1.5">
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={handleOpenPicker}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-emerald-700 transition hover:bg-emerald-50"
            >
              <Building2 className="h-4 w-4" />
              Select property
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
