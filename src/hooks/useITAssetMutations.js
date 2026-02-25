import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function useITAssetMutations({ setMessage } = {}) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  // =============
  // UPDATE ASSET
  // =============
  const updateAsset = async (updatedData) => {
    try {
      setSaving(true);
      setError(null);

      const { id, ...rawFields } = updatedData;

      // Clean and normalize data before sending to Supabase
      const updateFields = Object.fromEntries(
        Object.entries(rawFields)
          .filter(([_, value]) => value !== undefined) // remove undefined
          .map(([key, value]) => {
            // Convert empty strings to null
            if (value === "") return [key, null];

            // Convert *_id fields to integers
            if (key.endsWith("_id") && value !== null) {
              const isNumeric =
                typeof value === "string" && /^\d+$/.test(value);

              return [key, isNumeric ? Number(value) : value];
            }

            return [key, value];
          }),
      );

      console.log("Updating IT asset:", { id, updateFields });

      // Update +
      const { data, error } = await supabase
        .from("it_assets")
        .update(updateFields)
        .eq("id", id).select(`
          *,
          asset_category:asset_category_id (id, name),
          asset_subcategory:asset_subcategory_id (id, name),
          asset_status:asset_status_id (id, name),
          asset_user:asset_user_id (
            id,
            full_name,
            employee_id,
            profile:profile_id (id, avatar_url)
          ),
          operating_system:operating_system_id (id, name),
          asset_condition:asset_condition_id (id, name),
          asset_department:asset_department_id (id, name, sub)
        `);

      console.log("Supabase response:", { data, error });

      if (error) throw error;
      console.log("About to set success message");
      setMessage?.({
        type: "success",
        text: "Asset updated successfully.",
      });

      return data;
    } catch (err) {
      console.error("Failed to update asset:", err);
      setError(err);
      setMessage?.({
        type: "error",
        text: "Failed to update asset.",
      });
      throw err;
    } finally {
      setSaving(false);
    }
  };

  // =============
  // CREATE ASSET
  // =============
  const createAsset = async (newData) => {
    try {
      setSaving(true);
      setError(null);

      const { id, ...rawFields } = newData; // ignore id if accidentally passed

      const insertFields = Object.fromEntries(
        Object.entries(rawFields)
          .filter(([_, value]) => value !== undefined)
          .map(([key, value]) => {
            if (value === "") return [key, null];

            if (key.endsWith("_id") && value !== null) {
              const isNumeric =
                typeof value === "string" && /^\d+$/.test(value);

              return [key, isNumeric ? Number(value) : value];
            }

            return [key, value];
          }),
      );

      const { data, error } = await supabase
        .from("it_assets")
        .insert(insertFields)
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
          profile:profile_id (id, avatar_url)
        ),
        operating_system:operating_system_id (id, name),
        asset_condition:asset_condition_id (id, name),
        asset_department:asset_department_id (id, name, sub)
      `,
        )
        .single();

      if (error) throw error;

      setMessage?.({
        type: "success",
        text: "Asset created successfully.",
      });

      return data;
    } catch (err) {
      console.error("Failed to create asset:", err);
      setError(err);
      setMessage?.({
        type: "error",
        text: "Failed to create asset.",
      });
      throw err;
    } finally {
      setSaving(false);
    }
  };

  // =============
  // DELETE ASSET
  // =============
  const deleteAsset = async (assetId) => {
    try {
      setDeleting(true);
      setError(null);

      const { error } = await supabase
        .from("it_assets")
        .delete()
        .eq("id", assetId);

      if (error) throw error;

      setMessage?.({
        type: "success",
        text: "Asset deleted successfully.",
      });

      return true;
    } catch (err) {
      console.error("Failed to delete asset:", err);
      setError(err);
      setMessage?.({
        type: "error",
        text: "Failed to delete asset.",
      });
      throw err;
    } finally {
      setDeleting(false);
    }
  };

  return {
    createAsset,
    updateAsset,
    deleteAsset,
    saving,
    deleting,
    error,
  };
}
