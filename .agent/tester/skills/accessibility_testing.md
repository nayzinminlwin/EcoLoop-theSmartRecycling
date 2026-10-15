# Accessibility Testing Skill

## Purpose

Use this skill when testing UI accessibility and usability.

The EcoLoop application targets **general public (resident) users** and follows a clean, accessible design. Accessibility requirements are treated as functional requirements rather than optional visual improvements.

---

## 1. Text

Verify relevant screens use readable text sizes.

The project target is:

- **Minimum body text: 14sp** (labels 11–13sp; home H1 25; page H1 29)

Check that text remains usable when system font scaling is increased.

Look for:

- Truncated text
- Unexpected wrapping
- Overlapping elements
- Text becoming inaccessible at larger font sizes

---

## 2. Touch Targets

Interactive controls should provide sufficiently large touch areas.

The project target is:

- **Minimum touch target: 48dp**

Check:

- Buttons
- Icons
- List actions
- Navigation controls
- Form controls
- Dialog actions

Do not judge only by the visible icon size; consider the actual interactive area.

---

## 3. Visual Clarity

Verify:

- Sufficient contrast
- Clear hierarchy
- Important actions are visually distinguishable
- Text is readable against its background
- States such as disabled, selected, loading, and error are understandable

Do not rely on color alone to communicate important information.

---

## 4. Screen Layout

Test relevant screens on supported device sizes.

Look for:

- Clipped content
- Overlapping widgets
- Controls outside the viewport
- Broken scrolling
- Dialogs that cannot be fully used
- Keyboard covering important fields or buttons
- Layout failures with larger text

Test both normal and enlarged text where practical.

---

## 5. Semantics & Screen Readers

Where applicable, verify that important controls expose meaningful semantics to accessibility services such as Android TalkBack.

Check that:

- Buttons have understandable labels.
- Icons without visible text have meaningful descriptions.
- Decorative elements are not announced unnecessarily.
- Form fields have understandable labels.
- Interactive elements can be reached in a sensible order.

A screen should remain understandable when visual context is reduced.

---

## 6. Forms

For important forms, verify:

- Labels clearly identify fields.
- Input purpose is understandable.
- Validation errors are noticeable.
- Error messages identify what needs correction.
- Keyboard/input configuration is appropriate.
- Users can reach and operate required controls.

Do not rely exclusively on color or icons to indicate validation errors.

---

## 7. Resident Usability

Pay particular attention to whether a resident user can understand and operate the interface without unnecessary friction.

Look for:

- Ambiguous icons
- Tiny controls
- Excessively dense layouts
- Hidden important actions
- Unclear navigation
- Technical error messages
- Unexpected gestures
- Long or confusing interaction sequences

Report these as accessibility/usability issues when they conflict with the approved design requirements.

Do not reject an interface merely because you personally prefer another design.

---

## 8. Accessibility Regression

When modifying an existing screen:

- Recheck affected controls.
- Recheck text scaling.
- Recheck navigation.
- Recheck semantics when relevant.
- Ensure previously accessible interactions remain usable.

Accessibility fixes must not introduce new layout or interaction problems.

---

## 9. Completion Criteria

Accessibility testing is sufficient when:

- Required text and touch-target standards are met.
- Important controls are understandable and operable.
- Relevant large-text scenarios work.
- No significant clipping or layout failure exists.
- Important accessibility semantics are present.
- No blocking resident usability issue remains.