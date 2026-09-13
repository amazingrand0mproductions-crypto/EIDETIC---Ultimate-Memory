# EIDETIC — Total Recall Engine

**Persistent, character-scoped long-term memory for AI Dungeon.**

EIDETIC is designed for long adventures where recurring characters should continue to remember events after those events have fallen out of the model's normal context window.

It does not literally enlarge the language model's hard context limit. Instead, it separates **storage** from **active context**: old events live in persistent script `state`, while a small retrieval packet containing only the most relevant memories is supplied to the model when needed.

## What the hardened build changes

The first build proved that a large persistent archive and selective retrieval could work. This hardened build focuses on memory **correctness**, not merely capacity.

### Witnesses are not subjects

Mentioning a character no longer makes that character a witness.

If you tell Alice, "Bob betrayed me," Alice can remember that conversation. Bob is stored as the **subject** of the memory, but does not receive it as private knowledge unless he was actually present.

Scene presence is alias-aware, so `Alice`, `Alice Mercer`, and other known aliases resolve to the same person. Movement and scene-transition language clears stale participants more aggressively.

### Epistemic memory

Archived memories now preserve what kind of information they contain:

- `EVENT` — presented as an event in the story
- `SAID/CLAIMED` — dialogue, testimony, or a claim
- `BELIEVED/SUSPECTED` — a thought, suspicion, assumption, or belief
- `UNCERTAIN` — rumour, possibility, or explicitly uncertain information
- `QUESTION/UNRESOLVED` — a question rather than a fact

This prevents a line such as "Alice suspects Daniel killed Mark" from silently turning into the objective fact "Daniel killed Mark" during later recall.

Automatic durable anchors are deliberately conservative: beliefs, questions, and uncertain statements do not become permanent factual anchors simply because they contain dramatic words.

### Recall can abstain

When a player explicitly asks a character to remember something and no matching archived evidence exists, EIDETIC can tell the model that no verified matching memory was found and that it must not invent one.

That is a major difference between "memory" and ordinary roleplay continuation: sometimes the correct answer is that the character does not remember or never knew.

### Retry and branch safety

Discarded AI retries are reconciled **before** the next generation when the discarded output is no longer present in History. A replacement player action on the same turn also invalidates the old same-turn model output immediately.

Undo still removes records from turns that no longer exist.

The result is transactional story memory: rejected realities should not remain in the character's head and bias the retry.

### Upgrade-safe state migration

Upgrading the script no longer destroys the archive just because the internal script version changed.

Old EIDETIC state is migrated in place. Existing hot memories, cold memories, anchors, characters, manual focus, and other safe fields are retained while missing schema fields are added.

### Compact cold archive

Recent memories remain detailed. Older memories are converted into a compact tuple representation rather than large repeated JavaScript objects.

Default capacity remains:

- **4,500 hot episodic records**
- **9,000 cold episodic records**
- **1,200 durable anchors**

The compact representation materially reduces serialized state size while keeping old v1-style object records readable during migration.

### Bounded retrieval work

The retrieval scanner no longer builds arbitrarily large temporary arrays of every matching record. It keeps a bounded candidate pool while scanning the archive.

This matters because AI Dungeon scripts run in a memory-limited sandbox. A retrieval engine should optimize both persistent state and temporary allocations.

### Better relevance

Importance and relevance are now treated separately.

A dramatic old memory is not automatically considered relevant to every recall question. Explicit recall requests require topical evidence rather than allowing raw importance alone to dominate ranking.

Known character-name tokens are separated from topical query tokens so simply saying `Alice` does not make every Alice memory equally relevant.

The lightweight search index also adds semantic tags such as:

- `@location`
- `@time`
- `@relationship`
- `@secret`
- `@promise`
- `@status`
- `@ability`
- `@item`
- `@role`

These are deliberately deterministic and local; EIDETIC does not require an external embedding service.

### Time-aware recall

Queries such as "first time", "earliest", "originally", "last time", "latest", and "most recent" influence retrieval order.

This helps distinguish historical facts from current or most-recent state rather than treating every matching event as timeless.

### Adaptive context budget

EIDETIC reads the `info.maxChars` and `info.memoryLength` values available to the model-context hook and scales its recall block instead of blindly consuming a fixed 3,200 characters on every model/context size.

The default target is at most **12% of the observed character budget**, capped by `RECALL_BLOCK_MAX_CHARS`. On very small contexts the control header becomes compact as well, so the block still respects the calculated hard cap.

This protects recent story history and other required context components from being unnecessarily displaced by the memory engine itself.

### Cache-visible revision handling

Every recall packet has a monotonically increasing revision number. When the payload changes, the newest block explicitly states that it is authoritative and older EIDETIC revisions must be ignored.

This is useful for append-only/cache-efficient context paths where an older appended block may remain physically visible.

### Player identity protection

