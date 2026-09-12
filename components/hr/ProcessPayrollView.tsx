"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Calendar,
  Search,
  Users,
  DollarSign,
  CheckCircle2,
  Lock,
  Eye,
  Edit,
  Play,
  Printer,
  SlidersHorizontal,
  X,
  FileSpreadsheet,
  Building2,
  AlertCircle,
  PauseCircle,
  Unlock,
  CreditCard,
  Calculator,
  ChevronRight,
  ChevronDown,
  Send,
  MoreVertical,
  CheckSquare,
  Square,
  AlertTriangle,
  History,
  ShieldAlert,
  FileText,
  CheckCircle,
  HelpCircle,
  Check,
  RefreshCw,
  Landmark,
  FileCode,
  Download,
  Mail,
  Plus,
  Clock,
} from "lucide-react";
import { ModulePageShell } from "@/components/pms";
import { Button, Drawer, Modal, StatusBadge } from "@/components/ui";
import { HRKPICard } from "@/components/hr/shared/HRKPICard";
import { HREmployeeCell } from "@/components/hr/shared/HREmployeeCell";
import { hrPayrollService, hrEmployeeService, hrSalaryStructureService } from "@/services/human-resources";
import { mapAuditFromApi, mapPayrollFromApi, mapEmployeeFromApi, mapSalaryStructureFromApi } from "@/lib/hr/api-mappers";
import { MONTH_NAME_TO_NUMBER } from "@/lib/hr/useHrList";
import { cn } from "@/lib/utils";

export type PayrollStatus =
  | "Draft"
  | "Calculated"
  | "Verified"
  | "Approved"
  | "Paid"
  | "Locked"
  | "On Hold";

export interface EmployeePayrollRecord {
  id: string;
  employeeId: string;
  payrollMonth: number;
  payrollYear: number;

  grossSalary: number;
  earningsTotal: number;
  deductionsTotal: number;
  netSalary: number;

  status: PayrollStatus;
  calculatedAt?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;

  payrollId: string;
  employeeName: string;
  department: string;
  designation: string;
  avatar: string;
  photoUrl?: string;

  // Earnings breakdown
  basicSalary: number;
  hra: number;
  allowances: number;
  overtimePay: number;
  holidayPay: number;
  incentives: number;
  bonus: number;
  otherEarnings: number;

  // Deductions breakdown
  leaveDeduction: number;
  pfDeduction: number;
  esiDeduction: number;
  ptDeduction: number;
  tdsDeduction: number;
  otherDeductions: number;

  isOnHold?: boolean;
  paymentDate?: string;
  paymentRefNo?: string;
  bankRefNo?: string;
  payslipGenerated?: boolean;

  // Validation flags
  hasAttendanceIssue?: boolean;
  missingBankDetails?: boolean;
  missingSalaryStructure?: boolean;
  missingPan?: boolean;
  pendingLeaveApproval?: boolean;
  pendingOtApproval?: boolean;
}

const MONTH_NAMES = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatPayrollPeriod(month: number, year: number) {
  return `${MONTH_NAMES[month] ?? month} ${year}`;
}

