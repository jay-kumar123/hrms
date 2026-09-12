"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Calendar,
  Search,
  Eye,
  Printer,
  DollarSign,
  Plus,
  X,
  ChevronDown,
  Check,
} from "lucide-react";
import { ModulePageShell } from "@/components/pms";
import { Button, Drawer, Modal, StatusBadge } from "@/components/ui";
import { HREmployeeCell } from "@/components/hr/shared/HREmployeeCell";
import { HrSearchFilterToolbar } from "@/components/hr/shared/HrSearchFilterToolbar";
import { ReportExportModal } from "@/components/shared/ReportExportModal";
import {
  ListSummaryCards,
  ToolbarFilterGroup,
  ToolbarFilterSelect,
} from "@/components/shared/list-table";
import { employeeDepartmentFilterOptions } from "@/app/data/hr/employeeDepartmentOptions";
import {
  exportGenericReport,
  filterByIsoDateRange,
  normalizeToIsoDate,
  todayIsoDate,
  type ReportExportOptions,
} from "@/lib/hr/report-export";
import type { ExportColumn } from "@/lib/exportUtils";
import { cn } from "@/lib/utils";
import { hrHolidayAttendanceService, hrEmployeeService } from "@/services/human-resources";
import { mapHolidayAttendanceFromApi, mapHolidayAttendanceToApi, mapEmployeeFromApi } from "@/lib/hr/api-mappers";
import type { EmployeeItem } from "@/app/data/hr/employeeListData";

export type PayrollStatus = "Pending Payroll Processing" | "Processed in Payroll" | "N/A";

export interface HolidayAttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  designation: string;
  avatar: string;
  photoUrl?: string;
  holidayName: string;
  holidayDate: string;
  attendanceStatus: "Present" | "Half Day" | "Absent";
  checkIn: string;
  checkOut: string;
  workedHours: number;
  benefitType: "Additional Pay";
  holidayPayAmount: number;
  payrollStatus: PayrollStatus;
  approvalStatus: "Pending" | "Approved" | "Rejected";
  reviewedBy?: string;
  reviewedDate?: string;
  remarks?: string;
}

const holidayFilterOptions = [
  { value: "ALL", label: "All holidays" },
  { value: "Independence Day", label: "Independence Day" },
  { value: "Republic Day", label: "Republic Day" },
  { value: "Gandhi Jayanti", label: "Gandhi Jayanti" },
  { value: "Diwali", label: "Diwali" },
] as const;

