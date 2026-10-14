# Golden set review (DRAFT, awaiting user approval)

File: `evals/golden.json`. Page numbers are PDF page indices (D-35), matching `data/extracted/raw-pages.txt`
(`===== PAGE N =====`). Check each row by searching the PDF (or that file) for the quoted evidence.
Tuning (chunk size, top-k, prompt, cutoffs) does NOT start until you approve this set.

| id | type | question | expected (all must appear) | pages | evidence in raw text |
|----|------|----------|----------------------------|-------|----------------------|
| g01-libraries | fact | How many depository libraries did GPO staff visit in FY 2018? | 166 | 5, 21 | p5 "in FY 2018 GPO staff visited 166 depository libraries in 25 states" |
| g02-govinfo | fact | What new digital system replaced FDsys, and when was it fully deployed? | govinfo; December 2018 | 4, 10, 22 | p4 "full-scale deployment of govinfo ... goal of retiring FDsys in December 2018"; p22 "completely retired and replaced by govinfo in December 2018" |
| g03-procurement | fact | How much did GPO procure ... on behalf of federal agencies? | 375 | 5, 14, 17 | p5 "more than $375 million"; p14/p17 "$375.7 million" |
| g04-copies-titles | multi-fact | How many titles and how many copies did GPO distribute to depository libraries in FY 2018? | 802,834; 4,211 | 5, 15, 19 | p5 "802,834 copies of 4,211 titles" |
| g05-webinars | multi-fact | How many FDLP Academy webinars ... and how many participants? | 85; 10,000 | 5 | p5 "over 85 FDLP Academy webinars ... more than 10,000 participants" |
| g06-revenue-fy2017 | trap | What were GPO's operating revenues in FY 2017? | 874.3 | 26, 43 | p26 "$874.5 million in FY 2018 and $874.3 million in FY 2017" |
| g07-operating-expenses | numeric | What were GPO's operating expenses in FY 2018? | 825.3 | 26, 44 | p26 "(to $825.3 million from $821.2 million)" |
| g08-congressional-record | numeric | How many Congressional Record pages did GPO produce in FY 2018? | 47,623,312 | 14 | p14 table "Congressional Record pages produced 47,623,312" |
| g09-oos-fy2019 | out-of-scope | How many Congressional Record pages did GPO produce in FY 2019? | exactly `Not in the document.` | - | only the FY 2018 figure exists; no FY 2019 count found by search |
| g10-oos-world-knowledge | out-of-scope | What is the capital of France? | exactly `Not in the document.` | - | no "France"/"Paris" anywhere in the text |

## Judgment calls to review
- g02: the document says FDsys was *scheduled* for retirement in December 2018, so "fully deployed" is
  answered by that date; the check is deliberately just `govinfo` + `December 2018`.
- g03: "375" matches both $375 million and $375.7 million, because both are correct in the document.
- g06 is the near-duplicate trap (FY 2017 = 874.3, FY 2018 = 874.5). String match alone cannot catch an answer
  that quotes both years but attributes them wrongly; only the 874.3 presence is checked.
- Net income was avoided on purpose: the document gives several different "net income" figures
  ($20.4M, $52.6M, $58.9M) depending on exclusions, which would need a nuanced expected answer.
- The refusal check is strict: the answer must equal `Not in the document.` after trimming.

## Matching rules
Case-insensitive, whitespace collapsed, thousands separators removed on both sides ("802,834" matches
"802834"). The faithfulness hint flags numbers in the answer (page citations excluded) that appear in none
of the retrieved chunks; it is a warning, not a failure.
