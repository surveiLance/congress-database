# Assistance Program System

A Next.js App Router application for managing local assistance-program records. It preserves the original dashboard, applicant form, record details, search, deletion, statistics, ID attachment, OCR scanning, and scanned-document matching.

Records remain stored locally in the browser using the existing IndexedDB database (`AssistanceProgramDB`) and `records` object store. Existing records created by the original HTML application remain compatible when the app is opened in the same browser and origin.

## Backup and transfer

The dashboard can export complete JSON backups or CSV files and import either format. Imports are validated and previewed before saving. Matching full names and birthdays are skipped by default; overwriting an existing match requires both selecting the overwrite option and confirming the action.

## Record management

Active records can be edited or archived. Archived records are excluded from active statistics, search, and document matching, and can be restored from the supervisor archived-records view. Permanent deletion is available only during development and requires typing an explicit confirmation.

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

IndexedDB is intentionally device- and browser-local for now. Tesseract.js performs OCR in the browser and may download its language worker data the first time a document is scanned. No Supabase or AI API integration is included.
