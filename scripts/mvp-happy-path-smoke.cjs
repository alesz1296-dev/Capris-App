const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
loadEnvFile(path.join(repoRoot, ".env"));

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api/v1";
const qaPassword = process.env.CAPRIS_QA_PASSWORD;

if (!qaPassword) {
  fail("CAPRIS_QA_PASSWORD is required in the untracked root .env file.");
}

async function main() {
  const result = {
    apiBaseUrl: API_BASE_URL,
    checks: []
  };

  await check(result, "API readiness", async () => {
    const readiness = await request("/system-health/readiness");
    assert(readiness.status === "ok", `Expected readiness ok, got ${readiness.status}`);
  });

  const admin = await check(result, "Admin login", () => login("maria.solis@capris.example"));
  const supervisor = await check(result, "Supervisor/auditor login", () => login("daniel.rojas@capris.example"));
  const developer = await check(result, "Developer/SRE login", () => login("andres.campos@capris.example"));
  const field = await check(result, "Field user login", () => login("lucia.vargas@capris.example"));

  await check(result, "Developer/SRE can access observability health details", async () => {
    const details = await request("/system-health/details", { token: developer.tokens.accessToken });
    assert(details.status === "ok", "Developer/SRE health details should be ok.");
  });

  const bootstrap = await check(result, "Admin task bootstrap has MVP catalog data", async () => {
    const data = await request("/tasks/bootstrap", { token: admin.tokens.accessToken });
    assert(Array.isArray(data.users), "Expected users array in task bootstrap.");
    assert(Array.isArray(data.provinces), "Expected provinces array in task bootstrap.");
    assert(Array.isArray(data.cantons), "Expected cantons array in task bootstrap. Rebuild/restart the API and apply the current Prisma schema.");
    assert(Array.isArray(data.districts), "Expected districts array in task bootstrap. Rebuild/restart the API and apply the current Prisma schema.");
    assert(Array.isArray(data.clients), "Expected clients array in task bootstrap.");
    assert(Array.isArray(data.activityTypes), "Expected activityTypes array in task bootstrap.");
    assert(Array.isArray(data.taskTypes), "Expected taskTypes array in task bootstrap.");
    assert(data.users.some((user) => user.role === "field_user"), "Expected at least one field user.");
    assert(data.provinces.length >= 7, `Expected all 7 provinces, got ${data.provinces.length}.`);
    assert(data.cantons.length > 0, "Expected canton data.");
    assert(data.districts.length > 0, "Expected district data.");
    assert(data.clients.length > 0, "Expected client data.");
    assert(data.activityTypes.length > 0, "Expected activity types.");
    assert(data.taskTypes.length > 0, "Expected task types.");
    return data;
  });

  const fieldUser = bootstrap.users.find((user) => user.email === "lucia.vargas@capris.example");
  const pos = bootstrap.pointsOfSale.find((item) => item.active && item.cantonId && item.districtId);
  const activity = bootstrap.activityTypes.find((item) => item.active);
  const taskType = bootstrap.taskTypes.find((item) => item.active);

  assert(fieldUser, "Field QA user was not found in task bootstrap.");
  assert(pos, "A point of sale with province/canton/district was not found.");
  assert(activity, "Active activity type was not found.");
  assert(taskType, "Active task type was not found.");

  const task = await check(result, "Admin creates assignment with client/location/activity/objective/date", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const created = await request("/tasks", {
      method: "POST",
      token: admin.tokens.accessToken,
      body: {
        title: `MVP smoke assignment ${Date.now()}`,
        objective: "Validate admin assignment, field execution, evidence upload, status update, and dashboard consolidation.",
        assigneeId: fieldUser.id,
        scheduledFor: today,
        provinceId: pos.provinceId,
        cantonId: pos.cantonId,
        districtId: pos.districtId,
        zoneId: pos.zoneId,
        clientId: pos.clientId,
        pointOfSaleId: pos.id,
        activityTypeId: activity.id,
        taskTypeId: taskType.id,
        status: "pending",
        priority: "medium",
        difficulty: "standard"
      }
    });
    assert(created.id, "Created task did not return an id.");
    assert(created.assigneeId === fieldUser.id, "Created task assignee mismatch.");
    assert(created.cantonId === pos.cantonId, "Created task canton mismatch.");
    assert(created.districtId === pos.districtId, "Created task district mismatch.");
    return created;
  });

  await check(result, "Field user sees assigned task", async () => {
    const tasks = await request("/tasks", { token: field.tokens.accessToken });
    assert(tasks.some((item) => item.id === task.id), `Field user cannot see task ${task.id}.`);
  });

  await check(result, "Field user uploads photo evidence", async () => {
    const upload = await request("/evidence/upload", {
      method: "POST",
      token: field.tokens.accessToken,
      body: {
        taskId: task.id,
        type: "before",
        capturedAt: new Date().toISOString(),
        fileName: "mvp-smoke-before.txt",
        mimeType: "text/plain",
        fileBase64: Buffer.from("MVP smoke evidence").toString("base64"),
        captureSource: "web_file",
        byteSize: Buffer.byteLength("MVP smoke evidence")
      }
    });
    assert(upload.item?.taskId === task.id, "Evidence upload task mismatch.");
    assert(upload.mediaAsset?.uploadStatus === "uploaded", "Evidence media should be uploaded.");
  });

  await check(result, "Field user marks task in_progress", async () => {
    const updated = await request(`/tasks/${task.id}/status`, {
      method: "PATCH",
      token: field.tokens.accessToken,
      body: { status: "in_progress" }
    });
    assert(updated.item?.status === "in_progress", "Task should be in_progress.");
  });

  await check(result, "Admin can see status update", async () => {
    const updated = await request(`/tasks/${task.id}`, { token: admin.tokens.accessToken });
    assert(updated.status === "in_progress", `Expected in_progress, got ${updated.status}.`);
  });

  await check(result, "Supervisor/auditor can access business dashboard", async () => {
    const dashboard = await request("/performance/dashboard?locale=en", { token: supervisor.tokens.accessToken });
    assert(dashboard.summary?.assignedTasks >= 1, "Expected assigned task count in performance dashboard.");
    assert(Array.isArray(dashboard.statusBreakdown), "Expected status breakdown.");
  });

  await check(result, "Admin report export returns CSV", async () => {
    const csv = await requestText("/reports/tasks.csv?locale=en", { token: admin.tokens.accessToken });
    assert(csv.includes("Task") || csv.includes("task"), "Expected tasks CSV content.");
  });

  console.log(JSON.stringify(result, null, 2));
}

async function login(email) {
  const response = await request("/auth/login", {
    method: "POST",
    body: {
      email,
      password: qaPassword,
      deviceName: "mvp-happy-path-smoke"
    }
  });
  assert(response.tokens?.accessToken, `Login for ${email} did not return an access token.`);
  return response;
}

async function check(result, name, fn) {
  const startedAt = Date.now();
  try {
    const value = await fn();
    result.checks.push({ name, status: "pass", durationMs: Date.now() - startedAt });
    return value;
  } catch (error) {
    result.checks.push({ name, status: "fail", durationMs: Date.now() - startedAt, error: error.message });
    console.error(JSON.stringify(result, null, 2));
    throw error;
  }
}

async function request(pathname, options = {}) {
  const response = await fetch(`${API_BASE_URL}${pathname}`, {
    method: options.method || "GET",
    headers: {
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : undefined;
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${pathname} failed with ${response.status}: ${text}`);
  }
  return payload;
}

async function requestText(pathname, options = {}) {
  const response = await fetch(`${API_BASE_URL}${pathname}`, {
    headers: {
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    }
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`GET ${pathname} failed with ${response.status}: ${text}`);
  }
  return text;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    return;
  }

  for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
