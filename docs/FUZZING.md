# Targeted Fuzzing — Method & Results

White-box, coverage-guided-by-hand fuzzing of validated endpoints.
Harness: `backend/scripts/fuzz.mjs` (`npm run fuzz`, backend running).

## Method

A corpus of hostile values is fired at the endpoints with the richest input
schemas. The corpus includes: oversized strings (100 KB), empty/whitespace,
type confusion (numbers/booleans/arrays/objects where scalars are expected),
XSS/SQLi/path-traversal/null-byte strings, unicode, **NoSQL operators**
(`$gt`, `$ne`, `$where`), **prototype-pollution** attempts (`__proto__`), and
deeply nested objects. Each response is checked against three invariants:

1. **No 5xx** — the server must never crash on bad input.
2. **Malformed input → 4xx** — validation rejects it cleanly.
3. **No privilege escalation** — `role` must remain `customer` throughout.

## Finding: unhandled oversized-payload → HTTP 500 (FIXED)

The first run surfaced **19 × HTTP 500** responses. Root cause: the 10 KB
`express.json` body limit raised a `PayloadTooLargeError` (and malformed JSON
raised a `SyntaxError`) that the central error handler did not recognise, so a
**client** error was masked as a **500 server** error — poor robustness and a
minor information/behaviour smell.

**Fix** (`middleware/errorHandler.ts`): honour a 4xx `status`/`statusCode` on
body-parser-style errors and return the correct code (**413** for oversized,
**400** for malformed JSON) with a generic message — no stack traces leaked.

**Retest:**

```
── Fuzz summary ─────────────────────────────
requests:       246
status counts:  {"200":19,"400":206,"413":19,"429":2}
5xx (crashes):  0 ✅
privilege escalations: 0 ✅
final role:     customer
```

All three invariants now hold. (`429`s are the auth rate limiter engaging, which
is expected/desired.) This finding and fix are captured in the commit history
and are a good "before/after" candidate for the PoC video.
