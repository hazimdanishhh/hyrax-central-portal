async function uploadAvatar(file, profileId) {
  const fileExt = file.name.split(".").pop();
  const filePath = `profiles/${profileId}.${fileExt}`;

  const { error } = await supabase.storage
    .from("avatars")
    .upload(filePath, file, {
      upsert: true, // overwrite existing avatar
      contentType: file.type,
    });

  if (error) throw error;

  return filePath;
}
