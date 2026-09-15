import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useCallback, useEffect } from "react";
import { parseSortParam, serializeSorting } from "./sortParam";

/**
 * Reusable Generic Search Params Hook
 * 
 * URL -> HOOK -> QUERY -> UI
 * 
 * ======================
 * Use:
 * ======================
 * const {
     data: assets, //Change to dataset name
     totalCount,
     page,
     totalPages,
     search,
     filters,
     sortBy,
     sortOrder,
     sorting,       // multi-column SortingState ([{id, desc}]) -- pass to
                     // <DataTable sorting={sorting} onSortingChange={setSorting} manualSorting />
     activeFilters,
     hasActiveFilters,
     setPage,
     setSearch,
     setFilters,
     setSortBy,
     setSortOrder,
     setSorting,
     setPageSize,   // optional -- lets a page offer a larger page size
     resetParams,
     isLoading: assetsLoading, //Change to dataset name
     isFetching,
     error,
   } = usePaginatedQuery({
     queryKey: "itAssets", //Change to table
     queryFn: fetchITAssets, //Change to service name
     pageSize: 20, //Change page size
     defaultSortBy: "asset_code", //Change sort by default
   });
 * ======================
 */
export default function usePaginatedQuery({
  queryKey,
  queryFn,
  pageSize = 20,
  defaultSortBy = "id",
  defaultSortOrder = "ascending",
  extraParams = {},
  enabled = true,
}) {
  const [searchParams, setSearchParams] = useSearchParams();

  // =========================
  // RAW URL STATE
  // =========================
  const rawPage = Number(searchParams.get("page"));
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1; // Validate page number to dataset size
  const search = searchParams.get("search") || "";
  const sortBy = searchParams.get("sortBy") || defaultSortBy;
  const sortOrder = searchParams.get("sortOrder") || defaultSortOrder;

  // Multi-column sort, additive alongside the legacy sortBy/sortOrder above --
  // a single new `sort` URL param ("col1.asc,col2.desc", the same format
  // PostgREST itself uses for `?order=`), falling back to the legacy single
  // column when absent so existing bookmarked URLs/un-migrated pages keep
  // working unchanged. See sortParam.js.
  const sorting = useMemo(() => {
    return (
      parseSortParam(searchParams.get("sort")) ??
      [{ id: sortBy, desc: sortOrder === "descending" }]
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString(), sortBy, sortOrder]);

  // Page size, URL-driven only when a page opts in via setPageSize -- falls
  // back to the constructor's `pageSize` for every existing caller.
  const rawPageSize = Number(searchParams.get("pageSize"));
  const effectivePageSize =
    Number.isInteger(rawPageSize) && rawPageSize > 0 ? rawPageSize : pageSize;

  // =========================
  // FILTERS
  // =========================
  const filters = useMemo(() => {
    const obj = {};

    // "date" is the Attendance List page's own day-mode pagination param
    // (see useAttendanceDailyList) -- excluded here too since both hooks can
    // share the same URL when that page switches between day/search modes.
    // No other page in this app uses "date" as a filter key.
    searchParams.forEach((value, key) => {
      if (
        !["page", "date", "search", "sortBy", "sortOrder", "sort", "pageSize"].includes(
          key,
        )
      ) {
        obj[key] = value;
      }
    });

    return obj;
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

  // PAGE VALIDATION
  const safePage = Math.max(1, page);

  // =========================
  // QUERY
  // =========================
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: [
      queryKey,
      {
        page,
        search,
        sortBy,
        sortOrder,
        sorting,
        pageSize: effectivePageSize,
        ...filters,
        ...extraParams,
      },
    ],
    queryFn: () =>
      queryFn({
        page,
        pageSize: effectivePageSize,
        search,
        filters,
        sortBy,
        sortOrder,
        sorting,
        ...extraParams,
      }),
    enabled,
    retry: 2,
    staleTime: 1000 * 30,
    keepPreviousData: true,
  });

  const resultData = data?.data || [];
  const totalCount = data?.totalCount || 0;

  // =========================
  // FINAL TOTAL PAGES
  // =========================
  const totalPages = Math.max(1, Math.ceil(totalCount / effectivePageSize));

  // =========================
  // LOADING
  // =========================
  useEffect(() => {
    if (!isLoading && totalCount > 0) {
      if (page > totalPages) {
        updateParams({ page: totalPages });
      }
    }
  }, [page, totalPages, isLoading, totalCount, updateParams]);

  // =========================
  // NEXT /BACK PAGE ACTIONS (STRICT)
  // =========================
  const setPage = useCallback((p) => updateParams({ page: p }), [updateParams]);

  const setSearch = useCallback(
    (val) => updateParams({ search: val, page: 1 }),
    [updateParams],
  );

  const setSortBy = useCallback(
    (val) => updateParams({ sortBy: val, page: 1 }),
    [updateParams],
  );

  const setSortOrder = useCallback(
    (val) => updateParams({ sortOrder: val, page: 1 }),
    [updateParams],
  );

  // Multi-column sort setter -- matches TanStack Table's own onSortingChange
  // calling convention (a new array, or an updater function taking the
  // current array), so <DataTable sorting={sorting} onSortingChange={setSorting}
  // manualSorting /> wires straight through with no shim. Clears the legacy
  // sortBy/sortOrder params once a page writes the new format.
  const setSorting = useCallback(
    (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      updateParams({
        sort: next?.length ? serializeSorting(next) : undefined,
        sortBy: undefined,
        sortOrder: undefined,
        page: 1,
      });
    },
    [sorting, updateParams],
  );

  const setPageSize = useCallback(
    (val) => updateParams({ pageSize: val, page: 1 }),
    [updateParams],
  );

  // =========================
  // FILTER
  // =========================
  const setFilter = useCallback(
    (key, value) => {
      updateParams({
        [key]: value,
        page: 1,
      });
    },
    [updateParams],
  );

  const setFilters = useCallback(
    (newFilters) => {
      updateParams({
        ...newFilters,
        page: 1,
      });
    },
    [updateParams],
  );

  const resetFilters = useCallback(() => {
    const params = new URLSearchParams();

    params.set("page", "1");
    if (search) params.set("search", search);

    // Preserve whichever sort format is currently active -- a page that has
    // migrated to multi-column `sort` shouldn't lose it just because filters
    // were reset.
    const currentSort = searchParams.get("sort");
    if (currentSort) {
      params.set("sort", currentSort);
    } else {
      if (sortBy) params.set("sortBy", sortBy);
      if (sortOrder) params.set("sortOrder", sortOrder);
    }

    const currentPageSize = searchParams.get("pageSize");
    if (currentPageSize) params.set("pageSize", currentPageSize);

    setSearchParams(params);
  }, [search, sortBy, sortOrder, searchParams, setSearchParams]);

  // =========================
  // RESET PARAMS
  // =========================
  function resetParams() {
    setSearchParams({});
  }

  // =========================
  // RETURN API (CLEAN CONTRACT)
  // =========================
  return {
    // data
    data: resultData,
    totalCount,
    page: safePage,
    totalPages,
    search,
    filters,
    sortBy,
    sortOrder,
    sorting,
    pageSize: effectivePageSize,

    // derived
    activeFilters,
    hasActiveFilters,

    // state
    isLoading,
    isFetching,
    error,

    // actions
    setPage,
    setSearch,
    setSortBy,
    setSortOrder,
    setSorting,
    setPageSize,
    setFilter,
    setFilters,
    resetFilters,
    resetParams,
  };
}
