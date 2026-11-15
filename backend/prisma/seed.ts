import { PrismaClient, Role, TicketPriority, TicketStatus, AuditAction } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const SAMPLE_ISSUES = [
  { title: 'Cannot reset password via email link', category: 'login', priority: TicketPriority.HIGH },
  { title: 'Invoice #4092 shows wrong tax amount', category: 'billing', priority: TicketPriority.MEDIUM },
  { title: 'App crashes when uploading PDF over 3MB', category: 'bug', priority: TicketPriority.URGENT },
  { title: 'Add dark mode support to customer portal', category: 'feature_request', priority: TicketPriority.LOW },
  { title: 'Dashboard takes 12 seconds to load on Safari', category: 'performance', priority: TicketPriority.HIGH },
  { title: 'Two-factor authentication code rejected', category: 'login', priority: TicketPriority.URGENT },
  { title: 'Need to update company VAT number on billing profile', category: 'billing', priority: TicketPriority.LOW },
  { title: 'Webhook notifications are delayed by 15 minutes', category: 'performance', priority: TicketPriority.MEDIUM },
  { title: 'Export to CSV button returns empty file', category: 'bug', priority: TicketPriority.HIGH },
  { title: 'Requesting SSO SAML integration for Okta', category: 'feature_request', priority: TicketPriority.MEDIUM },
];

const STATUSES: TicketStatus[] = [
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
  TicketStatus.RESOLVED,
  TicketStatus.CLOSED,
];

async function main() {
  console.log('🌱 Seeding database...');

  const passwordHash = await bcrypt.hash('Password123!', 12);

  await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: { passwordHash, role: Role.ADMIN, name: 'Demo Admin' },
    create: { email: 'admin@demo.com', name: 'Demo Admin', passwordHash, role: Role.ADMIN },
  });

  const agent = await prisma.user.upsert({
    where: { email: 'agent@demo.com' },
    update: { passwordHash, role: Role.AGENT, name: 'Demo Agent' },
    create: { email: 'agent@demo.com', name: 'Demo Agent', passwordHash, role: Role.AGENT },
  });

  const customer = await prisma.user.upsert({
    where: { email: 'customer@demo.com' },
    update: { passwordHash, role: Role.CUSTOMER, name: 'Demo Customer' },
    create: { email: 'customer@demo.com', name: 'Demo Customer', passwordHash, role: Role.CUSTOMER },
  });

  // Clear old tickets so re-running the seed always ends with exactly 50
  await prisma.auditLog.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.ticket.deleteMany();

  for (let i = 1; i <= 50; i++) {
    const template = SAMPLE_ISSUES[(i - 1) % SAMPLE_ISSUES.length]!;
    const status = STATUSES[(i - 1) % STATUSES.length]!;
    const isAssigned = status !== TicketStatus.OPEN || i % 3 === 0;
    const createdAt = new Date(Date.now() - i * 3600 * 1000 * 6);

    const ticket = await prisma.ticket.create({
      data: {
        title: `${template.title} (#${i})`,
        description: `Customer reported issue #${i}: "${template.title}". Steps to reproduce have been verified in the staging environment.`,
        category: template.category,
        priority: template.priority,
        status,
        createdById: customer.id,
        assignedToId: isAssigned ? agent.id : null,
        version: isAssigned ? 2 : 1,
        createdAt,
      },
    });

    await prisma.auditLog.create({
      data: {
        ticketId: ticket.id,
        actorId: customer.id,
        action: AuditAction.CREATED,
        oldValue: undefined,
        newValue: { status: TicketStatus.OPEN, priority: template.priority },
        createdAt,
      },
    });
  }

  console.log('✅ Seed complete: 3 demo users + 50 tickets created!');
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });