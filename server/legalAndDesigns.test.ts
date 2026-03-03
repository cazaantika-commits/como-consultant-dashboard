import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb } from './db';
import { legalSetupRecords, designsAndPermits, users, projects } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

describe('Legal Setup and Designs Routers', () => {
  let db: any;
  let testUserId: number;
  let testProjectId: number;
  let testLegalSetupId: number;
  let testDesignPermitId: number;

  beforeAll(async () => {
    db = await getDb();
    if (!db) throw new Error('Database not available');

    // Create test user
    const userResult = await db.insert(users).values({
      openId: `test-user-${Date.now()}`,
      name: 'Test User',
      email: 'test@example.com',
      loginMethod: 'test',
    });
    testUserId = Number(userResult[0].insertId);

    // Create test project
    const projectResult = await db.insert(projects).values({
      userId: testUserId,
      name: 'Test Project',
      description: 'Test project for legal and designs',
    });
    testProjectId = Number(projectResult[0].insertId);
  });

  afterAll(async () => {
    if (db) {
      // Clean up test data
      await db.delete(designsAndPermits).where(eq(designsAndPermits.userId, testUserId));
      await db.delete(legalSetupRecords).where(eq(legalSetupRecords.userId, testUserId));
      await db.delete(projects).where(eq(projects.userId, testUserId));
      await db.delete(users).where(eq(users.id, testUserId));
    }
  });

  describe('Legal Setup Records', () => {
    it('should create a legal setup record', async () => {
      const result = await db.insert(legalSetupRecords).values({
        userId: testUserId,
        projectId: testProjectId,
        titleDeedStatus: 'مكتمل',
        titleDeedNumber: 'TD-12345',
        ddaRegistrationStatus: 'مكتمل',
        completionStatus: 'pending',
      });
      testLegalSetupId = Number(result[0].insertId);
      expect(testLegalSetupId).toBeGreaterThan(0);
    });

    it('should retrieve legal setup record by ID', async () => {
      const results = await db.select().from(legalSetupRecords).where(
        eq(legalSetupRecords.id, testLegalSetupId)
      );
      expect(results).toHaveLength(1);
      expect(results[0].titleDeedNumber).toBe('TD-12345');
    });

    it('should update legal setup record', async () => {
      await db.update(legalSetupRecords)
        .set({ titleDeedStatus: 'قيد الإجراء' })
        .where(eq(legalSetupRecords.id, testLegalSetupId));

      const results = await db.select().from(legalSetupRecords).where(
        eq(legalSetupRecords.id, testLegalSetupId)
      );
      expect(results[0].titleDeedStatus).toBe('قيد الإجراء');
    });

    it('should list legal setup records by project', async () => {
      const results = await db.select().from(legalSetupRecords).where(
        eq(legalSetupRecords.projectId, testProjectId)
      );
      expect(results.length).toBeGreaterThan(0);
    });

    it('should delete legal setup record', async () => {
      await db.delete(legalSetupRecords).where(eq(legalSetupRecords.id, testLegalSetupId));
      const results = await db.select().from(legalSetupRecords).where(
        eq(legalSetupRecords.id, testLegalSetupId)
      );
      expect(results).toHaveLength(0);
    });
  });

  describe('Designs and Permits Records', () => {
    it('should create a designs and permits record', async () => {
      const result = await db.insert(designsAndPermits).values({
        userId: testUserId,
        projectId: testProjectId,
        architecturalDesignStatus: 'مكتمل',
        architecturalDesignDate: '2026-03-01',
        engineeringDesignStatus: 'قيد الإعداد',
        buildingPermitStatus: 'قيد الانتظار',
        completionStatus: 'pending',
      });
      testDesignPermitId = Number(result[0].insertId);
      expect(testDesignPermitId).toBeGreaterThan(0);
    });

    it('should retrieve designs and permits record by ID', async () => {
      const results = await db.select().from(designsAndPermits).where(
        eq(designsAndPermits.id, testDesignPermitId)
      );
      expect(results).toHaveLength(1);
      expect(results[0].architecturalDesignStatus).toBe('مكتمل');
    });

    it('should update designs and permits record', async () => {
      await db.update(designsAndPermits)
        .set({ 
          buildingPermitStatus: 'مكتمل',
          buildingPermitNumber: 'BP-98765',
        })
        .where(eq(designsAndPermits.id, testDesignPermitId));

      const results = await db.select().from(designsAndPermits).where(
        eq(designsAndPermits.id, testDesignPermitId)
      );
      expect(results[0].buildingPermitStatus).toBe('مكتمل');
      expect(results[0].buildingPermitNumber).toBe('BP-98765');
    });

    it('should list designs and permits records by project', async () => {
      const results = await db.select().from(designsAndPermits).where(
        eq(designsAndPermits.projectId, testProjectId)
      );
      expect(results.length).toBeGreaterThan(0);
    });

    it('should store fees correctly', async () => {
      await db.update(designsAndPermits)
        .set({
          designConsultationFees: 50000,
          buildingPermitFees: 25000,
          municipalityDesignReviewFees: 15000,
        })
        .where(eq(designsAndPermits.id, testDesignPermitId));

      const results = await db.select().from(designsAndPermits).where(
        eq(designsAndPermits.id, testDesignPermitId)
      );
      expect(results[0].designConsultationFees).toBe(50000);
      expect(results[0].buildingPermitFees).toBe(25000);
      expect(results[0].municipalityDesignReviewFees).toBe(15000);
    });

    it('should delete designs and permits record', async () => {
      await db.delete(designsAndPermits).where(eq(designsAndPermits.id, testDesignPermitId));
      const results = await db.select().from(designsAndPermits).where(
        eq(designsAndPermits.id, testDesignPermitId)
      );
      expect(results).toHaveLength(0);
    });
  });

  describe('Data Integrity', () => {
    it('should maintain referential integrity with projects', async () => {
      // Create a legal setup record
      const legalResult = await db.insert(legalSetupRecords).values({
        userId: testUserId,
        projectId: testProjectId,
        titleDeedStatus: 'مكتمل',
        completionStatus: 'pending',
      });
      const legalId = Number(legalResult[0].insertId);

      // Verify the record exists
      const results = await db.select().from(legalSetupRecords).where(
        eq(legalSetupRecords.id, legalId)
      );
      expect(results).toHaveLength(1);

      // Clean up
      await db.delete(legalSetupRecords).where(eq(legalSetupRecords.id, legalId));
    });

    it('should handle JSON fields for obligations and conditions', async () => {
      const obligations = JSON.stringify([
        { obligation: 'التزام 1', status: 'pending' },
        { obligation: 'التزام 2', status: 'completed' },
      ]);

      const result = await db.insert(legalSetupRecords).values({
        userId: testUserId,
        projectId: testProjectId,
        titleDeedStatus: 'مكتمل',
        legalObligations: obligations,
        completionStatus: 'pending',
      });
      const recordId = Number(result[0].insertId);

      const results = await db.select().from(legalSetupRecords).where(
        eq(legalSetupRecords.id, recordId)
      );
      expect(results[0].legalObligations).toBe(obligations);

      // Clean up
      await db.delete(legalSetupRecords).where(eq(legalSetupRecords.id, recordId));
    });
  });
});
