import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { readFileSync } from "fs";
import { resolve } from "path";

const dbUrl = process.env.DATABASE_URL ?? "file:./dev.db";
const adapter = new PrismaLibSql({ url: dbUrl });
const prisma = new PrismaClient({ adapter });

const TEMPLATES = [
  {
    name: "Stake - Dog House",
    subject: "Stake - The Dog House Email",
    file: "Stake_Dog_House_EMAIL_EXACT.html",
    fromEmail: "noreply@ads-welldone.com",
    fromName: "Retention Center",
    trigger: "manual",
    variables: ["baseUrl", "firstName", "lastName"],
  },
  {
    name: "Stake - Sweet Bonanza",
    subject: "Stake - Sweet Bonanza Email",
    file: "Stake_Sweet_Bonanza_EMAIL_EXACT.html",
    fromEmail: "noreply@ads-welldone.com",
    fromName: "Retention Center",
    trigger: "manual",
    variables: ["baseUrl", "firstName", "lastName"],
  },
];

async function main() {
  const assetsDir = resolve(__dirname, "../public/email-assets");

  for (const tpl of TEMPLATES) {
    const htmlPath = resolve(assetsDir, tpl.file);
    const htmlBody = readFileSync(htmlPath, "utf-8");

    // Upsert: skip if a template with the same name already exists
    const existing = await prisma.emailTemplate.findFirst({
      where: { name: tpl.name },
    });

    if (existing) {
      console.log(`[skip] "${tpl.name}" already exists (id: ${existing.id})`);
      continue;
    }

    const created = await prisma.emailTemplate.create({
      data: {
        name: tpl.name,
        subject: tpl.subject,
        htmlBody,
        fromEmail: tpl.fromEmail,
        fromName: tpl.fromName,
        trigger: tpl.trigger,
        isActive: true,
        isDefault: false,
        variables: JSON.stringify(tpl.variables),
        metadata: JSON.stringify({}),
      },
    });

    console.log(`[created] "${tpl.name}" (id: ${created.id})`);
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
