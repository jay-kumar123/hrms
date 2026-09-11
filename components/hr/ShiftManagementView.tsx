"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Repeat,
  Search,
  Loader2,
  Filter,
  Plus,
  Users,
  Sun,
  Moon,
  Sunset,
  Clock,
  Calendar,
  Eye,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Upload,
  Download,
  X,
  User,
  Building2,
  Layers,
  ChevronDown,
  ChevronUp,
  Check,
  Sparkles,
  Info,
  History,
  Zap,
  CalendarDays,
  UserCheck,
  UserX,
  AlertCircle,
  ArrowRight,
  SlidersHorizontal,
} from "lucide-react";
import { ModulePageShell } from "@/components/pms";
import { Modal } from "@/components/ui/Modal";
import { Button, Drawer } from "@/components/ui";
import { HrSearchFilterToolbar } from "@/components/hr/shared/HrSearchFilterToolbar";
import { ReportExportModal } from "@/components/shared/ReportExportModal";
import {
  ListSummaryCards,
  ToolbarFilterGroup,
  ToolbarFilterSelect,
} from "@/components/shared/list-table";
import { employeeDepartmentFilterOptions } from "@/app/data/hr/employeeDepartmentOptions";
import { exportGenericReport, filterByIsoDateRange, normalizeToIsoDate, type ReportExportOptions } from "@/lib/hr/report-export";
import type { ExportColumn } from "@/lib/exportUtils";
import { cn } from "@/lib/utils";
import { hrShiftAssignmentService, hrShiftTypeService, hrEmployeeService } from "@/services/human-resources";
import { mapShiftAssignmentFromApi, mapShiftAssignmentToApi, mapShiftTypeFromApi, mapEmployeeFromApi } from "@/lib/hr/api-mappers";
import type { EmployeeItem } from "@/app/data/hr/employeeListData";

export interface MasterShiftTemplate {
  id: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  graceMinutes: number;
  color: string;
  badgeColor: string;
  category: "Morning" | "Evening" | "Night" | "General" | "Split";
}

export interface ShiftHistoryEntry {
  id: string;
  date: string;
  oldShift: string;
  newShift: string;
  changedBy: string;
  remarks?: string;
}

export interface ShiftAssignment {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  designation: string;
  employmentType: "Permanent" | "Contractual" | "Probation" | "Trainee";
  avatar: string;
  photoUrl?: string;
  shiftId: string;
  shiftCode: string;
  shiftName: string;
  shiftCategory: "Morning" | "Evening" | "Night" | "General" | "Split";
  startTime: string;
  endTime: string;
  effectiveFrom: string;
  effectiveTo?: string; // Optional: If empty -> "Until Further Notice"
  status: "Active" | "Upcoming" | "Expired" | "Inactive";
  assignedBy: string;
  assignedOn: string;
  remarks?: string;
  history?: ShiftHistoryEntry[];
}

const shiftStatusFilterOptions = [
  { value: "ALL", label: "All statuses" },
  { value: "Active", label: "Active" },
  { value: "Upcoming", label: "Upcoming" },
  { value: "Expired", label: "Expired" },
  { value: "Inactive", label: "Inactive" },
] as const;

type ShiftExportRow = {
  employeeId: string;
  employeeName: string;
  department: string;
  shiftName: string;
  effectiveFrom: string;
  effectiveTo: string;
  status: string;
};

const shiftExportColumns: ExportColumn<ShiftExportRow>[] = [
  { key: "employeeId", header: "Employee ID" },
  { key: "employeeName", header: "Employee Name" },
  { key: "department", header: "Department" },
  { key: "shiftName", header: "Shift" },
  { key: "effectiveFrom", header: "Effective From" },
  { key: "effectiveTo", header: "Effective To" },
  { key: "status", header: "Status" },
];

