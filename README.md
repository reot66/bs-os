# Business OS — REBZZ

Business OS (REBZZ) is a modular platform for establishing, operating, managing, and growing businesses.

## Vision

Provide businesses with a unified operating environment that combines digital presence, business management, customer relationships, commerce, marketing, analytics, and future intelligent automation.

## Architecture

The project follows a modular monolith architecture organized as a monorepo.

The shared platform foundation provides reusable systems for identity, organizations, businesses, customers, permissions, and module management.

Business capabilities are implemented as independent modules with clearly defined responsibilities and integration contracts.

## Main capabilities

Planned modules include:

- Website Builder
- CRM
- Commerce
- Booking
- Social Management
- Customer Support
- Marketing
- Projects
- Analytics
- Integrations
- AI Assistance

These capabilities will be implemented incrementally.

## Development approach

The project is developed using small, independently reviewed tasks.

The product owner approves the scope and important decisions.

An AI development architect prepares implementation specifications and reviews results.

OpenCode implements approved tasks.

Each task must pass the required checks before the next task begins.

## Documentation

All approved project specifications are located in [`agent/`](agent/).

Development instructions are located in [`AGENTS.md`](AGENTS.md).

Task records are located in [`docs/tasks/`](docs/tasks/).

## Current status

The project is in the foundation stage.

The presence of a planned capability does not mean it has been implemented.