// Extract display name from email
// Example: Viggo.Bang-Larsen@sisbasel.ch → Viggo Bang-Larsen
// Example: Jade.Jbara@sisbasel.ch → Jade Jbara
export function extractNameFromEmail(email) {
  if (!email) return "";

  const localPart = email.split("@")[0];

  // Replace dots and dashes with spaces, then capitalize each word
  const name = localPart
    .replace(/[._-]/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

  return name;
}
