import { verifyTelegramUser } from './telegramAuth.js';

function splitList(value = "") {
  return value.split(",").map(item => item.trim().toLowerCase()).filter(Boolean);
}

function getHeader(req, name) {
  const value = req.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function getBearerToken(req) {
  const auth = getHeader(req, "authorization");
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function getCloudflareAccessEmail(req) {
  return (
    getHeader(req, "cf-access-authenticated-user-email") ||
    getHeader(req, "cf-access-user-email") ||
    getHeader(req, "x-authenticated-user-email")
  ).toLowerCase();
}

export function requireReadAccess(req, res, next) {
  const allowedEmails = splitList(process.env.MEMORY_ADMIN_EMAILS || process.env.MEMORY_ALLOWED_EMAILS);
  const adminToken = process.env.MEMORY_ADMIN_TOKEN || "";
  const requestToken = getHeader(req, "x-admin-token") || getBearerToken(req);

  if (adminToken && requestToken && requestToken === adminToken) {
    return next();
  }

  const accessEmail = getCloudflareAccessEmail(req);
  if (allowedEmails.length > 0 && accessEmail && allowedEmails.includes(accessEmail)) {
    return next();
  }

  if (verifyTelegramUser(req)) {
    return next();
  }

  if (allowedEmails.length === 0 && !adminToken) {
    return res.status(403).json({ ok: false, error: "Read access not configured" });
  }

  return res.status(403).json({ ok: false, error: "Read access denied" });
}
