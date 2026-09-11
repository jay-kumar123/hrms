import type { Response } from "express";
import type { ContextRequest } from "../../middleware/request-context.js";
import { supabase } from "../../utils/supabase.js";
import { hrTables } from "../../models/human-resources/index.js";
import { newId, newCode } from "../../models/base.js";
import { clearHrLookupCache } from "../../services/human-resources/enrich.js";
import { fail, fromError, ok } from "../../utils/response.js";

async function resolveMasterName(table: string, idOrName: string | undefined): Promise<string> {
  if (!idOrName) return "";
  if (!idOrName.includes("-")) return idOrName;
  try {
    const { data } = await supabase.from(table).select("*").eq("id", idOrName).single();
    if (!data) return idOrName;
    return data.department_name || data.name || data.title || data.designation_title || data.type_name || idOrName;
  } catch {
    return idOrName;
  }
}

function normalizeEmployeeRow(row: any) {
  if (!row) return null;
  const fName = row.first_name || row.firstName || "";
  const lName = row.last_name || row.lastName || "";
  return {
    ...row,
    id: row.id,
    propertyId: row.property_id || row.propertyId || "prop-shaw-hotel",
    empCode: row.employee_code || row.emp_code || row.empCode || "EMP-0000",
    employeeCode: row.employee_code || row.emp_code || row.empCode,
    firstName: fName,
    lastName: lName,
    name: (`${fName} ${lName}`).trim() || "Employee",
    email: row.work_email || row.personal_email || row.email || "",
    workEmail: row.work_email || row.email || "",
    personalEmail: row.personal_email || "",
    phone: row.phone || "",
    department: row.department || "",
    departmentId: row.department_id || row.departmentId || row.department || "",
    designation: row.designation || "",
    designationId: row.designation_id || row.designationId || row.designation || "",
    employmentType: row.employment_type || row.employmentType || "Permanent",
    employmentTypeId: row.employment_type_id || row.employmentTypeId || "",
    shiftType: row.shift_type || row.shiftType || "Morning Shift",
    shiftTypeId: row.shift_type_id || row.shiftTypeId || "",
    joinDate: row.joining_date || row.join_date || row.joinDate || "",
    joiningDate: row.joining_date || row.join_date || row.joinDate || "",
    workLocation: row.work_location || row.workLocation || "Main Property",
    status: row.status || "Active",
    gender: row.gender || "Male",
    dob: row.dob || null,
    avatar: row.avatar || null,
    panNumber: row.pan_number || row.panNumber || null,
    aadhaarNumber: row.aadhaar_number || row.aadhaarNumber || null,
    bankName: row.bank_name || row.bankName || null,
    bankAccount: row.bank_account_number || row.bank_account || row.bankAccount || null,
    bankAccountNumber: row.bank_account_number || row.bank_account || row.bankAccount || null,
    ifscCode: row.bank_ifsc || row.ifsc_code || row.ifscCode || null,
    bankIfsc: row.bank_ifsc || row.ifsc_code || row.ifscCode || null,
    emergencyContact: row.emergency_contact_phone || row.emergency_contact || row.emergencyContact || null,
    emergencyContactPhone: row.emergency_contact_phone || row.emergencyContactPhone || null,
    emergencyContactName: row.emergency_contact_name || row.emergencyContactName || null,
    attendanceRate: row.attendance_rate ?? 100,
    leaveBalance: row.leave_balance ?? { casual: 12, sick: 7, earned: 15 },
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt,
  };
}

export async function listEmployees(req: ContextRequest, res: Response) {
  try {
    const { data, error } = await supabase.from(hrTables.employees).select("*").order("created_at", { ascending: true });
    if (error) throw error;
    const normalized = (data || []).map(normalizeEmployeeRow);
    return ok(res, normalized);
  } catch (e) {
    return fromError(res, e);
  }
}

export async function getEmployee(req: ContextRequest, res: Response) {
  try {
    const { data, error } = await supabase.from(hrTables.employees).select("*").eq("id", req.params.id).single();
    if (error || !data) return fail(res, "Employee not found", 404);
    return ok(res, normalizeEmployeeRow(data));
  } catch (e) {
    return fromError(res, e);
  }
}

