import { supabase } from "../../lib/supabaseClient";

// COMPRESS IMAGE
async function optimizeImage(file, maxWidth = 1080, quality = 0.72) {
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
          if (!blob) return reject("Compression failed");

          resolve(
            new File([blob], "photo.jpg", {
              type: "image/jpeg",
            }),
          );
        },
        "image/jpeg",
        quality,
      );
    };

    img.onerror = reject;

    reader.readAsDataURL(file);
  });
}

// UPLOAD IMAGE
export async function uploadAttendancePhoto(file, employeeId) {
  const optimized = await optimizeImage(file);

  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  const fileName = `${Date.now()}-${crypto.randomUUID()}.jpg`;

  const path = `photos/${employeeId}/${year}/${month}/${fileName}`;

  const { error } = await supabase.storage
    .from("attendance")
    .upload(path, optimized, {
      contentType: "image/jpeg",
      upsert: true,
    });

  if (error) throw error;

  const { data } = supabase.storage.from("attendance").getPublicUrl(path);

  return {
    url: data.publicUrl,
    path,
  };
}
