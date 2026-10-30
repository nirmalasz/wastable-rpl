import { and, desc, eq, inArray } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { moderateListing } from '../../ai/agents/moderation-agent.js';
import { getDb } from '../../db/client.js';
import {
  appeals,
  listings,
  moderationCases,
  reports,
  transactions,
  users,
} from '../../db/schema.js';
import { URGENT_WINDOW_HOURS } from '../../lib/constants.js';
import { HttpError } from '../../lib/http-error.js';
import { currentUser, requireAuth, requireRole, requireVerified } from '../../middleware/auth.js';
import { userWriteLimiter } from '../../middleware/rate-limit.js';
import { notify, notifyAdmins } from '../notifications/notifications.service.js';
import { registerViolation } from './moderation.service.js';

/** UC16-UC19 | FR-12, FR-13, FR-14, FR-16 (admin makes the final decision) */
export const moderationRouter = Router();

const idParam = z.object({ id: z.uuid() });
const admin = [requireAuth, requireRole('ADMIN')];

moderationRouter.post(
  '/listings/:id/reports',
  requireAuth,
  requireVerified,
  userWriteLimiter,
  async (req, res) => {
    const { id } = idParam.parse(req.params);
    const { reason } = z.object({ reason: z.string().trim().min(3).max(500) }).parse(req.body);
    const me = currentUser(res);
    const db = getDb();

    const [listing] = await db.select().from(listings).where(eq(listings.id, id));
    if (!listing) throw HttpError.notFound('Listing not found');
    if (listing.sellerId === me.id)
      throw HttpError.badRequest('You cannot report your own listing');
    if (listing.status === 'REMOVED') throw HttpError.conflict('This listing was already removed');

    const [alreadyReported] = await db
      .select({ id: reports.id })
      .from(reports)
      .where(and(eq(reports.listingId, id), eq(reports.reporterId, me.id)));
    if (alreadyReported) throw HttpError.conflict('You have already reported this listing.');

    const [openCase] = await db
      .select()
      .from(moderationCases)
      .where(and(eq(moderationCases.listingId, id), eq(moderationCases.status, 'OPEN')));
    // Pre-assess with the Moderation Agent (rule-based filter when Gemini is down) for new cases.
    const assessment = openCase
      ? null
      : await moderateListing(
          `${listing.title}\n${listing.description ?? ''}\nReport: ${reason}`,
          me.id,
        );

    const caseRow = await db.transaction(async (tx) => {
      let current = openCase;
      if (!current) {
        [current] = await tx
          .insert(moderationCases)
          .values({
            listingId: id,
            source: 'USER_REPORT',
            aiFlags: assessment ? [assessment.verdict, ...assessment.dietFlags] : [],
            aiRationale:
              assessment?.rationale ??
              (assessment?.matched.length
                ? `Matched keywords: ${assessment.matched.join(', ')}`
                : null),
          })
          .returning();
        if (!current) throw new Error('case insert failed');
        await notifyAdmins(tx, 'NEW_CASE', `Listing "${listing.title}" was reported: ${reason}`);
      }
      await tx
        .insert(reports)
        .values({ listingId: id, reporterId: me.id, caseId: current.id, reason });
      if (listing.status === 'AVAILABLE') {
        await tx
          .update(listings)
          .set({ status: 'UNDER_REVIEW', updatedAt: new Date() })
          .where(eq(listings.id, id));
        await notify(
          tx,
          listing.sellerId,
          'LISTING_HIDDEN',
          `"${listing.title}" is hidden while an admin reviews a report.`,
        );
      }
      return current;
    });
    res.status(201).json({ caseId: caseRow.id });
  },
);

