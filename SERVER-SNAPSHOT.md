# Retention Center — Server State Snapshot

**Date**: 2026-02-20
**Server**: 38.180.64.126
**Domain**: https://ag2.q37fh758g.click
**Server Path**: /opt/retention-center/

---

## System Info

| Property | Value |
|----------|-------|
| OS | Ubuntu, Linux 6.8.0-64-generic x86_64 |
| Hostname | a471765858.local |
| Uptime | 1 day, 18:19 |
| Node.js | v20.20.0 |
| npm | 10.8.2 |
| Next.js | 16.1.6 |

## Resources

### Memory
```
               total        used        free      shared  buff/cache   available
Mem:            31Gi       964Mi        26Gi       4.0Mi       4.3Gi        30Gi
Swap:             0B          0B          0B
```

### Disk
```
Filesystem      Size  Used Avail Use% Mounted on
/dev/sda1        99G  7.2G   88G   8% /
```

---

## Services

### retention-center.service
- **Status**: active (running)
- **Port**: 3001

#### Systemd Unit File (`/etc/systemd/system/retention-center.service`)
```ini
[Unit]
Description=Retention Center
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/retention-center
ExecStart=/usr/bin/npm start
Restart=on-failure
Environment=NODE_ENV=production
Environment=PORT=3001

[Install]
WantedBy=multi-user.target
```

### nginx.service
- **Status**: active (running)
- **Ports**: 80 (HTTP, redirects to HTTPS), 443 (SSL)

---

## Nginx Config (`/etc/nginx/sites-available/retention-center`)

```nginx
server {
    server_name ag2.q37fh758g.click;

    auth_basic "Restricted";
    auth_basic_user_file /etc/nginx/.htpasswd;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/ag2.q37fh758g.click/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ag2.q37fh758g.click/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    if ($host = ag2.q37fh758g.click) {
        return 301 https://$host$request_uri;
    }
    listen 80;
    server_name ag2.q37fh758g.click;
    return 404;
}
```

### Basic Auth
- **htpasswd**: `/etc/nginx/.htpasswd` — user `admin`

### SSL Certificate
- **Issuer**: Let's Encrypt (Certbot)
- **Domain**: ag2.q37fh758g.click
- **Expiry**: 2026-05-20 (VALID: 88 days)
- **Key Type**: ECDSA

---

## Environment Variables (`/opt/retention-center/.env`)

```
DATABASE_URL="file:./prod.db"
INSTANTLY_API_KEY=placeholder
NEXT_PUBLIC_APP_URL=https://ag2.q37fh758g.click
```

> Note: INSTANTLY_API_KEY is set to "placeholder" — not yet configured with real key.

---

## Database

- **Engine**: SQLite via Prisma 7
- **File**: `/opt/retention-center/prod.db` (260K)
- **Prisma schema**: `/opt/retention-center/prisma/schema.prisma`
- **Has migrations**: Yes (`prisma/migrations/` directory exists)
- **Has seed**: Yes (`prisma/seed.ts`, 13K)

### Prisma Models
| Model | Description |
|-------|-------------|
| Lead | Contacts with email/phone, status tracking |
| Campaign | Multi-channel campaigns with scheduling |
| CampaignLead | Campaign-lead junction table |
| Script | Email/SMS/call templates |
| ContactAttempt | Outreach attempt tracking |
| RetentionSequence | Multi-step automated sequences |
| SequenceStep | Individual steps in a sequence |
| SequenceEnrollment | Lead enrollment in sequences |
| SequenceStepExecution | Step execution tracking |
| Conversion | Conversion event tracking |
| ConversionRule | Rules for auto-detecting conversions |
| ABTest | A/B test configurations |
| IntegrationConfig | Third-party integration settings |

---

## Application Structure

### Stack
- **Framework**: Next.js 16.1.6 (App Router)
- **UI**: Tailwind CSS + shadcn/ui + Radix UI
- **ORM**: Prisma 7 with SQLite
- **State**: Zustand
- **Charts**: Recharts
- **Forms**: react-hook-form + Zod validation
- **Date**: date-fns

### Key Dependencies
```json
"next": "16.1.6",
"react": "19.2.3",
"prisma": "^7.4.0",
"@prisma/client": "^7.4.0",
"zustand": "^5.0.11",
"recharts": "^3.7.0",
"zod": "^4.3.6"
```

### Pages (Dashboard)
| Route | Description |
|-------|-------------|
| `/` | Dashboard home |
| `/campaigns` | Campaign list + CRUD |
| `/campaigns/[id]` | Campaign detail |
| `/campaigns/new` | Create campaign |
| `/leads` | Lead management |
| `/leads/[id]` | Lead detail |
| `/sequences` | Automated sequences |
| `/sequences/[id]` | Sequence detail |
| `/scripts` | Script/template management |
| `/conversions` | Conversion tracking |
| `/reports` | Analytics & reports |
| `/learning` | ML insights, A/B tests, recommendations |
| `/integrations` | Third-party integrations |
| `/test-send` | Test email/SMS/call sending |