The engine uses scenario placeholders and available `info.characterNames` data to prevent the player character's own name from accidentally being promoted into a separate NPC brain.

### Ambiguous names

A single first name can merge with its full form while unambiguous, but two different people such as `John Smith` and `John Doe` are kept separate. Once a first name becomes ambiguous, bare `John` is intentionally not resolved to one of them by guesswork.

### Detection Fortress — anti-junk character discovery

Version 4 adds a dedicated **5,000+ line detection hardening pass** to the Library. More than **3,600 explicit proper-looking non-person phrases** are used by the detector, alongside hard/soft vocabulary classes, entity-head classification, titles, kinship words, human-context signals, and scored evidence rules.

The detector does **not** simply ban common words. It separates evidence strength:

- Character Story Cards and creator-configured characters are trusted identities.
- Dialogue attribution, direct address, introductions, relationships, titles, and human possessive context are strong person evidence.
- Generic capitalization is weak evidence and normally needs repeated independent turns.
- Locations, rooms, vehicles, items, organizations, departments, events, systems, calendar words, headings, UI terms, and narrative vocabulary receive strong negative evidence.
- Ambiguous name-words such as `Rose`, `Hope`, `Raven`, `Summer`, `Hunter`, or `Monday` require genuine human evidence rather than repetition alone.
- A hard-classified word can still become a character when the story proves it is one—for example an explicitly attributed speaker named `Monday`.
- Leading titles are normalized during automatic detection so `Captain Reyes` and `Reyes` do not become two brains. Story Card aliases remain untouched.
- Zero-confidence observations are never written to persistent candidate state.
- Stale candidates expire after a configurable TTL and the candidate pool has a hard cap.

This is deliberately separate from Story Card generation: EIDETIC remembers characters, it does not create junk cards for every capitalized noun it sees.

## Core architecture

Each turn follows the same broad pipeline:

1. **Observe** — process the player action or AI output.
2. **Identify** — resolve characters, aliases, subjects, and likely scene participants.
3. **Classify** — determine importance, epistemic type, semantic tags, and knowledge owners.
4. **Store** — save the episodic record in persistent state.
5. **Compact** — move sufficiently old detailed records into the compact cold archive.
6. **Reconcile** — remove invalid retry/undo branch memories.
7. **Retrieve** — rank a bounded set of memories for active characters.
8. **Inject** — place a compact, scoped recall packet in Front Memory and cache-compatible Context fallback.
9. **Scrub** — remove the control packet if a model ever echoes it into visible story prose.

The entire archive is therefore **not** pushed into the model. Most of it remains outside active context until it becomes relevant.

## Install

Paste the files into the matching AI Dungeon script tabs:

| File | AI Dungeon tab |
|---|---|
| `Library.js` | Library |
| `Input.js` | Input |
| `Context.js` | Context |
| `Output.js` | Output |

Keep the first line of `Context.js` intact:

```js
// @cache-compatible
```

For an existing EIDETIC adventure, replace all four script tabs with the hardened files. The state migrator is intended to preserve the existing archive rather than initialize a blank one.

Always test upgrades in a duplicate Scenario/Adventure before publishing them broadly.

## Configuration

The main controls are at the top of `Library.js` in `EIDETIC_CONFIG`.

`SEED_CHARACTERS` and `ALWAYS_FOCUS` can force known recurring characters. In most scenarios Story Cards plus automatic discovery are enough.

`NAME_PROMOTION_HITS`, `NAME_PROMOTION_SCORE`, `NAME_STRONG_PROMOTION_SCORE`, `NAME_CANDIDATE_TTL`, `MAX_NAME_CANDIDATES`, `MAX_TRACKED_CHARACTERS`, `MAX_ACTIVE_CHARACTERS`, and `PRESENCE_HOLD_TURNS` control character discovery, anti-junk promotion, candidate cleanup, and scene tracking.

`HOT_EVENT_LIMIT`, `COLD_EVENT_LIMIT`, `EVENT_CHUNK_CHARS`, `COLD_EVENT_CHARS`, and `MAX_ANCHORS` control archive depth.

`MEMORIES_PER_CHARACTER`, `ANCHORS_PER_CHARACTER`, `NARRATIVE_MEMORIES`, `GLOBAL_MEMORIES`, `CANDIDATE_HEADROOM`, and `MIN_RECALL_SCORE` control retrieval.

`RECALL_BLOCK_MAX_CHARS`, `RECALL_CONTEXT_FRACTION`, and `RECALL_MIN_CHARS` control how much active context EIDETIC may consume.

`STRICT_KNOWLEDGE` should normally remain `true`.

## Commands

```text
/eidetic
/memory
/memstats
/memdetect
/roster
/focus Alice
/focus Alice, Bob
/focus auto
/remember Alice | Alice keeps the silver key Jordan gave her.
/remember * | The old bridge was destroyed in the winter war.
/recall Alice | silver key
/memdebug on
/memdebug off
/memclear CONFIRM
```

