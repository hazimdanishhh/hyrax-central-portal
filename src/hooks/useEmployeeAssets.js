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
          asset_code,
          asset_name,
          asset_status:asset_status_id (
            id,
            name
          ),
          asset_category:asset_category_id (
            id,
            name
          ),
          asset_subcategory:asset_subcategory_id (
            id,
            name
          ),

          manufacturer_id,

          model_id,

          serial_number,
          operating_system:operating_system_id (
            id,
            name
          ),
          product_key,
          mac_address,
          management_ip,
          asset_condition:asset_condition_id (
            id,
            name
          ),

          asset_location_id,

          asset_department:asset_department_id (
            id,
            name
          ),
          purchase_date,
          purchase_cost,

          vendor_id,

          purchase_order,
          warranty_expiry,
          retire_date,
          notes
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
