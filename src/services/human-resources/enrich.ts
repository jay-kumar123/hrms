import { hrModel, hrTables } from "../../models/human-resources/index.js";
import { getActivePropertyId } from "../../utils/request-context.js";

type Dept = { id: string; departmentName: string };
type Desig = { id: string; designationTitle: string };
type EmpType = { id: string; typeName: string };
type Shift = { id: string; shiftName: string };
type Employee = {
  id: string;
  empCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  departmentId?: string;
  designationId?: string;
  employmentTypeId?: string;
  shiftTypeId?: string;
  joinDate?: string;
  salary?: number;
  status: string;
  gender?: string;
  avatar?: string;
  photoUrl?: string;
  attendanceRate?: number;
  leaveBalance?: { casual?: number; sick?: number; earned?: number };
  [key: string]: unknown;
};

type LookupCaches = {
  departments: Map<string, string>;
  designations: Map<string, string>;
  employmentTypes: Map<string, string>;
  shiftTypes: Map<string, string>;
};

const lookupCachesByProperty = new Map<string, LookupCaches>();

function cacheKey(): string {
  return getActivePropertyId() ?? "__none__";
}

async function loadLookups(force = false): Promise<LookupCaches> {
  const key = cacheKey();
  if (!force && lookupCachesByProperty.has(key)) {
    return lookupCachesByProperty.get(key)!;
  }

  const [depts, desigs, empTypes, shifts] = await Promise.all([
    hrModel.list<Dept>(hrTables.departments).catch(() => []),
    hrModel.list<Desig>(hrTables.designations).catch(() => []),
    hrModel.list<EmpType>(hrTables.employmentTypes).catch(() => []),
    hrModel.list<Shift>(hrTables.shiftTypes).catch(() => []),
  ]);

  const caches: LookupCaches = {
    departments: new Map(
      depts.map((d: any) => [
        d.id,
        String(d.departmentName || d.name || d.department_name || d.dept_name || "").trim(),
      ])
    ),
    designations: new Map(
      desigs.map((d: any) => [
        d.id,
        String(d.designationTitle || d.designationName || d.designation_title || d.designation_name || d.title || d.name || "").trim(),
      ])
    ),
    employmentTypes: new Map(
      empTypes.map((d: any) => [
        d.id,
        String(d.typeName || d.type_name || d.name || d.workingTerm || d.title || "").trim(),
      ])
    ),
    shiftTypes: new Map(
      shifts.map((d: any) => [
        d.id,
        String(d.shiftName || d.shift_name || d.name || d.title || "").trim(),
      ])
    ),
  };

  lookupCachesByProperty.set(key, caches);
  return caches;
}

export function clearHrLookupCache(propertyId?: string) {
  if (propertyId) {
    lookupCachesByProperty.delete(propertyId);
    return;
  }
  lookupCachesByProperty.clear();
}

