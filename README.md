# 🧠 EIDETIC — Total Recall Engine

> **Persistent, character-scoped long-term memory for AI Dungeon.**  
> Characters remember what happened, who actually knew it, what was only suspected, and what changed later—even after the original scene has fallen far outside normal context.

---

## ✨ Memory That Actually Matters

EIDETIC is built around a simple idea: **a recurring character should not reset just because the story moved on.**

Instead of trying to force an entire adventure into active context, EIDETIC keeps a deep persistent memory archive and retrieves only the memories that matter to the current scene.

Old promises can return.  
Private conversations can matter hundreds of turns later.  
A character can remember where they used to live without confusing it with where they live now.  
A suspicion can remain a suspicion instead of slowly becoming “fact.”

The result is continuity that feels **personal, selective, historical, and character-specific**.

---

## ⚙️ Automatic Config Card

EIDETIC automatically creates **🧠 EIDETIC — Config & Guide** when an Adventure starts. No setup card, character list, or command is required for normal use.

The Story Card **Entry** is the actual editable control panel. It contains only the main `setting = value` options so players can change EIDETIC without digging through a long guide. The card uses a deliberately obscure trigger so those controls do not normally enter story context.

The Story Card **Notes** contain the plain-English explanation of every option, recommended values, automatic features, and optional commands. This keeps the controls easy to edit while keeping the documentation separate.

Edit only the value after `=` in Entry. The card controls the master switch, memory depth, recall size, strict knowledge boundaries, automatic detection, **detection mode**, the Current State Ledger, world memory, story-time tracking, narrative recall, abstention, active-character count, output spacing, and debug mode. `detectionMode = strict` is the recommended default: ambiguous names and objects remain provisional/episodic until direct evidence proves what they are. Existing older EIDETIC config cards are migrated into this layout while preserving their selected values. If the card cannot be created at all, the memory engine keeps running on safe defaults instead of breaking the Adventure.


## 🔄 Drop-In Existing Adventure Activation

EIDETIC does **not** require a brand-new Adventure. If the script is added or updated on a Scenario that already has an Adventure in progress, the next player action or Continue triggers initialization automatically.

On that first hook EIDETIC:

- creates or repairs its Config & Guide card
- scans existing Character Story Cards
- imports the most recent history AI Dungeon exposes to scripts
- caps the import to keep first-run work safe
- starts normal memory tracking immediately

No setup command, restart, or manual character list is required. History older than the API exposes cannot be reconstructed automatically, but everything available during installation is backfilled and all future turns are tracked normally.

## 🧩 Deep Episodic Memory

EIDETIC records story events as long-term episodic memories rather than relying entirely on recent context.

### 🔥 Hot Memory
Recent events are retained in richer detail for immediate continuity.

### ❄️ Cold Memory
Older events are compacted into a much larger long-term archive instead of simply disappearing.

### 📌 Durable Anchors
High-value facts such as promises, secrets, deaths, relationships, identities, important possessions, major injuries, discoveries, and other lasting events can survive independently of ordinary episodic memory.

### 🗃️ Massive Recall Depth
The default architecture supports:

- **4,500 detailed hot memories**
- **9,000 compact cold memories**
- **1,200 durable anchors**

The archive stays outside the active prompt until something becomes relevant again.

---

## 👁️ Character-Scoped Knowledge

EIDETIC tracks **who actually had access to information**, not merely whose name appeared in a sentence.

If you tell Alice:

> “Bob betrayed me.”

Alice can remember the conversation.

Bob does **not** automatically gain that memory just because he was the subject.

This lets the story preserve:

- private conversations
- secrets
- withheld information
- misunderstandings
- hidden motives
- one-sided discoveries
- different versions of the same event

Characters can finally have **different knowledge of the same world**.

---

## 🧠 Epistemic Memory

Not every sentence is a fact.

EIDETIC preserves the difference between:

