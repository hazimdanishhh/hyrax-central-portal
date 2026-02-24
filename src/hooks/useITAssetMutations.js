import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function useITAssetMutations({ setMessage } = {}) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  // UPDATE ASSET
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
              return [key, Number(value)];
            }

            return [key, value];
          }),
      );

      console.log("Updating IT asset:", { id, updateFields });

      const { data, error } = await supabase
        .from("it_assets")
        .update(updateFields)
        .eq("id", id)
        .select();

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

  // DELETE ASSET
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
    updateAsset,
    deleteAsset,
    saving,
    deleting,
    error,
  };
}
