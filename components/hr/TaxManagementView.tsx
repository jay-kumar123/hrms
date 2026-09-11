"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Percent,
  Search,
  Users,
  DollarSign,
  CheckCircle2,
  Plus,
  Printer,
  SlidersHorizontal,
  X,
  FileSpreadsheet,
  FileText,
  ShieldCheck,
  Calculator,
  Building2,
  Award,
  Upload,
  Eye,
  Edit,
  CheckCircle,
  XCircle,
  FileCheck,
  History,
  AlertCircle,
  Lock,
  Layers,
  ChevronRight,
  ChevronDown,
  Trash2,
  Info,
  CheckSquare,
} from "lucide-react";
import { ModulePageShell } from "@/components/pms";
import { Button, Drawer, Modal, StatusBadge } from "@/components/ui";
import { HRKPICard } from "@/components/hr/shared/HRKPICard";
import { HREmployeeCell } from "@/components/hr/shared/HREmployeeCell";
import { cn } from "@/lib/utils";
import { hrTaxRuleService } from "@/services/human-resources";
import { mapTaxRuleFromApi, mapTaxRuleToApi } from "@/lib/hr/api-mappers";

// ─────────────────────────────────────────────────────────────
// DATA TYPES & INTERFACES
// ─────────────────────────────────────────────────────────────

export type TaxCalculationMethod = "Percentage" | "Fixed Amount" | "Slab Based";
export type ApplicableBase =
  | "Gross Salary"
  | "Basic Salary"
  | "Taxable Income"
  | "Specific Salary Components"
  | "Other Configured Base";

export interface TaxSlab {
  fromAmount: number;
  toAmount: number; // 0 for Infinity / Unlimited
  ratePercentage: number;
}

export interface TaxRuleVersion {
  version: number;
  oldRateOrSlab: string;
  newRateOrSlab: string;
  effectiveFrom: string;
  changedBy: string;
  changedOn: string;
}

export interface ConfigurableTaxRule {
  id: string;
  ruleName: string;
  taxCode: string;
  taxType: string; // e.g. TDS, Professional Tax, ESI, Custom Tax
  description: string;
  calcMethod: TaxCalculationMethod;
  
  // Method specific parameters
  ratePercentage?: number;
  taxableBase?: string;
  fixedAmount?: number;
  applicableFrequency?: "Monthly" | "Annual" | "Per Payroll";
  slabs?: TaxSlab[];

  applicableOn: ApplicableBase;
  
  // Priority / Applicability Filters (Optional)
  department?: string;
  employmentType?: string;
  employeeCategory?: string;
  taxRegime?: "New Tax Regime" | "Old Tax Regime" | "All";
  financialYear: string;

  effectiveFrom: string;
  effectiveTo?: string;
  status: "Active" | "Inactive";
  version: number;

  createdBy: string;
  createdDate: string;
  history?: TaxRuleVersion[];
}

export interface EmployeeTaxDeclaration {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  designation: string;
  avatar: string;
  photoUrl?: string;
  panNo: string;
  regime: "New Tax Regime" | "Old Tax Regime";
  declaredAmount: number;
  verifiedAmount: number;
  status: "Verified" | "Pending Verification" | "Rejected";
  proofDocuments: string[];
  rejectionReason?: string;
  lastUpdatedBy?: string;
  lastUpdatedOn?: string;
}

export interface TaxExemptionRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  avatar: string;
  exemptionCategory: "HRA" | "80C" | "LTA" | "Medical Insurance (80D)" | "Education Allowance" | "Other Eligible Exemptions";
  declaredAmount: number;
  approvedAmount: number;
  status: "Approved" | "Pending" | "Rejected";
  supportingDocument: string;
  notes?: string;
}

export interface TaxCalculationPreview {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  avatar: string;
  photoUrl?: string;
  taxRegime: "New Tax Regime" | "Old Tax Regime";
  grossIncome: number;
  eligibleDeductions: number;
  approvedExemptions: number;
  taxableIncome: number;
  applicableRuleId: string;
  applicableRuleName: string;
  calculatedTax: number;
  finalTaxPayable: number;
  effectivePeriod: string;
  status: "Calculated" | "Pending Approval" | "Locked";
}

export interface TaxAuditLogEntry {
  id: string;
  user: string;
  dateTime: string;
  action:
    | "Rule Created"
    | "Rule Modified"
    | "Rule Activated"
    | "Rule Deactivated"
    | "Declaration Verified"
    | "Declaration Rejected"
    | "Exemption Approved"
    | "Exemption Rejected"
    | "Tax Rule Version Changed";
  previousValue?: string;
  newValue?: string;
  details: string;
}

