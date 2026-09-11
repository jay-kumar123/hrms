"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  CalendarRange,
  Search,
  Plus,
  SlidersHorizontal,
  X,
  CheckCircle2,
  XCircle,
  Eye,
  Edit,
  Power,
  Trash2,
  Calendar,
  Sparkles,
  Gift,
  Building2,
  Coins,
  AlertCircle,
} from "lucide-react";
import { ModulePageShell } from "@/components/pms";
import { Button, Drawer, Modal, StatusBadge } from "@/components/ui";
import { HRKPICard } from "@/components/hr/shared/HRKPICard";
import { hrHolidayService } from "@/services/human-resources";
import { mapHolidayFromApi, mapHolidayToApi } from "@/lib/hr/api-mappers";

export type HolidayStatus = "Active" | "Inactive";
export type HolidayCategory = "National" | "Festival" | "Regional" | "Company Optional";

export interface HolidayMaster {
  id: string;
  holidayCode: string;
  holidayName: string;
  holidayDate: string; // DD/MM/YYYY
  dayOfWeek: string;
  category: HolidayCategory;
  isMandatory: boolean;
  extraPayMultiplier: number; // e.g. 2.0x for double pay
  applicableDepartments: string; // "All Departments" or specific
  description: string;
  status: HolidayStatus;
  year: string;
}

