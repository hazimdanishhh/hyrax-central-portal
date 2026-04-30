// functions.dataTransform.js

export function groupCount(data, keyPath) {
  const map = {};

  data.forEach((item) => {
    const key = keyPath.split(".").reduce((o, k) => o?.[k], item);

    if (!key) return;

    map[key] = (map[key] || 0) + 1;
  });

  return Object.entries(map).map(([name, value]) => ({
    name,
    value,
  }));
}
