import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/**
 * Hook to fetch assets assigned to the currently logged-in employee
 *
 * @param {string} employeeId - The logged-in employee's ID from AuthContext
 * @param {object} options - Optional settings, e.g., setMessage for errors
 *
 * Usage:
 * const { assets, loading } = useEmployeeAssets(employeeId, { setMessage });
 */
export default function useEmployeeAssets(employeeId, { setMessage } = {}) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!employeeId) {
      setAssets([]);
      setLoading(false);
      return;
    }

    const fetchAssets = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("it_assets")
        .select(
          `
          *,
          asset_category:asset_category_id (id, name),
          asset_subcategory:asset_subcategory_id (id, name, sub, icon),
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
          operating_system:operating_system_id (id, name, icon),
          asset_condition:asset_condition_id (id, name),
          asset_department:asset_department_id (id, name, sub),
          asset_manufacturer:asset_manufacturer_id (id, name)
        `,
        )
        .eq("asset_user_id", employeeId)
        .order("asset_name");

      if (error) {
        console.error("Failed to fetch employee assets:", error);
        setMessage?.({
          type: "error",
          text: "Failed to load your assets",
        });
        setAssets([]);
      } else {
        setAssets(data);
      }

      setLoading(false);
    };

    fetchAssets();
  }, [employeeId]);

  return { assets, loading };
}
