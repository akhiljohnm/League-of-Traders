// ============================================================
// Avatar utility — picks and persists a random avatar for
// the current player via a 1-year browser cookie.
// Other players' avatars come from the `avatar_id` DB column.
// ============================================================

/** All available avatar IDs in /public/avatars/ */
export const AVATAR_IDS = [
  1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15,
  16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
];

/** Returns the public URL for a given avatar ID. */
export function getAvatarUrl(id: number): string {
  return `/avatars/${id}.png`;
}

/**
 * Reads the player's avatar ID from the `lot_avatar_id` cookie.
 * If none is set, picks one at random and writes it to the cookie.
 * Safe to call during SSR — falls back to AVATAR_IDS[0] on the server.
 */
export function getOrAssignAvatar(): number {
  if (typeof document === "undefined") return AVATAR_IDS[0];

  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith("lot_avatar_id="));

  if (match) {
    const parsed = parseInt(match.split("=")[1], 10);
    if (AVATAR_IDS.includes(parsed)) return parsed;
  }

  // Assign a random avatar and persist for 1 year
  const id = AVATAR_IDS[Math.floor(Math.random() * AVATAR_IDS.length)];
  document.cookie = `lot_avatar_id=${id}; max-age=${60 * 60 * 24 * 365}; path=/; SameSite=Lax`;
  console.log(`[Avatar] Assigned avatar ${id} to this player`);
  return id;
}

/**
 * Syncs the local cookie to match the avatar stored in the DB.
 * Called after session restore so the cookie stays consistent with the DB.
 */
export function syncAvatarCookie(avatarId: number): void {
  if (typeof document === "undefined") return;
  document.cookie = `lot_avatar_id=${avatarId}; max-age=${60 * 60 * 24 * 365}; path=/; SameSite=Lax`;
}
