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
```

Never use a `service_role` or secret key in a `NEXT_PUBLIC_` variable. Once configured, authenticated staff share the same records and receive live record updates. Existing local records can be reviewed and copied from **Utilities → Move Existing Browser Records**.

## Backup and transfer

The dashboard can export complete JSON backups or CSV files and import either format. Imports are validated and previewed before saving. Matching full names and birthdays are skipped by default; overwriting an existing match requires both selecting the overwrite option and confirming the action.

## Record management

Active records can be edited or archived. Archived records are excluded from active statistics, search, and document matching, and can be restored from the supervisor archived-records view. Permanent deletion is available only during development and requires typing an explicit confirmation.

## Applicant assistance history

Every assistance request remains a separate application, while surname, first name, and birthday are normalized to identify the same applicant despite capitalization, punctuation, spacing, or common date-format differences. The encoding form warns staff about prior applications and shows the amount previously granted. The records table and full history view show each application alongside the applicant's cumulative assistance total. New and imported applicant names are standardized to uppercase for consistent display.

## Dashboard reports

Summary cards and aggregate charts update from the same searched and filtered IndexedDB records shown in the table. Charts use broad categories without applicant names or contact information. Use **Print Report** to print or save the dashboard as a PDF through the browser.

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

## Cloudflare deployment

The application is configured for Cloudflare Workers through the OpenNext adapter.
The regular `npm run dev` workflow remains unchanged.

Preview the Cloudflare Worker locally:

```bash
npm run preview:cloudflare
```

Deploy the current version:

```bash
npm run deploy:cloudflare
```

The current deployment is available at
[assistance-program-system.antipolo-first-district.workers.dev](https://assistance-program-system.antipolo-first-district.workers.dev).

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

Supabase is the shared source of truth when configured; IndexedDB remains the backward-compatible local fallback and migration source. Tesseract.js performs OCR in the browser and may download its language worker data the first time a document is scanned. No external AI API integration is included.
