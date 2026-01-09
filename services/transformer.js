export const applyTransformation = (value, rule) => {
  if (value == null) return value;

  switch (rule) {
    case "Uppercase":
      return String(value).toUpperCase();
    case "Lowercase":
      return String(value).toLowerCase();
    case "Trim Spaces":
      return String(value).trim();
    case "Round Up":
      return Math.ceil(Number(value));
    case "Round Down":
      return Math.floor(Number(value));
    case "Date Format":
      return new Date(value).toISOString().split("T")[0];
    default:
      return value;
  }
};