`/remember` creates a manual durable anchor. Use it for creator-confirmed facts that absolutely must survive ordinary ranking.

`/memstats` shows the archive counts, approximate serialized state size, recall revision, and retry-purge count.

`/memdetect` shows how many characters are tracked, how many unconfirmed candidates are still being watched, how many junk observations have been rejected, how many stale candidates were pruned, and the strongest current candidates.

## What the model sees

A typical block resembles:

```text
[[EIDETIC_RECALL rev=42 turn=318 sig=...]]
AUTHORITATIVE MEMORY REVISION 42. Ignore every older EIDETIC_RECALL block with a lower revision...
PRIVATE CONTINUITY belongs only to that character...
ALICE MERCER — PRIVATE CONTINUITY:
• anchor T14 [EVENT]: Alice promised to keep the vault key safe.
• remembers T201 [BELIEVED/SUSPECTED]: Alice suspected Marek had followed them, but had no proof.
• remembers T255 [SAID/CLAIMED]: Marek told Alice he had never entered the vault.
[[/EIDETIC_RECALL]]
```

Evidence labels are intentional. The model is told not to flatten claims, beliefs, and uncertainty into established canon.

## Knowledge-boundary reality check

EIDETIC can stop **its own retrieval layer** from deliberately handing Bob an Alice-only memory. It cannot provide mathematical secrecy if some other part of the model context already contains the information—for example recent History, Plot Essentials, a Story Card, native Memory Bank retrieval, or another script.

The script therefore aims for correct character-scoped retrieval, not impossible information-security guarantees inside a single language-model prompt.

## Why not generate thousands of Story Cards?

Story Cards are useful for durable world facts, but an episodic archive with thousands of cards creates trigger collisions, context competition, and maintenance noise.

EIDETIC keeps the bulk archive in persistent script state and reads existing Story Cards only as identity/continuity seeds. It does not require auto-generating a card for every event.

## Research principles behind the hardening pass

The hardened architecture deliberately applies several lessons from modern long-term-memory systems:

- **Retrieval is not enough:** memory systems need knowledge-update handling, temporal reasoning, and the ability to abstain when evidence is missing.
- **Salience is not relevance:** an important event should not be retrieved for an unrelated question solely because it was dramatic.
- **Raw history and structured metadata work better together:** EIDETIC keeps the original episodic text while adding witnesses, subjects, time, epistemic type, and deterministic semantic tags.
- **Old facts should remain historical rather than silently vanish:** chronological records are preserved; the prompt tells the model to prefer newer explicit evidence when state changes.
- **Memory must be tested transactionally:** retry, undo, identity collision, stale-cache, privacy, and performance failures are part of the memory problem, not edge decorations.

See `RESEARCH_HARDENING.md` for the specific research findings and how each one maps to EIDETIC.

## Testing

Run:

```bash
node test_harness.js
```

The hardened harness covers Story Card onboarding, alias consolidation, player exclusion, subject/witness separation, private knowledge isolation, epistemic typing, recall abstention, pre-generation retry cleanup, same-turn branch replacement, undo, state migration, ambiguous first names, append-only context, stale recall revisions, adaptive context budgets, earliest/latest temporal recall, leak scrubbing, JSON safety, junk-name resistance, and a 13,500-record stress archive.

Run `node detection_harness.js` for the dedicated anti-junk suite. It deliberately feeds every one of the 3,600 explicit non-person phrases through person-like grammar, tests cross-genre false positives, common-word names, title normalization, Story Card type separation, player exclusion, candidate TTL/caps, and four-hook integration.

The local benchmark is useful for catching deterministic bugs. AI Dungeon's live sandbox remains authoritative because its runtime and 16 MB memory cap are not identical to a local Node process.

## 2,000-turn endurance validation

The final build was also driven through seven different **2,000-turn** simulated Adventures: superhero university, high fantasy, noir mystery, family drama, starship science fiction, supernatural horror, and a deliberately repetitive spam/Continue case.

That produced **14,000 action turns** and **42,036 Input/Context/Output hook executions**. Every varied scenario passed late secret recall, current-state updates, private-knowledge isolation, and belief/rumour typing. The repetition case preserved its early meaningful secret while aggressively compressing thousands of near-identical filler turns.

The slowest observed local hook in the final matrix was **474.67 ms**, and the largest serialized long-run state was **2,403,926 characters**. The separate regression harness still stress-tests a synthetic **13,500-record** archive. See `ENDURANCE_RESULTS.md` and `TEST_RESULTS.md`.

## Practical limit

No script can make a finite-context model literally read an unlimited story every turn. The best practical approach is to make storage deep and retrieval selective.

EIDETIC therefore aims to make the context limit **feel much less restrictive**: the old scene can be thousands of actions behind the current one, but if the archive still contains it and the current scene provides a useful retrieval cue, the relevant memory can return to active context.
