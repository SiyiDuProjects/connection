# Contact search quality

The Treg search remains restricted to the current company. Job title, school and
location are ranking signals, not provider filters. The API response stays
`{ contacts: [...] }` with at most 10 people; no extension update is required.

Ranking gives role relevance 40 points and seniority fit 15. Seniority is useful
only in a related function. For individual contributor jobs, peers and direct
managers outrank equivalent directors and executives. Leadership searches still
prefer relevant leadership. Title classification uses word boundaries and handles
finance analysts, product designers, vice presidents and board-only titles.

Company verification uses the provider's domain when both sides have one, with
normalized company-name equality as fallback. Conflicting domains, missing company
evidence and explicitly former employment are not turned into current-company
matches. A target domain is never copied into a provider record as evidence.

Search starts with `TREG_SEARCH_SIZE` candidates (default 25). If fewer than 10
unique eligible people or fewer than 3 role-related people remain, it follows the
provider cursor with the identical query. `TREG_SEARCH_MAX_PAGES` defaults to 3
and is capped at 3: at default settings this requests at most 75 candidate slots.
Set it to 1 to retain a single-page ceiling. Extra pages may incur provider cost
and latency; app search credits remain zero. Costs from successful pages are
summed. Retrieval stops on exhaustion or a repeated cursor; an optional page
failure preserves already eligible results. No results are invented to reach 10.

The cursor contract is documented by Icypeas:
https://api-doc.icypeas.com/leads-db/find-people/#pagination

`contacts.search_candidates` logs counts of received, invalid, company-mismatched,
duplicate and eligible candidates without names or profile URLs. This separates
provider scarcity from local rejection without another paid diagnostic call.

Verification (all fixtures, no live paid provider calls):

```sh
npm run test:search-quality
npm run test:treg
npm run test:intelligence
npm run test:intelligence:large
```

Fixtures exercise six job families, legitimate leadership searches, an unrelated
first page, first-page scarcity, company aliases with matching domains, conflicting
domains, former jobs, URL deduplication, repeated cursors, page caps, exhausted
results, partial failures and multi-page cost accounting. Provider data availability
and real candidate relevance still require observing actual user searches.
