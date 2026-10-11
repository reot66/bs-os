# PRD — Website Platform

## Goal
Business بتواند با Template و Controlled Editor سایت حرفه‌ای منتشر کند بدون آزاد گذاشتن arbitrary code.

## Core Concepts
Website, Page, Section/Block, Theme Tokens, Media, Form, Domain, Draft, PublishedVersion.

## Basic Candidate
- One website/business
- Template selection
- Page CRUD
- Text/image/content editing
- Section enable/disable/reorder
- Theme token basics
- Responsive preview
- Draft + Publish
- Custom domain/subdomain foundation
- SEO basics
- Lead/contact forms

## Advanced Candidate
Basic + multi-site, template inheritance/upgrade, blog/content system, reusable sections, advanced SEO/schema, localization, advanced form builder, experiments/personalization, collaboration/approval, advanced media and analytics integration.

## Non-negotiable
- Published surface جدا از draft management surface.
- arbitrary custom JS در MVP ممنوع.
- public runtime cache/CDN-friendly.
- customer overrides از template definition جدا.

## Capability Level Gate
**Level هنوز انتخاب نشده است مگر Owner صریحاً انتخاب کند.** قبل از implementation Agent باید Basic و Advanced را با scope دقیق ارائه کند.

## Engineering Baseline
در هر Level تمام Foundation Rules مربوط به Security, tenancy, tests, observability, data ownership, migrations, contracts و audit رعایت می‌شوند.