### API Routes (68 total)
- **Campaigns**: CRUD, start/pause, lead assignment, Instantly sync, stats
- **Leads**: CRUD, bulk import, SMS send, stats
- **Scripts**: CRUD, duplicate
- **Sequences**: CRUD, activate/pause, enroll, enrollments, stats
- **Contact Attempts**: Tracking
- **Conversions**: CRUD, stats
- **Reports**: Overview, campaigns, channels, leads, timeline
- **Learning**: A/B tests, channel mix, funnel, heatmap, insights, recommendations, sequence performance, suggestions, words
- **Integrations**: CRUD, test connection, Instantly (accounts, campaigns, webhook-setup), VAPI (assistants, phone-numbers, test-call, voices)
- **Webhooks**: Email, Instantly, Keitaro, Meta, SMS, VAPI
- **Scheduler**: Process queue, sequence processor
- **Test Send**: Email, SMS, call

### Services Layer
| Service | Purpose |
|---------|---------|
| campaign.service.ts | Campaign CRUD & management |
| lead.service.ts | Lead CRUD & management |
| lead-router.service.ts | Lead routing logic |
| script.service.ts | Script/template management |
| retention-sequence.service.ts | Sequence management |
| sequence-processor.service.ts | Sequence step execution |
| scheduler.service.ts | Job scheduling |
| ab-test.service.ts | A/B testing |
| learning.service.ts | ML insights & analytics |
| report.service.ts | Report generation |
| channel/email.service.ts | Email sending (Instantly) |
| channel/sms.service.ts | SMS sending |
| channel/vapi.service.ts | Voice calls (VAPI) |
| channel/channel-router.service.ts | Multi-channel routing |

### Integrations
| Provider | Channel | Status |
|----------|---------|--------|
| Instantly.ai | Email | Configured (API key placeholder) |
| VAPI | Voice calls | Configured (webhooks ready) |
| Keitaro | Conversion tracking | Webhook endpoint ready |
| Meta | Lead ingestion | Webhook endpoint ready |
| SMS (generic) | SMS | Webhook endpoint ready |

---

## Directory Listing (`/opt/retention-center/`)

```
drwxr-xr-x  .next/          (built output)
-rw-r--r--  .env            (108 bytes)
-rw-r--r--  .env.example    (174 bytes)
-rw-r--r--  .gitignore      (520 bytes)
-rw-r--r--  README.md       (1.4K)
-rw-r--r--  components.json (467 bytes)
-rwxr-xr-x  deploy.sh       (834 bytes)
drwxr-xr-x  docs/
-rw-r--r--  eslint.config.mjs
-rw-r--r--  next.config.ts  (76 bytes)
drwxr-xr-x  node_modules/   (609 packages)
-rw-r--r--  package.json    (1.3K)
-rw-r--r--  package-lock.json (500K)
-rw-r--r--  postcss.config.mjs
drwxr-xr-x  prisma/         (schema + migrations + seed)
-rw-r--r--  prisma.config.ts
-rw-r--r--  prod.db         (260K)
drwxr-xr-x  public/
drwxr-xr-x  src/            (main source code)
-rw-r--r--  tsconfig.json
```

---

## Recent Service Logs

```
Feb 19 23:44:10  Started retention-center.service - Retention Center
Feb 19 23:44:10  > next start
Feb 19 23:44:10  Next.js 16.1.6
Feb 19 23:44:10  - Local: http://localhost:3001
Feb 19 23:44:11  Warning: "next start" does not work with "output: standalone" — use "node .next/standalone/server.js"
Feb 19 23:44:11  Ready in 883ms
Feb 20 00:32:16  Error: Failed to find Server Action "x" (stale deployment)
Feb 20 01:07:02  Error: Failed to find Server Action "x" (stale deployment)
```

### Known Issues
1. **Standalone warning**: `next.config.ts` has `output: "standalone"` but service uses `npm start` (`next start`). Should use `node .next/standalone/server.js` instead.
2. **Server Action errors**: "Failed to find Server Action" — likely from cached browser sessions hitting new builds. Clears on its own.
3. **Instantly API key**: Set to `placeholder` — needs real API key for email functionality.

---

## Deployment

### deploy.sh (on server at `/opt/retention-center/deploy.sh`)
- rsync from local to server
- Excludes: node_modules, .next, .git, .env, prod.db, .DS_Store

### Post-deploy steps
```bash
cd /opt/retention-center && npm install && npx prisma generate && npm run build && systemctl restart retention-center
```

---

## Summary

The Retention Center is a fully structured Next.js 16 application with:
- 13 Prisma models covering leads, campaigns, sequences, scripts, conversions, A/B tests, and integrations
- 68 API routes with full CRUD and webhook support
- 10+ dashboard pages with rich UI components
- Multi-channel support (email via Instantly, voice via VAPI, SMS, webhooks for Keitaro/Meta)
- Learning/ML insights page with A/B testing, recommendations, and analytics
- Service layer architecture with channel routing

**Current state**: Application is deployed, built, and running. The Instantly API key is placeholder — email functionality needs a real API key. The standalone mode warning should be addressed by updating the systemd ExecStart command.
