# Assistance Program System

A Next.js App Router application for managing local assistance-program records. It preserves the original dashboard, applicant form, record details, search, deletion, statistics, ID attachment, OCR scanning, and scanned-document matching.

The application supports a shared Supabase database for authenticated staff. Until Supabase environment variables are added, it continues using the existing browser IndexedDB database (`AssistanceProgramDB`) and `records` object store. Existing records created by the original HTML application remain compatible and can be copied into the shared database from Utilities.

## Shared Supabase database

1. Create a Supabase project.
2. Open **SQL Editor** and run [`supabase/schema.sql`](supabase/schema.sql).
3. In **Authentication → Sign In / Providers**, turn off **Allow new users to sign up** and keep anonymous sign-ins disabled.
4. In **Authentication → Users**, use **Add user** to create or invite approved staff accounts.
5. Copy `.env.example` to `.env.local`.
6. In the Supabase project **Connect** dialog, copy the Project URL and publishable key:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
NEXT_PUBLIC_SUPABASE_TEST_MODE=false
```

Never use a `service_role` or secret key in a `NEXT_PUBLIC_` variable. Once configured, authenticated staff share the same records and receive live record updates. Existing local records can be reviewed and copied from **Utilities → Move Existing Browser Records**.

### Temporary intern testing mode

For a short-lived shared test environment, enable **Anonymous Sign-Ins** in the
Supabase Authentication settings and set:

```bash
NEXT_PUBLIC_SUPABASE_TEST_MODE=true
```

The application then creates a temporary authenticated Supabase session in each
browser without displaying the staff login. Existing RLS policies still apply,
but anyone with the deployed URL can view and change the shared test records.
Use dummy data only, and set this variable back to `false` before entering real
applicant information.

## Backup and transfer

The dashboard can export complete JSON backups or CSV files and import either format. Imports are validated and previewed before saving. Matching full names and birthdays are skipped by default; overwriting an existing match requires both selecting the overwrite option and confirming the action.

## Record management

Active records can be edited or archived. Archived records are excluded from active statistics, search, and document matching, and can be restored from the archived-records view. Archived applications can also be permanently deleted after typing an explicit irreversible-action confirmation.

## Application handoff workflow

New applications move through four shared stages:

1. **Intake Applications** — first-level staff record the application date, requested amount, applicant, financial and household information, then attach the paperwork packet.
2. **Review & Approval** — the reviewer checks the packet and previous assistance history, marks verified requirements, enters review notes, and either returns the packet or approves a grant.
3. **Approved for Encoding** — the approved packet and locked granted amount return to the downstairs encoder for verification and completion.
4. **Applicant Records** — completing encoding moves the application into the existing searchable records, history, dashboard, matching, backup, and archive workflows.

Existing records without workflow fields are automatically treated as completed records. Packet uploads accept common browser image formats and HEIC/HEIF iPhone photos, resize them to a maximum of 1600 pixels, and compress them before saving. Up to 12 requirement photos can be attached to one application.

## Applicant assistance history

Every assistance request remains a separate application, while surname, first name, and birthday are normalized to identify the same applicant despite capitalization, punctuation, spacing, or common date-format differences. The encoding form warns staff about prior applications and shows the amount previously granted. The records table and full history view show each application alongside the applicant's cumulative assistance total. New and imported applicant names are standardized to uppercase for consistent display.

## Dashboard reports

Summary cards and aggregate charts update from the same searched and filtered records shown in the table. Hovering a chart group shows the applicants behind the aggregate, and clicking it opens the corresponding application list with a direct link to applicant history. Use **Print Report** to print or save the dashboard as a PDF through the browser.

## Condition categories

Free-text diagnosis details are preserved alongside multi-select standardized condition categories. Existing diagnoses can be reviewed through the condition migration panel, which suggests categories from keywords but never applies them or changes diagnosis text without explicit review and confirmation.

## Application Document Encoder

The encoder provides a local-only demonstration workflow for uploading an application image and reviewing mock-extracted fields with High, Medium, or Low confidence. No external AI service is connected, and no record is written until every field is reviewed and **Confirm and Save** is selected.

## Scored document matching

OCR text is compared with active records using normalized exact and fuzzy scoring across names, common birthday formats, addresses, barangays, and optional ID numbers. The scanner displays up to five ranked candidates with matching evidence, but staff must explicitly select **Confirm Match**.

## Requirements

- Node.js 18.18 or newer
- npm

## Installation

```bash
npm install
```

## Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production build

```bash
npm run build
npm start
```

## Vercel deployment

1. Import the GitHub repository into Vercel.
2. Keep the automatically detected **Next.js** framework and default build settings.
3. Set `main` as the production branch.
4. Add the Supabase variables from `.env.example` in **Project Settings → Environment Variables** when the shared database is ready.
5. Deploy the project.

After the GitHub repository is connected, pushes to `main` update the production
deployment and pushes to other branches create preview deployments.

## Code quality checks

```bash
npm run typecheck
npm run lint
```

## Project structure

- `app/` — App Router page, layout, and global styles
- `components/` — reusable dashboard, scanner, table, and modal components
- `lib/` — TypeScript record model and IndexedDB access
- `backup/demodatabase-original.html` — preserved original single-file application

## Current storage and OCR

Supabase is the shared source of truth when configured; IndexedDB remains the backward-compatible local fallback and migration source. During the current testing phase, compressed packet photos are stored inside each record's JSON so the workflow works without another Supabase migration. Before production use with many real applications, move these photos to a private Supabase Storage bucket and retain only protected file paths in the record to avoid exhausting database and network limits.

Tesseract.js performs OCR in the browser and may download its language worker data the first time a document is scanned. No external AI API integration is included.
