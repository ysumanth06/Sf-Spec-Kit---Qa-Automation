# SFSpeckit-E2E Scoring Rubric (150 Points)

## Category 1: Acceptance Criteria Coverage (30 points)

| Criteria | Points | How to Score |
|----------|--------|-------------|
| Every Given/When/Then AC has at least 1 test | 10 | -2 per missing AC |
| Each AC has both positive and negative variants | 10 | -2 per AC missing a negative test |
| Edge cases covered (empty, boundary, special chars) | 10 | -2 per missing edge case type |

## Category 2: Persona Coverage (25 points)

| Criteria | Points | How to Score |
|----------|--------|-------------|
| Every persona in Security Matrix is tested | 10 | -3 per missing persona |
| Negative persona tests (users who should NOT have access) | 10 | -3 per missing negative persona test |
| Persona-specific field visibility assertions | 5 | -1 per missing FLS assertion |

## Category 3: Database Verification (20 points)

| Criteria | Points | How to Score |
|----------|--------|-------------|
| CRUD operations have `verifyDatabase` steps | 10 | -3 per save without DB verification |
| SOQL assertions check correct fields | 5 | -1 per incorrect/missing field in query |
| Null/not-null checks for date and formula fields | 5 | -1 per missing null check |

## Category 4: Data Setup & Cleanup (20 points)

| Criteria | Points | How to Score |
|----------|--------|-------------|
| Test data created via `setup.dataFactory` | 10 | -5 if tests assume existing data |
| All created records use `QA_PREFIX` naming | 5 | -2 per record without prefix |
| Complex relationships use `setup.apex` block | 5 | -3 if complex data is hand-waved |

## Category 5: Error Handling & Validation (20 points)

| Criteria | Points | How to Score |
|----------|--------|-------------|
| Validation Rules tested with triggering data | 10 | -3 per VR not tested |
| Error messages asserted with `assertErrorMessage` | 5 | -1 per missing error assertion |
| Required field tests (leave blank, assert error) | 5 | -1 per required field not tested |

## Category 6: JSON DSL Compliance (20 points)

| Criteria | Points | How to Score |
|----------|--------|-------------|
| All actions are from the supported action list | 10 | -5 per invented/unknown action |
| No raw TypeScript or Playwright code in output | 5 | -5 if ANY raw code is generated |
| JSON is valid and parseable | 5 | -5 if JSON has syntax errors |

## Category 7: Test Organization (15 points)

| Criteria | Points | How to Score |
|----------|--------|-------------|
| Each test has a unique `id` (TC-001, TC-002) | 5 | -1 per duplicate or missing ID |
| Tests are tagged with AC references (`AC-1`, `AC-2`) | 5 | -1 per untagged test |
| Test titles are descriptive and include persona name | 5 | -1 per vague title |

---

## Scoring Thresholds

| Score | Rating | Action |
|-------|--------|--------|
| 135-150 | ⭐ EXCELLENT | Ship it. |
| 120-134 | ✅ PASSING | Acceptable. Minor improvements optional. |
| 100-119 | ⚠️ NEEDS WORK | Revise before execution. |
| Below 100 | ❌ FAILING | Regenerate the test suite. |

**Minimum passing score: 120/150**
