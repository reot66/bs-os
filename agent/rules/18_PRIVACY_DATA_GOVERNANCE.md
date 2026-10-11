# Privacy, Compliance & Data Governance

- Business Data و Platform Operational Data purpose/ownership متفاوت دارند.
- Data Classification + PII Registry.
- Collect minimum necessary data؛ هر field purpose داشته باشد.
- Consent history-based با purpose/source/granted/revoked/evidence؛ preference جداست.
- Export/correction/delete/anonymize/restrict workflows در معماری ممکن باشند.
- Canonical Customer Core پایه customer-centric privacy operations.
- Delete/Anonymize/Archive/Retain مفاهیم جدا.
- Retention per data category و policy versioned.
- Backups طبق retention expire؛ deletion live-system با restore reconciliation سازگار باشد.
- Residency/region metadata per deployment.
- External provider حداقل داده لازم را بگیرد؛ processor registry later.
- Analytics/test از PII واقعی دور بمانند.
- Support PII masked by default؛ reveal permissioned/audited.
- Export files scoped, encrypted/protected as needed, short-lived.
- Moduleها data governance contract: PII, retention, export, delete, anonymize, external transfer.
- AI-derived data هم governance دارد.
- Jurisdiction rules از Compliance Profile/Policy، نه hardcoded country ifs.
