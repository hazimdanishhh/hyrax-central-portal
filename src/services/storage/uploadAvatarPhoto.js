import { supabase } from "../../lib/supabaseClient";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_ORIGINAL_SIZE = 5 * 1024 * 1024; // 5MB

// COMPRESS + RESIZE IMAGE -- avatars are small thumbnails, so a much
// smaller cap than uploadAttendancePhoto.js's maxWidth 1080.
async function optimizeAvatar(file, maxWidth = 512, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = () => (img.src = reader.result);
    reader.onerror = reject;

    img.onload = () => {
      let { width, height } = img;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Compression failed"));

          resolve(new File([blob], "avatar.jpg", { type: "image/jpeg" }));
        },
        "image/jpeg",
        quality,
      );
    };

    img.onerror = reject;

    reader.readAsDataURL(file);
  });
}

/**
 * Upload a profile avatar. Validates type/size, resizes/compresses, then
 * uploads to a STABLE path per profile (unlike uploadAttendancePhoto.js's
 * timestamped paths) -- every re-upload overwrites in place via
 * `upsert: true`, so there's no orphaned-file accumulation and no separate
 * delete step needed. The returned URL carries a cache-busting query param
 * since the path never changes, so an <img> tag actually shows the new
 * photo instead of a stale cached copy of the old one at the same URL.
 */
export async function uploadAvatarPhoto(file, profileId) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Please upload a JPEG, PNG, or WEBP image.");
  }

  if (file.size > MAX_ORIGINAL_SIZE) {
    throw new Error("Image must be smaller than 5MB.");
  }

  const optimized = await optimizeAvatar(file);

  // Matches the existing bucket's convention: a flat "profiles/" folder,
  // filename = the profile id, no extension. Content-Type on the upload
  // (below) is what makes the browser render it correctly regardless.
  const path = `profiles/${profileId}`;

  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, optimized, {
      contentType: "image/jpeg",
      upsert: true,
    });

  if (error) throw error;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);

  return {
    url: `${data.publicUrl}?v=${Date.now()}`,
    path,
  };
}
