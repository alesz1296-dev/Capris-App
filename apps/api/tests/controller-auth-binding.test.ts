import assert from "node:assert/strict";
import { NotesController } from "../src/modules/notes/notes.controller";

async function testNotesControllerUsesAuthenticatedContextForCommentCreation() {
  let capturedInput: unknown;

  const controller = new NotesController(
    {
      createComment: async (input: unknown) => {
        capturedInput = input;
        return { ok: true };
      }
    } as never,
    {
      getActor: () => ({
        sub: "user_field_001",
        organizationId: "org_capris",
        email: "field@example.com",
        role: "field_user",
        locale: "es",
        name: "Field User",
        sessionId: "session_1",
        type: "access",
        iat: 1,
        exp: 9999999999
      })
    } as never
  );

  await controller.createComment(
    {
      organizationId: "org_other",
      taskId: "task_123",
      userId: "user_other",
      body: "Need support",
      createdAt: "2026-05-08T12:00:00.000Z"
    },
    {
      auth: {
        sub: "user_field_001",
        organizationId: "org_capris",
        email: "field@example.com",
        role: "field_user",
        locale: "es",
        name: "Field User",
        sessionId: "session_1",
        type: "access",
        iat: 1,
        exp: 9999999999
      }
    } as never
  );

  assert.deepEqual(capturedInput, {
    organizationId: "org_capris",
    taskId: "task_123",
    userId: "user_field_001",
    body: "Need support",
    createdAt: "2026-05-08T12:00:00.000Z"
  });
}

async function main() {
  await testNotesControllerUsesAuthenticatedContextForCommentCreation();
  console.log("Controller auth binding tests passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