export async function createEmployee(req: ContextRequest, res: Response) {
  try {
    const body = { ...(req.body as Record<string, any>) };
    const empId = body.id || newId();
    
    const deptName = body.department || await resolveMasterName(hrTables.departments, body.departmentId) || "Front Office";
    const desigName = body.designation || await resolveMasterName(hrTables.designations, body.designationId) || "Staff";
    const empTypeName = body.employmentType || await resolveMasterName(hrTables.employmentTypes, body.employmentTypeId) || "Permanent";
    
    const firstName = body.firstName || (body.name ? String(body.name).split(" ")[0] : "Employee");
    const lastName = body.lastName || (body.name ? String(body.name).split(" ").slice(1).join(" ") : "");
    const code = body.empCode || body.employeeCode || newCode("EMP");
    const email = body.workEmail || body.email || body.personalEmail || "";

    const insertPayload: Record<string, any> = {
      id: empId,
      property_id: req.propertyId || body.propertyId || "prop-shaw-hotel",
      employee_code: code,
      first_name: firstName,
      last_name: lastName,
      gender: body.gender || "Male",
      dob: body.dob || null,
      phone: body.phone || null,
      personal_email: body.personalEmail || null,
      work_email: email || null,
      department: deptName,
      designation: desigName,
      employment_type: empTypeName,
      joining_date: body.joinDate || body.joiningDate || new Date().toISOString().split("T")[0],
      work_location: body.workLocation || "Main Property",
      status: body.status || "Active",
      avatar: body.avatar || null,
      pan_number: body.panNumber || null,
      aadhaar_number: body.aadhaarNumber || null,
      bank_name: body.bankName || null,
      bank_account_number: body.bankAccount || body.bankAccountNumber || null,
      bank_ifsc: body.ifscCode || body.bankIfsc || null,
      emergency_contact_name: body.emergencyContactName || null,
      emergency_contact_phone: body.emergencyContact || body.emergencyContactPhone || null,
    };

    const { data, error } = await supabase
      .from(hrTables.employees)
      .insert(insertPayload)
      .select("*")
      .single();

    if (error) throw error;
    clearHrLookupCache(req.propertyId);
    return ok(res, normalizeEmployeeRow(data), 201);
  } catch (e) {
    return fromError(res, e);
  }
}

export async function updateEmployee(req: ContextRequest, res: Response) {
  try {
    const body = { ...(req.body as Record<string, any>) };
    const empId = req.params.id;

    const deptName = body.department || (body.departmentId ? await resolveMasterName(hrTables.departments, body.departmentId) : undefined);
    const desigName = body.designation || (body.designationId ? await resolveMasterName(hrTables.designations, body.designationId) : undefined);
    const empTypeName = body.employmentType || (body.employmentTypeId ? await resolveMasterName(hrTables.employmentTypes, body.employmentTypeId) : undefined);

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (body.firstName !== undefined) updatePayload.first_name = body.firstName;
    if (body.lastName !== undefined) updatePayload.last_name = body.lastName;
    if (body.gender !== undefined) updatePayload.gender = body.gender;
    if (body.dob !== undefined) updatePayload.dob = body.dob;
    if (body.phone !== undefined) updatePayload.phone = body.phone;
    if (body.email !== undefined) updatePayload.work_email = body.email;
    if (body.workEmail !== undefined) updatePayload.work_email = body.workEmail;
    if (body.personalEmail !== undefined) updatePayload.personal_email = body.personalEmail;
    if (deptName) updatePayload.department = deptName;
    if (desigName) updatePayload.designation = desigName;
    if (empTypeName) updatePayload.employment_type = empTypeName;
    if (body.joinDate || body.joiningDate) updatePayload.joining_date = body.joinDate || body.joiningDate;
    if (body.workLocation) updatePayload.work_location = body.workLocation;
    if (body.status) updatePayload.status = body.status;
    if (body.avatar !== undefined) updatePayload.avatar = body.avatar;
    if (body.panNumber !== undefined) updatePayload.pan_number = body.panNumber;
    if (body.aadhaarNumber !== undefined) updatePayload.aadhaar_number = body.aadhaarNumber;
    if (body.bankName !== undefined) updatePayload.bank_name = body.bankName;
    if (body.bankAccount || body.bankAccountNumber) updatePayload.bank_account_number = body.bankAccount || body.bankAccountNumber;
    if (body.ifscCode || body.bankIfsc) updatePayload.bank_ifsc = body.ifscCode || body.bankIfsc;
    if (body.emergencyContactName !== undefined) updatePayload.emergency_contact_name = body.emergencyContactName;
    if (body.emergencyContact || body.emergencyContactPhone) updatePayload.emergency_contact_phone = body.emergencyContact || body.emergencyContactPhone;

    const { data, error } = await supabase
      .from(hrTables.employees)
      .update(updatePayload)
      .eq("id", empId)
      .select("*")
      .single();

    if (error) throw error;
    clearHrLookupCache(req.propertyId);
    return ok(res, normalizeEmployeeRow(data));
  } catch (e) {
    return fromError(res, e);
  }
}

export async function deleteEmployee(req: ContextRequest, res: Response) {
  try {
    const { error } = await supabase.from(hrTables.employees).delete().eq("id", req.params.id);
    if (error) throw error;
    clearHrLookupCache(req.propertyId);
    return ok(res, { id: req.params.id });
  } catch (e) {
    return fromError(res, e);
  }
}
