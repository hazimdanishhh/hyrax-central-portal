import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useCallback, useEffect } from "react";

/**
 * Reusable Generic Search Params Hook
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
     activeFilters,
     hasActiveFilters,
     setPage,
     setSearch,
     setFilters,
     setSortBy,
     setSortOrder,
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
}) {
  const [searchParams, setSearchParams] = useSearchParams();

  // =========================
  // RAW URL STATE
  // =========================
  const page = Number(searchParams.get("page")) || 1;
  const search = searchParams.get("search") || "";
  const sortBy = searchParams.get("sortBy") || defaultSortBy;
  const sortOrder = searchParams.get("sortOrder") || defaultSortOrder;

  // =========================
  // FILTERS
  // =========================
  const filters = useMemo(() => {
    const obj = {};

    searchParams.forEach((value, key) => {
      if (!["page", "search", "sortBy", "sortOrder"].includes(key)) {
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
      ([_, value]) => value !== "" && value != null,
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
  // QUERY
  // =========================
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: [
      queryKey,
      page,
      search,
      sortBy,
      sortOrder,
      JSON.stringify(filters),
    ],
    queryFn: () =>
      queryFn({
        page,
        pageSize,
        search,
        filters,
        sortBy,
        sortOrder,
      }),
    placeholderData: (prev) => prev,
  });

  const resultData = data?.data || [];
  const totalCount = data?.totalCount || 0;

  // =========================
  // FINAL TOTAL PAGES
  // =========================
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // =========================
  // LOADING
  // =========================
  useEffect(() => {
    if (!isLoading && totalCount > 0 && page > totalPages) {
      updateParams({ page: totalPages });
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
    if (sortBy) params.set("sortBy", sortBy);
    if (sortOrder) params.set("sortOrder", sortOrder);

    setSearchParams(params);
  }, [search, sortBy, sortOrder, setSearchParams]);

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
    page,
    totalPages,
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
    setPage,
    setSearch,
    setSortBy,
    setSortOrder,
    setFilter,
    setFilters,
    resetFilters,
    resetParams,
  };
}
