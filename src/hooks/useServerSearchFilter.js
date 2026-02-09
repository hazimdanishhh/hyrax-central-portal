import { useEffect, useState } from "react";

export default function useServerSearchFilter({
  queryFn,
  debounceMs = 400,
  initialFilters = {},
}) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      setLoading(true);
      const result = await queryFn({ search, filters });
      setData(result || []);
      setLoading(false);
    }, debounceMs);

    return () => clearTimeout(timeout);
  }, [search, filters]);

  return {
    search,
    setSearch,
    filters,
    setFilters,
    data,
    loading,
  };
}