function formatTimestamp(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface PayrollAuditEntry {
  id: string;
  action: string;
  changedBy: string;
  changedOn: string;
  overrideReason?: string;
  auditNotes?: string;
}

export type SalaryPaymentMode = "Bank Transfer" | "NEFT" | "RTGS" | "UPI" | "Cheque" | "Cash";
export type SalaryPaymentStatus = "Completed" | "Pending" | "Failed";

export interface SalaryPayment {
  id: string;
  payrollId: string;
  employeeId: string;
  amount: number;
  paymentDate: string;
  paymentMode: SalaryPaymentMode;
  transactionReference: string;
  status: SalaryPaymentStatus;
  remarks: string;
  recordedBy: string;
  createdAt: string;
  updatedAt: string;
}

const PAYROLL_RECORDED_BY = "Neha Mehta (HR Manager)";

export function ProcessPayrollView() {
  const [records, setRecords] = useState<EmployeePayrollRecord[]>([]);
  const [salaryPayments, setSalaryPayments] = useState<SalaryPayment[]>([]);
  const [auditLogs, setAuditLogs] = useState<PayrollAuditEntry[]>([]);
  const [loadingPayroll, setLoadingPayroll] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Step 1: Period Selection Controls
  const [selectedMonth, setSelectedMonth] = useState("August");
  const [selectedYear, setSelectedYear] = useState("2026");
  const [selectedDept, setSelectedDept] = useState("ALL");
  const [selectedEmpType, setSelectedEmpType] = useState("ALL");
  const [processAllOption, setProcessAllOption] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");

  const [isGenerating, setIsGenerating] = useState(false);
  const [isPayrollLocked, setIsPayrollLocked] = useState(false);
  
  // Status Flow: Draft -> Calculated -> Verified -> Approved -> Paid
  const [overallPayrollStage, setOverallPayrollStage] = useState<"Draft" | "Calculated" | "Verified" | "Approved" | "Paid" | "Payslip Generated">("Draft");

  // Selection & Row Expansion
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [expandedRecordIds, setExpandedRecordIds] = useState<string[]>([]);

  // Drawers & Modals & Export Popover
  const [viewingRecord, setViewingRecord] = useState<EmployeePayrollRecord | null>(null);
  const [viewingPayslipRecord, setViewingPayslipRecord] = useState<EmployeePayrollRecord | null>(null);
  const [recordingPaymentRecord, setRecordingPaymentRecord] = useState<EmployeePayrollRecord | null>(null);
  const [editingRecord, setEditingRecord] = useState<EmployeePayrollRecord | null>(null);
  const [activeActionDropdownId, setActiveActionDropdownId] = useState<string | null>(null);
  const [isValidationCenterOpen, setIsValidationCenterOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isMarkAsPaidModalOpen, setIsMarkAsPaidModalOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // Close popovers when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(target)) {
        setIsExportOpen(false);
      }
      if (target instanceof Element && !target.closest("[data-payroll-action-menu]")) {
        setActiveActionDropdownId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadPayrollData = async () => {
    setLoadingPayroll(true);
    try {
      const month = MONTH_NAME_TO_NUMBER[selectedMonth];
      const year = Number(selectedYear);
      const [payrollRows, auditRows] = await Promise.all([
        hrPayrollService.listRecords(month, year),
        hrPayrollService.listAuditLogs(),
      ]);
      const mapped = payrollRows.map(mapPayrollFromApi);
      setRecords(mapped);
      setAuditLogs(auditRows.map(mapAuditFromApi));

      if (mapped.length === 0) {
        setOverallPayrollStage("Draft");
      } else if (mapped.every((r) => r.status === "Paid" || r.status === "Locked")) {
        setOverallPayrollStage("Paid");
      } else if (mapped.some((r) => r.payslipGenerated)) {
        setOverallPayrollStage("Payslip Generated");
      } else if (mapped.every((r) => r.status === "Approved")) {
        setOverallPayrollStage("Approved");
      } else if (mapped.some((r) => r.status === "Verified")) {
        setOverallPayrollStage("Verified");
      } else if (mapped.some((r) => r.status === "Calculated")) {
        setOverallPayrollStage("Calculated");
      } else {
        setOverallPayrollStage("Draft");
      }
    } catch (e) {
      setToastMessage(e instanceof Error ? e.message : "Failed to load payroll data");
      setRecords([]);
      setAuditLogs([]);
      setOverallPayrollStage("Draft");
    } finally {
      setLoadingPayroll(false);
    }
  };

  useEffect(() => {
    void loadPayrollData();
  }, [selectedMonth, selectedYear]);

  // Edit Adjustments Form State
  const [editBasic, setEditBasic] = useState(0);
  const [editHra, setEditHra] = useState(0);
  const [editAllowances, setEditAllowances] = useState(0);
  const [editOT, setEditOT] = useState(0);
  const [editHolidayPay, setEditHolidayPay] = useState(0);
  const [editIncentives, setEditIncentives] = useState(0);
  const [editBonus, setEditBonus] = useState(0);
  const [editOtherEarnings, setEditOtherEarnings] = useState(0);
  
  const [editLeaveDed, setEditLeaveDed] = useState(0);
  const [editPf, setEditPf] = useState(0);
  const [editEsi, setEditEsi] = useState(0);
  const [editPt, setEditPt] = useState(0);
  const [editTds, setEditTds] = useState(0);
  const [editOtherDeductions, setEditOtherDeductions] = useState(0);
  const [overrideReason, setOverrideReason] = useState("");

  // Bulk Mark As Paid form state
  const [paymentDate, setPaymentDate] = useState("10/08/2026");
  const [paymentRefNo, setPaymentRefNo] = useState("PAY-REF-202608-001");
  const [bankRefNo, setBankRefNo] = useState("HDFC-TXN-987654321");

  // salary_payments form state (Record Payment action)
  const [salaryPaymentForm, setSalaryPaymentForm] = useState({
    amount: 0,
    paymentDate: "",
    paymentMode: "Bank Transfer" as SalaryPaymentMode,
    transactionReference: "",
    status: "Completed" as SalaryPaymentStatus,
    remarks: "",
  });

  // Filtered Table Records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchSearch =
        r.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.department.toLowerCase().includes(searchTerm.toLowerCase());

      const matchDept = selectedDept === "ALL" || r.department === selectedDept;
      const matchStatus = selectedStatus === "ALL" || r.status === selectedStatus;

      return matchSearch && matchDept && matchStatus;
    });
  }, [records, searchTerm, selectedDept, selectedStatus]);

  // Summary Cards Metrics (8 Comprehensive Cards)
  const metrics = useMemo(() => {
    const totalEmployees = records.length;
    const processedEmployees = records.filter((r) => r.status !== "Draft").length;
    const pendingEmployees = records.filter((r) => r.status === "Draft" || r.status === "Calculated").length;
    const approvedEmployees = records.filter((r) => r.status === "Approved").length;
    const paidEmployees = records.filter((r) => r.status === "Paid" || r.status === "Locked").length;

    const grossPayroll = records.reduce((sum, r) => sum + r.grossSalary, 0);
    const totalDeductions = records.reduce((sum, r) => sum + r.deductionsTotal, 0);
    const netPayroll = grossPayroll - totalDeductions;

    return {
      totalEmployees,
      processedEmployees,
      pendingEmployees,
      approvedEmployees,
      paidEmployees,
      grossPayroll,
      totalDeductions,
      netPayroll,
    };
  }, [records]);

  // Step 2 & 4: Automatic Data Fetch & Recalculate Handler
  const handleCalculatePayroll = async () => {
    if (isPayrollLocked) return;
    setIsGenerating(true);
    try {
      const month = MONTH_NAME_TO_NUMBER[selectedMonth];
      const year = Number(selectedYear);

      // Fetch current active employees and salary structures
      const [empRows, structureRows] = await Promise.all([
        hrEmployeeService.list(),
        hrSalaryStructureService.list(),
      ]);
      const employees = empRows.map(mapEmployeeFromApi).filter((e) => e.status === "Active" || !e.status);
      const structures = structureRows.map(mapSalaryStructureFromApi);

      if (employees.length === 0) {
        setToastMessage("No active employees found in Employee List. Please add employees first.");
        setIsGenerating(false);
        return;
      }

      const calculatedRecords: EmployeePayrollRecord[] = employees.map((emp) => {
        // Check if matching salary structure exists
        const struct = structures.find(
          (s) => s.id === emp.salaryStructureId || s.name === emp.salaryStructureName
        );

        const empSalary = emp.structureGrossSalary || 25000;

        const basicSalary =
          struct?.earnings.find((e) => e.componentName.toLowerCase().includes("basic"))?.computedAmount ||
          Math.round(empSalary * 0.5);

        const hra =
          struct?.earnings.find((e) => e.componentName.toLowerCase().includes("hra") || e.componentName.toLowerCase().includes("house"))?.computedAmount ||
          Math.round(empSalary * 0.3);

        const allowances = struct
          ? Math.max(0, struct.grossSalary - basicSalary - hra)
          : Math.max(0, empSalary - basicSalary - hra);

        const grossSalary = struct ? struct.grossSalary : (emp.structureGrossSalary || basicSalary + hra + allowances);

        const pfDeduction =
          struct?.deductions.find((d) => d.componentName.toLowerCase().includes("pf") || d.componentName.toLowerCase().includes("provident"))?.computedAmount ||
          Math.round(basicSalary * 0.12);

        const ptDeduction =
          struct?.deductions.find((d) => d.componentName.toLowerCase().includes("pt") || d.componentName.toLowerCase().includes("professional") || d.componentName.toLowerCase().includes("tax"))?.computedAmount ||
          200;

        const tdsDeduction =
          struct?.deductions.find((d) => d.componentName.toLowerCase().includes("tds"))?.computedAmount ||
          0;

        const otherDeductions = struct ? Math.max(0, struct.totalDeductions - pfDeduction - ptDeduction - tdsDeduction) : 0;
        const totalDeductions = pfDeduction + ptDeduction + tdsDeduction + otherDeductions;
        const netSalary = Math.max(0, grossSalary - totalDeductions);

        return {
          id: `PAY-${year}-${String(month).padStart(2, "0")}-${emp.id}`,
          employeeId: emp.id,
          payrollMonth: month,
          payrollYear: year,
          payrollId: `PAY-${year}${String(month).padStart(2, "0")}-${emp.empCode || emp.id.slice(0, 6)}`,
          employeeName: emp.name || emp.empCode || "Employee",
          department: emp.department || "General",
          designation: emp.designation || "Staff",
          avatar: emp.avatar || (emp.name ? emp.name.slice(0, 2).toUpperCase() : "EM"),
          photoUrl: emp.photoUrl,
          grossSalary,
          earningsTotal: grossSalary,
          basicSalary,
          hra,
          allowances,
          overtimePay: 0,
          holidayPay: 0,
          incentives: 0,
          bonus: 0,
          otherEarnings: 0,
          leaveDeduction: 0,
          pfDeduction,
          esiDeduction: 0,
          ptDeduction,
          tdsDeduction,
          otherDeductions,
          deductionsTotal: totalDeductions,
          netSalary,
          status: "Calculated" as PayrollStatus,
          calculatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          missingSalaryStructure: !struct && !emp.salaryStructureId,
          missingBankDetails: !emp.bankAccount,
          missingPan: !emp.panNumber,
        };
      });

      setRecords(calculatedRecords);
      setOverallPayrollStage("Calculated");
      addAuditEntry(`Fetched and calculated payroll inputs for ${employees.length} employees (${selectedMonth} ${selectedYear})`);
      setToastMessage(`Payroll calculated successfully for ${employees.length} employees (${selectedMonth} ${selectedYear})!`);
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : "Failed to calculate payroll");
    } finally {
      setIsGenerating(false);
    }
  };

  // Step 5: Approve Payroll Handler
  const handleApproveAll = () => {
    if (isPayrollLocked) return;
    setOverallPayrollStage("Approved");
    setRecords((prev) => prev.map((r) => (r.status === "On Hold" ? r : { ...r, status: "Approved" })));
    addAuditEntry(`Approved full payroll batch for ${selectedMonth} ${selectedYear}`);
    setToastMessage("Full payroll batch APPROVED! Ready for salary disbursement.");
  };

  // Bulk Actions
  const handleBulkCalculate = () => {
    if (isPayrollLocked || selectedRecordIds.length === 0) return;
    setRecords((prev) =>
      prev.map((r) => (selectedRecordIds.includes(r.id) ? { ...r, status: "Calculated", calculatedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : r))
    );
    addAuditEntry(`Calculated ${selectedRecordIds.length} employee payroll records in bulk.`);
    setSelectedRecordIds([]);
    setToastMessage(`Calculated payroll for ${selectedRecordIds.length} selected employees.`);
  };

  const handleBulkApprove = () => {
    if (isPayrollLocked || selectedRecordIds.length === 0) return;
    setRecords((prev) =>
      prev.map((r) => (selectedRecordIds.includes(r.id) ? { ...r, status: "Approved", approvedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : r))
    );
    addAuditEntry(`Approved ${selectedRecordIds.length} employee payroll records in bulk.`);
    setSelectedRecordIds([]);
    setToastMessage(`Approved ${selectedRecordIds.length} selected employee payroll records.`);
  };

  const handleBulkMarkPaid = () => {
    if (selectedRecordIds.length === 0) return;
    setIsMarkAsPaidModalOpen(true);
  };

  const handleLockPayroll = () => {
    setIsPayrollLocked(true);
    setOverallPayrollStage("Paid");
    addAuditEntry("LOCKED payroll batch. All salary records are now read-only.");
    setToastMessage("Payroll batch LOCKED! All values are now read-only.");
  };

  // Step 6: Salary Payment Handler
  const handleMarkAsPaidSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOverallPayrollStage("Paid");
    setIsPayrollLocked(true);
    setRecords((prev) =>
      prev.map((r) => ({
        ...r,
        status: "Paid",
        paymentDate,
        paymentRefNo,
        bankRefNo,
      }))
    );
    addAuditEntry(`Marked payroll batch as PAID. Bank Ref: ${bankRefNo}`);
    setIsMarkAsPaidModalOpen(false);
    setToastMessage(`Salaries marked as PAID for ${selectedMonth} ${selectedYear}! Bank Ref: ${bankRefNo}.`);
  };

  // Step 7: Generate Payslips Handler
  const handleGenerateAllPayslips = () => {
    setRecords((prev) => prev.map((r) => ({ ...r, payslipGenerated: true })));
    addAuditEntry("Generated payslips for all processed employees.");
    setToastMessage("Generated payslips for all employees! Available in Payslips module.");
  };

  // Bulk Selection Handlers
  const handleSelectAll = () => {
    if (selectedRecordIds.length === filteredRecords.length) {
      setSelectedRecordIds([]);
    } else {
      setSelectedRecordIds(filteredRecords.map((r) => r.id));
    }
  };

  const handleToggleSelectRecord = (id: string) => {
    setSelectedRecordIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleExpandRow = (id: string) => {
    setExpandedRecordIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Open Edit Modal
  const handleOpenEditModal = (r: EmployeePayrollRecord) => {
    if (isPayrollLocked) return;
    setEditingRecord(r);
    setEditBasic(r.basicSalary);
    setEditHra(r.hra);
    setEditAllowances(r.allowances);
    setEditOT(r.overtimePay);
    setEditHolidayPay(r.holidayPay);
    setEditIncentives(r.incentives);
    setEditBonus(r.bonus);
    setEditOtherEarnings(r.otherEarnings);

    setEditLeaveDed(r.leaveDeduction);
    setEditPf(r.pfDeduction);
    setEditEsi(r.esiDeduction);
    setEditPt(r.ptDeduction);
    setEditTds(r.tdsDeduction);
    setEditOtherDeductions(r.otherDeductions);

    setOverrideReason("Special attendance / Incentive adjustment");
    setActiveActionDropdownId(null);
  };

  const handleApproveRecord = async (r: EmployeePayrollRecord) => {
    if (isPayrollLocked || r.status === "Approved" || r.status === "Paid" || r.status === "Locked") return;
    try {
      await hrPayrollService.approveRecord(r.id, PAYROLL_RECORDED_BY);
      await loadPayrollData();
      setActiveActionDropdownId(null);
      setToastMessage(`Payroll approved for ${r.employeeName} (${formatPayrollPeriod(r.payrollMonth, r.payrollYear)}).`);
    } catch (e) {
      setToastMessage(e instanceof Error ? e.message : "Failed to approve payroll");
    }
  };

  const handleOpenRecordPayment = (r: EmployeePayrollRecord) => {
    if (r.status !== "Approved") {
      setToastMessage(`Approve payroll for ${r.employeeName} before recording payment.`);
      setActiveActionDropdownId(null);
      return;
    }
    setRecordingPaymentRecord(r);
    setSalaryPaymentForm({
      amount: r.netSalary,
      paymentDate: new Date().toISOString().slice(0, 10),
      paymentMode: "Bank Transfer",
      transactionReference: "",
      status: "Completed",
      remarks: "",
    });
    setActiveActionDropdownId(null);
  };

  const handleSinglePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordingPaymentRecord) return;
    if (recordingPaymentRecord.status !== "Approved") {
      setToastMessage("Payroll must be approved before recording payment.");
      return;
    }

    try {
      await hrPayrollService.recordPayment(recordingPaymentRecord.id, {
        amount: salaryPaymentForm.amount,
        paymentDate: salaryPaymentForm.paymentDate,
        paymentMode: salaryPaymentForm.paymentMode,
        transactionReference: salaryPaymentForm.transactionReference,
        status: salaryPaymentForm.status,
        remarks: salaryPaymentForm.remarks,
        recordedBy: PAYROLL_RECORDED_BY,
      });
      await loadPayrollData();
      setRecordingPaymentRecord(null);
      setToastMessage(
        `Salary payment recorded for ${recordingPaymentRecord.employeeName} — ₹${salaryPaymentForm.amount.toLocaleString("en-IN")} (${salaryPaymentForm.status}).`
      );
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : "Failed to record payment");
    }
  };

  const handleViewPayslip = (r: EmployeePayrollRecord) => {
    setViewingPayslipRecord(r);
    setActiveActionDropdownId(null);
  };

  const renderPayrollActionMenu = (r: EmployeePayrollRecord) => {
    const canApprove =
      !isPayrollLocked && r.status !== "Approved" && r.status !== "Paid" && r.status !== "Locked";
    const canRecordPayment = !isPayrollLocked && r.status === "Approved";

    return (
      <div className="relative" data-payroll-action-menu>
        <button
          type="button"
          onClick={() =>
            setActiveActionDropdownId(activeActionDropdownId === r.id ? null : r.id)
          }
          className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-600 font-bold border border-slate-200"
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {activeActionDropdownId === r.id && (
          <div className="absolute right-0 top-full mt-1 z-30 w-48 bg-white rounded-2xl shadow-xl border border-slate-200 p-1.5 text-left text-xs animate-in fade-in">
            <button
              type="button"
              onClick={() => {
                setViewingRecord(r);
                setActiveActionDropdownId(null);
              }}
              className="w-full px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
            >
              <Eye className="h-3.5 w-3.5 text-slate-500" /> View Payroll
            </button>

            <button
              type="button"
              onClick={() => handleViewPayslip(r)}
              className="w-full px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
            >
              <FileText className="h-3.5 w-3.5 text-blue-600" /> View Payslip
            </button>

            <button
              type="button"
              disabled={!canApprove}
              onClick={() => handleApproveRecord(r)}
              className={cn(
                "w-full px-3 py-2 rounded-xl flex items-center gap-2 font-semibold",
                canApprove
                  ? "text-emerald-800 hover:bg-emerald-50"
                  : "text-slate-300 cursor-not-allowed",
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Approve Payroll
            </button>

            <button
              type="button"
              disabled={!canRecordPayment}
              title={canRecordPayment ? undefined : "Approve payroll first"}
              onClick={() => handleOpenRecordPayment(r)}
              className={cn(
                "w-full px-3 py-2 rounded-xl flex items-center gap-2 font-semibold border-t border-slate-100 mt-0.5 pt-2",
                canRecordPayment
                  ? "text-blue-800 hover:bg-blue-50"
                  : "text-slate-300 cursor-not-allowed",
              )}
            >
              <Landmark className="h-3.5 w-3.5 text-blue-600" /> Record Payment
              {!canRecordPayment && r.status !== "Paid" && r.status !== "Locked" && (
                <span className="ml-auto text-[10px] font-normal text-slate-400">Approve first</span>
              )}
            </button>
          </div>
        )}
      </div>
    );
  };

  const addAuditEntry = (action: string, notes?: string, reason?: string) => {
    const newEntry: PayrollAuditEntry = {
      id: `AUD-${Math.floor(10 + Math.random() * 90)}`,
      action,
      changedBy: "Neha Mehta (HR Manager)",
      changedOn: new Date().toLocaleString("en-GB"),
      overrideReason: reason,
      auditNotes: notes,
    };
    setAuditLogs((prev) => [newEntry, ...prev]);
  };

  // Save Edit Adjustment
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    const gross = editBasic + editHra + editAllowances + editOT + editHolidayPay + editIncentives + editBonus + editOtherEarnings;
    const totalDed = editLeaveDed + editPf + editEsi + editPt + editTds + editOtherDeductions;
    const net = gross - totalDed;

    setRecords((prev) =>
      prev.map((r) =>
        r.id === editingRecord.id
          ? {
              ...r,
              basicSalary: editBasic,
              hra: editHra,
              allowances: editAllowances,
              overtimePay: editOT,
              holidayPay: editHolidayPay,
              incentives: editIncentives,
              bonus: editBonus,
              otherEarnings: editOtherEarnings,
              grossSalary: gross,
              earningsTotal: gross,
              leaveDeduction: editLeaveDed,
              pfDeduction: editPf,
              esiDeduction: editEsi,
              ptDeduction: editPt,
              tdsDeduction: editTds,
              otherDeductions: editOtherDeductions,
              deductionsTotal: totalDed,
              netSalary: net,
              updatedAt: new Date().toISOString(),
            }
          : r
      )
    );

    addAuditEntry(
      `Edited Adjustments for ${editingRecord.employeeName}`,
      "Manual adjustments saved",
      overrideReason
    );

    setEditingRecord(null);
    setToastMessage(`Adjustments saved for ${editingRecord.employeeName}. Net Salary re-computed to ₹${net.toLocaleString("en-IN")}.`);
  };

  return (
    <ModulePageShell
      eyebrow="Human Resource / Payroll"
      title="Process Payroll"
      description="Compile attendance, leaves, overtime, holiday pay, and salary structures into final monthly salary calculations, reviews, and payslips."
      breadcrumbs={[
        { label: "Human Resource", href: "/human-resources/dashboard" },
        { label: "Payroll" },
        { label: "Process Payroll" },
      ]}
      toast={toastMessage}
      onDismissToast={() => setToastMessage(null)}
      secondaryActions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsAuditModalOpen(true)}
            className="rounded-xl text-xs font-semibold bg-white text-slate-700 border-slate-300 shadow-xs"
          >
            <History className="h-3.5 w-3.5 mr-1 text-slate-500" />
            Audit History
          </Button>

          {!isPayrollLocked ? (
            <>
              <Button
                type="button"
                size="sm"
                onClick={handleApproveAll}
                className="rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs"
              >
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                Approve Payroll
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={() => setIsMarkAsPaidModalOpen(true)}
                className="rounded-xl text-xs font-bold bg-blue-700 hover:bg-blue-800 text-white shadow-xs"
              >
                <Landmark className="mr-1.5 h-3.5 w-3.5" />
                Mark as Paid
              </Button>
            </>
          ) : (
            <span className="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-slate-900 text-amber-400 border border-slate-700 flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" /> Payroll Locked &amp; Paid
            </span>
          )}

          {/* Export Options Dropdown Popover */}
          <div className="relative" ref={exportDropdownRef}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsExportOpen(!isExportOpen)}
              className="rounded-xl text-xs font-semibold bg-white text-slate-700 border-slate-300 shadow-xs"
            >
              <Download className="h-3.5 w-3.5 mr-1 text-slate-500" />
              Export Reports
              <ChevronDown className="h-3.5 w-3.5 ml-1 text-slate-400" />
            </Button>

            {isExportOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 w-52 bg-white rounded-2xl shadow-xl border border-slate-200 p-1.5 space-y-1 text-xs animate-in fade-in-50">
                <button
                  type="button"
                  onClick={() => {
                    setIsExportOpen(false);
                    setToastMessage("Exported Payroll Summary to Excel Sheet (.xlsx).");
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-slate-100 font-semibold text-slate-800 flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" /> Excel Sheet (.xlsx)
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsExportOpen(false);
                    setToastMessage("Exported Payroll Report to PDF (.pdf).");
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-slate-100 font-semibold text-slate-800 flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <FileCode className="h-3.5 w-3.5 text-rose-600" /> PDF Report (.pdf)
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsExportOpen(false);
                    setToastMessage("Exported Monthly Salary Register Report.");
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-slate-100 font-semibold text-slate-800 flex items-center justify-between border-t border-slate-100 pt-1.5"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-blue-700" /> Salary Register
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsExportOpen(false);
                    setToastMessage("Generated Bank Transfer Direct Salary Disbursement Sheet.");
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-slate-100 font-semibold text-slate-800 flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Landmark className="h-3.5 w-3.5 text-purple-700" /> Bank Transfer Sheet
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      }
    >
      {/* ─────────────────────────────────────────────────────────────
          1. PAYROLL WORKFLOW STEPPER TRACKER
          Draft → Calculated → Verified → Approved → Paid → Payslip Generated
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <RefreshCw className="h-3.5 w-3.5 text-emerald-700" /> Payroll Workflow Tracker: {selectedMonth} {selectedYear}
          </span>
          <div className="flex items-center gap-2">
            {isPayrollLocked ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-900 text-amber-400 border border-slate-700 flex items-center gap-1">
                <Lock className="h-3 w-3" /> Month Closed &amp; Locked
              </span>
            ) : (
              <button
                type="button"
                onClick={handleLockPayroll}
                className="text-[11px] font-bold text-amber-800 hover:text-amber-950 underline flex items-center gap-1"
              >
                <Lock className="h-3 w-3" /> Lock Payroll &amp; Close Month
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2 border-t border-slate-100">
          {[
            { stage: "Draft", label: "1. Draft", icon: FileText, desc: "Data Fetch" },
            { stage: "Calculated", label: "2. Calculated", icon: Calculator, desc: "Auto Compute" },
            { stage: "Verified", label: "3. Verified", icon: CheckCircle2, desc: "HR Verification" },
            { stage: "Approved", label: "4. Approved", icon: CheckSquare, desc: "Management Approval" },
            { stage: "Paid", label: "5. Paid", icon: Landmark, desc: "Bank Transfer" },
            { stage: "Payslip Generated", label: "6. Payslips Sent", icon: Send, desc: "Employee Portal" },
          ].map((step, idx) => {
            const isCurrent = overallPayrollStage === step.stage;
            const isCompleted =
              (overallPayrollStage === "Paid" && step.stage !== "Payslip Generated") ||
              (overallPayrollStage === "Approved" && ["Draft", "Calculated", "Verified"].includes(step.stage)) ||
              (overallPayrollStage === "Verified" && ["Draft", "Calculated"].includes(step.stage)) ||
              (overallPayrollStage === "Calculated" && step.stage === "Draft");

            const StepIcon = step.icon;

            return (
              <div
                key={step.stage}
                className={cn(
                  "p-2.5 rounded-xl border text-left transition-all",
                  isCurrent
                    ? "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 shadow-2xs"
                    : isCompleted
                    ? "bg-slate-50 border-slate-200"
                    : "bg-white border-slate-200 opacity-60"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cn("text-[10px] font-bold uppercase", isCurrent ? "text-emerald-900 font-extrabold" : "text-slate-500")}>
                    {step.label}
                  </span>
                  <StepIcon className={cn("h-3.5 w-3.5", isCurrent ? "text-emerald-700" : "text-slate-400")} />
                </div>
                <p className="text-[10px] font-semibold text-slate-700 truncate mt-0.5">{step.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. 8 COMPREHENSIVE SUMMARY CARDS
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <HRKPICard
          label="Total Employees"
          value={`${metrics.totalEmployees}`}
          subtitle="Salaried Staff"
          tone="blue"
          icon={<Users className="h-5 w-5" />}
        />
        <HRKPICard
          label="Processed Employees"
          value={`${metrics.processedEmployees}`}
          subtitle="Calculated Batch"
          tone="emerald"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <HRKPICard
          label="Pending Employees"
          value={`${metrics.pendingEmployees}`}
          subtitle="Awaiting Calculation"
          tone="amber"
          icon={<Clock className="h-5 w-5" />}
        />
        <HRKPICard
          label="Approved Employees"
          value={`${metrics.approvedEmployees}`}
          subtitle="Verified by HR"
          tone="purple"
          icon={<CheckSquare className="h-5 w-5" />}
        />
        <HRKPICard
          label="Paid Employees"
          value={`${metrics.paidEmployees}`}
          subtitle="Disbursed Salaried"
          tone="emerald"
          icon={<Landmark className="h-5 w-5" />}
        />
        <HRKPICard
          label="Gross Payroll Amount"
          value={`₹${(metrics.grossPayroll / 100000).toFixed(2)}L`}
          subtitle="Earnings Subtotal"
          tone="purple"
          icon={<DollarSign className="h-5 w-5" />}
        />
        <HRKPICard
          label="Total Deductions"
          value={`₹${(metrics.totalDeductions / 100000).toFixed(2)}L`}
          subtitle="PF, ESI, Tax, Leaves"
          tone="rose"
          icon={<Calculator className="h-5 w-5" />}
        />
        <HRKPICard
          label="Net Payroll Amount"
          value={`₹${(metrics.netPayroll / 100000).toFixed(2)}L`}
          subtitle="Disbursement Amount"
          tone="emerald"
          icon={<CreditCard className="h-5 w-5" />}
        />
      </div>

      {/* ─────────────────────────────────────────────────────────────
          STEP 1: SELECT PAYROLL PERIOD & FILTERS TOOLBAR
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs mb-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            {/* Step 1: Payroll Month */}
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              disabled={isPayrollLocked}
              className="text-xs rounded-xl border border-slate-200 py-2 px-3 bg-white font-extrabold text-slate-800"
            >
              <option value="August">August</option>
              <option value="July">July</option>
              <option value="June">June</option>
            </select>

            {/* Step 1: Payroll Year */}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              disabled={isPayrollLocked}
              className="text-xs rounded-xl border border-slate-200 py-2 px-3 bg-white font-extrabold text-slate-800"
            >
              <option value="2026">2026</option>
              <option value="2025">2025</option>
            </select>

            {/* Department Filter */}
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="text-xs rounded-xl border border-slate-200 py-2 px-3 bg-white font-semibold text-slate-800"
            >
              <option value="ALL">All Departments</option>
              <option value="Front Office">Front Office</option>
              <option value="Housekeeping">Housekeeping</option>
              <option value="Food & Beverage">Food &amp; Beverage</option>
            </select>

            {/* Employment Type Filter */}
            <select
              value={selectedEmpType}
              onChange={(e) => setSelectedEmpType(e.target.value)}
              className="text-xs rounded-xl border border-slate-200 py-2 px-3 bg-white font-semibold text-slate-800"
            >
              <option value="ALL">All Employment Types</option>
              <option value="Permanent">Permanent</option>
              <option value="Contract">Contract</option>
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-xs rounded-xl border border-slate-200 py-2 px-3 bg-white font-semibold text-slate-800"
            >
              <option value="ALL">All Statuses</option>
              <option value="Draft">🟡 Draft</option>
              <option value="Calculated">🔵 Calculated</option>
              <option value="Approved">🟢 Approved</option>
              <option value="Paid">🔒 Paid</option>
            </select>

            {/* Search Input */}
            <div className="relative flex-1 min-w-[160px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search Employee..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-slate-50/50 font-medium text-slate-800"
              />
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            disabled={isGenerating || isPayrollLocked}
            onClick={handleCalculatePayroll}
            className="rounded-xl text-xs font-extrabold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs cursor-pointer"
          >
            <Play className="mr-1.5 h-3.5 w-3.5 fill-current" />
            {isGenerating ? "Processing..." : "Process / Calculate Payroll"}
          </Button>
        </div>

        {/* Step 5: Bulk Actions Bar */}
        {selectedRecordIds.length > 0 && !isPayrollLocked && (
          <div className="p-3 rounded-2xl bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2 text-xs animate-in fade-in shadow-xl">
            <span className="font-extrabold text-amber-400 flex items-center gap-1.5">
              <CheckSquare className="h-4 w-4 text-emerald-400" />
              {selectedRecordIds.length} Employees Selected
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={handleBulkCalculate}
                className="rounded-xl text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 py-1.5 h-8"
              >
                <Calculator className="mr-1 h-3.5 w-3.5 text-blue-400" />
                Calculate Selected
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleBulkApprove}
                className="rounded-xl text-[11px] font-bold bg-emerald-700 hover:bg-emerald-800 text-white py-1.5 h-8"
              >
                <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-200" />
                Approve Selected
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleBulkMarkPaid}
                className="rounded-xl text-[11px] font-bold bg-blue-700 hover:bg-blue-800 text-white py-1.5 h-8"
              >
                <Landmark className="mr-1 h-3.5 w-3.5 text-blue-200" />
                Mark Selected as Paid
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleGenerateAllPayslips}
                className="rounded-xl text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white py-1.5 h-8"
              >
                <FileText className="mr-1 h-3.5 w-3.5 text-amber-100" />
                Generate Payslips
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          STEP 3: EMPLOYEE PAYROLL PREVIEW TABLE
      ───────────────────────────────────────────────────────────── */}
      {/* Desktop Table */}
      <div className="hidden sm:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="py-3.5 px-3 w-10 text-center">
                  <button type="button" onClick={handleSelectAll} className="text-slate-500">
                    {selectedRecordIds.length === filteredRecords.length && filteredRecords.length > 0 ? (
                      <CheckSquare className="h-4 w-4 text-emerald-700" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                </th>
                <th className="py-3.5 px-4">Employee</th>
                <th className="py-3.5 px-4">Department</th>
                <th className="py-3.5 px-4">Gross Salary</th>
                <th className="py-3.5 px-4">Earnings Subtotal</th>
                <th className="py-3.5 px-4">Deductions</th>
                <th className="py-3.5 px-4">Net Salary</th>
                <th className="py-3.5 px-4">Payroll Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.map((r) => {
                const isExpanded = expandedRecordIds.includes(r.id);
                const isSelected = selectedRecordIds.includes(r.id);

                return (
                  <React.Fragment key={r.id}>
                    <tr
                      className={`hover:bg-slate-50/80 transition ${
                        isSelected ? "bg-emerald-50/40" : ""
                      }`}
                    >
                      <td className="py-3.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleSelectRecord(r.id)}
                          className="text-slate-500"
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-emerald-700" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleExpandRow(r.id)}
                            className="p-1 hover:bg-slate-200 rounded-md text-slate-500"
                          >
                            <ChevronDown
                              className={`h-3.5 w-3.5 transition-transform ${
                                isExpanded ? "rotate-180" : ""
                              }`}
                            />
                          </button>
                          <HREmployeeCell
                            name={r.employeeName}
                            id={r.employeeId}
                            avatar={r.avatar}
                            photoUrl={r.photoUrl}
                          />
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {r.department}
                      </td>

                      <td className="py-3.5 px-4 font-black text-slate-900">
                        ₹{r.grossSalary.toLocaleString("en-IN")}
                      </td>

                      <td className="py-3.5 px-4 font-bold text-emerald-800">
                        ₹{r.earningsTotal.toLocaleString("en-IN")}
                      </td>

                      <td className="py-3.5 px-4 font-bold text-rose-700">
                        -₹{r.deductionsTotal.toLocaleString("en-IN")}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-black text-emerald-800 text-sm">
                          ₹{r.netSalary.toLocaleString("en-IN")}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        {r.status === "Verified" && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            🔵 Verified
                          </span>
                        )}
                        {r.status === "Locked" && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-900 text-amber-400 border border-slate-700">
                            🔒 Locked
                          </span>
                        )}
                        {r.status !== "Verified" && r.status !== "Locked" && (
                          <StatusBadge status={r.status} />
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {renderPayrollActionMenu(r)}
                      </td>
                    </tr>

                    {/* EXPANDABLE SALARY DETAILS (STEP 2 CALCULATED COMPONENTS) */}
                    {isExpanded && (
                      <tr className="bg-slate-50/90 border-b border-slate-200">
                        <td colSpan={9} className="p-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            <div className="p-3 bg-white rounded-xl border border-slate-200">
                              <span className="font-extrabold text-slate-900 block mb-1">Base Earnings</span>
                              <p className="flex justify-between"><span>Basic Salary:</span> <strong className="text-slate-900">₹{r.basicSalary.toLocaleString("en-IN")}</strong></p>
                              <p className="flex justify-between"><span>HRA:</span> <strong className="text-slate-900">₹{r.hra.toLocaleString("en-IN")}</strong></p>
                              <p className="flex justify-between"><span>Allowances:</span> <strong className="text-slate-900">₹{r.allowances.toLocaleString("en-IN")}</strong></p>
                            </div>

                            <div className="p-3 bg-white rounded-xl border border-emerald-200 bg-emerald-50/20">
                              <span className="font-extrabold text-emerald-950 block mb-1">Variable Earnings</span>
                              <p className="flex justify-between"><span>Overtime Pay:</span> <strong className="text-emerald-800">+₹{r.overtimePay.toLocaleString("en-IN")}</strong></p>
                              <p className="flex justify-between"><span>Holiday Pay:</span> <strong className="text-emerald-800">+₹{r.holidayPay.toLocaleString("en-IN")}</strong></p>
                              <p className="flex justify-between"><span>Incentives &amp; Bonus:</span> <strong className="text-emerald-800">+₹{(r.incentives + r.bonus).toLocaleString("en-IN")}</strong></p>
                            </div>

                            <div className="p-3 bg-white rounded-xl border border-rose-200 bg-rose-50/20">
                              <span className="font-extrabold text-rose-950 block mb-1">Statutory Deductions</span>
                              <p className="flex justify-between"><span>Leave Deduction:</span> <strong className="text-rose-700">₹{r.leaveDeduction.toLocaleString("en-IN")}</strong></p>
                              <p className="flex justify-between"><span>PF &amp; ESI:</span> <strong className="text-rose-700">₹{(r.pfDeduction + r.esiDeduction).toLocaleString("en-IN")}</strong></p>
                              <p className="flex justify-between"><span>PT &amp; TDS:</span> <strong className="text-rose-700">₹{(r.ptDeduction + r.tdsDeduction).toLocaleString("en-IN")}</strong></p>
                            </div>

                            <div className="p-3 bg-slate-900 text-white rounded-xl flex flex-col justify-between">
                              <div>
                                <span className="text-[10px] text-slate-400 font-bold block uppercase">Net Salary Payable</span>
                                <span className="text-xl font-black text-amber-400">₹{r.netSalary.toLocaleString("en-IN")}</span>
                              </div>
                              <p className="text-[10px] text-slate-400">Status: {r.status}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="sm:hidden space-y-3">
        {filteredRecords.map((r) => (
          <div key={r.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <HREmployeeCell name={r.employeeName} id={r.employeeId} avatar={r.avatar} photoUrl={r.photoUrl} />
              <div className="flex items-center gap-2">
                <StatusBadge status={r.status} />
                {renderPayrollActionMenu(r)}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Gross Salary:</span>
                <span className="font-bold text-slate-900">₹{r.grossSalary.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Deductions:</span>
                <span className="font-bold text-rose-700">-₹{r.deductionsTotal.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1 font-black">
                <span className="text-slate-700">Net Salary:</span>
                <span className="text-emerald-800 text-sm">₹{r.netSalary.toLocaleString("en-IN")}</span>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button type="button" variant="outline" size="sm" onClick={() => setViewingRecord(r)} className="text-xs font-bold">
                View Payroll
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODAL: EDIT ADJUSTMENTS MODAL
      ───────────────────────────────────────────────────────────── */}
      {editingRecord && (
        <Modal
          isOpen={Boolean(editingRecord)}
          onClose={() => setEditingRecord(null)}
          title={`Edit Payroll Adjustments: ${editingRecord.employeeName}`}
          description={`Override earnings or deductions for ${selectedMonth} ${selectedYear}.`}
          size="lg"
        >
          <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <HREmployeeCell
                name={editingRecord.employeeName}
                id={editingRecord.employeeId}
                avatar={editingRecord.avatar}
                photoUrl={editingRecord.photoUrl}
                department={editingRecord.department}
              />
            </div>

            {/* Earnings Breakdown */}
            <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-3">
              <span className="font-extrabold text-emerald-950 block uppercase">Earnings Components (₹)</span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Basic Salary</label>
                  <input type="number" value={editBasic} onChange={(e) => setEditBasic(Number(e.target.value))} className="w-full rounded-xl border border-slate-200 p-2 font-bold bg-white" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">HRA</label>
                  <input type="number" value={editHra} onChange={(e) => setEditHra(Number(e.target.value))} className="w-full rounded-xl border border-slate-200 p-2 font-bold bg-white" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Allowances</label>
                  <input type="number" value={editAllowances} onChange={(e) => setEditAllowances(Number(e.target.value))} className="w-full rounded-xl border border-slate-200 p-2 font-bold bg-white" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Overtime Pay (OT)</label>
                  <input type="number" value={editOT} onChange={(e) => setEditOT(Number(e.target.value))} className="w-full rounded-xl border border-slate-200 p-2 font-bold bg-white" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Incentives</label>
                  <input type="number" value={editIncentives} onChange={(e) => setEditIncentives(Number(e.target.value))} className="w-full rounded-xl border border-slate-200 p-2 font-bold bg-white" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Bonus</label>
                  <input type="number" value={editBonus} onChange={(e) => setEditBonus(Number(e.target.value))} className="w-full rounded-xl border border-slate-200 p-2 font-bold bg-white" />
                </div>
              </div>
            </div>

            {/* Deductions Breakdown */}
            <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/40 space-y-3">
              <span className="font-extrabold text-rose-950 block uppercase">Deduction Components (₹)</span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Leave Deduction</label>
                  <input type="number" value={editLeaveDed} onChange={(e) => setEditLeaveDed(Number(e.target.value))} className="w-full rounded-xl border border-slate-200 p-2 font-bold bg-white" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Provident Fund (PF)</label>
                  <input type="number" value={editPf} onChange={(e) => setEditPf(Number(e.target.value))} className="w-full rounded-xl border border-slate-200 p-2 font-bold bg-white" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Professional Tax (PT)</label>
                  <input type="number" value={editPt} onChange={(e) => setEditPt(Number(e.target.value))} className="w-full rounded-xl border border-slate-200 p-2 font-bold bg-white" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">TDS / Income Tax</label>
                  <input type="number" value={editTds} onChange={(e) => setEditTds(Number(e.target.value))} className="w-full rounded-xl border border-slate-200 p-2 font-bold bg-white" />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditingRecord(null)} className="rounded-xl text-xs">
                Cancel
              </Button>
              <Button type="submit" size="sm" className="rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white">
                Save Adjustments
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ─────────────────────────────────────────────────────────────
          STEP 6: MARK AS PAID MODAL
      ───────────────────────────────────────────────────────────── */}
      {isMarkAsPaidModalOpen && (
        <Modal
          isOpen={isMarkAsPaidModalOpen}
          onClose={() => setIsMarkAsPaidModalOpen(false)}
          title={`Mark Salary Payment: ${selectedMonth} ${selectedYear}`}
          description="Record bank disbursement details to transition payroll status to Paid."
          size="md"
        >
          <form onSubmit={handleMarkAsPaidSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Payment Date</label>
              <input
                type="text"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2.5 font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Payment Reference Number</label>
              <input
                type="text"
                required
                value={paymentRefNo}
                onChange={(e) => setPaymentRefNo(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2.5 font-mono font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Bank Transfer Reference</label>
              <input
                type="text"
                required
                value={bankRefNo}
                onChange={(e) => setBankRefNo(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2.5 font-mono font-bold text-slate-900"
              />
            </div>

            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 font-medium">
              This action will freeze all {records.length} salary records, transition status to <strong>Paid</strong>, and enable automatic payslip emailing.
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsMarkAsPaidModalOpen(false)} className="rounded-xl text-xs">
                Cancel
              </Button>
              <Button type="submit" size="sm" className="rounded-xl text-xs font-bold bg-blue-700 hover:bg-blue-800 text-white">
                Confirm Disbursement &amp; Mark as Paid
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* AUDIT LOG MODAL */}
      {isAuditModalOpen && (
        <Modal
          isOpen={isAuditModalOpen}
          onClose={() => setIsAuditModalOpen(false)}
          title="Payroll Audit History"
          size="lg"
        >
          <div className="space-y-3 max-h-[65vh] overflow-y-auto text-xs pr-1">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900">{log.action}</span>
                  <span className="text-[10px] font-mono text-slate-400">{log.changedOn}</span>
                </div>
                <p className="text-slate-600">By: <strong>{log.changedBy}</strong></p>
                {log.auditNotes && <p className="text-slate-500 italic">"{log.auditNotes}"</p>}
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* VIEW PAYROLL DRAWER */}
      <Drawer
        isOpen={Boolean(viewingRecord)}
        onClose={() => setViewingRecord(null)}
        title="View Payroll"
        icon={<Calculator className="h-5 w-5 text-emerald-700" />}
      >
        {viewingRecord && (
          <div className="space-y-4 text-xs">
            <HREmployeeCell
              name={viewingRecord.employeeName}
              id={viewingRecord.employeeId}
              avatar={viewingRecord.avatar}
              photoUrl={viewingRecord.photoUrl}
              department={viewingRecord.department}
              designation={viewingRecord.designation}
            />

            <div className="grid grid-cols-2 gap-2 p-3.5 rounded-xl border border-slate-200 bg-slate-50">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500">Record ID</span>
                <p className="font-mono font-bold text-slate-900">{viewingRecord.id}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500">Employee ID</span>
                <p className="font-mono font-bold text-slate-900">{viewingRecord.employeeId}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500">Payroll Month</span>
                <p className="font-bold text-slate-900">{viewingRecord.payrollMonth}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500">Payroll Year</span>
                <p className="font-bold text-slate-900">{viewingRecord.payrollYear}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500">Status</span>
                <p className="font-bold text-slate-900">{viewingRecord.status}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500">Period</span>
                <p className="font-bold text-slate-900">
                  {formatPayrollPeriod(viewingRecord.payrollMonth, viewingRecord.payrollYear)}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500">Calculated At</span>
                <p className="font-semibold text-slate-700">{formatTimestamp(viewingRecord.calculatedAt)}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500">Approved At</span>
                <p className="font-semibold text-slate-700">{formatTimestamp(viewingRecord.approvedAt)}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500">Created At</span>
                <p className="font-semibold text-slate-700">{formatTimestamp(viewingRecord.createdAt)}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500">Updated At</span>
                <p className="font-semibold text-slate-700">{formatTimestamp(viewingRecord.updatedAt)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-xl border border-slate-200 bg-white">
                <span className="text-[10px] font-bold uppercase text-slate-500">Gross Salary</span>
                <p className="text-lg font-black text-slate-900">₹{viewingRecord.grossSalary.toLocaleString("en-IN")}</p>
              </div>
              <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/40">
                <span className="text-[10px] font-bold uppercase text-emerald-700">Earnings Total</span>
                <p className="text-lg font-black text-emerald-900">₹{viewingRecord.earningsTotal.toLocaleString("en-IN")}</p>
              </div>
              <div className="p-3 rounded-xl border border-rose-200 bg-rose-50/40">
                <span className="text-[10px] font-bold uppercase text-rose-700">Deductions Total</span>
                <p className="text-lg font-black text-rose-900">₹{viewingRecord.deductionsTotal.toLocaleString("en-IN")}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 text-white">
                <span className="text-[10px] font-bold uppercase text-slate-400">Net Salary</span>
                <p className="text-lg font-black text-amber-400">₹{viewingRecord.netSalary.toLocaleString("en-IN")}</p>
              </div>
            </div>

            {/* Earnings Breakdown */}
            <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-1.5">
              <div className="flex justify-between items-center border-b border-emerald-200 pb-1">
                <span className="font-extrabold text-emerald-950 uppercase text-[11px]">Earnings Breakdown</span>
                <span className="font-extrabold text-emerald-900 text-xs">₹{viewingRecord.earningsTotal.toLocaleString("en-IN")}</span>
              </div>
              <p className="flex justify-between text-slate-600"><span>Basic Salary:</span> <strong>₹{viewingRecord.basicSalary.toLocaleString("en-IN")}</strong></p>
              <p className="flex justify-between text-slate-600"><span>HRA:</span> <strong>₹{viewingRecord.hra.toLocaleString("en-IN")}</strong></p>
              <p className="flex justify-between text-slate-600"><span>Allowances:</span> <strong>₹{viewingRecord.allowances.toLocaleString("en-IN")}</strong></p>
              <p className="flex justify-between text-emerald-800"><span>Overtime:</span> <strong>+₹{viewingRecord.overtimePay.toLocaleString("en-IN")}</strong></p>
              <p className="flex justify-between text-emerald-800"><span>Holiday Pay:</span> <strong>+₹{viewingRecord.holidayPay.toLocaleString("en-IN")}</strong></p>
              <p className="flex justify-between text-emerald-800"><span>Incentives:</span> <strong>+₹{viewingRecord.incentives.toLocaleString("en-IN")}</strong></p>
              {viewingRecord.bonus > 0 && (
                <p className="flex justify-between text-emerald-800"><span>Bonus:</span> <strong>+₹{viewingRecord.bonus.toLocaleString("en-IN")}</strong></p>
              )}
            </div>

            {/* Deductions Breakdown */}
            <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/40 space-y-1.5">
              <div className="flex justify-between items-center border-b border-rose-200 pb-1">
                <span className="font-extrabold text-rose-950 uppercase text-[11px]">Deductions Breakdown</span>
                <span className="font-extrabold text-rose-900 text-xs">-₹{viewingRecord.deductionsTotal.toLocaleString("en-IN")}</span>
              </div>
              <p className="flex justify-between text-slate-600"><span>PF (Provident Fund):</span> <strong>₹{viewingRecord.pfDeduction.toLocaleString("en-IN")}</strong></p>
              <p className="flex justify-between text-slate-600"><span>ESI Insurance:</span> <strong>₹{viewingRecord.esiDeduction.toLocaleString("en-IN")}</strong></p>
              <p className="flex justify-between text-slate-600"><span>Professional Tax (PT):</span> <strong>₹{viewingRecord.ptDeduction.toLocaleString("en-IN")}</strong></p>
              <p className="flex justify-between text-slate-600"><span>TDS (Income Tax):</span> <strong>₹{viewingRecord.tdsDeduction.toLocaleString("en-IN")}</strong></p>
              <p className="flex justify-between text-rose-800"><span>Leave Deductions:</span> <strong>₹{viewingRecord.leaveDeduction.toLocaleString("en-IN")}</strong></p>
            </div>

            {salaryPayments.filter((p) => p.payrollId === viewingRecord.id).length > 0 && (
              <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/40 space-y-2">
                <span className="font-extrabold text-blue-950 uppercase text-[11px] block">Salary Payments</span>
                {salaryPayments
                  .filter((p) => p.payrollId === viewingRecord.id)
                  .map((payment) => (
                    <div key={payment.id} className="p-2.5 rounded-lg bg-white border border-blue-100 space-y-1">
                      <div className="flex justify-between">
                        <span className="font-mono font-bold text-slate-900">{payment.id}</span>
                        <span className="font-bold text-blue-800">{payment.status}</span>
                      </div>
                      <p className="flex justify-between"><span>Amount:</span> <strong>₹{payment.amount.toLocaleString("en-IN")}</strong></p>
                      <p className="flex justify-between"><span>Payment Date:</span> <strong>{payment.paymentDate}</strong></p>
                      <p className="flex justify-between"><span>Mode:</span> <strong>{payment.paymentMode}</strong></p>
                      <p className="flex justify-between"><span>Transaction Ref:</span> <strong className="font-mono">{payment.transactionReference}</strong></p>
                      {payment.remarks && <p className="text-slate-600 italic">"{payment.remarks}"</p>}
                      <p className="text-[10px] text-slate-500">Recorded by {payment.recordedBy} · {formatTimestamp(payment.createdAt)}</p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* VIEW PAYSLIP MODAL */}
      {viewingPayslipRecord && (
        <Modal
          isOpen={Boolean(viewingPayslipRecord)}
          onClose={() => setViewingPayslipRecord(null)}
          title={`Payslip: ${viewingPayslipRecord.employeeName}`}
          description={`${formatPayrollPeriod(viewingPayslipRecord.payrollMonth, viewingPayslipRecord.payrollYear)} · ${viewingPayslipRecord.payrollId}`}
          size="xl"
        >
          <div className="space-y-4 text-xs">
            <div className="p-6 rounded-2xl border border-slate-300 bg-white space-y-4 shadow-sm">
              <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide">GRAND PALACE HOTEL &amp; RESORT</h2>
                  <p className="text-slate-500 text-[11px]">101 Beachfront Boulevard, Goa, India</p>
                </div>
                <div className="text-right">
                  <span className="px-3 py-1 bg-slate-900 text-amber-400 font-extrabold rounded-lg text-xs block">
                    PAYSLIP
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono block pt-1">{viewingPayslipRecord.payrollId}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="space-y-1">
                  <p><strong className="text-slate-900">Employee:</strong> {viewingPayslipRecord.employeeName}</p>
                  <p><strong className="text-slate-900">Employee ID:</strong> {viewingPayslipRecord.employeeId}</p>
                  <p><strong className="text-slate-900">Department:</strong> {viewingPayslipRecord.department}</p>
                  <p><strong className="text-slate-900">Designation:</strong> {viewingPayslipRecord.designation}</p>
                </div>
                <div className="space-y-1">
                  <p><strong className="text-slate-900">Pay Period:</strong> {formatPayrollPeriod(viewingPayslipRecord.payrollMonth, viewingPayslipRecord.payrollYear)}</p>
                  <p><strong className="text-slate-900">Record ID:</strong> {viewingPayslipRecord.id}</p>
                  <p><strong className="text-slate-900">Status:</strong> {viewingPayslipRecord.status}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border border-slate-200 rounded-xl overflow-hidden">
                <div className="border-r border-slate-200">
                  <div className="bg-emerald-100/70 p-2 font-extrabold text-emerald-950 uppercase border-b border-slate-200">
                    Earnings
                  </div>
                  <div className="p-3 space-y-1.5">
                    <div className="flex justify-between"><span>Basic Salary</span><span className="font-bold">₹{viewingPayslipRecord.basicSalary.toLocaleString("en-IN")}</span></div>
                    <div className="flex justify-between"><span>HRA</span><span className="font-bold">₹{viewingPayslipRecord.hra.toLocaleString("en-IN")}</span></div>
                    <div className="flex justify-between"><span>Allowances</span><span className="font-bold">₹{viewingPayslipRecord.allowances.toLocaleString("en-IN")}</span></div>
                    <div className="flex justify-between"><span>Overtime</span><span className="font-bold">+₹{viewingPayslipRecord.overtimePay.toLocaleString("en-IN")}</span></div>
                    <div className="flex justify-between border-t border-slate-200 pt-2 font-black">
                      <span>Total Earnings</span>
                      <span>₹{viewingPayslipRecord.earningsTotal.toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="bg-rose-100/70 p-2 font-extrabold text-rose-950 uppercase border-b border-slate-200">
                    Deductions
                  </div>
                  <div className="p-3 space-y-1.5">
                    <div className="flex justify-between"><span>PF &amp; ESI</span><span className="font-bold">₹{(viewingPayslipRecord.pfDeduction + viewingPayslipRecord.esiDeduction).toLocaleString("en-IN")}</span></div>
                    <div className="flex justify-between"><span>PT &amp; TDS</span><span className="font-bold">₹{(viewingPayslipRecord.ptDeduction + viewingPayslipRecord.tdsDeduction).toLocaleString("en-IN")}</span></div>
                    <div className="flex justify-between"><span>Leave</span><span className="font-bold">₹{viewingPayslipRecord.leaveDeduction.toLocaleString("en-IN")}</span></div>
                    <div className="flex justify-between border-t border-slate-200 pt-2 font-black">
                      <span>Total Deductions</span>
                      <span>₹{viewingPayslipRecord.deductionsTotal.toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 text-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Net Salary Payable</span>
                <span className="text-2xl font-black text-amber-400">₹{viewingPayslipRecord.netSalary.toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* RECORD PAYMENT MODAL (salary_payments) */}
      {recordingPaymentRecord && (
        <Modal
          isOpen={Boolean(recordingPaymentRecord)}
          onClose={() => setRecordingPaymentRecord(null)}
          title={`Record Payment: ${recordingPaymentRecord.employeeName}`}
          description={`Create a salary_payments entry for ${formatPayrollPeriod(recordingPaymentRecord.payrollMonth, recordingPaymentRecord.payrollYear)}.`}
          size="md"
        >
          <form onSubmit={handleSinglePaymentSubmit} className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <HREmployeeCell
                name={recordingPaymentRecord.employeeName}
                id={recordingPaymentRecord.employeeId}
                avatar={recordingPaymentRecord.avatar}
                photoUrl={recordingPaymentRecord.photoUrl}
                department={recordingPaymentRecord.department}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/80">
              <div>
                <label className="block font-bold text-slate-500 mb-1 uppercase text-[10px]">Payroll ID</label>
                <input
                  type="text"
                  readOnly
                  value={recordingPaymentRecord.id}
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-mono font-bold text-slate-700 bg-white"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1 uppercase text-[10px]">Employee ID</label>
                <input
                  type="text"
                  readOnly
                  value={recordingPaymentRecord.employeeId}
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-mono font-bold text-slate-700 bg-white"
                />
              </div>
              <div className="col-span-2">
                <label className="block font-bold text-slate-500 mb-1 uppercase text-[10px]">Recorded By</label>
                <input
                  type="text"
                  readOnly
                  value={PAYROLL_RECORDED_BY}
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-semibold text-slate-700 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Amount (₹)</label>
              <input
                type="number"
                required
                min={0}
                step={1}
                value={salaryPaymentForm.amount}
                onChange={(e) =>
                  setSalaryPaymentForm((prev) => ({ ...prev, amount: Number(e.target.value) }))
                }
                className="w-full rounded-xl border border-slate-200 p-2.5 font-black text-slate-900"
              />
              <p className="mt-1 text-[10px] text-slate-500">
                Net salary payable: ₹{recordingPaymentRecord.netSalary.toLocaleString("en-IN")}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Payment Date</label>
                <input
                  type="date"
                  required
                  value={salaryPaymentForm.paymentDate}
                  onChange={(e) =>
                    setSalaryPaymentForm((prev) => ({ ...prev, paymentDate: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-bold text-slate-900"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Payment Mode</label>
                <select
                  required
                  value={salaryPaymentForm.paymentMode}
                  onChange={(e) =>
                    setSalaryPaymentForm((prev) => ({
                      ...prev,
                      paymentMode: e.target.value as SalaryPaymentMode,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-bold text-slate-900 bg-white"
                >
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="NEFT">NEFT</option>
                  <option value="RTGS">RTGS</option>
                  <option value="UPI">UPI</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Transaction Reference</label>
              <input
                type="text"
                required
                placeholder="e.g. HDFC-TXN-987654321"
                value={salaryPaymentForm.transactionReference}
                onChange={(e) =>
                  setSalaryPaymentForm((prev) => ({ ...prev, transactionReference: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 p-2.5 font-mono font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Status</label>
              <select
                required
                value={salaryPaymentForm.status}
                onChange={(e) =>
                  setSalaryPaymentForm((prev) => ({
                    ...prev,
                    status: e.target.value as SalaryPaymentStatus,
                  }))
                }
                className="w-full rounded-xl border border-slate-200 p-2.5 font-bold text-slate-900 bg-white"
              >
                <option value="Completed">Completed</option>
                <option value="Pending">Pending</option>
                <option value="Failed">Failed</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Remarks</label>
              <textarea
                rows={3}
                placeholder="Optional notes about this disbursement..."
                value={salaryPaymentForm.remarks}
                onChange={(e) =>
                  setSalaryPaymentForm((prev) => ({ ...prev, remarks: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 p-2.5 font-medium text-slate-800 resize-none"
              />
            </div>

            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-950 font-medium">
              Workflow: <strong>Approve Payroll</strong> first, then record payment here. Payroll moves to{" "}
              <strong>Paid</strong> only when payment status is <strong>Completed</strong>.
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={() => setRecordingPaymentRecord(null)} className="rounded-xl text-xs">
                Cancel
              </Button>
              <Button type="submit" size="sm" className="rounded-xl text-xs font-bold bg-blue-700 hover:bg-blue-800 text-white">
                Record Payment
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </ModulePageShell>
  );
}