export function HolidayCalendarMasterView() {
  const [holidays, setHolidays] = useState<HolidayMaster[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadHolidays = async () => {
    try {
      const rows = await hrHolidayService.list();
      setHolidays(rows.map(mapHolidayFromApi));
    } catch (e) {
      console.warn(e);
      setHolidays([]);
    }
  };

  useEffect(() => {
    void loadHolidays();
  }, []);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [yearFilter, setYearFilter] = useState("2026");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "Active" | "Inactive">("ALL");
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  // Modal & Drawer State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<HolidayMaster | null>(null);
  const [viewingHoliday, setViewingHoliday] = useState<HolidayMaster | null>(null);

  // Form Fields
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formDate, setFormDate] = useState("15/08/2026");
  const [formDay, setFormDay] = useState("Saturday");
  const [formCategory, setFormCategory] = useState<HolidayCategory>("National");
  const [formIsMandatory, setFormIsMandatory] = useState(true);
  const [formMultiplier, setFormMultiplier] = useState(2.0);
  const [formDepts, setFormDepts] = useState("All Departments");
  const [formDescription, setFormDescription] = useState("");
  const [formStatus, setFormStatus] = useState<HolidayStatus>("Active");
  const [formYear, setFormYear] = useState("2026");
  const [nameError, setNameError] = useState("");
  const [codeError, setCodeError] = useState("");

  // Statistics KPI
  const stats = useMemo(() => {
    const total = holidays.length;
    const national = holidays.filter((h) => h.category === "National").length;
    const festival = holidays.filter((h) => h.category === "Festival").length;
    const doublePayHolidays = holidays.filter((h) => h.extraPayMultiplier >= 2.0).length;
    return { total, national, festival, doublePayHolidays };
  }, [holidays]);

  // Filtered List
  const filteredHolidays = useMemo(() => {
    return holidays.filter((h) => {
      const matchSearch =
        h.holidayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.holidayCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.category.toLowerCase().includes(searchTerm.toLowerCase());

      const matchCategory = categoryFilter === "ALL" || h.category === categoryFilter;
      const matchYear = yearFilter === "ALL" || h.year === yearFilter;
      const matchStatus = statusFilter === "ALL" || h.status === statusFilter;

      return matchSearch && matchCategory && matchYear && matchStatus;
    });
  }, [holidays, searchTerm, categoryFilter, yearFilter, statusFilter]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingHoliday(null);
    setFormCode(`HOL-${formYear}-${Math.floor(10 + Math.random() * 90)}`);
    setFormName("");
    setFormDate("15/08/2026");
    setFormDay("Saturday");
    setFormCategory("National");
    setFormIsMandatory(true);
    setFormMultiplier(2.0);
    setFormDepts("All Departments");
    setFormDescription("");
    setFormStatus("Active");
    setFormYear("2026");
    setNameError("");
    setCodeError("");
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (h: HolidayMaster) => {
    setEditingHoliday(h);
    setFormCode(h.holidayCode);
    setFormName(h.holidayName);
    setFormDate(h.holidayDate);
    setFormDay(h.dayOfWeek);
    setFormCategory(h.category);
    setFormIsMandatory(h.isMandatory);
    setFormMultiplier(h.extraPayMultiplier);
    setFormDepts(h.applicableDepartments);
    setFormDescription(h.description);
    setFormStatus(h.status);
    setFormYear(h.year);
    setNameError("");
    setCodeError("");
    setIsModalOpen(true);
  };

  // Save Holiday (Duplicate check)
  const handleSaveHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameError("");
    setCodeError("");

    const trimmedName = formName.trim();
    const trimmedCode = formCode.trim();

    if (!trimmedName) {
      setNameError("Holiday Name is required.");
      return;
    }

    if (!trimmedCode) {
      setCodeError("Holiday Code is required.");
      return;
    }

    // Duplicate check for name & year
    const isDuplicate = holidays.some(
      (h) =>
        h.holidayName.toLowerCase() === trimmedName.toLowerCase() &&
        h.year === formYear &&
        (!editingHoliday || h.id !== editingHoliday.id)
    );

    if (isDuplicate) {
      setNameError(`Holiday "${trimmedName}" is already listed for year ${formYear}.`);
      return;
    }

    const payload = mapHolidayToApi({
      holidayCode: trimmedCode,
      holidayName: trimmedName,
      holidayDate: formDate,
      dayOfWeek: formDay,
      category: formCategory,
      isMandatory: formIsMandatory,
      extraPayMultiplier: Number(formMultiplier),
      applicableDepartments: formDepts,
      description: formDescription.trim(),
      status: formStatus,
      year: formYear,
    });

    try {
      if (editingHoliday) {
        await hrHolidayService.update(editingHoliday.id, payload);
        setToastMessage(`Updated holiday "${trimmedName}".`);
      } else {
        await hrHolidayService.create(payload);
        setToastMessage(`Created holiday "${trimmedName}".`);
      }
      await loadHolidays();
      setIsModalOpen(false);
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : "Failed to save holiday");
    }
  };

  const handleToggleStatus = async (h: HolidayMaster) => {
    const nextStatus: HolidayStatus = h.status === "Active" ? "Inactive" : "Active";
    try {
      await hrHolidayService.update(h.id, { status: nextStatus });
      await loadHolidays();
      setToastMessage(`Holiday "${h.holidayName}" is now ${nextStatus}.`);
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const handleDeleteHoliday = async (h: HolidayMaster) => {
    if (confirm(`Are you sure you want to delete holiday "${h.holidayName}"?`)) {
      try {
        await hrHolidayService.remove(h.id);
        if (viewingHoliday?.id === h.id) setViewingHoliday(null);
        await loadHolidays();
        setToastMessage(`Deleted holiday "${h.holidayName}".`);
      } catch (err) {
        setToastMessage(err instanceof Error ? err.message : "Failed to delete holiday");
      }
    }
  };

  return (
    <ModulePageShell
      eyebrow="Human Resource / Masters"
      title="Holiday Calendar"
      description="Configure annual national and festival holiday calendars, holiday extra pay multipliers, and mandatory duty rules."
      breadcrumbs={[
        { label: "Human Resource", href: "/human-resources/dashboard" },
        { label: "Masters" },
        { label: "Holiday Calendar" },
      ]}
      toast={toastMessage}
      onDismissToast={() => setToastMessage(null)}
      secondaryActions={
        <Button
          type="button"
          size="sm"
          onClick={handleOpenCreateModal}
          className="rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs cursor-pointer"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Holiday
        </Button>
      }
    >
      {/* ─────────────────────────────────────────────────────────────
          SECTION 1: REUSABLE KPI DASHBOARD CARDS
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <HRKPICard
          label="Total Holidays"
          value={`${stats.total}`}
          subtitle="Calendar Year 2026"
          tone="blue"
          icon={<CalendarRange className="h-5 w-5" />}
        />
        <HRKPICard
          label="National Holidays"
          value={`${stats.national}`}
          subtitle="Statutory Mandatory"
          tone="emerald"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <HRKPICard
          label="Festival Holidays"
          value={`${stats.festival}`}
          subtitle="Festive Occasions"
          tone="purple"
          icon={<Gift className="h-5 w-5" />}
        />
        <HRKPICard
          label="Double Pay (2.0x)"
          value={`${stats.doublePayHolidays}`}
          subtitle="Working Staff Premium"
          tone="amber"
          icon={<Coins className="h-5 w-5" />}
        />
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 2: SEARCH & FILTERS TOOLBAR
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs mb-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search Holiday Name or Code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-slate-50/50 font-medium text-slate-800"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Desktop Filters */}
            <div className="hidden sm:flex items-center gap-2">
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="text-xs rounded-xl border border-slate-200 py-2 px-3 bg-white font-extrabold text-slate-800"
              >
                <option value="2026">2026 Calendar</option>
                <option value="2025">2025 Calendar</option>
                <option value="ALL">All Years</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="text-xs rounded-xl border border-slate-200 py-2 px-3 bg-white font-semibold text-slate-800"
              >
                <option value="ALL">All Categories</option>
                <option value="National">National Public</option>
                <option value="Festival">Festival</option>
                <option value="Regional">Regional</option>
                <option value="Company Optional">Company Optional</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="text-xs rounded-xl border border-slate-200 py-2 px-3 bg-white font-semibold text-slate-800"
              >
                <option value="ALL">All Statuses</option>
                <option value="Active">🟢 Active</option>
                <option value="Inactive">⚪ Inactive</option>
              </select>

              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setCategoryFilter("ALL");
                  setYearFilter("2026");
                  setStatusFilter("ALL");
                }}
                className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl hover:bg-slate-50 transition"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Mobile Filter Trigger */}
          <button
            type="button"
            onClick={() => setIsMobileFilterOpen(true)}
            className="sm:hidden px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50 flex items-center gap-1.5"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 3: DATA TABLE (DESKTOP) & STACKED CARDS (MOBILE)
      ───────────────────────────────────────────────────────────── */}
      {/* Desktop Table */}
      <div className="hidden sm:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="py-3.5 px-4">Holiday Name</th>
                <th className="py-3.5 px-4">Date &amp; Day</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Extra Duty Pay Multiplier</th>
                <th className="py-3.5 px-4">Mandatory Holiday</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredHolidays.length > 0 ? (
                filteredHolidays.map((h) => (
                  <tr
                    key={h.id}
                    className="hover:bg-slate-50/80 transition cursor-pointer"
                    onClick={() => setViewingHoliday(h)}
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-amber-50 text-amber-700 font-bold text-xs">
                          <Gift className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{h.holidayName}</p>
                          <span className="text-[11px] text-slate-400 font-mono">{h.holidayCode}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-900">📅 {h.holidayDate}</p>
                      <p className="text-[11px] text-slate-500 font-medium">{h.dayOfWeek}</p>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {h.category}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-950 border border-emerald-300">
                        💰 {h.extraPayMultiplier}x Salary Rate
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      {h.isMandatory ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-50 text-blue-900 border border-blue-200">
                          Mandatory Public Holiday
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">Optional / Restricted</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <StatusBadge status={h.status} />
                    </td>

                    <td
                      className="py-3.5 px-4 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setViewingHoliday(h)}
                          className="rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1 text-slate-500" /> View
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEditModal(h)}
                          className="rounded-xl text-xs font-semibold text-emerald-800 border-emerald-300 hover:bg-emerald-50"
                        >
                          <Edit className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Edit
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleStatus(h)}
                          className={`rounded-xl text-xs font-semibold ${
                            h.status === "Active"
                              ? "text-amber-800 border-amber-300 hover:bg-amber-50"
                              : "text-emerald-800 border-emerald-300 hover:bg-emerald-50"
                          }`}
                        >
                          <Power className="h-3.5 w-3.5 mr-1" />
                          {h.status === "Active" ? "Deactivate" : "Activate"}
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteHoliday(h)}
                          className="rounded-xl text-xs font-semibold text-rose-700 border-rose-200 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 text-xs">
                    No holidays found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Stacked Cards View */}
      <div className="sm:hidden space-y-3">
        {filteredHolidays.map((h) => (
          <div
            key={h.id}
            className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3"
            onClick={() => setViewingHoliday(h)}
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono text-slate-400 block">{h.holidayCode}</span>
                <h4 className="font-bold text-slate-900 text-sm">{h.holidayName}</h4>
              </div>
              <StatusBadge status={h.status} />
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
              <p className="text-slate-900 font-bold">Date: {h.holidayDate} ({h.dayOfWeek})</p>
              <p className="text-slate-500">Category: {h.category}</p>
              <p className="text-slate-500">Working Staff Extra Pay: <strong>{h.extraPayMultiplier}x Multiplier</strong></p>
            </div>

            <div className="grid grid-cols-3 gap-1.5 pt-1" onClick={(e) => e.stopPropagation()}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleOpenEditModal(h)}
                className="text-xs font-semibold text-emerald-800 border-emerald-300"
              >
                Edit
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleToggleStatus(h)}
                className="text-xs font-semibold"
              >
                {h.status === "Active" ? "Deactivate" : "Activate"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleDeleteHoliday(h)}
                className="text-xs font-semibold text-rose-700 border-rose-200"
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODAL: ADD / EDIT HOLIDAY
      ───────────────────────────────────────────────────────────── */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingHoliday ? "Edit Holiday" : "Add Holiday"}
          description="Configure holiday date, category, mandatory status, and duty extra pay rate."
          size="md"
        >
          <form onSubmit={handleSaveHoliday} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Holiday Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HOL-2026-01"
                  value={formCode}
                  onChange={(e) => {
                    setFormCode(e.target.value);
                    setCodeError("");
                  }}
                  className={`w-full rounded-xl border p-2.5 font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 ${
                    codeError ? "border-rose-400 focus:ring-rose-500" : "border-slate-200 focus:ring-emerald-600"
                  }`}
                />
                {codeError && <p className="text-[11px] text-rose-600 font-bold pt-1">{codeError}</p>}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Holiday Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Republic Day"
                  value={formName}
                  onChange={(e) => {
                    setFormName(e.target.value);
                    setNameError("");
                  }}
                  className={`w-full rounded-xl border p-2.5 font-semibold text-slate-900 focus:outline-none focus:ring-2 ${
                    nameError ? "border-rose-400 focus:ring-rose-500" : "border-slate-200 focus:ring-emerald-600"
                  }`}
                />
                {nameError && <p className="text-[11px] text-rose-600 font-bold pt-1">{nameError}</p>}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Holiday Date</label>
                <input
                  type="text"
                  placeholder="DD/MM/YYYY"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-semibold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Day of Week</label>
                <input
                  type="text"
                  placeholder="e.g. Monday"
                  value={formDay}
                  onChange={(e) => setFormDay(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-semibold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Category</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as HolidayCategory)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-semibold text-slate-900 bg-white"
                >
                  <option value="National">National Public</option>
                  <option value="Festival">Festival</option>
                  <option value="Regional">Regional</option>
                  <option value="Company Optional">Company Optional</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Extra Duty Pay Multiplier</label>
                <select
                  value={formMultiplier}
                  onChange={(e) => setFormMultiplier(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-extrabold text-emerald-950 bg-white"
                >
                  <option value={2.0}>2.0x Double Salary Rate</option>
                  <option value={1.5}>1.5x One and Half Rate</option>
                  <option value={1.0}>1.0x Normal Salary Rate</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Calendar Year</label>
                <input
                  type="text"
                  value={formYear}
                  onChange={(e) => setFormYear(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-semibold text-slate-900"
                />
              </div>
            </div>

            {/* Mandatory Checkbox */}
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formIsMandatory}
                  onChange={(e) => setFormIsMandatory(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <span className="font-bold text-slate-900 block">Mandatory Public Holiday</span>
                  <span className="text-[10px] text-slate-500">Mandatory holiday rules apply to all salaried staff members.</span>
                </div>
              </label>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Description &amp; Notes</label>
              <textarea
                rows={3}
                placeholder="Holiday occasion details and hotel operations guidelines..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2.5 font-medium text-slate-800"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Status</label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as HolidayStatus)}
                className="w-full rounded-xl border border-slate-200 p-2.5 font-semibold text-slate-800 bg-white"
              >
                <option value="Active">🟢 Active (Applied to holiday attendance payroll)</option>
                <option value="Inactive">⚪ Inactive (Archived / Disabled)</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white"
              >
                {editingHoliday ? "Update Holiday" : "Save Holiday"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ─────────────────────────────────────────────────────────────
          DRAWER: VIEW HOLIDAY DETAILS
      ───────────────────────────────────────────────────────────── */}
      <Drawer
        isOpen={Boolean(viewingHoliday)}
        onClose={() => setViewingHoliday(null)}
        title="Holiday Master Details"
        icon={<CalendarRange className="h-5 w-5 text-amber-700" />}
      >
        {viewingHoliday && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-1">
              <span className="text-[10px] text-slate-400 font-mono font-bold block">{viewingHoliday.holidayCode}</span>
              <h3 className="text-base font-black text-amber-400">{viewingHoliday.holidayName}</h3>
              <StatusBadge status={viewingHoliday.status} />
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <span className="font-extrabold text-slate-900 block uppercase">Schedule &amp; Category</span>
              <div className="flex justify-between">
                <span className="text-slate-600">Holiday Date:</span>
                <strong className="text-slate-900">{viewingHoliday.holidayDate} ({viewingHoliday.dayOfWeek})</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Category:</span>
                <strong className="text-slate-900">{viewingHoliday.category}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Calendar Year:</span>
                <strong className="text-slate-900">{viewingHoliday.year}</strong>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-2">
              <span className="font-extrabold text-emerald-950 block uppercase">Working Duty Extra Pay</span>
              <div className="flex items-center justify-between">
                <span className="text-slate-700 font-medium">Extra Pay Multiplier:</span>
                <strong className="text-emerald-950 text-sm font-black">💰 {viewingHoliday.extraPayMultiplier}x Salary Rate</strong>
              </div>
              <p className="text-[11px] text-slate-500">
                Operational staff working shift on this day will be credited extra payment at {viewingHoliday.extraPayMultiplier}x rate.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1">
              <span className="font-extrabold text-slate-900 block uppercase">Description</span>
              <p className="text-slate-700 leading-relaxed">{viewingHoliday.description}</p>
            </div>
          </div>
        )}
      </Drawer>

      {/* MOBILE FILTERS DRAWER */}
      <Drawer
        isOpen={isMobileFilterOpen}
        onClose={() => setIsMobileFilterOpen(false)}
        title="Holiday Filters"
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Calendar Year</label>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2.5 font-semibold text-slate-800 bg-white"
            >
              <option value="2026">2026 Calendar</option>
              <option value="2025">2025 Calendar</option>
              <option value="ALL">All Years</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2.5 font-semibold text-slate-800 bg-white"
            >
              <option value="ALL">All Categories</option>
              <option value="National">National Public</option>
              <option value="Festival">Festival</option>
              <option value="Regional">Regional</option>
              <option value="Company Optional">Company Optional</option>
            </select>
          </div>

          <Button
            type="button"
            onClick={() => setIsMobileFilterOpen(false)}
            className="w-full font-bold bg-emerald-700 text-white rounded-xl"
          >
            Apply Filters
          </Button>
        </div>
      </Drawer>
    </ModulePageShell>
  );
}
