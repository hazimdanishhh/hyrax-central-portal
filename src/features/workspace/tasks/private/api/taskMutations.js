import { supabase } from "../../../../../lib/supabaseClient";
import { normalizeFields } from "@/features/_shared/normalizeFields";

export async function createTask(newData) {
  const { id: _id, task_assignees: _assignees, project: _project, ...rawFields } = newData;

  const fields = normalizeFields(rawFields);

  const { data, error } = await supabase.from("tasks").insert(fields).select("*").single();

  if (error) throw error;

  return data;
}

export async function updateTask(updatedData) {
  const { id, task_assignees: _assignees, project: _project, ...rawFields } = updatedData;

  const fields = normalizeFields(rawFields);

  const { data, error } = await supabase
    .from("tasks")
    .update(fields)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;

  return data;
}

export async function deleteTask(id) {
  const { error } = await supabase.from("tasks").delete().eq("id", id);

  if (error) throw error;

  return true;
}