moderationRouter.get('/moderation/cases', ...admin, async (req, res) => {
  const { status } = z
    .object({ status: z.enum(['OPEN', 'DISMISSED', 'VIOLATION_CONFIRMED']).default('OPEN') })
    .parse(req.query);
  const db = getDb();
  const cases = await db
    .select({
      id: moderationCases.id,
      source: moderationCases.source,
      status: moderationCases.status,
      aiFlags: moderationCases.aiFlags,
      aiRationale: moderationCases.aiRationale,
      adminDecision: moderationCases.adminDecision,
      createdAt: moderationCases.createdAt,
      listingId: listings.id,
      listingTitle: listings.title,
      listingDescription: listings.description,
      listingStatus: listings.status,
      sellerId: users.id,
      sellerName: users.name,
      sellerViolations: users.violationCount,
    })
    .from(moderationCases)
    .innerJoin(listings, eq(listings.id, moderationCases.listingId))
    .innerJoin(users, eq(users.id, listings.sellerId))
    .where(eq(moderationCases.status, status))
    .orderBy(desc(moderationCases.createdAt))
    .limit(100);

  const caseIds = cases.map((c) => c.id);
  const reportRows = caseIds.length
    ? await db
        .select({ caseId: reports.caseId, reason: reports.reason, createdAt: reports.createdAt })
        .from(reports)
        .where(inArray(reports.caseId, caseIds))
    : [];
  res.json({
    cases: cases.map((c) => ({
      ...c,
      reports: reportRows.filter((r) => r.caseId === c.id),
    })),
  });
});

moderationRouter.patch('/moderation/cases/:id', ...admin, async (req, res) => {
  const { id } = idParam.parse(req.params);
  const body = z
    .object({
      decision: z.enum(['DISMISS', 'CONFIRM_VIOLATION']),
      note: z.string().trim().max(1000).optional(),
    })
    .parse(req.body);
  const me = currentUser(res);

  const result = await getDb().transaction(async (tx) => {
    const [found] = await tx
      .select()
      .from(moderationCases)
      .where(eq(moderationCases.id, id))
      .for('update');
    if (!found) throw HttpError.notFound('Case not found');
    if (found.status !== 'OPEN') throw HttpError.conflict('This case was already decided');
    const [listing] = await tx.select().from(listings).where(eq(listings.id, found.listingId));
    if (!listing) throw HttpError.notFound('Listing not found');
    const reporters = await tx
      .select({ userId: reports.reporterId })
      .from(reports)
      .where(eq(reports.caseId, id));

    const confirmed = body.decision === 'CONFIRM_VIOLATION';
    await tx
      .update(moderationCases)
      .set({
        status: confirmed ? 'VIOLATION_CONFIRMED' : 'DISMISSED',
        adminDecision: body.note ?? body.decision,
        decidedBy: me.id,
        decidedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(moderationCases.id, id));

    if (!confirmed) {
      const expired = listing.expiryDate.getTime() <= Date.now();
      if (listing.status === 'UNDER_REVIEW') {
        await tx
          .update(listings)
          .set({
            status: expired ? 'EXPIRED' : 'AVAILABLE',
            isUrgent:
              !expired &&
              listing.expiryDate.getTime() - Date.now() <= URGENT_WINDOW_HOURS * 3_600_000,
            updatedAt: new Date(),
          })
          .where(eq(listings.id, listing.id));
        await notify(
          tx,
          listing.sellerId,
          'LISTING_RESTORED',
          `"${listing.title}" passed review and is live again.`,
        );
      }
      for (const r of new Set(reporters.map((x) => x.userId))) {
        await notify(
          tx,
          r,
          'REPORT_DISMISSED',
          `Your report on "${listing.title}" was reviewed and dismissed.`,
        );
      }
      return { status: 'DISMISSED' as const, suspended: false };
    }

    // A claim that is still open on a removed listing cannot be completed.
    const openClaims = await tx
      .update(transactions)
      .set({ status: 'CANCELLED', updatedAt: new Date() })
      .where(and(eq(transactions.listingId, listing.id), eq(transactions.status, 'PENDING')))
      .returning({ claimerId: transactions.claimerId });
    for (const c of openClaims) {
      await notify(
        tx,
        c.claimerId,
        'CLAIM_CANCELLED',
        `"${listing.title}" was removed by a moderator.`,
      );
    }
    await tx
      .update(listings)
      .set({ status: 'REMOVED', updatedAt: new Date() })
      .where(eq(listings.id, listing.id));
    await notify(
      tx,
      listing.sellerId,
      'LISTING_REMOVED',
      `"${listing.title}" was removed for violating the rules.`,
    );
    for (const r of new Set(reporters.map((x) => x.userId))) {
      await notify(
        tx,
        r,
        'REPORT_ACTIONED',
        `Thanks, "${listing.title}" was removed after your report.`,
      );
    }
    const violation = await registerViolation(
      tx,
      listing.sellerId,
      `listing "${listing.title}" removed`,
    );
    return { status: 'VIOLATION_CONFIRMED' as const, suspended: violation.suspended };
  });
  res.json(result);
});

// ---------- Appeals (UC19) ----------

moderationRouter.post('/appeals', requireAuth, async (req, res) => {
  const { reason } = z.object({ reason: z.string().trim().min(10).max(1000) }).parse(req.body);
  const me = currentUser(res);
  if (me.status !== 'SUSPENDED') throw HttpError.badRequest('Only suspended accounts can appeal');
  const db = getDb();

  const [pending] = await db
    .select({ id: appeals.id })
    .from(appeals)
    .where(and(eq(appeals.userId, me.id), eq(appeals.status, 'PENDING')));
  if (pending) throw HttpError.conflict('You already have an appeal under review');

  const [lastCase] = await db
    .select({ id: moderationCases.id })
    .from(moderationCases)
    .innerJoin(listings, eq(listings.id, moderationCases.listingId))
    .where(and(eq(listings.sellerId, me.id), eq(moderationCases.status, 'VIOLATION_CONFIRMED')))
    .orderBy(desc(moderationCases.decidedAt))
    .limit(1);

  const appeal = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(appeals)
      .values({ userId: me.id, caseId: lastCase?.id ?? null, reason })
      .returning();
    await notifyAdmins(tx, 'APPEAL_SUBMITTED', 'A suspended user submitted an appeal.');
    return row;
  });
  res.status(201).json({ appeal });
});

