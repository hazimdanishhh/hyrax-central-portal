// src/hooks/useITAssets.js
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useMessage } from "../context/MessageContext";

/**
 * Hook to fetch IT assets for IT department
 * Optional: can pass filters like departmentId, userId, categoryId, etc.
 */
export default function useITAssets({
  pageSize = 20,
  ready = true,
  sortBy = "asset_code",
  sortOrder = "ascending",
} = {}) {
  const { showMessage } = useMessage();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0); // Filtered Data Length
  const [page, setPage] = useState(1); // Current Page Number
  const [search, setSearch] = useState(""); // Current Search
  const [filters, setFilters] = useState({}); // Current Filters
  const [summary, setSummary] = useState({});

  // =============
  // FETCH ASSETS
  // =============
  const fetchAssets = async ({ page = 1, search = "", filters = {} } = {}) => {
    setLoading(true);
    setError(null);
    // showMessage("Loading assets", "loading");

    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("it_assets")
        .select(
          `
            *,
            asset_category:asset_category_id (id, name),
            asset_subcategory:asset_subcategory_id (id, name, sub, icon),
            asset_status:asset_status_id (id, name),
            asset_user:asset_user_id (id,full_name,employee_id,
              profile:profile_id (id,avatar_url)),
            operating_system:operating_system_id (id, name, icon),
            asset_condition:asset_condition_id (id, name),
            asset_department:asset_department_id (id, name, sub),
            asset_manufacturer:asset_manufacturer_id (id, name)
          `,
          { count: "exact" },
        )
        .order(sortBy, { ascending: sortOrder === "ascending" });

      // --- SEARCH ---
      if (search) {
        query = query.or(
          `asset_name.ilike.%${search}%,asset_code.ilike.%${search}%,serial_number.ilike.%${search}%,asset_model.ilike.%${search}%`,
        );
      }

      // --- FILTERS ---
      Object.entries(filters).forEach(([key, value]) => {
        if (!value) return;

        switch (key) {
          case "category":
            query = query.eq("asset_category_id", value);
            break;
          case "subcategory":
            query = query.eq("asset_subcategory_id", value);
            break;
          case "status":
            query = query.eq("asset_status_id", value);
            break;
          case "condition":
            query = query.eq("asset_condition_id", value);
            break;
          case "os":
            query = query.eq("operating_system_id", value);
            break;
          case "department":
            query = query.eq("asset_department_id", value);
            break;
          case "employees":
            query = query.eq("asset_user_id", value);
            break;
          case "mdm":
            query = query.eq("mdm_status", value);
            break;
          case "manufacturer":
            query = query.eq("asset_manufacturer_id", value);
            break;
          default:
            break;
        }
      });

      // paginate LAST
      query = query.range(from, to);

      const { data, count, error } = await query;

      if (error) throw error;

      setAssets(data || []);
      setTotalCount(count || 0);
      // showMessage("Assets loaded", "success");
    } catch (err) {
      setError(err);
      setAssets([]);
      setTotalCount(0);
      showMessage("Failed to load assets", "error");
    } finally {
      setLoading(false);
    }
  };

  // =============
  // SUMMARY ASSETS
  // =============
  const fetchAssetSummary = async () => {
    try {
      const { data: statuses } = await supabase
        .from("it_asset_status")
        .select("id, name");

      const { data: categories } = await supabase
        .from("it_asset_category")
        .select("id, name");

      const { data: conditions } = await supabase
        .from("it_asset_condition")
        .select("id, name");

      const getIds = (list, names) =>
        list.filter((item) => names.includes(item.name)).map((item) => item.id);

      const activeStatusIds = getIds(statuses || [], ["Active"]);
      const faultyConditionIds = getIds(conditions || [], ["Faulty"]);
      const endpointCategoryIds = getIds(categories || [], ["Endpoint"]);

      // TOTAL
      const { count: total } = await supabase
        .from("it_assets")
        .select("id", { count: "exact" });

      // ACTIVE
      const { count: active } = await supabase
        .from("it_assets")
        .select("id", { count: "exact" })
        .in("asset_status_id", activeStatusIds);

      // ENDPOINT
      const { count: endpoint } = await supabase
        .from("it_assets")
        .select("id", { count: "exact" })
        .in("asset_category_id", endpointCategoryIds);

      // FAULTY
      const { count: faulty } = await supabase
        .from("it_assets")
        .select("id", { count: "exact" })
        .in("asset_condition_id", faultyConditionIds);

      // UNASSIGNED
      const { count: unassigned } = await supabase
        .from("it_assets")
        .select("id", { count: "exact" })
        .is("asset_user_id", null);

      // ASSIGNED
      const { count: assigned } = await supabase
        .from("it_assets")
        .select("id", { count: "exact" })
        .not("asset_user_id", "is", null);

      // UTILIZATION RATE
      const utilizationRate =
        total > 0 ? Math.round(((active || 0) / total) * 100) : 0;

      // INACTIVE
      const inactive = total > 0 ? total - (active || 0) : 0;

      console.log("STATUSES:", statuses);
      console.log("CATEGORIES:", categories);
      console.log("CONDITIONS:", conditions);

      setSummary({
        total: total || 0,
        active: active || 0,
        inactive,
        endpoint: endpoint || 0,
        faulty: faulty || 0,
        unassigned: unassigned || 0,
        assigned: assigned || 0,
        utilizationRate,
      });
    } catch (err) {
      console.error("Failed to fetch asset summary", err);
    }
  };

  useEffect(() => {
    if (!ready) return;

    fetchAssetSummary();
  }, [ready]);

  useEffect(() => {
    if (!ready) return;

    // if (page !== 1 && (search || Object.keys(filters).length > 0)) return;

    fetchAssets({ page, search, filters });
  }, [page, search, filters, ready, sortBy, sortOrder]);

  // =============
  // REFETCH ALL
  // =============
  const refetchAll = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchAssets({ page, search, filters, ready, sortBy, sortOrder }),
        fetchAssetSummary(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  return {
    assets,
    setAssets,
    loading,
    error,
    totalCount,
    page,
    setPage,
    search,
    setSearch,
    filters,
    setFilters,
    refetch: refetchAll,
    summary,
  };
}
