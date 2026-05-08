import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createHmac, timingSafeEqual } from "node:crypto";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

type StorageDriver = "local" | "s3";

type StoredObject = {
  storagePath: string;
  driver: StorageDriver;
  objectKey: string;
};

const STORAGE_ROUTE_PREFIX = "/api/v1/storage/";
const DEFAULT_SIGNED_MEDIA_TTL_SECONDS = 15 * 60;

@Injectable()
export class ObjectStorageService {
  private readonly driver: StorageDriver;
  private readonly bucket: string;
  private readonly localRoot: string;
  private readonly signedReadSecret: string;
  private readonly signedReadTtlSeconds: number;
  private readonly s3Client?: S3Client;

  constructor() {
    this.bucket = process.env.S3_BUCKET?.trim() || "capris-local";
    const candidateRoots = [
      path.resolve(process.cwd(), "apps/api/object-storage"),
      path.resolve(process.cwd(), "object-storage")
    ];
    this.localRoot = candidateRoots.find((candidate) => fsSync.existsSync(path.dirname(candidate))) ?? candidateRoots[0];
    this.signedReadSecret =
      process.env.MEDIA_URL_SIGNING_SECRET?.trim() ||
      process.env.JWT_ACCESS_SECRET?.trim() ||
      "capris-dev-media-signing-secret";
    this.signedReadTtlSeconds = Number(process.env.MEDIA_URL_TTL_SECONDS?.trim() || DEFAULT_SIGNED_MEDIA_TTL_SECONDS);
    const s3Endpoint = process.env.S3_ENDPOINT?.trim();
    const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();

    if (s3Endpoint && accessKeyId && secretAccessKey) {
      this.driver = "s3";
      this.s3Client = new S3Client({
        endpoint: s3Endpoint,
        region: process.env.S3_REGION?.trim() || "us-east-1",
        forcePathStyle: true,
        credentials: {
          accessKeyId,
          secretAccessKey
        }
      });
    } else {
      this.driver = "local";
    }
  }

  async storeEvidenceCapture(input: {
    organizationId: string;
    taskId: string;
    capturedAt: string;
    fileName: string;
    mimeType: string;
    originalBytes: Buffer;
    thumbnailBytes?: Buffer;
  }) {
    const originalKey = this.createObjectKey(input.organizationId, input.taskId, input.capturedAt, "original", input.fileName);
    const thumbnailKey = this.createObjectKey(input.organizationId, input.taskId, input.capturedAt, "thumbnail", input.fileName);

    const original = await this.putObject({
      objectKey: originalKey,
      bytes: input.originalBytes,
      mimeType: input.mimeType
    });
    const thumbnail = await this.putObject({
      objectKey: thumbnailKey,
      bytes: input.thumbnailBytes ?? input.originalBytes,
      mimeType: input.mimeType
    });

    return {
      originalStoragePath: original.storagePath,
      thumbnailStoragePath: thumbnail.storagePath
    };
  }

  createSignedReadPath(storagePath: string, ttlSeconds = this.signedReadTtlSeconds) {
    if (!storagePath.startsWith(STORAGE_ROUTE_PREFIX)) {
      return storagePath;
    }

    const expires = Date.now() + Math.max(60, ttlSeconds) * 1000;
    const pathname = this.extractPathname(storagePath);
    const signature = this.createReadSignature(pathname, expires);
    return `${pathname}?expires=${expires}&signature=${signature}`;
  }

  async getObject(scope: string, encodedKey: string, expires?: string, signature?: string) {
    this.assertSignedReadAccess(scope, encodedKey, expires, signature);
    const driver = this.parseDriver(scope);
    const objectKey = this.decodeObjectKey(encodedKey);
    if (driver === "s3") {
      return this.getS3Object(objectKey);
    }

    return this.getLocalObject(objectKey);
  }

