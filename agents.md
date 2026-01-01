# Agents Rules

- Always add important rules to this document.
- Follow existing conventions unless there is a strong reason to deviate.
- Always favour strict typing and avoid `any`/`unknown` unless there is a well-documented reason.
- Break functionality into reusable, easily testable utilities. Keep shared helpers in local modules or `lib`.
- Whenever adding or modifying helpers in `extension/ui/src/lib`, update `extension/ui/src/lib/README.md` with descriptions of the exported functions.
- Run `npm run typecheck` and `npm run build` after any task.
- Keep the API layer (files under `src/api`) limited to raw transport: work purely with DTO types, do not introduce caching, data massaging, or other business logic there.
- Expose all application-facing logic through services (e.g. `src/services/*`), which consume API DTOs, map them into domain entities (DTO suffix removed), and encapsulate caching, aggregation, pagination helpers, etc.
- Every data contract coming from the backend must be represented as a `...Dto` interface. DTO shapes mirror backend responses exactly and must never be altered for convenience—derive separate domain types instead.
- In the bots page filters, use Ant Design `Select` components instead of native selects for consistency.
