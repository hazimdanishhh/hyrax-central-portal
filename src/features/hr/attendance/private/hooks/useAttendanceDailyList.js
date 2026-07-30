// features/hr/attendance/private/hooks/useAttendanceDailyList.js
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useCallback } from "react";

/**
 * Day-indexed counterpart to usePaginatedQuery, for
 * unified_daily_attendance -- a view with one row per active employee per
 * day. That data shape doesn't fit row-offset pagination: a single day
 * already contributes one row per active employee, so an OFFSET/LIMIT page
 * boundary falls in the middle of a day the moment active headcount
 * approaches the page size, splitting one day's roster across two "pages".
 *
 * Here the URL's `date` param IS the page -- one page, one calendar day,
 * always. Defaults to today when absent, so landing on the Attendance List
 * page always opens on today's roster. Everything else (search, sort,
 * filters, URL-as-state-store) mirrors usePaginatedQuery.js's contract.
 *
 * ======================
 * Use:
 * ======================
 * const {
     data: activities,
     totalCount,
     date,
     search,
     filters,
     sortBy,
     sortOrder,
     activeFilters,
     hasActiveFilters,
     setDate,
     goToPreviousDay,
     goToNextDay,
     goToToday,
     setSearch,
     setFilters,
     setSortBy,
     setSortOrder,
     resetParams,
     isLoading,
     isFetching,
     error,
   } = useAttendanceDailyList({
     queryKey: "attendance_daily",
     queryFn: fetchUnifiedAttendance,
     defaultSortBy: "full_name",
   });
 * ======================
 */

function pad(n) {
  return String(n).padStart(2, "0");
}

function toDateString(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayString() {
  return toDateString(new Date());
}

// Plain calendar-day arithmetic -- deliberately NOT "next/previous date that
// has data". Not every day (e.g. a Sunday with zero scans) will have rows,
// and that's fine -- the page shows NoResult for those, same as any other
// empty result. Always moving by exactly one calendar day keeps navigation
// predictable regardless of which days happen to have data.
function shiftDate(dateString, deltaDays) {
  const [year, month, day] = dateString.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + deltaDays);
  return toDateString(d);
}

export default function useAttendanceDailyList({
  queryKey,
  queryFn,
  defaultSortBy = "full_name",
  defaultSortOrder = "ascending",
  enabled = true,
}) {
  const [searchParams, setSearchParams] = useSearchParams();

  // =========================
  // RAW URL STATE
  // =========================
  const date = searchParams.get("date") || todayString();
  const search = searchParams.get("search") || "";
  const sortBy = searchParams.get("sortBy") || defaultSortBy;
  const sortOrder = searchParams.get("sortOrder") || defaultSortOrder;

  // =========================
  // FILTERS
  // =========================
  const filters = useMemo(() => {
    const obj = {};

    // "page" is Search mode's own pagination param (see
    // fetchUnifiedAttendanceSearch/usePaginatedQuery, both of which can share
    // this same URL when the page switches modes) -- excluded here too so it
    // never gets misread as a business filter while day mode is active.
    searchParams.forEach((value, key) => {
      if (!["date", "page", "search", "sortBy", "sortOrder"].includes(key)) {
        obj[key] = value;
      }
    });

    return obj;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  // =========================
  // ACTIVE FILTERS
  // =========================
  const activeFilters = useMemo(() => {
    return Object.entries(filters).filter(
      ([, value]) => value !== "" && value != null,
    );
  }, [filters]);

  const hasActiveFilters = activeFilters.length > 0 || search.length > 0;

  // =========================
  // SAFE PARAM UPDATE
  // =========================
  const updateParams = useCallback(
    (updates) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);

          Object.entries(updates).forEach(([key, value]) => {
            if (typeof value === "function") return;

            if (value === undefined || value === null || value === "") {
              params.delete(key);
            } else {
              params.set(key, String(value));
            }
          });

          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // =========================
  // QUERY -- fetches the WHOLE day, no range()/pageSize
  // =========================
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: [queryKey, { date, search, sortBy, sortOrder, ...filters }],
    queryFn: () => queryFn({ date, search, filters, sortBy, sortOrder }),
    enabled,
    retry: 2,
    staleTime: 1000 * 30,
    keepPreviousData: true,
  });

  const resultData = data?.data || [];
  const totalCount = data?.totalCount || 0;

  // =========================
  // DAY NAVIGATION
  // =========================
  const setDate = useCallback((d) => updateParams({ date: d }), [updateParams]);

  const goToPreviousDay = useCallback(
    () => updateParams({ date: shiftDate(date, -1) }),
    [updateParams, date],
  );

  const goToNextDay = useCallback(
    () => updateParams({ date: shiftDate(date, 1) }),
    [updateParams, date],
  );

  const goToToday = useCallback(
    () => updateParams({ date: todayString() }),
    [updateParams],
  );

  // =========================
  // SEARCH / SORT
  // =========================
  const setSearch = useCallback(
    (val) => updateParams({ search: val }),
    [updateParams],
  );

  const setSortBy = useCallback(
    (val) => updateParams({ sortBy: val }),
    [updateParams],
  );

  const setSortOrder = useCallback(
    (val) => updateParams({ sortOrder: val }),
    [updateParams],
  );

  // =========================
  // FILTERS
  // =========================
  const setFilter = useCallback(
    (key, value) => updateParams({ [key]: value }),
    [updateParams],
  );

  const setFilters = useCallback(
    (newFilters) => updateParams({ ...newFilters }),
    [updateParams],
  );

  // =========================
  // RESET (keeps today's date, drops search/sort/filters)
  // =========================
  function resetParams() {
    setSearchParams({ date });
  }

  return {
    // data
    data: resultData,
    totalCount,
    date,
    search,
    filters,
    sortBy,
    sortOrder,

    // derived
    activeFilters,
    hasActiveFilters,

    // state
    isLoading,
    isFetching,
    error,

    // actions
    setDate,
    goToPreviousDay,
    goToNextDay,
    goToToday,
    setSearch,
    setSortBy,
    setSortOrder,
    setFilter,
    setFilters,
    resetParams,
  };
}