- **EVENT** — something presented as happening
- **SAID / CLAIMED** — something somebody stated
- **BELIEVED / SUSPECTED** — an assumption, belief, theory, or suspicion
- **UNCERTAIN** — rumour, possibility, or incomplete information
- **QUESTION / UNRESOLVED** — something still unanswered

So:

> *Alice suspects Daniel killed Mark.*

does not silently become:

> *Daniel killed Mark.*

Memory retains **how the character knew something**, not just the words around it.

---

## 🚫 Recall Without Hallucinated History

When a character is explicitly asked to remember something and the archive contains no supporting memory, EIDETIC can tell the model that **no verified matching memory was found**.

The correct result can therefore be:

- they do not remember
- they were never told
- they were not present
- the event never happened
- the answer is uncertain

Long-term memory becomes evidence-based rather than an invitation for the model to invent a convenient past.

---

## ⏳ Time-Aware Recall

EIDETIC understands that memory has chronology.

Queries involving ideas such as:

- first
- earliest
- originally
- previous
- last
- latest
- newest
- current
- now
- still

can change retrieval order.

A character can therefore distinguish:

**what used to be true**  
from  
**what is true now**.

That matters for changing homes, relationships, jobs, injuries, allegiances, possessions, secrets, beliefs, identities, and long-running character arcs.

---


## 🌍 Scenario-Wide World Memory

EIDETIC now keeps structured continuity for more than NPC memories. It can maintain persistent identities and histories for:

- characters
- locations
- items
- vehicles
- organizations / factions
- named events
- explicit dates and story-time markers

The structured world layer is deliberately separate from the ordinary episodic archive. **Ordinary prose stays episodic unless it proves a durable fact or state change.**

That distinction prevents a sentence such as:

> *The air smells of ozone and burnt metal.*

from becoming a fake "destruction event", while allowing:

> *The Legacy Exhibit is destroyed by an explosion.*

to become a verified location-condition change and timeline event.

### 🕰️ Current State + Historical Timeline

For persistent entities EIDETIC separates:

**what happened** → episodic memory  
**what is true now** → current-state fact  
**when a durable change happened** → world timeline

A death can therefore remain historical while later story time advances:

> *Elias dies from his wounds.*  
> *One year later...*

EIDETIC can retain that Elias is dead, retain the original death event, advance the story clock, and later surface the death as approximately **one year ago** instead of treating every old event as equally recent.

The same model supports moves, injuries, ownership changes, destruction/repair, organization changes and other explicit state transitions.

### 🔐 Provenance Still Matters

World memory does not override the knowledge firewall. Private discoveries remain private to the characters who actually witnessed or learned them. Claims, rumours and "presumed" states retain their uncertainty instead of automatically becoming objective truth.

For example, a museum plaque saying a missing character is **"presumed deceased"** is stored as sourced/uncertain information; it does not automatically overwrite that character's objective current status.

---

## 🧭 Knowledge-Scoped Current State

Long stories need more than old-event recall. EIDETIC maintains a compact **Current State Ledger** for the newest verified state a character knows about.

It can track:

- location
- role / job
- status
- relationship state
- abilities
- possessions
- identity / codename
- affiliation

The ledger is **knowledge-scoped**. If Alice witnesses Hannah move to Willow Lane but Bob leaves before the update, Alice can know the new address while Bob can still honestly remember the older one.

Rumours, questions, suspicions, and uncertain statements do not overwrite verified current state. Older states remain in episodic history instead of being erased.

---

## 🎯 Relevance-Driven Retrieval

Important memories are not automatically relevant memories.

EIDETIC ranks recall using a combination of:

- meaningful topic overlap
- involved characters
- memory ownership
- semantic tags
- importance
- chronology
- explicit recall language
- manual anchors
- current scene presence
- active character focus

A dramatic death from 800 turns ago should not appear every time someone asks about a key.

A quiet promise from 1,500 turns ago **should** return when that promise matters again.

---

## 🏷️ Semantic Memory Tags

EIDETIC builds a lightweight local index around useful concepts such as:

- `@location`
- `@time`
- `@relationship`
- `@secret`
- `@promise`
- `@status`
- `@ability`
- `@item`
- `@role`