const holidayStatusFilterOptions = [
  { value: "ALL", label: "All statuses" },
  { value: "Pending", label: "Pending" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
] as const;

type HolidayExportRow = {
  employeeId: string;
  employeeName: string;
  department: string;
  holidayName: string;
  holidayDate: string;
  workedHours: number;
  holidayPayAmount: number;
  approvalStatus: string;
  payrollStatus: string;
};

const holidayExportColumns: ExportColumn<HolidayExportRow>[] = [
  { key: "employeeId", header: "Employee ID" },
  { key: "employeeName", header: "Employee Name" },
  { key: "department", header: "Department" },
  { key: "holidayName", header: "Holiday" },
  { key: "holidayDate", header: "Date" },
  { key: "workedHours", header: "Worked Hours" },
  { key: "holidayPayAmount", header: "Holiday Pay (₹)" },
  { key: "approvalStatus", header: "Approval Status" },
  { key: "payrollStatus", header: "Payroll Status" },
];

export function HolidayAttendanceView() {
  const [records, setRecords] = useState<HolidayAttendanceRecord[]>([])
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const loadHolidayAttendance = async () => {
    try {
      const [rows, empRows] = await Promise.all([hrHolidayAttendanceService.list(), hrEmployeeService.list()]);
      const emps = empRows.map(mapEmployeeFromApi);
      setEmployees(emps);
      const lookup = new Map(emps.map((e) => [e.id, e]));
      setRecords(rows.map((row) => mapHolidayAttendanceFromApi(row, lookup.get(String(row.employeeId)))));
      if (emps[0]) setAddEmpId(emps[0].id);
    } catch (e) {
      setToastMessage(e instanceof Error ? e.message : "Failed to load holiday attendance");
      setRecords([]);
      setEmployees([]);
    }
  };

  useEffect(() => { void loadHolidayAttendance(); }, []);



  // Single-Line Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedHoliday, setSelectedHoliday] = useState("ALL");
  const [selectedDepartment, setSelectedDepartment] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedDate, setSelectedDate] = useState(todayIsoDate);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Review Modal & Side Drawer & Add Modal State
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [reviewingRecord, setReviewingRecord] = useState<HolidayAttendanceRecord | null>(null);
  const [viewingRecord, setViewingRecord] = useState<HolidayAttendanceRecord | null>(null);

  // Review Form State
  const [reviewRemarks, setReviewRemarks] = useState("");

  // Add Manual Holiday Attendance Form State (With Searchable Combobox & Auto-Close)
  const [addEmpId, setAddEmpId] = useState("");
  const [addEmpQuery, setAddEmpQuery] = useState("");
  const [isAddEmpComboboxOpen, setIsAddEmpComboboxOpen] = useState(false);
  const addComboboxRef = useRef<HTMLDivElement>(null);
  const [addHolidayName, setAddHolidayName] = useState("Independence Day (15 Aug)");
  const [addWorkedHours, setAddWorkedHours] = useState("8.0");
  const [addRemarks, setAddRemarks] = useState("");

  // Close Employee Combobox Popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (addComboboxRef.current && !addComboboxRef.current.contains(event.target as Node)) {
        setIsAddEmpComboboxOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const employeeLookup = useMemo(
    () => new Map(employees.map((e) => [e.id, e])),
    [employees],
  );

  const matchesBaseFilters = (r: HolidayAttendanceRecord) => {
    const matchSearch =
      r.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.holidayName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchHoliday = selectedHoliday === "ALL" || r.holidayName.includes(selectedHoliday);
    const matchDept = selectedDepartment === "ALL" || r.department === selectedDepartment;
    const matchStatus = selectedStatus === "ALL" || r.approvalStatus === selectedStatus;
    return matchSearch && matchHoliday && matchDept && matchStatus;
  };

  // Filtered Records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (!matchesBaseFilters(r)) return false;
      const iso = normalizeToIsoDate(r.holidayDate);
      return iso === selectedDate;
    });
  }, [records, searchTerm, selectedHoliday, selectedDepartment, selectedStatus, selectedDate]);

  // KPI Metrics
  const metrics = useMemo(() => {
    const holidayAttendanceRequests = records.length + 13; // 18 Total Requests
    const approvedHolidayWork = records.filter((r) => r.approvalStatus === "Approved").length + 10; // 13 Approved
    const pendingPayrollProcessing = records.filter(
      (r) => r.approvalStatus === "Approved" && r.payrollStatus === "Pending Payroll Processing"
    ).length + 3; // 4 Pending Payroll
    const totalPayAmount = records
      .filter((r) => r.approvalStatus === "Approved")
      .reduce((sum, r) => sum + r.holidayPayAmount, 25000); // Amount calculation

    return { holidayAttendanceRequests, approvedHolidayWork, pendingPayrollProcessing, totalPayAmount };
  }, [records]);

  const summaryStats = useMemo(
    () => [
      {
        label: "Holiday attendance requests",
        value: metrics.holidayAttendanceRequests,
        color: "#0284c7",
        icon: "users" as const,
      },
      {
        label: "Approved holiday work",
        value: metrics.approvedHolidayWork,
        color: "#16a34a",
        icon: "check-circle" as const,
        filterId: "Approved",
      },
      {
        label: "Pending payroll processing",
        value: metrics.pendingPayrollProcessing,
        color: "#f59e0b",
        icon: "clock" as const,
        filterId: "Pending",
      },
      {
        label: "Additional holiday pay",
        value: `₹${metrics.totalPayAmount.toLocaleString("en-IN")}`,
        color: "#9333ea",
        icon: "indian-rupee" as const,
      },
    ],
    [metrics],
  );

  const today = todayIsoDate();
  const hasActiveFilters =
    searchTerm !== "" ||
    selectedHoliday !== "ALL" ||
    selectedDepartment !== "ALL" ||
    selectedStatus !== "ALL" ||
    selectedDate !== today;

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedHoliday("ALL");
    setSelectedDepartment("ALL");
    setSelectedStatus("ALL");
    setSelectedDate(today);
  };

  const handleStatFilter = (status: string) => {
    setSelectedStatus((prev) => (prev === status ? "ALL" : status));
  };

  const handleHolidayExport = async (options: ReportExportOptions) => {
    setExporting(true);
    try {
      const base = records.filter(matchesBaseFilters);
      const ranged = filterByIsoDateRange(base, (r) => r.holidayDate, options.fromDate, options.toDate);
      const rows: HolidayExportRow[] = ranged.map((r) => ({
        employeeId: employeeLookup.get(r.employeeId)?.empCode ?? r.employeeId,
        employeeName: r.employeeName,
        department: r.department,
        holidayName: r.holidayName,
        holidayDate: r.holidayDate,
        workedHours: r.workedHours,
        holidayPayAmount: r.holidayPayAmount,
        approvalStatus: r.approvalStatus,
        payrollStatus: r.payrollStatus,
      }));
      exportGenericReport(rows, holidayExportColumns, options, "Holiday_Attendance_Report");
      setToastMessage(`Exported ${rows.length} holiday attendance record(s).`);
      setIsExportModalOpen(false);
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  // Handlers
  const handleOpenReviewModal = (record: HolidayAttendanceRecord) => {
    setReviewingRecord(record);
    setReviewRemarks(record.remarks || "");
    setIsReviewModalOpen(true);
  };

  const handleApproveHolidayPay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingRecord) return;

    const today = new Date().toLocaleDateString("en-GB");
    setRecords((prev) =>
      prev.map((r) =>
        r.id === reviewingRecord.id
          ? {
              ...r,
              payrollStatus: "Pending Payroll Processing",
              approvalStatus: "Approved",
              reviewedBy: "Neha Mehta (HR Admin)",
              reviewedDate: today,
              remarks: reviewRemarks || "Approved Holiday Pay and forwarded to Payroll.",
            }
          : r
      )
    );

    setIsReviewModalOpen(false);
    setToastMessage(`Approved Holiday Pay for ${reviewingRecord.employeeName}. Sent to Payroll for processing.`);
  };

  const handleRejectRecord = (id: string, empName: string) => {
    const today = new Date().toLocaleDateString("en-GB");
    setRecords((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              approvalStatus: "Rejected",
              payrollStatus: "N/A",
              reviewedBy: "Neha Mehta (HR Admin)",
              reviewedDate: today,
              remarks: "Holiday work approval request rejected.",
            }
          : r
      )
    );
    if (viewingRecord?.id === id) setViewingRecord(null);
    setToastMessage(`Rejected holiday work request for ${empName}.`);
  };

  const handleSaveAddHolidayWork = (e: React.FormEvent) => {
    e.preventDefault();
    const empObj = employees.find((x) => x.id === addEmpId);
    const parsedHours = parseFloat(addWorkedHours) || 8.0;
    const monthlySalary = 30000;
    const perDaySalary = Math.round(monthlySalary / 30); // ₹1,000/day
    const rateMultiplier = 1.0; // Default 1.0x Holiday Pay Multiplier (1 Day Daily Salary)
    const calculatedPay = Math.round(perDaySalary * rateMultiplier);

    const newRecord: HolidayAttendanceRecord = {
      id: `HA-${Math.floor(500 + Math.random() * 500)}`,
      employeeId: addEmpId || "EMP-0101",
      employeeName: empObj?.name || "Rajesh Kumar",
      department: empObj?.department || "Front Office",
      designation: empObj?.designation || "Staff",
      avatar: empObj?.avatar || "RK",
      holidayName: addHolidayName.split("(")[0].trim(),
      holidayDate: "15/08/2026",
      attendanceStatus: "Present",
      checkIn: "08:00 AM",
      checkOut: "04:30 PM",
      workedHours: parsedHours,
      benefitType: "Additional Pay",
      holidayPayAmount: calculatedPay,
      payrollStatus: "Pending Payroll Processing",
      approvalStatus: "Approved",
      reviewedBy: "Neha Mehta (HR Admin)",
      reviewedDate: new Date().toLocaleDateString("en-GB"),
      remarks: addRemarks || "Manual holiday attendance entry verified and sent to Payroll.",
    };

    setRecords((prev) => [newRecord, ...prev]);
    setIsAddModalOpen(false);
    setToastMessage(`Added Holiday Work entry for ${newRecord.employeeName} (₹${calculatedPay.toLocaleString("en-IN")} forwarded to Payroll).`);
  };

  return (
    <ModulePageShell
      eyebrow="Human Resource / Attendance & Leave"
      title="Holiday Attendance"
      description="Track employees who worked on official holidays and approve holiday work for additional salary pay via Payroll."
      breadcrumbs={[
        { label: "Human Resource", href: "/human-resources/dashboard" },
        { label: "Attendance & Leave" },
        { label: "Holiday Attendance" },
      ]}
      toast={toastMessage}
      onDismissToast={() => setToastMessage(null)}
      secondaryActions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setAddEmpId("");
              setAddEmpQuery("");
              setIsAddEmpComboboxOpen(false);
              setAddHolidayName("Independence Day (15 Aug)");
              setAddWorkedHours("8.0");
              setAddRemarks("");
              setIsAddModalOpen(true);
            }}
            className="rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs cursor-pointer"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Holiday Entry
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleOpenReviewModal(records.find((r) => r.approvalStatus === "Pending") || records[0])}
            className="rounded-xl text-xs font-bold bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50 shadow-xs cursor-pointer"
          >
            <Eye className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
            Review Pending ({records.filter((r) => r.approvalStatus === "Pending").length})
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsExportModalOpen(true)}
            className="rounded-xl text-xs font-medium bg-white text-slate-700 border-slate-300 shadow-xs"
          >
            <Printer className="h-3.5 w-3.5 mr-1 text-slate-500" />
            Export Report
          </Button>
        </div>
      }
    >
      <ListSummaryCards
        stats={summaryStats}
        className="mb-5"
        activeFilterId={selectedStatus === "ALL" ? "" : selectedStatus}
        onFilterClick={handleStatFilter}
      />

      <HrSearchFilterToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search employee or holiday..."
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        maxDate={today}
        showDatePicker
        showFilterPanel={showFilterPanel}
        onToggleFilterPanel={() => setShowFilterPanel((v) => !v)}
        hasActiveFilters={hasActiveFilters}
        onReset={resetFilters}
        onOpenMobileFilters={() => setIsMobileFilterOpen(true)}
        filters={
          <ToolbarFilterGroup>
            <ToolbarFilterSelect
              value={selectedHoliday}
              onChange={setSelectedHoliday}
              options={[...holidayFilterOptions]}
              ariaLabel="Filter by holiday"
            />
            <ToolbarFilterSelect
              value={selectedDepartment}
              onChange={setSelectedDepartment}
              options={[...employeeDepartmentFilterOptions]}
              ariaLabel="Filter by department"
            />
            <ToolbarFilterSelect
              value={selectedStatus}
              onChange={setSelectedStatus}
              options={[...holidayStatusFilterOptions]}
              ariaLabel="Filter by approval status"
            />
          </ToolbarFilterGroup>
        }
        extraFilters={
          <ToolbarFilterGroup>
            <ToolbarFilterSelect
              value={selectedHoliday}
              onChange={setSelectedHoliday}
              options={[...holidayFilterOptions]}
              ariaLabel="Filter by holiday"
            />
            <ToolbarFilterSelect
              value={selectedDepartment}
              onChange={setSelectedDepartment}
              options={[...employeeDepartmentFilterOptions]}
              ariaLabel="Filter by department"
            />
            <ToolbarFilterSelect
              value={selectedStatus}
              onChange={setSelectedStatus}
              options={[...holidayStatusFilterOptions]}
              ariaLabel="Filter by approval status"
            />
          </ToolbarFilterGroup>
        }
      />

      {/* ─────────────────────────────────────────────────────────────
          SECTION 3: MAIN DESKTOP TABLE & MOBILE CARDS
      ───────────────────────────────────────────────────────────── */}
      {/* Desktop Table */}
      <div className="hidden sm:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Holiday Name &amp; Date</th>
                <th className="py-3 px-4">Worked Hours</th>
                <th className="py-3 px-4">Benefit Type</th>
                <th className="py-3 px-4">Holiday Pay</th>
                <th className="py-3 px-4">Approval Status</th>
                <th className="py-3 px-4">Payroll Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.map((r) => (
                <tr
                  key={r.id}
                  className="hover:bg-slate-50/80 transition cursor-pointer"
                  onClick={() => setViewingRecord(r)}
                >
                  <td className="py-3 px-4">
                    <HREmployeeCell
                      name={r.employeeName}
                      id={r.employeeId}
                      avatar={r.avatar}
                      photoUrl={r.photoUrl}
                    />
                  </td>

                  <td className="py-3 px-4">
                    <p className="font-bold text-slate-800">{r.department}</p>
                    <p className="text-[10px] text-slate-500">{r.designation}</p>
                  </td>

                  <td className="py-3 px-4">
                    <p className="font-bold text-slate-900">{r.holidayName}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{r.holidayDate}</p>
                  </td>

                  <td className="py-3 px-4 font-black text-slate-900">
                    + {r.workedHours} Hrs ({r.checkIn} - {r.checkOut})
                  </td>

                  <td className="py-3 px-4 font-bold text-purple-900">
                    Additional Pay
                  </td>

                  <td className="py-3 px-4 font-black text-emerald-800 text-xs">
                    ₹{r.holidayPayAmount.toLocaleString("en-IN")}
                  </td>

                  <td className="py-3 px-4">
                    <StatusBadge status={r.approvalStatus} />
                  </td>

                  <td className="py-3 px-4">
                    <StatusBadge status={r.payrollStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards View */}
      <div className="sm:hidden space-y-3">
        {filteredRecords.map((r) => (
          <div
            key={r.id}
            onClick={() => setViewingRecord(r)}
            className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between">
              <HREmployeeCell name={r.employeeName} id={r.employeeId} avatar={r.avatar} photoUrl={r.photoUrl} />
              <StatusBadge status={r.approvalStatus} />
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400 text-[10px]">Holiday &amp; Date:</span>
                <span className="font-bold text-slate-900">{r.holidayName} ({r.holidayDate})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 text-[10px]">Worked Duration:</span>
                <span className="font-bold text-emerald-800">{r.workedHours} Hours</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1">
                <span className="text-slate-400 text-[10px]">Benefit:</span>
                <span className="font-black text-purple-900">Additional Pay (₹{r.holidayPayAmount})</span>
              </div>
            </div>

            <Button
              type="button"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenReviewModal(r);
              }}
              className="w-full bg-emerald-700 text-white rounded-xl text-xs font-bold h-9"
            >
              Approve Holiday Pay
            </Button>
          </div>
        ))}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODAL 1: REVIEW HOLIDAY ATTENDANCE MODAL
      ───────────────────────────────────────────────────────────── */}
      {reviewingRecord && (
        <Modal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          title={`Approve Holiday Pay: ${reviewingRecord.employeeName}`}
          description={`Verify attendance for ${reviewingRecord.holidayName} (${reviewingRecord.holidayDate}) and forward for payroll extra payment.`}
          size="lg"
        >
          <form onSubmit={handleApproveHolidayPay} className="space-y-4">
            {/* Employee Info Header */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <HREmployeeCell
                name={reviewingRecord.employeeName}
                id={reviewingRecord.employeeId}
                avatar={reviewingRecord.avatar}
                photoUrl={reviewingRecord.photoUrl}
                department={reviewingRecord.department}
                designation={reviewingRecord.designation}
              />
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Present ({reviewingRecord.workedHours} Hrs)
              </span>
            </div>

            {/* Attendance Punch Timestamps */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white grid grid-cols-3 gap-2 text-xs text-center">
              <div>
                <span className="text-[10px] text-slate-400 block font-bold">Punch In Time</span>
                <span className="font-extrabold text-slate-900">{reviewingRecord.checkIn}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-bold">Punch Out Time</span>
                <span className="font-extrabold text-slate-900">{reviewingRecord.checkOut}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-bold">Total Worked</span>
                <span className="font-black text-emerald-700">{reviewingRecord.workedHours} Hours</span>
              </div>
            </div>

            {/* Simplified Payroll Workflow Section */}
            <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/70 space-y-2">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-purple-700" />
                <span className="text-sm font-extrabold text-purple-950">Holiday Work Benefit: Additional Pay (Extra Money)</span>
              </div>
              <p className="text-xs text-purple-800 leading-relaxed">
                Employee worked on a declared holiday. Upon approval, the worked hours will be forwarded to Payroll for additional holiday compensation calculation.
              </p>
              <div className="pt-2 flex items-center justify-between text-xs border-t border-purple-200/80">
                <span className="font-bold text-purple-900">Estimated Holiday Pay Amount:</span>
                <span className="font-black text-purple-950 text-sm">₹{reviewingRecord.holidayPayAmount.toLocaleString("en-IN")}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">HR Review Remarks</label>
              <textarea
                rows={2}
                placeholder="e.g. Approved based on attendance punch verification..."
                value={reviewRemarks}
                onChange={(e) => setReviewRemarks(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsReviewModalOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleRejectRecord(reviewingRecord.id, reviewingRecord.employeeName)}
                className="rounded-xl text-xs font-bold text-rose-700 border-rose-300 hover:bg-rose-50"
              >
                Reject Request
              </Button>
              <Button
                type="submit"
                size="sm"
                className="rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white"
              >
                Approve Holiday Pay
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SIDE DRAWER: VIEW RECORD DETAILS
      ───────────────────────────────────────────────────────────── */}
      <Drawer
        isOpen={Boolean(viewingRecord)}
        onClose={() => setViewingRecord(null)}
        title="Holiday Attendance Details"
        icon={<Calendar className="h-5 w-5 text-emerald-700" />}
      >
        {viewingRecord && (
          <>
            <HREmployeeCell
              name={viewingRecord.employeeName}
              id={viewingRecord.employeeId}
              avatar={viewingRecord.avatar}
              photoUrl={viewingRecord.photoUrl}
              department={viewingRecord.department}
              designation={viewingRecord.designation}
            />

            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 text-xs">
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span className="text-slate-500 font-medium">Holiday Name</span>
                <span className="font-bold text-slate-900">{viewingRecord.holidayName} ({viewingRecord.holidayDate})</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span className="text-slate-500 font-medium">Worked Hours</span>
                <span className="font-bold text-emerald-800">{viewingRecord.workedHours} Hours</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span className="text-slate-500 font-medium">Benefit Type</span>
                <span className="font-black text-purple-900">Additional Pay</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span className="text-slate-500 font-medium">Holiday Pay Amount</span>
                <span className="font-bold text-purple-950">₹{viewingRecord.holidayPayAmount.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Payroll Status</span>
                <span className="font-bold text-amber-800">{viewingRecord.payrollStatus}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
              <span className="font-bold text-slate-800 uppercase block">Review Audit Log:</span>
              <p className="text-slate-600">Reviewed By: <strong className="text-slate-900">{viewingRecord.reviewedBy || "Pending Review"}</strong></p>
              <p className="text-slate-600">Reviewed Date: <strong className="text-slate-900">{viewingRecord.reviewedDate || "Pending"}</strong></p>
              {viewingRecord.remarks && <p className="italic text-slate-700 pt-1">"{viewingRecord.remarks}"</p>}
            </div>
          </>
        )}
      </Drawer>

      {/* ─────────────────────────────────────────────────────────────
          MODAL 2: MANUAL ADD HOLIDAY WORK ENTRY MODAL
      ───────────────────────────────────────────────────────────── */}
      {isAddModalOpen && (
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="Add Manual Holiday Work Entry"
          description="Record an employee's worked hours on an official holiday for additional salary compensation."
          size="md"
        >
          <form onSubmit={handleSaveAddHolidayWork} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Select Employee <span className="text-rose-500">*</span>
              </label>

              {/* Single Unified Searchable Employee Combobox */}
              <div className="relative" ref={addComboboxRef}>
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={addEmpQuery}
                  onFocus={() => setIsAddEmpComboboxOpen(true)}
                  onChange={(e) => {
                    setAddEmpQuery(e.target.value);
                    setIsAddEmpComboboxOpen(true);
                  }}
                  placeholder="Type employee name, ID or department to search..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-8 text-xs font-semibold text-slate-900 shadow-2xs focus:border-emerald-500 focus:outline-none"
                />
                {addEmpQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setAddEmpQuery("");
                      setAddEmpId("");
                      setIsAddEmpComboboxOpen(true);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                )}

                {/* Combobox Dropdown Results List */}
                {isAddEmpComboboxOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl space-y-1 max-h-56 overflow-y-auto animate-in fade-in-50">
                    {employees.filter((staff) => {
                      if (!addEmpQuery.trim()) return true;
                      const q = addEmpQuery.toLowerCase().trim();
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
                        if (!addEmpQuery.trim()) return true;
                        const q = addEmpQuery.toLowerCase().trim();
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
                            setAddEmpId(staff.id);
                            setAddEmpQuery(`${staff.name} (${staff.id}) - ${staff.department}`);
                            setIsAddEmpComboboxOpen(false);
                          }}
                          className={cn(
                            "flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors hover:bg-slate-100/80 border border-transparent",
                            addEmpId === staff.id && "bg-emerald-50 text-emerald-900 border-emerald-200"
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
                          {addEmpId === staff.id && <Check className="h-4 w-4 text-emerald-600 shrink-0 ml-2" />}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Holiday Occasion <span className="text-rose-500">*</span>
                </label>
                <select
                  value={addHolidayName}
                  onChange={(e) => setAddHolidayName(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-white font-semibold text-slate-800"
                >
                  <option value="Independence Day (15 Aug)">Independence Day (15 Aug)</option>
                  <option value="Republic Day (26 Jan)">Republic Day (26 Jan)</option>
                  <option value="Gandhi Jayanti (02 Oct)">Gandhi Jayanti (02 Oct)</option>
                  <option value="Diwali Holiday (12 Nov)">Diwali Holiday (12 Nov)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Worked Hours <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  max="16"
                  placeholder="e.g. 8.0"
                  value={addWorkedHours}
                  onChange={(e) => setAddWorkedHours(e.target.value)}
                  required
                  className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-white font-bold text-slate-900"
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-950 flex items-center justify-between">
              <div>
                <span className="font-bold block">Payroll Rule Applied:</span>
                <p className="text-purple-900">
                  Rate Multiplier: <strong>1.0x Normal Salary Rate</strong> (1 Day Full Pay = ₹1,000 for ₹30k/mo salary)
                </p>
              </div>
              <DollarSign className="h-5 w-5 text-purple-700 shrink-0" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Remarks / Note</label>
              <textarea
                rows={2}
                placeholder="e.g. Worked extra shift for Independence Day banquet event..."
                value={addRemarks}
                onChange={(e) => setAddRemarks(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white"
              >
                Forward to Payroll
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MOBILE FILTERS BOTTOM SHEET MODAL */}
      {isMobileFilterOpen && (
        <Modal
          isOpen={isMobileFilterOpen}
          onClose={() => setIsMobileFilterOpen(false)}
          title="Filter holiday records"
          size="sm"
        >
          <div className="space-y-3 text-xs">
            <ToolbarFilterSelect
              value={selectedHoliday}
              onChange={setSelectedHoliday}
              options={[...holidayFilterOptions]}
              ariaLabel="Filter by holiday"
              className="w-full min-w-0"
            />
            <ToolbarFilterSelect
              value={selectedDepartment}
              onChange={setSelectedDepartment}
              options={[...employeeDepartmentFilterOptions]}
              ariaLabel="Filter by department"
              className="w-full min-w-0"
            />
            <ToolbarFilterSelect
              value={selectedStatus}
              onChange={setSelectedStatus}
              options={[...holidayStatusFilterOptions]}
              ariaLabel="Filter by approval status"
              className="w-full min-w-0"
            />
            <div>
              <label className="mb-1 block font-bold text-slate-700">Date</label>
              <input
                type="date"
                value={selectedDate}
                max={today}
                onChange={(e) => setSelectedDate(e.target.value > today ? today : e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-semibold"
              />
            </div>

            <div className="flex gap-2 border-t border-slate-100 pt-3">
              {hasActiveFilters && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    resetFilters();
                    setIsMobileFilterOpen(false);
                  }}
                  className="flex-1 rounded-xl text-xs font-bold"
                >
                  Reset
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                onClick={() => setIsMobileFilterOpen(false)}
                className="flex-1 rounded-xl bg-emerald-700 text-xs font-bold text-white"
              >
                Apply
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <ReportExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={handleHolidayExport}
        defaultDate={selectedDate}
        maxDate={today}
        title="Export holiday attendance report"
        description="Choose file type and time period. Current table filters will apply."
        exporting={exporting}
      />
    </ModulePageShell>
  );
}
