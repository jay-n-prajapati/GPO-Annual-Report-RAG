# Cleaning rules (APPROVED 2026-10-14: A, B, D accepted as recommended; C pending spot check)

Based on `data/extracted/raw-pages.txt` (82 pages). Each rule cites what was observed. Nothing here is
implemented yet. Rules run per page, in this order, so page numbers survive into chunks.

| # | Rule | Observed | Risk |
|---|------|----------|------|
| 1 | Drop pages with no text after cleaning | PDF page 2 is empty | None |
| 2 | Remove known running headers/footers. Compare with all spaces stripped against a fixed list: `U.S.GOVERNMENTPUBLISHINGOFFICE`, `2018ANNUALREPORT`, `KEEPINGAMERICAINFORMED`, `OFFICIAL\|DIGITAL\|SECURE`, `U.S.GovernmentPublishingOffice\|FinancialYearInReview–FY2018`; strip the matched span even when glued to the next sentence (`...O F F I C EThe United States`) | ~32 spaced-letter header/footer lines, many glued to following text with no newline | An explicit list is precise but must be extended if a new header turns up. A generic "spaced capitals" regex would also delete real headings such as `A U D I T R E P O R T` and `R E P O R T N U M B E R 1 9 - 0 1` |
| 3 | Drop a line that is only 1-3 digits when it is the first or last line of a page | 60 lines of just a number (printed page numbers), but bare numbers also appear in financial tables | Only edge-of-page lines are touched, so table numbers survive |
| 4 | Strip dot leaders `…{3,}`; exclude the table-of-contents page(s) from the index | TOC on PDF page 33 has 9 leader lines (~268 `…` in total) | A TOC chunk would match section names without containing answers |
| 5 | Join hard-wrapped lines within a page into one flowing text; collapse repeated whitespace | Lines break mid-sentence at ~38-80 chars with no blank lines, so paragraph breaks are not in the extraction | Paragraph structure is lost, see open question A |
| 6 | End-of-line hyphen: remove the line break, keep the hyphen | 10 cases, a mix of real compounds (`Vance-` + `Cooks`, `passport-`) and split words (`build-` + `ing`) | Keeping the hyphen can leave `build-ing`, which is harmless for embeddings and avoids wrongly gluing real compounds |
| 7 | Normalize characters: Unicode NFKC, curly quotes to straight (`’` → `'`), `–` `—` `‐` to `-`, `•` to `- ` | 221 `’`, 72 `–`, 14 `—`, 16 `•`, 4 `‐` | None for numbers; makes `GPO's` and `FY 2018 - FY 2019` match consistently |
| 8 | Never alter digits, commas or decimal points | Facts like `802,834` and `166` must stay exact | n/a |

## Safety net
After cleaning, an automated check asserts the facts we know must survive, for example `802,834`,
`166 depository libraries`, `govinfo`. If a rule deletes one, the ingest run fails instead of silently
losing content.

## Open questions
- A. Paragraphs: the extraction has no paragraph breaks, so our chunker (D-16, "paragraph-aware") becomes
  "sentence-aware": split on sentence ends, pack to ~800-1000 chars. Accept this?
- B. Page numbers: citations would use the PDF page index. Printed page numbers differ (PDF page 4 is printed
  page 2). Cite PDF index (simple, matches viewer's page counter) or printed number?
- C. Columns: page 4 looks like a narrow side column. Reading order needs a spot check on a few pages
  before we trust rule 5.
- D. Financial statement pages are mostly tables of bare numbers; they will chunk poorly. Keep them in the
  index or exclude? (Not needed for the acceptance questions.)
