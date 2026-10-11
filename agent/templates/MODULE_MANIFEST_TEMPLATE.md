# Module Manifest Contract — Reference

```yaml
id: <module-id>
name: <name>
version: 1.0.0
scope:
  - business

platform:
  min_version: "..."

dependencies:
  core:
    - business
    - customer
    - events

permissions:
  - <module>.view
  - <module>.manage

events:
  publishes: []
  consumes: []

usage_metrics: []

configuration: []

integrations: []

ui:
  navigation: true
  routes: []

data_governance:
  schema: <module>
  personal_data: []
  exportable: true
  tenant_deletion: purge
```
