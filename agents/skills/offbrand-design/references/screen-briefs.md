# Screen briefs — one question per route

Off+Brand open every case study by naming the question the design must answer. This file does the same for all thirteen SnapWorth routes from SDD Appendix A, plus the two additions noted below.

A screen is finished when a stranger can answer its question at a glance, and when all of its required states are drawn — not when the happy path renders.

| Route | The one question | Dominant element | Primary action | Required states |
|---|---|---|---|---|
| `/` | — (redirect only) | — | — | Session check; no visible UI beyond splash |
| `/login` | Can I get back in without thinking? | Email field | Sign in | idle · submitting · invalid credentials · offline |
| `/signup` | What do I give up to start? | Email field | Create account | idle · submitting · email taken · offline |
| `/reset-password` | Will I get back in? | Email field | Send reset link | idle · sent · error |
| `/capture` | What is this thing worth? | Viewfinder | Shutter | permission not granted · ready · capturing · uploading · upload failed · offline |
| `/item/[id]` | **What is it worth, and how much should I trust that?** | Estimated value | Choose a destination | estimating · estimated · estimate failed + retry · saved-to-history confirmation |
| `/list/[id]` | What am I actually asking for it? | Price input | Publish listing | empty (publish disabled) · valid · invalid price · publishing · failed |
| `/history` | What have I already checked? | Item grid | Open an item | loading · empty (first run) · populated · delete confirmation |
| `/feed` | Does the community think this price is right? | Post card photo + price | Cast a vote | loading · empty · populated · vote pending · own post (voting disabled) |
| `/post/[id]` | What do people actually think, and why? | Vote tally | Add a comment | loading · no comments · populated · comment submitting · comment held by moderation · blocked notice |
| `/marketplace` | Is there something here I want? | Listing grid | Open a listing | loading · empty · filtered-to-empty · populated |
| `/listing/[id]` | Is this worth buying, and is the price fair? | Photo + asking price | Message the seller | loading · active · sold/withdrawn · own listing (contact hidden) |
| `/chat` | Who am I mid-conversation with? | Conversation list | Open a conversation | loading · empty · populated · unread |
| `/chat/[id]` | What are we agreeing on? | Message thread | Send | loading · empty · populated · sending · send failed (text preserved) · blocked |
| `/admin/review` | What needs a human decision, most urgent first? | Held-content list | Approve / remove | loading · empty queue · populated · action pending |
| `/onboarding` | Why should I take one photo? | Photo-to-price illustration | Take first photo | three steps · skippable |

## Notes on the two additions

`/chat` (conversation list) and `/onboarding` are not in SDD Appendix A. They are required by SRS 3.1.11 (a list of open and past conversations) and SRS 3.2.3 (a first-run introduction to the photo-to-price loop) respectively. Both need a change-log entry under PMP §3.3 and an Appendix A revision.

## The screen that matters

`/item/[id]` is the product. It is the only screen where the estimate appears at `price.hero`, the only screen permitted the `motion.reveal` animation, and the screen against which the 10-second budget is measured. It carries the whole tension of the design system: the number must feel confident enough to act on and honest enough to question.

Design its three failure states before its success state:
1. **Estimating** — photo visible immediately, progress against it, never a blank screen.
2. **Failed** — plainly stated, retry offered, and an explicit reassurance that the photo is already saved (SDD §5 persists the item before requesting the estimate, so this is true and worth saying).
3. **Offline** — the item is queued, and the user is told so.
