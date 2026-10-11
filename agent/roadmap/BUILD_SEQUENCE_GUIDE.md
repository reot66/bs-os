# Build Sequence Guide for Owner

وقتی می‌خواهی capability بعدی را انتخاب کنی:

1. بگو چه Module/Feature می‌خواهی.
2. Agent prerequisites را از dependency graph بررسی کند.
3. اگر prerequisite ناقص است، فقط prerequisiteهای ضروری را لیست کند.
4. Agent Basic vs Advanced را ارائه کند.
5. Owner Level را انتخاب کند.
6. Agent Feature PRD/implementation plan را update کند.
7. Development شروع شود.

## Example
Owner: «Social را بساز»

Agent باید بگوید:
- prerequisites: Business, RBAC, Module Registry, Events, Integration layer, Usage foundation, Storage.
- Basic vs Advanced scopes.
- منتظر selection بماند.

اگر Foundation آماده باشد، نیاز نیست CRM یا Commerce قبل از Social ساخته شده باشند.
