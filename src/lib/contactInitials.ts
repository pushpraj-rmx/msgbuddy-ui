/** Initials for contact avatar fallback (name preferred, then last digits of phone). */
export function getContactInitials(name?: string, phone?: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2)
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  if (phone) {
    const digits = phone.replace(/\D/g, "").slice(-2);
    return digits ? digits.toUpperCase() : "?";
  }
  return "?";
}
