import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  analyzeOpportunityDocument,
  approveProjectOpportunity,
  archiveProjectOpportunity,
  getProjectOpportunity,
  listProjectOpportunities,
  reviewProjectOpportunity,
} from "../services/comoNextProjectOpening";

const ownerRelationship = z.enum(["owned", "potential_purchase", "land_for_units", "other_partnership", "development_management", "undecided"]);
const developmentStrategy = z.enum(["offplan_escrow", "offplan_construction", "build_for_sale", "build_for_rent", "joint_venture_land_for_units", "undecided"]);

export const comoNextProjectOpeningRouter = router({
  list: protectedProcedure.query(({ ctx }) => listProjectOpportunities(ctx.user)),
  get: protectedProcedure
    .input(z.object({ opportunityId: z.number().int().positive() }))
    .query(({ ctx, input }) => getProjectOpportunity({ user: ctx.user, opportunityId: input.opportunityId })),
  analyzeDocument: protectedProcedure
    .input(z.object({ opportunityId: z.number().int().positive(), opportunityDocumentId: z.number().int().positive() }))
    .mutation(({ ctx, input }) => analyzeOpportunityDocument({ user: ctx.user, ...input })),
  review: protectedProcedure
    .input(z.object({
      opportunityId: z.number().int().positive(),
      provisionalName: z.string().trim().min(1).max(255),
      ownerRelationship,
      developmentStrategy,
      objective: z.string().max(4000).nullable().optional(),
      facts: z.array(z.object({
        id: z.number().int().positive(),
        value: z.string().max(8000).nullable().optional(),
        reviewStatus: z.enum(["approved", "edited", "rejected"]),
        reviewNote: z.string().max(4000).nullable().optional(),
      })).max(80),
      manuallyReviewedDocumentIds: z.array(z.number().int().positive()).max(30).optional(),
    }))
    .mutation(({ ctx, input }) => reviewProjectOpportunity({ user: ctx.user, ...input })),
  approve: protectedProcedure
    .input(z.object({ opportunityId: z.number().int().positive() }))
    .mutation(({ ctx, input }) => approveProjectOpportunity({ user: ctx.user, opportunityId: input.opportunityId })),
  archive: protectedProcedure
    .input(z.object({ opportunityId: z.number().int().positive() }))
    .mutation(({ ctx, input }) => archiveProjectOpportunity({ user: ctx.user, opportunityId: input.opportunityId })),
});
