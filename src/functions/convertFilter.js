export default function buildFilterUrl(filter) {
  if (!filter) return "";

  const params = new URLSearchParams();

  Object.entries(filter).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      params.set(key, value.join(","));
    } else {
      params.set(key, value);
    }
  });

  params.set("page", "1");

  return `?${params.toString()}`;
}