This strengthens retrieval without requiring an external embedding service or another AI model.

---

## 🛡️ Detection Fortress

EIDETIC uses a staged, **precision-first entity detector** before anything is allowed to become persistent structured memory. The recommended `detectionMode = strict` deliberately prefers a missed structured entity over a false permanent memory.

Arbitrary capitalization is not enough. Generic noun phrases are not enough. Durable current-state facts require direct grammatical evidence, typed Story Cards, or repeated independent action-level evidence.

The detector separates candidates into:

- **CHARACTER**
- **LOCATION**
- **ITEM**
- **VEHICLE**
- **ORGANIZATION**
- **EVENT**
- **UNKNOWN**

Each candidate accumulates compact evidence instead of being promoted from capitalization alone. Strong evidence can promote immediately; ambiguous evidence remains provisional until repeated or confirmed. **Repeated evidence is counted by independent AI Dungeon actions, not by multiple internal parsing passes over the same action.** Candidate pools are bounded and stale candidates expire automatically.

### 👤 Character Evidence

Person evidence includes dialogue attribution, `Name:` speaker labels, reverse dialogue such as `"No," said Alice`, introductions, relationships, kinship, titles, direct address, interpersonal actions, human possessives, initials, accented names, surname particles, Character Story Cards and repeated independent human behaviour.

Names such as `María de la Cruz`, `J. R. Vale`, `Captain Reyes`, `Rose`, `Hunter` or even `Monday` can still become genuine characters when the story proves they are people.

### 🌍 World-Entity Evidence

The same detection layer can classify scenario entities from their use:

- entering/arriving/returning → location evidence
- picking up/giving/hiding/using → item evidence
- boarding/driving/piloting → vehicle evidence
- joining/working for/leading → organization evidence
- named battles/incidents/wars/ceremonies → event evidence

This lets `London`, `Vault Nine`, `Excalibur`, `Serenity`, `S.H.I.E.L.D.` and `Battle of Blackwood` become different kinds of persistent entities instead of fake NPCs.

Current-state promotion is stricter than entity recognition. EIDETIC requires a **direct relation** such as `Ava is injured`, `Alice carries the Silver Key`, `the key is hidden in Vault Nine`, or `Blackwood Manor is destroyed`. A nearby verb elsewhere in the sentence is not enough.

### 🚫 Anti-Junk Suppression

Headings, UI labels, narrative metadata, calendar vocabulary, departments, ordinary systems, generic world nouns and thousands of explicit non-person phrases receive negative evidence. Labels such as `CHAPTER:`, `SCENE:`, `SYSTEM:`, `OUTPUT SETTINGS` or `MEMORY SUMMARY` are prevented from becoming characters just because they are formatted like speaker names.

Generic entities can remain provisional. A single mention of `the room`, `the bag`, `the mug`, or `the key` need not permanently enter the world database. Promotion requires strong typed evidence or independent evidence from later actions. Internal rescans of one output cannot manufacture "repeat" evidence.

Legacy parser artefacts are also scrubbed during schema migration. Old false entities such as field labels (`Name`, `Age`, `Role`), determiners (`The`), negators (`Not`), surname fragments, fake `/HISTORY` current-state records and invalid structured events are removed when the updated engine first runs.

`/memdetect` reports tracked characters, character candidates, world entities, world candidates, rejected observations and stale-candidate pruning so the detector can be inspected while an Adventure runs.

---

## 🎭 Identity & Alias Intelligence

A character should have one memory, not five slightly different copies of themselves.

EIDETIC can consolidate:

- first name ↔ full name
- title ↔ surname
- known aliases
- Story Card aliases
- codenames

while avoiding unsafe merges when names are genuinely ambiguous.

`Captain Reyes` and `Reyes` can share a brain.

`John Smith` and `John Doe` remain separate people.

Bare `John` is not guessed when that identity is ambiguous.

---

## 🎬 Scene Presence Tracking

