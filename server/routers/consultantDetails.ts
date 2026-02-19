import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getConsultantDetail, getAllConsultantDetails, upsertConsultantDetail } from "../db";

export const consultantDetailsRouter = router({
  get: publicProcedure
    .input(z.number())
    .query(({ input }) => {
      return getConsultantDetail(input);
    }),

  getAll: publicProcedure.query(() => {
    return getAllConsultantDetails();
  }),

  upsert: publicProcedure
    .input(
      z.object({
        consultantId: z.number(),
        phone2: z.string().optional(),
        location: z.string().optional(),
        classification: z.string().optional(),
        weight: z.string().optional(),
        yearsOfExperience: z.number().optional(),
        numberOfEngineers: z.number().optional(),
        notableClients: z.string().optional(),
        contactPerson: z.string().optional(),
        contactPersonPhone: z.string().optional(),
        contactPersonEmail: z.string().optional(),
      })
    )
    .mutation(({ input }) => {
      const { consultantId, ...data } = input;
      return upsertConsultantDetail(consultantId, data);
    }),
});
