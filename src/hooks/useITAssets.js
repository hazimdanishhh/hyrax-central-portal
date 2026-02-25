// src/hooks/useITAssets.js
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

/**
 * Hook to fetch IT assets for IT department
 * Optional: can pass filters like departmentId, userId, categoryId, etc.
 */
export default function useITAssets({ setMessage, filters = {} } = {}) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAssets = async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("it_assets")
        .select(
          `
          *,
          asset_category:asset_category_id (id, name),
          asset_subcategory:asset_subcategory_id (id, name),
          asset_status:asset_status_id (id, name),
          asset_user:asset_user_id (
            id,
            full_name,
            employee_id,
            profile:profile_id (
              id,
              avatar_url
            )
          ),
          operating_system:operating_system_id (id, name),
          asset_condition:asset_condition_id (id, name),
          asset_department:asset_department_id (id, name, sub)
        `,
        )
        .order("asset_code", { ascending: true });

      if (filters.departmentId)
        query = query.eq("asset_department_id", filters.departmentId);

      const { data, error } = await query;

      if (error) throw error;

      setAssets(data || []);
    } catch (err) {
      setError(err);
      setAssets([]);
      setMessage?.({
        type: "error",
        text: "Failed to load IT assets.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [JSON.stringify(filters)]);

  return {
    assets,
    setAssets,
    loading,
    error,
    refetch: fetchAssets, // 👈 ADD THIS
  };
}
