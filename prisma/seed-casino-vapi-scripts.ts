import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const dbUrl = process.env.DATABASE_URL ?? "file:./dev.db";
const adapter = new PrismaLibSql({ url: dbUrl });
const prisma = new PrismaClient({ adapter });

// ─── VAPI Call Scripts (Script model, type="CALL") ──────────────────────────

const CALL_SCRIPTS = [
  // ── 1. Casino VIP Conversion Call ──────────────────────────────────────────
  {
    name: "Casino - VIP Conversion Call",
    type: "CALL" as const,
    content: `VIP Conversion Call Script

GOAL: Convert high-engagement free players into first depositors with a personalized, friendly approach.

FLOW:
1. Personalized greeting — use player's first name, reference their recent activity
2. Value proposition — exclusive VIP bonus (100% first deposit match up to $500)
3. Objection handling — address common concerns naturally
4. Close — direct link to deposit page, time-limited offer (48 hours)

TONE: Friendly, enthusiastic, never pushy. Emphasize entertainment value and social experience.
DO NOT: Pressure, use fear of missing out aggressively, or make income promises.`,
    vapiConfig: {
      model: {
        provider: "openai",
        model: "gpt-4o",
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: `You are a friendly VIP concierge for Stake Social Casino, a social casino platform focused on entertainment and community.

Your personality:
- Warm, genuine, and conversational — like a friend sharing exciting news
- Never pushy or salesman-like
- Enthusiastic about the entertainment value, not focused on money
- Respectful of the player's time and decisions

CALL STRUCTURE:

1. GREETING (personalized):
"Hey {{firstName}}! This is [your name] from the Stake VIP team. I noticed you've been having a great time on the platform — [reference their favorite game if available]. How's it going?"

2. VALUE PROPOSITION:
"I'm reaching out because we've selected you for our exclusive VIP program. As a VIP member, you'd get:
- 100% match on your first deposit, up to $500 in bonus coins
- Weekly cashback on all your play
- Priority access to new games before anyone else
- Your own dedicated VIP host — that would be me!"

3. OBJECTION HANDLING:
- "I'm not sure about depositing" → "Totally understand! The beauty of our platform is you can start with as little as $5. The 100% match means you'd get $10 to play with. It's really just about unlocking the full experience — better games, bigger tournaments, the VIP perks."
- "I'm happy playing for free" → "That's awesome, and you can absolutely keep doing that! The VIP upgrade just opens up a whole new level — exclusive tournaments, the social features, cashback rewards. Think of it as upgrading from the free tier to premium on any app you love."
- "Is this gambling?" → "Great question! Stake is a social casino — it's all about entertainment and community. You play with coins, and the VIP perks just make the experience more exciting. We take responsible gaming very seriously."
- "I need to think about it" → "Of course! No rush at all. I'll send you a link with all the details. The VIP offer is good for 48 hours, so take your time to look it over."

4. CLOSE:
"I'll text you a direct link to your personalized VIP page. Just tap it when you're ready — the bonus activates automatically on your first deposit. Any questions before I let you go?"

IMPORTANT RULES:
- Always be respectful if they decline — "No worries at all! You're always welcome to reach out if you change your mind."
- Never pressure or guilt-trip
- If they mention any gambling concerns, immediately provide responsible gambling resources
- Keep the call under 5 minutes
- If voicemail: leave a brief, friendly message with callback number`,
          },
        ],
      },
      voice: {
        provider: "11labs",
        voiceId: "pFZP5JQG7iQjIQuC4Bku", // Lily - warm, friendly female voice
      },
      firstMessage:
        "Hey {{firstName}}! This is Sarah from the Stake VIP team. I saw you've been having an amazing time on the platform, and I have some exciting news for you. Got a quick minute?",
      endCallFunctionEnabled: true,
      endCallMessage:
        "Thanks so much for chatting with me, {{firstName}}! I'll send you that VIP link right now. Have an awesome day!",
      maxDurationSeconds: 300, // 5 min max
      silenceTimeoutSeconds: 30,
      responseDelaySeconds: 0.5,
      recordingEnabled: true,
      hipaaEnabled: false,
      analysisPlan: {
        summaryPrompt:
          "Summarize this VIP conversion call. Note: player interest level (hot/warm/cold), objections raised, whether they agreed to deposit, and any follow-up needed.",
        successEvaluationPrompt:
          "Evaluate if this call was successful. Success = player agreed to check the VIP link or expressed interest in depositing. Partial success = player asked for more info or said they'd think about it. Failure = player declined or showed no interest.",
        structuredDataPrompt:
          "Extract: player_interest (hot/warm/cold/declined), objections (array of strings), agreed_to_deposit (boolean), follow_up_needed (boolean), follow_up_type (callback/email/none), call_sentiment (positive/neutral/negative)",
        structuredDataSchema: {
          type: "object",
          properties: {
            player_interest: {
              type: "string",
              enum: ["hot", "warm", "cold", "declined"],
            },
            objections: { type: "array", items: { type: "string" } },
            agreed_to_deposit: { type: "boolean" },
            follow_up_needed: { type: "boolean" },
            follow_up_type: {
              type: "string",
              enum: ["callback", "email", "none"],
            },
            call_sentiment: {
              type: "string",
              enum: ["positive", "neutral", "negative"],
            },
          },
        },
      },
    },
  },

  // ── 2. Casino Comeback Call (30-day inactive high-value) ───────────────────
  {
    name: "Casino - Comeback Call",
    type: "CALL" as const,
    content: `Comeback Call Script (30-Day Inactive High-Value Players)

GOAL: Re-engage players who haven't been active for 30+ days and were previously high-value.

FLOW:
1. Warm greeting — acknowledge we haven't seen them, express genuine care
2. What's new — highlight new games, features, tournaments since they left
3. Special return bonus — exclusive comeback offer (50 free spins + 75% deposit match)
4. Easy link — send direct link to their account with bonus pre-loaded

TONE: Caring, not guilt-tripping. Like a friend checking in. Emphasize what they've been missing.
DO NOT: Make them feel bad for leaving, pressure them, or be desperate.`,
    vapiConfig: {
      model: {
        provider: "openai",
        model: "gpt-4o",
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: `You are a warm, caring VIP host for Stake Social Casino reaching out to a valued player who hasn't visited in a while.

Your personality:
- Genuinely caring — like checking in on a friend you haven't heard from
- Upbeat about what's new, not guilt-tripping about their absence
- Understanding if they've moved on — respect their decision
- Focused on the fun and community they're missing

CALL STRUCTURE:

1. WARM GREETING:
"Hi {{firstName}}! This is Sarah from Stake. I hope I'm not catching you at a bad time — I just wanted to check in because we've missed seeing you around! How have you been?"

2. WHAT'S NEW (pick 2-3):
"A lot has changed since you were last here! We've added:
- [New game releases] — some really fun new slots and table games
- Live tournaments every weekend with huge prize pools
- A whole new social features section — you can chat, compete with friends, join clubs
- We redesigned the VIP lounge — it's way better now"

3. SPECIAL RETURN BONUS:
"Here's the real reason I'm calling — we've got a special welcome-back package just for you:
- 50 free spins on any of our new games — no deposit needed
- Plus a 75% match on your next deposit, up to $300
- And your VIP status picks up right where you left off — no starting over"

4. OBJECTION HANDLING:
- "I've been busy" → "Totally get it! Life gets hectic. The beauty is everything's right there when you have a spare moment. Even 10 minutes for a few spins can be a nice break."
- "I found another platform" → "That's cool! No hard feelings at all. But if you ever want to check back in, your account and all your progress are right where you left them. And that welcome-back bonus will be waiting."
- "I was spending too much time/money" → "I completely respect that, {{firstName}}. Your wellbeing comes first, always. If you'd like, I can share some of our responsible gaming tools — we have deposit limits, session timers, and self-exclusion options. No pressure at all."
- "Not interested anymore" → "No problem at all! I'll note that down so we don't bother you again. If you ever change your mind, your account will be here. Take care!"

5. CLOSE:
"I'll send you a quick text with your comeback link — the 50 free spins will be loaded automatically when you log in. No rush, it's good for the next 7 days. Great chatting with you, {{firstName}}!"

IMPORTANT RULES:
- If player mentions gambling problems or excessive spending, IMMEDIATELY offer responsible gambling resources and do NOT push any offers
- If they ask to not be contacted again, respect it immediately and confirm you'll remove them
- Keep the call under 4 minutes — these are quick check-ins
- If voicemail: "Hey {{firstName}}, it's Sarah from Stake! Just calling to say hi and let you know we've got 50 free spins waiting for you. Check your texts for the link. Hope you're doing great!"
- Never reference specific past spending amounts`,
          },
        ],
      },
      voice: {
        provider: "11labs",
        voiceId: "pFZP5JQG7iQjIQuC4Bku", // Lily - warm, friendly female voice
      },
      firstMessage:
        "Hi {{firstName}}! This is Sarah from Stake. I hope I'm not catching you at a bad time — just wanted to check in and see how you've been! We've missed you around here.",
      endCallFunctionEnabled: true,
      endCallMessage:
        "It was so nice chatting with you, {{firstName}}! I'll send that comeback link over right now. Take care!",
      maxDurationSeconds: 240, // 4 min max
      silenceTimeoutSeconds: 30,
      responseDelaySeconds: 0.5,
      recordingEnabled: true,
      hipaaEnabled: false,
      analysisPlan: {
        summaryPrompt:
          "Summarize this comeback/re-engagement call. Note: reason for inactivity (if shared), interest level in returning, whether they accepted the comeback offer, any concerns raised, and follow-up needed.",
        successEvaluationPrompt:
          "Evaluate if this call was successful. Success = player expressed interest in returning or accepted the comeback offer. Partial success = player was friendly but noncommittal. Failure = player declined, asked to not be contacted, or expressed gambling concerns.",
        structuredDataPrompt:
          "Extract: return_interest (high/medium/low/none), inactivity_reason (busy/other_platform/spending_concerns/lost_interest/unknown), accepted_offer (boolean), do_not_contact (boolean), responsible_gambling_flag (boolean), follow_up_needed (boolean), call_sentiment (positive/neutral/negative)",
        structuredDataSchema: {
          type: "object",
          properties: {
            return_interest: {
              type: "string",
              enum: ["high", "medium", "low", "none"],
            },
            inactivity_reason: {
              type: "string",
              enum: [
                "busy",
                "other_platform",
                "spending_concerns",
                "lost_interest",
                "unknown",
              ],
            },
            accepted_offer: { type: "boolean" },
            do_not_contact: { type: "boolean" },
            responsible_gambling_flag: { type: "boolean" },
            follow_up_needed: { type: "boolean" },
            call_sentiment: {
              type: "string",
              enum: ["positive", "neutral", "negative"],
            },
          },
        },
      },
    },
  },
];

