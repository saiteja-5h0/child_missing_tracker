const API_BASE = "";

const page = location.pathname.split("/").pop() || "index.html";
let activeExitRecord = null;
let activeFinderRecord = null;

document.addEventListener("DOMContentLoaded", initApp);

function initApp() {
  protectPage();

  if (page === "login.html") setupLoginPage();
  if (page === "worker.html") setupWorkerPage();
  if (page === "finder.html") setupFinderPage();
  if (page === "admin.html") setupAdminPage();
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem("session"));
  } catch {
    return null;
  }
}

function setSession(session) {
  localStorage.setItem("session", JSON.stringify(session));
}

function selectedRole() {
  return localStorage.getItem("selectedRole");
}

function protectPage() {
  const publicPages = ["index.html", "login.html", ""];
  const session = getSession();

  if (!session && !publicPages.includes(page)) {
    location.href = "index.html";
    return;
  }

  if (session && publicPages.includes(page)) {
    location.href = `${session.role}.html`;
    return;
  }

  if (!session) return;

  const requiredRole = page.replace(".html", "");
  const isPortalPage = ["admin", "worker", "finder"].includes(requiredRole);
  const adminCanOpenPortal = session.role === "admin" && isPortalPage;

  if (isPortalPage && session.role !== requiredRole && !adminCanOpenPortal) {
    alert("Access denied for this portal.");
    location.href = `${session.role}.html`;
  }
}

function selectRole(role) {
  localStorage.setItem("selectedRole", role);
  location.href = "login.html";
}

function setupLoginPage() {
  const role = selectedRole() || "admin";
  const title = document.getElementById("loginTitle");
  const hint = document.getElementById("loginHint");

  if (title) title.textContent = `${capitalize(role)} Login`;
  if (hint) hint.textContent = defaultCredentialText(role);

  document.getElementById("loginForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await login();
  });
}

function defaultCredentialText(role) {
  const map = {
    admin: "admin@gmail.com / 123",
    worker: "worker@gmail.com / 123",
    finder: "finder@gmail.com / 123"
  };
  return `Demo login: ${map[role] || map.admin}`;
}

async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const role = selectedRole() || "admin";

  try {
    const session = await api("/api/login", {
      method: "POST",
      body: { email, password, role }
    });

    setSession(session.user);
    location.href = `${session.user.role}.html`;
  } catch (error) {
    showToast(error.message || "Invalid login details.", "error");
  }
}

