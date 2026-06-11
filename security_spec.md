# VoxCADD Security Specification

## Data Invariants and Relational Sync (Zero-Trust Architectural Hardening)

1. **User Identity Isolation**: All files, metadata, and drawings belonging to a given `userId` MUST only be accessible (read/write) by the owner who holds the matching `request.auth.uid`.
2. **Path Integrity**: Path document IDs (like `fileId`) must match our safe format pattern (alphanumeric, underscores, hyphens) to prevent path injection or directory traversal attempts.
3. **Immutability of Key Identification**: Parameters such as `fileName` and `uid` within metadata collections must remain strictly immutable upon target document creation and during subsequent updates.
4. **Strict Payload Integrity**: Data payloads must restrict incoming keys to a predefined range of expected schema attributes. Phantom fields, role escalation flags, or shadow parameters must be rejected.
5. **String Bounds & Limits**: Every string field MUST be bounded (e.g. maximum file name length is 255 characters, device info is at most 256 characters) to prevent Denial of Wallet storage exhaustion.
6. **Temporal Safety**: Timestamps like `lastModified` MUST exactly equal the authoritative server timestamp `request.time`. Client-supplied past or future clock times are strictly rejected.

---

## The "Dirty Dozen" Threat Payloads (Targeting Vulnerabilities)

Below are twelve crafted adversarial payloads designed to test and violate rules logic:

### 1. UID Spoofing
Authenticated as user `attacker_id`, attempting to write user metadata with `uid` set to `victim_id`.
```json
{
  "uid": "victim_id",
  "theme": "light",
  "lastModified": "request.time"
}
```

### 2. Metadata Ghost-Field Attack (Role Escalation)
Attempting to insert a malicious administrative privilege flag in metadata schema keys.
```json
{
  "uid": "victim_id",
  "theme": "dark",
  "lastModified": "request.time",
  "isAdmin": true
}
```

### 3. File Metadata Sync-Sloppiness (Path Bypass)
Trying to create a meta-file with a fileName size exceeding boundary checks (e.g., 10,000 characters).
```json
{
  "fileName": "A_VERY_LONG_STRING_REPEATED_TEN_THOUSAND_TIMES...",
  "fileSize": 1024,
  "lastModified": "request.time",
  "isSynced": true
}
```

### 4. Immense Device Information Payload
Injecting an extremely bloatedDeviceInfo parameter in UserMetadata to consume bandwidth.
```json
{
  "uid": "user_id",
  "deviceInfo": "10MB_OF_GARBAGE_CHARACTERS...",
  "lastModified": "request.time"
}
```

### 5. File Metadata Tag Injection
Providing non-string values into the user tags list or exceeding the tag quantity limit.
```json
{
  "fileName": "test.dwg",
  "lastModified": "request.time",
  "tags": [12345, "legit", {"nested": "malicious"}],
  "isSynced": true
}
```

### 6. Invalid ID Path Target Injection
Attempting to create a file record with an invalid document path parameter `file%20Id` (containing spaces, slashes, or special escape codes).

### 7. Spoofed Past Timestamp Modification
Attacking temporal integrity by providing a past or custom timestamp to subvert revision synchronization systems.
```json
{
  "fileName": "test.dwg",
  "lastModified": "2020-01-01T00:00:00Z"
}
```

### 8. Bloated Layers Attack (Exceeding Bounds)
Inserting an exceedingly large map of layer names (e.g. 5,000 layers) to trigger memory crashes during rendering or high database access bills.

### 9. File Name Mutation in Subsequent Update Action
Attempting to rename the actual underlying physical file name during synchronization.
```json
{
  "fileName": "renamed_secret_file.dwg",
  "lastModified": "request.time",
  "isSynced": true
}
```

### 10. Malformed List Content Verification (Empty / Non-string tags)
Inserting empty lists or lists where first items are numbers rather than standard strings.

### 11. Bypassed Global Catch-all Rules Read
Attempting direct unauthorized GET request or query enumeration on root level collections.

### 12. Sibling Document Invalidation (Orphaned Files)
Uploading drawings with mismatched file references in adjacent files collection.

---

## Verification Test Runner Schema
All above Dirty Dozen requests are verified against `firestore.rules` and assert a strict `PERMISSION_DENIED` outcome, ensuring total compliance.