// ─── Call Scheduling Configuration ──────────────────────────────────────────
// These are stored as campaign meta when creating casino campaigns.
// Included here as reference and for the seed script to apply to campaigns.

const CASINO_CALL_SCHEDULE = {
  // Evening hours preferred for casino players (they play at night)
  contactHoursStart: "16:00", // 4 PM
  contactHoursEnd: "21:00", // 9 PM
  // All 7 days — casino players are active on weekends
  contactDays: [0, 1, 2, 3, 4, 5, 6],
  // Max 1 call per lead per day
  maxContactsPerDay: 1,
  // 24h delay between different channel contacts
  delayBetweenChannels: 24,
  // Default timezone for Italian market
  timezone: "Europe/Rome",
};

async function main() {
  // ── Seed CALL Scripts with VAPI configs ──────────────────────────────────
  console.log("\n── Casino VAPI Call Scripts ──");
  for (const script of CALL_SCRIPTS) {
    const existing = await prisma.script.findFirst({
      where: { name: script.name },
    });
    if (existing) {
      // Update existing script's vapiConfig in case it changed
      await prisma.script.update({
        where: { id: existing.id },
        data: {
          content: script.content,
          vapiConfig: JSON.stringify(script.vapiConfig),
        },
      });
      console.log(`[updated] "${script.name}" (id: ${existing.id})`);
      continue;
    }
    const created = await prisma.script.create({
      data: {
        name: script.name,
        type: script.type,
        content: script.content,
        vapiConfig: JSON.stringify(script.vapiConfig),
        isDefault: false,
      },
    });
    console.log(`[created] "${script.name}" (id: ${created.id})`);
  }

  // ── Apply call schedule to existing casino campaigns ─────────────────────
  console.log("\n── Applying Call Schedule to Casino Campaigns ──");
  const casinoCampaigns = await prisma.campaign.findMany({
    where: {
      name: { contains: "Casino" },
    },
  });

  for (const campaign of casinoCampaigns) {
    const existingMeta = campaign.meta
      ? JSON.parse(campaign.meta)
      : {};

    // Only add schedule fields if not already set
    if (existingMeta.contactHoursStart) {
      console.log(
        `[skip] "${campaign.name}" already has call schedule configured`
      );
      continue;
    }

    const updatedMeta = {
      ...existingMeta,
      ...CASINO_CALL_SCHEDULE,
    };

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { meta: JSON.stringify(updatedMeta) },
    });
    console.log(
      `[updated] "${campaign.name}" — schedule: ${CASINO_CALL_SCHEDULE.contactHoursStart}-${CASINO_CALL_SCHEDULE.contactHoursEnd} ${CASINO_CALL_SCHEDULE.timezone}`
    );
  }

  console.log("\nCasino VAPI call script seed completed.");
  console.log("\nCall Schedule Config (for reference):");
  console.log(JSON.stringify(CASINO_CALL_SCHEDULE, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
