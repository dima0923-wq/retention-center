import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL || "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Clean existing data (dependent models first)
  await prisma.sequenceStepExecution.deleteMany();
  await prisma.sequenceEnrollment.deleteMany();
  await prisma.sequenceStep.deleteMany();
  await prisma.retentionSequence.deleteMany();
  await prisma.conversion.deleteMany();
  await prisma.conversionRule.deleteMany();
  await prisma.aBTest.deleteMany();
  await prisma.contactAttempt.deleteMany();
  await prisma.campaignLead.deleteMany();
  await prisma.script.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.integrationConfig.deleteMany();

  // Create 20 leads
  const leads = await Promise.all([
    prisma.lead.create({ data: { firstName: "John", lastName: "Smith", email: "john.smith@example.com", phone: "+15551001001", source: "META", status: "NEW" } }),
    prisma.lead.create({ data: { firstName: "Sarah", lastName: "Johnson", email: "sarah.j@example.com", phone: "+15551001002", source: "META", status: "CONTACTED" } }),
    prisma.lead.create({ data: { firstName: "Michael", lastName: "Williams", email: "m.williams@example.com", phone: "+15551001003", source: "MANUAL", status: "IN_PROGRESS" } }),
    prisma.lead.create({ data: { firstName: "Emily", lastName: "Brown", email: "emily.b@example.com", phone: "+15551001004", source: "API", status: "CONVERTED" } }),
    prisma.lead.create({ data: { firstName: "David", lastName: "Jones", email: "david.jones@example.com", phone: "+15551001005", source: "META", status: "LOST" } }),
    prisma.lead.create({ data: { firstName: "Jessica", lastName: "Garcia", email: "jessica.g@example.com", phone: "+15551001006", source: "MANUAL", status: "NEW" } }),
    prisma.lead.create({ data: { firstName: "Daniel", lastName: "Martinez", email: "daniel.m@example.com", phone: "+15551001007", source: "META", status: "CONTACTED" } }),
    prisma.lead.create({ data: { firstName: "Ashley", lastName: "Anderson", email: "ashley.a@example.com", phone: "+15551001008", source: "API", status: "NEW" } }),
    prisma.lead.create({ data: { firstName: "James", lastName: "Taylor", email: "james.t@example.com", phone: "+15551001009", source: "MANUAL", status: "IN_PROGRESS" } }),
    prisma.lead.create({ data: { firstName: "Amanda", lastName: "Thomas", email: "amanda.t@example.com", phone: "+15551001010", source: "META", status: "CONVERTED" } }),
    prisma.lead.create({ data: { firstName: "Robert", lastName: "Hernandez", email: "robert.h@example.com", phone: "+15551001011", source: "MANUAL", status: "NEW" } }),
    prisma.lead.create({ data: { firstName: "Jennifer", lastName: "Moore", email: "jennifer.m@example.com", phone: "+15551001012", source: "META", status: "CONTACTED" } }),
    prisma.lead.create({ data: { firstName: "Christopher", lastName: "Martin", email: "chris.m@example.com", phone: "+15551001013", source: "API", status: "IN_PROGRESS" } }),
    prisma.lead.create({ data: { firstName: "Stephanie", lastName: "Jackson", email: "steph.j@example.com", phone: "+15551001014", source: "META", status: "LOST" } }),
    prisma.lead.create({ data: { firstName: "Matthew", lastName: "Thompson", email: "matt.t@example.com", phone: "+15551001015", source: "MANUAL", status: "NEW" } }),
    prisma.lead.create({ data: { firstName: "Nicole", lastName: "White", email: "nicole.w@example.com", phone: "+15551001016", source: "META", status: "CONTACTED" } }),
    prisma.lead.create({ data: { firstName: "Andrew", lastName: "Lopez", email: "andrew.l@example.com", phone: "+15551001017", source: "API", status: "CONVERTED" } }),
    prisma.lead.create({ data: { firstName: "Rachel", lastName: "Lee", email: "rachel.l@example.com", phone: "+15551001018", source: "MANUAL", status: "NEW" } }),
    prisma.lead.create({ data: { firstName: "Joshua", lastName: "Gonzalez", email: "josh.g@example.com", phone: "+15551001019", source: "META", status: "IN_PROGRESS" } }),
    prisma.lead.create({ data: { firstName: "Lauren", lastName: "Harris", email: "lauren.h@example.com", phone: "+15551001020", source: "MANUAL", status: "NEW", notes: "VIP lead from partner referral" } }),
  ]);
  console.log(`Created ${leads.length} leads`);

  // Create 3 campaigns
  const campaign1 = await prisma.campaign.create({
    data: {
      name: "Spring Outreach 2026",
      description: "Multi-channel spring campaign targeting new leads",
      status: "ACTIVE",
      channels: JSON.stringify(["CALL", "SMS", "EMAIL"]),
      startDate: new Date("2026-02-01"),
      endDate: new Date("2026-04-30"),
    },
  });

  const campaign2 = await prisma.campaign.create({
    data: {
      name: "Re-engagement Campaign",
      description: "Follow up with lost leads",
      status: "DRAFT",
      channels: JSON.stringify(["EMAIL", "SMS"]),
    },
  });

  const campaign3 = await prisma.campaign.create({
    data: {
      name: "Q4 Holiday Push",
      description: "Holiday season conversion campaign",
      status: "COMPLETED",
      channels: JSON.stringify(["CALL", "EMAIL"]),
      startDate: new Date("2025-11-01"),
      endDate: new Date("2025-12-31"),
    },
  });
  console.log("Created 3 campaigns");

  // Assign leads to campaigns
  const campaign1Leads = leads.slice(0, 10);
  const campaign3Leads = leads.slice(8, 14);

  for (const lead of campaign1Leads) {
    await prisma.campaignLead.create({
      data: { campaignId: campaign1.id, leadId: lead.id, status: "IN_PROGRESS" },
    });
  }
  for (const lead of campaign3Leads) {
    await prisma.campaignLead.create({
      data: {
        campaignId: campaign3.id,
        leadId: lead.id,
        status: "COMPLETED",
        completedAt: new Date("2025-12-20"),
      },
    });
  }
  console.log("Assigned leads to campaigns");

  // Create 3 scripts
  const callScript = await prisma.script.create({
    data: {
      name: "Welcome Call Script",
      type: "CALL",
      vapiConfig: JSON.stringify({
        model: "gpt-4o",
        voice: "alloy",
        temperature: 0.7,
        firstMessage: "Hello! This is Alex from Acme Corp. I'm reaching out because you recently expressed interest in our services. Do you have a moment to chat?",
        instructions: "You are Alex, a friendly sales representative from Acme Corp. Your goal is to qualify the lead and schedule a demo. Be conversational, listen actively, and address any concerns. If the lead is interested, offer to schedule a 15-minute demo. If not interested, thank them and ask if they'd prefer email updates instead.",
      }),
      campaignId: campaign1.id,
      isDefault: true,
    },
  });

  const smsScript = await prisma.script.create({
    data: {
      name: "Follow-up SMS Template",
      type: "SMS",
      content: "Hi {{firstName}}, thanks for your interest in Acme Corp! We'd love to show you how we can help. Reply YES to schedule a quick call, or visit our site to learn more.",
      campaignId: campaign1.id,
      isDefault: true,
    },
  });

  const emailScript = await prisma.script.create({
    data: {
      name: "Welcome Email Template",
      type: "EMAIL",
      content: JSON.stringify({
        subject: "Welcome to Acme Corp, {{firstName}}!",
        body: "<h2>Hi {{firstName}},</h2><p>Thank you for your interest in Acme Corp. We're excited to help you achieve your goals.</p><p>Here's what you can expect from us:</p><ul><li>Personalized service tailored to your needs</li><li>Expert guidance from our team</li><li>Fast and reliable support</li></ul><p>Would you like to schedule a quick call to discuss how we can help? Simply reply to this email or call us at (555) 100-1000.</p><p>Best regards,<br/>The Acme Corp Team</p>",
      }),
      isDefault: true,
    },
  });
  console.log("Created 3 scripts");

  // Create 15+ contact attempts
  const attempts = [
    { leadId: leads[0].id, campaignId: campaign1.id, channel: "CALL", status: "SUCCESS", scriptId: callScript.id, provider: "vapi", providerRef: "vapi_call_001", duration: 180, startedAt: new Date("2026-02-10T10:00:00Z"), completedAt: new Date("2026-02-10T10:03:00Z"), notes: "Lead is interested, scheduled demo for next week" },
    { leadId: leads[0].id, campaignId: campaign1.id, channel: "EMAIL", status: "SUCCESS", scriptId: emailScript.id, provider: "sendgrid", providerRef: "sg_msg_001", startedAt: new Date("2026-02-08T09:00:00Z"), completedAt: new Date("2026-02-08T09:00:05Z") },
    { leadId: leads[1].id, campaignId: campaign1.id, channel: "SMS", status: "SUCCESS", scriptId: smsScript.id, provider: "twilio", providerRef: "tw_sms_001", startedAt: new Date("2026-02-11T14:00:00Z"), completedAt: new Date("2026-02-11T14:00:02Z") },
    { leadId: leads[1].id, campaignId: campaign1.id, channel: "CALL", status: "NO_ANSWER", scriptId: callScript.id, provider: "vapi", providerRef: "vapi_call_002", duration: 30, startedAt: new Date("2026-02-12T11:00:00Z"), completedAt: new Date("2026-02-12T11:00:30Z"), notes: "No answer, will retry" },
    { leadId: leads[2].id, campaignId: campaign1.id, channel: "CALL", status: "IN_PROGRESS", scriptId: callScript.id, provider: "vapi", providerRef: "vapi_call_003", startedAt: new Date("2026-02-18T09:00:00Z") },
    { leadId: leads[3].id, campaignId: campaign1.id, channel: "CALL", status: "SUCCESS", scriptId: callScript.id, provider: "vapi", providerRef: "vapi_call_004", duration: 420, startedAt: new Date("2026-02-09T15:00:00Z"), completedAt: new Date("2026-02-09T15:07:00Z"), notes: "Converted! Signed up for premium plan" },
    { leadId: leads[3].id, campaignId: campaign1.id, channel: "EMAIL", status: "SUCCESS", scriptId: emailScript.id, provider: "sendgrid", providerRef: "sg_msg_002", startedAt: new Date("2026-02-07T08:00:00Z"), completedAt: new Date("2026-02-07T08:00:03Z") },
    { leadId: leads[4].id, campaignId: campaign1.id, channel: "CALL", status: "FAILED", scriptId: callScript.id, provider: "vapi", providerRef: "vapi_call_005", startedAt: new Date("2026-02-10T16:00:00Z"), completedAt: new Date("2026-02-10T16:00:10Z"), notes: "Number disconnected" },
    { leadId: leads[4].id, campaignId: campaign1.id, channel: "SMS", status: "FAILED", scriptId: smsScript.id, provider: "twilio", providerRef: "tw_sms_002", startedAt: new Date("2026-02-11T10:00:00Z"), completedAt: new Date("2026-02-11T10:00:01Z"), notes: "Undeliverable" },
    { leadId: leads[5].id, channel: "EMAIL", status: "SUCCESS", scriptId: emailScript.id, provider: "sendgrid", providerRef: "sg_msg_003", startedAt: new Date("2026-02-15T12:00:00Z"), completedAt: new Date("2026-02-15T12:00:04Z") },
    { leadId: leads[6].id, campaignId: campaign1.id, channel: "SMS", status: "SUCCESS", scriptId: smsScript.id, provider: "twilio", providerRef: "tw_sms_003", startedAt: new Date("2026-02-13T08:30:00Z"), completedAt: new Date("2026-02-13T08:30:02Z") },
    { leadId: leads[7].id, channel: "CALL", status: "PENDING", scriptId: callScript.id, provider: "vapi", startedAt: new Date("2026-02-18T10:00:00Z") },
    { leadId: leads[8].id, campaignId: campaign1.id, channel: "CALL", status: "SUCCESS", scriptId: callScript.id, provider: "vapi", providerRef: "vapi_call_006", duration: 300, startedAt: new Date("2026-02-14T14:00:00Z"), completedAt: new Date("2026-02-14T14:05:00Z"), notes: "Very interested, wants pricing details" },
    { leadId: leads[9].id, campaignId: campaign1.id, channel: "EMAIL", status: "SUCCESS", scriptId: emailScript.id, provider: "sendgrid", providerRef: "sg_msg_004", startedAt: new Date("2026-02-08T07:00:00Z"), completedAt: new Date("2026-02-08T07:00:05Z") },
    { leadId: leads[9].id, campaignId: campaign1.id, channel: "CALL", status: "SUCCESS", scriptId: callScript.id, provider: "vapi", providerRef: "vapi_call_007", duration: 600, startedAt: new Date("2026-02-10T10:30:00Z"), completedAt: new Date("2026-02-10T10:40:00Z"), notes: "Converted to premium customer" },
    { leadId: leads[11].id, channel: "SMS", status: "SUCCESS", scriptId: smsScript.id, provider: "twilio", providerRef: "tw_sms_004", startedAt: new Date("2026-02-16T09:00:00Z"), completedAt: new Date("2026-02-16T09:00:01Z") },
  ];

  for (const attempt of attempts) {
    await prisma.contactAttempt.create({ data: attempt });
  }
  console.log(`Created ${attempts.length} contact attempts`);

  // Create integration configs
  await prisma.integrationConfig.create({
    data: {
      provider: "vapi",
      type: "CALL",
      config: JSON.stringify({
        apiKey: "vapi_test_key_xxx",
        baseUrl: "https://api.vapi.ai",
        webhookUrl: "https://yourapp.com/api/webhooks/vapi",
      }),
      isActive: true,
    },
  });

  await prisma.integrationConfig.create({
    data: {
      provider: "twilio",
      type: "SMS",
      config: JSON.stringify({
        accountSid: "AC_test_xxx",
        authToken: "test_auth_token_xxx",
        fromNumber: "+15559990000",
        webhookUrl: "https://yourapp.com/api/webhooks/sms",
      }),
      isActive: true,
    },
  });
  console.log("Created 2 integration configs");

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