export function TaxManagementView() {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const loadTaxRules = async () => {
    try {
      const rows = await hrTaxRuleService.list();
      setTaxRules(rows.map(mapTaxRuleFromApi));
      setDeclarations([]);
      setExemptions([]);
      setAuditLogs([]);
    } catch (e) {
      console.warn(e);
      setTaxRules([]);
    }
  };

  useEffect(() => {
    void loadTaxRules();
  }, []);


  const [activeTab, setActiveTab] = useState<"rules" | "declarations" | "exemptions" | "calculations" | "audit">("rules");

  // Filters State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTaxType, setSelectedTaxType] = useState("ALL");
  const [selectedCalcMethod, setSelectedCalcMethod] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedYear, setSelectedYear] = useState("FY 2026-27");
  const [selectedDept, setSelectedDept] = useState("ALL");
  const [selectedRegime, setSelectedRegime] = useState("ALL");
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  // Data State
  const [taxRules, setTaxRules] = useState<ConfigurableTaxRule[]>([]);
  const [declarations, setDeclarations] = useState<EmployeeTaxDeclaration[]>([]);
  const [exemptions, setExemptions] = useState<TaxExemptionRecord[]>([]);
  const [calculations] = useState<TaxCalculationPreview[]>([]);
  const [auditLogs, setAuditLogs] = useState<TaxAuditLogEntry[]>([]);

  // Modals & Drawers State
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ConfigurableTaxRule | null>(null);
  const [viewingRule, setViewingRule] = useState<ConfigurableTaxRule | null>(null);

  const [verifyingDeclaration, setVerifyingDeclaration] = useState<EmployeeTaxDeclaration | null>(null);
  const [verifyAmount, setVerifyAmount] = useState(0);
  const [rejectionReason, setRejectionReason] = useState("");

  const [verifyingExemption, setVerifyingExemption] = useState<TaxExemptionRecord | null>(null);
  const [approvedExemptionAmount, setApprovedExemptionAmount] = useState(0);

  const [viewingCalculationBreakdown, setViewingCalculationBreakdown] = useState<TaxCalculationPreview | null>(null);

  // Add/Edit Rule Form State
  const [formRuleName, setFormRuleName] = useState("");
  const [formTaxCode, setFormTaxCode] = useState("");
  const [formTaxType, setFormTaxType] = useState("Income Tax / TDS");
  const [formDesc, setFormDesc] = useState("");
  const [formCalcMethod, setFormCalcMethod] = useState<TaxCalculationMethod>("Percentage");
  const [formRatePct, setFormRatePct] = useState(10);
  const [formTaxableBase, setFormTaxableBase] = useState("Net Taxable Salary");
  const [formFixedAmt, setFormFixedAmt] = useState(200);
  const [formAppFreq, setFormAppFreq] = useState<"Monthly" | "Annual" | "Per Payroll">("Monthly");
  const [formSlabs, setFormSlabs] = useState<TaxSlab[]>([
    { fromAmount: 0, toAmount: 300000, ratePercentage: 0 },
    { fromAmount: 300001, toAmount: 700000, ratePercentage: 5 },
    { fromAmount: 700001, toAmount: 1000000, ratePercentage: 10 },
  ]);
  const [formApplicableOn, setFormApplicableOn] = useState<ApplicableBase>("Taxable Income");
  const [formDept, setFormDept] = useState("ALL");
  const [formEmpType, setFormEmpType] = useState("ALL");
  const [formRegime, setFormRegime] = useState<"New Tax Regime" | "Old Tax Regime" | "All">("All");
  const [formFinYear, setFormFinYear] = useState("FY 2026-27");
  const [formEffectiveFrom, setFormEffectiveFrom] = useState("01/04/2026");
  const [formEffectiveTo, setFormEffectiveTo] = useState("");
  const [formStatus, setFormStatus] = useState<"Active" | "Inactive">("Active");

  // Audit helper
  const addAuditEntry = (action: TaxAuditLogEntry["action"], details: string, prev?: string, newVal?: string) => {
    const entry: TaxAuditLogEntry = {
      id: `TL-${Math.floor(10 + Math.random() * 90)}`,
      user: "Neha Mehta (HR Admin)",
      dateTime: new Date().toLocaleString("en-GB"),
      action,
      details,
      previousValue: prev,
      newValue: newVal,
    };
    setAuditLogs((prevLogs) => [entry, ...prevLogs]);
  };

  // Metrics
  const metrics = useMemo(() => {
    const employeesUnderTax = calculations.length + 124; // 126
    const totalTdsMonth = calculations.reduce((sum, c) => sum + c.finalTaxPayable, 240000);
    const pendingDeclarations = declarations.filter((d) => d.status === "Pending Verification").length + exemptions.filter(e => e.status === "Pending").length;
    const activeTaxRules = taxRules.filter((r) => r.status === "Active").length;
    return { employeesUnderTax, totalTdsMonth, pendingDeclarations, activeTaxRules };
  }, [calculations, declarations, exemptions, taxRules]);

  // Open Create Modal
  const handleOpenCreateRuleModal = () => {
    setEditingRule(null);
    setFormRuleName("");
    setFormTaxCode(`TAX-${Math.floor(100 + Math.random() * 900)}`);
    setFormTaxType("Income Tax / TDS");
    setFormDesc("");
    setFormCalcMethod("Percentage");
    setFormRatePct(10);
    setFormTaxableBase("Net Taxable Salary");
    setFormFixedAmt(200);
    setFormAppFreq("Monthly");
    setFormSlabs([
      { fromAmount: 0, toAmount: 300000, ratePercentage: 0 },
      { fromAmount: 300001, toAmount: 700000, ratePercentage: 5 },
      { fromAmount: 700001, toAmount: 1000000, ratePercentage: 10 },
    ]);
    setFormApplicableOn("Taxable Income");
    setFormDept("ALL");
    setFormEmpType("ALL");
    setFormRegime("All");
    setFormFinYear("FY 2026-27");
    setFormEffectiveFrom(new Date().toLocaleDateString("en-GB"));
    setFormEffectiveTo("");
    setFormStatus("Active");
    setIsRuleModalOpen(true);
  };

  // Open Edit Modal (Version creation)
  const handleOpenEditRuleModal = (rule: ConfigurableTaxRule) => {
    setEditingRule(rule);
    setFormRuleName(rule.ruleName);
    setFormTaxCode(rule.taxCode);
    setFormTaxType(rule.taxType);
    setFormDesc(rule.description);
    setFormCalcMethod(rule.calcMethod);
    setFormRatePct(rule.ratePercentage || 10);
    setFormTaxableBase(rule.taxableBase || "Net Taxable Salary");
    setFormFixedAmt(rule.fixedAmount || 200);
    setFormAppFreq(rule.applicableFrequency || "Monthly");
    setFormSlabs(rule.slabs || [
      { fromAmount: 0, toAmount: 300000, ratePercentage: 0 },
      { fromAmount: 300001, toAmount: 700000, ratePercentage: 5 },
    ]);
    setFormApplicableOn(rule.applicableOn);
    setFormDept(rule.department || "ALL");
    setFormEmpType(rule.employmentType || "ALL");
    setFormRegime(rule.taxRegime || "All");
    setFormFinYear(rule.financialYear);
    setFormEffectiveFrom(rule.effectiveFrom);
    setFormEffectiveTo(rule.effectiveTo || "");
    setFormStatus(rule.status);
    setIsRuleModalOpen(true);
  };

  // Add / Remove Slabs Handlers
  const handleAddSlab = () => {
    const lastSlab = formSlabs[formSlabs.length - 1];
    const newFrom = lastSlab ? lastSlab.toAmount + 1 : 0;
    setFormSlabs([...formSlabs, { fromAmount: newFrom, toAmount: newFrom + 300000, ratePercentage: (lastSlab?.ratePercentage || 0) + 5 }]);
  };

  const handleRemoveSlab = (index: number) => {
    setFormSlabs(formSlabs.filter((_, i) => i !== index));
  };

  const handleSlabChange = (index: number, field: keyof TaxSlab, value: number) => {
    const updated = [...formSlabs];
    updated[index] = { ...updated[index], [field]: value };
    setFormSlabs(updated);
  };

  // Save Rule (Creates version if editing)
  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRuleName.trim()) return;

    const payload = mapTaxRuleToApi({
      ruleName: formRuleName,
      taxCode: formTaxCode,
      taxType: formTaxType,
      description: formDesc,
      calcMethod: formCalcMethod,
      ratePercentage: formRatePct,
      taxableBase: formTaxableBase,
      fixedAmount: formFixedAmt,
      applicableFrequency: formAppFreq,
      slabs: formSlabs,
      applicableOn: formApplicableOn,
      department: formDept === "ALL" ? undefined : formDept,
      employmentType: formEmpType === "ALL" ? undefined : formEmpType,
      taxRegime: formRegime,
      financialYear: formFinYear,
      effectiveFrom: formEffectiveFrom,
      effectiveTo: formEffectiveTo || undefined,
      status: formStatus,
      version: editingRule ? editingRule.version + 1 : 1,
      createdBy: editingRule?.createdBy ?? "HR Admin",
    });

    try {
      if (editingRule) {
        await hrTaxRuleService.update(editingRule.id, payload);
        setToastMessage(`Tax Rule "${formRuleName}" updated successfully.`);
      } else {
        await hrTaxRuleService.create(payload);
        setToastMessage(`Tax Rule "${formRuleName}" created successfully.`);
      }
      await loadTaxRules();
      setIsRuleModalOpen(false);
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : "Failed to save tax rule");
    }
  };

  const handleToggleRuleStatus = async (rule: ConfigurableTaxRule) => {
    const newStatus = rule.status === "Active" ? "Inactive" : "Active";
    try {
      await hrTaxRuleService.update(rule.id, { status: newStatus });
      await loadTaxRules();
      setToastMessage(`Tax Rule "${rule.ruleName}" is now ${newStatus}.`);
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : "Failed to update tax rule status");
    }
  };

  // Verify / Reject Declaration
  const handleVerifyDeclaration = (d: EmployeeTaxDeclaration, isApproved: boolean) => {
    if (isApproved) {
      setDeclarations((prev) =>
        prev.map((item) =>
          item.id === d.id
            ? { ...item, verifiedAmount: verifyAmount, status: "Verified", lastUpdatedBy: "Neha Mehta (HR Admin)", lastUpdatedOn: new Date().toLocaleDateString("en-GB") }
            : item
        )
      );
      addAuditEntry("Declaration Verified", `Verified investment declaration for ${d.employeeName}. Verified: ₹${verifyAmount.toLocaleString("en-IN")}.`, `Pending (₹${d.declaredAmount})`, `Verified (₹${verifyAmount})`);
      setToastMessage(`Verified declaration for ${d.employeeName}. Approved ₹${verifyAmount.toLocaleString("en-IN")}.`);
    } else {
      setDeclarations((prev) =>
        prev.map((item) =>
          item.id === d.id
            ? { ...item, status: "Rejected", rejectionReason, lastUpdatedBy: "Neha Mehta (HR Admin)", lastUpdatedOn: new Date().toLocaleDateString("en-GB") }
            : item
        )
      );
      addAuditEntry("Declaration Rejected", `Rejected investment declaration for ${d.employeeName}. Reason: ${rejectionReason}`, "Pending Verification", "Rejected");
      setToastMessage(`Rejected declaration for ${d.employeeName}.`);
    }
    setVerifyingDeclaration(null);
  };

  // Verify Exemption
  const handleVerifyExemption = (ex: TaxExemptionRecord, isApproved: boolean) => {
    if (isApproved) {
      setExemptions((prev) =>
        prev.map((item) => (item.id === ex.id ? { ...item, approvedAmount: approvedExemptionAmount, status: "Approved" } : item))
      );
      addAuditEntry("Exemption Approved", `Approved ${ex.exemptionCategory} exemption for ${ex.employeeName}. Amount: ₹${approvedExemptionAmount.toLocaleString("en-IN")}`, `Pending (₹${ex.declaredAmount})`, `Approved (₹${approvedExemptionAmount})`);
      setToastMessage(`Approved exemption for ${ex.employeeName}.`);
    } else {
      setExemptions((prev) =>
        prev.map((item) => (item.id === ex.id ? { ...item, status: "Rejected" } : item))
      );
      addAuditEntry("Exemption Rejected", `Rejected ${ex.exemptionCategory} exemption for ${ex.employeeName}.`, "Pending", "Rejected");
      setToastMessage(`Rejected exemption for ${ex.employeeName}.`);
    }
    setVerifyingExemption(null);
  };

  return (
    <ModulePageShell
      eyebrow="Human Resource / Payroll"
      title="Tax Management"
      description="Central HR/Finance administration for configuring tax rules, calculation methods, slabs, exemption approvals, employee declarations, and tax audits."
      breadcrumbs={[
        { label: "Human Resource", href: "/human-resources/dashboard" },
        { label: "Payroll" },
        { label: "Tax Management" },
      ]}
      toast={toastMessage}
      onDismissToast={() => setToastMessage(null)}
      secondaryActions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleOpenCreateRuleModal}
            className="rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs cursor-pointer"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Tax Rule
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setToastMessage("Exporting tax compliance report...")}
            className="rounded-xl text-xs font-semibold bg-white text-slate-700 border-slate-300 shadow-xs"
          >
            <Printer className="h-3.5 w-3.5 mr-1 text-slate-500" />
            Export Tax Report
          </Button>
        </div>
      }
    >
      {/* ─────────────────────────────────────────────────────────────
          SECTION 1: 4 DASHBOARD KPI CARDS
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <HRKPICard
          label="Active Tax Rules"
          value={`${metrics.activeTaxRules}`}
          subtitle="Configured Rules"
          tone="purple"
          icon={<Percent className="h-5 w-5" />}
        />
        <HRKPICard
          label="Employees Under Tax"
          value={`${metrics.employeesUnderTax}`}
          subtitle="Taxable Salary Staff"
          tone="blue"
          icon={<Users className="h-5 w-5" />}
        />
        <HRKPICard
          label="Total Tax This Month"
          value={`₹${(metrics.totalTdsMonth / 100000).toFixed(2)}L`}
          subtitle="TDS & PT Deduction"
          tone="emerald"
          icon={<DollarSign className="h-5 w-5" />}
        />
        <HRKPICard
          label="Pending Approvals"
          value={`${metrics.pendingDeclarations}`}
          subtitle="Declarations & Exemptions"
          tone="amber"
          icon={<AlertCircle className="h-5 w-5" />}
        />
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 2: TAB NAVIGATION & REUSABLE FILTER BAR
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-1.5 p-1.5 bg-white border border-slate-200 rounded-2xl shadow-xs overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("rules")}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition cursor-pointer",
              activeTab === "rules" ? "bg-emerald-700 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <Percent className="h-4 w-4" /> 1. Tax Rules Configuration
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("declarations")}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition cursor-pointer",
              activeTab === "declarations" ? "bg-emerald-700 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <FileCheck className="h-4 w-4" /> 2. Employee Declarations
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("exemptions")}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition cursor-pointer",
              activeTab === "exemptions" ? "bg-emerald-700 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <ShieldCheck className="h-4 w-4" /> 3. Tax Exemptions
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("calculations")}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition cursor-pointer",
              activeTab === "calculations" ? "bg-emerald-700 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <Calculator className="h-4 w-4" /> 4. Tax Calculation Preview
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition cursor-pointer",
              activeTab === "audit" ? "bg-emerald-700 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <History className="h-4 w-4" /> 5. Audit Log
          </button>
        </div>
      </div>

      {/* FILTER BAR TOOLBAR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs mb-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search Rules / Employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-slate-50/50 font-medium text-slate-800"
              />
            </div>

            <select
              value={selectedTaxType}
              onChange={(e) => setSelectedTaxType(e.target.value)}
              className="text-xs rounded-xl border border-slate-200 py-1.5 px-3 bg-white font-semibold text-slate-800"
            >
              <option value="ALL">All Tax Types</option>
              <option value="Income Tax / TDS">Income Tax / TDS</option>
              <option value="Professional Tax">Professional Tax</option>
              <option value="ESI">ESI</option>
            </select>

            <select
              value={selectedCalcMethod}
              onChange={(e) => setSelectedCalcMethod(e.target.value)}
              className="text-xs rounded-xl border border-slate-200 py-1.5 px-3 bg-white font-semibold text-slate-800"
            >
              <option value="ALL">All Calculation Methods</option>
              <option value="Percentage">Percentage</option>
              <option value="Fixed Amount">Fixed Amount</option>
              <option value="Slab Based">Slab Based</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-xs rounded-xl border border-slate-200 py-1.5 px-3 bg-white font-semibold text-slate-800"
            >
              <option value="ALL">All Statuses</option>
              <option value="Active">Active / Verified</option>
              <option value="Inactive">Inactive / Pending</option>
            </select>

            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setSelectedTaxType("ALL");
                setSelectedCalcMethod("ALL");
                setSelectedStatus("ALL");
              }}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline px-2"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: TAX RULES CONFIGURATION
      ───────────────────────────────────────────────────────────── */}
      {activeTab === "rules" && (
        <div className="space-y-4">
          <div className="hidden sm:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Rule Name &amp; Code</th>
                    <th className="py-3.5 px-4">Tax Type</th>
                    <th className="py-3.5 px-4">Calc Method &amp; Rate</th>
                    <th className="py-3.5 px-4">Applicable Base</th>
                    <th className="py-3.5 px-4">Effective Dates</th>
                    <th className="py-3.5 px-4">Version</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {taxRules
                    .filter((r) => {
                      const matchSearch = r.ruleName.toLowerCase().includes(searchTerm.toLowerCase()) || r.taxCode.toLowerCase().includes(searchTerm.toLowerCase());
                      const matchType = selectedTaxType === "ALL" || r.taxType === selectedTaxType;
                      const matchCalc = selectedCalcMethod === "ALL" || r.calcMethod === selectedCalcMethod;
                      const matchStatus = selectedStatus === "ALL" || r.status === selectedStatus;
                      return matchSearch && matchType && matchCalc && matchStatus;
                    })
                    .map((rule) => (
                      <tr key={rule.id} className="hover:bg-slate-50/80 transition cursor-pointer" onClick={() => setViewingRule(rule)}>
                        <td className="py-3.5 px-4">
                          <p className="font-extrabold text-slate-900 text-sm">{rule.ruleName}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{rule.id} • Code: {rule.taxCode}</p>
                        </td>

                        <td className="py-3.5 px-4 font-extrabold text-slate-800">
                          <span className="px-2.5 py-0.5 rounded-lg text-xs bg-blue-100 text-blue-900 border border-blue-200">
                            {rule.taxType}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-extrabold text-slate-900 block">{rule.calcMethod}</span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            {rule.calcMethod === "Percentage" && `${rule.ratePercentage}% of ${rule.taxableBase}`}
                            {rule.calcMethod === "Fixed Amount" && `₹${rule.fixedAmount} (${rule.applicableFrequency})`}
                            {rule.calcMethod === "Slab Based" && `${rule.slabs?.length || 0} Progressive Slabs`}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 font-semibold text-slate-700">
                          {rule.applicableOn}
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-slate-900">{rule.effectiveFrom}</p>
                          <p className="text-[10px] text-slate-400">To: {rule.effectiveTo || "Present"}</p>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-900 text-amber-400 border border-slate-700">
                            v{rule.version}
                          </span>
                        </td>

                        <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleToggleRuleStatus(rule)}
                            className="cursor-pointer"
                          >
                            <StatusBadge status={rule.status} />
                          </button>
                        </td>

                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setViewingRule(rule)}
                              className="rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              <Eye className="h-3.5 w-3.5 mr-1 text-slate-500" /> View
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenEditRuleModal(rule)}
                              className="rounded-xl text-xs font-semibold text-emerald-800 border-emerald-300 hover:bg-emerald-50"
                            >
                              <Edit className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Edit (New Ver)
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="sm:hidden space-y-3">
            {taxRules.map((rule) => (
              <div key={rule.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-extrabold text-slate-900">{rule.ruleName}</p>
                    <span className="text-[10px] text-slate-400 font-mono">v{rule.version} • {rule.taxType}</span>
                  </div>
                  <StatusBadge status={rule.status} />
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Calculation Method:</span>
                    <span className="font-bold text-slate-900">{rule.calcMethod}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Applicable On:</span>
                    <span className="font-bold text-emerald-800">{rule.applicableOn}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setViewingRule(rule)} className="w-full text-xs font-bold">
                    View Slabs
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => handleOpenEditRuleModal(rule)} className="w-full text-xs font-bold text-emerald-800">
                    Edit Rule
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: EMPLOYEE TAX DECLARATIONS
      ───────────────────────────────────────────────────────────── */}
      {activeTab === "declarations" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Employee</th>
                  <th className="py-3.5 px-4">PAN Number</th>
                  <th className="py-3.5 px-4">Tax Regime</th>
                  <th className="py-3.5 px-4">Declared Amount</th>
                  <th className="py-3.5 px-4">Verified Amount</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {declarations.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4">
                      <HREmployeeCell name={d.employeeName} id={d.employeeId} avatar={d.avatar} photoUrl={d.photoUrl} department={d.department} />
                    </td>

                    <td className="py-3.5 px-4 font-mono font-extrabold text-slate-900">{d.panNo}</td>

                    <td className="py-3.5 px-4">
                      <span className={cn("px-2.5 py-0.5 rounded-lg text-[11px] font-bold", d.regime === "New Tax Regime" ? "bg-purple-100 text-purple-900 border border-purple-200" : "bg-amber-100 text-amber-900 border border-amber-200")}>
                        {d.regime}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-bold text-slate-900">₹{d.declaredAmount.toLocaleString("en-IN")}</td>

                    <td className="py-3.5 px-4 font-extrabold text-emerald-800">₹{d.verifiedAmount.toLocaleString("en-IN")}</td>

                    <td className="py-3.5 px-4">
                      <StatusBadge status={d.status} />
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {d.status === "Pending Verification" ? (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            setVerifyingDeclaration(d);
                            setVerifyAmount(d.declaredAmount);
                          }}
                          className="rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white"
                        >
                          <CheckCircle className="h-3.5 w-3.5 mr-1" /> Review &amp; Verify
                        </Button>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Audited</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: TAX EXEMPTIONS
      ───────────────────────────────────────────────────────────── */}
      {activeTab === "exemptions" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Employee</th>
                  <th className="py-3.5 px-4">Exemption Category</th>
                  <th className="py-3.5 px-4">Declared Amount</th>
                  <th className="py-3.5 px-4">Approved Amount</th>
                  <th className="py-3.5 px-4">Supporting Document</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {exemptions.map((ex) => (
                  <tr key={ex.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4">
                      <HREmployeeCell name={ex.employeeName} id={ex.employeeId} avatar={ex.avatar} department={ex.department} />
                    </td>

                    <td className="py-3.5 px-4 font-extrabold text-slate-900">
                      <span className="px-2.5 py-0.5 rounded-lg text-xs bg-emerald-100 text-emerald-900 border border-emerald-200">
                        {ex.exemptionCategory}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-bold text-slate-800">₹{ex.declaredAmount.toLocaleString("en-IN")}</td>

                    <td className="py-3.5 px-4 font-extrabold text-emerald-800">₹{ex.approvedAmount.toLocaleString("en-IN")}</td>

                    <td className="py-3.5 px-4 font-mono text-slate-600 text-[11px]">{ex.supportingDocument}</td>

                    <td className="py-3.5 px-4">
                      <StatusBadge status={ex.status} />
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {ex.status === "Pending" ? (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            setVerifyingExemption(ex);
                            setApprovedExemptionAmount(ex.declaredAmount);
                          }}
                          className="rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white"
                        >
                          Approve Exemption
                        </Button>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Participating in Tax</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 4: TAX CALCULATION PREVIEW
      ───────────────────────────────────────────────────────────── */}
      {activeTab === "calculations" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Employee</th>
                  <th className="py-3.5 px-4">Tax Regime</th>
                  <th className="py-3.5 px-4">Taxable Income</th>
                  <th className="py-3.5 px-4">Applicable Tax Rule</th>
                  <th className="py-3.5 px-4 font-extrabold text-right">Final Tax Payable</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {calculations.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition cursor-pointer" onClick={() => setViewingCalculationBreakdown(c)}>
                    <td className="py-3.5 px-4">
                      <HREmployeeCell name={c.employeeName} id={c.employeeId} avatar={c.avatar} photoUrl={c.photoUrl} department={c.department} />
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-purple-900">{c.taxRegime}</td>

                    <td className="py-3.5 px-4 font-black text-blue-900 text-sm">₹{c.taxableIncome.toLocaleString("en-IN")}</td>

                    <td className="py-3.5 px-4 font-bold text-slate-800">{c.applicableRuleName}</td>

                    <td className="py-3.5 px-4 font-black text-rose-900 text-sm text-right">
                      ₹{c.finalTaxPayable.toLocaleString("en-IN")}
                    </td>

                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setViewingCalculationBreakdown(c)}
                        className="rounded-xl text-xs font-semibold text-emerald-800 border-emerald-300 hover:bg-emerald-50"
                      >
                        <Calculator className="h-3.5 w-3.5 mr-1" /> View Breakdown
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 5: TAX AUDIT LOG
      ───────────────────────────────────────────────────────────── */}
      {activeTab === "audit" && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 text-xs">
          {auditLogs.map((log) => (
            <div key={log.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5 text-emerald-700" /> {log.action}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">{log.dateTime}</span>
              </div>
              <p className="text-slate-600 text-[11px]">User: <strong>{log.user}</strong></p>
              {log.previousValue && <p className="text-slate-500 text-[11px]">Previous: <span className="line-through">{log.previousValue}</span> $\rightarrow$ <strong>{log.newValue}</strong></p>}
              <p className="text-slate-500 italic pt-1 text-[11px]">"{log.details}"</p>
            </div>
          ))}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 1: ADD / EDIT CONFIGURABLE TAX RULE MODAL
      ───────────────────────────────────────────────────────────── */}
      {isRuleModalOpen && (
        <Modal
          isOpen={isRuleModalOpen}
          onClose={() => setIsRuleModalOpen(false)}
          title={editingRule ? `Edit Tax Rule: ${editingRule.ruleName} (Version ${editingRule.version + 1})` : "Add New Configurable Tax Rule"}
          description="Configure tax types, calculation methods, rates, progressive slabs, and target bases."
          size="lg"
        >
          <form onSubmit={handleSaveRule} className="space-y-4 text-xs max-h-[75vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tax Rule Name <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maharashtra Professional Tax"
                  value={formRuleName}
                  onChange={(e) => setFormRuleName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Tax Code</label>
                <input
                  type="text"
                  value={formTaxCode}
                  onChange={(e) => setFormTaxCode(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tax Type (Configurable) <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Income Tax / TDS, PT, ESI, Custom Tax"
                  value={formTaxType}
                  onChange={(e) => setFormTaxType(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Calculation Method <span className="text-rose-500">*</span></label>
                <select
                  value={formCalcMethod}
                  onChange={(e) => setFormCalcMethod(e.target.value as TaxCalculationMethod)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 bg-white font-bold"
                >
                  <option value="Percentage">Percentage</option>
                  <option value="Fixed Amount">Fixed Amount</option>
                  <option value="Slab Based">Slab Based</option>
                </select>
              </div>
            </div>

            {/* DYNAMIC FORM FIELDS BASED ON CALCULATION METHOD */}
            {formCalcMethod === "Percentage" && (
              <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200 grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-emerald-950 mb-1">Percentage Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formRatePct}
                    onChange={(e) => setFormRatePct(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 p-2.5 font-bold bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-emerald-950 mb-1">Taxable Base</label>
                  <input
                    type="text"
                    value={formTaxableBase}
                    onChange={(e) => setFormTaxableBase(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 font-bold bg-white"
                  />
                </div>
              </div>
            )}

            {formCalcMethod === "Fixed Amount" && (
              <div className="p-3.5 rounded-xl bg-blue-50/50 border border-blue-200 grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-blue-950 mb-1">Fixed Amount (₹)</label>
                  <input
                    type="number"
                    value={formFixedAmt}
                    onChange={(e) => setFormFixedAmt(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 p-2.5 font-bold bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-blue-950 mb-1">Applicable Frequency</label>
                  <select
                    value={formAppFreq}
                    onChange={(e) => setFormAppFreq(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 bg-white font-bold"
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Annual">Annual</option>
                    <option value="Per Payroll">Per Payroll</option>
                  </select>
                </div>
              </div>
            )}

            {formCalcMethod === "Slab Based" && (
              <div className="p-3.5 rounded-xl bg-purple-50/50 border border-purple-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-purple-950 uppercase text-[11px]">Configurable Tax Slabs</span>
                  <Button type="button" size="sm" variant="outline" onClick={handleAddSlab} className="h-7 text-[11px] font-bold bg-white text-purple-900 border-purple-300">
                    + Add Slab
                  </Button>
                </div>
                <div className="space-y-1.5">
                  {formSlabs.map((slab, idx) => (
                    <div key={idx} className="grid grid-cols-3 gap-2 items-center bg-white p-2 rounded-xl border border-purple-100">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block">From (₹)</span>
                        <input type="number" value={slab.fromAmount} onChange={(e) => handleSlabChange(idx, "fromAmount", Number(e.target.value))} className="w-full border rounded-lg p-1 text-xs font-bold" />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block">To (₹ 0 = Max)</span>
                        <input type="number" value={slab.toAmount} onChange={(e) => handleSlabChange(idx, "toAmount", Number(e.target.value))} className="w-full border rounded-lg p-1 text-xs font-bold" />
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="flex-1">
                          <span className="text-[10px] text-slate-400 font-bold block">Rate (%)</span>
                          <input type="number" value={slab.ratePercentage} onChange={(e) => handleSlabChange(idx, "ratePercentage", Number(e.target.value))} className="w-full border rounded-lg p-1 text-xs font-bold" />
                        </div>
                        {formSlabs.length > 1 && (
                          <button type="button" onClick={() => handleRemoveSlab(idx)} className="text-rose-500 hover:text-rose-700 p-1 mt-3">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* APPLICABLE ON & PRIORITY */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Applicable On</label>
                <select
                  value={formApplicableOn}
                  onChange={(e) => setFormApplicableOn(e.target.value as ApplicableBase)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 bg-white font-semibold"
                >
                  <option value="Gross Salary">Gross Salary</option>
                  <option value="Basic Salary">Basic Salary</option>
                  <option value="Taxable Income">Taxable Income</option>
                  <option value="Specific Salary Components">Specific Salary Components</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Effective Financial Year</label>
                <input type="text" value={formFinYear} onChange={(e) => setFormFinYear(e.target.value)} className="w-full rounded-xl border border-slate-200 p-2.5 font-bold" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Effective From <span className="text-rose-500">*</span></label>
                <input type="text" required value={formEffectiveFrom} onChange={(e) => setFormEffectiveFrom(e.target.value)} className="w-full rounded-xl border border-slate-200 p-2.5 font-bold" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Effective To</label>
                <input type="text" placeholder="Present / Open" value={formEffectiveTo} onChange={(e) => setFormEffectiveTo(e.target.value)} className="w-full rounded-xl border border-slate-200 p-2.5 font-bold" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsRuleModalOpen(false)} className="rounded-xl text-xs">
                Cancel
              </Button>
              <Button type="submit" size="sm" className="rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white">
                Save Tax Rule
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 2: VERIFY DECLARATION MODAL
      ───────────────────────────────────────────────────────────── */}
      {verifyingDeclaration && (
        <Modal
          isOpen={Boolean(verifyingDeclaration)}
          onClose={() => setVerifyingDeclaration(null)}
          title={`Review Tax Declaration: ${verifyingDeclaration.employeeName}`}
          size="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <p><strong>Employee:</strong> {verifyingDeclaration.employeeName} ({verifyingDeclaration.employeeId})</p>
              <p><strong>PAN:</strong> {verifyingDeclaration.panNo} | <strong>Regime:</strong> {verifyingDeclaration.regime}</p>
              <p><strong>Declared Investment:</strong> ₹{verifyingDeclaration.declaredAmount.toLocaleString("en-IN")}</p>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Verified Approved Amount (₹)</label>
              <input type="number" value={verifyAmount} onChange={(e) => setVerifyAmount(Number(e.target.value))} className="w-full rounded-xl border border-slate-200 p-2.5 font-black text-emerald-800" />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={() => handleVerifyDeclaration(verifyingDeclaration, false)} className="rounded-xl text-xs text-rose-700 border-rose-200">
                Reject Declaration
              </Button>
              <Button type="button" size="sm" onClick={() => handleVerifyDeclaration(verifyingDeclaration, true)} className="rounded-xl text-xs font-bold bg-emerald-700 text-white">
                Approve &amp; Verify
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─────────────────────────────────────────────────────────────
          DRAWER 1: VIEW TAX RULE & VERSION HISTORY
      ───────────────────────────────────────────────────────────── */}
      <Drawer isOpen={Boolean(viewingRule)} onClose={() => setViewingRule(null)} title="Tax Rule Configuration & History" icon={<Percent className="h-5 w-5 text-emerald-700" />}>
        {viewingRule && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-2">
              <div className="flex justify-between items-center">
                <h3 className="font-black text-sm">{viewingRule.ruleName}</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950">v{viewingRule.version}</span>
              </div>
              <p className="text-slate-400 text-[11px]">Type: {viewingRule.taxType} • Base: {viewingRule.applicableOn}</p>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5">
              <span className="font-extrabold text-slate-900 uppercase block text-[11px]">Configuration Details</span>
              <p className="flex justify-between"><span>Calculation Method:</span> <strong>{viewingRule.calcMethod}</strong></p>
              <p className="flex justify-between"><span>Effective Period:</span> <strong>{viewingRule.effectiveFrom} - {viewingRule.effectiveTo || "Present"}</strong></p>
              <p className="flex justify-between"><span>Financial Year:</span> <strong>{viewingRule.financialYear}</strong></p>
            </div>

            {viewingRule.slabs && viewingRule.slabs.length > 0 && (
              <div className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/40 space-y-2">
                <span className="font-extrabold text-purple-950 uppercase block text-[11px]">Progressive Tax Slabs</span>
                <div className="space-y-1">
                  {viewingRule.slabs.map((s, i) => (
                    <div key={i} className="flex justify-between bg-white p-2 rounded-lg border border-purple-100">
                      <span>₹{s.fromAmount.toLocaleString("en-IN")} - {s.toAmount > 0 ? `₹${s.toAmount.toLocaleString("en-IN")}` : "Max"}</span>
                      <strong className="text-purple-900">{s.ratePercentage}% Tax</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* VERSION HISTORY */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <span className="font-extrabold text-slate-900 uppercase block text-[11px]">Rule Version History</span>
              {viewingRule.history && viewingRule.history.length > 0 ? (
                <div className="space-y-1.5">
                  {viewingRule.history.map((h, idx) => (
                    <div key={idx} className="p-2 rounded-lg bg-white border border-slate-200 space-y-0.5">
                      <div className="flex justify-between font-bold text-slate-900">
                        <span>Version {h.version}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{h.changedOn}</span>
                      </div>
                      <p className="text-slate-600">Rate: <span className="line-through">{h.oldRateOrSlab}</span> $\rightarrow$ <strong>{h.newRateOrSlab}</strong></p>
                      <p className="text-[10px] text-slate-400">By: {h.changedBy}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 italic">No previous versions. Current version is v1.</p>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* ─────────────────────────────────────────────────────────────
          DRAWER 2: TAX CALCULATION BREAKDOWN DRAWER
      ───────────────────────────────────────────────────────────── */}
      <Drawer isOpen={Boolean(viewingCalculationBreakdown)} onClose={() => setViewingCalculationBreakdown(null)} title="Tax Calculation Breakdown" icon={<Calculator className="h-5 w-5 text-emerald-700" />}>
        {viewingCalculationBreakdown && (
          <div className="space-y-4 text-xs">
            <HREmployeeCell name={viewingCalculationBreakdown.employeeName} id={viewingCalculationBreakdown.employeeId} avatar={viewingCalculationBreakdown.avatar} photoUrl={viewingCalculationBreakdown.photoUrl} department={viewingCalculationBreakdown.department} />
            <div className="p-4 rounded-2xl bg-slate-900 text-white text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Final Tax Payable</span>
              <span className="text-2xl font-black text-amber-400">₹{viewingCalculationBreakdown.finalTaxPayable.toLocaleString("en-IN")}</span>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
              <span className="font-extrabold text-slate-950 uppercase block text-[11px]">Step-by-Step Calculation</span>
              <p className="flex justify-between"><span>Gross Annual Income:</span> <strong>₹{viewingCalculationBreakdown.grossIncome.toLocaleString("en-IN")}</strong></p>
              <p className="flex justify-between text-rose-700"><span>- Eligible Deductions:</span> <strong>-₹{viewingCalculationBreakdown.eligibleDeductions.toLocaleString("en-IN")}</strong></p>
              <p className="flex justify-between text-rose-700"><span>- Approved Exemptions:</span> <strong>-₹{viewingCalculationBreakdown.approvedExemptions.toLocaleString("en-IN")}</strong></p>
              <div className="flex justify-between border-t border-slate-200 pt-1 font-extrabold text-blue-900">
                <span>= Net Taxable Income:</span>
                <span>₹{viewingCalculationBreakdown.taxableIncome.toLocaleString("en-IN")}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-1">
              <span className="font-bold text-emerald-950 uppercase block text-[11px]">Applied Tax Rule</span>
              <p className="font-extrabold text-slate-900">{viewingCalculationBreakdown.applicableRuleName}</p>
              <p className="text-slate-600">Tax Regime: <strong>{viewingCalculationBreakdown.taxRegime}</strong></p>
            </div>
          </div>
        )}
      </Drawer>
    </ModulePageShell>
  );
}
