import { z } from "zod";
import type { Comment, Observation } from "./domain";

const identifierSchema = z.string().trim().min(1);
const noteBodySchema = z.string().trim().min(1).max(1000);
const isoTimestampSchema = z.string().datetime({ offset: true });

export const createCommentSchema = z.object({
  organizationId: identifierSchema,
  taskId: identifierSchema,
  userId: identifierSchema,
  body: noteBodySchema,
  createdAt: isoTimestampSchema
});

export const createObservationSchema = z.object({
  organizationId: identifierSchema,
  taskId: identifierSchema,
  userId: identifierSchema,
  body: noteBodySchema,
  createdAt: isoTimestampSchema
});

export interface CreateCommentInput {
  organizationId: string;
  taskId: string;
  userId: string;
  body: string;
  createdAt: string;
}

export interface CreateObservationInput {
  organizationId: string;
  taskId: string;
  userId: string;
  body: string;
  createdAt: string;
}

export interface CommentMutationResult {
  item: Comment;
  message: string;
}

export interface ObservationMutationResult {
  item: Observation;
  message: string;
}
