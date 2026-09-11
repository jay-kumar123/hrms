export const ACTIVE_PROPERTY_KEY = "pms_active_property";

export type PropertySession = {
  id: string;
  name: string;
  code: string;
  city: string;
  timezone?: string;
  isDefault?: boolean;
};

export type PermissionLevel = "read" | "write" | "admin";

export function getActiveProperty(): PropertySession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ACTIVE_PROPERTY_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PropertySession;
  } catch {
    return null;
  }
}

export function setActiveProperty(property: PropertySession | null) {
  if (typeof window === "undefined") return;
  if (property) {
    localStorage.setItem(ACTIVE_PROPERTY_KEY, JSON.stringify(property));
  } else {
    localStorage.removeItem(ACTIVE_PROPERTY_KEY);
  }
}

export function clearActiveProperty() {
  setActiveProperty(null);
}

export const PERMISSIONS_CACHE_KEY = "pms_property_permissions";

export function getCachedPermissions(): Record<string, PermissionLevel> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PERMISSIONS_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, PermissionLevel>) : null;
  } catch {
    return null;
  }
}

export function setCachedPermissions(perms: Record<string, PermissionLevel> | null) {
  if (typeof window === "undefined") return;
  if (perms) {
    localStorage.setItem(PERMISSIONS_CACHE_KEY, JSON.stringify(perms));
  } else {
    localStorage.removeItem(PERMISSIONS_CACHE_KEY);
  }
}
