File Naming convention: [YYYY-MM-DD]_[FeatureOrBugName]_QA.md

# Test Log: [Feature / Module Name]

**Date:** YYYY-MM-DD  
**Tester:** [Current AI Model Name] (eg. Claude Opus 4.8, or GPT Terra 5.6, or ...)
**Phase:** [Phase Number / Name]  
**Task / Implementation:** [Brief description]

---

## 1. Scope

**Requirements Tested:**

- [Requirement or behavior]
- [Requirement or behavior]

**References:**

- [Relevant plan section]
- [Relevant development log]
- [Other relevant reference]

---

## 2. Test Results

| ID | Test / Scenario | Expected Result | Status | Notes |
|---|---|---|---|---|
| T-01 | [Scenario] | [Expected behavior] | PASS / FAIL | |
| T-02 | [Scenario] | [Expected behavior] | PASS / FAIL | |

---

## 3. Automated Testing

**Tests Run:**

```text
[Command or test suite]
```

**Result:**

- Passed:
- Failed:
- Not Run:

**Coverage:** [If applicable]

---

## 4. Issues Found

### [BUG-01] [Short Title]

- **Severity:** Critical / High / Medium / Low
- **Category:** Functional / Data / Firebase / UI / Accessibility / Localization / Other
- **Location:** [File, component, or feature]

**Expected:**

[Expected behavior]

**Actual:**

[Actual behavior]

**Steps to Reproduce:**

1. [Step]
2. [Step]
3. [Step]

**Evidence:**

[Error message, failed test, screenshot reference, or other evidence]

---

## 5. Final Status

**Status:** PASSED / FAILED / CONDITIONALLY PASSED

**Summary:**

[Brief summary of the testing outcome.]

**Required Action:**

[None / Fix listed issues and return for retesting]

---

# Retest History

## Retest — YYYY-MM-DD

**Status:** PASSED / FAILED / CONDITIONALLY PASSED

**Issues Retested:**

- [BUG-01] — Resolved / Still Failing
- [BUG-02] — Resolved / Still Failing

**New Issues:**

- [None or issue references]

**Notes:**

[Brief retest summary]