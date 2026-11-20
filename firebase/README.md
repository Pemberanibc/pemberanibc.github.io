# Firebase security rules

`database.rules.json` is the recommended set of Realtime Database rules for everything this site uses.
GitHub does not apply it: rules live in the Firebase console, so this file is the reference copy.

## Apply

1. Open the [Firebase console](https://console.firebase.google.com/project/pemberani-badminton) → **Realtime Database** → **Rules**.
2. Copy what is there now into a text file as a backup.
3. Open the **Data** tab and look at the top-level names. This file covers `admins`, `certLog`, `familyNight`,
   `jerseyTracker`, `pt2`, `pt3` and `tournament`. If you see any other name, add a block for it first: anything
   not listed here becomes closed. Then paste the whole of `database.rules.json` into the **Rules** tab.
4. Click **Publish**, then open `/score/`, sign in, and check that scoring and the certificate log still work.

## What each block does

| Path | Who can read | Who can write |
| --- | --- | --- |
| `admins` | Nobody from the browser (rules still read it) | Nobody from the browser: add admins in the console |
| `pt3` | Everyone (live scores, the live draw) | Signed-in accounts listed in `admins` |
| `pt2` | Everyone (Edition 2.0 archive) | Admins |
| `certLog` | Admins (the scorer console shows who downloaded an Edition 2.0 certificate) | Nobody, while e-certificates are closed. When Edition 3.0 certificates open, change `".write": false` back to `"!data.exists() && newData.exists()"` and update the `pair` and `kind` patterns to the Edition 3.0 values. The validation rules below it keep entries to the exact shape the certificate page sends |
| `tournament` | Everyone (the Edition 1.0 archive page reads its saved results) | Nobody. Edition 1.0 used a passcode checked in the browser, which did not stop anyone writing; this closes it |
| `jerseyTracker` | Nobody | Nobody. The old Jersey Payment Tracker page (names and payment status, open to anyone) is no longer on any site; the data stays in the console |
| `familyNight` | Nobody | Nobody. The family scoreboard pages were removed from the site; the old scores stay in the database (export or delete them in the console) |

Anything not listed is closed, because Realtime Database rules deny by default.
