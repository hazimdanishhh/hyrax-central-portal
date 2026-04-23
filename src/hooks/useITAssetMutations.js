// src/hooks/useITAssetMutations.js
import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useMessage } from "../context/MessageContext";

/**
 * Hook to Create, Update and Delete IT assets for IT department
 */

export default function useITAssetMutations() {
  const { showMessage } = useMessage();
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
      showMessage("Updating asset", "loading");

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

      // Update +
      const { data, error } = await supabase
        .from("it_assets")
        .update(updateFields)
        .eq("id", id)
        .select(
          `
          *,
          asset_category:asset_category_id (id, name),
          asset_subcategory:asset_subcategory_id (id, name, sub, icon),
          asset_status:asset_status_id (id, name),
          asset_user:asset_user_id (id,full_name,employee_id,
            profile:profile_id (id, avatar_url)),
          operating_system:operating_system_id (id, name, icon),
          asset_condition:asset_condition_id (id, name),
          asset_department:asset_department_id (id, name, sub),
          asset_manufacturer:asset_manufacturer_id (id, name)
          `,
        )
        .maybeSingle();

      console.log("Supabase response:", { data, error });

      if (error) throw error;
      showMessage("Asset updated", "success");

      return data;
    } catch (err) {
      console.error("Failed to update asset, please try again", err);
      setError(err);
      showMessage("Failed to update asset, please try again", "error");

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
      showMessage("Creating asset", "loading");

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
          asset_user:asset_user_id (id,full_name,employee_id,
            profile:profile_id (id, avatar_url)),
          operating_system:operating_system_id (id, name),
          asset_condition:asset_condition_id (id, name),
          asset_department:asset_department_id (id, name, sub)
          `,
        )
        .maybeSingle();

      if (error) throw error;

      showMessage("Asset created", "success");

      return data;
    } catch (err) {
      console.error("Failed to create asset, please try again:", err);
      setError(err);
      showMessage("Failed to create asset, please try again", "error");

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
      showMessage("Deleting asset", "loading");

      const { error } = await supabase
        .from("it_assets")
        .delete()
        .eq("id", assetId);

      if (error) throw error;

      showMessage("Asset deleted", "success");

      return true;
    } catch (err) {
      console.error("Failed to delete asset, please try again:", err);
      setError(err);

      showMessage("Failed to delete asset, please try again", "error");

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
