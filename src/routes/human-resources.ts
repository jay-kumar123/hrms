import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireProperty } from "../middleware/property.js";
import { attachRequestContext } from "../middleware/request-context.js";
import { createTableCrud, mountCrud } from "../controllers/shared-crud.js";
import { hrTables } from "../models/human-resources/index.js";
import { listRows } from "../models/base.js";
import { getDashboard } from "../controllers/human-resources/dashboard.js";
import * as employees from "../controllers/human-resources/employees.js";
import * as payroll from "../controllers/human-resources/payroll.js";
import * as attendance from "../controllers/human-resources/attendance.js";
import * as leaves from "../controllers/human-resources/leaves.js";

const router = Router();

router.use(requireAuth);
router.use(requireProperty);
router.use(attachRequestContext);

router.get("/dashboard", getDashboard);

// Employees (enriched)
router.get("/employees", employees.listEmployees);
router.get("/employees/:id", employees.getEmployee);
router.post("/employees", employees.createEmployee);
router.put("/employees/:id", employees.updateEmployee);
router.patch("/employees/:id", employees.updateEmployee);
router.delete("/employees/:id", employees.deleteEmployee);

// Payroll ops
router.get("/payroll/audit-logs", payroll.listAuditLogs);
router.get("/payroll/records", payroll.listPayrollRecords);
router.get("/payroll/records/:id", payroll.getPayrollRecord);
router.post("/payroll/records", payroll.createPayrollRecord);
router.put("/payroll/records/:id", payroll.updatePayrollRecord);
router.patch("/payroll/records/:id", payroll.updatePayrollRecord);
router.post("/payroll/records/:id/approve", payroll.approvePayrollRecord);
router.post("/payroll/records/:id/payments", payroll.recordSalaryPayment);
// Attendance Daily Helper Route

// Attendance Ops

// Leave Ops

// Safe Holiday Attendance Route (Gracefully handles missing table)
router.get("/holiday-attendance", async (_req, res) => {
  try {
    const rows = await listRows(hrTables.attendanceRecords, {
      filters: { holiday_worked: true },
      orderBy: "attendance_date",
    });
    res.json({ success: true, data: rows || [] });
  } catch {
    res.json({ success: true, data: [] });
  }
});

router.post("/leave-applications", leaves.createLeaveApplication);
router.post("/leave-applications/preview-days", leaves.previewLeaveDays);
router.post("/leave-applications/:id/approve", leaves.approveLeave);
router.post("/leave-applications/:id/cancel", leaves.cancelLeave);
router.post("/leave-applications/:id/modify", leaves.modifyLeave);

router.get("/attendance/employee/:employeeId", attendance.getEmployeeAttendance);
router.post("/attendance/punch-in", attendance.punchIn);
router.post("/attendance/punch-out", attendance.punchOut);
router.post("/attendance/process-absence", attendance.processAbsence);
router.post("/attendance/:id/correct", attendance.correctAttendance);
router.post("/attendance/:id/recalculate", attendance.correctAttendance);

router.get("/attendance/daily", async (req, res, next) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const rows = await listRows(hrTables.attendanceRecords, {
      filters: { attendance_date: date },
      orderBy: "attendance_date",
    });
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});


// Masters & operational CRUD
const crudRoutes: { path: string; table: string; prefix: string; orderBy?: string }[] = [
  { path: "/masters/departments", table: hrTables.departments, prefix: "HRD", orderBy: "dept_code" },
  { path: "/masters/designations", table: hrTables.designations, prefix: "HRDS", orderBy: "designation_code" },
  { path: "/masters/employment-types", table: hrTables.employmentTypes, prefix: "HRET", orderBy: "type_code" },
  { path: "/masters/shift-types", table: hrTables.shiftTypes, prefix: "HRST", orderBy: "shift_code" },
  { path: "/masters/leave-types", table: hrTables.leaveTypes, prefix: "HRLT", orderBy: "leave_code" },
  { path: "/masters/leave-policies", table: hrTables.leavePolicies, prefix: "HRLP", orderBy: "policy_code" },
  { path: "/masters/holidays", table: hrTables.holidays, prefix: "HRH", orderBy: "holiday_date" },
  { path: "/masters/salary-components", table: hrTables.salaryComponents, prefix: "HRSC", orderBy: "code" },
  { path: "/masters/document-categories", table: hrTables.documentCategories, prefix: "HRDC", orderBy: "name" },
  { path: "/masters/document-types", table: hrTables.documentTypes, prefix: "HRDT", orderBy: "name" },
  { path: "/attendance", table: hrTables.attendanceRecords, prefix: "HRA", orderBy: "attendance_date" },
  { path: "/shift-assignments", table: hrTables.shiftAssignments, prefix: "HRSA", orderBy: "effective_from" },
  { path: "/weekly-offs", table: hrTables.weeklyOffs, prefix: "HRWO", orderBy: "effective_from" },
  { path: "/leave-applications", table: hrTables.leaveApplications, prefix: "HRLA", orderBy: "applied_on" },
  { path: "/overtime", table: hrTables.overtimeRecords, prefix: "HROT", orderBy: "record_date" },
  { path: "/holiday-attendance", table: hrTables.holidayAttendanceRecords, prefix: "HRHA", orderBy: "holiday_date" },
  { path: "/salary-structures", table: hrTables.salaryStructures, prefix: "HRSS", orderBy: "name" },
  { path: "/salary-payments", table: hrTables.salaryPayments, prefix: "HRSP", orderBy: "payment_date" },
  { path: "/payslips", table: hrTables.payslips, prefix: "HRPS", orderBy: "generated_date" },
  { path: "/complaint-categories", table: hrTables.complaintCategories, prefix: "HRCC", orderBy: "category_name" },
  { path: "/complaints", table: hrTables.complaints, prefix: "HRC", orderBy: "submitted_date" },
  { path: "/approval-workflows", table: hrTables.approvalWorkflows, prefix: "HRAW", orderBy: "code" },
  { path: "/tax/rules", table: hrTables.taxRules, prefix: "HRTX", orderBy: "tax_code" },
];

for (const cfg of crudRoutes) {
  mountCrud(
    router,
    cfg.path,
    createTableCrud({
      table: cfg.table,
      idPrefix: cfg.prefix,
      orderBy: cfg.orderBy,
    }),
  );
}

// Payroll settings (singleton per property)
const settingsCrud = createTableCrud({
  table: hrTables.payrollSettings,
  idPrefix: "HRSET",
});
router.get("/payroll/settings", settingsCrud.list);
router.get("/payroll/settings/:id", settingsCrud.get);
router.post("/payroll/settings", settingsCrud.create);
router.put("/payroll/settings/:id", settingsCrud.update);
router.patch("/payroll/settings/:id", settingsCrud.update);

export default router;
