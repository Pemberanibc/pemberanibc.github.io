# Firebase security rules

`database.rules.json` is the recommended set of Realtime Database rules for everything this site uses.
GitHub does not apply it: rules live in the Firebase console, so this file is the reference copy.

## Apply

1. Open the [Firebase console](https://console.firebase.google.com/project/pemberani-badminton) → **Realtime Database** → **Rules**.
2. Copy what is there now into a text file as a backup.
3. **If the project holds data for anything other than this site** (for example the old jersey tracker), keep those
   blocks and add the blocks below beside them. Pasting this whole file removes access to any node it does not list.
4. Click **Publish**, then open `score.html`, sign in, and check that scoring and the certificate log still work.

## What each block does

| Path | Who can read | Who can write |
| --- | --- | --- |
| `admins` | Nobody from the browser (rules still read it) | Nobody from the browser: add admins in the console |
| `pt3` | Everyone (live scores, the live draw) | Signed-in accounts listed in `admins` |
| `pt2` | Everyone (Edition 2.0 archive) | Admins |
| `certLog` | Admins | Anyone, but only **new** entries in the exact shape the certificate page sends: name 3–60 characters, a real pair id, kind and format from a fixed list, server time. Entries cannot be edited or deleted from the browser |
| `familyNight` | Nobody | Nobody. The family scoreboard pages were removed from the site; the old scores stay in the database (export or delete them in the console) |

Anything not listed is closed, because Realtime Database rules deny by default.
