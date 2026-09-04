# Design QA

- Reference: user-provided Reachard header and Simplify bottom-sheet screenshots.
- Target: Reachard extension panel on a live LinkedIn job page.
- Source check passed: the panel is now a single page with job card, primary action, and inline email preferences.
- Source check passed: contact loading, errors, and results render inside an animated bottom sheet.
- Source check passed: the panel and header use a white background with no header divider or tab navigation.
- Live verification blocked: Chrome is still serving the previously loaded extension version. The unpacked extension must be reloaded before the updated panel can be captured and interaction-tested.

final result: blocked
