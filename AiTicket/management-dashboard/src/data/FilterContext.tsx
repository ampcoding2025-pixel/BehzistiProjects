"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_FILTERS, type MgmtFilters, type PeriodKey } from "@/data/filters";

const STORAGE_KEY = "mgmt-dashboard-filters";

type Ctx = {
  filters: MgmtFilters;
  setPeriod: (p: PeriodKey) => void;
  setRegionId: (id: number | null) => void;
  setSubjectClassId: (id: number | null) => void;
  reset: () => void;
};

const FilterContext = createContext<Ctx | null>(null);

function readStored(): MgmtFilters {
  if (typeof window === "undefined") return DEFAULT_FILTERS;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FILTERS;
    const parsed = JSON.parse(raw) as Partial<MgmtFilters>;
    return {
      period: (parsed.period as PeriodKey) ?? DEFAULT_FILTERS.period,
      regionId: parsed.regionId ?? null,
      subjectClassId: parsed.subjectClassId ?? null,
    };
  } catch {
    return DEFAULT_FILTERS;
  }
}

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<MgmtFilters>(DEFAULT_FILTERS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setFilters(readStored());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  }, [filters, ready]);

  const setPeriod = useCallback((period: PeriodKey) => {
    setFilters((f) => ({ ...f, period }));
  }, []);
  const setRegionId = useCallback((regionId: number | null) => {
    setFilters((f) => ({ ...f, regionId }));
  }, []);
  const setSubjectClassId = useCallback((subjectClassId: number | null) => {
    setFilters((f) => ({ ...f, subjectClassId }));
  }, []);
  const reset = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    window.sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo<Ctx>(
    () => ({ filters, setPeriod, setRegionId, setSubjectClassId, reset }),
    [filters, setPeriod, setRegionId, setSubjectClassId, reset],
  );

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilters() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useFilters must be used within FilterProvider");
  return ctx;
}
