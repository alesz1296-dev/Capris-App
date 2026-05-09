import assert from "node:assert/strict";
import {
  createOfflineEncryptionKey,
  decryptOfflineJson,
  encryptOfflineJson,
  minimizeBootstrapForOfflineCache,
  restoreBootstrapFromOfflineCache
} from "@capris/shared";
import type { EvidenceBootstrap } from "@capris/shared";

function createBootstrapFixture(): EvidenceBootstrap {
  return {
    activities: [],
    clients: [
      {
        id: "client_001",
        organizationId: "org_capris",
        name: "Capris Client",
        code: "CLIENT001",
        contactEmail: "client@example.com",
        active: true
      }
    ],
    evidence: [],
    exhibitions: [],
    mediaAssets: [],
    comments: [],
    observations: [],
    consignations: [
      {
        id: "consignation_001",
        organizationId: "org_capris",
        taskId: "task_001",
        userId: "user_field_001",
        visitId: "visit_001",
        note: "Prepared in store.",
        status: "ready_to_send",
        preparedAt: "2026-05-08T10:00:00.000Z",
        reviewedAt: "2026-05-08T10:10:00.000Z",
        recipientEmails: ["primary@example.com", "backup@example.com"],
        emailSubject: "Sensitive subject",
        emailBody: "Sensitive body"
      }
    ],
    pointsOfSale: [],
    tasks: [],
    visits: [],
    users: [
      {
        id: "user_field_001",
        organizationId: "org_capris",
        name: "Field User",
        email: "field@example.com",
        role: "field_user",
        locale: "en",
        active: true
      }
    ],
    workflowRules: [],
    requirementSummaries: [],
    pendingSyncOperations: [
      {
        id: "sync_001",
        type: "comment_create",
        state: "pending_sync",
        payload: { body: "secret" },
        retryCount: 0,
        createdAt: "2026-05-08T10:15:00.000Z"
      }
    ]
  };
}

function testEncryptionRoundTrip() {
  const key = createOfflineEncryptionKey();
  const plaintext = JSON.stringify({ hello: "world" });
  const encrypted = encryptOfflineJson(plaintext, key);
  const decrypted = decryptOfflineJson(encrypted, key);

  assert.notEqual(encrypted, plaintext);
  assert.equal(decrypted, plaintext);
}

function testTamperedCipherFails() {
  const key = createOfflineEncryptionKey();
  const plaintext = JSON.stringify({ hello: "world" });
  const encrypted = encryptOfflineJson(plaintext, key);
  const wrongKey = createOfflineEncryptionKey();

  assert.throws(() => decryptOfflineJson(encrypted, wrongKey));
}

function testBootstrapMinimizationAndRestore() {
  const bootstrap = createBootstrapFixture();
  const minimized = minimizeBootstrapForOfflineCache(bootstrap);
  const restored = restoreBootstrapFromOfflineCache(minimized);

  assert.deepEqual(restored.users, []);
  assert.deepEqual(restored.workflowRules, []);
  assert.deepEqual(restored.pendingSyncOperations, []);
  assert.deepEqual(restored.consignations[0]?.recipientEmails, []);
  assert.equal(restored.consignations[0]?.emailSubject, undefined);
  assert.equal(restored.consignations[0]?.emailBody, undefined);
  assert.equal(restored.clients[0]?.contactEmail, "client@example.com");
}

testEncryptionRoundTrip();
testTamperedCipherFails();
testBootstrapMinimizationAndRestore();

console.log("Offline security tests passed.");