Characters do not need their names repeated in every paragraph to remain present.

EIDETIC maintains short-term scene presence so a character can witness continuing events naturally.

It also watches for exits, travel, scene changes, departures, teleportation, and similar transitions so someone does not keep “hearing” events after leaving.

Knowledge follows the scene—not the entire cast list.

---

## ✍️ Clean Continuation Spacing

EIDETIC can repair a missing separator between the player's text and an AI continuation, preventing joins such as:

`Earl Grey blends.As the British couple...`

from appearing as one broken sentence. The default `auto` mode fixes the seam only when needed; `preserve` leaves model spacing untouched.

---

## 🔁 Retry, Undo & Branch Protection

Discarded generations should not become memories.

EIDETIC treats story continuity transactionally:

- rejected AI retries are purged
- replacement outputs replace abandoned realities
- changed same-turn actions invalidate the old branch
- undo removes memories from turns that no longer exist
- stale future events do not remain in character memory

If the timeline changes, the memory archive changes with it.

---

## 🧹 Repetition Compression

Long adventures often contain routine filler:

- waiting
- travelling
- sleeping
- repeated status checks
- quiet transitions
- nearly identical Continue outputs

EIDETIC compresses repetitive low-information material so thousands of mundane turns do not push meaningful memories out of storage.

The goal is not to remember **more noise**.

The goal is to preserve **more story**.

---

## 📚 Story Card Awareness

Story Cards are used as **trusted identity/type seeds**, not as automatic private memories.

EIDETIC can use typed Story Cards to establish that something is a:

- character
- location
- item
- vehicle
- organization / faction
- event

Character cards can also reinforce canonical names, aliases and codenames.

EIDETIC deliberately does **not** copy an entire Story Card Entry into an NPC's `ESTABLISHED` recall packet. AI Dungeon already handles triggered Story Cards natively; duplicating their prose inside EIDETIC could leak future/hidden lore or make one NPC appear to know another card's private information.

The episodic archive therefore stores **played continuity**, while Story Cards remain world-building/context sources.

---

## 🧭 Adaptive Context Intelligence

EIDETIC does not dump its entire archive into every generation.

Its recall packet scales against the available model-context budget and retrieves only a compact selection of useful memories.

This protects space for:

- current story history
- Plot Essentials
- Story Cards
- Author's Note
- instructions
- other active context

The archive can be huge.

The prompt stays selective.

---

## ⚡ Recall Revision Control

Memory packets carry revision information.

When the active recall changes, the newest revision is marked authoritative so older cache-visible recall blocks can be ignored.

This helps prevent stale memory packets from competing with newer ones during long-running or cache-efficient play.

---

## 🔒 Player Identity Protection

The player character is not supposed to become a second autonomous NPC copy of themselves.

EIDETIC uses available character identity information to protect the protagonist from accidental NPC promotion while still allowing the system to track the people around them.

---

## 🛟 Failure-Safe Hook Wrappers

Input, Context, and Output are wrapped defensively. If EIDETIC encounters an unexpected runtime error, the wrapper preserves the original story text instead of allowing the memory system to break the turn.

---

## 🧬 Persistent Character Continuity

EIDETIC is designed to make long stories accumulate history instead of constantly rebuilding it.

A recurring character can carry forward:

- promises
- betrayals
- favours
- gifts
- fears
- discoveries
- secrets
- suspicions
- grudges
- affection
- loyalties
- lies
- injuries
- relationship changes
- past homes
- former jobs
- changing beliefs
- important possessions
- unresolved questions
- events they personally witnessed

The character does not need every one of those memories active at once.

They need the **right memory at the right moment**.

---

## 🌌 Built for Long Adventures

EIDETIC does not pretend a finite-context language model has infinite context.

It does something more practical:

**store deeply, retrieve selectively, preserve perspective, and bring the past back when it becomes relevant.**

That can make a conversation from hundreds or thousands of actions ago affect what an NPC says, believes, notices, fears, trusts, hides, or remembers now.

---

# 🧠 EIDETIC