function logout() {
  localStorage.removeItem("session");
  localStorage.removeItem("selectedRole");
  location.href = "index.html";
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json" };
  const session = getSession();
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;

  const response = await fetch(API_BASE + path, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

function setupShell(active) {
  const session = getSession();
  document.querySelectorAll("[data-user-name]").forEach((node) => {
    node.textContent = session?.name || "User";
  });
  document.querySelectorAll("[data-role-name]").forEach((node) => {
    node.textContent = capitalize(session?.role || "");
  });
  document.querySelectorAll("[data-nav]").forEach((link) => {
    link.classList.toggle("active", link.dataset.nav === active);
  });

  if (session?.role !== "admin") {
    document.querySelectorAll("[data-admin-only]").forEach((node) => node.remove());
  }
}

function setupWorkerPage() {
  setupShell("worker");
  showWorkerPanel("entry");
  addChildField();
  document.getElementById("entryForm")?.addEventListener("submit", submitEntry);
  document.getElementById("exitForm")?.addEventListener("submit", checkExit);
  document.getElementById("confirmExitBtn")?.addEventListener("click", exitChild);
}

function showWorkerPanel(panel) {
  document.querySelectorAll("[data-worker-panel]").forEach((node) => {
    node.hidden = node.dataset.workerPanel !== panel;
  });
  document.querySelectorAll("[data-worker-tab]").forEach((node) => {
    node.classList.toggle("active", node.dataset.workerTab === panel);
  });
}

function addChildField() {
  const container = document.getElementById("childrenContainer");
  if (!container) return;

  const index = container.querySelectorAll(".child-row").length + 1;
  const row = document.createElement("div");
  row.className = "child-row";
  row.innerHTML = `
    <div class="row-title">
      <strong>Child ${index}</strong>
      <button class="icon-button danger" type="button" title="Remove child" onclick="removeChildField(this)">x</button>
    </div>
    <div class="form-grid compact">
      <label>Child name<input class="childName" required placeholder="Full name"></label>
      <label>Age<input class="childAge" type="number" min="0" max="18" required placeholder="Age"></label>
      <label>Gender
        <select class="childGender" required>
          <option value="">Select</option>
          <option>Female</option>
          <option>Male</option>
          <option>Other</option>
        </select>
      </label>
      <label>Dress / identifier<input class="childDress" required placeholder="Red shirt, blue jeans"></label>
      <label class="wide">Child photo<input class="childPhoto" type="file" accept="image/*"></label>
    </div>
  `;
  container.appendChild(row);
  refreshRemoveButtons();
}

function removeChildField(button) {
  button.closest(".child-row")?.remove();
  refreshRemoveButtons();
}

function refreshRemoveButtons() {
  const rows = document.querySelectorAll(".child-row");
  rows.forEach((row, index) => {
    row.querySelector("strong").textContent = `Child ${index + 1}`;
    row.querySelector(".danger").disabled = rows.length === 1;
  });
}

async function submitEntry(event) {
  event.preventDefault();

  const payload = {
    fatherName: value("fatherName"),
    motherName: value("motherName"),
    phone: value("phone"),
    alternatePhone: value("alternatePhone"),
    address: value("address"),
    entryGate: value("entryGate"),
    fatherPhoto: await fileData("fatherPhoto"),
    motherPhoto: await fileData("motherPhoto"),
    children: []
  };

  const rows = document.querySelectorAll(".child-row");
  for (const row of rows) {
    payload.children.push({
      name: row.querySelector(".childName").value.trim(),
      age: row.querySelector(".childAge").value.trim(),
      gender: row.querySelector(".childGender").value,
      dress: row.querySelector(".childDress").value.trim(),
      photo: await fileDataFromInput(row.querySelector(".childPhoto"))
    });
  }

  try {
    const result = await api("/api/cases", { method: "POST", body: payload });
    renderGeneratedCodes(result.records);
    event.target.reset();
    document.getElementById("childrenContainer").innerHTML = "";
    addChildField();
    showToast("Entry saved. Write the six digit code on each child.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

function renderGeneratedCodes(records) {
  const target = document.getElementById("generatedCodes");
  if (!target) return;

  target.innerHTML = `
    <h3>Generated child codes</h3>
    <div class="code-list">
      ${records.map((record) => `
        <div class="code-card">
          <span>${escapeHtml(record.child.name)}</span>
          <strong>${record.code}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

async function checkExit(event) {
  event?.preventDefault();
  activeExitRecord = null;
  const code = value("exitCode");
  const result = document.getElementById("exitResult");
  const button = document.getElementById("confirmExitBtn");

  try {
    const record = await api(`/api/cases/${encodeURIComponent(code)}`);
    activeExitRecord = record;
    result.innerHTML = recordCard(record, "Safe exit check");
    button.disabled = record.status === "safe";
  } catch (error) {
    result.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    button.disabled = true;
  }
}

async function exitChild() {
  const code = activeExitRecord?.code || value("exitCode");
  if (!code) return;

  try {
    const updated = await api(`/api/cases/${encodeURIComponent(code)}/safe-exit`, {
      method: "POST",
      body: { note: "Safe exit verified at gate." }
    });
    activeExitRecord = updated;
    document.getElementById("exitResult").innerHTML = recordCard(updated, "Safe exit verified");
    document.getElementById("confirmExitBtn").disabled = true;
    showToast("Safe exit saved.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

function setupFinderPage() {
  setupShell("finder");
  document.getElementById("finderForm")?.addEventListener("submit", searchChild);
  document.getElementById("markFoundBtn")?.addEventListener("click", markFound);
  document.getElementById("handoverBtn")?.addEventListener("click", markSafeByFinder);
}

async function searchChild(event) {
  event?.preventDefault();
  activeFinderRecord = null;
  const code = value("searchId");
  const result = document.getElementById("result");

  try {
    const record = await api(`/api/cases/${encodeURIComponent(code)}?assign=true`);
    activeFinderRecord = record;
    result.innerHTML = recordCard(record, "Finder result");
    document.getElementById("markFoundBtn").disabled = record.status === "safe";
    document.getElementById("handoverBtn").disabled = record.status === "safe";
  } catch (error) {
    result.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    document.getElementById("markFoundBtn").disabled = true;
    document.getElementById("handoverBtn").disabled = true;
  }
}

async function markFound() {
  await updateFinderStatus("found", "Child found at help centre.");
}

async function markSafeByFinder() {
  await updateFinderStatus("safe-exit", "Handed over to parents by help centre.");
}

async function updateFinderStatus(action, note) {
  const code = activeFinderRecord?.code || value("searchId");
  if (!code) return;

  try {
    const updated = await api(`/api/cases/${encodeURIComponent(code)}/${action}`, {
      method: "POST",
      body: { note }
    });
    activeFinderRecord = updated;
    document.getElementById("result").innerHTML = recordCard(updated, "Finder result");
    document.getElementById("markFoundBtn").disabled = updated.status === "safe";
    document.getElementById("handoverBtn").disabled = updated.status === "safe";
    showToast("Status updated.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function setupAdminPage() {
  setupShell("admin");
  document.getElementById("statusFilter")?.addEventListener("change", loadAdminData);
  document.getElementById("searchFilter")?.addEventListener("input", debounce(loadAdminData, 250));
  await loadAdminData();
}

async function loadAdminData() {
  try {
    const status = document.getElementById("statusFilter")?.value || "all";
    const search = document.getElementById("searchFilter")?.value || "";
    const query = new URLSearchParams({ status, search });
    const data = await api(`/api/admin/overview?${query.toString()}`);
    renderStats(data.stats);
    renderStaff("workerStats", data.workerStats, "Entries");
    renderStaff("finderStats", data.finderStats, "Follow ups");
    renderRecords(data.records);
  } catch (error) {
    showToast(error.message, "error");
  }
}

function renderStats(stats) {
  const target = document.getElementById("statsGrid");
  if (!target) return;

  const items = [
    ["Total records", stats.total],
    ["Active inside", stats.active],
    ["Found", stats.found],
    ["Safe exits", stats.safe],
    ["Today entries", stats.todayEntries],
    ["Today exits", stats.todayExits]
  ];

  target.innerHTML = items.map(([label, valueText]) => `
    <div class="stat">
      <span>${label}</span>
      <strong>${valueText}</strong>
    </div>
  `).join("");
}

function renderStaff(id, rows, metricLabel) {
  const target = document.getElementById(id);
  if (!target) return;
  target.innerHTML = rows.length ? rows.map((row) => `
    <div class="staff-row">
      <div>
        <strong>${escapeHtml(row.name)}</strong>
        <span>${escapeHtml(row.email)}</span>
      </div>
      <b>${row.count}</b>
      <small>${metricLabel}</small>
    </div>
  `).join("") : `<div class="empty-state">No activity yet.</div>`;
}

function renderRecords(records) {
  const target = document.getElementById("recordsTable");
  if (!target) return;

  if (!records.length) {
    target.innerHTML = `<div class="empty-state">No records found.</div>`;
    return;
  }

  target.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Code</th>
          <th>Child</th>
          <th>Parents</th>
          <th>Phone</th>
          <th>Status</th>
          <th>Worker</th>
          <th>Finder</th>
          <th>Entry time</th>
        </tr>
      </thead>
      <tbody>
        ${records.map((record) => `
          <tr>
            <td><strong>${record.code}</strong></td>
            <td>${escapeHtml(record.child.name)}<br><small>${escapeHtml(record.child.dress || "")}</small></td>
            <td>${escapeHtml(record.fatherName)} / ${escapeHtml(record.motherName)}</td>
            <td>${escapeHtml(record.phone)}</td>
            <td><span class="status ${record.status}">${statusText(record.status)}</span></td>
            <td>${escapeHtml(record.workerName || "-")}</td>
            <td>${escapeHtml(record.finderName || "-")}</td>
            <td>${formatDate(record.createdAt)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function recordCard(record, title) {
  return `
    <div class="record-card">
      <div class="record-card-head">
        <div>
          <span>${escapeHtml(title)}</span>
          <strong>${record.code}</strong>
        </div>
        <span class="status ${record.status}">${statusText(record.status)}</span>
      </div>
      <div class="profile-grid">
        ${photoBlock("Father", record.fatherName, record.fatherPhoto)}
        ${photoBlock("Mother", record.motherName, record.motherPhoto)}
        ${photoBlock("Child", record.child.name, record.child.photo)}
      </div>
      <div class="details-grid">
        <p><b>Child age:</b> ${escapeHtml(record.child.age || "-")}</p>
        <p><b>Gender:</b> ${escapeHtml(record.child.gender || "-")}</p>
        <p><b>Dress:</b> ${escapeHtml(record.child.dress || "-")}</p>
        <p><b>Phone:</b> ${escapeHtml(record.phone)}</p>
        <p><b>Alternate:</b> ${escapeHtml(record.alternatePhone || "-")}</p>
        <p><b>Address:</b> ${escapeHtml(record.address)}</p>
        <p><b>Entry gate:</b> ${escapeHtml(record.entryGate || "-")}</p>
        <p><b>Entered by:</b> ${escapeHtml(record.workerName || "-")}</p>
      </div>
      ${record.timeline?.length ? `
        <div class="timeline">
          ${record.timeline.map((item) => `
            <div><b>${escapeHtml(item.label)}</b><span>${formatDate(item.at)}</span><small>${escapeHtml(item.byName || "")}</small></div>
          `).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

function photoBlock(label, name, src) {
  const image = src ? `<img src="${src}" alt="${escapeHtml(label)} photo">` : `<div class="photo-placeholder">No photo</div>`;
  return `<div class="photo-block">${image}<span>${escapeHtml(label)}</span><strong>${escapeHtml(name || "-")}</strong></div>`;
}

async function fileData(id) {
  return fileDataFromInput(document.getElementById(id));
}

function fileDataFromInput(input) {
  const file = input?.files?.[0];
  if (!file) return Promise.resolve("");

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function value(id) {
  return document.getElementById(id)?.value.trim() || "";
}

function statusText(status) {
  return {
    active: "Active",
    found: "Found",
    safe: "Safe"
  }[status] || status;
}

function formatDate(valueText) {
  if (!valueText) return "-";
  return new Date(valueText).toLocaleString();
}

function capitalize(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function showToast(message, type = "success") {
  const toast = document.getElementById("toast") || document.createElement("div");
  toast.id = "toast";
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("visible"), 10);
  setTimeout(() => toast.classList.remove("visible"), 2600);
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
