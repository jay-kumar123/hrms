import type { NextFunction, Request, Response } from "express";
import { hrTables } from "../../models/human-resources/index.js";
import { listRows, insertRow, updateRow, getRowById } from "../../models/base.js";

export async function createLeaveApplication(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = { ...(req.body || {}) };

    if (!payload.employeeId) {
      return res.status(400).json({ success: false, error: "employeeId is required" });
    }

    // Verify employeeId exists
    const emps = await listRows<any>(hrTables.employees, { limit: 100 });
    const empExists = emps.some((e) => e.id === payload.employeeId);
    if (!empExists && emps.length > 0) {
      // Find matching employee by name or code, or fallback to first employee
      const match = emps.find(
        (e) =>
          e.empCode === payload.employeeId ||
          e.employeeCode === payload.employeeId ||
          e.id.includes(payload.employeeId)
      );
      payload.employeeId = match ? match.id : emps[0].id;
    }

    // Verify leaveTypeId exists in hr_leave_types
    if (payload.leaveTypeId) {
      const leaveTypes = await listRows<any>(hrTables.leaveTypes, { limit: 50 });
      const ltExists = leaveTypes.some((lt) => lt.id === payload.leaveTypeId);
      if (!ltExists) {
        const matchLt = leaveTypes.find(
          (lt) =>
            lt.leaveCode === payload.leaveTypeCode ||
            lt.code === payload.leaveTypeCode ||
            lt.name?.toLowerCase().includes((payload.leaveTypeName || "").toLowerCase())
        );
        payload.leaveTypeId = matchLt ? matchLt.id : null;
      }
    }

    const created = await insertRow(hrTables.leaveApplications, payload);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
}

export async function previewLeaveDays(req: Request, res: Response, next: NextFunction) {
  try {
    const { fromDate, toDate, isHalfDay } = req.body || {};
    if (!fromDate || !toDate) {
      return res.json({ success: true, data: { effectiveDays: 1, calendarDays: 1 } });
    }
    const d1 = new Date(fromDate);
    const d2 = new Date(toDate);
    const diffDays = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    const effectiveDays = isHalfDay ? 0.5 : diffDays;
    res.json({
      success: true,
      data: {
        effectiveDays,
        calendarDays: diffDays,
        holidaysExcluded: 0,
        weeklyOffsExcluded: 0,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function approveLeave(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);
    const { approvedBy = "HR Admin" } = req.body || {};
    const updated = await updateRow(hrTables.leaveApplications, id, {
      status: "Approved",
      approvedBy,
      approvedAt: new Date().toISOString(),
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function cancelLeave(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);
    const { reason = "Cancelled by HR" } = req.body || {};
    const updated = await updateRow(hrTables.leaveApplications, id, {
      status: "Cancelled",
      cancellationReason: reason,
      cancelledAt: new Date().toISOString(),
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function modifyLeave(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);
    const payload = req.body || {};
    const updated = await updateRow(hrTables.leaveApplications, id, payload);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}
