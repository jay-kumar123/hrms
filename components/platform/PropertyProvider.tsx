"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  clearActiveProperty,
  getActiveProperty,
  getCachedPermissions,
  setActiveProperty,
  setCachedPermissions,
  type PermissionLevel,
  type PropertySession,
} from "@/lib/property";
import { platformService } from "@/services/platform";

export const defaultProperty: PropertySession = {
  id: "prop-shaw-hotel",
  name: "Shaw Hotel & Resort",
  code: "SHAW",
  city: "New York",
  timezone: "UTC",
  isDefault: true,
};

const defaultPermissions: Record<string, PermissionLevel> = {
  dashboard: "admin",
  front_office: "admin",
  food_beverages: "admin",
  housekeeping: "admin",
  purchase_stores: "admin",
  human_resources: "admin",
  accounts: "admin",
  sales_marketing: "admin",
  system_settings: "admin",
};

type PropertyContextValue = {
  property: PropertySession | null;
  permissions: Record<string, PermissionLevel>;
  loading: boolean;
  setProperty: (p: PropertySession | null) => void;
  refreshPermissions: () => Promise<void>;
  canRead: (moduleKey: string) => boolean;
  canWrite: (moduleKey: string) => boolean;
};

const PropertyContext = createContext<PropertyContextValue | null>(null);

export function PropertyProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [property, setPropertyState] = useState<PropertySession | null>(defaultProperty);
  const [permissions, setPermissions] = useState<Record<string, PermissionLevel>>(defaultPermissions);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cachedProp = getActiveProperty();
    if (cachedProp) {
      setPropertyState(cachedProp);
    } else {
      setActiveProperty(defaultProperty);
    }
    const cachedPerms = getCachedPermissions();
    if (cachedPerms) {
      setPermissions(cachedPerms);
    } else {
      setCachedPermissions(defaultPermissions);
    }
  }, []);

  const refreshPermissions = useCallback(async () => {
    if (!property?.id) {
      setPermissions({});
      setCachedPermissions(null);
      return;
    }
    try {
      const perms = await platformService.myPermissions(property.id);
      setPermissions(perms);
      setCachedPermissions(perms);
    } catch {
      if (user?.isSuperAdmin) {
        setPermissions(defaultPermissions);
        setCachedPermissions(defaultPermissions);
      }
    }
  }, [property?.id, user?.isSuperAdmin]);

  useEffect(() => {
    if (!user || !property?.id) return;
    void refreshPermissions();
  }, [user, property?.id, refreshPermissions]);

  const setProperty = useCallback((p: PropertySession | null) => {
    setPropertyState(p);
    setActiveProperty(p);
    if (!p) {
      setPermissions({});
      setCachedPermissions(null);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      clearActiveProperty();
      setPropertyState(null);
      setPermissions({});
    }
  }, [user, authLoading]);

  const canRead = useCallback(
    (moduleKey: string) => {
      if (user?.isSuperAdmin) return true;
      const level = permissions[moduleKey];
      return level === "read" || level === "write" || level === "admin";
    },
    [permissions, user?.isSuperAdmin],
  );

  const canWrite = useCallback(
    (moduleKey: string) => {
      if (user?.isSuperAdmin) return true;
      const level = permissions[moduleKey];
      return level === "write" || level === "admin";
    },
    [permissions, user?.isSuperAdmin],
  );

  const value = useMemo(
    () => ({
      property,
      permissions,
      loading,
      setProperty,
      refreshPermissions,
      canRead,
      canWrite,
    }),
    [property, permissions, loading, setProperty, refreshPermissions, canRead, canWrite],
  );

  return (
    <PropertyContext.Provider value={value}>{children}</PropertyContext.Provider>
  );
}

export function useProperty() {
  const ctx = useContext(PropertyContext);
  if (!ctx) throw new Error("useProperty must be used within PropertyProvider");
  return ctx;
}

export function usePropertyOptional() {
  return useContext(PropertyContext);
}
