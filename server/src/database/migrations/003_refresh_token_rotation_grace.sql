-- ============================================================================
-- Rotation grace for refresh tokens.
--
-- Rotation alone cannot distinguish a stolen token from an honest race. Two
-- browser tabs restoring the same session at the same instant both present the
-- same token: one rotates it, the other arrives a few milliseconds later and
-- looks exactly like a replay, so reuse detection burns the family and logs the
-- user out of everything. Reloading during an in-flight refresh does the same.
--
-- Recording WHY a token was revoked lets the service tell the two cases apart:
-- a token revoked by rotation moments ago is a race and is allowed through
-- once more, while the same token replayed later — or one revoked by logout or
-- a password change — is still treated as theft and still burns the family.
-- ============================================================================

ALTER TABLE refresh_tokens
  ADD COLUMN revoked_reason text
    CHECK (revoked_reason IN ('ROTATED', 'REUSE_DETECTED', 'LOGOUT', 'PASSWORD_CHANGE', 'ROLE_CHANGE'));

-- Existing revoked rows predate the distinction; rotation is the common case
-- and the conservative default, since it only widens the grace window for
-- tokens that are already revoked and past it.
UPDATE refresh_tokens SET revoked_reason = 'ROTATED' WHERE revoked_at IS NOT NULL;

COMMENT ON COLUMN refresh_tokens.revoked_reason IS
  'Why the token was revoked. ROTATED within the grace window is treated as a benign race, not as reuse.';
