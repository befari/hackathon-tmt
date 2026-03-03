import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../prisma/client.js';
import { requireAuth } from '../middleware/auth.js';

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

export const authRouter = Router();

// GET /api/auth/me — get or create user from JWT claims
authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const { oid, email, name } = req.user!;

  const user = await prisma.user.upsert({
    where: { entraId: oid },
    update: { email, name },
    create: { entraId: oid, email, name },
    include: {
      memberships: {
        include: { threatModel: { select: { id: true, name: true } } },
      },
    },
  });

  res.json({ data: user });
}));

// GET /api/auth/share/:token — join via share link
authRouter.get('/share/:token', requireAuth, asyncHandler(async (req, res) => {
  const { oid, email, name } = req.user!;
  const token = req.params.token as string;

  const link = await prisma.shareLink.findUnique({ where: { token } });
  if (!link || !link.active) {
    res.status(404).json({ error: 'Invalid or expired share link' });
    return;
  }
  if (link.expiresAt && link.expiresAt < new Date()) {
    res.status(410).json({ error: 'Share link has expired' });
    return;
  }

  // Upsert user
  const user = await prisma.user.upsert({
    where: { entraId: oid },
    update: { email, name },
    create: { entraId: oid, email, name },
  });

  // Add as member (don't downgrade existing role)
  const existing = await prisma.threatModelMember.findUnique({
    where: { userId_threatModelId: { userId: user.id, threatModelId: link.threatModelId } },
  });

  if (!existing) {
    await prisma.threatModelMember.create({
      data: {
        userId: user.id,
        threatModelId: link.threatModelId,
        role: link.role,
      },
    });
  }

  res.json({ data: { threatModelId: link.threatModelId, role: existing?.role || link.role } });
}));
