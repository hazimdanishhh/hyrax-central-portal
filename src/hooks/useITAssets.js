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

  useEffect(() => {
    let isMounted = true;

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
            asset_user:asset_user_id (id, full_name, employee_id),
            operating_system:operating_system_id (id, name),
            asset_condition:asset_condition_id (id, name),
            asset_department:asset_department_id (id, name)
          `,
          )
          .order("asset_code", { ascending: true });

        // Apply filters if any
        if (filters.departmentId)
          query = query.eq("asset_department_id", filters.departmentId);
        if (filters.userId) query = query.eq("asset_user_id", filters.userId);
        if (filters.categoryId)
          query = query.eq("asset_category_id", filters.categoryId);

        const { data, error } = await query;

        if (!isMounted) return;

        if (error) throw error;

        setAssets(data || []);
      } catch (err) {
        console.error("Failed to fetch IT assets:", err);
        setAssets([]);
        setError(err);
        if (setMessage) {
          setMessage({ type: "error", text: "Failed to load IT assets." });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchAssets();

    return () => {
      isMounted = false;
    };
  }, [setMessage, JSON.stringify(filters)]); // re-fetch if filters change

  return { assets, loading, error };
}
