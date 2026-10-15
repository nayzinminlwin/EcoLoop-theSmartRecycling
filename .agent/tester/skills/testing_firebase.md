# Firebase Testing Skill

## Purpose

Use this skill when testing functionality involving Firebase Authentication, Cloud Firestore, Cloud Functions, or Firebase-backed application state.

The primary concerns are **correctness, data isolation, persistence, failure handling, and synchronization**.

---

## 1. Authentication

Verify relevant authentication flows:

- Registration
- Login
- Logout
- Session restoration
- Invalid credentials
- Authentication failures
- Unauthorized access

After logout, verify that protected application state cannot continue to be accessed as an authenticated user.

Verify authentication-dependent providers and screens react correctly when authentication state changes.

---

## 2. Firestore

Verify:

- Correct collection/document paths.
- Correct user ownership.
- Correct field names and data types.
- Correct serialization/deserialization.
- Create, read, update, and delete behavior.
- Required timestamps and identifiers.
- Empty collections.
- Missing documents.
- Firestore errors.

For user-owned data, verify that one authenticated user cannot read or modify another user's data.

Do not assume a correct UI means the stored data is correct. Inspect the actual data flow when necessary.

---

## 3. Data Integrity

Pay special attention to persistent application data such as:

- Deposit transactions and recycling history
- Wallet balance and reward progress
- Reward catalog and redemption records
- Resident vouchers
- User profile information
- Notification preferences and security metadata

Verify that:

- Data survives application restarts when persistence is expected.
- Updates do not unintentionally overwrite unrelated fields.
- Deletion removes the intended data only.
- Repeated operations do not create unintended duplicates.
- Dates and timestamps remain consistent.

---

## 4. Offline & Synchronization

When the feature supports offline behavior, test:

1. Data available before going offline.
2. Application behavior while offline.
3. Creation or modification while offline.
4. Restoration of connectivity.
5. Synchronization after reconnection.

Check for:

- Lost writes
- Duplicate writes
- Stale UI
- Conflicting state
- Incorrect timestamps
- Unexpected errors

Offline behavior should follow the requirements of the relevant feature rather than assumptions about Firebase's default behavior.

---

## 5. Cloud Functions

For Cloud Function-backed features, verify:

- Correct request parameters.
- Correct authentication requirements.
- Successful response handling.
- Error response handling.
- Timeout or unavailable-service behavior.
- Correct persistence of returned results where applicable.

For AI-related functionality, verify that the Flutter application uses the approved backend/Cloud Function path rather than exposing protected API credentials in the client.

Do not require a specific implementation unless it is required by the project plan.

---

## 6. Error Handling

Test Firebase failures where relevant:

- No network connection
- Permission denied
- Authentication expired
- Missing document
- Invalid data
- Service failure
- Function failure

The application should fail gracefully rather than:

- Crash
- Remain indefinitely in a loading state
- Display misleading success
- Silently discard user data

---

## 7. Security Boundaries

Treat these as high-priority verification areas:

- Authentication requirements
- Firestore ownership rules
- Unauthorized reads/writes
- Client-side exposure of secrets
- Cloud Function authorization

If a security boundary is broken, report it immediately with appropriate severity.

Do not attempt destructive security testing against production data.

---

## 8. Completion Criteria

Firebase testing is sufficient when:

- Required authentication behavior works.
- Data is stored and retrieved correctly.
- User ownership is respected.
- Relevant offline/synchronization behavior works.
- Cloud Functions handle success and failure correctly.
- No critical data-integrity or security issue remains.