moderationRouter.get('/appeals/mine', requireAuth, async (_req, res) => {
  const rows = await getDb()
    .select()
    .from(appeals)
    .where(eq(appeals.userId, currentUser(res).id))
    .orderBy(desc(appeals.createdAt));
  res.json({ appeals: rows });
});

moderationRouter.get('/appeals', ...admin, async (req, res) => {
  const { status } = z
    .object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).default('PENDING') })
    .parse(req.query);
  const rows = await getDb()
    .select({
      id: appeals.id,
      reason: appeals.reason,
      status: appeals.status,
      createdAt: appeals.createdAt,
      caseId: appeals.caseId,
      userId: users.id,
      userName: users.name,
      userEmail: users.email,
      violationCount: users.violationCount,
    })
    .from(appeals)
    .innerJoin(users, eq(users.id, appeals.userId))
    .where(eq(appeals.status, status))
    .orderBy(desc(appeals.createdAt))
    .limit(100);
  res.json({ appeals: rows });
});

moderationRouter.patch('/appeals/:id', ...admin, async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { decision } = z.object({ decision: z.enum(['APPROVE', 'REJECT']) }).parse(req.body);

  const result = await getDb().transaction(async (tx) => {
    const [found] = await tx.select().from(appeals).where(eq(appeals.id, id)).for('update');
    if (!found) throw HttpError.notFound('Appeal not found');
    if (found.status !== 'PENDING') throw HttpError.conflict('This appeal was already decided');
    const approved = decision === 'APPROVE';
    const [row] = await tx
      .update(appeals)
      .set({
        status: approved ? 'APPROVED' : 'REJECTED',
        decidedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(appeals.id, id))
      .returning();
    if (approved) {
      await tx
        .update(users)
        .set({ status: 'ACTIVE', violationCount: 0, updatedAt: new Date() })
        .where(eq(users.id, found.userId));
    }
    await notify(
      tx,
      found.userId,
      'APPEAL_DECIDED',
      approved
        ? 'Your appeal was approved. Your account is active again.'
        : 'Your appeal was rejected. Your account remains suspended.',
    );
    return row;
  });
  res.json({ appeal: result });
});
