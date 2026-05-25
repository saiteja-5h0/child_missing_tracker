const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "127.0.0.1";
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const UPLOAD_DIR = path.join(ROOT, "uploads");
const DB_FILE = path.join(DATA_DIR, "database.json");

const USERS = [
  { id: "admin-1", name: "Admin", email: "admin@gmail.com", password: "123", role: "admin" },
  { id: "worker-1", name: "Worker", email: "worker@gmail.com", password: "123", role: "worker" },
  { id: "finder-1", name: "Finder", email: "finder@gmail.com", password: "123", role: "finder" }
];

const sessions = new Map();

ensureStorage();

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/api/")) {
      await handleApi(req, res);
      return;
    }
    serveStatic(req, res);
  } catch (error) {
    sendJson(res, error.status || 500, { error: error.message || "Server error." });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Child Missing Tracker running at http://${HOST}:${PORT}`);
});

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const route = url.pathname;

  if (req.method === "POST" && route === "/api/login") {
    const body = await readJson(req);
    const user = USERS.find((item) =>
      item.email === body.email &&
      item.password === body.password &&
      item.role === body.role
    );

    if (!user) throw httpError(401, "Invalid login details for selected portal.");

    const token = crypto.randomUUID();
    sessions.set(token, user.id);
    sendJson(res, 200, {
      user: {
        token,
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
    return;
  }

  const user = requireUser(req);

  if (req.method === "POST" && route === "/api/cases") {
    requireRole(user, ["worker", "admin"]);
    const body = await readJson(req);
    const result = createCases(body, user);
    sendJson(res, 201, result);
    return;
  }

  if (req.method === "GET" && route.startsWith("/api/cases/")) {
    requireRole(user, ["worker", "finder", "admin"]);
    const code = route.split("/").pop();
    const record = getRecord(code);
    if (url.searchParams.get("assign") === "true" && user.role === "finder") {
      assignFinder(record, user);
    }
    sendJson(res, 200, record);
    return;
  }

  if (req.method === "POST" && route.match(/^\/api\/cases\/\d{6}\/safe-exit$/)) {
    requireRole(user, ["worker", "finder", "admin"]);
    const code = route.split("/")[3];
    const body = await readJson(req);
    const record = updateStatus(code, "safe", body.note || "Safe exit verified.", user);
    sendJson(res, 200, record);
    return;
  }

  if (req.method === "POST" && route.match(/^\/api\/cases\/\d{6}\/found$/)) {
    requireRole(user, ["finder", "admin"]);
    const code = route.split("/")[3];
    const body = await readJson(req);
    const record = updateStatus(code, "found", body.note || "Child found.", user);
    sendJson(res, 200, record);
    return;
  }

  if (req.method === "GET" && route === "/api/admin/overview") {
    requireRole(user, ["admin"]);
    const data = adminOverview(url.searchParams);
    sendJson(res, 200, data);
    return;
  }

  throw httpError(404, "API route not found.");
}

function createCases(body, user) {
  const required = ["fatherName", "motherName", "phone", "address", "entryGate"];
  for (const field of required) {
    if (!String(body[field] || "").trim()) throw httpError(400, "Please fill all family details.");
  }

  if (!Array.isArray(body.children) || body.children.length === 0) {
    throw httpError(400, "Add at least one child.");
  }

  const db = readDb();
  const familyId = crypto.randomUUID();
  const now = new Date().toISOString();
  const fatherPhoto = saveDataUrl(body.fatherPhoto, `father-${familyId}`);
  const motherPhoto = saveDataUrl(body.motherPhoto, `mother-${familyId}`);

  const records = body.children.map((child, index) => {
    if (!child.name || !child.age || !child.gender || !child.dress) {
      throw httpError(400, "Please fill every child detail.");
    }

    const code = generateCode(db.records);
    const childPhoto = saveDataUrl(child.photo, `child-${code}`);
    const record = {
      code,
      familyId,
      fatherName: clean(body.fatherName),
      motherName: clean(body.motherName),
      phone: clean(body.phone),
      alternatePhone: clean(body.alternatePhone),
      address: clean(body.address),
      entryGate: clean(body.entryGate),
      fatherPhoto,
      motherPhoto,
      child: {
        index: index + 1,
        name: clean(child.name),
        age: clean(child.age),
        gender: clean(child.gender),
        dress: clean(child.dress),
        photo: childPhoto
      },
      status: "active",
      workerId: user.id,
      workerName: user.name,
      finderId: "",
      finderName: "",
      createdAt: now,
      safeAt: "",
      updatedAt: now,
      timeline: [
        { label: "Entry created", at: now, byId: user.id, byName: user.name }
      ]
    };

    db.records.push(record);
    return record;
  });

  writeDb(db);
  return { records };
}

function getRecord(code) {
  const db = readDb();
  const record = db.records.find((item) => item.code === code);
  if (!record) throw httpError(404, "No child record found for this code.");
  return record;
}

function assignFinder(record, user) {
  const db = readDb();
  const stored = db.records.find((item) => item.code === record.code);
  if (!stored) throw httpError(404, "No child record found for this code.");

  if (!stored.finderId) {
    stored.finderId = user.id;
    stored.finderName = user.name;
    stored.updatedAt = new Date().toISOString();
    stored.timeline.push({ label: "Assigned to finder", at: stored.updatedAt, byId: user.id, byName: user.name });
    writeDb(db);
  }

  Object.assign(record, stored);
}

function updateStatus(code, status, note, user) {
  const db = readDb();
  const record = db.records.find((item) => item.code === code);
  if (!record) throw httpError(404, "No child record found for this code.");

  const now = new Date().toISOString();
  record.status = status;
  record.updatedAt = now;
  if (status === "safe") record.safeAt = now;
  if (user.role === "finder") {
    record.finderId = user.id;
    record.finderName = user.name;
  }
  record.timeline.push({ label: note, at: now, byId: user.id, byName: user.name });

  writeDb(db);
  return record;
}

function adminOverview(params) {
  const db = readDb();
  const today = new Date().toISOString().slice(0, 10);
  const status = params.get("status") || "all";
  const search = (params.get("search") || "").toLowerCase();

  const filtered = db.records.filter((record) => {
    const matchesStatus = status === "all" || record.status === status;
    const text = [
      record.code,
      record.child.name,
      record.fatherName,
      record.motherName,
      record.phone,
      record.address
    ].join(" ").toLowerCase();
    return matchesStatus && text.includes(search);
  });

  return {
    stats: {
      total: db.records.length,
      active: db.records.filter((item) => item.status === "active").length,
      found: db.records.filter((item) => item.status === "found").length,
      safe: db.records.filter((item) => item.status === "safe").length,
      todayEntries: db.records.filter((item) => item.createdAt.startsWith(today)).length,
      todayExits: db.records.filter((item) => item.safeAt && item.safeAt.startsWith(today)).length
    },
    workerStats: staffCounts("worker", db.records),
    finderStats: staffCounts("finder", db.records),
    records: filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  };
}

function staffCounts(role, records) {
  const staff = USERS.filter((user) => user.role === role);
  return staff.map((user) => {
    const count = records.filter((record) => (
      role === "worker" ? record.workerId === user.id : record.finderId === user.id
    )).length;
    return { id: user.id, name: user.name, email: user.email, count };
  });
}

function generateCode(records) {
  let code = "";
  do {
    code = String(Math.floor(100000 + Math.random() * 900000));
  } while (records.some((record) => record.code === code));
  return code;
}

function saveDataUrl(dataUrl, name) {
  if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) return "";

  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return "";

  const mime = match[1];
  const extension = mime.split("/")[1].replace("jpeg", "jpg").replace(/[^a-z0-9]/gi, "");
  const fileName = `${name}-${Date.now()}.${extension}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, fileName), Buffer.from(match[2], "base64"));
  return `/uploads/${fileName}`;
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(ROOT, requested));

  if (!filePath.startsWith(ROOT)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendText(res, 404, "Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType(filePath) });
    res.end(content);
  });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 15_000_000) reject(httpError(413, "Photo upload is too large."));
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(httpError(400, "Invalid request data."));
      }
    });
    req.on("error", reject);
  });
}

function requireUser(req) {
  const header = req.headers.authorization || "";
  const token = header.replace("Bearer ", "");
  const userId = sessions.get(token);
  const user = USERS.find((item) => item.id === userId);
  if (!user) throw httpError(401, "Please login again.");
  return user;
}

function requireRole(user, roles) {
  if (!roles.includes(user.role)) throw httpError(403, "You do not have permission for this action.");
}

function ensureStorage() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) writeDb({ records: [] });
}

function readDb() {
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function writeDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function clean(value) {
  return String(value || "").trim();
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function sendText(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain" });
  res.end(text);
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function contentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp"
  }[extension] || "application/octet-stream";
}
