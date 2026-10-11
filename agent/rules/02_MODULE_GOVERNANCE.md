# Module & Feature Governance

## Classification
هر Feature دقیقاً باید یکی از این جایگاه‌ها را داشته باشد:
- Core
- Module
- Integration
- Shared Infrastructure

## Core Minimal Rule
اگر capability فقط برای بخشی از Businessها لازم است، به احتمال زیاد Core نیست.

## Module Contract
هر Module باید تعریف کند:
- Manifest
- Domain owner
- Dependencies
- Data ownership/schema
- Permissions
- Events published/consumed
- API/contracts
- Usage metrics
- Configuration
- Integrations
- Audit requirements
- Data export/deletion policy
- Health/observability

## Communication
- direct cross-module DB access ممنوع.
- module-to-module interaction با application contract/event.
- Core هرگز Module را import نمی‌کند.

## Vertical Rule
Retail/Service/Corporate/Education/Restaurant ابتدا Pack/Template هستند. Domainهایی مثل Student/Grade/Enrollment در صورت نیاز می‌توانند Education Module واقعی شوند.