export function ShiftManagementView() {
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([])
  const [masterShifts, setMasterShifts] = useState<MasterShiftTemplate[]>([])
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [viewMode, setViewMode] = useState<"table" | "roster">("table");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSubmittingSingle, setIsSubmittingSingle] = useState(false);
  const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);
  const [isSubmittingQuick, setIsSubmittingQuick] = useState(false);
  const shiftCategoryColors: Record<string, { color: string; badgeColor: string }> = {
    Morning: { color: "bg-amber-100 text-amber-800 border-amber-300", badgeColor: "bg-amber-500 text-white" },
    Evening: { color: "bg-blue-100 text-blue-800 border-blue-300", badgeColor: "bg-blue-600 text-white" },
    Night: { color: "bg-purple-100 text-purple-800 border-purple-300", badgeColor: "bg-purple-600 text-white" },
    General: { color: "bg-emerald-100 text-emerald-800 border-emerald-300", badgeColor: "bg-emerald-600 text-white" },
    Split: { color: "bg-orange-100 text-orange-800 border-orange-300", badgeColor: "bg-orange-600 text-white" },
  };

  const loadShiftData = async () => {
    try {
      const [assignRows, shiftRows, empRows] = await Promise.all([
        hrShiftAssignmentService.list(),
        hrShiftTypeService.list(),
        hrEmployeeService.list(),
      ]);
      const emps = empRows.map(mapEmployeeFromApi);
      setEmployees(emps);
      const lookup = new Map(emps.map((e) => [e.id, e]));
      const shiftLookup = new Map(shiftRows.map((st) => [st.id, mapShiftTypeFromApi(st)]));
      setAssignments(
        assignRows.map((row) => mapShiftAssignmentFromApi(row, lookup.get(String(row.employeeId)), shiftLookup.get(String(row.shiftTypeId || row.shiftId)))),
      );
      setMasterShifts(
        shiftRows.map(mapShiftTypeFromApi).map((st) => {
          const category = (["Morning", "Evening", "Night", "General", "Split"].includes(st.category)
            ? st.category
            : "General") as MasterShiftTemplate["category"];
          const colors = shiftCategoryColors[category] ?? shiftCategoryColors.General;
          return {
            id: st.id,
            code: st.shiftCode,
            name: st.shiftName,
            startTime: st.startTime,
            endTime: st.endTime,
            breakMinutes: st.breakDurationMinutes,
            graceMinutes: 15,
            color: colors.color,
            badgeColor: colors.badgeColor,
            category,
          };
        }),
      );
      if (emps[0]) setAssignEmpId(emps[0].id);
    } catch (e) {
      console.warn(e);
      setAssignments([]);
      setMasterShifts([]);
      setEmployees([]);
    }
  };

  useEffect(() => { void loadShiftData(); }, []);



  // Single-Line Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("ALL");
  const [selectedShiftType, setSelectedShiftType] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [showFilterPanel, setShowFilterPanel] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Modals & Drawers State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isQuickChangeModalOpen, setIsQuickChangeModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isUpcomingChangesDrawerOpen, setIsUpcomingChangesDrawerOpen] = useState(false);

  const [editingAssignment, setEditingAssignment] = useState<ShiftAssignment | null>(null);
  const [quickChangeTarget, setQuickChangeTarget] = useState<ShiftAssignment | null>(null);
  const [historyTarget, setHistoryTarget] = useState<ShiftAssignment | null>(null);
  const [viewingAssignment, setViewingAssignment] = useState<ShiftAssignment | null>(null);

  // Single Form State (With Live Search Employee Filter)
  const [assignEmpId, setAssignEmpId] = useState("");
  const [assignEmpQuery, setAssignEmpQuery] = useState("");
  const [isEmpComboboxOpen, setIsEmpComboboxOpen] = useState(false);
  const assignComboboxRef = useRef<HTMLDivElement>(null);
  const [assignShiftId, setAssignShiftId] = useState("");

  // Close Employee Combobox Popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (assignComboboxRef.current && !assignComboboxRef.current.contains(event.target as Node)) {
        setIsEmpComboboxOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const [assignEffectiveFrom, setAssignEffectiveFrom] = useState("2026-08-01");
  const [assignEffectiveTo, setAssignEffectiveTo] = useState("");
  const [assignRemarks, setAssignRemarks] = useState("");
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  // Quick Change State
  const [quickNewShiftId, setQuickNewShiftId] = useState("shift-e2");

  // Flexible Bulk Form State
  const [bulkApplyTo, setBulkApplyTo] = useState<"Department" | "Employees" | "Designation" | "EmploymentType">("Department");
  const [bulkDepartment, setBulkDepartment] = useState("");
  const [bulkDesignation, setBulkDesignation] = useState("");
  const [bulkEmploymentType, setBulkEmploymentType] = useState("");
  const [bulkShiftId, setBulkShiftId] = useState("");
  const [bulkEffectiveFrom, setBulkEffectiveFrom] = useState("2026-08-01");
  const [bulkEffectiveTo, setBulkEffectiveTo] = useState("");

  // Filtered Assignments
  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      const matchSearch =
        a.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.shiftName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.shiftCode.toLowerCase().includes(searchTerm.toLowerCase());

      const matchDept = selectedDepartment === "ALL" || a.department === selectedDepartment;
      const matchShift = selectedShiftType === "ALL" || a.shiftId === selectedShiftType;
      const matchStatus = selectedStatus === "ALL" || a.status === selectedStatus;

      return matchSearch && matchDept && matchShift && matchStatus;
    });
  }, [assignments, searchTerm, selectedDepartment, selectedShiftType, selectedStatus]);

  // Real-Time Coverage Breakdown Widget Metrics (100% Calculated from Live Data)
  const coverageMetrics = useMemo(() => {
    const activeAssigned = assignments.filter((a) => a.status === "Active");
    const morning = activeAssigned.filter(
      (a) => a.shiftCategory === "Morning" || a.shiftName.toLowerCase().includes("morning"),
    ).length;
    const evening = activeAssigned.filter(
      (a) => a.shiftCategory === "Evening" || a.shiftName.toLowerCase().includes("evening"),
    ).length;
    const night = activeAssigned.filter(
      (a) => a.shiftCategory === "Night" || a.shiftName.toLowerCase().includes("night"),
    ).length;
    const general = activeAssigned.filter(
      (a) =>
        a.shiftCategory === "General" ||
        (!a.shiftName.toLowerCase().includes("morning") &&
          !a.shiftName.toLowerCase().includes("evening") &&
          !a.shiftName.toLowerCase().includes("night")),
    ).length;

    const assignedEmpIds = new Set(activeAssigned.map((a) => a.employeeId));
    const unassigned = Math.max(0, employees.length - assignedEmpIds.size);
    const total = employees.length || activeAssigned.length;

    return { morning, evening, night, general, unassigned, total };
  }, [assignments, employees]);

  const summaryStats = useMemo(
    () => [
      { label: "Total Staff", value: coverageMetrics.total, color: "#4f46e5", icon: "users" as const },
      { label: "Morning Shift", value: coverageMetrics.morning, color: "#f59e0b", icon: "clock" as const },
      { label: "Evening Shift", value: coverageMetrics.evening, color: "#0284c7", icon: "clock" as const },
      { label: "Night Shift", value: coverageMetrics.night, color: "#9333ea", icon: "clock" as const },
      { label: "Unassigned Staff", value: coverageMetrics.unassigned, color: "#e11d48", icon: "alert-triangle" as const },
    ],
    [coverageMetrics],
  );

  const hasActiveFilters =
    searchTerm !== "" ||
    selectedDepartment !== "ALL" ||
    selectedShiftType !== "ALL" ||
    selectedStatus !== "ALL";

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedDepartment("ALL");
    setSelectedShiftType("ALL");
    setSelectedStatus("ALL");
  };

  const shiftTypeFilterOptions = useMemo(
    () => [
      { value: "ALL", label: "All shifts" },
      ...masterShifts.map((s) => ({ value: s.id, label: s.name })),
    ],
    [masterShifts],
  );

  const handleShiftExport = async (options: ReportExportOptions) => {
    setExporting(true);
    try {
      const ranged = filterByIsoDateRange(
        filteredAssignments,
        (a) => normalizeToIsoDate(a.effectiveFrom),
        options.fromDate,
        options.toDate,
      );
      const rows: ShiftExportRow[] = ranged.map((a) => ({
        employeeId: a.employeeId,
        employeeName: a.employeeName,
        department: a.department,
        shiftName: a.shiftName,
        effectiveFrom: a.effectiveFrom,
        effectiveTo: a.effectiveTo ?? "Until further notice",
        status: a.status,
      }));
      exportGenericReport(rows, shiftExportColumns, options, "Shift_Roster");
      setToastMessage(`Exported ${rows.length} shift assignment(s).`);
      setIsExportModalOpen(false);
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  const renderShiftFilters = () => (
    <ToolbarFilterGroup>
      <ToolbarFilterSelect value={selectedDepartment} onChange={setSelectedDepartment} options={[...employeeDepartmentFilterOptions]} ariaLabel="Filter by department" />
      <ToolbarFilterSelect value={selectedShiftType} onChange={setSelectedShiftType} options={shiftTypeFilterOptions} ariaLabel="Filter by shift" />
      <ToolbarFilterSelect value={selectedStatus} onChange={setSelectedStatus} options={[...shiftStatusFilterOptions]} ariaLabel="Filter by status" />
    </ToolbarFilterGroup>
  );

  // Upcoming Shift Changes List (Improvement #6)
  const upcomingChanges = useMemo(() => {
    return [
      { empName: "Rajesh Kumar", empId: "EMP-0101", fromShift: "Morning", toShift: "Evening", effectiveDate: "15 Aug 2026" },
      { empName: "Priya Patel", empId: "EMP-0104", fromShift: "Evening", toShift: "Night", effectiveDate: "18 Aug 2026" },
      { empName: "Kavita Reddy", empId: "EMP-0108", fromShift: "General", toShift: "Morning", effectiveDate: "01 Sep 2026" },
    ];
  }, []);

  // Conflict Detection Check (Improvement #3)
  const checkConflict = (empId: string, currentId?: string) => {
    const existing = assignments.find((a) => a.employeeId === empId && a.status === "Active" && a.id !== currentId);
    if (existing) {
      setConflictWarning(
        `⚠️ Conflict Warning: ${existing.employeeName} (${existing.employeeId}) is currently assigned to ${existing.shiftName} (${existing.shiftCode}). Saving will update the active roster assignment.`
      );
    } else {
      setConflictWarning(null);
    }
  };

  // Bulk Preview Staff List (Improvement #7)
  const bulkPreviewStaff = useMemo(() => {
    if (bulkApplyTo === "Department") {
      if (!bulkDepartment) return [];
      return assignments.filter((a) => bulkDepartment === "ALL" || a.department === bulkDepartment);
    } else if (bulkApplyTo === "Designation") {
      if (!bulkDesignation) return [];
      return assignments.filter((a) => a.designation === bulkDesignation);
    } else if (bulkApplyTo === "EmploymentType") {
      if (!bulkEmploymentType) return [];
      return assignments.filter((a) => a.employmentType === bulkEmploymentType);
    }
    return [];
  }, [assignments, bulkApplyTo, bulkDepartment, bulkDesignation, bulkEmploymentType]);

  // Single Assign Handler
  const handleOpenSingleAssign = (existing?: ShiftAssignment) => {
    if (existing) {
      setEditingAssignment(existing);
      setAssignEmpId(existing.employeeId);
      setAssignEmpQuery(`${existing.employeeName} (${existing.employeeId}) - ${existing.department}`);
      setIsEmpComboboxOpen(false);
      setAssignShiftId(existing.shiftId);
      setAssignEffectiveFrom("2026-08-01");
      setAssignEffectiveTo(existing.effectiveTo || "");
      setAssignRemarks(existing.remarks || "");
      checkConflict(existing.employeeId, existing.id);
    } else {
      const todayIso = new Date().toISOString().split("T")[0];
      setEditingAssignment(null);
      setAssignEmpId("");
      setAssignEmpQuery("");
      setIsEmpComboboxOpen(false);
      setAssignShiftId("");
      setAssignEffectiveFrom(todayIso);
      setAssignEffectiveTo("");
      setAssignRemarks("");
      setConflictWarning(null);
    }
    setIsAssignModalOpen(true);
  };

  const handleSaveSingleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignShiftId || !assignEmpId || isSubmittingSingle) return;
    const shiftObj = masterShifts.find((s) => s.id === assignShiftId);
    if (!shiftObj) return;

    setIsSubmittingSingle(true);
    try {
      const targetEmp = employees.find((x) => x.id === assignEmpId);
      const empName = targetEmp?.name || "Employee";

      const apiPayload = {
        employeeId: assignEmpId,
        shiftTypeId: shiftObj.id,
        shiftCode: shiftObj.code,
        shiftName: shiftObj.name,
        shiftCategory: shiftObj.category,
        startTime: shiftObj.startTime,
        endTime: shiftObj.endTime,
        effectiveFrom: assignEffectiveFrom || new Date().toISOString().split("T")[0],
        effectiveTo: assignEffectiveTo || null,
        status: "Active",
        assignedBy: "HR Admin",
        remarks: assignRemarks || undefined,
      };

      if (editingAssignment) {
        await hrShiftAssignmentService.update(editingAssignment.id, apiPayload);
        setToastMessage(`Updated shift assignment for ${empName} to ${shiftObj.name}.`);
      } else {
        await hrShiftAssignmentService.create(apiPayload);
        setToastMessage(`Assigned ${shiftObj.name} to ${empName}.`);
      }

      await loadShiftData();
      setIsAssignModalOpen(false);
      setEditingAssignment(null);
    } catch (err: any) {
      setToastMessage(err?.message || "Failed to save shift assignment.");
    } finally {
      setIsSubmittingSingle(false);
    }
  };

  // Quick Shift Change Handler
  const handleOpenQuickChange = (a: ShiftAssignment) => {
    setQuickChangeTarget(a);
    const defaultSwap = masterShifts.find((s) => s.id !== a.shiftId);
    setQuickNewShiftId(defaultSwap?.id || a.shiftId);
    setIsQuickChangeModalOpen(true);
  };

  const handleSaveQuickChange = async () => {
    if (!quickChangeTarget || !quickNewShiftId || isSubmittingQuick) return;
    const shiftObj = masterShifts.find((s) => s.id === quickNewShiftId);
    if (!shiftObj) return;

    setIsSubmittingQuick(true);
    try {
      await hrShiftAssignmentService.update(quickChangeTarget.id, {
        shiftTypeId: shiftObj.id,
        shiftCode: shiftObj.code,
        shiftName: shiftObj.name,
        effectiveFrom: new Date().toISOString().split("T")[0],
        status: "Active",
      });
      setToastMessage(`Quick swapped ${quickChangeTarget.employeeName} to ${shiftObj.name}.`);
      await loadShiftData();
      setIsQuickChangeModalOpen(false);
      setQuickChangeTarget(null);
    } catch (err: any) {
      setToastMessage(err?.message || "Failed to swap shift.");
    } finally {
      setIsSubmittingQuick(false);
    }
  };

  // End Assignment Action
  const handleEndAssignment = async (id: string, empName: string) => {
    try {
      await hrShiftAssignmentService.update(id, {
        status: "Inactive",
        effectiveTo: new Date().toISOString().split("T")[0],
      });
      setToastMessage(`Ended shift assignment for ${empName}.`);
      await loadShiftData();
    } catch (err: any) {
      setToastMessage(err?.message || "Failed to end shift assignment.");
    }
  };

  // Save Bulk Assignment
  const handleSaveBulkAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkShiftId || isSubmittingBulk) return;
    const shiftObj = masterShifts.find((s) => s.id === bulkShiftId);
    if (!shiftObj) return;

    setIsSubmittingBulk(true);
    try {
      const targets = assignments.filter((a) => {
        if (bulkApplyTo === "Department") return bulkDepartment === "ALL" || a.department === bulkDepartment;
        if (bulkApplyTo === "Designation") return a.designation === bulkDesignation;
        if (bulkApplyTo === "EmploymentType") return a.employmentType === bulkEmploymentType;
        return true;
      });

      for (const target of targets) {
        await hrShiftAssignmentService.create({
          employeeId: target.employeeId,
          shiftTypeId: shiftObj.id,
          shiftCode: shiftObj.code,
          shiftName: shiftObj.name,
          effectiveFrom: bulkEffectiveFrom || new Date().toISOString().split("T")[0],
          effectiveTo: bulkEffectiveTo || null,
          status: "Active",
          assignedBy: "HR Admin (Bulk)",
        });
      }

      setToastMessage(`Bulk assigned ${shiftObj.name} to ${targets.length} staff member(s).`);
      await loadShiftData();
      setIsBulkModalOpen(false);
    } catch (err: any) {
      setToastMessage(err?.message || "Failed to bulk assign shifts.");
    } finally {
      setIsSubmittingBulk(false);
    }
  };

  return (
    <ModulePageShell
      eyebrow="Human Resource / Attendance & Leave"
      title="Shift Management"
      description="Schedule and assign predefined shift templates to individual employees or departmental teams across property operations."
      breadcrumbs={[
        { label: "Human Resource", href: "/human-resources/dashboard" },
        { label: "Attendance & Leave" },
        { label: "Shift Management" },
      ]}
      toast={toastMessage}
      onDismissToast={() => setToastMessage(null)}
      secondaryActions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => handleOpenSingleAssign()}
            className="rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs cursor-pointer"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Assign Shift
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsBulkModalOpen(true)}
            className="rounded-xl text-xs font-bold bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50 shadow-xs cursor-pointer"
          >
            <Users className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
            Bulk Assign
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsUpcomingChangesDrawerOpen(true)}
            className="rounded-xl text-xs font-bold bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50 shadow-xs cursor-pointer"
          >
            <CalendarDays className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
            Upcoming Changes
            <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-800">
              {upcomingChanges.length}
            </span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsExportModalOpen(true)}
            className="rounded-xl text-xs font-medium bg-white text-slate-700 border-slate-300 shadow-xs"
          >
            <Printer className="h-3.5 w-3.5 mr-1 text-slate-500" />
            Export Roster
          </Button>
        </div>
      }
    >
      <ListSummaryCards stats={summaryStats} columns={5} className="mb-5" />

      <HrSearchFilterToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search employee or shift code..."
        showFilterPanel={showFilterPanel}
        onToggleFilterPanel={() => setShowFilterPanel((v) => !v)}
        hasActiveFilters={hasActiveFilters}
        onReset={resetFilters}
        filters={renderShiftFilters()}
        extraFilters={renderShiftFilters()}
        trailing={
          <div className="flex items-center rounded-full border border-slate-200 bg-slate-50 p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition cursor-pointer",
                viewMode === "table"
                  ? "border border-slate-200 bg-white text-emerald-800 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800",
              )}
            >
              <Layers className="h-3.5 w-3.5" />
              Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode("roster")}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition cursor-pointer",
                viewMode === "roster"
                  ? "border border-slate-200 bg-white text-emerald-800 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800",
              )}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Roster
            </button>
          </div>
        }
      />

      {/* ─────────────────────────────────────────────────────────────
          SECTION 3A: TABLE VIEW (With End Assignment, History, Quick Change, Assigned By/On)
      ───────────────────────────────────────────────────────────── */}
      {viewMode === "table" ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Assigned Shift</th>
                  <th className="py-3 px-4">Effective From</th>
                  <th className="py-3 px-4">Effective To</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Assigned By / On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAssignments.map((a) => (
                  <tr
                    key={a.id}
                    className="hover:bg-slate-50/80 transition cursor-pointer"
                    onClick={() => setViewingAssignment(a)}
                  >
                    {/* Employee Name & Photo */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        {a.photoUrl ? (
                          <img
                            src={a.photoUrl}
                            alt={a.employeeName}
                            className="h-8 w-8 rounded-xl object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-700 text-white font-bold text-xs shrink-0">
                            {a.avatar}
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-slate-900">{a.employeeName}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{a.employeeId}</p>
                        </div>
                      </div>
                    </td>

                    {/* Department */}
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-800">{a.department}</p>
                      <p className="text-[10px] text-slate-500">{a.designation}</p>
                    </td>

                    {/* Shift */}
                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-900 border border-slate-200">
                          <span>{a.shiftName}</span>
                          <span className="text-[10px] font-mono text-emerald-700 font-extrabold">({a.shiftCode})</span>
                        </span>
                        <p className="text-[11px] text-slate-500 font-semibold">⏰ {a.startTime} - {a.endTime}</p>
                      </div>
                    </td>

                    {/* Effective From / To */}
                    <td className="py-3 px-4 font-medium text-slate-700">{a.effectiveFrom}</td>
                    <td className="py-3 px-4 font-medium text-slate-700">
                      {a.effectiveTo ? (
                        a.effectiveTo
                      ) : (
                        <span className="text-slate-600 font-semibold text-[11px]">
                          Until Further Notice
                        </span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-4">
                      {a.status === "Active" && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Active
                        </span>
                      )}
                      {a.status === "Upcoming" && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                          Upcoming
                        </span>
                      )}
                      {(a.status === "Expired" || a.status === "Inactive") && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-300">
                          Inactive
                        </span>
                      )}
                    </td>

                    {/* Assigned By & Assigned On Columns */}
                    <td className="py-3 px-4 text-xs">
                      <p className="font-semibold text-slate-800">{a.assignedBy}</p>
                      <p className="text-[10px] text-slate-400">{a.assignedOn}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ─────────────────────────────────────────────────────────────
            SECTION 3B: WEEKLY ROSTER MATRIX VIEW ⭐ (Improvement #8)
        ───────────────────────────────────────────────────────────── */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Weekly Roster Matrix — August 2026</h3>
              <p className="text-xs text-slate-500">Day-by-day shift distribution for department schedules.</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 font-bold">MS (Morning)</span>
              <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 border border-blue-300 font-bold">ES (Evening)</span>
              <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 border border-purple-300 font-bold">NS (Night)</span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold">WO (Off)</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Employee</th>
                  <th className="py-2.5 px-3 text-center">Mon (03)</th>
                  <th className="py-2.5 px-3 text-center">Tue (04)</th>
                  <th className="py-2.5 px-3 text-center">Wed (05)</th>
                  <th className="py-2.5 px-3 text-center">Thu (06)</th>
                  <th className="py-2.5 px-3 text-center">Fri (07)</th>
                  <th className="py-2.5 px-3 text-center">Sat (08)</th>
                  <th className="py-2.5 px-3 text-center">Sun (09)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAssignments.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      {emp.employeeName}
                      <span className="block text-[10px] text-slate-400 font-mono">{emp.department}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-1 rounded-lg bg-amber-100 text-amber-900 font-black border border-amber-300 text-[11px]">MS</span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-1 rounded-lg bg-amber-100 text-amber-900 font-black border border-amber-300 text-[11px]">MS</span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-1 rounded-lg bg-amber-100 text-amber-900 font-black border border-amber-300 text-[11px]">MS</span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-1 rounded-lg bg-blue-100 text-blue-900 font-black border border-blue-300 text-[11px]">ES</span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-1 rounded-lg bg-blue-100 text-blue-900 font-black border border-blue-300 text-[11px]">ES</span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-1 rounded-lg bg-purple-100 text-purple-900 font-black border border-purple-300 text-[11px]">NS</span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-900 font-black border border-emerald-300 text-[11px]">WO</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 1: SINGLE SHIFT ASSIGNMENT MODAL (With Conflict Alert & Optional To Date)
      ───────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title={editingAssignment ? `Edit Shift Assignment` : "Assign Shift to Employee"}
        description="Assign a master shift type to an individual employee."
        size="md"
      >
        <form onSubmit={handleSaveSingleAssign} className="space-y-4">
          {/* Conflict Warning Box (Improvement #3) */}
          {conflictWarning && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
              <span>{conflictWarning}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Select Employee <span className="text-rose-500">*</span>
            </label>

            {/* Single Unified Searchable Employee Combobox */}
            <div className="relative" ref={assignComboboxRef}>
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={assignEmpQuery}
                onFocus={() => setIsEmpComboboxOpen(true)}
                onChange={(e) => {
                  setAssignEmpQuery(e.target.value);
                  setIsEmpComboboxOpen(true);
                }}
                placeholder="Type employee name, ID or department to search..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-8 text-xs font-semibold text-slate-900 shadow-2xs focus:border-emerald-500 focus:outline-none"
              />
              {assignEmpQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setAssignEmpQuery("");
                    setAssignEmpId("");
                    setIsEmpComboboxOpen(true);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : (
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              )}

              {/* Combobox Dropdown Results List */}
              {isEmpComboboxOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl space-y-1 max-h-56 overflow-y-auto animate-in fade-in-50">
                  {employees.filter((staff) => {
                    if (!assignEmpQuery.trim()) return true;
                    const q = assignEmpQuery.toLowerCase().trim();
                    return (
                      staff.name.toLowerCase().includes(q) ||
                      staff.id.toLowerCase().includes(q) ||
                      staff.department.toLowerCase().includes(q) ||
                      staff.designation.toLowerCase().includes(q)
                    );
                  }).length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-400 font-medium">
                      No matching employee found.
                    </div>
                  ) : (
                    employees.filter((staff) => {
                      if (!assignEmpQuery.trim()) return true;
                      const q = assignEmpQuery.toLowerCase().trim();
                      return (
                        staff.name.toLowerCase().includes(q) ||
                        staff.id.toLowerCase().includes(q) ||
                        staff.department.toLowerCase().includes(q) ||
                        staff.designation.toLowerCase().includes(q)
                      );
                    }).map((staff) => (
                      <div
                        key={staff.id}
                        onClick={() => {
                          setAssignEmpId(staff.id);
                          setAssignEmpQuery(`${staff.name} (${staff.id}) - ${staff.department}`);
                          setIsEmpComboboxOpen(false);
                          checkConflict(staff.id, editingAssignment?.id);
                        }}
                        className={cn(
                          "flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors hover:bg-slate-100/80 border border-transparent",
                          assignEmpId === staff.id && "bg-emerald-50 text-emerald-900 border-emerald-200"
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 font-bold text-[10px] shrink-0">
                            {staff.avatar}
                          </div>
                          <div className="truncate">
                            <p className="font-bold text-xs text-slate-900 truncate">
                              {staff.name} <span className="text-[10px] font-semibold text-emerald-700">({staff.id})</span>
                            </p>
                            <p className="text-[10px] text-slate-500 truncate">{staff.designation} • {staff.department}</p>
                          </div>
                        </div>
                        {assignEmpId === staff.id && <Check className="h-4 w-4 text-emerald-600 shrink-0 ml-2" />}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Shift Type (From Masters → Shift Types) <span className="text-rose-500">*</span>
            </label>
            <select
              value={assignShiftId}
              onChange={(e) => setAssignShiftId(e.target.value)}
              required
              className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-white font-semibold text-slate-800"
            >
              <option value="">-- Select Shift Type --</option>
              {masterShifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code}) • {s.startTime} - {s.endTime}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Effective From <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={assignEffectiveFrom}
                onChange={(e) => setAssignEffectiveFrom(e.target.value)}
                required
                className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-white font-medium"
              />
            </div>

            {/* Optional Effective To Date (Improvement #9) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Effective To <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="date"
                value={assignEffectiveTo}
                onChange={(e) => setAssignEffectiveTo(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-white font-medium"
              />
              <span className="text-[10px] text-slate-400 block mt-1">Leave blank for "Until Further Notice"</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Remarks / Assignment Notes</label>
            <textarea
              rows={2}
              placeholder="e.g. Front Desk manager shift roster assignment..."
              value={assignRemarks}
              onChange={(e) => setAssignRemarks(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAssignModalOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white"
            >
              Save Shift Assignment
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────
          MODAL 2: FLEXIBLE BULK SHIFT ASSIGNMENT MODAL (Improvement #7)
      ───────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        title="Bulk Assign Shift"
        description="Assign a shift to multiple employees filtered by Department, Designation, or Employment Type."
        size="lg"
      >
        <form onSubmit={handleSaveBulkAssign} className="space-y-4">
          {/* Target Group Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Apply To Target Group:</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setBulkApplyTo("Department")}
                className={cn(
                  "p-2 rounded-xl border text-xs font-bold transition",
                  bulkApplyTo === "Department" ? "bg-emerald-50 border-emerald-500 text-emerald-900" : "bg-white border-slate-200 text-slate-600"
                )}
              >
                Department
              </button>

              <button
                type="button"
                onClick={() => setBulkApplyTo("Designation")}
                className={cn(
                  "p-2 rounded-xl border text-xs font-bold transition",
                  bulkApplyTo === "Designation" ? "bg-emerald-50 border-emerald-500 text-emerald-900" : "bg-white border-slate-200 text-slate-600"
                )}
              >
                Designation
              </button>

              <button
                type="button"
                onClick={() => setBulkApplyTo("EmploymentType")}
                className={cn(
                  "p-2 rounded-xl border text-xs font-bold transition",
                  bulkApplyTo === "EmploymentType" ? "bg-emerald-50 border-emerald-500 text-emerald-900" : "bg-white border-slate-200 text-slate-600"
                )}
              >
                Employment Type
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {bulkApplyTo === "Department" && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Department</label>
                <select
                  value={bulkDepartment}
                  onChange={(e) => setBulkDepartment(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-white font-semibold text-slate-800"
                >
                  <option value="">-- Select Department --</option>
                  <option value="ALL">All Departments</option>
                  <option value="Front Office">Front Office</option>
                  <option value="Housekeeping">Housekeeping</option>
                  <option value="Kitchen / Culinary">Kitchen / Culinary</option>
                  <option value="F&B Service">F&amp;B Service</option>
                  <option value="Maintenance & Eng.">Maintenance &amp; Eng.</option>
                  <option value="HR & Admin">HR &amp; Admin</option>
                </select>
              </div>
            )}

            {bulkApplyTo === "Designation" && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Designation</label>
                <select
                  value={bulkDesignation}
                  onChange={(e) => setBulkDesignation(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-white font-semibold text-slate-800"
                >
                  <option value="">-- Select Designation --</option>
                  <option value="Front Desk Manager">Front Desk Manager</option>
                  <option value="Guest Relations Executive">Guest Relations Executive</option>
                  <option value="Executive Housekeeper">Executive Housekeeper</option>
                  <option value="Room Attendant">Room Attendant</option>
                  <option value="Executive Head Chef">Executive Head Chef</option>
                  <option value="Restaurant Captain">Restaurant Captain</option>
                </select>
              </div>
            )}

            {bulkApplyTo === "EmploymentType" && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Employment Type</label>
                <select
                  value={bulkEmploymentType}
                  onChange={(e) => setBulkEmploymentType(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-white font-semibold text-slate-800"
                >
                  <option value="">-- Select Employment Type --</option>
                  <option value="Permanent">Permanent</option>
                  <option value="Contractual">Contractual</option>
                  <option value="Probation">Probation</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Target Shift</label>
              <select
                value={bulkShiftId}
                onChange={(e) => setBulkShiftId(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-white font-semibold text-slate-800"
              >
                <option value="">-- Select Shift Type --</option>
                {masterShifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Interactive Preview */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <span className="text-xs font-bold text-slate-800 uppercase block">
              Affected Employees ({bulkPreviewStaff.length} Staff Selected):
            </span>
            <div className="max-h-36 overflow-y-auto space-y-1.5">
              {bulkPreviewStaff.map((emp) => (
                <div
                  key={emp.employeeId}
                  className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 text-xs"
                >
                  <span className="font-bold text-slate-900">
                    {emp.employeeName} ({emp.employeeId})
                  </span>
                  <span className="text-slate-500 text-[11px] font-semibold">{emp.department}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsBulkModalOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white"
            >
              Confirm Bulk Assignment
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────
          MODAL 3: QUICK SHIFT CHANGE MODAL (Improvement #5)
      ───────────────────────────────────────────────────────────── */}
      {quickChangeTarget && (
        <Modal
          isOpen={isQuickChangeModalOpen}
          onClose={() => setIsQuickChangeModalOpen(false)}
          title={`Quick Shift Swap for ${quickChangeTarget.employeeName}`}
          description={`Currently assigned: ${quickChangeTarget.shiftName} (${quickChangeTarget.shiftCode})`}
          size="sm"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Select New Shift</label>
              <select
                value={quickNewShiftId}
                onChange={(e) => setQuickNewShiftId(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-white font-bold text-slate-900"
              >
                {masterShifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code}) • {s.startTime} - {s.endTime}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsQuickChangeModalOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveQuickChange}
                className="rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white"
              >
                Confirm Shift Swap
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 4: SHIFT ASSIGNMENT HISTORY MODAL (Improvement #2)
      ───────────────────────────────────────────────────────────── */}
      {historyTarget && (
        <Modal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
          title={`Shift History — ${historyTarget.employeeName}`}
          description={`Complete audit history log of all shift assignment changes for ${historyTarget.employeeId}.`}
          size="md"
        >
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Old Shift</th>
                    <th className="py-2.5 px-3">New Shift</th>
                    <th className="py-2.5 px-3">Changed By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historyTarget.history && historyTarget.history.length > 0 ? (
                    historyTarget.history.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{h.date}</td>
                        <td className="py-2.5 px-3 text-slate-500">{h.oldShift}</td>
                        <td className="py-2.5 px-3 font-bold text-emerald-800">{h.newShift}</td>
                        <td className="py-2.5 px-3 text-slate-600 font-medium">{h.changedBy}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-slate-400 italic">
                        No previous shift history recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <Button
                type="button"
                size="sm"
                onClick={() => setIsHistoryModalOpen(false)}
                className="rounded-xl text-xs font-bold bg-slate-800 text-white"
              >
                Close History
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SIDE DRAWER: VIEW ASSIGNMENT DETAILS
      ───────────────────────────────────────────────────────────── */}
      <Drawer
        isOpen={Boolean(viewingAssignment)}
        onClose={() => setViewingAssignment(null)}
        title="Shift Schedule Details"
        icon={<Clock className="h-5 w-5 text-emerald-700" />}
        footer={
          viewingAssignment ? (
            <div className="w-full space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    const target = viewingAssignment;
                    setViewingAssignment(null);
                    handleOpenSingleAssign(target);
                  }}
                  className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold h-9 cursor-pointer"
                >
                  <Edit2 className="mr-1 h-3.5 w-3.5" /> Edit Shift
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    const target = viewingAssignment;
                    setViewingAssignment(null);
                    handleOpenQuickChange(target);
                  }}
                  className="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold h-9 cursor-pointer"
                >
                  <Zap className="mr-1 h-3.5 w-3.5 text-amber-600 fill-amber-500" /> Quick Swap
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setHistoryTarget(viewingAssignment);
                    setIsHistoryModalOpen(true);
                  }}
                  className="flex-1 text-slate-700 bg-white border-slate-300 rounded-xl text-xs font-bold h-9 cursor-pointer"
                >
                  <History className="mr-1 h-3.5 w-3.5" /> View History
                </Button>

                {viewingAssignment.status === "Active" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const targetId = viewingAssignment.id;
                      const targetName = viewingAssignment.employeeName;
                      setViewingAssignment(null);
                      handleEndAssignment(targetId, targetName);
                    }}
                    className="flex-1 text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-200 rounded-xl text-xs font-bold h-9 cursor-pointer"
                  >
                    End Assignment
                  </Button>
                )}
              </div>
            </div>
          ) : undefined
        }
      >
        {viewingAssignment && (
          <>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-slate-900">{viewingAssignment.employeeName}</h4>
                <span className="font-mono text-xs font-bold text-slate-600">{viewingAssignment.employeeId}</span>
              </div>
              <p className="text-xs text-slate-500">
                {viewingAssignment.designation} •{" "}
                <span className="text-emerald-700 font-semibold">{viewingAssignment.department}</span>
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Assigned Shift</span>
                <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {viewingAssignment.shiftCode}
                </span>
              </div>
              <h3 className="font-bold text-base text-slate-900">{viewingAssignment.shiftName}</h3>

              <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[11px]">Check-In Time</span>
                  <span className="font-bold text-slate-900">{viewingAssignment.startTime} AM</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Check-Out Time</span>
                  <span className="font-bold text-slate-900">{viewingAssignment.endTime} PM</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Effective Date Range</span>
                <span className="font-bold text-slate-800">
                  {viewingAssignment.effectiveFrom} → {viewingAssignment.effectiveTo || "Until Further Notice"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Assigned By / On</span>
                <span className="font-semibold text-slate-800">
                  {viewingAssignment.assignedBy} ({viewingAssignment.assignedOn})
                </span>
              </div>
            </div>
          </>
        )}
      </Drawer>
      <ReportExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={handleShiftExport}
        defaultDate={new Date().toLocaleDateString("en-CA")}
        title="Export shift roster"
        description="Choose file type and time period. Current filters apply to the export."
        exporting={exporting}
      />

      {/* ─────────────────────────────────────────────────────────────
          SIDE DRAWER: UPCOMING SHIFT CHANGES
      ───────────────────────────────────────────────────────────── */}
      <Drawer
        isOpen={isUpcomingChangesDrawerOpen}
        onClose={() => setIsUpcomingChangesDrawerOpen(false)}
        title="Upcoming Shift Changes"
        subtitle={`${upcomingChanges.length} scheduled change(s)`}
        icon={<CalendarDays className="h-5 w-5 text-emerald-700" />}
        maxWidth="md"
        footer={
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setIsUpcomingChangesDrawerOpen(false);
              handleOpenSingleAssign();
            }}
            className="w-full rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white h-9 cursor-pointer"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Schedule New Shift Change
          </Button>
        }
      >
        {upcomingChanges.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
            <CalendarDays className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            <p className="text-xs font-bold text-slate-600">No upcoming shift changes</p>
            <p className="mt-1 text-[11px] text-slate-400">Scheduled roster changes will appear here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingChanges.map((uc, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <span className="block font-bold text-slate-900">{uc.empName}</span>
                  <span className="font-mono text-[10px] text-slate-400">{uc.empId}</span>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                    <span className="rounded-md bg-white px-1.5 py-0.5 border border-slate-200 text-slate-700">
                      {uc.fromShift}
                    </span>
                    <ArrowRight className="h-3 w-3 shrink-0 text-emerald-600" />
                    <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 border border-emerald-200 font-bold text-emerald-800">
                      {uc.toShift}
                    </span>
                  </div>
                </div>
                <span className="ml-3 shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-mono font-bold text-slate-700 shadow-2xs">
                  {uc.effectiveDate}
                </span>
              </div>
            ))}
          </div>
        )}
      </Drawer>
    </ModulePageShell>
  );
}
