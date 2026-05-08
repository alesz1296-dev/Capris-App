import "reflect-metadata";
import assert from "node:assert/strict";
import { SystemHealthService } from "../src/modules/system-health/system-health.service";

async function testProtectedHealthDetails() {
  const service = new SystemHealthService(
    {
      mediaAsset: {
        count: async () => 2
      },
      consignation: {
        count: async () => 1
      },
      reportSnapshot: {
        count: async () => 3
      },
      reminderRule: {
        count: async () => 4
      },
      deviceSession: {
        count: async () => 5
      }
    } as never
  );

  const details = await service.getProtectedHealthDetails();
  assert.equal(details.status, "attention");
  assert.equal(details.checks.failedUploads, 2);
  assert.equal(details.checks.failedEmails, 1);
  assert.equal(details.checks.reportSnapshots, 3);
}

async function main() {
  await testProtectedHealthDetails();
  console.log("System health tests passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
