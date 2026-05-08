import "reflect-metadata";
import assert from "node:assert/strict";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { ObjectStorageService } from "../src/modules/object-storage/object-storage.service";

async function testStoragePathsAreSignedForApiObjects() {
  process.env.MEDIA_URL_SIGNING_SECRET = "capris-test-media-secret";
  process.env.MEDIA_URL_TTL_SECONDS = "900";

  const service = new ObjectStorageService();
  const encodedKey = Buffer.from("evidence/org_capris/task_launch_display/2026/05/thumbnail-before.jpg").toString("base64url");
  const signedPath = service.createSignedReadPath(`/api/v1/storage/local/${encodedKey}`);

  assert.match(signedPath, /^\/api\/v1\/storage\/local\/.+\?expires=\d+&signature=/);
}

async function testLocalPendingPathsRemainUnchanged() {
  process.env.MEDIA_URL_SIGNING_SECRET = "capris-test-media-secret";

  const service = new ObjectStorageService();
  const localPath = "local-pending://thumbnail";

  assert.equal(service.createSignedReadPath(localPath), localPath);
}

async function testUnsignedMediaReadsAreRejected() {
  process.env.MEDIA_URL_SIGNING_SECRET = "capris-test-media-secret";

  const service = new ObjectStorageService();
  const encodedKey = Buffer.from("evidence/test-missing.jpg").toString("base64url");

  await assert.rejects(
    () => service.getObject("local", encodedKey),
    (error: unknown) => error instanceof ForbiddenException && `${error.message}`.includes("Signed media URL is required.")
  );
}

async function testInvalidSignaturesAreRejected() {
  process.env.MEDIA_URL_SIGNING_SECRET = "capris-test-media-secret";

  const service = new ObjectStorageService();
  const encodedKey = Buffer.from("evidence/test-invalid.jpg").toString("base64url");

  await assert.rejects(
    () => service.getObject("local", encodedKey, `${Date.now() + 60_000}`, "tampered-signature"),
    (error: unknown) => error instanceof ForbiddenException && `${error.message}`.includes("Signed media URL is invalid.")
  );
}

async function testValidSignedReadsAdvancePastAuthorization() {
  process.env.MEDIA_URL_SIGNING_SECRET = "capris-test-media-secret";
  process.env.MEDIA_URL_TTL_SECONDS = "900";

  const service = new ObjectStorageService();
  const encodedKey = Buffer.from("evidence/test-not-found.jpg").toString("base64url");
  const signedPath = service.createSignedReadPath(`/api/v1/storage/local/${encodedKey}`);
  const parsed = new URL(`http://capris.local${signedPath}`);
  const expires = parsed.searchParams.get("expires") ?? undefined;
  const signature = parsed.searchParams.get("signature") ?? undefined;

  await assert.rejects(
    () => service.getObject("local", encodedKey, expires, signature),
    (error: unknown) => error instanceof NotFoundException
  );
}

async function main() {
  await testStoragePathsAreSignedForApiObjects();
  await testLocalPendingPathsRemainUnchanged();
  await testUnsignedMediaReadsAreRejected();
  await testInvalidSignaturesAreRejected();
  await testValidSignedReadsAdvancePastAuthorization();
  console.log("Object storage tests passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
