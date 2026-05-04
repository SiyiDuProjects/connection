import crypto from "node:crypto";

export function requestContext(req, res, next) {
  const requestId = req.get("x-request-id") || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  req.startedAt = Date.now();
  next();
}

export function logRequest(req, res, next) {
  res.on("finish", () => {
    const durationMs = Date.now() - (req.startedAt || Date.now());
    writeLog("info", "request.completed", {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs,
      userId: req.user?.id || null
    });
  });
  next();
}

export function ok(res, data = {}) {
  return res.json({ ok: true, ...data });
}

export function fail(res, status, error, extra = {}) {
  return res.status(status).json({ ok: false, error, ...extra });
}

export function publicError(message, status = 500, extra = {}) {
  const error = new Error(message);
  error.status = status;
  error.publicMessage = message;
  Object.assign(error, extra);
  return error;
}

export function errorHandler(error, req, res, _next) {
  const status = Number(error.status || 500);
  const publicMessage = error.publicMessage || (
    status >= 500 ? "Server error. Try again shortly." : error.message
  );

  writeLog(status >= 500 ? "error" : "warn", "request.failed", {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    status,
    userId: req.user?.id || null,
    error: error.message,
    stack: status >= 500 ? error.stack : undefined
  });

  return fail(res, status, publicMessage, {
    requestId: req.requestId,
    action: error.action || undefined,
    credits: error.credits || undefined
  });
}

export function writeLog(level, event, data = {}) {
  const payload = {
    level,
    event,
    time: new Date().toISOString(),
    ...data
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}