export async function enrichEmployee(emp: Employee) {
  let caches = await loadLookups();

  const resolve = (id: string | undefined, map: Map<string, string>) => {
    if (!id) return "";
    return map.get(id) ?? "";
  };

  let department = resolve(emp.departmentId, caches.departments);
  let designation = resolve(emp.designationId, caches.designations);
  let employmentType = resolve(emp.employmentTypeId, caches.employmentTypes);
  let shiftType = resolve(emp.shiftTypeId, caches.shiftTypes);

  // Self-heal stale/empty cache (e.g. first load before RLS patch or property switch).
  if (
    (emp.departmentId && !department) ||
    (emp.designationId && !designation) ||
    (emp.employmentTypeId && !employmentType) ||
    (emp.shiftTypeId && !shiftType)
  ) {
    caches = await loadLookups(true);
    department = resolve(emp.departmentId, caches.departments);
    designation = resolve(emp.designationId, caches.designations);
    employmentType = resolve(emp.employmentTypeId, caches.employmentTypes);
    shiftType = resolve(emp.shiftTypeId, caches.shiftTypes);
  }

  const deptFallback = String(emp.department || "");
  const desigFallback = String(emp.designation || "");
  const empTypeFallback = String(emp.employmentType || (emp as any).employment_type || "");

  return {
    ...emp,
    empCode: String(emp.empCode || (emp as any).employeeCode || (emp as any).employee_code || emp.id || ""),
    name: `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || String((emp as any).name || "Employee"),
    department: department || (deptFallback.startsWith("a100") ? resolve(deptFallback, caches.departments) || deptFallback : deptFallback) || "General",
    designation: designation || (desigFallback.startsWith("b200") ? resolve(desigFallback, caches.designations) || desigFallback : desigFallback) || "Staff",
    employmentType: employmentType || (empTypeFallback.startsWith("c300") ? resolve(empTypeFallback, caches.employmentTypes) || empTypeFallback : empTypeFallback) || "Full Time",
    shiftType: shiftType || "Morning Shift",
  };
}

export async function enrichEmployees(rows: Employee[]) {
  await loadLookups();
  return Promise.all(rows.map((e) => enrichEmployee(e)));
}

type PayrollRow = {
  id: string;
  employeeId: string;
  payrollMonth: number;
  payrollYear: number;
  payrollBatchId?: string;
  grossSalary: number;
  earningsTotal: number;
  deductionsTotal: number;
  netSalary: number;
  status: string;
  calculatedAt?: string;
  approvedAt?: string;
  earningsBreakdown?: Record<string, number>;
  deductionsBreakdown?: Record<string, number>;
  validationFlags?: Record<string, boolean>;
  payslipGenerated?: boolean;
  createdAt: string;
  updatedAt: string;
};

export async function enrichPayrollRecord(row: PayrollRow) {
  const emp = await hrModel.get<Employee>(hrTables.employees, row.employeeId);
  const enriched = emp ? await enrichEmployee(emp) : null;
  const earnings = row.earningsBreakdown ?? {};
  const deductions = row.deductionsBreakdown ?? {};
  return {
    ...row,
    payrollId: row.payrollBatchId ?? `PAY-${row.payrollYear}-${String(row.payrollMonth).padStart(2, "0")}`,
    employeeName: enriched?.name ?? "",
    department: enriched?.department ?? "",
    designation: enriched?.designation ?? "",
    avatar: enriched?.avatar ?? "",
    photoUrl: enriched?.photoUrl,
    basicSalary: earnings.basicSalary ?? 0,
    hra: earnings.hra ?? 0,
    allowances: earnings.allowances ?? 0,
    overtimePay: earnings.overtimePay ?? 0,
    holidayPay: earnings.holidayPay ?? 0,
    incentives: earnings.incentives ?? 0,
    bonus: earnings.bonus ?? 0,
    otherEarnings: earnings.otherEarnings ?? 0,
    leaveDeduction: deductions.leaveDeduction ?? 0,
    pfDeduction: deductions.pfDeduction ?? 0,
    esiDeduction: deductions.esiDeduction ?? 0,
    ptDeduction: deductions.ptDeduction ?? 0,
    tdsDeduction: deductions.tdsDeduction ?? 0,
    otherDeductions: deductions.otherDeductions ?? 0,
    hasAttendanceIssue: row.validationFlags?.hasAttendanceIssue,
    missingBankDetails: row.validationFlags?.missingBankDetails,
    missingSalaryStructure: row.validationFlags?.missingSalaryStructure,
    missingPan: row.validationFlags?.missingPan,
    pendingLeaveApproval: row.validationFlags?.pendingLeaveApproval,
    pendingOtApproval: row.validationFlags?.pendingOtApproval,
  };
}

export async function enrichPayrollRecords(rows: PayrollRow[]) {
  return Promise.all(rows.map((r) => enrichPayrollRecord(r)));
}

export function splitEmployeePayload(body: Record<string, unknown>) {
  const earningsBreakdown = {
    basicSalary: body.basicSalary,
    hra: body.hra,
    allowances: body.allowances,
    overtimePay: body.overtimePay,
    holidayPay: body.holidayPay,
    incentives: body.incentives,
    bonus: body.bonus,
    otherEarnings: body.otherEarnings,
  };
  const deductionsBreakdown = {
    leaveDeduction: body.leaveDeduction,
    pfDeduction: body.pfDeduction,
    esiDeduction: body.esiDeduction,
    ptDeduction: body.ptDeduction,
    tdsDeduction: body.tdsDeduction,
    otherDeductions: body.otherDeductions,
  };
  const validationFlags = {
    hasAttendanceIssue: body.hasAttendanceIssue,
    missingBankDetails: body.missingBankDetails,
    missingSalaryStructure: body.missingSalaryStructure,
    missingPan: body.missingPan,
    pendingLeaveApproval: body.pendingLeaveApproval,
    pendingOtApproval: body.pendingOtApproval,
  };
  return { earningsBreakdown, deductionsBreakdown, validationFlags };
}

export function mapPayrollIncoming(body: Record<string, unknown>, isCreate: boolean) {
  const next = { ...body };
  const { earningsBreakdown, deductionsBreakdown, validationFlags } = splitEmployeePayload(body);
  if (Object.values(earningsBreakdown).some((v) => v !== undefined)) {
    next.earningsBreakdown = earningsBreakdown;
  }
  if (Object.values(deductionsBreakdown).some((v) => v !== undefined)) {
    next.deductionsBreakdown = deductionsBreakdown;
  }
  if (Object.values(validationFlags).some((v) => v !== undefined)) {
    next.validationFlags = validationFlags;
  }
  [
    "basicSalary", "hra", "allowances", "overtimePay", "holidayPay", "incentives", "bonus", "otherEarnings",
    "leaveDeduction", "pfDeduction", "esiDeduction", "ptDeduction", "tdsDeduction", "otherDeductions",
    "hasAttendanceIssue", "missingBankDetails", "missingSalaryStructure", "missingPan",
    "pendingLeaveApproval", "pendingOtApproval", "employeeName", "department", "designation", "avatar", "photoUrl", "payrollId",
  ].forEach((k) => delete next[k]);
  if (isCreate && !next.status) next.status = "Draft";
  return next;
}
