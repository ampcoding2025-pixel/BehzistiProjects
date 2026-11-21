"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_FILTER_LABELS,
  DEFAULT_FILTERS,
  monthLabelToRange,
  type AnalyticsFilterLabels,
  type AnalyticsQueryFilters,
  type PeriodKey,
} from "@/data/filters";

type DimKey =
  | "subjectClass"
  | "channel"
  | "region"
  | "subjectGroup"
  | "cookieStatus"
  | "flowUser"
  | "referUser"
  | "cartableUser"
  | "callUser"
  | "caseUser";

type DashboardFilterContextValue = {
  filters: AnalyticsQueryFilters;
  labels: AnalyticsFilterLabels;
  setPeriod: (period: PeriodKey) => void;
  setSubjectClassId: (id: number | null, label?: string | null) => void;
  setChannelId: (id: number | null, label?: string | null) => void;
  setRegionId: (id: number | null, label?: string | null) => void;
  setSubjectGroupId: (id: number | null, label?: string | null) => void;
  toggleMonth: (monthLabel: string) => void;
  clearMonth: () => void;
  toggleDimension: (dim: DimKey, id: number | null, label?: string | null) => void;
  clearDimensionFilters: () => void;
  resetFilters: () => void;
  isDefaultFilters: boolean;
};

const DashboardFilterContext = createContext<DashboardFilterContextValue | null>(null);

const dimToFilterKey: Record<DimKey, keyof AnalyticsQueryFilters> = {
  subjectClass: "subjectClassId",
  channel: "channelId",
  region: "regionId",
  subjectGroup: "subjectGroupId",
  cookieStatus: "cookieStatusId",
  flowUser: "flowUserId",
  referUser: "referUserId",
  cartableUser: "cartableUserId",
  callUser: "callUserId",
  caseUser: "caseUserId",
};

const dimToLabelKey: Record<DimKey, keyof AnalyticsFilterLabels> = {
  subjectClass: "subjectClass",
  channel: "channel",
  region: "region",
  subjectGroup: "subjectGroup",
  cookieStatus: "cookieStatus",
  flowUser: "flowUser",
  referUser: "referUser",
  cartableUser: "cartableUser",
  callUser: "callUser",
  caseUser: "caseUser",
};

export function DashboardFilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<AnalyticsQueryFilters>(DEFAULT_FILTERS);
  const [labels, setLabels] = useState<AnalyticsFilterLabels>(DEFAULT_FILTER_LABELS);

  const value = useMemo<DashboardFilterContextValue>(
    () => ({
      filters,
      labels,
      setPeriod: (period) => {
        setFilters((prev) => ({ ...prev, period, from: null, to: null }));
        setLabels((prev) => ({ ...prev, month: null }));
      },
      toggleMonth: (monthLabel) => {
        const range = monthLabelToRange(monthLabel);
        if (!range) return;
        const same = filters.from === range.from && filters.to === range.to;
        if (same) {
          setFilters((prev) => ({ ...prev, from: null, to: null }));
          setLabels((prev) => ({ ...prev, month: null }));
          return;
        }
        setFilters((prev) => ({ ...prev, from: range.from, to: range.to }));
        setLabels((prev) => ({ ...prev, month: monthLabel }));
      },
      clearMonth: () => {
        setFilters((prev) => ({ ...prev, from: null, to: null }));
        setLabels((prev) => ({ ...prev, month: null }));
      },
      setSubjectClassId: (subjectClassId, label) => {
        setFilters((prev) => ({ ...prev, subjectClassId }));
        setLabels((prev) => ({
          ...prev,
          subjectClass: subjectClassId == null ? null : (label ?? prev.subjectClass),
        }));
      },
      setChannelId: (channelId, label) => {
        setFilters((prev) => ({ ...prev, channelId }));
        setLabels((prev) => ({
          ...prev,
          channel: channelId == null ? null : (label ?? prev.channel),
        }));
      },
      setRegionId: (regionId, label) => {
        setFilters((prev) => ({ ...prev, regionId }));
        setLabels((prev) => ({
          ...prev,
          region: regionId == null ? null : (label ?? prev.region),
        }));
      },
      setSubjectGroupId: (subjectGroupId, label) => {
        setFilters((prev) => ({ ...prev, subjectGroupId }));
        setLabels((prev) => ({
          ...prev,
          subjectGroup: subjectGroupId == null ? null : (label ?? prev.subjectGroup),
        }));
      },
      toggleDimension: (dim, id, label) => {
        const key = dimToFilterKey[dim];
        const labelKey = dimToLabelKey[dim];
        const current = filters[key] as number | null;
        const next = id != null && current === id ? null : id;
        setFilters((prev) => ({ ...prev, [key]: next }));
        setLabels((prev) => ({
          ...prev,
          [labelKey]: next == null ? null : (label ?? prev[labelKey]),
        }));
      },
      clearDimensionFilters: () => {
        setFilters((prev) => ({
          ...prev,
          subjectClassId: null,
          channelId: null,
          regionId: null,
          subjectGroupId: null,
          from: null,
          to: null,
          cookieStatusId: null,
          flowUserId: null,
          referUserId: null,
          cartableUserId: null,
          callUserId: null,
          caseUserId: null,
        }));
        setLabels(DEFAULT_FILTER_LABELS);
      },
      resetFilters: () => {
        setFilters(DEFAULT_FILTERS);
        setLabels(DEFAULT_FILTER_LABELS);
      },
      isDefaultFilters:
        filters.period === DEFAULT_FILTERS.period &&
        filters.subjectClassId == null &&
        filters.channelId == null &&
        filters.regionId == null &&
        filters.subjectGroupId == null &&
        filters.from == null &&
        filters.to == null &&
        filters.cookieStatusId == null &&
        filters.flowUserId == null &&
        filters.referUserId == null &&
        filters.cartableUserId == null &&
        filters.callUserId == null &&
        filters.caseUserId == null,
    }),
    [filters, labels],
  );

  return (
    <DashboardFilterContext.Provider value={value}>{children}</DashboardFilterContext.Provider>
  );
}

export function useDashboardFilters(): DashboardFilterContextValue {
  const ctx = useContext(DashboardFilterContext);
  if (!ctx) {
    throw new Error("useDashboardFilters must be used within DashboardFilterProvider");
  }
  return ctx;
}
