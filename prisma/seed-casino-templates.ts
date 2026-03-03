import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { readFileSync } from "fs";
import { resolve } from "path";

const dbUrl = process.env.DATABASE_URL ?? "file:./dev.db";
const adapter = new PrismaLibSql({ url: dbUrl });
const prisma = new PrismaClient({ adapter });

// ─── SMS Scripts (Script model, type="SMS") ─────────────────────────────────

const SMS_SCRIPTS = [
  {
    name: "Casino - Welcome SMS",
    type: "SMS" as const,
    content:
      "Welcome {{firstName}}! 500 free coins waiting for you. Play now: {{link}}",
  },
  {
    name: "Casino - First Deposit SMS",
    type: "SMS" as const,
    content:
      "Nice session {{firstName}}! Double your coins with first deposit. Expires tonight: {{link}}",
  },
  {
    name: "Casino - Comeback SMS",
    type: "SMS" as const,
    content:
      "We miss you {{firstName}}! 100 free coins waiting — no deposit needed: {{link}}",
  },
  {
    name: "Casino - VIP Upgrade SMS",
    type: "SMS" as const,
    content:
      "Congrats {{firstName}} — upgraded to {{vipTier}}! Exclusive cashback unlocked: {{link}}",
  },
  {
    name: "Casino - Hot Streak SMS",
    type: "SMS" as const,
    content:
      "{{firstName}} you're on fire! Lock in those wins — play for real: {{link}}",
  },
];

// ─── Email Templates (EmailTemplate model) ──────────────────────────────────

const EMAIL_TEMPLATES = [
  // Welcome Drip — Email 1 of 4
  {
    name: "Casino - Welcome Drip 1: Welcome",
    subject: "Welcome to Stake, {{firstName}}! Your 500 free coins are ready",
    file: "casino_welcome_1.html",
    trigger: "welcome_drip_1",
    variables: ["firstName", "link", "baseUrl"],
  },
  // Welcome Drip — Email 2 of 4
  {
    name: "Casino - Welcome Drip 2: How To Play",
    subject: "{{firstName}}, here's how to win big at Stake",
    file: "casino_welcome_2.html",
    trigger: "welcome_drip_2",
    variables: ["firstName", "link", "baseUrl"],
  },
  // Welcome Drip — Email 3 of 4
  {
    name: "Casino - Welcome Drip 3: First Deposit",
    subject: "Double your coins today, {{firstName}}",
    file: "casino_welcome_3.html",
    trigger: "welcome_drip_3",
    variables: ["firstName", "link", "baseUrl"],
  },
  // Welcome Drip — Email 4 of 4
  {
    name: "Casino - Welcome Drip 4: VIP Preview",
    subject: "{{firstName}}, unlock VIP rewards at Stake",
    file: "casino_welcome_4.html",
    trigger: "welcome_drip_4",
    variables: ["firstName", "link", "baseUrl"],
  },
  // Re-engagement — Email 1 of 3
  {
    name: "Casino - Re-engagement 1: We Miss You",
    subject: "{{firstName}}, we saved your seat at the table",
    file: "casino_reengage_1.html",
    trigger: "reengage_1",
    variables: ["firstName", "link", "freeCoins", "baseUrl"],
  },
  // Re-engagement — Email 2 of 3
  {
    name: "Casino - Re-engagement 2: Free Coins",
    subject: "100 free coins are waiting, {{firstName}}",
    file: "casino_reengage_2.html",
    trigger: "reengage_2",
    variables: ["firstName", "link", "freeCoins", "baseUrl"],
  },
  // Re-engagement — Email 3 of 3
  {
    name: "Casino - Re-engagement 3: Last Chance",
    subject: "Last chance, {{firstName}} — your coins expire tomorrow",
    file: "casino_reengage_3.html",
    trigger: "reengage_3",
    variables: ["firstName", "link", "freeCoins", "baseUrl"],
  },
  // VIP Nurture (weekly)
  {
    name: "Casino - VIP Weekly Digest",
    subject: "Your VIP weekly update, {{firstName}}",
    file: "casino_vip_weekly.html",
    trigger: "vip_weekly",
    variables: [
      "firstName",
      "vipTier",
      "cashbackAmount",
      "weeklyStats",
      "link",
      "baseUrl",
    ],
  },
  // Deposit Confirmation
  {
    name: "Casino - Deposit Confirmation",
    subject: "Deposit confirmed — {{depositAmount}} added, {{firstName}}",
    file: "casino_deposit_confirm.html",
    trigger: "deposit_confirm",
    variables: [
      "firstName",
      "depositAmount",
      "bonusAmount",
      "balance",
      "link",
      "baseUrl",
    ],
  },
  // Hot Streak Congratulations
  {
    name: "Casino - Hot Streak Congratulations",
    subject: "You're on fire, {{firstName}}! Keep the streak going",
    file: "casino_hot_streak.html",
    trigger: "hot_streak",
    variables: [
      "firstName",
      "winAmount",
      "winCount",
      "link",
      "baseUrl",
    ],
  },
];

async function main() {
  const assetsDir = resolve(__dirname, "../public/email-assets/casino");

  // ── Seed SMS Scripts ──────────────────────────────────────────────────────
  console.log("\n── SMS Scripts ──");
  for (const sms of SMS_SCRIPTS) {
    const existing = await prisma.script.findFirst({
      where: { name: sms.name },
    });
    if (existing) {
      console.log(`[skip] "${sms.name}" already exists (id: ${existing.id})`);
      continue;
    }
    const created = await prisma.script.create({
      data: {
        name: sms.name,
        type: sms.type,
        content: sms.content,
        isDefault: false,
      },
    });
    console.log(`[created] "${sms.name}" (id: ${created.id})`);
  }

  // ── Seed Email Templates ──────────────────────────────────────────────────
  console.log("\n── Email Templates ──");
  for (const tpl of EMAIL_TEMPLATES) {
    const existing = await prisma.emailTemplate.findFirst({
      where: { name: tpl.name },
    });
    if (existing) {
      console.log(`[skip] "${tpl.name}" already exists (id: ${existing.id})`);
      continue;
    }

    const htmlPath = resolve(assetsDir, tpl.file);
    let htmlBody: string;
    try {
      htmlBody = readFileSync(htmlPath, "utf-8");
    } catch {
      console.log(`[warn] HTML file not found: ${htmlPath} — using inline body`);
      htmlBody = `<p>Template placeholder for ${tpl.name}</p>`;
    }

    const created = await prisma.emailTemplate.create({
      data: {
        name: tpl.name,
        subject: tpl.subject,
        htmlBody,
        fromEmail: "noreply@stake-social.it",
        fromName: "Stake Casino",
        trigger: tpl.trigger,
        isActive: true,
        isDefault: false,
        variables: JSON.stringify(tpl.variables),
        metadata: JSON.stringify({ category: "casino" }),
      },
    });
    console.log(`[created] "${tpl.name}" (id: ${created.id})`);
  }

  console.log("\nCasino template seed completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
