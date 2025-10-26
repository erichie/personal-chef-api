/**
 * Generate a short, user-friendly friend code
 * Format: 8 uppercase alphanumeric characters (e.g., "ABC12XYZ")
 *
 * Possible combinations: 36^8 = ~2.8 trillion
 * Using uppercase only for easier verbal sharing and less confusion
 */
export function generateFriendCode(): string {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed confusing: 0,O,1,I
  const length = 8;

  let code = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    code += characters[randomIndex];
  }

  return code;
}

/**
 * Format friend code for display with a dash in the middle
 * Example: ABC12XYZ -> ABC1-2XYZ
 */
export function formatFriendCode(code: string): string {
  if (code.length !== 8) return code;
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/**
 * Normalize friend code input (remove dashes, convert to uppercase)
 */
export function normalizeFriendCode(input: string): string {
  return input.replace(/[-\s]/g, "").toUpperCase();
}