### **The story moves forward. The characters keep the past.**

## Live Continuity Sync (Schema 11)

EIDETIC now keeps a durable played-continuity layer in addition to its hot/cold recall archive. Significant played developments are classified as `FACT`, `CLAIM`, `BELIEF`, `INFERENCE`, `UNCONFIRMED`, or `NEGATED` so mystery interpretations are not silently promoted into canon.

The engine manages one additional hidden-key Story Card, **🧠 EIDETIC — Current Played Continuity**, whose Notes contain the latest durable developments. Existing recurring Character cards receive a bounded `[[EIDETIC LIVE CONTINUITY]]` Notes block when relevant. Hand-written Notes outside that block and all Story Card Entry text are preserved.

This fixes the failure mode where EIDETIC remembered old scenario setup but did not visibly advance Story Cards after played events. Newer played continuity is explicitly marked as overriding stale setup/history, while uncertain conclusions remain labelled uncertain.

Use `/live` to verify the system in an adventure. It reports durable live facts, Character-card Notes writes, continuity-card writes, and a preview of the latest captured facts.




## Adaptive detection and blank new Adventures

EIDETIC now defaults to **balanced** detection rather than maximum-strict detection.

This does **not** turn the junk filter off. The Detection Fortress still rejects strong
non-person evidence such as rooms, objects, systems, headings, UI terms, locations and
other known false positives. The difference is that clear human evidence is allowed to
work immediately:

- `Rose says, "Hello."` can establish Rose immediately.
- `Marek walks into the room.` can establish Marek immediately.
- a Character Story Card can seed its character before the player types anything.
- ordinary output-side introductions and human actions are detected too.

`strict` mode remains available in the Config & Guide card for unusually noisy scenarios,
but it is no longer the default.

A completely blank new Adventure naturally has no event to remember yet. EIDETIC now
writes a tiny `EIDETIC ACTIVE` initialization block to dynamic front memory on that blank
state, keeps history bootstrap open, scans Story Cards automatically, and begins normal
memory storage on the first real action. No setup command or manual character list is required.



## Schema 13 — Cross-scenario isolation and relevance

Schema 13 fixes a class of failures that can appear when a long Adventure contains old
characters, Story Cards and historical arcs alongside a new active cast.

### Identity isolation

A bare first name is no longer automatically attached to an old full-name character
simply because that old character is the only archived match.

If an old archive contains **Aaron Vale** and a new scene introduces **Aaron**, EIDETIC
keeps the new identity provisional unless the old Aaron is actually grounded in the
current scene. If the story later establishes **Aaron Pike**, the provisional identity is
re-keyed to Aaron Pike and its already-recorded memories move with it.

If two full characters genuinely share a first name, the first name becomes ambiguous
globally but can still resolve to one of them when exactly one is actually present in
the current scene.

### Witness isolation

Explicit travel, time jumps, room/location transitions, meals, going to bed, boarding,
arrival and similar scene boundaries now clear stale scene presence before memory
ownership is assigned. A character left in the previous room cannot keep "remembering"
later private scenes just because their name was recently active.

### Direct-question relevance

Short questions such as **"What is the beacon?"** are now retrieved from their own text.
EIDETIC no longer prepends arbitrary prose from the previous response and accidentally
matches words from that prose.

Direct questions require genuine topical overlap. High-importance but unrelated memories
do not bypass relevance merely because they contain a death, relationship or other
dramatic event.

### Bootstrap provenance

Existing-history import is marked as **bootstrap** provenance. It remains searchable, but
live play receives a small relevance preference and only the newest bootstrap slice can
backfill the Current Played Continuity card. This prevents a large historical setup from
masquerading as current play.

### Durable-memory hygiene

Ordinary uses of words such as **learned** no longer automatically make prose a major
"discovery." `learned that ...` can represent a discovery; `learned to share a room`,
`learned to swim`, or other ordinary phrasing does not automatically become one.

These changes are engine-wide and do not depend on any specific Scenario, universe or cast.

