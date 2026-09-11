import { api } from "../api";
import type { PermissionLevel } from "@/lib/property";

export type PropertyDto = {
  id: string;
  name: string;
  code: string;
  city: string;
  timezone: string;
  isDefault: boolean;
  status: string;
};

export type PlatformModule = {
  key: string;
  label: string;
};

export type UserPermissionDto = {
  propertyId: string;
  moduleKey: string;
  permission: PermissionLevel;
};

export type ManagedUserDto = {
  id: string;
  name: string;
  email: string;
  role: string;
  initials: string;
  status: string;
  isSuperAdmin?: boolean;
  propertyIds: string[];
  permissions: Array<{
    id?: string;
    propertyId: string;
    moduleKey: string;
    permission: PermissionLevel;
  }>;
};

export const platformService = {
  listProperties: () => api.get<PropertyDto[]>("/api/platform/properties"),
  createProperty: (body: {
    name: string;
    code: string;
    city?: string;
    timezone?: string;
    isDefault?: boolean;
  }) => api.post<PropertyDto>("/api/platform/properties", body),
  updateProperty: (id: string, body: Partial<PropertyDto>) =>
    api.put<PropertyDto>(`/api/platform/properties/${id}`, body),
  listModules: () => api.get<PlatformModule[]>("/api/platform/modules"),
  myPermissions: (propertyId: string) =>
    api.get<Record<string, PermissionLevel>>(
      `/api/platform/permissions/me?propertyId=${encodeURIComponent(propertyId)}`,
    ),
  listUsers: () => api.get<ManagedUserDto[]>("/api/platform/users"),
  createUser: (body: {
    name: string;
    email: string;
    password: string;
    role?: string;
    isSuperAdmin?: boolean;
    propertyIds?: string[];
    permissions?: UserPermissionDto[];
  }) => api.post<ManagedUserDto>("/api/platform/users", body),
  updateUser: (
    id: string,
    body: Partial<{
      name: string;
      role: string;
      status: string;
      isSuperAdmin: boolean;
      propertyIds: string[];
      permissions: UserPermissionDto[];
    }>,
  ) => api.put<ManagedUserDto>(`/api/platform/users/${id}`, body),
};