  private async putObject(input: { objectKey: string; bytes: Buffer; mimeType: string }): Promise<StoredObject> {
    if (this.driver === "s3" && this.s3Client) {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: input.objectKey,
          Body: input.bytes,
          ContentType: input.mimeType
        })
      );

      return {
        driver: "s3",
        objectKey: input.objectKey,
        storagePath: this.buildStoragePath("s3", input.objectKey)
      };
    }

    const destination = path.join(this.localRoot, this.bucket, input.objectKey);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, input.bytes);

    return {
      driver: "local",
      objectKey: input.objectKey,
      storagePath: this.buildStoragePath("local", input.objectKey)
    };
  }

  private async getLocalObject(objectKey: string) {
    const filePath = path.join(this.localRoot, this.bucket, objectKey);
    try {
      const bytes = await fs.readFile(filePath);
      return {
        bytes,
        contentType: this.inferContentType(filePath)
      };
    } catch {
      throw new NotFoundException(`Stored object ${objectKey} was not found.`);
    }
  }

  private async getS3Object(objectKey: string) {
    if (!this.s3Client) {
      throw new NotFoundException("S3 storage is not configured.");
    }

    const result = await this.s3Client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: objectKey
      })
    );

    if (!result.Body) {
      throw new NotFoundException(`Stored object ${objectKey} was not found.`);
    }

    const stream = result.Body as Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return {
      bytes: Buffer.concat(chunks),
      contentType: result.ContentType ?? this.inferContentType(objectKey)
    };
  }

  private buildStoragePath(driver: StorageDriver, objectKey: string) {
    return `/api/v1/storage/${driver}/${Buffer.from(objectKey).toString("base64url")}`;
  }

  private assertSignedReadAccess(scope: string, encodedKey: string, expires?: string, signature?: string) {
    if (!expires?.trim() || !signature?.trim()) {
      throw new ForbiddenException("Signed media URL is required.");
    }

    const expiresAt = Number(expires);
    if (!Number.isFinite(expiresAt)) {
      throw new ForbiddenException("Signed media URL is invalid.");
    }

    if (Date.now() > expiresAt) {
      throw new ForbiddenException("Signed media URL has expired.");
    }

    const pathname = `${STORAGE_ROUTE_PREFIX}${scope}/${encodedKey}`;
    const expectedSignature = this.createReadSignature(pathname, expiresAt);
    const providedSignature = signature.trim();
    if (!this.signaturesMatch(expectedSignature, providedSignature)) {
      throw new ForbiddenException("Signed media URL is invalid.");
    }
  }

  private decodeObjectKey(encodedKey: string) {
    return Buffer.from(encodedKey, "base64url").toString("utf8");
  }

  private createObjectKey(organizationId: string, taskId: string, capturedAt: string, variant: "original" | "thumbnail", fileName: string) {
    const timestamp = new Date(capturedAt);
    const year = `${timestamp.getUTCFullYear()}`;
    const month = `${timestamp.getUTCMonth() + 1}`.padStart(2, "0");
    const normalizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
    return `evidence/${organizationId}/${taskId}/${year}/${month}/${variant}-${Date.now()}-${normalizedFileName}`;
  }

  private parseDriver(scope: string): StorageDriver {
    if (scope === "local" || scope === "s3") {
      return scope;
    }

    throw new NotFoundException(`Storage scope ${scope} is not supported.`);
  }

  private inferContentType(fileName: string) {
    const extension = path.extname(fileName).toLowerCase();
    if (extension === ".png") {
      return "image/png";
    }

    if (extension === ".webp") {
      return "image/webp";
    }

    return "image/jpeg";
  }

  private extractPathname(storagePath: string) {
    return new URL(storagePath, "http://capris.local").pathname;
  }

  private createReadSignature(pathname: string, expires: number) {
    return createHmac("sha256", this.signedReadSecret).update(`${pathname}:${expires}`).digest("base64url");
  }

  private signaturesMatch(expected: string, provided: string) {
    if (expected.length !== provided.length) {
      return false;
    }

    return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  }
}
