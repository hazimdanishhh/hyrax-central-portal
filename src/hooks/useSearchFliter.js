import { useMemo, useState } from "react";

export default function useSearchFilter({
  data = [],
  searchFields = [],
  filterMap = {},
}) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({});

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      // SEARCH
      const matchesSearch =
        !search ||
        searchFields.some((field) =>
          item[field]?.toString().toLowerCase().includes(search.toLowerCase()),
        );

      // FILTERS
      const matchesFilters = Object.entries(filters).every(([key, value]) => {
        if (!value) return true;
        const filterFn = filterMap[key];
        return filterFn ? filterFn(item, value) : true;
      });

      return matchesSearch && matchesFilters;
    });
  }, [data, search, filters]);

  return {
    search,
    setSearch,
    filters,
    setFilters,
    data: filteredData,
  };
}
