
const EIDETIC_CONFIG = {
  ENABLED: true,
  AUTO_CONFIG_CARD: true,
  CONFIG_CARD_KEY: "%__EIDETIC_CFG_A9F3C1__%",
  OUTPUT_SPACING: "preserve",
  BOOTSTRAP_EXISTING_HISTORY: true,
  BOOTSTRAP_HISTORY_ACTIONS: 240,
  BOOTSTRAP_HISTORY_CHARS: 120000,
  BOOTSTRAP_ACTION_CHARS: 6000,

  SEED_CHARACTERS: [],
  ALWAYS_FOCUS: [],

  AUTO_DISCOVER_CHARACTERS: true,
  DETECTION_MODE: "balanced",
  NAME_PROMOTION_HITS: 2,
  NAME_PROMOTION_SCORE: 7,
  NAME_STRONG_PROMOTION_SCORE: 7,
  NAME_CANDIDATE_TTL: 80,
  MAX_NAME_CANDIDATES: 240,
  MAX_TRACKED_CHARACTERS: 120,
  MAX_ACTIVE_CHARACTERS: 3,
  MAX_ALIASES_PER_CHARACTER: 24,
  PRESENCE_HOLD_TURNS: 3,

  HOT_EVENT_LIMIT: 4500,
  COLD_EVENT_LIMIT: 9000,
  EVENT_CHUNK_CHARS: 420,
  COLD_EVENT_CHARS: 190,
  MAX_ANCHORS: 1200,

  MEMORIES_PER_CHARACTER: 3,
  ANCHORS_PER_CHARACTER: 2,
  NARRATIVE_MEMORIES: 2,
  GLOBAL_MEMORIES: 1,
  CANDIDATE_HEADROOM: 4,
  MIN_RECALL_SCORE: 2.0,
  RECENT_TURN_SUPPRESSION: 3,
  ROUTINE_HOT_SCAN_LIMIT: 700,
  DEEP_SCAN_INTERVAL: 12,

  REPEAT_SUPPRESSION_WINDOW: 60,
  REPEAT_SCAN_LIMIT: 96,

  RECALL_BLOCK_MAX_CHARS: 1700,
  RECALL_CONTEXT_FRACTION: 0.055,
  RECALL_MIN_CHARS: 450,

  STRICT_KNOWLEDGE: true,
  ENABLE_NARRATIVE_RECALL: true,
  ABSTAIN_ON_EXPLICIT_RECALL_MISS: true,

  USE_FRONT_MEMORY: false, // Schema 19: never mutate Plot Essentials/state.memory; recall is appended in onModelContext
  APPEND_CONTEXT_FALLBACK: true, // retained for compatibility; direct Context injection is now the primary path
  ADDON_SAFE_MODE: true,
  BOOTSTRAP_BATCH_ACTIONS: 24,
  REFRESH_RECALL_AFTER_OUTPUT: false,

  INCLUDE_RELEVANT_CARD_SEEDS: false,
  CARD_SEED_CHARS: 260,
  MAX_CARD_SEEDS: 2,

  ENABLE_STATE_LEDGER: true,
  STATE_LEDGER_LIMIT: 1800,
  STATE_FACTS_PER_CHARACTER: 2,
  STATE_FACT_CHARS: 280,

  ENABLE_WORLD_MEMORY: true,
  WORLD_ENTITY_LIMIT: 700,
  WORLD_ENTITY_PROMOTION_HITS: 2,
  WORLD_ENTITY_PROMOTION_SCORE: 8,
  WORLD_ENTITY_STRONG_SCORE: 8,
  WORLD_CANDIDATE_TTL: 100,
  MAX_WORLD_CANDIDATES: 360,
  WORLD_FACT_LIMIT: 3200,
  WORLD_TIMELINE_LIMIT: 3200,
  WORLD_FACTS_PER_RECALL: 3,
  WORLD_EVENTS_PER_RECALL: 3,
  WORLD_FACT_CHARS: 300,
  TRACK_STORY_TIME: true,

  DEBUG: false,

  // Story Card integration is deliberately clutter-light. EIDETIC never needs a global
  // "Current Played Continuity" card. Important character insights are mirrored to Notes
  // when the client preserves that metadata; structured internal memory remains authoritative.
  SYNC_STORY_CARD_NOTES: true,
  SYNC_STORY_CARD_ENTRIES: false,
  AUTO_CURRENT_CONTINUITY_CARD: false,
  CURRENT_CONTINUITY_KEY: "%__EIDETIC_CURRENT_7D4B__%",
  LIVE_FACT_LIMIT: 180,
  LIVE_FACT_CHARS: 220,
  CARD_NOTE_FACTS: 2,
  CURRENT_CARD_FACTS: 8,
  LIVE_RECALL_FACTS: 4,

  // Scenario-authored moving-state Story Cards may be read internally even when they have
  // no trigger keys. They are never rewritten or duplicated by EIDETIC.
  CURRENT_CARD_SEED_LIMIT: 2,
  CURRENT_CARD_SEED_MODE: "explicit", // only cards deliberately marked for EIDETIC may become global baselines
  CURRENT_CARD_SEED_MARKER: "%__EIDETIC_CURRENT_SEED_20__%",
  CURRENT_CARD_SEED_CHARS: 300,
  CURRENT_CARD_SEED_SCAN_INTERVAL: 6,
  STORY_CARD_SCAN_INTERVAL: 6,
  LARGE_STORY_CARD_THRESHOLD: 240,
  LARGE_STORY_CARD_MAINTENANCE_PHASES: 6,

  // Character Insight Ledger: major revelations + important statements.
  CHARACTER_INSIGHT_LIMIT: 900,
  CHARACTER_INSIGHT_RECALL: 2,
  CHARACTER_INSIGHT_CHARS: 280,
  CHARACTER_NOTE_INSIGHTS: 6,
  CHARACTER_NOTE_BLOCK_CHARS: 2400,
  SYNC_CHARACTER_PROFILE_DELTAS: true,
  CHARACTER_PROFILE_INSIGHTS: 4,
  CHARACTER_PROFILE_BLOCK_CHARS: 900,

  // Phoenix/mobile-safe integration.
  COMMAND_MODE: "soft", // soft = no Input stop/error; command result is returned as a utility line
  LEGACY_STATE_MESSAGE: false, // Phoenix docs say state.message is not implemented
  STORY_CARD_RETRY_TURNS: 8,
  MAX_CHARACTER_CARD_ENTRY_CHARS: 3200,
  CONTEXT_HEADROOM_FRACTION: 0.18,
};

const EIDETIC = (() => {
  "use strict";

  const SCHEMA_REVISION = 23;
  const ROOT = "__EIDETIC";
  const OPEN = "[[EIDETIC_RECALL";
  const CLOSE = "[[/EIDETIC_RECALL]]";
  const PLAYER = "@player";
  const COMMAND_INPUT_MARKER = "[[EIDETIC_COMMAND_PENDING]]";
  const COMMAND_OUTPUT_PREFIX = "EIDETIC • ";
  let ROOT_CACHE_STATE = null;
  let ROOT_CACHE_VALUE = null;
  let TURN_OVERRIDE = null;
  let INGEST_ORIGIN = "live";
  let BOOTSTRAP_CAPTURE_LIVE = false;
  let ALIAS_CACHE_SIG = "";
  let ALIAS_CACHE = null;
  let WORLD_PATTERN_SIG = "";
  let WORLD_PATTERN_CACHE = null;
  let DETECTION_CHAR_REGEX_CACHE = null;
  let WORLD_EVIDENCE_REGEX_CACHE = null;
  const IDENTITY_ABSOLUTE = new Set(["i","me","my","mine","myself","you","your","yours","yourself","he","him","his","himself","she","her","hers","herself","it","its","itself","we","us","our","ours","ourselves","they","them","their","theirs","themselves","eidetic"]);
  let TOKEN_RE;
  try { TOKEN_RE = new RegExp("[\\p{L}\\p{N}][\\p{L}\\p{N}'\\-]{1,24}", "gu"); }
  catch (_) { TOKEN_RE = /[a-z0-9][a-z0-9'\-]{1,24}/g; }

  const STOPWORDS = new Set((
    "a an the and or but if then than so because as at by for from in into of on onto out over to up with without " +
    "i me my mine myself you your yours yourself he him his himself she her hers herself it its itself we us our ours " +
    "ourselves they them their theirs themselves this that these those who whom whose what which when where why how " +
    "is am are was were be been being do does did doing have has had having can could may might must shall should will " +
    "would not no nor yes just very really still already also even only own same other another some any each every both " +
    "few more most much many such all one two three first second third new old good bad big small little long short " +
    "there here now today tonight tomorrow yesterday morning afternoon evening night day week month year time moment " +
    "thing things something anything nothing everything someone anyone everyone nobody people person man woman boy girl " +
    "look looks looked looking see sees saw seen say says said saying tell tells told ask asks asked reply replies replied " +
    "go goes went gone going come comes came coming get gets got getting make makes made making take takes took taken " +
    "turn turns turned turning walk walks walked walking stand stands stood standing sit sits sat sitting feel feels felt " +
    "think thinks thought know knows knew known want wants wanted need needs needed seem seems seemed like likes liked " +
    "back away around down off again next right left front behind inside outside near across through before after while " +
    "well maybe perhaps probably suddenly quietly slowly quickly almost enough too also however though although yet " +
    "continued continue story action input output player ai dungeon about previously earlier prior beforehand afterward afterwards formerly remember remembers remembered recall recalls recalled"
  ).split(/\s+/));

  const NAME_BLOCKLIST = new Set((
    "The A An And Or But So If Then When Where Why How This That These Those There Here It He She They We You I " +
    "Monday Tuesday Wednesday Thursday Friday Saturday Sunday January February March April May June July August September " +
    "October November December Morning Afternoon Evening Night Today Tonight Tomorrow Yesterday Spring Summer Autumn Fall Winter " +
    "North South East West Chapter Scene Part Act Episode Book City Town Village House Home Room Kitchen Bedroom Bathroom Hall " +
    "School University College Hospital Office Street Road World Earth Heaven Hell God Gods King Queen Prince Princess Lord Lady " +
    "Doctor Dr Mister Mr Miss Ms Mrs Sir Maam Mom Mum Mother Dad Father Brother Sister Aunt Uncle Cousin Grandma Grandpa " +
    "AI NPC Story Memory Context Continue Do Say See Plot Author Note Nothing Something Anything Everything Someone Anyone Everyone Nobody"
  ).split(/\s+/).map(s => s.toLowerCase()));

  const DETECT_HARD_SINGLE = new Set([
    "a",
    "academy",
    "act",
    "action",
    "adventure",
    "afternoon",
    "agent",
    "ai",
    "aircraft",
    "airplane",
    "airport",
    "alley",
    "an",
    "and",
    "anyone",
    "anything",
    "apartment",
    "april",
    "arena",
    "arm",
    "armor",
    "armour",
    "arms",
    "arrow",
    "as",
    "ash",
    "assistant",
    "at",
    "attic",
    "august",
    "aunt",
    "author",
    "autumn",
    "avenue",
    "backpack",
    "bag",
    "bar",
    "barn",
    "barracks",
    "basement",
    "bathroom",
    "battery",
    "beach",
    "because",
    "bed",
    "bedroom",
    "beer",
    "belt",
    "bench",
    "bicycle",
    "bike",
    "black",
    "blood",
    "blue",
    "boat",
    "body",
    "bone",
    "book",
    "boot",
    "boots",
    "boss",
    "bottle",
    "boulevard",
    "bow",
    "bowl",
    "box",
    "bracelet",
    "brain",
    "bread",
    "breakfast",
    "bridge",
    "brother",
    "brown",
    "building",
    "bunker",
    "bus",
    "but",
    "by",
    "cabinet",
    "cable",
    "cafe",
    "cafeteria",
    "canyon",
    "cap",
    "capital",
    "captain",
    "car",
    "castle",
    "cathedral",
    "ceiling",
    "cellar",
    "century",
    "chair",
    "chamber",
    "chapter",
    "chest",
    "chief",
    "church",
    "city",
    "classroom",
    "clinic",
    "cloth",
    "cloud",
    "clouds",
    "coat",
    "coffee",
    "cold",
    "college",
    "commander",
    "computer",
    "console",
    "context",
    "continue",
    "continued",
    "continuing",
    "corridor",
    "couch",
    "country",
    "county",
    "cousin",
    "crate",
    "cup",
    "current",
    "cyan",
    "dad",
    "daughter",
    "dawn",
    "decade",
    "december",
    "desert",
    "desk",
    "detective",
    "device",
    "dinner",
    "director",
    "dirt",
    "district",
    "doctor",
    "door",
    "dorm",
    "dormitory",
    "dr",
    "dress",
    "drug",
    "duchess",
    "duke",
    "dungeon",
    "dusk",
    "dust",
    "ear",
    "ears",
    "earth",
    "east",
    "eastern",
    "eighth",
    "emperor",
    "empire",
    "empress",
    "engine",
    "epilogue",
    "episode",
    "essentials",
    "evening",
    "everybody",
    "everyone",
    "everything",
    "eye",
    "eyes",
    "face",
    "factory",
    "fall",
    "family",
    "father",
    "february",
    "feet",
    "fifth",
    "fire",
    "first",
    "flame",
    "flashback",
    "flashforward",
    "flat",
    "floor",
    "fog",
    "food",
    "foot",
    "for",
    "forest",
    "fork",
    "former",
    "fortress",
    "fourth",
    "foyer",
    "friday",
    "from",
    "fruit",
    "galaxy",
    "garage",
    "garden",
    "gate",
    "generator",
    "glass",
    "glove",
    "gloves",
    "gold",
    "grandfather",
    "grandma",
    "grandmother",
    "grandpa",
    "gray",
    "green",
    "grey",
    "gun",
    "hair",
    "hall",
    "hallway",
    "hamlet",
    "hand",
    "hands",
    "hangar",
    "harbor",
    "harbour",
    "hat",
    "head",
    "heart",
    "heat",
    "helicopter",
    "helmet",
    "here",
    "highway",
    "hill",
    "history",
    "home",
    "hospital",
    "hotel",
    "house",
    "how",
    "if",
    "in",
    "inn",
    "input",
    "instruction",
    "instructions",
    "interlude",
    "into",
    "iron",
    "island",
    "jacket",
    "january",
    "jeans",
    "jet",
    "july",
    "june",
    "jungle",
    "keep",
    "key",
    "king",
    "kingdom",
    "kitchen",
    "knife",
    "lab",
    "laboratory",
    "lady",
    "lake",
    "lane",
    "laptop",
    "latter",
    "leader",
    "leather",
    "leg",
    "legs",
    "letter",
    "lieutenant",
    "lightning",
    "lobby",
    "locker",
    "lord",
    "lounge",
    "lunch",
    "maam",
    "machine",
    "madam",
    "magenta",
    "manager",
    "march",
    "market",
    "marsh",
    "may",
    "meal",
    "meat",
    "medicine",
    "memory",
    "metal",
    "metro",
    "midnight",
    "mill",
    "mine",
    "miss",
    "mist",
    "mister",
    "model",
    "mom",
    "monastery",
    "monday",
    "monitor",
    "month",
    "moon",
    "moonlight",
    "morning",
    "motel",
    "mother",
    "motorcycle",
    "motorway",
    "mountain",
    "mouth",
    "mr",
    "mrs",
    "ms",
    "mud",
    "mum",
    "narrative",
    "nation",
    "necklace",
    "neighborhood",
    "neighbourhood",
    "next",
    "night",
    "ninth",
    "nobody",
    "noon",
    "north",
    "northeast",
    "northern",
    "northwest",
    "nose",
    "note",
    "notebook",
    "notes",
    "nothing",
    "november",
    "npc",
    "ocean",
    "october",
    "of",
    "office",
    "officer",
    "on",
    "onto",
    "or",
    "orange",
    "out",
    "output",
    "over",
    "page",
    "palace",
    "pants",
    "paper",
    "park",
    "part",
    "phone",
    "photo",
    "photograph",
    "pink",
    "pipe",
    "pistol",
    "plane",
    "planet",
    "plastic",
    "plate",
    "player",
    "plaza",
    "plot",
    "pond",
    "port",
    "potion",
    "president",
    "previous",
    "prince",
    "princess",
    "prof",
    "professor",
    "prologue",
    "prompt",
    "province",
    "pub",
    "purple",
    "queen",
    "rain",
    "reactor",
    "red",
    "republic",
    "restaurant",
    "rifle",
    "ring",
    "river",
    "road",
    "rock",
    "room",
    "rover",
    "saturday",
    "scenario",
    "scene",
    "school",
    "screen",
    "sea",
    "second",
    "september",
    "sergeant",
    "seventh",
    "shed",
    "shelf",
    "shield",
    "ship",
    "shirt",
    "shoe",
    "shoes",
    "shop",
    "shore",
    "shrine",
    "shuttle",
    "silver",
    "sir",
    "sister",
    "sixth",
    "skin",
    "skirt",
    "smoke",
    "snack",
    "snow",
    "so",
    "sofa",
    "someone",
    "something",
    "son",
    "south",
    "southeast",
    "southern",
    "southwest",
    "spoon",
    "spring",
    "square",
    "stadium",
    "star",
    "state",
    "station",
    "steel",
    "stone",
    "store",
    "storm",
    "story",
    "street",
    "subway",
    "suitcase",
    "summer",
    "sun",
    "sunday",
    "sunlight",
    "swamp",
    "sword",
    "system",
    "table",
    "tablet",
    "tea",
    "temperature",
    "temple",
    "tenth",
    "terminal",
    "than",
    "that",
    "the",
    "theater",
    "theatre",
    "then",
    "there",
    "these",
    "third",
    "this",
    "those",
    "thunder",
    "thursday",
    "to",
    "today",
    "token",
    "tokens",
    "tomorrow",
    "tonight",
    "tower",
    "town",
    "train",
    "tram",
    "trousers",
    "truck",
    "tuesday",
    "tunnel",
    "uncle",
    "universe",
    "university",
    "up",
    "user",
    "valley",
    "van",
    "vault",
    "vegetable",
    "vehicle",
    "village",
    "violet",
    "volume",
    "wall",
    "warehouse",
    "watch",
    "water",
    "weapon",
    "weather",
    "wednesday",
    "week",
    "weekday",
    "weekend",
    "west",
    "western",
    "what",
    "when",
    "where",
    "which",
    "white",
    "who",
    "whom",
    "whose",
    "why",
    "wind",
    "window",
    "wine",
    "winter",
    "wire",
    "with",
    "without",
    "wood",
    "woods",
    "workshop",
    "world",
    "year",
    "yellow",
    "yesterday",
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
    "twenty",
    "hundred",
    "thousand",
  ]);

  const DETECT_SOFT_SINGLE = new Set([
    "ability",
    "action",
    "amber",
    "angel",
    "april",
    "architecture",
    "ash",
    "august",
    "autumn",
    "bear",
    "bill",
    "bishop",
    "black",
    "blaze",
    "blue",
    "book",
    "brook",
    "brooke",
    "captain",
    "carter",
    "chance",
    "chapter",
    "charity",
    "chase",
    "chief",
    "china",
    "cliff",
    "cloud",
    "control",
    "cooper",
    "crystal",
    "dark",
    "darkness",
    "dawn",
    "dean",
    "destiny",
    "doctor",
    "dragon",
    "drew",
    "duke",
    "eagle",
    "east",
    "echo",
    "emergency",
    "energy",
    "engineering",
    "eve",
    "faith",
    "force",
    "ford",
    "forest",
    "foster",
    "fox",
    "frost",
    "ghost",
    "glass",
    "gold",
    "grace",
    "grant",
    "gray",
    "green",
    "grey",
    "harmony",
    "hawk",
    "history",
    "holly",
    "hope",
    "hunter",
    "india",
    "iron",
    "ivy",
    "jade",
    "jordan",
    "joy",
    "judge",
    "june",
    "justice",
    "king",
    "lane",
    "liberty",
    "light",
    "lion",
    "london",
    "lucky",
    "magic",
    "maintenance",
    "major",
    "mark",
    "mason",
    "may",
    "meadow",
    "medical",
    "melody",
    "memory",
    "mercy",
    "mist",
    "moon",
    "north",
    "note",
    "nova",
    "observation",
    "ocean",
    "page",
    "paris",
    "parker",
    "patience",
    "pearl",
    "phoenix",
    "physics",
    "plot",
    "power",
    "prince",
    "princess",
    "professor",
    "queen",
    "rain",
    "raven",
    "red",
    "reed",
    "research",
    "response",
    "ridge",
    "river",
    "robin",
    "rose",
    "ruby",
    "sage",
    "scarlet",
    "scene",
    "security",
    "service",
    "shadow",
    "shaw",
    "silver",
    "sky",
    "snow",
    "south",
    "space",
    "spell",
    "star",
    "steel",
    "stone",
    "storage",
    "storm",
    "story",
    "summer",
    "sunny",
    "taylor",
    "tiger",
    "time",
    "training",
    "valley",
    "violet",
    "walker",
    "west",
    "white",
    "will",
    "winter",
    "wolf",
    "woods",
    "york",
    "legacy",
    "afterglow",
    "second",
    "apex",
    "corrector",
    "sovereign",
    "foundation",
    "safety",
    "systems",
    "dynamics",
    "containment",
    "oversight",
    "commission",
    "institute",
    "operations",
    "strategy",
    "strategic",
    "protective",
    "civilian",
    "powered",
    "telemetry",
    "monitoring",
    "level",
    "project",
    "program",
    "initiative",
    "protocol",
  ]);

  const DETECT_NONPERSON_HEADS = new Set([
    "ability",
    "academy",
    "agency",
    "aircraft",
    "airplane",
    "airport",
    "alley",
    "alliance",
    "anomaly",
    "apartment",
    "arena",
    "armor",
    "armour",
    "army",
    "arrow",
    "attack",
    "attic",
    "avenue",
    "backpack",
    "bag",
    "bar",
    "basement",
    "bathroom",
    "battalion",
    "battery",
    "battle",
    "beach",
    "beam",
    "bed",
    "bedroom",
    "belt",
    "bench",
    "bicycle",
    "bike",
    "blast",
    "blessing",
    "board",
    "boat",
    "book",
    "boot",
    "boots",
    "bottle",
    "boulevard",
    "bow",
    "bowl",
    "box",
    "bracelet",
    "bridge",
    "building",
    "bunker",
    "bureau",
    "bus",
    "cabinet",
    "cable",
    "cafe",
    "cafeteria",
    "calendar",
    "canyon",
    "cap",
    "car",
    "castle",
    "cathedral",
    "ceiling",
    "cellar",
    "ceremony",
    "chair",
    "chamber",
    "chart",
    "chest",
    "church",
    "clan",
    "class",
    "classroom",
    "clinic",
    "cloud",
    "coat",
    "code",
    "college",
    "committee",
    "company",
    "computer",
    "conference",
    "console",
    "corporation",
    "corridor",
    "couch",
    "council",
    "course",
    "crate",
    "crisis",
    "cup",
    "curse",
    "department",
    "desert",
    "desk",
    "device",
    "diagram",
    "disaster",
    "district",
    "division",
    "document",
    "door",
    "dorm",
    "dormitory",
    "dossier",
    "dress",
    "drill",
    "emergency",
    "engine",
    "event",
    "exam",
    "exercise",
    "explosion",
    "faction",
    "factory",
    "festival",
    "field",
    "file",
    "fire",
    "flame",
    "flat",
    "fleet",
    "floor",
    "fog",
    "force",
    "forest",
    "fork",
    "fortress",
    "foyer",
    "funeral",
    "game",
    "garage",
    "garden",
    "gate",
    "generator",
    "glass",
    "glove",
    "gloves",
    "guild",
    "gun",
    "hall",
    "hallway",
    "hangar",
    "harbor",
    "harbour",
    "hat",
    "helicopter",
    "helmet",
    "highway",
    "hill",
    "home",
    "hospital",
    "hotel",
    "house",
    "incident",
    "inn",
    "island",
    "jacket",
    "jeans",
    "jet",
    "jungle",
    "key",
    "kitchen",
    "knife",
    "lab",
    "laboratory",
    "lake",
    "lane",
    "laptop",
    "lecture",
    "letter",
    "lobby",
    "locker",
    "lounge",
    "machine",
    "magic",
    "map",
    "market",
    "marsh",
    "match",
    "meeting",
    "message",
    "metro",
    "mill",
    "mine",
    "mission",
    "mist",
    "monitor",
    "moon",
    "motel",
    "motorcycle",
    "motorway",
    "mountain",
    "navy",
    "necklace",
    "neighborhood",
    "neighbourhood",
    "notebook",
    "ocean",
    "office",
    "operation",
    "order",
    "palace",
    "pants",
    "park",
    "passphrase",
    "password",
    "phone",
    "photo",
    "photograph",
    "pipe",
    "pistol",
    "plane",
    "planet",
    "plate",
    "platoon",
    "plaza",
    "pond",
    "port",
    "portal",
    "power",
    "program",
    "project",
    "protocol",
    "pub",
    "raid",
    "rain",
    "reactor",
    "record",
    "regiment",
    "report",
    "restaurant",
    "rifle",
    "rift",
    "ring",
    "river",
    "road",
    "room",
    "rover",
    "schedule",
    "school",
    "screen",
    "sea",
    "shelf",
    "shield",
    "ship",
    "shirt",
    "shoe",
    "shoes",
    "shop",
    "shore",
    "shrine",
    "shuttle",
    "siege",
    "signal",
    "skirt",
    "smoke",
    "snow",
    "society",
    "sofa",
    "spell",
    "spoon",
    "squad",
    "square",
    "stadium",
    "station",
    "store",
    "storm",
    "street",
    "subway",
    "suitcase",
    "swamp",
    "sword",
    "table",
    "tablet",
    "team",
    "temple",
    "terminal",
    "test",
    "theater",
    "theatre",
    "timetable",
    "tournament",
    "tower",
    "train",
    "tram",
    "transmission",
    "tribe",
    "trousers",
    "truck",
    "tunnel",
    "union",
    "unit",
    "university",
    "valley",
    "van",
    "vault",
    "vehicle",
    "wall",
    "war",
    "warehouse",
    "watch",
    "wave",
    "weapon",
    "wedding",
    "window",
    "wire",
    "woods",
    "workshop",
    "world",
    "response",
    "responses",
    "system",
    "systems",
    "safety",
    "operations",
    "service",
    "services",
    "research",
    "security",
    "engineering",
    "physics",
    "architecture",
    "dynamics",
    "command",
    "affairs",
    "institute",
    "foundation",
    "programs",
    "projects",
    "network",
    "networks",
    "departments",
    "directorate",
    "administration",
    "authority",
    "commission",
    "offices",
    "teams",
    "units",
    "forces",
    "initiative",
    "initiatives",
    "protocols",
    "agencies",
    "group",
    "groups",
    "annex",
    "deck",
    "core",
    "sedan",
    "level",
    "wing",
    "bay",
    "sector",
    "zone",
    "site",
    "facility",
    "complex",
    "center",
    "centre",
    "campus",
    "compound",
    "block",
    "platform",
    "module",
    "hub",
    "node",
    "grid",
    "array",
    "server",
    "database",
    "camp",
    "outpost",
  ]);

  const DETECT_PERSON_ROLES = new Set([
    "actor",
    "actress",
    "admiral",
    "agent",
    "ally",
    "ambassador",
    "analyst",
    "apprentice",
    "architect",
    "artist",
    "assistant",
    "astronomer",
    "attorney",
    "aunt",
    "author",
    "baron",
    "baroness",
    "barrister",
    "bartender",
    "biologist",
    "boss",
    "brother",
    "captain",
    "chancellor",
    "chef",
    "chemist",
    "chief",
    "classmate",
    "cleric",
    "clerk",
    "coach",
    "colleague",
    "colonel",
    "commander",
    "constable",
    "cook",
    "corporal",
    "councillor",
    "counselor",
    "count",
    "countess",
    "cousin",
    "coworker",
    "dad",
    "daughter",
    "dean",
    "deputy",
    "detective",
    "diplomat",
    "director",
    "doctor",
    "dr",
    "driver",
    "duchess",
    "duke",
    "emperor",
    "empress",
    "enemy",
    "engineer",
    "father",
    "founder",
    "friend",
    "general",
    "governor",
    "grandfather",
    "grandma",
    "grandmother",
    "grandpa",
    "guard",
    "hacker",
    "hunter",
    "husband",
    "inspector",
    "investigator",
    "journalist",
    "judge",
    "king",
    "knight",
    "lady",
    "lawyer",
    "leader",
    "lecturer",
    "lieutenant",
    "lord",
    "mage",
    "major",
    "manager",
    "marine",
    "marshal",
    "master",
    "mayor",
    "mechanic",
    "medic",
    "mentor",
    "mercenary",
    "mistress",
    "mom",
    "monk",
    "mother",
    "mum",
    "musician",
    "neighbor",
    "neighbour",
    "nun",
    "nurse",
    "officer",
    "operator",
    "owner",
    "partner",
    "pastor",
    "physicist",
    "pilot",
    "president",
    "priest",
    "prince",
    "princess",
    "principal",
    "prof",
    "professor",
    "programmer",
    "prosecutor",
    "psychologist",
    "queen",
    "ranger",
    "receptionist",
    "reporter",
    "representative",
    "researcher",
    "rival",
    "roommate",
    "sailor",
    "scientist",
    "scout",
    "secretary",
    "senator",
    "sergeant",
    "sheriff",
    "singer",
    "sister",
    "soldier",
    "solicitor",
    "son",
    "sorcerer",
    "spouse",
    "student",
    "supervisor",
    "surgeon",
    "teacher",
    "teammate",
    "technician",
    "therapist",
    "tutor",
    "uncle",
    "waiter",
    "waitress",
    "warrior",
    "wife",
    "witch",
    "wizard",
    "writer",
  ]);

  const DETECT_STRIPPABLE_TITLES = new Set([
    "mr",
    "mrs",
    "ms",
    "miss",
    "mister",
    "sir",
    "madam",
    "maam",
    "doctor",
    "dr",
    "professor",
    "prof",
    "captain",
    "commander",
    "lieutenant",
    "sergeant",
    "corporal",
    "officer",
    "detective",
    "inspector",
    "agent",
    "marshal",
    "sheriff",
    "deputy",
    "constable",
    "president",
    "director",
    "chief",
    "general",
    "admiral",
    "colonel",
    "major",
    "chancellor",
    "dean",
    "principal",
    "judge",
    "mayor",
    "governor",
    "senator",
    "king",
    "queen",
    "prince",
    "princess",
    "duke",
    "duchess",
    "emperor",
    "empress",
    "lord",
    "lady",
    "baron",
    "baroness",
    "count",
    "countess",
  ]);

  const DETECT_KINSHIP = new Set([
    "ally",
    "apprentice",
    "aunt",
    "bestfriend",
    "boyfriend",
    "brother",
    "child",
    "children",
    "classmate",
    "colleague",
    "cousin",
    "coworker",
    "dad",
    "daughter",
    "enemy",
    "father",
    "fiance",
    "fiancee",
    "friend",
    "girlfriend",
    "grandfather",
    "grandma",
    "grandmother",
    "grandpa",
    "guardian",
    "halfbrother",
    "halfsister",
    "husband",
    "mentor",
    "mom",
    "mother",
    "mum",
    "neighbor",
    "neighbour",
    "nephew",
    "niece",
    "parent",
    "partner",
    "rival",
    "roommate",
    "sibling",
    "sister",
    "son",
    "spouse",
    "stepbrother",
    "stepfather",
    "stepmother",
    "stepsister",
    "teammate",
    "uncle",
    "ward",
    "wife",
  ]);

  const DETECT_HUMAN_CONTEXT = new Set([
    "age",
    "anger",
    "arm",
    "arms",
    "aunt",
    "belief",
    "birthday",
    "breath",
    "breathing",
    "brother",
    "brow",
    "cheek",
    "cheeks",
    "clothes",
    "clothing",
    "colleague",
    "cousin",
    "dress",
    "expression",
    "eye",
    "eyes",
    "face",
    "family",
    "father",
    "fear",
    "feeling",
    "feelings",
    "forehead",
    "friend",
    "frown",
    "gaze",
    "grief",
    "hair",
    "hand",
    "hands",
    "hate",
    "heartbeat",
    "husband",
    "jacket",
    "jaw",
    "job",
    "joy",
    "laugh",
    "laughter",
    "lips",
    "love",
    "memories",
    "memory",
    "mother",
    "mouth",
    "name",
    "opinion",
    "partner",
    "promise",
    "pulse",
    "roommate",
    "sadness",
    "scar",
    "scars",
    "secret",
    "shirt",
    "shoulder",
    "shoulders",
    "sister",
    "skin",
    "smile",
    "stare",
    "suspicion",
    "tattoo",
    "tattoos",
    "tears",
    "thought",
    "thoughts",
    "trust",
    "uncle",
    "voice",
    "wife",
    "work",
  ]);

  const DETECT_NONPERSON_PHRASES = new Set([
    "old room",
    "old hall",
    "old hallway",
    "old corridor",
    "old foyer",
    "old lobby",
    "old lounge",
    "old kitchen",
    "old bedroom",
    "old bathroom",
    "old office",
    "old laboratory",
    "old lab",
    "old warehouse",
    "old hangar",
    "old garage",
    "old basement",
    "old attic",
    "old cellar",
    "old building",
    "old tower",
    "old castle",
    "old palace",
    "old fortress",
    "old temple",
    "old church",
    "old cathedral",
    "old shrine",
    "old school",
    "old university",
    "old college",
    "old academy",
    "old hospital",
    "old clinic",
    "old station",
    "old terminal",
    "old airport",
    "old harbour",
    "old harbor",
    "old port",
    "old street",
    "old road",
    "old avenue",
    "old boulevard",
    "old lane",
    "old alley",
    "old highway",
    "old motorway",
    "old bridge",
    "old tunnel",
    "old plaza",
    "old square",
    "old park",
    "old garden",
    "old forest",
    "old woods",
    "old jungle",
    "old desert",
    "old swamp",
    "old marsh",
    "new room",
    "new hall",
    "new hallway",
    "new corridor",
    "new foyer",
    "new lobby",
    "new lounge",
    "new kitchen",
    "new bedroom",
    "new bathroom",
    "new office",
    "new laboratory",
    "new lab",
    "new warehouse",
    "new hangar",
    "new garage",
    "new basement",
    "new attic",
    "new cellar",
    "new building",
    "new tower",
    "new castle",
    "new palace",
    "new fortress",
    "new temple",
    "new church",
    "new cathedral",
    "new shrine",
    "new school",
    "new university",
    "new college",
    "new academy",
    "new hospital",
    "new clinic",
    "new station",
    "new terminal",
    "new airport",
    "new harbour",
    "new harbor",
    "new port",
    "new street",
    "new road",
    "new avenue",
    "new boulevard",
    "new lane",
    "new alley",
    "new highway",
    "new motorway",
    "new bridge",
    "new tunnel",
    "new plaza",
    "new square",
    "new park",
    "new garden",
    "new forest",
    "new woods",
    "new jungle",
    "new desert",
    "new swamp",
    "new marsh",
    "main room",
    "main hall",
    "main hallway",
    "main corridor",
    "main foyer",
    "main lobby",
    "main lounge",
    "main kitchen",
    "main bedroom",
    "main bathroom",
    "main office",
    "main laboratory",
    "main lab",
    "main warehouse",
    "main hangar",
    "main garage",
    "main basement",
    "main attic",
    "main cellar",
    "main building",
    "main tower",
    "main castle",
    "main palace",
    "main fortress",
    "main temple",
    "main church",
    "main cathedral",
    "main shrine",
    "main school",
    "main university",
    "main college",
    "main academy",
    "main hospital",
    "main clinic",
    "main station",
    "main terminal",
    "main airport",
    "main harbour",
    "main harbor",
    "main port",
    "main street",
    "main road",
    "main avenue",
    "main boulevard",
    "main lane",
    "main alley",
    "main highway",
    "main motorway",
    "main bridge",
    "main tunnel",
    "main plaza",
    "main square",
    "main park",
    "main garden",
    "main forest",
    "main woods",
    "main jungle",
    "main desert",
    "main swamp",
    "main marsh",
    "central room",
    "central hall",
    "central hallway",
    "central corridor",
    "central foyer",
    "central lobby",
    "central lounge",
    "central kitchen",
    "central bedroom",
    "central bathroom",
    "central office",
    "central laboratory",
    "central lab",
    "central warehouse",
    "central hangar",
    "central garage",
    "central basement",
    "central attic",
    "central cellar",
    "central building",
    "central tower",
    "central castle",
    "central palace",
    "central fortress",
    "central temple",
    "central church",
    "central cathedral",
    "central shrine",
    "central school",
    "central university",
    "central college",
    "central academy",
    "central hospital",
    "central clinic",
    "central station",
    "central terminal",
    "central airport",
    "central harbour",
    "central harbor",
    "central port",
    "central street",
    "central road",
    "central avenue",
    "central boulevard",
    "central lane",
    "central alley",
    "central highway",
    "central motorway",
    "central bridge",
    "central tunnel",
    "central plaza",
    "central square",
    "central park",
    "central garden",
    "central forest",
    "central woods",
    "central jungle",
    "central desert",
    "central swamp",
    "central marsh",
    "upper room",
    "upper hall",
    "upper hallway",
    "upper corridor",
    "upper foyer",
    "upper lobby",
    "upper lounge",
    "upper kitchen",
    "upper bedroom",
    "upper bathroom",
    "upper office",
    "upper laboratory",
    "upper lab",
    "upper warehouse",
    "upper hangar",
    "upper garage",
    "upper basement",
    "upper attic",
    "upper cellar",
    "upper building",
    "upper tower",
    "upper castle",
    "upper palace",
    "upper fortress",
    "upper temple",
    "upper church",
    "upper cathedral",
    "upper shrine",
    "upper school",
    "upper university",
    "upper college",
    "upper academy",
    "upper hospital",
    "upper clinic",
    "upper station",
    "upper terminal",
    "upper airport",
    "upper harbour",
    "upper harbor",
    "upper port",
    "upper street",
    "upper road",
    "upper avenue",
    "upper boulevard",
    "upper lane",
    "upper alley",
    "upper highway",
    "upper motorway",
    "upper bridge",
    "upper tunnel",
    "upper plaza",
    "upper square",
    "upper park",
    "upper garden",
    "upper forest",
    "upper woods",
    "upper jungle",
    "upper desert",
    "upper swamp",
    "upper marsh",
    "lower room",
    "lower hall",
    "lower hallway",
    "lower corridor",
    "lower foyer",
    "lower lobby",
    "lower lounge",
    "lower kitchen",
    "lower bedroom",
    "lower bathroom",
    "lower office",
    "lower laboratory",
    "lower lab",
    "lower warehouse",
    "lower hangar",
    "lower garage",
    "lower basement",
    "lower attic",
    "lower cellar",
    "lower building",
    "lower tower",
    "lower castle",
    "lower palace",
    "lower fortress",
    "lower temple",
    "lower church",
    "lower cathedral",
    "lower shrine",
    "lower school",
    "lower university",
    "lower college",
    "lower academy",
    "lower hospital",
    "lower clinic",
    "lower station",
    "lower terminal",
    "lower airport",
    "lower harbour",
    "lower harbor",
    "lower port",
    "lower street",
    "lower road",
    "lower avenue",
    "lower boulevard",
    "lower lane",
    "lower alley",
    "lower highway",
    "lower motorway",
    "lower bridge",
    "lower tunnel",
    "lower plaza",
    "lower square",
    "lower park",
    "lower garden",
    "lower forest",
    "lower woods",
    "lower jungle",
    "lower desert",
    "lower swamp",
    "lower marsh",
    "north room",
    "north hall",
    "north hallway",
    "north corridor",
    "north foyer",
    "north lobby",
    "north lounge",
    "north kitchen",
    "north bedroom",
    "north bathroom",
    "north office",
    "north laboratory",
    "north lab",
    "north warehouse",
    "north hangar",
    "north garage",
    "north basement",
    "north attic",
    "north cellar",
    "north building",
    "north tower",
    "north castle",
    "north palace",
    "north fortress",
    "north temple",
    "north church",
    "north cathedral",
    "north shrine",
    "north school",
    "north university",
    "north college",
    "north academy",
    "north hospital",
    "north clinic",
    "north station",
    "north terminal",
    "north airport",
    "north harbour",
    "north harbor",
    "north port",
    "north street",
    "north road",
    "north avenue",
    "north boulevard",
    "north lane",
    "north alley",
    "north highway",
    "north motorway",
    "north bridge",
    "north tunnel",
    "north plaza",
    "north square",
    "north park",
    "north garden",
    "north forest",
    "north woods",
    "north jungle",
    "north desert",
    "north swamp",
    "north marsh",
    "south room",
    "south hall",
    "south hallway",
    "south corridor",
    "south foyer",
    "south lobby",
    "south lounge",
    "south kitchen",
    "south bedroom",
    "south bathroom",
    "south office",
    "south laboratory",
    "south lab",
    "south warehouse",
    "south hangar",
    "south garage",
    "south basement",
    "south attic",
    "south cellar",
    "south building",
    "south tower",
    "south castle",
    "south palace",
    "south fortress",
    "south temple",
    "south church",
    "south cathedral",
    "south shrine",
    "south school",
    "south university",
    "south college",
    "south academy",
    "south hospital",
    "south clinic",
    "south station",
    "south terminal",
    "south airport",
    "south harbour",
    "south harbor",
    "south port",
    "south street",
    "south road",
    "south avenue",
    "south boulevard",
    "south lane",
    "south alley",
    "south highway",
    "south motorway",
    "south bridge",
    "south tunnel",
    "south plaza",
    "south square",
    "south park",
    "south garden",
    "south forest",
    "south woods",
    "south jungle",
    "south desert",
    "south swamp",
    "south marsh",
    "east room",
    "east hall",
    "east hallway",
    "east corridor",
    "east foyer",
    "east lobby",
    "east lounge",
    "east kitchen",
    "east bedroom",
    "east bathroom",
    "east office",
    "east laboratory",
    "east lab",
    "east warehouse",
    "east hangar",
    "east garage",
    "east basement",
    "east attic",
    "east cellar",
    "east building",
    "east tower",
    "east castle",
    "east palace",
    "east fortress",
    "east temple",
    "east church",
    "east cathedral",
    "east shrine",
    "east school",
    "east university",
    "east college",
    "east academy",
    "east hospital",
    "east clinic",
    "east station",
    "east terminal",
    "east airport",
    "east harbour",
    "east harbor",
    "east port",
    "east street",
    "east road",
    "east avenue",
    "east boulevard",
    "east lane",
    "east alley",
    "east highway",
    "east motorway",
    "east bridge",
    "east tunnel",
    "east plaza",
    "east square",
    "east park",
    "east garden",
    "east forest",
    "east woods",
    "east jungle",
    "east desert",
    "east swamp",
    "east marsh",
    "west room",
    "west hall",
    "west hallway",
    "west corridor",
    "west foyer",
    "west lobby",
    "west lounge",
    "west kitchen",
    "west bedroom",
    "west bathroom",
    "west office",
    "west laboratory",
    "west lab",
    "west warehouse",
    "west hangar",
    "west garage",
    "west basement",
    "west attic",
    "west cellar",
    "west building",
    "west tower",
    "west castle",
    "west palace",
    "west fortress",
    "west temple",
    "west church",
    "west cathedral",
    "west shrine",
    "west school",
    "west university",
    "west college",
    "west academy",
    "west hospital",
    "west clinic",
    "west station",
    "west terminal",
    "west airport",
    "west harbour",
    "west harbor",
    "west port",
    "west street",
    "west road",
    "west avenue",
    "west boulevard",
    "west lane",
    "west alley",
    "west highway",
    "west motorway",
    "west bridge",
    "west tunnel",
    "west plaza",
    "west square",
    "west park",
    "west garden",
    "west forest",
    "west woods",
    "west jungle",
    "west desert",
    "west swamp",
    "west marsh",
    "northern room",
    "northern hall",
    "northern hallway",
    "northern corridor",
    "northern foyer",
    "northern lobby",
    "northern lounge",
    "northern kitchen",
    "northern bedroom",
    "northern bathroom",
    "northern office",
    "northern laboratory",
    "northern lab",
    "northern warehouse",
    "northern hangar",
    "northern garage",
    "northern basement",
    "northern attic",
    "northern cellar",
    "northern building",
    "northern tower",
    "northern castle",
    "northern palace",
    "northern fortress",
    "northern temple",
    "northern church",
    "northern cathedral",
    "northern shrine",
    "northern school",
    "northern university",
    "northern college",
    "northern academy",
    "northern hospital",
    "northern clinic",
    "northern station",
    "northern terminal",
    "northern airport",
    "northern harbour",
    "northern harbor",
    "northern port",
    "northern street",
    "northern road",
    "northern avenue",
    "northern boulevard",
    "northern lane",
    "northern alley",
    "northern highway",
    "northern motorway",
    "northern bridge",
    "northern tunnel",
    "northern plaza",
    "northern square",
    "northern park",
    "northern garden",
    "northern forest",
    "northern woods",
    "northern jungle",
    "northern desert",
    "northern swamp",
    "northern marsh",
    "southern room",
    "southern hall",
    "southern hallway",
    "southern corridor",
    "southern foyer",
    "southern lobby",
    "southern lounge",
    "southern kitchen",
    "southern bedroom",
    "southern bathroom",
    "southern office",
    "southern laboratory",
    "southern lab",
    "southern warehouse",
    "southern hangar",
    "southern garage",
    "southern basement",
    "southern attic",
    "southern cellar",
    "southern building",
    "southern tower",
    "southern castle",
    "southern palace",
    "southern fortress",
    "southern temple",
    "southern church",
    "southern cathedral",
    "southern shrine",
    "southern school",
    "southern university",
    "southern college",
    "southern academy",
    "southern hospital",
    "southern clinic",
    "southern station",
    "southern terminal",
    "southern airport",
    "southern harbour",
    "southern harbor",
    "southern port",
    "southern street",
    "southern road",
    "southern avenue",
    "southern boulevard",
    "southern lane",
    "southern alley",
    "southern highway",
    "southern motorway",
    "southern bridge",
    "southern tunnel",
    "southern plaza",
    "southern square",
    "southern park",
    "southern garden",
    "southern forest",
    "southern woods",
    "southern jungle",
    "southern desert",
    "southern swamp",
    "southern marsh",
    "eastern room",
    "eastern hall",
    "eastern hallway",
    "eastern corridor",
    "eastern foyer",
    "eastern lobby",
    "eastern lounge",
    "eastern kitchen",
    "eastern bedroom",
    "eastern bathroom",
    "eastern office",
    "eastern laboratory",
    "eastern lab",
    "eastern warehouse",
    "eastern hangar",
    "eastern garage",
    "eastern basement",
    "eastern attic",
    "eastern cellar",
    "eastern building",
    "eastern tower",
    "eastern castle",
    "eastern palace",
    "eastern fortress",
    "eastern temple",
    "eastern church",
    "eastern cathedral",
    "eastern shrine",
    "eastern school",
    "eastern university",
    "eastern college",
    "eastern academy",
    "eastern hospital",
    "eastern clinic",
    "eastern station",
    "eastern terminal",
    "eastern airport",
    "eastern harbour",
    "eastern harbor",
    "eastern port",
    "eastern street",
    "eastern road",
    "eastern avenue",
    "eastern boulevard",
    "eastern lane",
    "eastern alley",
    "eastern highway",
    "eastern motorway",
    "eastern bridge",
    "eastern tunnel",
    "eastern plaza",
    "eastern square",
    "eastern park",
    "eastern garden",
    "eastern forest",
    "eastern woods",
    "eastern jungle",
    "eastern desert",
    "eastern swamp",
    "eastern marsh",
    "western room",
    "western hall",
    "western hallway",
    "western corridor",
    "western foyer",
    "western lobby",
    "western lounge",
    "western kitchen",
    "western bedroom",
    "western bathroom",
    "western office",
    "western laboratory",
    "western lab",
    "western warehouse",
    "western hangar",
    "western garage",
    "western basement",
    "western attic",
    "western cellar",
    "western building",
    "western tower",
    "western castle",
    "western palace",
    "western fortress",
    "western temple",
    "western church",
    "western cathedral",
    "western shrine",
    "western school",
    "western university",
    "western college",
    "western academy",
    "western hospital",
    "western clinic",
    "western station",
    "western terminal",
    "western airport",
    "western harbour",
    "western harbor",
    "western port",
    "western street",
    "western road",
    "western avenue",
    "western boulevard",
    "western lane",
    "western alley",
    "western highway",
    "western motorway",
    "western bridge",
    "western tunnel",
    "western plaza",
    "western square",
    "western park",
    "western garden",
    "western forest",
    "western woods",
    "western jungle",
    "western desert",
    "western swamp",
    "western marsh",
    "inner room",
    "inner hall",
    "inner hallway",
    "inner corridor",
    "inner foyer",
    "inner lobby",
    "inner lounge",
    "inner kitchen",
    "inner bedroom",
    "inner bathroom",
    "inner office",
    "inner laboratory",
    "inner lab",
    "inner warehouse",
    "inner hangar",
    "inner garage",
    "inner basement",
    "inner attic",
    "inner cellar",
    "inner building",
    "inner tower",
    "inner castle",
    "inner palace",
    "inner fortress",
    "inner temple",
    "inner church",
    "inner cathedral",
    "inner shrine",
    "inner school",
    "inner university",
    "inner college",
    "inner academy",
    "inner hospital",
    "inner clinic",
    "inner station",
    "inner terminal",
    "inner airport",
    "inner harbour",
    "inner harbor",
    "inner port",
    "inner street",
    "inner road",
    "inner avenue",
    "inner boulevard",
    "inner lane",
    "inner alley",
    "inner highway",
    "inner motorway",
    "inner bridge",
    "inner tunnel",
    "inner plaza",
    "inner square",
    "inner park",
    "inner garden",
    "inner forest",
    "inner woods",
    "inner jungle",
    "inner desert",
    "inner swamp",
    "inner marsh",
    "outer room",
    "outer hall",
    "outer hallway",
    "outer corridor",
    "outer foyer",
    "outer lobby",
    "outer lounge",
    "outer kitchen",
    "outer bedroom",
    "outer bathroom",
    "outer office",
    "outer laboratory",
    "outer lab",
    "outer warehouse",
    "outer hangar",
    "outer garage",
    "outer basement",
    "outer attic",
    "outer cellar",
    "outer building",
    "outer tower",
    "outer castle",
    "outer palace",
    "outer fortress",
    "outer temple",
    "outer church",
    "outer cathedral",
    "outer shrine",
    "outer school",
    "outer university",
    "outer college",
    "outer academy",
    "outer hospital",
    "outer clinic",
    "outer station",
    "outer terminal",
    "outer airport",
    "outer harbour",
    "outer harbor",
    "outer port",
    "outer street",
    "outer road",
    "outer avenue",
    "outer boulevard",
    "outer lane",
    "outer alley",
    "outer highway",
    "outer motorway",
    "outer bridge",
    "outer tunnel",
    "outer plaza",
    "outer square",
    "outer park",
    "outer garden",
    "outer forest",
    "outer woods",
    "outer jungle",
    "outer desert",
    "outer swamp",
    "outer marsh",
    "front room",
    "front hall",
    "front hallway",
    "front corridor",
    "front foyer",
    "front lobby",
    "front lounge",
    "front kitchen",
    "front bedroom",
    "front bathroom",
    "front office",
    "front laboratory",
    "front lab",
    "front warehouse",
    "front hangar",
    "front garage",
    "front basement",
    "front attic",
    "front cellar",
    "front building",
    "front tower",
    "front castle",
    "front palace",
    "front fortress",
    "front temple",
    "front church",
    "front cathedral",
    "front shrine",
    "front school",
    "front university",
    "front college",
    "front academy",
    "front hospital",
    "front clinic",
    "front station",
    "front terminal",
    "front airport",
    "front harbour",
    "front harbor",
    "front port",
    "front street",
    "front road",
    "front avenue",
    "front boulevard",
    "front lane",
    "front alley",
    "front highway",
    "front motorway",
    "front bridge",
    "front tunnel",
    "front plaza",
    "front square",
    "front park",
    "front garden",
    "front forest",
    "front woods",
    "front jungle",
    "front desert",
    "front swamp",
    "front marsh",
    "rear room",
    "rear hall",
    "rear hallway",
    "rear corridor",
    "rear foyer",
    "rear lobby",
    "rear lounge",
    "rear kitchen",
    "rear bedroom",
    "rear bathroom",
    "rear office",
    "rear laboratory",
    "rear lab",
    "rear warehouse",
    "rear hangar",
    "rear garage",
    "rear basement",
    "rear attic",
    "rear cellar",
    "rear building",
    "rear tower",
    "rear castle",
    "rear palace",
    "rear fortress",
    "rear temple",
    "rear church",
    "rear cathedral",
    "rear shrine",
    "rear school",
    "rear university",
    "rear college",
    "rear academy",
    "rear hospital",
    "rear clinic",
    "rear station",
    "rear terminal",
    "rear airport",
    "rear harbour",
    "rear harbor",
    "rear port",
    "rear street",
    "rear road",
    "rear avenue",
    "rear boulevard",
    "rear lane",
    "rear alley",
    "rear highway",
    "rear motorway",
    "rear bridge",
    "rear tunnel",
    "rear plaza",
    "rear square",
    "rear park",
    "rear garden",
    "rear forest",
    "rear woods",
    "rear jungle",
    "rear desert",
    "rear swamp",
    "rear marsh",
    "back room",
    "back hall",
    "back hallway",
    "back corridor",
    "back foyer",
    "back lobby",
    "back lounge",
    "back kitchen",
    "back bedroom",
    "back bathroom",
    "back office",
    "back laboratory",
    "back lab",
    "back warehouse",
    "back hangar",
    "back garage",
    "back basement",
    "back attic",
    "back cellar",
    "back building",
    "back tower",
    "back castle",
    "back palace",
    "back fortress",
    "back temple",
    "back church",
    "back cathedral",
    "back shrine",
    "back school",
    "back university",
    "back college",
    "back academy",
    "back hospital",
    "back clinic",
    "back station",
    "back terminal",
    "back airport",
    "back harbour",
    "back harbor",
    "back port",
    "back street",
    "back road",
    "back avenue",
    "back boulevard",
    "back lane",
    "back alley",
    "back highway",
    "back motorway",
    "back bridge",
    "back tunnel",
    "back plaza",
    "back square",
    "back park",
    "back garden",
    "back forest",
    "back woods",
    "back jungle",
    "back desert",
    "back swamp",
    "back marsh",
    "left room",
    "left hall",
    "left hallway",
    "left corridor",
    "left foyer",
    "left lobby",
    "left lounge",
    "left kitchen",
    "left bedroom",
    "left bathroom",
    "left office",
    "left laboratory",
    "left lab",
    "left warehouse",
    "left hangar",
    "left garage",
    "left basement",
    "left attic",
    "left cellar",
    "left building",
    "left tower",
    "left castle",
    "left palace",
    "left fortress",
    "left temple",
    "left church",
    "left cathedral",
    "left shrine",
    "left school",
    "left university",
    "left college",
    "left academy",
    "left hospital",
    "left clinic",
    "left station",
    "left terminal",
    "left airport",
    "left harbour",
    "left harbor",
    "left port",
    "left street",
    "left road",
    "left avenue",
    "left boulevard",
    "left lane",
    "left alley",
    "left highway",
    "left motorway",
    "left bridge",
    "left tunnel",
    "left plaza",
    "left square",
    "left park",
    "left garden",
    "left forest",
    "left woods",
    "left jungle",
    "left desert",
    "left swamp",
    "left marsh",
    "right room",
    "right hall",
    "right hallway",
    "right corridor",
    "right foyer",
    "right lobby",
    "right lounge",
    "right kitchen",
    "right bedroom",
    "right bathroom",
    "right office",
    "right laboratory",
    "right lab",
    "right warehouse",
    "right hangar",
    "right garage",
    "right basement",
    "right attic",
    "right cellar",
    "right building",
    "right tower",
    "right castle",
    "right palace",
    "right fortress",
    "right temple",
    "right church",
    "right cathedral",
    "right shrine",
    "right school",
    "right university",
    "right college",
    "right academy",
    "right hospital",
    "right clinic",
    "right station",
    "right terminal",
    "right airport",
    "right harbour",
    "right harbor",
    "right port",
    "right street",
    "right road",
    "right avenue",
    "right boulevard",
    "right lane",
    "right alley",
    "right highway",
    "right motorway",
    "right bridge",
    "right tunnel",
    "right plaza",
    "right square",
    "right park",
    "right garden",
    "right forest",
    "right woods",
    "right jungle",
    "right desert",
    "right swamp",
    "right marsh",
    "first room",
    "first hall",
    "first hallway",
    "first corridor",
    "first foyer",
    "first lobby",
    "first lounge",
    "first kitchen",
    "first bedroom",
    "first bathroom",
    "first office",
    "first laboratory",
    "first lab",
    "first warehouse",
    "first hangar",
    "first garage",
    "first basement",
    "first attic",
    "first cellar",
    "first building",
    "first tower",
    "first castle",
    "first palace",
    "first fortress",
    "first temple",
    "first church",
    "first cathedral",
    "first shrine",
    "first school",
    "first university",
    "first college",
    "first academy",
    "first hospital",
    "first clinic",
    "first station",
    "first terminal",
    "first airport",
    "first harbour",
    "first harbor",
    "first port",
    "first street",
    "first road",
    "first avenue",
    "first boulevard",
    "first lane",
    "first alley",
    "first highway",
    "first motorway",
    "first bridge",
    "first tunnel",
    "first plaza",
    "first square",
    "first park",
    "first garden",
    "first forest",
    "first woods",
    "first jungle",
    "first desert",
    "first swamp",
    "first marsh",
    "second room",
    "second hall",
    "second hallway",
    "second corridor",
    "second foyer",
    "second lobby",
    "second lounge",
    "second kitchen",
    "second bedroom",
    "second bathroom",
    "second office",
    "second laboratory",
    "second lab",
    "second warehouse",
    "second hangar",
    "second garage",
    "second basement",
    "second attic",
    "second cellar",
    "second building",
    "second tower",
    "second castle",
    "second palace",
    "second fortress",
    "second temple",
    "second church",
    "second cathedral",
    "second shrine",
    "second school",
    "second university",
    "second college",
    "second academy",
    "second hospital",
    "second clinic",
    "second station",
    "second terminal",
    "second airport",
    "second harbour",
    "second harbor",
    "second port",
    "second street",
    "second road",
    "second avenue",
    "second boulevard",
    "second lane",
    "second alley",
    "second highway",
    "second motorway",
    "second bridge",
    "second tunnel",
    "second plaza",
    "second square",
    "second park",
    "second garden",
    "second forest",
    "second woods",
    "second jungle",
    "second desert",
    "second swamp",
    "second marsh",
    "third room",
    "third hall",
    "third hallway",
    "third corridor",
    "third foyer",
    "third lobby",
    "third lounge",
    "third kitchen",
    "third bedroom",
    "third bathroom",
    "third office",
    "third laboratory",
    "third lab",
    "third warehouse",
    "third hangar",
    "third garage",
    "third basement",
    "third attic",
    "third cellar",
    "third building",
    "third tower",
    "third castle",
    "third palace",
    "third fortress",
    "third temple",
    "third church",
    "third cathedral",
    "third shrine",
    "third school",
    "third university",
    "third college",
    "third academy",
    "third hospital",
    "third clinic",
    "third station",
    "third terminal",
    "third airport",
    "third harbour",
    "third harbor",
    "third port",
    "third street",
    "third road",
    "third avenue",
    "third boulevard",
    "third lane",
    "third alley",
    "third highway",
    "third motorway",
    "third bridge",
    "third tunnel",
    "third plaza",
    "third square",
    "third park",
    "third garden",
    "third forest",
    "third woods",
    "third jungle",
    "third desert",
    "third swamp",
    "third marsh",
    "fourth room",
    "fourth hall",
    "fourth hallway",
    "fourth corridor",
    "fourth foyer",
    "fourth lobby",
    "fourth lounge",
    "fourth kitchen",
    "fourth bedroom",
    "fourth bathroom",
    "fourth office",
    "fourth laboratory",
    "fourth lab",
    "fourth warehouse",
    "fourth hangar",
    "fourth garage",
    "fourth basement",
    "fourth attic",
    "fourth cellar",
    "fourth building",
    "fourth tower",
    "fourth castle",
    "fourth palace",
    "fourth fortress",
    "fourth temple",
    "fourth church",
    "fourth cathedral",
    "fourth shrine",
    "fourth school",
    "fourth university",
    "fourth college",
    "fourth academy",
    "fourth hospital",
    "fourth clinic",
    "fourth station",
    "fourth terminal",
    "fourth airport",
    "fourth harbour",
    "fourth harbor",
    "fourth port",
    "fourth street",
    "fourth road",
    "fourth avenue",
    "fourth boulevard",
    "fourth lane",
    "fourth alley",
    "fourth highway",
    "fourth motorway",
    "fourth bridge",
    "fourth tunnel",
    "fourth plaza",
    "fourth square",
    "fourth park",
    "fourth garden",
    "fourth forest",
    "fourth woods",
    "fourth jungle",
    "fourth desert",
    "fourth swamp",
    "fourth marsh",
    "fifth room",
    "fifth hall",
    "fifth hallway",
    "fifth corridor",
    "fifth foyer",
    "fifth lobby",
    "fifth lounge",
    "fifth kitchen",
    "fifth bedroom",
    "fifth bathroom",
    "fifth office",
    "fifth laboratory",
    "fifth lab",
    "fifth warehouse",
    "fifth hangar",
    "fifth garage",
    "fifth basement",
    "fifth attic",
    "fifth cellar",
    "fifth building",
    "fifth tower",
    "fifth castle",
    "fifth palace",
    "fifth fortress",
    "fifth temple",
    "fifth church",
    "fifth cathedral",
    "fifth shrine",
    "fifth school",
    "fifth university",
    "fifth college",
    "fifth academy",
    "fifth hospital",
    "fifth clinic",
    "fifth station",
    "fifth terminal",
    "fifth airport",
    "fifth harbour",
    "fifth harbor",
    "fifth port",
    "fifth street",
    "fifth road",
    "fifth avenue",
    "fifth boulevard",
    "fifth lane",
    "fifth alley",
    "fifth highway",
    "fifth motorway",
    "fifth bridge",
    "fifth tunnel",
    "fifth plaza",
    "fifth square",
    "fifth park",
    "fifth garden",
    "fifth forest",
    "fifth woods",
    "fifth jungle",
    "fifth desert",
    "fifth swamp",
    "fifth marsh",
    "top room",
    "top hall",
    "top hallway",
    "top corridor",
    "top foyer",
    "top lobby",
    "top lounge",
    "top kitchen",
    "top bedroom",
    "top bathroom",
    "top office",
    "top laboratory",
    "top lab",
    "top warehouse",
    "top hangar",
    "top garage",
    "top basement",
    "top attic",
    "top cellar",
    "top building",
    "top tower",
    "top castle",
    "top palace",
    "top fortress",
    "top temple",
    "top church",
    "top cathedral",
    "top shrine",
    "top school",
    "top university",
    "top college",
    "top academy",
    "top hospital",
    "top clinic",
    "top station",
    "top terminal",
    "top airport",
    "top harbour",
    "top harbor",
    "top port",
    "top street",
    "top road",
    "top avenue",
    "top boulevard",
    "top lane",
    "top alley",
    "top highway",
    "top motorway",
    "top bridge",
    "top tunnel",
    "top plaza",
    "top square",
    "top park",
    "top garden",
    "top forest",
    "top woods",
    "top jungle",
    "top desert",
    "top swamp",
    "top marsh",
    "bottom room",
    "bottom hall",
    "bottom hallway",
    "bottom corridor",
    "bottom foyer",
    "bottom lobby",
    "bottom lounge",
    "bottom kitchen",
    "bottom bedroom",
    "bottom bathroom",
    "bottom office",
    "bottom laboratory",
    "bottom lab",
    "bottom warehouse",
    "bottom hangar",
    "bottom garage",
    "bottom basement",
    "bottom attic",
    "bottom cellar",
    "bottom building",
    "bottom tower",
    "bottom castle",
    "bottom palace",
    "bottom fortress",
    "bottom temple",
    "bottom church",
    "bottom cathedral",
    "bottom shrine",
    "bottom school",
    "bottom university",
    "bottom college",
    "bottom academy",
    "bottom hospital",
    "bottom clinic",
    "bottom station",
    "bottom terminal",
    "bottom airport",
    "bottom harbour",
    "bottom harbor",
    "bottom port",
    "bottom street",
    "bottom road",
    "bottom avenue",
    "bottom boulevard",
    "bottom lane",
    "bottom alley",
    "bottom highway",
    "bottom motorway",
    "bottom bridge",
    "bottom tunnel",
    "bottom plaza",
    "bottom square",
    "bottom park",
    "bottom garden",
    "bottom forest",
    "bottom woods",
    "bottom jungle",
    "bottom desert",
    "bottom swamp",
    "bottom marsh",
    "grand room",
    "grand hall",
    "grand hallway",
    "grand corridor",
    "grand foyer",
    "grand lobby",
    "grand lounge",
    "grand kitchen",
    "grand bedroom",
    "grand bathroom",
    "grand office",
    "grand laboratory",
    "grand lab",
    "grand warehouse",
    "grand hangar",
    "grand garage",
    "grand basement",
    "grand attic",
    "grand cellar",
    "grand building",
    "grand tower",
    "grand castle",
    "grand palace",
    "grand fortress",
    "grand temple",
    "grand church",
    "grand cathedral",
    "grand shrine",
    "grand school",
    "grand university",
    "grand college",
    "grand academy",
    "grand hospital",
    "grand clinic",
    "grand station",
    "grand terminal",
    "grand airport",
    "grand harbour",
    "grand harbor",
    "grand port",
    "grand street",
    "grand road",
    "grand avenue",
    "grand boulevard",
    "grand lane",
    "grand alley",
    "grand highway",
    "grand motorway",
    "grand bridge",
    "grand tunnel",
    "grand plaza",
    "grand square",
    "grand park",
    "grand garden",
    "grand forest",
    "grand woods",
    "grand jungle",
    "grand desert",
    "grand swamp",
    "grand marsh",
    "royal room",
    "royal hall",
    "royal hallway",
    "royal corridor",
    "royal foyer",
    "royal lobby",
    "royal lounge",
    "royal kitchen",
    "royal bedroom",
    "royal bathroom",
    "royal office",
    "royal laboratory",
    "royal lab",
    "royal warehouse",
    "royal hangar",
    "royal garage",
    "royal basement",
    "royal attic",
    "royal cellar",
    "royal building",
    "royal tower",
    "royal castle",
    "royal palace",
    "royal fortress",
    "royal temple",
    "royal church",
    "royal cathedral",
    "royal shrine",
    "royal school",
    "royal university",
    "royal college",
    "royal academy",
    "royal hospital",
    "royal clinic",
    "royal station",
    "royal terminal",
    "royal airport",
    "royal harbour",
    "royal harbor",
    "royal port",
    "royal street",
    "royal road",
    "royal avenue",
    "royal boulevard",
    "royal lane",
    "royal alley",
    "royal highway",
    "royal motorway",
    "royal bridge",
    "royal tunnel",
    "royal plaza",
    "royal square",
    "royal park",
    "royal garden",
    "royal forest",
    "royal woods",
    "royal jungle",
    "royal desert",
    "royal swamp",
    "royal marsh",
    "imperial room",
    "imperial hall",
    "imperial hallway",
    "imperial corridor",
    "imperial foyer",
    "imperial lobby",
    "imperial lounge",
    "imperial kitchen",
    "imperial bedroom",
    "imperial bathroom",
    "imperial office",
    "imperial laboratory",
    "imperial lab",
    "imperial warehouse",
    "imperial hangar",
    "imperial garage",
    "imperial basement",
    "imperial attic",
    "imperial cellar",
    "imperial building",
    "imperial tower",
    "imperial castle",
    "imperial palace",
    "imperial fortress",
    "imperial temple",
    "imperial church",
    "imperial cathedral",
    "imperial shrine",
    "imperial school",
    "imperial university",
    "imperial college",
    "imperial academy",
    "imperial hospital",
    "imperial clinic",
    "imperial station",
    "imperial terminal",
    "imperial airport",
    "imperial harbour",
    "imperial harbor",
    "imperial port",
    "imperial street",
    "imperial road",
    "imperial avenue",
    "imperial boulevard",
    "imperial lane",
    "imperial alley",
    "imperial highway",
    "imperial motorway",
    "imperial bridge",
    "imperial tunnel",
    "imperial plaza",
    "imperial square",
    "imperial park",
    "imperial garden",
    "imperial forest",
    "imperial woods",
    "imperial jungle",
    "imperial desert",
    "imperial swamp",
    "imperial marsh",
    "public room",
    "public hall",
    "public hallway",
    "public corridor",
    "public foyer",
    "public lobby",
    "public lounge",
    "public kitchen",
    "public bedroom",
    "public bathroom",
    "public office",
    "public laboratory",
    "public lab",
    "public warehouse",
    "public hangar",
    "public garage",
    "public basement",
    "public attic",
    "public cellar",
    "public building",
    "public tower",
    "public castle",
    "public palace",
    "public fortress",
    "public temple",
    "public church",
    "public cathedral",
    "public shrine",
    "public school",
    "public university",
    "public college",
    "public academy",
    "public hospital",
    "public clinic",
    "public station",
    "public terminal",
    "public airport",
    "public harbour",
    "public harbor",
    "public port",
    "public street",
    "public road",
    "public avenue",
    "public boulevard",
    "public lane",
    "public alley",
    "public highway",
    "public motorway",
    "public bridge",
    "public tunnel",
    "public plaza",
    "public square",
    "public park",
    "public garden",
    "public forest",
    "public woods",
    "public jungle",
    "public desert",
    "public swamp",
    "public marsh",
    "private room",
    "private hall",
    "private hallway",
    "private corridor",
    "private foyer",
    "private lobby",
    "private lounge",
    "private kitchen",
    "private bedroom",
    "private bathroom",
    "private office",
    "private laboratory",
    "private lab",
    "private warehouse",
    "private hangar",
    "private garage",
    "private basement",
    "private attic",
    "private cellar",
    "private building",
    "private tower",
    "private castle",
    "private palace",
    "private fortress",
    "private temple",
    "private church",
    "private cathedral",
    "private shrine",
    "private school",
    "private university",
    "private college",
    "private academy",
    "private hospital",
    "private clinic",
    "private station",
    "private terminal",
    "private airport",
    "private harbour",
    "private harbor",
    "private port",
    "private street",
    "private road",
    "private avenue",
    "private boulevard",
    "private lane",
    "private alley",
    "private highway",
    "private motorway",
    "private bridge",
    "private tunnel",
    "private plaza",
    "private square",
    "private park",
    "private garden",
    "private forest",
    "private woods",
    "private jungle",
    "private desert",
    "private swamp",
    "private marsh",
    "secret room",
    "secret hall",
    "secret hallway",
    "secret corridor",
    "secret foyer",
    "secret lobby",
    "secret lounge",
    "secret kitchen",
    "secret bedroom",
    "secret bathroom",
    "secret office",
    "secret laboratory",
    "secret lab",
    "secret warehouse",
    "secret hangar",
    "secret garage",
    "secret basement",
    "secret attic",
    "secret cellar",
    "secret building",
    "secret tower",
    "secret castle",
    "secret palace",
    "secret fortress",
    "secret temple",
    "secret church",
    "secret cathedral",
    "secret shrine",
    "secret school",
    "secret university",
    "secret college",
    "secret academy",
    "secret hospital",
    "secret clinic",
    "secret station",
    "secret terminal",
    "secret airport",
    "secret harbour",
    "secret harbor",
    "secret port",
    "secret street",
    "secret road",
    "secret avenue",
    "secret boulevard",
    "secret lane",
    "secret alley",
    "secret highway",
    "secret motorway",
    "secret bridge",
    "secret tunnel",
    "secret plaza",
    "secret square",
    "secret park",
    "secret garden",
    "secret forest",
    "secret woods",
    "secret jungle",
    "secret desert",
    "secret swamp",
    "secret marsh",
    "hidden room",
    "hidden hall",
    "hidden hallway",
    "hidden corridor",
    "hidden foyer",
    "hidden lobby",
    "hidden lounge",
    "hidden kitchen",
    "hidden bedroom",
    "hidden bathroom",
    "hidden office",
    "hidden laboratory",
    "hidden lab",
    "hidden warehouse",
    "hidden hangar",
    "hidden garage",
    "hidden basement",
    "hidden attic",
    "hidden cellar",
    "hidden building",
    "hidden tower",
    "hidden castle",
    "hidden palace",
    "hidden fortress",
    "hidden temple",
    "hidden church",
    "hidden cathedral",
    "hidden shrine",
    "hidden school",
    "hidden university",
    "hidden college",
    "hidden academy",
    "hidden hospital",
    "hidden clinic",
    "hidden station",
    "hidden terminal",
    "hidden airport",
    "hidden harbour",
    "hidden harbor",
    "hidden port",
    "hidden street",
    "hidden road",
    "hidden avenue",
    "hidden boulevard",
    "hidden lane",
    "hidden alley",
    "hidden highway",
    "hidden motorway",
    "hidden bridge",
    "hidden tunnel",
    "hidden plaza",
    "hidden square",
    "hidden park",
    "hidden garden",
    "hidden forest",
    "hidden woods",
    "hidden jungle",
    "hidden desert",
    "hidden swamp",
    "hidden marsh",
    "abandoned room",
    "abandoned hall",
    "abandoned hallway",
    "abandoned corridor",
    "abandoned foyer",
    "abandoned lobby",
    "abandoned lounge",
    "abandoned kitchen",
    "abandoned bedroom",
    "abandoned bathroom",
    "abandoned office",
    "abandoned laboratory",
    "abandoned lab",
    "abandoned warehouse",
    "abandoned hangar",
    "abandoned garage",
    "abandoned basement",
    "abandoned attic",
    "abandoned cellar",
    "abandoned building",
    "abandoned tower",
    "abandoned castle",
    "abandoned palace",
    "abandoned fortress",
    "abandoned temple",
    "abandoned church",
    "abandoned cathedral",
    "abandoned shrine",
    "abandoned school",
    "abandoned university",
    "abandoned college",
    "abandoned academy",
    "abandoned hospital",
    "abandoned clinic",
    "abandoned station",
    "abandoned terminal",
    "abandoned airport",
    "abandoned harbour",
    "abandoned harbor",
    "abandoned port",
    "abandoned street",
    "abandoned road",
    "abandoned avenue",
    "abandoned boulevard",
    "abandoned lane",
    "abandoned alley",
    "abandoned highway",
    "abandoned motorway",
    "abandoned bridge",
    "abandoned tunnel",
    "abandoned plaza",
    "abandoned square",
    "abandoned park",
    "abandoned garden",
    "abandoned forest",
    "abandoned woods",
    "abandoned jungle",
    "abandoned desert",
    "abandoned swamp",
    "abandoned marsh",
    "ancient room",
    "ancient hall",
    "ancient hallway",
    "ancient corridor",
    "ancient foyer",
    "ancient lobby",
    "ancient lounge",
    "ancient kitchen",
    "ancient bedroom",
    "ancient bathroom",
    "ancient office",
    "ancient laboratory",
    "ancient lab",
    "ancient warehouse",
    "ancient hangar",
    "ancient garage",
    "ancient basement",
    "ancient attic",
    "ancient cellar",
    "ancient building",
    "ancient tower",
    "ancient castle",
    "ancient palace",
    "ancient fortress",
    "ancient temple",
    "ancient church",
    "ancient cathedral",
    "ancient shrine",
    "ancient school",
    "ancient university",
    "ancient college",
    "ancient academy",
    "ancient hospital",
    "ancient clinic",
    "ancient station",
    "ancient terminal",
    "ancient airport",
    "ancient harbour",
    "ancient harbor",
    "ancient port",
    "ancient street",
    "ancient road",
    "ancient avenue",
    "ancient boulevard",
    "ancient lane",
    "ancient alley",
    "ancient highway",
    "ancient motorway",
    "ancient bridge",
    "ancient tunnel",
    "ancient plaza",
    "ancient square",
    "ancient park",
    "ancient garden",
    "ancient forest",
    "ancient woods",
    "ancient jungle",
    "ancient desert",
    "ancient swamp",
    "ancient marsh",
    "modern room",
    "modern hall",
    "modern hallway",
    "modern corridor",
    "modern foyer",
    "modern lobby",
    "modern lounge",
    "modern kitchen",
    "modern bedroom",
    "modern bathroom",
    "modern office",
    "modern laboratory",
    "modern lab",
    "modern warehouse",
    "modern hangar",
    "modern garage",
    "modern basement",
    "modern attic",
    "modern cellar",
    "modern building",
    "modern tower",
    "modern castle",
    "modern palace",
    "modern fortress",
    "modern temple",
    "modern church",
    "modern cathedral",
    "modern shrine",
    "modern school",
    "modern university",
    "modern college",
    "modern academy",
    "modern hospital",
    "modern clinic",
    "modern station",
    "modern terminal",
    "modern airport",
    "modern harbour",
    "modern harbor",
    "modern port",
    "modern street",
    "modern road",
    "modern avenue",
    "modern boulevard",
    "modern lane",
    "modern alley",
    "modern highway",
    "modern motorway",
    "modern bridge",
    "modern tunnel",
    "modern plaza",
    "modern square",
    "modern park",
    "modern garden",
    "modern forest",
    "modern woods",
    "modern jungle",
    "modern desert",
    "modern swamp",
    "modern marsh",
    "small room",
    "small hall",
    "small hallway",
    "small corridor",
    "small foyer",
    "small lobby",
    "small lounge",
    "small kitchen",
    "small bedroom",
    "small bathroom",
    "small office",
    "small laboratory",
    "small lab",
    "small warehouse",
    "small hangar",
    "small garage",
    "small basement",
    "small attic",
    "small cellar",
    "small building",
    "small tower",
    "small castle",
    "small palace",
    "small fortress",
    "small temple",
    "small church",
    "small cathedral",
    "small shrine",
    "small school",
    "small university",
    "small college",
    "small academy",
    "small hospital",
    "small clinic",
    "small station",
    "small terminal",
    "small airport",
    "small harbour",
    "small harbor",
    "small port",
    "small street",
    "small road",
    "small avenue",
    "small boulevard",
    "small lane",
    "small alley",
    "small highway",
    "small motorway",
    "small bridge",
    "small tunnel",
    "small plaza",
    "small square",
    "small park",
    "small garden",
    "small forest",
    "small woods",
    "small jungle",
    "small desert",
    "small swamp",
    "small marsh",
    "large room",
    "large hall",
    "large hallway",
    "large corridor",
    "large foyer",
    "large lobby",
    "large lounge",
    "large kitchen",
    "large bedroom",
    "large bathroom",
    "large office",
    "large laboratory",
    "large lab",
    "large warehouse",
    "large hangar",
    "large garage",
    "large basement",
    "large attic",
    "large cellar",
    "large building",
    "large tower",
    "large castle",
    "large palace",
    "large fortress",
    "large temple",
    "large church",
    "large cathedral",
    "large shrine",
    "large school",
    "large university",
    "large college",
    "large academy",
    "large hospital",
    "large clinic",
    "large station",
    "large terminal",
    "large airport",
    "large harbour",
    "large harbor",
    "large port",
    "large street",
    "large road",
    "large avenue",
    "large boulevard",
    "large lane",
    "large alley",
    "large highway",
    "large motorway",
    "large bridge",
    "large tunnel",
    "large plaza",
    "large square",
    "large park",
    "large garden",
    "large forest",
    "large woods",
    "large jungle",
    "large desert",
    "large swamp",
    "large marsh",
    "great room",
    "great hall",
    "great hallway",
    "great corridor",
    "great foyer",
    "great lobby",
    "great lounge",
    "great kitchen",
    "great bedroom",
    "great bathroom",
    "great office",
    "great laboratory",
    "great lab",
    "great warehouse",
    "great hangar",
    "great garage",
    "great basement",
    "great attic",
    "great cellar",
    "great building",
    "great tower",
    "great castle",
    "great palace",
    "great fortress",
    "great temple",
    "great church",
    "great cathedral",
    "great shrine",
    "great school",
    "great university",
    "great college",
    "great academy",
    "great hospital",
    "great clinic",
    "great station",
    "great terminal",
    "great airport",
    "great harbour",
    "great harbor",
    "great port",
    "great street",
    "great road",
    "great avenue",
    "great boulevard",
    "great lane",
    "great alley",
    "great highway",
    "great motorway",
    "great bridge",
    "great tunnel",
    "great plaza",
    "great square",
    "great park",
    "great garden",
    "great forest",
    "great woods",
    "great jungle",
    "great desert",
    "great swamp",
    "great marsh",
    "high room",
    "high hall",
    "high hallway",
    "high corridor",
    "high foyer",
    "high lobby",
    "high lounge",
    "high kitchen",
    "high bedroom",
    "high bathroom",
    "high office",
    "high laboratory",
    "high lab",
    "high warehouse",
    "high hangar",
    "high garage",
    "high basement",
    "high attic",
    "high cellar",
    "high building",
    "high tower",
    "high castle",
    "high palace",
    "high fortress",
    "high temple",
    "high church",
    "high cathedral",
    "high shrine",
    "high school",
    "high university",
    "high college",
    "high academy",
    "high hospital",
    "high clinic",
    "high station",
    "high terminal",
    "high airport",
    "high harbour",
    "high harbor",
    "high port",
    "high street",
    "high road",
    "high avenue",
    "high boulevard",
    "high lane",
    "high alley",
    "high highway",
    "high motorway",
    "high bridge",
    "high tunnel",
    "high plaza",
    "high square",
    "high park",
    "high garden",
    "high forest",
    "high woods",
    "high jungle",
    "high desert",
    "high swamp",
    "high marsh",
    "low room",
    "low hall",
    "low hallway",
    "low corridor",
    "low foyer",
    "low lobby",
    "low lounge",
    "low kitchen",
    "low bedroom",
    "low bathroom",
    "low office",
    "low laboratory",
    "low lab",
    "low warehouse",
    "low hangar",
    "low garage",
    "low basement",
    "low attic",
    "low cellar",
    "low building",
    "low tower",
    "low castle",
    "low palace",
    "low fortress",
    "low temple",
    "low church",
    "low cathedral",
    "low shrine",
    "low school",
    "low university",
    "low college",
    "low academy",
    "low hospital",
    "low clinic",
    "low station",
    "low terminal",
    "low airport",
    "low harbour",
    "low harbor",
    "low port",
    "low street",
    "low road",
    "low avenue",
    "low boulevard",
    "low lane",
    "low alley",
    "low highway",
    "low motorway",
    "low bridge",
    "low tunnel",
    "low plaza",
    "low square",
    "low park",
    "low garden",
    "low forest",
    "low woods",
    "low jungle",
    "low desert",
    "low swamp",
    "low marsh",
    "red room",
    "red hall",
    "red hallway",
    "red corridor",
    "red foyer",
    "red lobby",
    "red lounge",
    "red kitchen",
    "red bedroom",
    "red bathroom",
    "red office",
    "red laboratory",
    "red lab",
    "red warehouse",
    "red hangar",
    "red garage",
    "red basement",
    "red attic",
    "red cellar",
    "red building",
    "red tower",
    "red castle",
    "red palace",
    "red fortress",
    "red temple",
    "red church",
    "red cathedral",
    "red shrine",
    "red school",
    "red university",
    "red college",
    "red academy",
    "red hospital",
    "red clinic",
    "red station",
    "red terminal",
    "red airport",
    "red harbour",
    "red harbor",
    "red port",
    "red street",
    "red road",
    "red avenue",
    "red boulevard",
    "red lane",
    "red alley",
    "red highway",
    "red motorway",
    "red bridge",
    "red tunnel",
    "red plaza",
    "red square",
    "red park",
    "red garden",
    "red forest",
    "red woods",
    "red jungle",
    "red desert",
    "red swamp",
    "red marsh",
    "blue room",
    "blue hall",
    "blue hallway",
    "blue corridor",
    "blue foyer",
    "blue lobby",
    "blue lounge",
    "blue kitchen",
    "blue bedroom",
    "blue bathroom",
    "blue office",
    "blue laboratory",
    "blue lab",
    "blue warehouse",
    "blue hangar",
    "blue garage",
    "blue basement",
    "blue attic",
    "blue cellar",
    "blue building",
    "blue tower",
    "blue castle",
    "blue palace",
    "blue fortress",
    "blue temple",
    "blue church",
    "blue cathedral",
    "blue shrine",
    "blue school",
    "blue university",
    "blue college",
    "blue academy",
    "blue hospital",
    "blue clinic",
    "blue station",
    "blue terminal",
    "blue airport",
    "blue harbour",
    "blue harbor",
    "blue port",
    "blue street",
    "blue road",
    "blue avenue",
    "blue boulevard",
    "blue lane",
    "blue alley",
    "blue highway",
    "blue motorway",
    "blue bridge",
    "blue tunnel",
    "blue plaza",
    "blue square",
    "blue park",
    "blue garden",
    "blue forest",
    "blue woods",
    "blue jungle",
    "blue desert",
    "blue swamp",
    "blue marsh",
    "green room",
    "green hall",
    "green hallway",
    "green corridor",
    "green foyer",
    "green lobby",
    "green lounge",
    "green kitchen",
    "green bedroom",
    "green bathroom",
    "green office",
    "green laboratory",
    "green lab",
    "green warehouse",
    "green hangar",
    "green garage",
    "green basement",
    "green attic",
    "green cellar",
    "green building",
    "green tower",
    "green castle",
    "green palace",
    "green fortress",
    "green temple",
    "green church",
    "green cathedral",
    "green shrine",
    "green school",
    "green university",
    "green college",
    "green academy",
    "green hospital",
    "green clinic",
    "green station",
    "green terminal",
    "green airport",
    "green harbour",
    "green harbor",
    "green port",
    "green street",
    "green road",
    "green avenue",
    "green boulevard",
    "green lane",
    "green alley",
    "green highway",
    "green motorway",
    "green bridge",
    "green tunnel",
    "green plaza",
    "green square",
    "green park",
    "green garden",
    "green forest",
    "green woods",
    "green jungle",
    "green desert",
    "green swamp",
    "green marsh",
    "black room",
    "black hall",
    "black hallway",
    "black corridor",
    "black foyer",
    "black lobby",
    "black lounge",
    "black kitchen",
    "black bedroom",
    "black bathroom",
    "black office",
    "black laboratory",
    "black lab",
    "black warehouse",
    "black hangar",
    "black garage",
    "black basement",
    "black attic",
    "black cellar",
    "black building",
    "black tower",
    "black castle",
    "black palace",
    "black fortress",
    "black temple",
    "black church",
    "black cathedral",
    "black shrine",
    "black school",
    "black university",
    "black college",
    "black academy",
    "black hospital",
    "black clinic",
    "black station",
    "black terminal",
    "black airport",
    "black harbour",
    "black harbor",
    "black port",
    "black street",
    "black road",
    "black avenue",
    "black boulevard",
    "black lane",
    "black alley",
    "black highway",
    "black motorway",
    "black bridge",
    "black tunnel",
    "black plaza",
    "black square",
    "black park",
    "black garden",
    "black forest",
    "black woods",
    "black jungle",
    "black desert",
    "black swamp",
    "black marsh",
    "white room",
    "white hall",
    "white hallway",
    "white corridor",
    "white foyer",
    "white lobby",
    "white lounge",
    "white kitchen",
    "white bedroom",
    "white bathroom",
    "white office",
    "white laboratory",
    "white lab",
    "white warehouse",
    "white hangar",
    "white garage",
    "white basement",
    "white attic",
    "white cellar",
    "white building",
    "white tower",
    "white castle",
    "white palace",
    "white fortress",
    "white temple",
    "white church",
    "white cathedral",
    "white shrine",
    "white school",
    "white university",
    "white college",
    "white academy",
    "white hospital",
    "white clinic",
    "white station",
    "white terminal",
    "white airport",
    "white harbour",
    "white harbor",
    "white port",
    "white street",
    "white road",
    "white avenue",
    "white boulevard",
    "white lane",
    "white alley",
    "white highway",
    "white motorway",
    "white bridge",
    "white tunnel",
    "white plaza",
    "white square",
    "white park",
    "white garden",
    "white forest",
    "white woods",
    "white jungle",
    "white desert",
    "white swamp",
    "white marsh",
    "silver room",
    "silver hall",
    "silver hallway",
    "silver corridor",
    "silver foyer",
    "silver lobby",
    "silver lounge",
    "silver kitchen",
    "silver bedroom",
    "silver bathroom",
    "silver office",
    "silver laboratory",
    "silver lab",
    "silver warehouse",
    "silver hangar",
    "silver garage",
    "silver basement",
    "silver attic",
    "silver cellar",
    "silver building",
    "silver tower",
    "silver castle",
    "silver palace",
    "silver fortress",
    "silver temple",
    "silver church",
    "silver cathedral",
    "silver shrine",
    "silver school",
    "silver university",
    "silver college",
    "silver academy",
    "silver hospital",
    "silver clinic",
    "silver station",
    "silver terminal",
    "silver airport",
    "silver harbour",
    "silver harbor",
    "silver port",
    "silver street",
    "silver road",
    "silver avenue",
    "silver boulevard",
    "silver lane",
    "silver alley",
    "silver highway",
    "silver motorway",
    "silver bridge",
    "silver tunnel",
    "silver plaza",
    "silver square",
    "silver park",
    "silver garden",
    "silver forest",
    "silver woods",
    "silver jungle",
    "silver desert",
    "silver swamp",
    "silver marsh",
    "golden room",
    "golden hall",
    "golden hallway",
    "golden corridor",
    "golden foyer",
    "golden lobby",
    "golden lounge",
    "golden kitchen",
    "golden bedroom",
    "golden bathroom",
    "golden office",
    "golden laboratory",
    "golden lab",
    "golden warehouse",
    "golden hangar",
    "golden garage",
    "golden basement",
    "golden attic",
    "golden cellar",
    "golden building",
    "golden tower",
    "golden castle",
    "golden palace",
    "golden fortress",
    "golden temple",
    "golden church",
    "golden cathedral",
    "golden shrine",
    "golden school",
    "golden university",
    "golden college",
    "golden academy",
    "golden hospital",
    "golden clinic",
    "golden station",
    "golden terminal",
    "golden airport",
    "golden harbour",
    "golden harbor",
    "golden port",
    "golden street",
    "golden road",
    "golden avenue",
    "golden boulevard",
    "golden lane",
    "golden alley",
    "golden highway",
    "golden motorway",
    "golden bridge",
    "golden tunnel",
    "golden plaza",
    "golden square",
    "golden park",
    "golden garden",
    "golden forest",
    "golden woods",
    "golden jungle",
    "golden desert",
    "golden swamp",
    "golden marsh",
    "grey room",
    "grey hall",
    "grey hallway",
    "grey corridor",
    "grey foyer",
    "grey lobby",
    "grey lounge",
    "grey kitchen",
    "grey bedroom",
    "grey bathroom",
    "grey office",
    "grey laboratory",
    "grey lab",
    "grey warehouse",
    "grey hangar",
    "grey garage",
    "grey basement",
    "grey attic",
    "grey cellar",
    "grey building",
    "grey tower",
    "grey castle",
    "grey palace",
    "grey fortress",
    "grey temple",
    "grey church",
    "grey cathedral",
    "grey shrine",
    "grey school",
    "grey university",
    "grey college",
    "grey academy",
    "grey hospital",
    "grey clinic",
    "grey station",
    "grey terminal",
    "grey airport",
    "grey harbour",
    "grey harbor",
    "grey port",
    "grey street",
    "grey road",
    "grey avenue",
    "grey boulevard",
    "grey lane",
    "grey alley",
    "grey highway",
    "grey motorway",
    "grey bridge",
    "grey tunnel",
    "grey plaza",
    "grey square",
    "grey park",
    "grey garden",
    "grey forest",
    "grey woods",
    "grey jungle",
    "grey desert",
    "grey swamp",
    "grey marsh",
    "gray room",
    "gray hall",
    "gray hallway",
    "gray corridor",
    "gray foyer",
    "gray lobby",
    "gray lounge",
    "gray kitchen",
    "gray bedroom",
    "gray bathroom",
    "gray office",
    "gray laboratory",
    "gray lab",
    "gray warehouse",
    "gray hangar",
    "gray garage",
    "gray basement",
    "gray attic",
    "gray cellar",
    "gray building",
    "gray tower",
    "gray castle",
    "gray palace",
    "gray fortress",
    "gray temple",
    "gray church",
    "gray cathedral",
    "gray shrine",
    "gray school",
    "gray university",
    "gray college",
    "gray academy",
    "gray hospital",
    "gray clinic",
    "gray station",
    "gray terminal",
    "gray airport",
    "gray harbour",
    "gray harbor",
    "gray port",
    "gray street",
    "gray road",
    "gray avenue",
    "gray boulevard",
    "gray lane",
    "gray alley",
    "gray highway",
    "gray motorway",
    "gray bridge",
    "gray tunnel",
    "gray plaza",
    "gray square",
    "gray park",
    "gray garden",
    "gray forest",
    "gray woods",
    "gray jungle",
    "gray desert",
    "gray swamp",
    "gray marsh",
    "stone room",
    "stone hall",
    "stone hallway",
    "stone corridor",
    "stone foyer",
    "stone lobby",
    "stone lounge",
    "stone kitchen",
    "stone bedroom",
    "stone bathroom",
    "stone office",
    "stone laboratory",
    "stone lab",
    "stone warehouse",
    "stone hangar",
    "stone garage",
    "stone basement",
    "stone attic",
    "stone cellar",
    "stone building",
    "stone tower",
    "stone castle",
    "stone palace",
    "stone fortress",
    "stone temple",
    "stone church",
    "stone cathedral",
    "stone shrine",
    "stone school",
    "stone university",
    "stone college",
    "stone academy",
    "stone hospital",
    "stone clinic",
    "stone station",
    "stone terminal",
    "stone airport",
    "stone harbour",
    "stone harbor",
    "stone port",
    "stone street",
    "stone road",
    "stone avenue",
    "stone boulevard",
    "stone lane",
    "stone alley",
    "stone highway",
    "stone motorway",
    "stone bridge",
    "stone tunnel",
    "stone plaza",
    "stone square",
    "stone park",
    "stone garden",
    "stone forest",
    "stone woods",
    "stone jungle",
    "stone desert",
    "stone swamp",
    "stone marsh",
    "iron room",
    "iron hall",
    "iron hallway",
    "iron corridor",
    "iron foyer",
    "iron lobby",
    "iron lounge",
    "iron kitchen",
    "iron bedroom",
    "iron bathroom",
    "iron office",
    "iron laboratory",
    "iron lab",
    "iron warehouse",
    "iron hangar",
    "iron garage",
    "iron basement",
    "iron attic",
    "iron cellar",
    "iron building",
    "iron tower",
    "iron castle",
    "iron palace",
    "iron fortress",
    "iron temple",
    "iron church",
    "iron cathedral",
    "iron shrine",
    "iron school",
    "iron university",
    "iron college",
    "iron academy",
    "iron hospital",
    "iron clinic",
    "iron station",
    "iron terminal",
    "iron airport",
    "iron harbour",
    "iron harbor",
    "iron port",
    "iron street",
    "iron road",
    "iron avenue",
    "iron boulevard",
    "iron lane",
    "iron alley",
    "iron highway",
    "iron motorway",
    "iron bridge",
    "iron tunnel",
    "iron plaza",
    "iron square",
    "iron park",
    "iron garden",
    "iron forest",
    "iron woods",
    "iron jungle",
    "iron desert",
    "iron swamp",
    "iron marsh",
    "steel room",
    "steel hall",
    "steel hallway",
    "steel corridor",
    "steel foyer",
    "steel lobby",
    "steel lounge",
    "steel kitchen",
    "steel bedroom",
    "steel bathroom",
    "steel office",
    "steel laboratory",
    "steel lab",
    "steel warehouse",
    "steel hangar",
    "steel garage",
    "steel basement",
    "steel attic",
    "steel cellar",
    "steel building",
    "steel tower",
    "steel castle",
    "steel palace",
    "steel fortress",
    "steel temple",
    "steel church",
    "steel cathedral",
    "steel shrine",
    "steel school",
    "steel university",
    "steel college",
    "steel academy",
    "steel hospital",
    "steel clinic",
    "steel station",
    "steel terminal",
    "steel airport",
    "steel harbour",
    "steel harbor",
    "steel port",
    "steel street",
    "steel road",
    "steel avenue",
    "steel boulevard",
    "steel lane",
    "steel alley",
    "steel highway",
    "steel motorway",
    "steel bridge",
    "steel tunnel",
    "steel plaza",
    "steel square",
    "steel park",
    "steel garden",
    "steel forest",
    "steel woods",
    "steel jungle",
    "steel desert",
    "steel swamp",
    "steel marsh",
    "glass room",
    "glass hall",
    "glass hallway",
    "glass corridor",
    "glass foyer",
    "glass lobby",
    "glass lounge",
    "glass kitchen",
    "glass bedroom",
    "glass bathroom",
    "glass office",
    "glass laboratory",
    "glass lab",
    "glass warehouse",
    "glass hangar",
    "glass garage",
    "glass basement",
    "glass attic",
    "glass cellar",
    "glass building",
    "glass tower",
    "glass castle",
    "glass palace",
    "glass fortress",
    "glass temple",
    "glass church",
    "glass cathedral",
    "glass shrine",
    "glass school",
    "glass university",
    "glass college",
    "glass academy",
    "glass hospital",
    "glass clinic",
    "glass station",
    "glass terminal",
    "glass airport",
    "glass harbour",
    "glass harbor",
    "glass port",
    "glass street",
    "glass road",
    "glass avenue",
    "glass boulevard",
    "glass lane",
    "glass alley",
    "glass highway",
    "glass motorway",
    "glass bridge",
    "glass tunnel",
    "glass plaza",
    "glass square",
    "glass park",
    "glass garden",
    "glass forest",
    "glass woods",
    "glass jungle",
    "glass desert",
    "glass swamp",
    "glass marsh",
    "underground room",
    "underground hall",
    "underground hallway",
    "underground corridor",
    "underground foyer",
    "underground lobby",
    "underground lounge",
    "underground kitchen",
    "underground bedroom",
    "underground bathroom",
    "underground office",
    "underground laboratory",
    "underground lab",
    "underground warehouse",
    "underground hangar",
    "underground garage",
    "underground basement",
    "underground attic",
    "underground cellar",
    "underground building",
    "underground tower",
    "underground castle",
    "underground palace",
    "underground fortress",
    "underground temple",
    "underground church",
    "underground cathedral",
    "underground shrine",
    "underground school",
    "underground university",
    "underground college",
    "underground academy",
    "underground hospital",
    "underground clinic",
    "underground station",
    "underground terminal",
    "underground airport",
    "underground harbour",
    "underground harbor",
    "underground port",
    "underground street",
    "underground road",
    "underground avenue",
    "underground boulevard",
    "underground lane",
    "underground alley",
    "underground highway",
    "underground motorway",
    "underground bridge",
    "underground tunnel",
    "underground plaza",
    "underground square",
    "underground park",
    "underground garden",
    "underground forest",
    "underground woods",
    "underground jungle",
    "underground desert",
    "underground swamp",
    "underground marsh",
    "emergency room",
    "emergency hall",
    "emergency hallway",
    "emergency corridor",
    "emergency foyer",
    "emergency lobby",
    "emergency lounge",
    "emergency kitchen",
    "emergency bedroom",
    "emergency bathroom",
    "emergency office",
    "emergency laboratory",
    "emergency lab",
    "emergency warehouse",
    "emergency hangar",
    "emergency garage",
    "emergency basement",
    "emergency attic",
    "emergency cellar",
    "emergency building",
    "emergency tower",
    "emergency castle",
    "emergency palace",
    "emergency fortress",
    "emergency temple",
    "emergency church",
    "emergency cathedral",
    "emergency shrine",
    "emergency school",
    "emergency university",
    "emergency college",
    "emergency academy",
    "emergency hospital",
    "emergency clinic",
    "emergency station",
    "emergency terminal",
    "emergency airport",
    "emergency harbour",
    "emergency harbor",
    "emergency port",
    "emergency street",
    "emergency road",
    "emergency avenue",
    "emergency boulevard",
    "emergency lane",
    "emergency alley",
    "emergency highway",
    "emergency motorway",
    "emergency bridge",
    "emergency tunnel",
    "emergency plaza",
    "emergency square",
    "emergency park",
    "emergency garden",
    "emergency forest",
    "emergency woods",
    "emergency jungle",
    "emergency desert",
    "emergency swamp",
    "emergency marsh",
    "research room",
    "research hall",
    "research hallway",
    "research corridor",
    "research foyer",
    "research lobby",
    "research lounge",
    "research kitchen",
    "research bedroom",
    "research bathroom",
    "research office",
    "research laboratory",
    "research lab",
    "research warehouse",
    "research hangar",
    "research garage",
    "research basement",
    "research attic",
    "research cellar",
    "research building",
    "research tower",
    "research castle",
    "research palace",
    "research fortress",
    "research temple",
    "research church",
    "research cathedral",
    "research shrine",
    "research school",
    "research university",
    "research college",
    "research academy",
    "research hospital",
    "research clinic",
    "research station",
    "research terminal",
    "research airport",
    "research harbour",
    "research harbor",
    "research port",
    "research street",
    "research road",
    "research avenue",
    "research boulevard",
    "research lane",
    "research alley",
    "research highway",
    "research motorway",
    "research bridge",
    "research tunnel",
    "research plaza",
    "research square",
    "research park",
    "research garden",
    "research forest",
    "research woods",
    "research jungle",
    "research desert",
    "research swamp",
    "research marsh",
    "medical room",
    "medical hall",
    "medical hallway",
    "medical corridor",
    "medical foyer",
    "medical lobby",
    "medical lounge",
    "medical kitchen",
    "medical bedroom",
    "medical bathroom",
    "medical office",
    "medical laboratory",
    "medical lab",
    "medical warehouse",
    "medical hangar",
    "medical garage",
    "medical basement",
    "medical attic",
    "medical cellar",
    "medical building",
    "medical tower",
    "medical castle",
    "medical palace",
    "medical fortress",
    "medical temple",
    "medical church",
    "medical cathedral",
    "medical shrine",
    "medical school",
    "medical university",
    "medical college",
    "medical academy",
    "medical hospital",
    "medical clinic",
    "medical station",
    "medical terminal",
    "medical airport",
    "medical harbour",
    "medical harbor",
    "medical port",
    "medical street",
    "medical road",
    "medical avenue",
    "medical boulevard",
    "medical lane",
    "medical alley",
    "medical highway",
    "medical motorway",
    "medical bridge",
    "medical tunnel",
    "medical plaza",
    "medical square",
    "medical park",
    "medical garden",
    "medical forest",
    "medical woods",
    "medical jungle",
    "medical desert",
    "medical swamp",
    "medical marsh",
  ]);

  const DETECTION_FORTRESS_META_PHRASES = new Set();
  const DETECTION_FORTRESS_EXTRA_WORLD_LOCATION = new Set();
  const DETECTION_FORTRESS_EXTRA_WORLD_ITEM = new Set();
  const DETECTION_FORTRESS_EXTRA_WORLD_VEHICLE = new Set();
  const DETECTION_FORTRESS_EXTRA_WORLD_ORG = new Set();
  const DETECTION_FORTRESS_EXTRA_WORLD_EVENT = new Set();
  // Schema 23: compact Detection Fortress.
  // The old build stored 12,718 three-column rows in memory, including a 9,690-row
  // Cartesian family of UI/meta phrases. That was excellent as a test corpus but
  // wasteful inside AI Dungeon's 16 MB script sandbox. The same family is represented
  // algorithmically here instead of allocating thousands of row arrays and duplicate strings.
  const DETECTION_FORTRESS_COVERAGE_ROWS = 12718;
  const DETECTION_FORTRESS_META_PREFIXES = new Set("active\nai\narchive\nauthor\nautomatic\ncache\ncached\ncanon\ncanonical\ncard\ncharacter\ncommand\ncommands\nconfig\nconfiguration\ncontext\ncreator\ncurrent\ndata\ndebug\ndetection\ndetector\ndeveloper\ndiagnostic\ndiagnostics\nengine\nexternal\nfront\ngeneration\nglobal\nhidden\nhistory\nhook\ninactive\ninput\ninstruction\ninstructions\ninterface\ninternal\nlast\nlatest\nledger\nlocal\nmanual\nmemory\nmetadata\nmodel\nnext\nnote\nnotes\nnpc\noption\noutput\npersistent\nplayer\nplot\nprevious\nprior\nprivate\nprompt\npublic\nrear\nrecall\nrecap\nrecent\nresponse\nruntime\nsandbox\nscenario\nscript\nselected\nsettings\nstate\nstory\nstory-card\nstorycard\nsummary\nsystem\ntemporary\ntimeline\nui\nunselected\nuser\nvisible\nworld".split("\n"));
  const DETECTION_FORTRESS_META_SUFFIXES = new Set("action\nactions\narray\narrays\nauthor-note\nauthor-notes\nblock\nbutton\ncache\ncard\ncards\nchapter\nchapters\ncommand\ncommands\nconfig\nconfiguration\ncontext\ndata\ndebug\ndescription\nentries\nentry\nepisode\nepisodes\nerror\nerrors\nfield\nfields\nfront-memory\nfunction\nfunctions\ngeneration\nhistory\nhook\nhooks\ninput\ninstruction\ninstructions\ninterface\nkey\nkeys\nlog\nlogs\nlore\nmemory\nmemory-bank\nmenu\nmessage\nmessages\nmetadata\nmode\nmodel\nnote\nnotes\nobject\nobjects\noption\noptions\noutput\npanel\npayload\nplaceholder\nplaceholders\nprompt\nrecap\nrecord\nrecords\nreport\nreports\nresponse\nresult\nresults\nrevision\nscene\nscenes\nschema\nscript\nscripts\nsection\nsetting\nsettings\nstat\nstate\nstatistic\nstatistics\nstats\nstatus\nstory-card\nstory-cards\nstorycard\nstorycards\nsummary\nsystem\ntab\ntext\ntitle\ntoken\ntokens\ntrace\ntraces\ntrigger\ntriggers\nturn\nturns\nvalue\nvalues\nvariable\nvariables\nversion\nwarning\nwarnings\nwindow\nworld".split("\n"));
  for (const x of "a\nable\nablely\nabove\nabsent\nabsently\naccept\naccepted\naccepting\naccepts\nacross\nact\naction\nactions\nactive\nactively\nactivities\nactivity\nactual\nactually\nadd\nadded\nadding\nadditional\nadditionally\naddress\naddresses\nadds\nadjust\nadjusted\nadjusting\nadjusts\nadmit\nadmited\nadmiting\nadmits\nadvise\nadvised\nadvises\nadvising\nafraid\nafraidly\nafter\nagain\nagainst\nage\nai\nair\nairs\nalarm\nalarms\nalias\naliases\nalive\nalively\nall\nallow\nallowed\nallowing\nallows\nalmost\nalone\nalonely\nalong\nalready\nalso\nalthough\namong\nan\nand\nangle\nangles\nangry\nangryly\nanother\nanswer\nanswered\nanswering\nanswers\nanxious\nanxiously\nany\nanyone\nanything\napart\napartment\napartments\nappear\nappearance\nappeared\nappearing\nappears\napplied\napplies\napply\napplying\napproach\napproached\napproaching\napproachs\narchive\narchives\nargue\nargued\nargues\narguing\narm\narmour\narmours\narms\naround\narrange\narranged\narranges\narranging\narrive\narrived\narrives\narriving\nask\nasked\nasking\nasks\nassistant\nat\nattach\nattached\nattaching\nattachs\nattempt\nattempted\nattempting\nattempts\nauthor\nauthor-note\nauthor-notes\nautomatic\nautomaticly\navailable\navailablely\navoid\navoided\navoiding\navoids\naware\nawarely\naway\nback\nbad\nbadly\nbag\nbags\nbalance\nbalanced\nbalances\nbalancing\nbalconies\nbalcony\nbasement\nbasements\nbasic\nbasicly\nbathroom\nbathrooms\nbatteries\nbattery\nbeach\nbeaches\nbecause\nbed\nbedroom\nbedrooms\nbeds\nbefore\nbegin\nbegined\nbegining\nbegins\nbehind\nbelow\nbench\nbenches\nbeneath\nbeside\nbetween\nbeyond\nbirthday\nblack\nblackly\nblank\nblankly\nblast\nblasts\nblink\nblinked\nblinking\nblinks\nblock\nblocked\nblocking\nblocks\nblood\nbloods\nblue\nbluely\nbodies\nbody\nbook\nbooks\nboth\nbottle\nbottles\nbox\nboxes\nbranch\nbranches\nbreakfast\nbreakfasts\nbreathe\nbreathed\nbreathes\nbreathing\nbridge\nbridges\nbrief\nbriefly\nbright\nbrightly\nbroken\nbrokenly\nbrown\nbrownly\nbuilding\nbuildings\nbundle\nbundles\nbut\nbutton\nbuttons\nby\ncable\ncables\ncafe\ncafes\ncalculate\ncalculated\ncalculates\ncalculating\ncall\ncalled\ncalling\ncalls\ncalm\ncalmly\ncamera\ncameras\ncanon\ncanonical\ncaption\ncaptions\ncar\ncareful\ncarefully\ncarried\ncarries\ncarry\ncarrying\ncars\ncase\ncases\ncell\ncells\ncentral\ncentrally\ncertain\ncertainly\nchamber\nchambers\nchange\nchanged\nchanges\nchanging\nchannel\nchannels\nchapter\ncheck\nchecked\nchecking\nchecks\nchoose\nchoosed\nchooses\nchoosing\ncircle\ncircles\ncities\ncity\nclean\ncleaned\ncleaning\ncleanly\ncleans\nclear\ncleared\nclearing\nclearly\nclears\nclick\nclicked\nclicking\nclicks\nclient\nclients\nclimb\nclimbed\nclimbing\nclimbs\nclose\nclosed\nclosedly\ncloses\nclosing\ncloud\nclouds\ncoat\ncoats\ncoffee\ncoffees\ncold\ncoldly\ncolour\ncolours\ncolumn\ncolumns\ncomment\ncomments\ncommon\ncommonly\ncompare\ncompared\ncompares\ncomparing\ncomplete\ncompleted\ncompletely\ncompletes\ncompleting\ncomplex\ncomplexly\ncomputer\ncomputers\nconcrete\nconcretely\nconcretes\nconfig\nconfiguration\nconfirm\nconfirmed\nconfirming\nconfirms\nconnect\nconnected\nconnecting\nconnects\nconsider\nconsidered\nconsidering\nconsiders\nconsole\nconsoles\nconstant\nconstantly\ncontainer\ncontainers\ncontext\ncontinue\ncontinued\ncontinues\ncontinuing\ncontrol\ncontroled\ncontroling\ncontrolled\ncontrolledly\ncontrols\ncool\ncoolly\ncopied\ncopies\ncopy\ncopying\ncorner\ncorners\ncorrect\ncorrectly\ncorridor\ncorridors\ncount\ncounted\ncounting\ncounts\ncourt\ncourts\ncreate\ncreated\ncreates\ncreating\ncreator\ncried\ncries\ncross\ncrossed\ncrossing\ncrosss\ncrouch\ncrouched\ncrouching\ncrouchs\ncrowd\ncrowds\ncry\ncrying\ncurrent\ncurrently\ncycle\ncycles\ndamage\ndamaged\ndamages\ndamaging\ndark\ndarkly\ndata\ndatas\nday\ndays\ndead\ndeadly\ndebug\ndecide\ndecided\ndecides\ndeciding\ndeep\ndeeply\ndefinitely\ndeliver\ndelivered\ndelivering\ndelivers\ndescribe\ndescribed\ndescribes\ndescribing\ndescription\ndesignation\ndesk\ndesks\ndetail\ndetails\ndetect\ndetected\ndetecting\ndetects\ndifferent\ndifferently\ndirect\ndirectly\ndisappear\ndisappeared\ndisappearing\ndisappears\ndiscover\ndiscovered\ndiscovering\ndiscovers\ndiscuss\ndiscussed\ndiscussing\ndiscusss\ndisplay\ndisplayed\ndisplaying\ndisplays\ndistant\ndistantly\ndo\ndocument\ndocuments\ndoor\ndoors\ndown\ndrag\ndraged\ndraging\ndrags\ndrop\ndroped\ndroping\ndrops\ndry\ndryly\ndungeon\nduring\neach\nearlier\nearly\nearlyly\neasy\neasyly\neffect\neffects\neight\neither\nelse\nempty\nemptyly\nenergies\nenergy\nengine\nengines\nenough\nenter\nentered\nentering\nenters\nentries\nentry\nepisode\nequipment\nequipments\nera\neven\nevery\neverybody\neveryone\neverything\nevidence\nevidences\nexact\nexactly\nexamine\nexamined\nexamines\nexamining\nexhibit\nexhibits\nexist\nexisted\nexisting\nexists\nexplain\nexplained\nexplaining\nexplains\nexternal\nexternally\nface\nfaced\nfaces\nfacing\nfact\nfacts\nfail\nfailed\nfailing\nfails\nfaint\nfaintly\nfalse\nfalsely\nfamiliar\nfamiliarly\nfamily\nfast\nfastly\nfew\nfield\nfields\nfile\nfiles\nfinal\nfinally\nfine\nfinely\nfinish\nfinished\nfinishing\nfinishs\nfirst\nfirstly\nfive\nfix\nfixed\nfixedly\nfixing\nfixs\nflat\nflatly\nfloor\nfloors\nfolder\nfolders\nfollow\nfollowed\nfollowing\nfollows\nfood\nfoods\nfor\nforce\nforced\nforces\nforcing\nform\nformal\nformally\nformer\nforms\nforward\nfour\nframe\nframes\nfree\nfreely\nfresh\nfreshly\nfrom\nfull\nfullly\ngalleries\ngallery\ngarden\ngardens\ngate\ngates\ngather\ngathered\ngathering\ngathers\ngeneral\ngenerally\nglance\nglanced\nglances\nglancing\nglass\nglasses\nglove\ngloves\ngrab\ngrabed\ngrabing\ngrabs\ngreet\ngreeted\ngreeting\ngreets\ngrey\ngreyly\nground\ngrounds\ngroup\ngroups\nguess\nguessed\nguessing\nguesss\nhall\nhalls\nhallway\nhallways\nhand\nhandle\nhandled\nhandles\nhandling\nhands\nhappen\nhappened\nhappening\nhappens\nhard\nhardly\nhead\nheads\nhearing\nhearings\nheat\nheats\nheavy\nheavyly\nhelp\nhelped\nhelping\nhelps\nhere\nhidden\nhiddenly\nhide\nhided\nhides\nhiding\nhigh\nhighly\nhistories\nhistory\nhold\nholded\nholding\nholds\nhome\nhomes\nhospital\nhospitals\nhot\nhotly\nhour\nhours\nhouse\nhouses\nhow\nhuge\nhugely\nhundred\nidentified\nidentifies\nidentify\nidentifying\nif\nimage\nimages\nimagine\nimagined\nimagines\nimagining\nimpossible\nimpossiblely\nimprove\nimproved\nimproves\nimproving\nin\ninclude\nincluded\nincludes\nincluding\nincrease\nincreased\nincreases\nincreasing\nindependent\nindependently\nindicate\nindicated\nindicates\nindicating\ninput\ninside\ninspect\ninspected\ninspecting\ninspects\ninstruction\ninstructions\ninstrument\ninstruments\ninterface\ninterfaces\ninternal\ninternally\ninterrupt\ninterrupted\ninterrupting\ninterrupts\ninto\nintroduce\nintroduced\nintroduces\nintroducing\njacket\njackets\njoin\njoined\njoining\njoins\njump\njumped\njumping\njumps\njust\nkeep\nkeeped\nkeeping\nkeeps\nkey\nkeyboard\nkeyboards\nkeys\nknock\nknocked\nknocking\nknocks\nknown\nlab\nlaboratories\nlaboratory\nlabs\nlarge\nlargely\nlast\nlastly\nlate\nlately\nlater\nlatest\nlatter\nlaugh\nlaughed\nlaughing\nlaughs\nlayer\nlayers\nlearn\nlearned\nlearning\nlearns\nleast\nleave\nleaved\nleaves\nleaving\nless\nlevel\nlevels\nlift\nlifted\nlifting\nlifts\nlight\nlightly\nlights\nline\nlines\nlink\nlinked\nlinking\nlinks\nlisten\nlistened\nlistening\nlistens\nlittle\nlittlely\nload\nloaded\nloading\nloads\nlocal\nlocally\nlock\nlocked\nlocking\nlocks\nlog\nlogs\nlong\nlongly\nlook\nlooked\nlooking\nlooks\nloose\nloosely\nlore\nlow\nlower\nlowered\nlowering\nlowers\nlowly\nmachine\nmachines\nmajor\nmajorly\nmanage\nmanaged\nmanages\nmanaging\nmany\nmap\nmaps\nmark\nmarked\nmarking\nmarks\nmask\nmasks\nmathematical\nmathematically\nmaybe\nmeasure\nmeasured\nmeasurement\nmeasurements\nmeasures\nmeasuring\nmedical\nmedically\nmemory\nmention\nmentioned\nmentioning\nmentions\nmessage\nmessages\nmetadata\nmetal\nmetals\nmillion\nminute\nminutes\nmodel\nmodels\nmodern\nmodernly\nmodule\nmodules\nmoment\nmoments\nmonitor\nmonitors\nmonth\nmonths\nmore\nmorning\nmornings\nmost\nmove\nmoved\nmoves\nmoving\nmuch\nmuseum\nmuseums\nname\nnarrow\nnarrowly\nnatural\nnaturally\nnear\nneither\nnetwork\nnetworks\nnew\nnewest\nnewly\nnext\nnight\nnights\nnine\nno\nnobody\nnormal\nnormally\nnot\nnote\nnotes\nnothing\nnotice\nnoticed\nnotices\nnoticing\nnow\nnumber\nnumbers\nobject\nobjects\nobserve\nobserved\nobserves\nobserving\nof\noff\noffice\noffices\nold\noldly\non\none\nonly\nonto\nopen\nopened\nopening\nopenly\nopens\noption\noptions\nor\nordinary\nordinaryly\norganize\norganized\norganizes\norganizing\nother\noutput\noutside\nover\noverride\nown\npack\npacked\npacking\npacks\npanel\npanels\npaper\npapers\npart\npass\npassed\npassing\npasss\npattern\npatterns\npause\npaused\npauses\npausing\nperform\nperformed\nperforming\nperforms\nperhaps\npersonality\nphone\nphones\nphoto\nphotos\nphysical\nphysically\npicture\npictures\nplace\nplaced\nplaces\nplacing\nplan\nplaned\nplaning\nplans\nplatform\nplatforms\nplayer\npoint\npointed\npointing\npoints\npolished\npolishedly\npossible\npossiblely\npower\npowered\npoweredly\npowers\nprecise\nprecisely\npress\npressed\npressing\npresss\npreviously\nprivate\nprivately\nprobably\nprocess\nprocessed\nprocesses\nprocessing\nprocesss\nprogramme\nprogrammes\nproject\nprojects\nprompt\nprotect\nprotected\nprotecting\nprotects\npublic\npublicly\npull\npulled\npulling\npulls\npush\npushed\npushing\npushs\nquestion\nquestioned\nquestioning\nquestions\nquickly\nquiet\nquietly\nquite\nrather\nraw\nrawly\nreach\nreached\nreaching\nreachs\nread\nreaded\nreading\nreads\nreal\nrealize\nrealized\nrealizes\nrealizing\nreally\nrecap\nreceive\nreceived\nreceives\nreceiving\nrecent\nrecently\nrecord\nrecorded\nrecording\nrecords\nred\nredly\nreduce\nreduced\nreduces\nreducing\nrefuse\nrefused\nrefuses\nrefusing\nrelationship\nrelationships\nrelease\nreleased\nreleases\nreleasing\nrelevant\nrelevantly\nremain\nremained\nremaining\nremains\nremember\nremembered\nremembering\nremembers\nremote\nremotely\nremove\nremoved\nremoves\nremoving\nrepair\nrepaired\nrepairing\nrepairs\nrepeat\nrepeated\nrepeating\nrepeats\nreplace\nreplaced\nreplaces\nreplacing\nreplied\nreplies\nreply\nreplying\nreport\nreported\nreporting\nreports\nrest\nrested\nresting\nrests\nresult\nresults\nreturn\nreturned\nreturning\nreturns\nreveal\nrevealed\nrevealing\nreveals\nright\nrightly\nroad\nroads\nrole\nroll\nrolled\nrolling\nrolls\nroom\nrooms\nrough\nroughly\nrule\nrun\nruned\nruning\nruns\nsafe\nsafely\nsame\nsamely\nsample\nsamples\nsanitised\nsanitisedly\nsave\nsaved\nsaves\nsaving\nsay\nscan\nscaned\nscaning\nscans\nscenario\nscene\nscreen\nscreens\nscript\nsealed\nsealedly\nsearch\nsearched\nsearching\nsearchs\nsecond\nsecondly\nsection\nsections\nselect\nselected\nselecting\nselects\nsend\nsended\nsending\nsends\nsensor\nsensors\nseparate\nseparately\nserious\nseriously\nsetting\nsettings\nseven\nseveral\nshape\nshapes\nshare\nshared\nshares\nsharing\nsharp\nsharply\nshelf\nshelfs\nshift\nshifted\nshifting\nshifts\nshort\nshortly\nshow\nshowed\nshowing\nshows\nshrug\nshruged\nshruging\nshrugs\nsignal\nsignals\nsilent\nsilently\nsimple\nsimplely\nsimply\nsit\nsite\nsited\nsites\nsiting\nsits\nsix\nskies\nsky\nslowly\nsmall\nsmallly\nsmile\nsmiled\nsmiles\nsmiling\nsoft\nsoftly\nsomebody\nsomeone\nsomething\nspace\nspaces\nspeak\nspeaked\nspeaking\nspeaks\nstable\nstablely\nstark\nstarkly\nstart\nstarted\nstarting\nstarts\nstation\nstations\nstatus\nstay\nstayed\nstaying\nstays\nsteady\nsteadyly\nstep\nsteped\nsteping\nsteps\nstill\nstop\nstoped\nstoping\nstops\nstore\nstored\nstores\nstoring\nstory\nstrange\nstrangely\nstreet\nstreets\nstrong\nstrongly\nstructure\nstructured\nstructuredly\nstructures\nstudied\nstudies\nstudy\nstudying\nsubject\nsubjects\nsuch\nsudden\nsuddenly\nsuggest\nsuggested\nsuggesting\nsuggests\nsuit\nsuits\nsummary\nsupport\nsupported\nsupporting\nsupports\nswitch\nswitched\nswitching\nswitchs\nsystem\nsystems\ntable\ntables\ntalk\ntalked\ntalking\ntalks\ntask\ntasks\ntechnical\ntechnically\ntemperature\ntemperatures\ntemporary\ntemporaryly\nten\ntest\ntested\ntesting\ntests\ntext\ntexts\nthat\nthe\nthen\nthere\nthese\nthin\nthing\nthings\nthinly\nthird\nthis\nthose\nthough\nthousand\nthread\nthreads\nthree\nthrough\nthrow\nthrowed\nthrowing\nthrows\ntight\ntightly\ntime\ntimes\ntired\ntiredly\nto\ntogether\ntool\ntools\ntouch\ntouched\ntouching\ntouchs\ntoward\ntowards\ntower\ntowers\ntrack\ntracked\ntracking\ntracks\ntrain\ntrained\ntraining\ntrains\ntransport\ntransports\ntravel\ntraveled\ntraveling\ntravels\ntrial\ntrials\ntrigger\ntriggers\ntrue\ntruely\ntunnel\ntunnels\nturn\nturned\nturning\nturns\ntwo\ntype\ntyped\ntypes\ntyping\nunder\nunderstand\nunderstanded\nunderstanding\nunderstands\nunlock\nunlocked\nunlocking\nunlocks\nunusual\nunusually\nup\nupdate\nupdated\nupdates\nupdating\nuse\nused\nuser\nuses\nusing\nvalue\nvalues\nvehicle\nvehicles\nverified\nverifies\nverify\nverifying\nvery\nvisible\nvisiblely\nvisit\nvisited\nvisiting\nvisits\nwait\nwaited\nwaiting\nwaits\nwalk\nwalked\nwalking\nwalks\nwall\nwalls\nwant\nwanted\nwanting\nwants\nwarehouse\nwarehouses\nwarm\nwarmly\nwarn\nwarned\nwarning\nwarns\nwatch\nwatched\nwatching\nwatchs\nwater\nwaters\nwave\nwaves\nweek\nweeks\nwet\nwetly\nwhat\nwhatever\nwhen\nwhere\nwhich\nwhichever\nwhile\nwhisper\nwhispered\nwhispering\nwhispers\nwhite\nwhitely\nwho\nwhoever\nwhom\nwhose\nwhy\nwide\nwidely\nwild\nwildly\nwindow\nwindows\nwire\nwires\nwith\nwithin\nwithout\nword\nwords\nwork\nworked\nworking\nworks\nworld\nworried\nworries\nworry\nworrying\nwrite\nwrited\nwrites\nwriting\nwrong\nwrongly\nyear\nyears\nyell\nyelled\nyelling\nyells\nyes\nyoung\nyoungly\nzone\nzones".split("\\n")) if (x) DETECT_HARD_SINGLE.add(x);
  for (const x of "amber\napril\narcher\nash\naugust\nautumn\nbaker\nbeau\nbell\nbill\nbishop\nblake\nbrook\nbrooks\nbrown\ncade\ncarter\ncasey\nchance\ncharity\nchase\ncherry\nclay\ncliff\ncole\ncook\ncross\ndale\ndawn\ndean\ndrew\nduke\necho\neden\nember\neve\nfaith\nfern\nfield\nfinley\nfisher\nford\nforest\nfoster\nfox\nfrost\ngale\nglory\ngrace\ngrant\ngray\ngreen\ngrey\nhall\nharley\nharper\nhaven\nhazel\nheath\nholly\nhope\nhunter\nivy\njade\njordan\njoy\njune\njustice\nking\nlake\nlance\nlane\nlark\nliberty\nlily\nlogan\nlondon\nmajor\nmarch\nmarshal\nmason\nmax\nmay\nmeadow\nmelody\nmercy\nmiles\nmoon\nocean\nolive\npage\npaige\npark\nparker\npearl\npenny\nphoenix\npiper\npoppy\nporter\nprince\nqueen\nrain\nraven\nray\nreed\nriver\nrobin\nrose\nrowan\nruby\nrusty\nsage\nsailor\nsaint\nscarlet\nscout\nsky\nskylar\nsnow\nstar\nstone\nstorm\nsummer\nsunny\ntanner\ntaylor\ntempest\ntony\ntrinity\nvale\nviolet\nwade\nwalker\nward\nwest\nwillow\nwinter\nwolf\nwoods\nwoody\nwren\nyoung".split("\\n")) if (x) DETECT_SOFT_SINGLE.add(x);
  for (const x of "accountant\nactor\nactress\nadministrator\nadmiral\nadvocate\nadvocate-general\nalchemist\nally\nanalyst\napprentice\narcher\narchitect\narchivist\nartificer\nassassin\nassistant\nassistant-director\nastronaut\nastronomer\nastrophysicist\nattorney\naunt\nbarrister\nbest-friend\nbiologist\nboyfriend\nbroker\nbrother\nbrother-in-law\nbystander\ncaptain\ncaregiver\ncarpenter\ncase-officer\ncaseworker\ncashier\nchancellor\nchemist\nchief-executive\nchild\ncivilian\nclassmate\ncleaner\ncleric\nclerk\nclient\nclinician\nco-director\nco-worker\ncoach\ncolleague\ncolonel\ncommander\ncommunications-officer\ncompliance-officer\nconstable\nconsultant\ncontact\ncontroller\ncounsel\ncounsellor\ncounselor\ncousin\ncoworker\ncrown-prosecutor\ncurator\ncustodian\ndaughter\ndaughter-in-law\ndean\ndefence-lawyer\ndefense-lawyer\ndeputy\ndeputy-director\ndetective-constable\ndetective-inspector\ndetective-sergeant\ndiplomat\ndirector\ndispatcher\ndoctor\ndriver\neconomist\neditor\nelectrician\nenemy\nengineer\nengineer-officer\nethics-officer\nex-boyfriend\nex-girlfriend\nex-partner\nexaminer\nexecutive\nfather-in-law\nfiance\nfiancee\nfield-agent\nfirefighter\nflatmate\nforeman\nforensic-specialist\nfoster-child\nfoster-parent\nfriend\ngallery-assistant\ngeneral\ngeologist\ngirlfriend\ngodfather\ngodmother\ngranddaughter\ngrandfather\ngrandmother\ngrandson\nguard\nguardian\nhacker\nhalf-brother\nhalf-sister\nhandler\nheadteacher\nhealer\nhistorian\nhousemate\nhunter\ninformant\nintelligence-officer\nintern\ninterpreter\njanitor\njournalist\njudge\nknight\nlaboratory-director\nlandlord\nlecturer\nlegal-adviser\nlegal-counsel\nliaison-officer\nlibrarian\nlieutenant\nmage\nmagistrate\nmajor\nmanager\nmanaging-director\nmarine\nmarshal\nmechanic\nmediator\nmedic-officer\nmentor\nmercenary\nmonk\nmother-in-law\nmuseum-assistant\nnavigator\nneighbor\nneighbour\nnephew\nniece\nnun\nnurse\nobservatory-director\nofficer\noperations-officer\noperator\noptical-physicist\nowner\npaladin\nparamedic\nparent\npartner\npatient\npharmacist\nphotographer\nphysician\nphysicist\npilot\nplanner\nplumber\npolice-officer\npostgraduate\npresenter\npriest\npriestess\nprincipal\nprison-officer\nprobation-officer\nproducer\nprofessor\nprogrammer\nproprietor\nprosecutor\npsychologist\nquartermaster\nranger\nreceptionist\nregistrar\nreporter\nresearch-director\nresearcher\nresponder\nrival\nroommate\nsafety-officer\nsailor\nscience-officer\nscientist\nscout\nsecurity-guard\nsecurity-officer\nsergeant\nsheriff\nshift-leader\nsister\nsister-in-law\nsocial-worker\nsoldier\nsolicitor\nson\nson-in-law\nsorcerer\nsource\nspecial-agent\nspecialist\nspouse\nspy\nsquad-leader\nstepbrother\nstepchild\nstepparent\nstepsister\nstudent\nsupervisor\nsurgeon\nsurvivor\nsuspect\nteam-leader\nteammate\ntechnician\ntenant\ntracker\ntrainee\ntranslator\ntutor\nuncle\nundergraduate\nveterinarian\nvictim\nwarrior\nwidow\nwidower\nwitch\nwitness\nwizard".split("\\n")) if (x) DETECT_PERSON_ROLES.add(x);
  for (const x of "adoptive-father\nadoptive-mother\nally\napprentice\nassociate\nbarrister\nbest-friend\nbiological-father\nbiological-mother\nboss\nbrother-in-law\nchildhood-friend\nclassmate\nclient\nco-worker\ncolleague\ncommander\ncontact\ncoworker\ncrush\ndaughter-in-law\neldest-brother\neldest-sister\nemployee\nemployer\nenemy\nex-boyfriend\nex-girlfriend\nex-husband\nex-partner\nex-wife\nfamily-friend\nfather-in-law\nfiance\nfiancee\nfiancé\nfiancée\nflatmate\nfoster-father\nfoster-mother\nfriend\ngoddaughter\ngodfather\ngodmother\ngodson\ngranddaughter\ngrandson\ngreat-aunt\ngreat-granddaughter\ngreat-grandfather\ngreat-grandmother\ngreat-grandson\ngreat-uncle\nguardian\nhalf-brother\nhalf-sister\nhandler\nhousemate\ninformant\nlawyer\nlover\nmaternal-grandfather\nmaternal-grandmother\nmentee\nmentor\nmother-in-law\nneighbor\nneighbour\nnephew\nniece\nold-friend\nolder-brother\nolder-sister\npartner\npaternal-grandfather\npaternal-grandmother\npatient\nrival\nroommate\nschoolmate\nsister-in-law\nsolicitor\nson-in-law\nsource\nspouse\nstepbrother\nstepfather\nstepmother\nstepsister\nsubordinate\nsuperior\nteacher\nteammate\ntutor\ntwin-brother\ntwin-sister\nward\nyounger-brother\nyounger-sister\nyoungest-brother\nyoungest-sister".split("\\n")) if (x) DETECT_KINSHIP.add(x);
  for (const x of "administration-wing\nairfield\nairlock\nambulance-station\namphitheater\namphitheatre\nantechamber\napartment-block\narchive\narrival-hall\nassembly-hall\natrium\nauditorium\navenue\nbarracks\nbeach\nberth\nboiler-room\nborder-post\nboulevard\nbridge-deck\nbriefing-room\nbunker\nbus-station\ncabin\ncafeteria\ncampground\ncampsite\ncampus\ncanyon\ncargo-bay\ncargo-deck\ncarpark\ncatacomb\ncathedral\ncauseway\ncell-block\ncellar\ncemetery\nchamber\nchapel\ncheckpoint\ncinema\ncitadel\nclassroom\nclinic\ncoast\ncommand-center\ncommand-centre\ncommand-post\ncommunity-center\ncommunity-centre\ncompound\nconcourse\nconference-room\nconservatory\ncontainment-wing\ncontrol-center\ncontrol-centre\ncontrol-room\ncourtroom\ncrater\ncrypt\ndata-center\ndata-centre\ndeparture-hall\ndetention-center\ndetention-centre\ndining-room\ndocking-bay\ndockyard\ndormitory\neast-wing\nembassy\nemergency-room\nengine-room\nengineering-deck\nescape-pod-bay\nestate\nevidence-room\nexamination-room\nfarmhouse\nfire-station\nflight-deck\nfoyer\ngarage\ngarden\ngreat-hall\ngreenhouse\nguard-post\nhabitat-deck\nhangar-bay\nharbor\nharbour\nheadquarters\nhideout\nhighway\nhospice\nhospital-wing\nhostel\nhotel\nintersection\ninterview-room\nisland\njunction\nlaboratory\nlaboratory-wing\nlanding-pad\nlaunch-bay\nlecture-hall\nlighthouse\nliving-room\nlobby\nlocker-room\nlodge\nlower-deck\nmachine-room\nmall\nmansion\nmarina\nmarket\nmarketplace\nmedical-bay\nmedical-center\nmedical-centre\nmedical-wing\nmeeting-room\nmess-hall\nmetro-station\nmonastery\nmonitoring-station\nmotorway\nnorth-wing\nobservation-deck\nobservation-post\nobservatory\noffice-block\noperating-room\noperations-center\noperations-centre\norbital-station\noutpost\npassage\npenthouse\nplaza\npolice-station\npower-station\nprecinct\npromenade-deck\nquarry\nrail-station\nranger-station\nreactor-room\nrecords-room\nrefinery\nrelay-station\nresearch-center\nresearch-centre\nresearch-station\nresearch-wing\nresidence\nresidential-block\nresidential-wing\nridge\nrooftop\nsafehouse\nsanctuary\nschoolhouse\nseaport\nserver-room\nshelter\nshipyard\nshopping-center\nshopping-centre\nshrine\nshuttle-bay\nsituation-room\nsouth-wing\nspace-station\nsports-hall\nstairwell\nstorage-room\nstronghold\nstudio\nsubway\nterminal\ntheater\ntheatre\nthrone-room\ntower-block\ntownship\ntrading-post\ntraining-center\ntraining-centre\ntransit-hub\ntransport-hub\ntube-station\nuniversity\nupper-deck\nutility-room\nvault\nviaduct\nvisitor-center\nvisitor-centre\nwaiting-room\nwar-room\nweather-station\nwest-wing\nworkshop".split("\\n")) if (x) DETECTION_FORTRESS_EXTRA_WORLD_LOCATION.add(x);
  for (const x of "access-card\naccess-token\nadapter\naffidavit\nair-tank\namplifier\namulet\nantenna\nantidote\narchive-key\narmor\narmour\nartefact\nartifact\naxe\nbackpack\nbadge\nbandage\nbarrel\nbaton\nbattery\nbattery-pack\nbeacon\nbeam-emitter\nbelt\nbinoculars\nblack-box\nblueprint\nbook\nboots\nbottle\nbow\nbox\nbracelet\nbreather\nbriefcase\nbrooch\ncable\ncamera\ncamera-lens\ncandle\ncanister\ncanteen\ncapsule\ncarbine\ncartridge\ncase\ncase-file\ncash\ncertificate\nchain\ncharger\nclipboard\ncoat\ncodex\ncoin\ncollar\ncommunicator\ncompass\ncontainer\ncontainment-case\ncontainment-unit\ncontract\ncontrol-chip\ncontroller\ncrate\ncrossbow\ncrown\ncrutch\ncrystal\ncuffs\ncup\ndagger\ndata-drive\ndata-log\ndata-pad\ndatacard\ndefibrillator\ndetector\ndetonator\ndiagram\ndiary\ndisc\ndisk\ndocument-case\ndossier\ndrive\ndrone\ndrum\nduffel-bag\nearrings\nemitter\nenergy-cell\nenvelope\nequipment-case\nevidence-bag\nevidence-file\nfile\nflashlight\nflask\nflight-recorder\nfolder\nfork\nfuel-cell\ngauntlet\ngenerator\nglasses\ngloves\ngoggles\ngun-case\nhandbag\nhandbook\nhandcuffs\nhandset\nhard-drive\nharness\nheadset\nhelmet\nholster\nid-card\nidentity-card\ninjector\njacket\njar\njournal\nkey\nkeycard\nkeyfob\nkeyring\nknife\nlantern\nlaptop\nlaser-pointer\nledger\nletter\nlicence\nlicense\nlocator\nlock\nlockbox\nlocket\nlockpick\nmagazine\nmanual\nmap\nmedical-file\nmedicine\nmedkit\nmedpack\nmemory-stick\nmicrochip\nmicroscope\nmirror\nmodule\nmonitor\nmug\nnecklace\nnewspaper\nnotebook\noptical-sensor\norb\noxygen-tank\npackage\npager\nparcel\npass\npasscard\npendant\npermit\npersonnel-file\nphone\nphoto\nphotograph\npicklock\npill\npistol\nplate\npower-cell\npower-pack\nprintout\nprism\nprojector\npurse\nradio\nrecorder\nrecording\nrelic\nremote\nreport\nresearch-file\nrespirator\nrestraints\nrevolver\nrifle\nring\nrope\nsample\nsample-container\nscabbard\nscalpel\nscanner\nschematic\nscreen\nseal\nsecurity-card\nsensor\nserum\nsheath\nshield\nshotgun\nsmartcard\nsmartphone\nsmartwatch\nspear\nspecimen\nspecimen-container\nspectacles\nsplint\nspoon\nstaff\nstamp\nstethoscope\nstrongbox\nsubpoena\nsuitcase\nsword\nsyringe\ntablet\ntag\ntalisman\ntape\ntaser\ntelescope\nterminal-key\ntextbook\nthermos\ntiara\nticket\ntoken\ntoolbox\ntoolkit\ntorch\ntourniquet\ntracker\ntranscript\ntransmitter\ntransponder\ntray\ntube\nusb-drive\nvaccine\nvial\nvisitor-pass\nvisor\nwalkie-talkie\nwallet\nwand\nwarrant\nwatch\nwheelchair\nwire\nwrench\nwristband\nzip-ties".split("\\n")) if (x) DETECTION_FORTRESS_EXTRA_WORLD_ITEM.add(x);
  for (const x of "aeroplane\naircar\nairplane\nambulance\narmored-car\narmored-personnel-carrier\narmoured-car\narmoured-personnel-carrier\nautomobile\nbathyscaphe\nbicycle\nbomber-jet\nbuggy\nbus\ncab\ncanoe\ncargo-freighter\ncargo-plane\ncargo-ship\ncarriage\ncarrier\ncatamaran\ncoach\ncolony-ship\ncommand-truck\ncommand-vehicle\ncommand-vessel\ndelivery-van\ndinghy\ndrone-craft\ndropship\nevacuation-vehicle\nexploration-vessel\nferry\nfighter-jet\nfire-engine\nfiretruck\nforklift\ngeneration-ship\nglider\ngunship\nhelicopter\nhospital-ship\nhover-bike\nhoverbike\nhovercar\nhovercraft\ninterceptor\njeep\njet\nlanding-craft\nlanding-vehicle\nlifeboat\nlimousine\nlocomotive\nlorry\nmars-rover\nmetro-train\nminibus\nmobile-hospital\nmobile-lab\nmonorail\nmoon-rover\nmotorboat\nmotorcycle\norbital-shuttle\npanel-van\npassenger-liner\npassenger-plane\npatrol-car\npatrol-vessel\npersonnel-carrier\npickup\npickup-truck\npolice-car\nrailcar\nrescue-boat\nrescue-craft\nrescue-truck\nrescue-vehicle\nrescue-vessel\nresearch-vessel\nrover\nsailboat\nsedan\nsemi-truck\nskiff\nskycar\nspacecraft\nspeedboat\nspeeder-bike\nstarship\nsubmarine\nsubmersible\nsubway-train\nsurvey-vessel\ntanker\ntaxi\ntiltrotor\ntractor-trailer\ntrain\ntram\ntramcar\ntransport-plane\ntransport-ship\ntrolley\ntroop-carrier\ntruck\nutility-rover\nutility-truck\nvan\nwagon\nwarship\nyacht".split("\\n")) if (x) DETECTION_FORTRESS_EXTRA_WORLD_VEHICLE.add(x);
  for (const x of "academy\nadministration\nadvisory-board\nagency\nair-force\nalliance\nambulance-service\narmed-forces\narmy\nassembly\nassociation\nauthority\nbattalion\nboard\nbranch\nbrigade\nbureau\ncabinet\ncartel\ncell\ncenter\ncentre\nchambers\ncharity\nchurch\ncivil-service\nclub\ncoalition\ncollective\ncommand\ncommandery\ncommission\ncommittee\ncompany\nconfederation\ncongregation\ncongress\nconsortium\nconsultancy\nconvent\ncooperative\ncorporation\ncorps\ncouncil\ncouncil-of-state\ncourt\ncrew\ncrown-prosecution-service\ndefence\ndefense\ndepartment\ndirectorate\ndivision\nemergency-service\nengineering-division\nethics-board\nexecutive-board\nfederation\nfire-service\nfirm\nfleet\nfoundation\nfront\ngoverning-board\ngroup\nguild\nheadquarters\nhealth-service\nhospital\ninquiry\ninstitute\ninstitution\nintelligence-service\njudiciary\nlaboratory\nleague\nlegal-aid-service\nmarines\nmedical-division\nministry\nnavy\nnetwork\noffice\noffice-of-the-mayor\noffice-of-the-president\noperations-directorate\norder\norganisation\norganization\noversight-board\npanel\nparliament\npartnership\nparty\nplatoon\npolice\npolice-service\npowered-response-unit\npractice\nprecinct\nprogram\nprogramme\nproject\nprosecution\nprotective-operations\npublic-prosecution-service\nregiment\nrescue-team\nresearch-division\nresearch-group\nresearch-team\nresponse-team\nreview-board\nroyal-court\nsafety-board\nscience-division\nsecurity-service\nsecurity-team\nsenate\nservice\nservices\nshift\nsociety\nspace-force\nspecial-operations-unit\nsquad\nsquadron\nsteering-group\nstrategic-systems\nsyndicate\ntask-force\ntaskforce\nteam\ntribunal\ntrust\nunion\nunit\nuniversity\nwatch\nworking-group".split("\\n")) if (x) DETECTION_FORTRESS_EXTRA_WORLD_ORG.add(x);
  for (const x of "abduction\naccident\nacquittal\nactivation\nadoption\nambush\nanniversary\nanomaly\napology\nargument\narmistice\narrest\narrival\nassassination\nassault\nattack\naudit\nbattle\nbetrayal\nbirth\nbirthday\nblackout\nbreach\nbreakup\nbriefing\ncampaign\ncapture\ncase\ncatastrophe\nceasefire\nceremony\nchallenge\nclosure\ncollapse\ncollision\ncompetition\nconference\nconfession\nconfrontation\nconjunction\ncontact\ncontamination\nconviction\ncoronation\ncoup\ncrash\ncrisis\ncurfew\ncyclone\ndeath\ndebate\ndemonstration\ndeparture\ndeployment\nderailment\ndestruction\ndetonation\ndisappearance\ndisaster\ndiscovery\ndismissal\ndivorce\ndocking\ndrill\nduel\nearthquake\neclipse\nelection\nemergency\nengagement\nepidemic\neruption\nescape\nevacuation\nevent\nexecution\nexercise\nexpedition\nexperiment\nexplosion\nexposure\nfailure\nfestival\nfight\nfire\nfirst-contact\nflood\nfuneral\ngraduation\nhack\nhearing\nhurricane\nimpact\nimprisonment\ninauguration\nincident\nincursion\ninfection\ninquiry\ninspection\nintrusion\ninvasion\ninvestigation\njourney\nkidnapping\nkilling\nlanding\nlaunch\nleak\nliberation\nlockdown\nmalfunction\nmanifestation\nmarriage\nmassacre\nmeeting\nmemorial\nmeteor-impact\nmission\nmurder\nmutiny\nnegotiation\noccupation\nopening\noperation\noutage\noutbreak\npandemic\nparade\npatrol\npromotion\nprotest\nquake\nquarantine\nraid\nrebellion\nrebuilding\nreconciliation\nreferendum\nrelease\nreopening\nrepair\nrescue\nresignation\nrestart\nrestoration\nresurrection\nretirement\nreturn\nrevelation\nreview\nrevival\nrevolution\nriot\nsabotage\nscandal\nsentencing\nseparation\nservice\nshutdown\nsiege\nskirmish\nsolar-flare\nstorm\nstrike\nsummit\nsurrender\ntest\ntornado\ntournament\ntransit\ntreaty\ntrial\ntsunami\nundocking\nuprising\nvote\nvoyage\nwar\nwedding\nwildfire\nwreck".split("\\n")) if (x) DETECTION_FORTRESS_EXTRA_WORLD_EVENT.add(x);

  function isFortressMetaPhrase(value) {
    const n = safeText(value).toLowerCase().replace(/\s+/g, " ").trim();
    const bits = n.split(" ");
    return bits.length === 2 &&
      DETECTION_FORTRESS_META_PREFIXES.has(bits[0]) &&
      DETECTION_FORTRESS_META_SUFFIXES.has(bits[1]);
  }

  const PRESENCE_VERBS = [
    "say","says","said","ask","asks","asked","reply","replies","replied","whisper","whispers","whispered",
    "shout","shouts","shouted","yell","yells","yelled","nod","nods","nodded","smile","smiles","smiled",
    "frown","frowns","frowned","laugh","laughs","laughed","cry","cries","cried","look","looks","looked",
    "watch","watches","watched","stare","stares","stared","turn","turns","turned","walk","walks","walked",
    "step","steps","stepped","move","moves","moved","sit","sits","sat","stand","stands","stood","lean","leans","leaned",
    "reach","reaches","reached","take","takes","took","give","gives","gave","grab","grabs","grabbed","touch","touches","touched",
    "kiss","kisses","kissed","hug","hugs","hugged","hit","hits","attack","attacks","attacked","follow","follows","followed",
    "enter","enters","entered","arrive","arrives","arrived","appear","appears","appeared","join","joins","joined",
    "answer","answers","answered","speak","speaks","spoke","breathe","breathes","breathed","shrug","shrugs","shrugged",
    "wince","winces","winced","glance","glances","glanced","gesture","gestures","gestured","point","points","pointed",
    "hear","hears","heard","listen","listens","listened","wait","waits","waited"
  ];

  const EXIT_VERBS = [
    "leave", "leaves", "left", "exit", "exits", "exited", "depart", "departs", "departed",
    "walk away", "walks away", "walked away", "run away", "runs away", "ran away",
    "drive away", "drives away", "drove away", "hang up", "hangs up", "hung up",
    "teleport away", "teleports away", "teleported away", "disappear", "disappears", "disappeared",
    "go home", "goes home", "went home", "head home", "heads home", "headed home"
  ];

  const DETECT_NAME_PARTICLES = new Set("de de la del della di da dos das du la le van von der den ter ten al bin ibn ap ben".split(" "));
  const DETECT_SPEAKER_BLOCK = new Set("chapter scene episode act part prologue epilogue title note notes author system user assistant narrator prompt input output context memory recap summary update updates details comments date time location setting".split(" "));
  const DETECT_META_WORDS = new Set("chapter scene episode act part prologue epilogue title note notes author system user assistant narrator prompt input output context memory recap summary update updates details comments setting settings config configuration option options status report reports log logs debug window interface menu button tab panel field fields token tokens model ai script scripts command commands".split(" "));
  const DETECT_NAME_TOKEN = "(?:[A-ZÀ-ÖØ-ÞĀ-Ž][A-Za-zÀ-ÖØ-öø-ÿĀ-ſ'\\-]{1,24}|[A-Z]\\.)";
  const DETECT_NAME_PARTICLE_ALT = "(?:de\\s+la|de|del|della|di|da|dos|das|du|la|le|van|von|der|den|ter|ten|al|bin|ibn|ap|ben)";
  const DETECT_PROPER_PATTERN = "(" + DETECT_NAME_TOKEN + "(?:\\s+(?:(?:" + DETECT_NAME_PARTICLE_ALT + ")\\s+)?" + DETECT_NAME_TOKEN + "){0,3})";
  const DETECT_PRESENCE_ALT = PRESENCE_VERBS.map(escapeRe).join("|");
  const DETECT_KIN_ALT = Array.from(DETECT_KINSHIP).map(escapeRe).sort((a,b)=>b.length-a.length).join("|");
  const DETECT_ROLE_ALT = Array.from(DETECT_PERSON_ROLES).filter(x => x.length > 1).map(escapeRe).sort((a,b)=>b.length-a.length).join("|");
  const DETECT_HUMAN_ALT = Array.from(DETECT_HUMAN_CONTEXT).map(escapeRe).sort((a,b)=>b.length-a.length).join("|");
  const EXIT_ALT = EXIT_VERBS.map(escapeRe).sort((a,b)=>b.length-a.length).join("|");

  function detectionCharRegexes() {
    if (DETECTION_CHAR_REGEX_CACHE) return DETECTION_CHAR_REGEX_CACHE;
    const proper = DETECT_PROPER_PATTERN, verbs = DETECT_PRESENCE_ALT;
    DETECTION_CHAR_REGEX_CACHE = {
      actor: new RegExp("\\b" + proper + "\\s+(" + verbs + ")\\b", "g"),
      afterQuote: new RegExp("[.!?][”\\\"]?\\s*,?\\s*" + proper + "\\s+(?:says|asks|replies|whispers|shouts|yells|answers|murmurs|mutters)\\b", "g"),
      reverseDialogue: new RegExp("\\b(?:said|asked|replied|whispered|shouted|yelled|answered|murmured|muttered|called)\\s+" + proper + "\\b", "gi"),
      speakerLabel: new RegExp("(?:^|[\\r\\n])\\s*" + proper + "\\s*:\\s*(?=[\\\"“'A-Za-zÀ-ÖØ-öø-ÿĀ-ſ])", "g"),
      introPatterns: [
        new RegExp("\\b(?:this is|meet|introducing|introduced as|known as|called|named)\\s+" + proper + "\\b", "gi"),
        new RegExp("\\b(?:my name is|I am|I'm)\\s+" + proper + "\\b", "g"),
        new RegExp("\\b(?:name is|real name is|goes by)\\s+" + proper + "\\b", "gi")
      ],
      relation: new RegExp("\\b(?:my|your|his|her|their|our|the)\\s+(?:" + DETECT_KIN_ALT + ")\\s+" + proper + "\\b", "gi"),
      appositive: new RegExp("\\b" + proper + "\\s*,\\s*(?:my|your|his|her|their|our|the)\\s+(?:(?:" + DETECT_KIN_ALT + ")|(?:" + DETECT_ROLE_ALT + "))\\s*,", "gi"),
      copular: new RegExp("\\b" + proper + "\\s+(?:is|was|remains)\\s+(?:my|your|his|her|their|our|the|an?|one of the)\\s+(?:(?:" + DETECT_KIN_ALT + ")|(?:" + DETECT_ROLE_ALT + "))\\b", "gi"),
      titled: new RegExp("\\b(?:" + DETECT_ROLE_ALT + ")\\.?\\s+" + proper + "\\b", "gi"),
      vocative: new RegExp("(?:^|[\\n.!?\\\"“”])\\s*" + proper + "\\s*[,—-]\\s*(?:please\\s+)?(?:wait|listen|look|stop|come|go|help|tell|answer|stay|run|move|wake|sit|stand|hey)\\b", "g"),
      possessive: new RegExp("\\b" + proper + "['’]s\\s+(?:" + DETECT_HUMAN_ALT + ")\\b", "g"),
      recipient: new RegExp("\\b(?:tell|tells|told|ask|asks|asked|call|calls|called|phone|phones|phoned|text|texts|texted|hug|hugs|hugged|kiss|kisses|kissed|meet|meets|met|follow|follows|followed|help|helps|helped|thank|thanks|thanked)\\s+(?:to\\s+)?" + proper + "\\b", "gi"),
      signature: new RegExp("\\b(?:signed|signature(?: reads| says)?|from|written by|authored by)\\s+" + proper + "\\b", "gi"),
      generic: new RegExp("\\b" + proper + "\\b", "g")
    };
    return DETECTION_CHAR_REGEX_CACHE;
  }
  function resetGlobalRegex(re) { if (re && re.global) re.lastIndex = 0; return re; }

  const IMPORTANCE_PATTERNS = [
    [5, /\b(dies|died|dead|death|killed|murdered|funeral|resurrected|revived)\b/i],
    [5, /\b(married|wedding|divorced|pregnant|pregnancy|born|gave birth|adopted)\b/i],
    [5, /\b(secret|classified|password|passphrase|access code|launch code|override code|security code|confess(?:ed|ion)?|reveal(?:ed)?|identity|real name|truth is|betray(?:ed|al)?)\b/i],
    [5, /\b(promise(?:s|d)?|swear(?:s)?|swore|vow(?:s|ed)?|oath|deal|agreement|owe(?:s|d)?|debt)\b/i],
    [5, /\b(worldship|planet[- ]sized (?:ship|vessel|construct)|invasion|first contact|hidden (?:alien |monitoring )?(?:ship|vessel)|secretly monitor(?:s|ed|ing)?|destination (?:is|was) earth|headed? (?:for|toward|towards) earth|hostile (?:fleet|ship|vessel|civilization|civilisation|species))\b/i],
    [4, /\b(love(?:s|d)?|hate(?:s|d)?|kiss(?:ed|es)?|break up|broke up|dating|partner|girlfriend|boyfriend|wife|husband|spouse|engaged|engagement)\b/i],
    [4, /\b(mother|father|mom|mum|dad|sister|brother|aunt|uncle|cousin|grandmother|grandfather|daughter|son|family)\b/i],
    [4, /\b(weakness|allergy|diagnosed|lost (?:his|her|their|a|the)? ?(?:power|ability)|gained (?:a|the)? ?(?:power|ability)|developed (?:a|the)? ?(?:power|ability)|power awakened|ability awakened)\b/i],
    [3, /\b(power|ability|condition|scar|injury|injured|wounded|hospital|relationship)\b/i],
    [4, /\b(discovered|found out|realized|remembered|forgot|recognizes|recognized|learned that)\b/i],
    [3, /\b(gave|gift|keepsake|ring|letter|photo|photograph|key|weapon|artifact|stole|stolen|lost|found)\b/i],
    [3, /\b(home|lives at|moved|address|work(?:s|ed)? at|job|school|university|birthday|age|years old)\b/i],
    [3, /\b(boundary|never do|do not|don't|won't|refuse(?:d)?|forbid(?:den)?|consent|safe word)\b/i],
    [2, /\b(argue(?:d)?|fight|fought|apolog(?:y|ize|ized)|forgive|forgave|trust|lied|lie|saved|rescued|helped)\b/i]
  ];

  function makeFreshRoot() {
    return {
      schema: SCHEMA_REVISION,
      seq: 0,
      hot: [],
      cold: [],
      anchors: [],
      ledger: [],
      liveFacts: [],
      insights: [],
      world: { entities: {}, candidates: {}, facts: [], timeline: [], clock: { hours: 0, baseEpochHours: null, currentDateLabel: "", currentTimeLabel: "", knownElapsed: false, partial: false } },
      chars: {},
      candidates: {},
      scene: {},
      manualFocus: [],
      playerNames: [],
      ambiguousFirstNames: [],
      runtime: { lastMaxChars: 0, recallRev: 0, recallPayloadSig: "", recallCacheKey: "", recallCacheBlock: "", storyCardSig: "", storyCardQuickSig: "", storyCardScanTurn: -1, storyCardCount: -1, worldCardQuickSig: "", worldCardScanTurn: -1, worldCardCount: -1, currentCardSeedSig: "", currentCardSeedQuickSig: "", currentCardSeeds: [], currentCardSeedScanTurn: -1, currentCardSeedCardCount: -1, bootstrapDone: false, bootstrapImported: 0, bootstrapPending: false, bootstrapTargetCount: 0, bootstrapSeen: [], activationAnnounced: false, lastWorldEntities: [], liveCardId: "", liveSyncTurn: -1, liveSyncSig: "", identityRepairDone: false, pendingCommand: null, lastMessage: "", cardPersistence: "unknown", cardWriteFailures: 0, cardRetryTurn: 0, cardExpected: null, configNotesPersistence: "unknown", needsSchema16CardCleanup: false, managedCardCleanupIndex: 0, managedCardImportDone: false, needsSchema17InsightMigration: false, insightMigrationDone: false, insightSyncSig: "", needsSchema18CardCleanup: false, liveDashboardRemoved: false, needsSchema20CardCleanup: false, schema20CleanupIndex: 0, schema20RescanDone: true, profileDeltaSig: "", profileDeltaImportDone: false, legacyManagedQuarantineDone: false, characterNotesPersistence: "unknown", characterNotesRetryTurn: 0, characterNoteExpected: null, largeCardPhase: 0, largeCardCycles: 0, largeCardLastCount: -1 },
      last: { turn: 0, inputHash: "", outputHash: "", inputTurn: -1, outputTurn: -1, recallSig: "" },
      stats: { stored: 0, retries: 0, undos: 0, recalls: 0, promoted: 0, coldMoved: 0, migrations: 0, retryPurges: 0, suppressedRepeats: 0, mergedSegments: 0, detectorObserved: 0, detectorRejected: 0, detectorPruned: 0, worldCandidateObserved: 0, worldCandidatePromoted: 0, worldCandidateRejected: 0, worldCandidatePruned: 0, worldTypeConflicts: 0, stateFacts: 0, stateReplacements: 0, statePruned: 0, worldEntities: 0, worldFacts: 0, worldEvents: 0, timeJumps: 0, worldPruned: 0, liveFacts: 0, cardNoteWrites: 0, cardEntryWrites: 0, liveCardWrites: 0, liveRecallInjects: 0, commandTurns: 0, cardWriteFailures: 0, contextTrimAvoided: 0, outputPassThrough: 0, outputModified: 0, identityRepairs: 0, sceneResets: 0, bootstrapLiveFacts: 0, characterInsights: 0, characterInsightNotes: 0, characterInsightRecalls: 0, characterInsightMigrations: 0, characterInsightSupersessions: 0, characterProfileWrites: 0, characterCardSelectionRepairs: 0, schema20CardCleanups: 0, schema20RescanFacts: 0, schema20RescanInsights: 0, profileDeltaImports: 0, legacyManagedQuarantined: 0, legacyManagedPurges: 0, liveDashboardRemovals: 0, currentCardSeedScans: 0, currentCardSeedRecalls: 0, liveFactSupersessions: 0, contextRecallAppends: 0, addonSafeRuns: 0, bootstrapBatches: 0 },
      debug: !!EIDETIC_CONFIG.DEBUG,
    };
  }

  function migrateRoot(old) {
    const r = old && typeof old === "object" ? old : makeFreshRoot();
    if (!Array.isArray(r.hot)) r.hot = [];
    if (!Array.isArray(r.cold)) r.cold = [];
    if (!Array.isArray(r.anchors)) r.anchors = [];
    if (!Array.isArray(r.ledger)) r.ledger = [];
    if (!r.world || typeof r.world !== "object") r.world = { entities:{}, facts:[], timeline:[], clock:{ hours:0, baseEpochHours:null, currentDateLabel:"", currentTimeLabel:"", knownElapsed:false, partial:false } };
    if (!r.world.entities || typeof r.world.entities !== "object") r.world.entities = {};
    if (!r.world.candidates || typeof r.world.candidates !== "object") r.world.candidates = {};
    if (!Array.isArray(r.world.facts)) r.world.facts = [];
    if (!Array.isArray(r.world.timeline)) r.world.timeline = [];
    if (!r.world.clock || typeof r.world.clock !== "object") r.world.clock = { hours:0, baseEpochHours:null, currentDateLabel:"", currentTimeLabel:"", knownElapsed:false, partial:false };
    if (!Number.isFinite(r.world.clock.hours)) r.world.clock.hours = 0;
    if (!(Number.isFinite(r.world.clock.baseEpochHours) || r.world.clock.baseEpochHours === null)) r.world.clock.baseEpochHours = null;
    if (typeof r.world.clock.currentDateLabel !== "string") r.world.clock.currentDateLabel = "";
    if (typeof r.world.clock.currentTimeLabel !== "string") r.world.clock.currentTimeLabel = "";
    if (typeof r.world.clock.knownElapsed !== "boolean") r.world.clock.knownElapsed = false;
    if (typeof r.world.clock.partial !== "boolean") r.world.clock.partial = false;
    if (!r.chars || typeof r.chars !== "object") r.chars = {};
    if (!r.candidates || typeof r.candidates !== "object") r.candidates = {};
    if (!r.scene || typeof r.scene !== "object") r.scene = {};
    if (!Array.isArray(r.manualFocus)) r.manualFocus = [];
    if (!Array.isArray(r.playerNames)) r.playerNames = [];
    if (!Array.isArray(r.ambiguousFirstNames)) r.ambiguousFirstNames = [];
    if (!r.runtime || typeof r.runtime !== "object") r.runtime = {};
    if (!Number.isFinite(r.runtime.lastMaxChars)) r.runtime.lastMaxChars = 0;
    if (!Number.isFinite(r.runtime.recallRev)) r.runtime.recallRev = 0;
    if (typeof r.runtime.recallPayloadSig !== "string") r.runtime.recallPayloadSig = "";
    if (typeof r.runtime.recallCacheKey !== "string") r.runtime.recallCacheKey = "";
    if (typeof r.runtime.recallCacheBlock !== "string") r.runtime.recallCacheBlock = "";
    if (typeof r.runtime.storyCardSig !== "string") r.runtime.storyCardSig = "";
    if (typeof r.runtime.storyCardQuickSig !== "string") r.runtime.storyCardQuickSig = "";
    if (typeof r.runtime.worldCardQuickSig !== "string") r.runtime.worldCardQuickSig = "";
    if (!Number.isFinite(r.runtime.storyCardScanTurn)) r.runtime.storyCardScanTurn = -1;
    if (!Number.isFinite(r.runtime.storyCardCount)) r.runtime.storyCardCount = -1;
    if (!Number.isFinite(r.runtime.worldCardScanTurn)) r.runtime.worldCardScanTurn = -1;
    if (!Number.isFinite(r.runtime.worldCardCount)) r.runtime.worldCardCount = -1;
    if (typeof r.runtime.configGuideSig !== "string") r.runtime.configGuideSig = "";
    if (typeof r.runtime.configCardMode !== "string") r.runtime.configCardMode = "";
    if (typeof r.runtime.configProbePending !== "boolean") r.runtime.configProbePending = false;
    if (typeof r.runtime.configCardWarned !== "boolean") r.runtime.configCardWarned = false;
    if (typeof r.runtime.configNotesPersistence !== "string") r.runtime.configNotesPersistence = "unknown";
    if (typeof r.runtime.needsSchema16CardCleanup !== "boolean") r.runtime.needsSchema16CardCleanup = false;
    if (!Number.isFinite(r.runtime.managedCardCleanupIndex)) r.runtime.managedCardCleanupIndex = 0;
    if (typeof r.runtime.managedCardImportDone !== "boolean") r.runtime.managedCardImportDone = false;
    if (typeof r.runtime.needsSchema17InsightMigration !== "boolean") r.runtime.needsSchema17InsightMigration = false;
    if (typeof r.runtime.insightMigrationDone !== "boolean") r.runtime.insightMigrationDone = false;
    if (typeof r.runtime.insightSyncSig !== "string") r.runtime.insightSyncSig = "";
    if (typeof r.runtime.currentCardSeedSig !== "string") r.runtime.currentCardSeedSig = "";
    if (typeof r.runtime.currentCardSeedQuickSig !== "string") r.runtime.currentCardSeedQuickSig = "";
    if (!Array.isArray(r.runtime.currentCardSeeds)) r.runtime.currentCardSeeds = [];
    if (!Number.isFinite(r.runtime.currentCardSeedScanTurn)) r.runtime.currentCardSeedScanTurn = -1;
    if (!Number.isFinite(r.runtime.currentCardSeedCardCount)) r.runtime.currentCardSeedCardCount = -1;
    if (typeof r.runtime.needsSchema18CardCleanup !== "boolean") r.runtime.needsSchema18CardCleanup = false;
    if (typeof r.runtime.needsSchema20CardCleanup !== "boolean") r.runtime.needsSchema20CardCleanup = false;
    if (!Number.isFinite(r.runtime.schema20CleanupIndex)) r.runtime.schema20CleanupIndex = 0;
    if (typeof r.runtime.profileDeltaSig !== "string") r.runtime.profileDeltaSig = "";
    if (typeof r.runtime.profileDeltaImportDone !== "boolean") r.runtime.profileDeltaImportDone = false;
    if (typeof r.runtime.legacyManagedQuarantineDone !== "boolean") r.runtime.legacyManagedQuarantineDone = false;
    if (typeof r.runtime.schema20RescanDone !== "boolean") r.runtime.schema20RescanDone = true;
    if (typeof r.runtime.liveDashboardRemoved !== "boolean") r.runtime.liveDashboardRemoved = false;
    if (typeof r.runtime.characterNotesPersistence !== "string") r.runtime.characterNotesPersistence = "unknown";
    if (!Number.isFinite(r.runtime.characterNotesRetryTurn)) r.runtime.characterNotesRetryTurn = 0;
    if (!("characterNoteExpected" in r.runtime)) r.runtime.characterNoteExpected = null;
    if (!(typeof r.runtime.configCardId === "number" || typeof r.runtime.configCardId === "string")) r.runtime.configCardId = "";
    if (typeof r.runtime.bootstrapDone !== "boolean") r.runtime.bootstrapDone = !!((r.hot && r.hot.length) || (r.cold && r.cold.length) || (r.anchors && r.anchors.length) || (r.ledger && r.ledger.length));
    if (!Number.isFinite(r.runtime.bootstrapImported)) r.runtime.bootstrapImported = 0;
    if (typeof r.runtime.bootstrapPending !== "boolean") r.runtime.bootstrapPending = false;
    if (!Number.isFinite(r.runtime.bootstrapTargetCount)) r.runtime.bootstrapTargetCount = 0;
    if (!Array.isArray(r.runtime.bootstrapSeen)) r.runtime.bootstrapSeen = [];
    if (typeof r.runtime.contextRecallBlock !== "string") r.runtime.contextRecallBlock = "";
    if (!Number.isFinite(r.runtime.contextRecallTurn)) r.runtime.contextRecallTurn = -1;
    if (!Number.isFinite(r.runtime.contextRecallSeq)) r.runtime.contextRecallSeq = -1;
    if (typeof r.runtime.activationAnnounced !== "boolean") r.runtime.activationAnnounced = !!r.runtime.bootstrapDone;
    if (!Array.isArray(r.runtime.lastWorldEntities)) r.runtime.lastWorldEntities = [];
    if (!(typeof r.runtime.liveCardId === "number" || typeof r.runtime.liveCardId === "string")) r.runtime.liveCardId = "";
    if (!Number.isFinite(r.runtime.liveSyncTurn)) r.runtime.liveSyncTurn = -1;
    if (typeof r.runtime.liveSyncSig !== "string") r.runtime.liveSyncSig = "";
    if (typeof r.runtime.identityRepairDone !== "boolean") r.runtime.identityRepairDone = false;
    if (!("pendingCommand" in r.runtime)) r.runtime.pendingCommand = null;
    if (typeof r.runtime.lastMessage !== "string") r.runtime.lastMessage = "";
    if (!r.runtime.cardPersistence) r.runtime.cardPersistence = "unknown";
    if (!Number.isFinite(r.runtime.cardWriteFailures)) r.runtime.cardWriteFailures = 0;
    if (!Number.isFinite(r.runtime.cardRetryTurn)) r.runtime.cardRetryTurn = 0;
    if (typeof r.runtime.migrateOutputSpacingToPreserve !== "boolean") r.runtime.migrateOutputSpacingToPreserve = false;
    if (!Array.isArray(r.liveFacts)) r.liveFacts = [];
    if (!Array.isArray(r.insights)) r.insights = [];
    if (!r.stats || typeof r.stats !== "object") r.stats = {};
    if (!r.last || typeof r.last !== "object") r.last = {};
    if (!Number.isFinite(r.last.inputTurn)) r.last.inputTurn = -1;
    if (!Number.isFinite(r.last.outputTurn)) r.last.outputTurn = -1;
    const previousSchema = Number(r.schema) || 0;
    const needsSchemaMigration = previousSchema < SCHEMA_REVISION;
    if (previousSchema > 0 && previousSchema < 12) r.runtime.migrateDetectionDefaultToBalanced = true;
    if (previousSchema > 0 && previousSchema < 15) r.runtime.migrateOutputSpacingToPreserve = true;
    if (previousSchema > 0 && previousSchema < 16) {
      r.runtime.needsSchema16CardCleanup = true;
      r.runtime.managedCardCleanupIndex = 0;
    }
    if (previousSchema > 0 && previousSchema < 17) {
      r.runtime.needsSchema17InsightMigration = true;
      r.runtime.insightMigrationDone = false;
      r.runtime.insightSyncSig = "";
    }
    if (previousSchema > 0 && previousSchema < 18) {
      r.runtime.needsSchema18CardCleanup = true;
      r.runtime.liveDashboardRemoved = false;
      r.runtime.currentCardSeedSig = "";
      r.runtime.currentCardSeedQuickSig = "";
      r.runtime.storyCardQuickSig = "";
      r.runtime.worldCardQuickSig = "";
      r.runtime.currentCardSeeds = [];
      r.runtime.currentCardSeedScanTurn = -1;
      r.runtime.currentCardSeedCardCount = -1;
      r.runtime.storyCardScanTurn = -1;
      r.runtime.storyCardCount = -1;
      r.runtime.worldCardScanTurn = -1;
      r.runtime.worldCardCount = -1;
      r.runtime.liveSyncSig = "";
      // Re-score legacy live facts with Schema 18 durability rules so old stance/dialogue
      // noise cannot survive forever merely because an earlier schema stored it.
      r.liveFacts=(r.liveFacts||[]).filter(f=>{
        if(!f)return false;
        try{delete f.cardScore16;delete f.cardScore18;delete f.priority18;}catch(_){}
        f.facet=liveFactFacet(f); f.priority18=liveFactPriority(f);
        return liveFactCardEligible(f);
      });
      // Collapse legacy duplicate destination/course lines into the newest confirmed state.
      let latestCourse=null;
      for(let li=0;li<r.liveFacts.length;li++){
        const f=r.liveFacts[li]; if(!f||f.superseded||liveFactFacet(f)!=="mission-course")continue;
        if(latestCourse&&latestCourse!==f){latestCourse.superseded=true;latestCourse.supersededBy=f.id||"schema18-migration";r.stats.liveFactSupersessions=Number(r.stats.liveFactSupersessions||0)+1;}
        latestCourse=f;
      }
    }
    if (previousSchema > 0 && previousSchema < 20) {
      // Schema 20 removes legacy per-turn character Entry clutter, invalidates automatic
      // scenario-baseline seeds, and rebuilds important-character mirrors with stricter rules.
      r.runtime.needsSchema20CardCleanup = true;
      r.runtime.schema20CleanupIndex = 0;
      r.runtime.currentCardSeeds = [];
      r.runtime.currentCardSeedSig = "";
      r.runtime.currentCardSeedQuickSig = "";
      r.runtime.currentCardSeedScanTurn = -1;
      r.runtime.currentCardSeedCardCount = -1;
      r.runtime.insightSyncSig = "";
      r.runtime.profileDeltaSig = "";
      r.runtime.schema20RescanDone = false;
      r.runtime.storyCardSig = "";
      r.runtime.storyCardQuickSig = "";
      r.runtime.storyCardScanTurn = -1;
      r.runtime.characterNotesPersistence = "unknown";
      // Re-score retained insights so legacy gestures / incidental logistics are never
      // mirrored merely because an older schema accepted them. Historical archive remains.
      for (let ii=0; ii<(r.insights||[]).length; ii++) {
        const ix=r.insights[ii]; if(!ix)continue;
        if (insightNoise(ix.text, ix.category, ix.speaker, Number(ix.score)||0)) ix.mirrorSuppressed=true;
      }
    }
    if (previousSchema > 0 && previousSchema < 21) {
      // Schema 23 retains the Schema 21 quarantine for retired Story Card mirrors. Schema 16/18 LIVE CONTINUITY
      // and early IMPORTANT CHARACTER CONTINUITY blocks were display mirrors, not a
      // trustworthy portable database. Importing them back into a fresh/current story can
      // resurrect stale seasons or old misclassifications. Portable continuity now comes
      // only from the bounded Schema 20+ PROFILE DELTA block plus recent played history.
      const beforeFacts=(r.liveFacts||[]).length, beforeInsights=(r.insights||[]).length;
      r.liveFacts=(r.liveFacts||[]).filter(f=>!(f&&(safeText(f.src)==="story-card-managed-import"||safeText(f.origin)==="card-import")));
      r.insights=(r.insights||[]).filter(x=>!(x&&/^story-card-insight-import(?::|$)/.test(safeText(x.src))));
      r.stats.legacyManagedPurges=Number(r.stats.legacyManagedPurges||0)+(beforeFacts-r.liveFacts.length)+(beforeInsights-r.insights.length);
      r.runtime.managedCardImportDone=false;
      r.runtime.managedInsightImportDone=false;
      r.runtime.profileDeltaImportDone=false;
      r.runtime.legacyManagedQuarantineDone=false;
      r.runtime.needsSchema16CardCleanup=true;
      r.runtime.managedCardCleanupIndex=0;
      r.runtime.needsSchema20CardCleanup=true;
      r.runtime.schema20CleanupIndex=0;
      // Rebuild current facts from bounded recent played history after purging stale mirrors.
      r.runtime.schema20RescanDone=false;
      r.runtime.insightSyncSig=""; r.runtime.liveSyncSig=""; r.runtime.profileDeltaSig="";
      r.runtime.recallCacheKey=""; r.runtime.recallCacheBlock="";
    }
    const needsColdPacking = r.cold.some(x => x && !Array.isArray(x));
    if (needsSchemaMigration || needsColdPacking || Object.prototype.hasOwnProperty.call(r, "v")) {
      r.stats.migrations = (r.stats.migrations || 0) + 1;
      r.cold = r.cold.map(packCold).filter(Boolean);
    }
    if (needsSchemaMigration) sanitizePersistedDetectionState(r);
    if (previousSchema > 0 && previousSchema < 13) {
      repairLegacyIdentityAliases(r);
      r.scene = {};
      r.runtime.storyCardSig = "";
      r.runtime.worldCardSig = "";
      r.runtime.identityRepairDone = true;
    }
    if (Object.prototype.hasOwnProperty.call(r, "v")) delete r.v;
    r.schema = SCHEMA_REVISION;
    r.debug = typeof r.debug === "boolean" ? r.debug : !!EIDETIC_CONFIG.DEBUG;
    return r;
  }

  function root() {
    if (typeof state === "undefined") return null;
    if (ROOT_CACHE_STATE === state && ROOT_CACHE_VALUE && state[ROOT] === ROOT_CACHE_VALUE) return ROOT_CACHE_VALUE;
    let r = state[ROOT];
    if (!r || typeof r !== "object") r = makeFreshRoot();
    r = migrateRoot(r);
    state[ROOT] = r;
    ROOT_CACHE_STATE = state;
    ROOT_CACHE_VALUE = r;
    return r;
  }

  function currentTurn() {
    if (Number.isFinite(TURN_OVERRIDE)) return Math.max(0, TURN_OVERRIDE);
    if (typeof info !== "undefined" && info && Number.isFinite(info.actionCount)) return Math.max(0, info.actionCount);
    const r = root();
    return r && r.last && Number.isFinite(r.last.turn) ? r.last.turn : 0;
  }

  function safeText(v) {
    return v == null ? "" : String(v);
  }

  function isPackedRecord(e) { return Array.isArray(e); }
  function recId(e) { return isPackedRecord(e) ? e[0] : e && e.id; }
  function recTurn(e) { return Number(isPackedRecord(e) ? e[1] : e && e.turn) || 0; }
  function recKind(e) { return isPackedRecord(e) ? e[2] : e && e.kind; }
  function recText(e) { return safeText(isPackedRecord(e) ? e[3] : e && e.text); }
  function recOwners(e) { const v = isPackedRecord(e) ? e[4] : e && e.owners; return Array.isArray(v) ? v : []; }
  function recNames(e) { const v = isPackedRecord(e) ? e[5] : e && e.names; return Array.isArray(v) ? v : []; }
  function recSubjects(e) { const v = isPackedRecord(e) ? e[6] : e && e.subjects; return Array.isArray(v) ? v : []; }
  function recKeywords(e) { return safeText(isPackedRecord(e) ? e[7] : e && e.k); }
  function recImportance(e) { return Number(isPackedRecord(e) ? e[8] : e && e.imp) || 1; }
  function recMode(e) { return safeText(isPackedRecord(e) ? e[9] : e && e.mode) || "event"; }
  function recSource(e) { return safeText(isPackedRecord(e) ? e[10] : e && e.src); }
  function recManual(e) { return !!(!isPackedRecord(e) && e && e.manual); }
  function recOrigin(e) { return safeText(isPackedRecord(e) ? e[11] : e && e.origin) || "legacy"; }
  function packCold(e) {
    if (!e) return null;
    if (isPackedRecord(e)) return e;
    return [recId(e), recTurn(e), recKind(e), recText(e), recOwners(e), recNames(e), recSubjects(e), recKeywords(e), recImportance(e), recMode(e), recSource(e), recOrigin(e)];
  }

  function cleanText(s) {
    return safeText(s)
      .replace(/\r/g, "")
      .replace(/[\u0000\u200B-\u200D\uFEFF]/g, "")
      .replace(/\u00A0/g, " ")
      .replace(/\[\[EIDETIC_RECALL[\s\S]*?\[\[\/EIDETIC_RECALL\]\]/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function displayText(s, max) {
    s = cleanText(s).replace(/^>\s*You\s*(?:say\s*)?/i, "").trim();
    max = Math.max(8, Number(max) || 8);
    if (s.length <= max) return s;
    let cut = s.slice(0, Math.max(0, max - 1)).trimEnd();
    const lastSpace = cut.lastIndexOf(" ");
    if (lastSpace >= Math.floor(max * 0.72)) cut = cut.slice(0, lastSpace).trimEnd();
    return cut + "…";
  }

  function hash(s) {
    s = safeText(s);
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(36);
  }

  function playerNameSet() {
    const r = root();
    const set = new Set();
    if (r && Array.isArray(r.playerNames)) for (let i = 0; i < r.playerNames.length; i++) set.add(normName(r.playerNames[i]));
    if (typeof info !== "undefined" && info && Array.isArray(info.characterNames)) {
      for (let i = 0; i < info.characterNames.length; i++) set.add(normName(info.characterNames[i]));
    }
    return set;
  }

  function isPlayerName(name) {
    const n = normName(name);
    if (!n) return false;
    const set = playerNameSet();
    if (set.has(n)) return true;
    const first = n.split(" ")[0];
    let firstMatches = 0;
    set.forEach(x => { if (x.split(" ")[0] === first) firstMatches++; });
    return n.indexOf(" ") < 0 && firstMatches === 1;
  }

  function epistemicMode(text, kind) {
    const t = cleanText(text);
    if (!t) return "event";
    if (/\?\s*$/.test(t) || /^\s*(?:who|what|when|where|why|how|did|does|is|are|was|were|can|could|would|will)\b/i.test(t)) return "question";
    if (/\b(?:thinks?|thought|wonders?|believes?|suspects?|imagines?|dreams?|hopes?|fears?|assumes?)\b/i.test(t)) return "belief";
    if (/\b(?:rumou?r|alleged(?:ly)?|apparently|reportedly|presumed|supposedly|maybe|perhaps|possibly|might|could have|seems?|appears to)\b/i.test(t)) return "uncertain";
    if (/\b(?:says?|said|tells?|told|claims?|claimed|reports?|reported|insists?|insisted|accuses?|accused|according to)\b/i.test(t) || /[“"][^”"]{2,}[”"]/.test(t)) return "claim";
    return kind === "input" ? "player-event" : "event";
  }

  function semanticTags(text) {
    const t = cleanText(text).toLowerCase();
    const out = [];
    const add = x => { if (out.indexOf(x) < 0) out.push(x); };
    if (/\b(?:where|home|house|flat|apartment|lives?|moved|address|city|town|village|location|room|office|school|university)\b/.test(t)) add("@location");
    if (/\b(?:when|date|birthday|today|yesterday|tomorrow|morning|night|week|month|year|first|last time|before|after)\b/.test(t) || /\b\d{1,4}\b/.test(t)) add("@time");
    if (/\b(?:mother|father|mum|mom|dad|sister|brother|aunt|uncle|cousin|grand|daughter|son|family|married|wife|husband|spouse|dating|partner|girlfriend|boyfriend|relationship)\b/.test(t)) add("@relationship");
    if (/\b(?:secret|code|password|identity|real name|classified|confess|reveal|truth)\b/.test(t)) add("@secret");
    if (/\b(?:promise|promised|swear|swore|vow|oath|agreement|deal|debt|owe)\b/.test(t)) add("@promise");
    if (/\b(?:dead|died|death|alive|killed|injured|wounded|scar|hospital|condition|pregnant|born)\b/.test(t)) add("@status");
    if (/\b(?:power|ability|magic|spell|weakness|allergy|skill|learned|can\s+[a-z]+)\b/.test(t)) add("@ability");
    if (/\b(?:gift|ring|key|letter|photo|photograph|weapon|artifact|inventory|keepsake)\b/.test(t)) add("@item");
    if (/\b(?:work|job|employed|lawyer|doctor|teacher|engineer|officer|student)\b/.test(t)) add("@role");
    if (/\b(?:real name|known as|codename|code name|alias|nickname|identity)\b/.test(t)) add("@identity");
    if (/\b(?:joined|member of|belongs to|works for|faction|guild|team|organization|organisation)\b/.test(t)) add("@affiliation");
    if (/\b(?:company|corporation|corp|agency|department|council|guild|team|order|faction|organization|organisation|committee|institute|foundation|government|commission|society)\b/.test(t)) add("@organization");
    if (/\b(?:destroyed|collapsed|burned|burnt|rebuilt|repaired|closed|opened|abandoned|occupied|captured|lost|found|stolen|broken)\b/.test(t)) add("@worldstate");
    if (/\b(?:war|battle|attack|incident|disaster|festival|ceremony|graduation|funeral|wedding|election)\b/.test(t)) add("@event");
    return out;
  }

  function explicitRecallLanguage(text) {
    const t = safeText(text);
    return /\b(?:remember|recall|forgot|before|last time|previously|used to|again|what happened|when did|where did|who was|first time|earliest|originally|how long ago|how much time|how many (?:days|weeks|months|years))\b/i.test(t) ||
      /\b(?:what|who|where|when)\b.{0,90}\b(?:ago|before|previously|first|last|gave|called|met|happened|hid|hide|put|left|stored|kept|told|said|promised|found|lost)\b/i.test(t);
  }

  function temporalIntent(text) {
    const t = safeText(text).toLowerCase();
    if (/\b(?:first time|earliest|originally|at first|the first)\b/.test(t)) return "earliest";
    if (/\b(?:last time|most recent|latest|before this|the last|now|currently|current|presently|at present|these days|nowadays|still)\b/.test(t)) return "latest";
    return "neutral";
  }

  function queryEpistemicIntent(text) {
    const t = safeText(text).toLowerCase();
    if (/\b(?:suspect|suspects|suspected|believe|believes|believed|think|thinks|thought|assume|assumes|assumed|fear|fears|feared|opinion|theory)\b/.test(t)) return "belief";
    if (/\b(?:rumou?r|alleged|allegedly|uncertain|possibly|maybe|might have|could have)\b/.test(t)) return "uncertain";
    if (/\b(?:said|say|says|told|tell|tells|claimed|claim|claims|reported|report|reports|according to)\b/.test(t)) return "claim";
    return "any";
  }

  function normName(name) {
    return safeText(name)
      .replace(/[“”"'`]/g, "")
      .replace(/[^A-Za-z0-9À-ÖØ-öø-ÿĀ-ſ\- ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function prettyName(name) {
    name = safeText(name).replace(/\s+/g, " ").trim();
    return name.replace(/\b([a-z])/g, m => m.toUpperCase());
  }

  function escapeRe(s) {
    return safeText(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function tokenList(s, limit) {
    const words = cleanText(s).toLowerCase().match(TOKEN_RE) || [];
    const out = [];
    const seen = new Set();
    for (let i = 0; i < words.length && out.length < (limit || 24); i++) {
      let w = words[i].replace(/^'+|'+$/g, "");
      if (w.length < 3 && !/^\d+$/.test(w)) continue;
      if (STOPWORDS.has(w)) continue;
      if (seen.has(w)) continue;
      seen.add(w);
      out.push(w);
    }
    return out;
  }

  function importance(text) {
    let v = 1;
    for (let i = 0; i < IMPORTANCE_PATTERNS.length; i++) {
      if (IMPORTANCE_PATTERNS[i][1].test(text)) v = Math.max(v, IMPORTANCE_PATTERNS[i][0]);
    }
    if (/\b(always|never|first time|last time|forever|permanent|important|remember this)\b/i.test(text)) v = Math.max(v, 3);
    return v;
  }

  function nameBits(name) {
    return safeText(name).replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  }

  function syntacticIdentity(name, trusted) {
    name = safeText(name).replace(/\s+/g, " ").trim();
    if (!name || name.length < 2 || name.length > 72) return false;
    const bits = nameBits(name);
    if (!bits.length || bits.length > (trusted ? 8 : 7)) return false;
    let realTokens = 0;
    for (let i = 0; i < bits.length; i++) {
      const raw = bits[i];
      const low = raw.replace(/[^A-Za-zÀ-ÖØ-öø-ÿĀ-ſ]/g, "").toLowerCase();
      if (i > 0 && i < bits.length - 1 && DETECT_NAME_PARTICLES.has(low)) continue;
      const b = raw.replace(/[^A-Za-z0-9À-ÖØ-öø-ÿĀ-ſ\-']/g, "");
      if (!b) return false;
      if (IDENTITY_ABSOLUTE.has(b.toLowerCase())) return false;
      if (trusted) {
        if (!/^[A-Za-z0-9À-ÖØ-öø-ÿĀ-ſ][A-Za-z0-9À-ÖØ-öø-ÿĀ-ſ'\-]*$/.test(b)) return false;
      } else if (!/^(?:[A-ZÀ-ÖØ-ÞĀ-Ž][A-Za-zÀ-ÖØ-öø-ÿĀ-ſ'\-]*|[A-Z])$/.test(b)) return false;
      realTokens++;
    }
    return realTokens > 0;
  }

  function detectionPenalty(name) {
    const n = normName(name);
    const bits = n.split(" ").filter(Boolean);
    if (!bits.length) return 99;
    if (DETECT_NONPERSON_PHRASES.has(n) || isFortressMetaPhrase(n)) return 14;
    let p = 0;
    if (bits.length === 1 && DETECT_HARD_SINGLE.has(bits[0])) p += 10;
    if (bits.length === 1 && DETECT_SOFT_SINGLE.has(bits[0])) p += 3;
    if (bits.length > 1 && DETECT_NONPERSON_HEADS.has(bits[bits.length - 1])) p += 8;
    let hard = 0, soft = 0;
    for (let i = 0; i < bits.length; i++) {
      if (DETECT_HARD_SINGLE.has(bits[i])) hard++;
      if (DETECT_SOFT_SINGLE.has(bits[i])) soft++;
    }
    if (hard === bits.length) p += 6;
    else if (hard) p += Math.min(4, hard * 2);
    if (soft === bits.length) p += 2;
    const meta = bits.filter(x => DETECT_META_WORDS.has(x)).length;
    if (meta) p += Math.min(10, 5 + meta * 2);
    return p;
  }

  function isPlausibleName(name, trusted) {
    if (!syntacticIdentity(name, !!trusted)) return false;
    return true;
  }

  function canonicalizeDetectedName(name) {
    name = safeText(name).replace(/\s+/g, " ").trim();
    let bits = name.split(" ").filter(Boolean);
    while (bits.length > 1) {
      const first = bits[0].replace(/[^A-Za-z]/g, "").toLowerCase();
      if (!DETECT_STRIPPABLE_TITLES.has(first)) break;
      bits.shift();
    }
    return bits.join(" ");
  }

  function candidateEvidenceFromText(text) {
    if (!EIDETIC_CONFIG.AUTO_DISCOVER_CHARACTERS) return [];
    text = safeText(text);
    const map = Object.create(null);
    const add = (name, base, reason, strong) => {
      name = safeText(name).replace(/\s+/g, " ").trim().replace(/^[,.:;!?]+|[,.:;!?]+$/g, "");
      name = canonicalizeDetectedName(name);
      if (!isPlausibleName(name, false) || isPlayerName(name)) return;
      const k = normName(name);
      if (!k) return;
      const nameParts = k.split(" ").filter(Boolean), first = nameParts[0];
      if (reason === "speaker-label" || reason === "reverse-dialogue") {
        if (DETECT_SPEAKER_BLOCK.has(first) || isFortressMetaPhrase(k)) return;
        if (nameParts.length && nameParts.every(x => DETECT_META_WORDS.has(x) || (typeof WORLD_FORBIDDEN_SINGLE !== "undefined" && WORLD_FORBIDDEN_SINGLE.has(x)))) return;
      }
      const penalty = detectionPenalty(name);
      const hardOverride = /^(?:dialogue-attribution|speaker-verb|direct-address|speaker-label|reverse-dialogue|appositive-relation|copular-relation)$/.test(reason);
      const appliedPenalty = strong ? (hardOverride ? Math.min(3, penalty) : Math.min(6, penalty)) : penalty;
      let score = Math.max(-8, base - appliedPenalty);
      if (penalty >= 8 && !hardOverride) score = Math.min(0, score);
      if (!map[k]) map[k] = { name, score: -99, strong: 0, requiresStrong: false, reasons: [] };
      const e = map[k];
      if (score > e.score) e.score = score;
      if (penalty >= 3) e.requiresStrong = true;
      if (strong) e.strong = Math.max(e.strong, score);
      if (e.reasons.indexOf(reason) < 0 && e.reasons.length < 10) e.reasons.push(reason);
    };

    const rx = detectionCharRegexes();
    let m, re;

    re=resetGlobalRegex(rx.actor);
    while ((m = re.exec(text)) !== null) {
      const speech = /^(?:says|asks|replies|whispers|shouts|yells|answers|speaks)$/i.test(m[2] || "");
      add(m[1], speech ? 12 : 10, speech ? "speaker-verb" : "actor-verb", true);
    }

    re=resetGlobalRegex(rx.afterQuote);
    while ((m = re.exec(text)) !== null) add(m[1], 12, "dialogue-attribution", true);

    re=resetGlobalRegex(rx.reverseDialogue);
    while ((m = re.exec(text)) !== null) add(m[1], 12, "reverse-dialogue", true);

    re=resetGlobalRegex(rx.speakerLabel);
    while ((m = re.exec(text)) !== null) add(m[1], 13, "speaker-label", true);

    for (let pi = 0; pi < rx.introPatterns.length; pi++) {
      re=resetGlobalRegex(rx.introPatterns[pi]);
      while ((m = re.exec(text)) !== null) add(m[1], 13, "explicit-introduction", true);
    }

    re=resetGlobalRegex(rx.relation);
    while ((m = re.exec(text)) !== null) add(m[1], 11, "named-relation", true);

    re=resetGlobalRegex(rx.appositive);
    while ((m = re.exec(text)) !== null) add(m[1], 12, "appositive-relation", true);

    re=resetGlobalRegex(rx.copular);
    while ((m = re.exec(text)) !== null) add(m[1], 11, "copular-relation", true);

    re=resetGlobalRegex(rx.titled);
    while ((m = re.exec(text)) !== null) add(m[1], 10, "person-title", true);

    re=resetGlobalRegex(rx.vocative);
    while ((m = re.exec(text)) !== null) add(m[1], 11, "direct-address", true);

    re=resetGlobalRegex(rx.possessive);
    while ((m = re.exec(text)) !== null) add(m[1], 8, "human-possessive", true);

    re=resetGlobalRegex(rx.recipient);
    while ((m = re.exec(text)) !== null) add(m[1], 9, "interpersonal-recipient", true);

    re=resetGlobalRegex(rx.signature);
    while ((m = re.exec(text)) !== null) add(m[1], 5, "signed-name", false);

    re=resetGlobalRegex(rx.generic);
    while ((m = re.exec(text)) !== null) {
      const raw = safeText(m[1]).trim();
      const bits = normName(raw).split(" ").filter(Boolean);
      if (EIDETIC_CONFIG.DETECTION_MODE === "strict" && bits.length < 2) continue;
      if (bits.length === 1 && singleTokenMatchesKnownCharacter(raw)) continue;
      add(raw, EIDETIC_CONFIG.DETECTION_MODE === "strict" ? 2 : 4, "generic-capitalized", false);
    }

    const all = Object.keys(map).map(k => map[k]);
    const rr = root();
    if (rr && rr.stats) {
      rr.stats.detectorObserved = Number(rr.stats.detectorObserved || 0) + all.length;
      rr.stats.detectorRejected = Number(rr.stats.detectorRejected || 0) + all.filter(e => e.score <= 0).length;
    }
    return all.filter(e => e.score > 0).sort((a,b) => b.score - a.score || b.strong - a.strong);
  }

  function pruneNameCandidates() {
    const r = root();
    if (!r || !r.candidates) return;
    const turn = currentTurn();
    const keys = Object.keys(r.candidates);
    for (let i = 0; i < keys.length; i++) {
      const c = r.candidates[keys[i]] || {};
      if (turn - Number(c.last || 0) > EIDETIC_CONFIG.NAME_CANDIDATE_TTL) {
        delete r.candidates[keys[i]];
        r.stats.detectorPruned = Number(r.stats.detectorPruned || 0) + 1;
      }
    }
    const left = Object.keys(r.candidates);
    if (left.length <= EIDETIC_CONFIG.MAX_NAME_CANDIDATES) return;
    left.sort((a,b) => {
      const A=r.candidates[a]||{}, B=r.candidates[b]||{};
      return (Number(B.evidence||0) + Number(B.strong||0)*2 + Number(B.last||0)/1000) -
             (Number(A.evidence||0) + Number(A.strong||0)*2 + Number(A.last||0)/1000);
    });
    for (let i = EIDETIC_CONFIG.MAX_NAME_CANDIDATES; i < left.length; i++) {
      delete r.candidates[left[i]];
      r.stats.detectorPruned = Number(r.stats.detectorPruned || 0) + 1;
    }
  }



  function replaceCharacterKeyInArray(arr, oldKey, newKey) {
    if (!Array.isArray(arr)) return arr;
    for (let i = 0; i < arr.length; i++) if (arr[i] === oldKey) arr[i] = newKey;
    return Array.from(new Set(arr));
  }

  function rekeyCharacter(r, oldKey, newKey, newName) {
    if (!r || !r.chars || !r.chars[oldKey] || !newKey || oldKey === newKey) return false;
    if (r.chars[newKey]) return false;
    const ch = r.chars[oldKey];
    ch.name = newName || ch.name;
    ch.aliases = Array.isArray(ch.aliases) ? ch.aliases : [];
    if (newName && !ch.aliases.some(a => normName(a) === normName(newName))) ch.aliases.unshift(newName);
    r.chars[newKey] = ch;
    delete r.chars[oldKey];

    if (r.scene && r.scene[oldKey] != null) {
      r.scene[newKey] = r.scene[oldKey];
      delete r.scene[oldKey];
    }

    const rewriteRecord = e => {
      if (!e) return;
      if (Array.isArray(e)) {
        e[4] = replaceCharacterKeyInArray(e[4], oldKey, newKey);
        e[5] = replaceCharacterKeyInArray(e[5], oldKey, newKey);
        e[6] = replaceCharacterKeyInArray(e[6], oldKey, newKey);
      } else {
        e.owners = replaceCharacterKeyInArray(e.owners, oldKey, newKey);
        e.names = replaceCharacterKeyInArray(e.names, oldKey, newKey);
        e.subjects = replaceCharacterKeyInArray(e.subjects, oldKey, newKey);
      }
    };
    (r.hot || []).forEach(rewriteRecord);
    (r.cold || []).forEach(rewriteRecord);
    (r.anchors || []).forEach(rewriteRecord);
    (r.liveFacts || []).forEach(rewriteRecord);
    (r.ledger || []).forEach(e => {
      if (!e) return;
      e.owners = replaceCharacterKeyInArray(e.owners, oldKey, newKey);
      if (e.subject === oldKey) e.subject = newKey;
    });

    if (r.world) {
      (r.world.facts || []).forEach(e => {
        if (!e) return;
        e.owners = replaceCharacterKeyInArray(e.owners, oldKey, newKey);
      });
      (r.world.timeline || []).forEach(e => {
        if (!e) return;
        e.owners = replaceCharacterKeyInArray(e.owners, oldKey, newKey);
      });

      const oldWorldKey = worldKey(oldKey, "character");
      const newWorldKey = worldKey(newName || newKey, "character");
      if (r.world.entities && r.world.entities[oldWorldKey] && !r.world.entities[newWorldKey]) {
        const we = r.world.entities[oldWorldKey];
        we.key = newWorldKey;
        we.name = newName || we.name;
        r.world.entities[newWorldKey] = we;
        delete r.world.entities[oldWorldKey];
        (r.world.facts || []).forEach(e => { if (e && e.entity === oldWorldKey) e.entity = newWorldKey; });
        (r.world.timeline || []).forEach(e => {
          if (e && Array.isArray(e.entities)) e.entities = e.entities.map(k => k === oldWorldKey ? newWorldKey : k);
        });
      }
    }

    delete r.candidates[oldKey];
    ALIAS_CACHE_SIG = "";
    ALIAS_CACHE = null;
    WORLD_PATTERN_SIG = "";
    WORLD_PATTERN_CACHE = null;
    if (r.stats) r.stats.identityRepairs = Number(r.stats.identityRepairs || 0) + 1;
    return true;
  }

  function uniqueActiveSameFirst(r, first) {
    if (!r || !r.chars) return null;
    const turn = currentTurn();
    const keys = Object.keys(r.chars).filter(k => {
      const parts = normName(r.chars[k].name || k).split(" ").filter(Boolean);
      return parts.length > 1 && parts[0] === first &&
        r.scene && r.scene[k] != null && turn - Number(r.scene[k]) <= EIDETIC_CONFIG.PRESENCE_HOLD_TURNS;
    });
    return keys.length === 1 ? keys[0] : null;
  }

  function repairLegacyIdentityAliases(r) {
    if (!r || !r.chars) return;
    const keys = Object.keys(r.chars);
    const fullFirstCounts = Object.create(null);
    for (let i = 0; i < keys.length; i++) {
      const ch = r.chars[keys[i]] || {};
      const parts = normName(ch.name || keys[i]).split(" ").filter(Boolean);
      if (parts.length > 1) fullFirstCounts[parts[0]] = Number(fullFirstCounts[parts[0]] || 0) + 1;
    }
    let changed = 0;
    for (let i = 0; i < keys.length; i++) {
      const ch = r.chars[keys[i]] || {};
      const parts = normName(ch.name || keys[i]).split(" ").filter(Boolean);
      if (parts.length <= 1) continue;
      const first = parts[0];
      const before = Array.isArray(ch.aliases) ? ch.aliases.slice() : [ch.name];
      ch.aliases = before.filter(a => {
        const n = normName(a);
        // Old builds inferred a bare first name from a full identity. Remove that
        // unsafe inference; an explicit Story Card alias will be re-seeded in init().
        return !(n === first && n !== normName(ch.name));
      });
      if (!ch.aliases.some(a => normName(a) === normName(ch.name))) ch.aliases.unshift(ch.name);
      if (ch.aliases.length !== before.length) changed++;
    }
    r.ambiguousFirstNames = Object.keys(fullFirstCounts).filter(k => fullFirstCounts[k] > 1);
    if (r.stats) r.stats.identityRepairs = Number(r.stats.identityRepairs || 0) + changed;
    ALIAS_CACHE_SIG = "";
    ALIAS_CACHE = null;
  }

  function characterRecentlyGrounded(r, key) {
    if (!r || !r.chars || !r.chars[key]) return false;
    const turn = currentTurn(), ch = r.chars[key];
    if (r.scene && r.scene[key] != null && turn - Number(r.scene[key]) <= 1) return true;
    return Number.isFinite(ch.lastSeen) && ch.lastSeen >= 0 && turn - ch.lastSeen <= 1;
  }

  function ensureChar(name, source, force, evidence) {
    const r = root();
    if (!r) return null;
    name = safeText(name).replace(/\s+/g, " ").trim();
    if (!isPlausibleName(name, !!force)) return null;
    const key = normName(name);
    if (!key || key === PLAYER || isPlayerName(name)) return null;
    if (r.chars[key]) {
      r.chars[key].lastSource = source || r.chars[key].lastSource;
      if (r.chars[key].aliases.indexOf(name) < 0 && r.chars[key].aliases.length < EIDETIC_CONFIG.MAX_ALIASES_PER_CHARACTER) r.chars[key].aliases.push(name);
      return key;
    }
    const aliasKeys = Object.keys(r.chars);
    for (let ai = 0; ai < aliasKeys.length; ai++) {
      const ach = r.chars[aliasKeys[ai]];
      if (normName(ach.name) === key || (ach.aliases || []).some(a => normName(a) === key)) {
        ach.lastSource = source || ach.lastSource;
        if (ach.aliases.indexOf(name) < 0 && ach.aliases.length < EIDETIC_CONFIG.MAX_ALIASES_PER_CHARACTER) ach.aliases.push(name);
        return aliasKeys[ai];
      }
    }

    const incomingParts = key.split(" ");
    const first = incomingParts[0];
    const existingKeys = Object.keys(r.chars);
    if (incomingParts.length === 1 && r.ambiguousFirstNames.indexOf(first) >= 0) {
      const active = uniqueActiveSameFirst(r, first);
      if (active) return active;
      return null;
    }
    if (r.ambiguousFirstNames.indexOf(first) < 0) {
      for (let i = 0; i < existingKeys.length; i++) {
        const ek = existingKeys[i];
        const ch = r.chars[ek];
        const existingParts = normName(ch.name || ek).split(" ");
        const sameFirst = first === existingParts[0];
        if (!sameFirst) continue;
        const existingFullAliases = (ch.aliases || []).map(normName).filter(a => a.split(" ").length > 1);
        if (incomingParts.length > 1 && existingParts.length === 1) {
          if (existingFullAliases.length && existingFullAliases.some(a => a !== key)) continue;
          if (rekeyCharacter(r, ek, key, name)) {
            const upgraded = r.chars[key];
            upgraded.lastSource = source || upgraded.lastSource;
            const fullSameFirst = Object.keys(r.chars).filter(k2 => {
              const parts = normName(r.chars[k2].name || k2).split(" ").filter(Boolean);
              return parts.length > 1 && parts[0] === first;
            });
            if (fullSameFirst.length > 1 && r.ambiguousFirstNames.indexOf(first) < 0) r.ambiguousFirstNames.push(first);
            if (fullSameFirst.length > 1) {
              for (let j = 0; j < fullSameFirst.length; j++) {
                const ch2 = r.chars[fullSameFirst[j]];
                ch2.aliases = (ch2.aliases || []).filter(a => normName(a) !== first);
              }
            }
            return key;
          }
        }
        if (incomingParts.length === 1 && existingParts.length > 1) {
          const fullCandidates = existingKeys.filter(k2 => normName(r.chars[k2].name || k2).split(" ")[0] === first && normName(r.chars[k2].name || k2).split(" ").length > 1);
          // Never let a stale archive identity steal a bare first name merely because it
          // happens to be the only old full-name match. Bind only when that identity is
          // already grounded in the current live scene. Otherwise allow a provisional
          // first-name character to accumulate evidence until a full identity appears.
          if (fullCandidates.length === 1 && characterRecentlyGrounded(r, ek)) {
            if (ch.aliases.indexOf(name) < 0 && ch.aliases.length < EIDETIC_CONFIG.MAX_ALIASES_PER_CHARACTER) ch.aliases.push(name);
            ch.lastSource = source || ch.lastSource;
            return ek;
          }
        }
      }
    }

    if (Object.keys(r.chars).length >= EIDETIC_CONFIG.MAX_TRACKED_CHARACTERS) return null;
    if (!force) {
      const ev = evidence && typeof evidence === "object" ? evidence : { score: 1, strong: 0, reasons: [source || "legacy"] };
      if (Number(ev.score || 0) <= 0) return null; // never persist pure junk observations
      const c = r.candidates[key] || { name: name, hits: 0, evidence: 0, strong: 0, requiresStrong: false, last: 0, reasons: [] };
      const turn = currentTurn();
      if (c.lastHitTurn !== turn) c.hits = Number(c.hits || 0) + 1;
      c.lastHitTurn = turn;
      c.last = turn;
      c.name = c.name || name;
      c.evidence = Number(c.evidence || 0) + Math.max(0, Number(ev.score || 0));
      c.strong = Math.max(Number(c.strong || 0), Number(ev.strong || 0));
      c.requiresStrong = !!c.requiresStrong || !!ev.requiresStrong;
      c.reasons = Array.isArray(c.reasons) ? c.reasons : [];
      const rs = Array.isArray(ev.reasons) ? ev.reasons : [];
      for (let ri = 0; ri < rs.length; ri++) if (c.reasons.indexOf(rs[ri]) < 0 && c.reasons.length < 8) c.reasons.push(rs[ri]);
      r.candidates[key] = c;
      const strongEnough = c.strong >= EIDETIC_CONFIG.NAME_STRONG_PROMOTION_SCORE;
      const accumulatedEnough = c.hits >= EIDETIC_CONFIG.NAME_PROMOTION_HITS && c.evidence >= EIDETIC_CONFIG.NAME_PROMOTION_SCORE && (!c.requiresStrong || c.strong >= EIDETIC_CONFIG.NAME_STRONG_PROMOTION_SCORE);
      if (!strongEnough && !accumulatedEnough) return null;
    }
    r.chars[key] = {
      name: name,
      aliases: [name],
      created: currentTurn(),
      lastSeen: -1,
      lastSource: source || "auto",
    };
    if (key.split(" ").length > 1) {
      const first = key.split(" ")[0];
      const fullSameFirst = Object.keys(r.chars).filter(k2 => normName(r.chars[k2].name || k2).split(" ")[0] === first && normName(r.chars[k2].name || k2).split(" ").length > 1);
      if (fullSameFirst.length > 1 && r.ambiguousFirstNames.indexOf(first) < 0) {
        r.ambiguousFirstNames.push(first);
        for (let j = 0; j < fullSameFirst.length; j++) {
          const ch2 = r.chars[fullSameFirst[j]];
          ch2.aliases = (ch2.aliases || []).filter(a => normName(a) !== first);
        }
      }
    }
    delete r.candidates[key];
    r.stats.promoted = (r.stats.promoted || 0) + 1;
    return key;
  }

  function seedConfiguredCharacters() {
    const seeds = [].concat(EIDETIC_CONFIG.SEED_CHARACTERS || [], EIDETIC_CONFIG.ALWAYS_FOCUS || []);
    for (let i = 0; i < seeds.length; i++) ensureChar(seeds[i], "config", true);
  }

  function seedPlayerIdentity() {
    const r = root();
    if (!r || typeof state === "undefined" || !state) return;
    const names = new Set(Array.isArray(r.playerNames) ? r.playerNames : []);
    const placeholders = Array.isArray(state.placeholders) ? state.placeholders : [];
    for (let i = 0; i < placeholders.length; i++) {
      const q = safeText(placeholders[i].question).toLowerCase();
      if (q === "character.name" || q.includes("character name") || q === "name" || q.includes("your name")) {
        const n = safeText(placeholders[i].answer).trim();
        if (n && isPlausibleName(n, true)) names.add(n);
      }
    }
    if (typeof info !== "undefined" && info && Array.isArray(info.characterNames)) {
      for (let i = 0; i < info.characterNames.length; i++) {
        const n = safeText(info.characterNames[i]).trim();
        if (n) names.add(n);
      }
    }
    r.playerNames = Array.from(names).slice(0, 16);
    if (r.playerNames.length) r.playerName = r.playerNames[0];

    const keys = Object.keys(r.chars);
    for (let i = 0; i < keys.length; i++) if (isPlayerName(r.chars[keys[i]].name)) delete r.chars[keys[i]];
  }

  function splitKeys(keys) {
    if (Array.isArray(keys)) return keys.map(String);
    return safeText(keys).split(/[,;|]/g);
  }

  function addAliasToCharacter(charKey, alias, source) {
    const r = root();
    if (!r || !r.chars[charKey]) return false;
    alias = safeText(alias).replace(/\s+/g, " ").trim();
    if (!alias || isPlayerName(alias)) return false;
    const nk = normName(alias);
    if (!nk) return false;
    const keys = Object.keys(r.chars);
    for (let i = 0; i < keys.length; i++) {
      if (keys[i] === charKey) continue;
      const ch = r.chars[keys[i]];
      if (normName(ch.name) === nk || (ch.aliases || []).some(a => normName(a) === nk)) return false;
    }
    const ch = r.chars[charKey];
    ch.aliases = Array.isArray(ch.aliases) ? ch.aliases : [ch.name];
    if (!(ch.aliases || []).some(a => normName(a) === nk)) {
      if (ch.aliases.length >= EIDETIC_CONFIG.MAX_ALIASES_PER_CHARACTER) return false;
      ch.aliases.push(alias);
    }
    ch.lastSource = source || ch.lastSource;
    return true;
  }

  function storyCardAliasCandidate(alias, canonical, entryName, entryText) {
    alias = safeText(alias).replace(/\s+/g, " ").trim();
    if (!alias || alias.length > 64 || isPlayerName(alias)) return false;
    const n = normName(alias);
    const canon = normName(canonical);
    const entry = normName(entryName || "");
    const firsts = [canon, entry].filter(Boolean).map(x => x.split(" ")[0]);
    if (n === canon || n === entry || (n.indexOf(" ") < 0 && firsts.indexOf(n) >= 0)) return true;
    const displayLike = /^[A-ZÀ-ÖØ-ÞĀ-Ž0-9][A-Za-zÀ-ÖØ-öø-ÿĀ-ſ0-9'\-]*(?:\s+[A-ZÀ-ÖØ-ÞĀ-Ž0-9][A-Za-zÀ-ÖØ-öø-ÿĀ-ſ0-9'\-]*){0,3}$/.test(alias);
    if (!displayLike || !syntacticIdentity(alias, true) || detectionPenalty(alias) >= 8) return false;
    const entryRaw = cleanText(entryText || "");
    if (entryRaw) {
      const a = escapeRe(alias);
      const identityContext = new RegExp("\\b(?:known as|also known as|called|codename|code name|alias|aka|a\\.k\\.a\\.|goes by|hero name|villain name|nickname)\\b[^.!?]{0,48}\\b" + a + "\\b", "i");
      if (identityContext.test(entryRaw)) return true;
    }
    if (/^[A-Z0-9][A-Z0-9'\-]{2,}$/.test(alias)) return true;
    return false;
  }


  function configCardDefaults() {
    return {
      enabled: "on",
      memoryDepth: "deep",
      recallSize: "balanced",
      strictKnowledge: "on",
      autoDetect: "on",
      detectionMode: "balanced",
      currentState: "on",
      worldMemory: "on",
      storyTime: "on",
      narrativeRecall: "on",
      abstainOnMiss: "on",
      activeCharacters: "3",
      outputSpacing: "preserve",
      debug: "off",
    };
  }

  function configCardEntry(values) {
    const v = Object.assign(configCardDefaults(), values || {});
    // Keep Entry deliberately tiny: only editable settings belong in model-visible text.
    // The human-facing explanations live in Story Card Notes/description when Phoenix
    // preserves that metadata.
    return [
      "enabled = " + v.enabled,
      "memoryDepth = " + v.memoryDepth,
      "recallSize = " + v.recallSize,
      "strictKnowledge = " + v.strictKnowledge,
      "autoDetect = " + v.autoDetect,
      "detectionMode = " + v.detectionMode,
      "currentState = " + v.currentState,
      "worldMemory = " + v.worldMemory,
      "storyTime = " + v.storyTime,
      "narrativeRecall = " + v.narrativeRecall,
      "abstainOnMiss = " + v.abstainOnMiss,
      "activeCharacters = " + v.activeCharacters,
      "outputSpacing = " + v.outputSpacing,
      "debug = " + v.debug
    ].join("\n");
  }

  function configCardNotes() {
    return [
      "🧠 EIDETIC — CONFIG GUIDE",
      "EIDETIC works automatically. Entry contains settings only; this Notes field is the human guide.",
      "It stores memory in state.__EIDETIC, never Plot Essentials/Author's Note/state.memory. It creates no Current Played Continuity dashboard card.",
      "Major character continuity is kept internally, mirrored to Notes when the client preserves Notes, and compactly mirrored into the correct Character Entry so the AI can actually use durable updates.",
      "",
      "enabled — on/off master switch.",
      "memoryDepth — compact / standard / deep. Controls archive size; deep is best for long Adventures.",
      "recallSize — small / balanced / large. Controls how much retrieved memory enters model context.",
      "strictKnowledge — on keeps private knowledge scoped to witnesses/knowers; recommended.",
      "autoDetect — on enables character/world entity auto-detection and anti-junk filtering.",
      "detectionMode — strict for maximum precision; balanced is recommended for most stories.",
      "currentState — on. Tracks what is true now: changing status/location/role/relationship/identity/possessions without deleting history.",
      "worldMemory — Tracks scenario-wide continuity: durable locations, items, organisations, destruction, discoveries and major world changes.",
      "storyTime — on tracks explicit dates and elapsed-time jumps.",
      "narrativeRecall — on allows relevant player/narrator-known history to return when safe.",
      "abstainOnMiss — on tells the model not to invent an answer when an explicit recall has no evidence.",
      "activeCharacters — 1–6; max NPC private-memory sections considered at once. Default 3.",
      "outputSpacing — preserve leaves model output untouched; auto may repair a missing continuation space.",
      "debug — on adds troubleshooting diagnostics; leave off normally.",
      "",
      "AUTOMATIC: episodic + anchor memory; claims vs facts; character knowledge; current state; Story Card identity/alias awareness; durable character profile updates; Retry/Undo cleanup; world memory; time tracking; relevance ranking; Detection Fortress.",
      "Important-character updates are selective: identity/status/relationship/ability changes, confessions, important commitments, durable goals/boundaries and strong evidence. Gestures, ordinary chatter and incidental logistics are rejected.",
      "Scenario baselines are NOT guessed from arbitrary Story Cards. To opt a non-character card into global EIDETIC baseline recall, add trigger %__EIDETIC_CURRENT_SEED_20__% or the phrase EIDETIC CURRENT SEED.",
      "",
      "COMMANDS: /eidetic /memory /config /memstats /memdetect /roster /focus Alice /focus auto /remember Alice | fact /recall Alice | topic /live /memdebug on|off /memclear CONFIRM",
      "Mobile/add-on safety: commands use the soft path; Config-card failure does not disable memory. Invalid values fall back safely.",
      "Optimized Context: fully supported. EIDETIC preserves AI Dungeon's supplied cached prompt byte-for-byte and appends recall only at the end; if no safe suffix space remains, recall is skipped for that turn rather than trimming/reordering cached context."
    ].join("\n");
  }

  function findConfigCardIndex() {
    if (typeof storyCards === "undefined" || !Array.isArray(storyCards)) return -1;
    const r = root();
    const savedId = r && r.runtime ? r.runtime.configCardId : "";
    if (savedId !== "" && savedId != null) {
      for (let i = 0; i < storyCards.length; i++) if (storyCards[i] && String(storyCards[i].id) === String(savedId)) return i;
    }
    const wanted = safeText(EIDETIC_CONFIG.CONFIG_CARD_KEY);
    const legacy = new Set([wanted, "%EIDETIC_CONFIG%", "%EIDETIC_CONFIG_5_1%", "%EIDETIC_CONFIG_6%"]);
    for (let i = 0; i < storyCards.length; i++) {
      const c = storyCards[i] || {};
      const keys = Array.isArray(c.keys) ? c.keys.join(",") : safeText(c.keys);
      const pieces = keys.split(/[,;|]/).map(x => x.trim());
      if (pieces.some(x => legacy.has(x))) return i;
      if (safeText(c.title) === "🧠 EIDETIC — Config & Guide") return i;
    }
    return -1;
  }

  function configValue(text, key) {
    const m = safeText(text).match(new RegExp("^[ \t]*" + escapeRe(key) + "[ \t]*=[ \t]*([^\\r\\n#]+)", "im"));
    return m ? m[1].trim().toLowerCase() : "";
  }

  function configCardValues(text) {
    const d = configCardDefaults(), out = {};
    Object.keys(d).forEach(k => { const v = configValue(text, k); out[k] = v || d[k]; });
    return out;
  }

  function configSettingsSource(c) {
    if (!c || typeof c !== "object") return "";
    const fields = ["entry", "value", "description", "notes"];
    let fallback = "";
    for (let i = 0; i < fields.length; i++) {
      const v = safeText(c[fields[i]]);
      if (!v) continue;
      if (/EIDETIC — SETTINGS/.test(v)) return v;
      if (!fallback && /^\s*enabled\s*=/im.test(v)) fallback = v;
    }
    return fallback;
  }

  function tryWriteConfigNotes(c, guide) {
    if (!c || typeof c !== "object") return false;
    try { c.description = guide; } catch (_) {}
    try { c.notes = guide; } catch (_) {}
    return /EIDETIC — CONFIG GUIDE/.test(safeText(c.description)) ||
      /EIDETIC — CONFIG GUIDE/.test(safeText(c.notes));
  }

  function warnConfigCardUnavailable() {
    const r = root();
    if (!r || !r.runtime || r.runtime.configCardWarned) return;
    r.runtime.configCardWarned = true;
    const msg = "EIDETIC is running, but its Config & Guide card could not be created. Core memory remains active; use /config to inspect settings.";
    if (typeof state !== "undefined" && state && !safeText(state.message)) setMessage(msg);
    else debugLog(msg);
  }

  function ensureConfigCard() {
    if (!EIDETIC_CONFIG.AUTO_CONFIG_CARD || typeof storyCards === "undefined" || !Array.isArray(storyCards)) return null;
    const r = root();
    let idx = findConfigCardIndex();
    let created = false;

    if (idx < 0 && !cardSyncAllowed(false)) return null;
    if (idx < 0 && typeof addStoryCard === "function") {
      try {
        const made = addStoryCard(EIDETIC_CONFIG.CONFIG_CARD_KEY, configCardEntry(), "Custom");
        created = made !== false;
        if (Number.isInteger(made) && made >= 0 && made < storyCards.length) idx = made;
        if (idx < 0) idx = findConfigCardIndex();
      } catch (_) {}
    }

    if (idx < 0 || !storyCards[idx]) {
      if(r&&r.runtime){
        r.runtime.cardPersistence="degraded";
        r.runtime.cardWriteFailures=Number(r.runtime.cardWriteFailures||0)+1;
        r.runtime.cardRetryTurn=currentTurn()+EIDETIC_CONFIG.STORY_CARD_RETRY_TURNS;
      }
      warnConfigCardUnavailable();
      return null;
    }

    const c = storyCards[idx];
    if (r && r.runtime && c.id != null) r.runtime.configCardId = c.id;

    // Preserve user settings from both the new Entry layout and older config-card formats.
    const priorSource = configSettingsSource(c);
    const values = configCardValues(priorSource);
    if (r && r.runtime && r.runtime.migrateDetectionDefaultToBalanced) {
      if (configValue(priorSource, "detectionMode") === "strict") values.detectionMode = "balanced";
      r.runtime.migrateDetectionDefaultToBalanced = false;
    }
    if (r && r.runtime && r.runtime.migrateOutputSpacingToPreserve) {
      values.outputSpacing = "preserve";
      r.runtime.migrateOutputSpacingToPreserve = false;
    }
    const panel = configCardEntry(values);
    const guide = configCardNotes();

    try { c.title = "🧠 EIDETIC — Config & Guide"; } catch (_) {}
    // Only settings belong in Entry. Long help text in Entry wastes triggered context.
    const needsWrite=safeText(c.entry!=null?c.entry:c.value)!==panel ||
      safeText(c.keys)!==EIDETIC_CONFIG.CONFIG_CARD_KEY || safeText(c.type)!=="Custom";
    if(needsWrite) persistStoryCard(idx, EIDETIC_CONFIG.CONFIG_CARD_KEY, panel, "Custom");

    // Phoenix's documented scripting helper does not expose a Notes argument, but full
    // Story Card objects commonly carry description/notes metadata. Write it directly as
    // best-effort human-only help; never fall back to bloating Entry if metadata is stripped.
    const target=(typeof storyCards!=="undefined"&&Array.isArray(storyCards)&&storyCards[idx])?storyCards[idx]:c;
    const notesOk=tryWriteConfigNotes(target, guide);
    try { target.title = "🧠 EIDETIC — Config & Guide"; } catch (_) {}

    if (r && r.runtime) {
      r.runtime.configCardMode = "entry+notes";
      r.runtime.configNotesPersistence = notesOk ? "written" : "unavailable";
      r.runtime.configProbePending = false;
      r.runtime.configGuideSig = hash(guide);
      r.runtime.configCardWarned = false;
    }

    return target;
  }

  function setConfigValueInCard(key, value) {
    const c = ensureConfigCard();
    if (!c) return false;
    const re = new RegExp("^([ \t]*" + escapeRe(key) + "[ \t]*=[ \t]*)[^\\r\\n#]*", "im");
    let panel = safeText(c.entry);
    if (!re.test(panel)) return false;
    panel = panel.replace(re, "$1" + safeText(value));
    const idx=findConfigCardIndex();
    if(idx<0||!persistStoryCard(idx,EIDETIC_CONFIG.CONFIG_CARD_KEY,panel,"Custom"))return false;
    if(typeof storyCards!=="undefined"&&Array.isArray(storyCards)&&storyCards[idx]) tryWriteConfigNotes(storyCards[idx],configCardNotes());
    const r = root();
    if (r && r.runtime) r.runtime.configGuideSig = hash(configCardNotes());
    return true;
  }

  function applyConfigCard() {
    const c = ensureConfigCard();
    if (!c) return;
    const r = root();
    const n = configSettingsSource(c) || safeText(c.entry);
    const on = v => /^(on|true|yes|1|enabled)$/.test(v);
    const off = v => /^(off|false|no|0|disabled)$/.test(v);
    const bool = (key, fallback) => { const v = configValue(n,key); return on(v) ? true : off(v) ? false : fallback; };

    EIDETIC_CONFIG.ENABLED = bool("enabled", true);
    EIDETIC_CONFIG.STRICT_KNOWLEDGE = bool("strictKnowledge", true);
    EIDETIC_CONFIG.AUTO_DISCOVER_CHARACTERS = bool("autoDetect", true);
    const detectionMode = configValue(n,"detectionMode");
    EIDETIC_CONFIG.DETECTION_MODE = detectionMode === "strict" ? "strict" : "balanced";
    EIDETIC_CONFIG.ENABLE_NARRATIVE_RECALL = bool("narrativeRecall", true);
    EIDETIC_CONFIG.ABSTAIN_ON_EXPLICIT_RECALL_MISS = bool("abstainOnMiss", true);
    EIDETIC_CONFIG.ENABLE_STATE_LEDGER = bool("currentState", true);
    EIDETIC_CONFIG.ENABLE_WORLD_MEMORY = bool("worldMemory", true);
    EIDETIC_CONFIG.TRACK_STORY_TIME = bool("storyTime", true);
    EIDETIC_CONFIG.DEBUG = bool("debug", false);

    const spacing = configValue(n,"outputSpacing");
    EIDETIC_CONFIG.OUTPUT_SPACING = spacing === "auto" ? "auto" : "preserve";

    const depth = configValue(n,"memoryDepth");
    if (depth === "compact") {
      EIDETIC_CONFIG.HOT_EVENT_LIMIT=1200; EIDETIC_CONFIG.COLD_EVENT_LIMIT=2400; EIDETIC_CONFIG.MAX_ANCHORS=500;
    } else if (depth === "standard") {
      EIDETIC_CONFIG.HOT_EVENT_LIMIT=2800; EIDETIC_CONFIG.COLD_EVENT_LIMIT=5600; EIDETIC_CONFIG.MAX_ANCHORS=800;
    } else {
      EIDETIC_CONFIG.HOT_EVENT_LIMIT=4500; EIDETIC_CONFIG.COLD_EVENT_LIMIT=9000; EIDETIC_CONFIG.MAX_ANCHORS=1200;
    }

    const recall = configValue(n,"recallSize");
    if (recall === "small") {
      EIDETIC_CONFIG.RECALL_BLOCK_MAX_CHARS=900; EIDETIC_CONFIG.RECALL_CONTEXT_FRACTION=0.03; EIDETIC_CONFIG.RECALL_MIN_CHARS=300;
    } else if (recall === "large") {
      EIDETIC_CONFIG.RECALL_BLOCK_MAX_CHARS=2200; EIDETIC_CONFIG.RECALL_CONTEXT_FRACTION=0.07; EIDETIC_CONFIG.RECALL_MIN_CHARS=550;
    } else {
      EIDETIC_CONFIG.RECALL_BLOCK_MAX_CHARS=1500; EIDETIC_CONFIG.RECALL_CONTEXT_FRACTION=0.05; EIDETIC_CONFIG.RECALL_MIN_CHARS=400;
    }

    const ac = Number(configValue(n,"activeCharacters"));
    EIDETIC_CONFIG.MAX_ACTIVE_CHARACTERS = Number.isFinite(ac) ? Math.max(1,Math.min(6,Math.floor(ac))) : 3;
    if (r) r.debug = EIDETIC_CONFIG.DEBUG;
  }


  const EIDETIC_NOTES_OPEN = "[[EIDETIC LIVE CONTINUITY]]";
  const EIDETIC_NOTES_CLOSE = "[[/EIDETIC LIVE CONTINUITY]]";
  const EIDETIC_ENTRY_OPEN = "[[EIDETIC LIVE CONTINUITY]]";
  const EIDETIC_ENTRY_CLOSE = "[[/EIDETIC LIVE CONTINUITY]]";
  const EIDETIC_CURRENT_OPEN = "[[EIDETIC CURRENT PLAYED CONTINUITY]]";
  const EIDETIC_CURRENT_CLOSE = "[[/EIDETIC CURRENT PLAYED CONTINUITY]]";
  const EIDETIC_INSIGHT_NOTES_OPEN = "[[EIDETIC IMPORTANT CHARACTER CONTINUITY]]";
  const EIDETIC_INSIGHT_NOTES_CLOSE = "[[/EIDETIC IMPORTANT CHARACTER CONTINUITY]]";
  const EIDETIC_PROFILE_OPEN = "[[EIDETIC PROFILE DELTA]]";
  const EIDETIC_PROFILE_CLOSE = "[[/EIDETIC PROFILE DELTA]]";

  function stripEideticNotes(text) {
    text=safeText(text); const a=text.indexOf(EIDETIC_NOTES_OPEN), b=text.indexOf(EIDETIC_NOTES_CLOSE);
    if(a<0||b<a)return text.trim();
    return (text.slice(0,a)+text.slice(b+EIDETIC_NOTES_CLOSE.length)).replace(/\n{3,}/g,"\n\n").trim();
  }

  function stripManagedEntryBlock(text, open, close) {
    text=safeText(text);
    const a=text.indexOf(open), b=text.indexOf(close);
    if(a<0||b<a)return text.trim();
    return (text.slice(0,a)+text.slice(b+close.length)).replace(/\n{3,}/g,"\n\n").trim();
  }

  function persistStoryCard(index, keys, entry, type) {
    const r=root();
    if (typeof storyCards==="undefined" || !Array.isArray(storyCards) || index<0 || !storyCards[index]) return false;
    if(!cardSyncAllowed(false))return false;
    let apiOk=false, localOk=false;
    if (typeof updateStoryCard==="function") {
      try { updateStoryCard(index, keys, entry, type); apiOk=true; } catch (_) {}
    }
    // Local mutation keeps this hook coherent and supports older engines, but only the
    // official helper is considered a confirmed persistence path.
    try {
      storyCards[index].keys=keys;
      storyCards[index].entry=entry;
      storyCards[index].type=type;
      if ("value" in storyCards[index]) storyCards[index].value=entry;
      localOk=true;
    } catch (_) {}
    if(r&&r.runtime){
      const c=storyCards[index]||{};
      r.runtime.cardExpected={id:c.id!=null?c.id:null,keys:safeText(keys),hash:hash(safeText(entry)),turn:currentTurn()};
      r.runtime.cardPersistence=apiOk?"pending":(localOk?"local-only":"degraded");
      if(!apiOk&&!localOk){
        r.runtime.cardWriteFailures=Number(r.runtime.cardWriteFailures||0)+1;
        r.stats.cardWriteFailures=Number(r.stats.cardWriteFailures||0)+1;
        r.runtime.cardRetryTurn=currentTurn()+EIDETIC_CONFIG.STORY_CARD_RETRY_TURNS;
      }
    }
    return apiOk||localOk;
  }

  function stableStoryCardEntry(card) {
    let text=safeText(card && (card.entry!=null?card.entry:card.value));
    text=stripManagedEntryBlock(text,EIDETIC_ENTRY_OPEN,EIDETIC_ENTRY_CLOSE);
    text=stripManagedEntryBlock(text,EIDETIC_CURRENT_OPEN,EIDETIC_CURRENT_CLOSE);
    text=stripManagedEntryBlock(text,EIDETIC_PROFILE_OPEN,EIDETIC_PROFILE_CLOSE);
    return cleanText(text);
  }
  function evidenceState(text, mode) {
    const t=cleanText(text);
    if(mode==="question")return "QUESTION";
    if(mode==="belief")return "BELIEF";
    if(mode==="claim")return "CLAIM";
    if(mode==="uncertain"||/\b(?:maybe|perhaps|possibly|might|could|seems?|appears?|looks? like|apparently|probably|likely|unlikely|i think|i believe|we think|we believe|suspect|theory|hypothesis|guess)\b/i.test(t))return "UNCONFIRMED";
    if(/\b(?:means? that|therefore|proves?|proof that|must be|has to be|designed (?:for|to)|specifically target(?:ed|s)?|obviously|clearly|definitely|certainly)\b/i.test(t))return "INFERENCE";
    if(/\b(?:isn't|is not|wasn't|was not|not actually|false|wrong|disproved|disproven)\b/i.test(t))return "NEGATED";
    return "FACT";
  }
  function liveLooksQuestion(text) {
    let t=cleanText(text).replace(/^[\s\"'“”‘’]+|[\s\"'“”‘’]+$/g,"");
    if(!t)return false;
    if(/\?\s*$/.test(t))return true;
    if(/^(?:who|what|where|when|why|how|which|whose|whom)\b/i.test(t))return true;
    if(/^(?:can|could|would|will|do|does|did|is|are|was|were|have|has|had|should|may|might)\s+(?:you|we|they|he|she|it|there|any|the|a|an)\b/i.test(t))return true;
    if(/^(?:you|i|we)\s+(?:ask|asks|asked|wonder|wonders|wondered|question|questions|questioned|inquire|inquires|inquired)\b/i.test(t))return true;
    return false;
  }
  function liveStrategicText(text) {
    const t=cleanText(text);
    return /\b(?:worldship|planet[- ]sized (?:ship|vessel|construct)|invasion|first contact|hidden (?:alien |monitoring )?(?:ship|vessel)|monitor(?:s|ed|ing)? (?:the )?(?:system|planet|earth|solar system)|destination (?:is|was) earth|headed? (?:for|toward|towards) earth|hostile (?:fleet|ship|vessel|civilization|civilisation|species)|route corridor|garrison|checkpoint|waystation|station (?:is|was|has been) destroyed|destroyed (?:the )?(?:station|base|node|garrison|checkpoint)|collapsed (?:the )?(?:station|base|node|garrison|checkpoint)|direct first contact|major threat|existential threat)\b/i.test(t);
  }
  function liveFactEligible(text, mode, imp) {
    const t=cleanText(text); if(!t||mode==="question"||liveLooksQuestion(t)||t.length<12)return false;
    if(/^(?:okay|right|yes|no|yeah|yeh|thanks|thank you|hello|hi|bye|goodnight|night)\b[.!?]*$/i.test(t))return false;
    if(mode==="event"||mode==="player-event") return imp>=3 || liveStrategicText(t) || /\b(?:arriv(?:e|es|ed)|leav(?:e|es|ing)|return(?:s|ed)?|discover(?:s|ed)?|find(?:s|ing)?|found|attack(?:s|ed)?|capture(?:s|d)?|arrest(?:s|ed)?|kidnap(?:s|ped)?|abduct(?:s|ed)?|take(?:s|n)? hostage|released?|freed|rescued?|vapori[sz](?:e|es|ed)|disintegrat(?:e|es|ed)|drain(?:s|ed|ing)?|siphon(?:s|ed|ing)?|harvest(?:s|ed|ing)?|seize(?:s|d)?|escape(?:s|d)?|custody|injur(?:e|es|ed)|wound(?:s|ed)?|destroy(?:s|ed)?|damage(?:s|d)?|repair(?:s|ed)?|die(?:s|d)?|dead|alive|missing|move(?:s|d)?|stay(?:s|ed)?|learn(?:s|ed)?|tell(?:s|ing)?|told|reveal(?:s|ed)?|confirm(?:s|ed)?|admit(?:s|ted)?|measure(?:s|d)?|match(?:es|ed)?|orbit(?:s|ing)?|pod|vision|anomaly|relationship|partner|married|dating|pregnant|birthday|years? old|set(?:s|ting)? course|plot(?:s|ted|ting)? (?:a )?course|checkpoint|waypoint|dock(?:s|ed|ing)?|launch(?:es|ed|ing)?|board(?:s|ed|ing)?|depart(?:s|ed|ing)?|transmit(?:s|ted|ting)?|transmission|signal|translate(?:s|d)?|translation|reply|response|crew|mission|objective|route|anchor key|dead hour|revision mark|offline|ownership)\b/i.test(t);
    if(mode==="claim"||mode==="belief"||mode==="uncertain") return imp>=3 || liveStrategicText(t);
    return false;
  }
  function liveFactDurabilityScore(f) {
    if(!f)return -99;
    if(Number.isFinite(f.cardScore18))return f.cardScore18;
    const t=cleanText(f.text), low=t.toLowerCase();
    if(!t)return -99;
    const wordCount=t.split(/\s+/).filter(Boolean).length;
    let score=0;
    const names=Array.isArray(f.names)?f.names:[];
    const world=Array.isArray(f.world)?f.world:[];
    if(t.length<18||wordCount<3)score-=4;
    if(liveLooksQuestion(t))score-=12;
    if(f.status==="FACT"||f.status==="NEGATED")score+=2;
    else if(/^(?:CLAIM|BELIEF|INFERENCE|UNCONFIRMED)$/.test(safeText(f.status)))score-=0.5;
    if(names.length)score+=1;
    if(world.some(w=>!/^character:/i.test(safeText(w))))score+=1;

    const stateLike=/\b(?:lives?|resides?|stays?)\s+(?:in|at|on|near|with)\b|\b(?:moved|moves|relocated)\s+(?:(?:from\s+[^.!?]{1,70}?\s+)?(?:to|into|back to))\b|\bworks?\s+as\b|\b(?:is|was|became|becomes|remains|has become)\s+(?:now\s+|currently\s+|still\s+)?(?:dead|alive|resurrected|revived|injured|wounded|pregnant|missing|unconscious|awake|ill|sick|healthy|retired|imprisoned|incarcerated|hospitalized|hospitalised)\b|\b(?:is|became|becomes|remains)\s+(?:now\s+|currently\s+)?(?:married to|dating|engaged to|friends with|estranged from|divorced from|separated from|in a relationship with)\b|\b(?:real name is|is known as|codename is|code name is|alias is|goes by)\b|\b(?:joined|joins|is a member of|belongs to|works for)\b/i;
    if(stateLike.test(t))score+=5;

    const durable=/\b(?:arriv(?:e|es|ed)|depart(?:s|ed|ing)?|return(?:s|ed)?|relocat(?:e|es|ed)|discover(?:s|ed)?|learn(?:s|ed)?|reveal(?:s|ed)?|confirm(?:s|ed)?|admit(?:s|ted)?|prove(?:s|d)?|identify(?:ies|ied)?|capture(?:s|d)?|arrest(?:s|ed)?|kidnap(?:s|ped)?|abduct(?:s|ed)?|take(?:s|n)? hostage|released?|freed|rescued?|vapori[sz](?:e|es|ed)|disintegrat(?:e|es|ed)|drain(?:s|ed|ing)?|siphon(?:s|ed|ing)?|harvest(?:s|ed|ing)?|seize(?:s|d)?|escape(?:s|d)?|injur(?:e|es|ed)|wound(?:s|ed)?|hospitali[sz](?:e|es|ed)|die(?:s|d)?|dead|alive|destroy(?:s|ed)?|damage(?:s|d)?|repair(?:s|ed)?|offline|online|stolen|steal(?:s|ing)?|owns?|ownership|possess(?:es|ed)?|gives?|gave|takes?|took|loses?|lost|married|divorc(?:e|es|ed)|engag(?:e|es|ed)|dating|partner|pregnan(?:t|cy)|born|job|works? as|promot(?:e|es|ed)|retir(?:e|es|ed)|joins?|joined|leaves? (?:the )?(?:team|agency|group|faction)|real name|codename|alias|set(?:s|ting)? course|plot(?:s|ted|ting)? (?:a )?course|course for|en route|heading (?:for|to|toward|towards)|mission|objective|checkpoint|waypoint|dock(?:s|ed|ing)?|launch(?:es|ed|ing)?|board(?:s|ed|ing)?|transmit(?:s|ted|ting)?|transmission|signal|translation|route|anchor key|dead hour|revision mark|evidence|warrant|contract|database|injury|relationship)\b/i;
    if(durable.test(t))score+=4;

    const major=/\b(?:explosion|collapse|fire|attack|assault|fight|battle|ambush|rescue|hostage|evacuat(?:e|es|ed|ion)|containment|blackout|temporal|anomaly|orbit|pod|vehicle|ship|base|lab|hospital|police|time force|revision)\b/i;
    if(major.test(t)&&(names.length||world.length))score+=2;
    if(liveStrategicText(t))score+=6;
    if(/\b(?:set(?:s|ting)? course|course (?:is )?locked|en route|heading (?:for|to|toward|towards)|current destination|destination set)\b/i.test(t))score+=4;

    const transient=/\b(?:looks?|glances?|watches?|stares?|nods?|smiles?|grins?|shrugs?|tilts? (?:his|her|their|the) head|takes? one step|steps? (?:forward|back)|moves? (?:forward|back|closer)|hasn['’]t moved|has not moved|doesn['’]t move|does not move|hand (?:rests?|stays?|moves?)|gaze|breath|breathing|says?|asks?|replies?|answers?|murmurs?|mutters?|yells?|shouts?)\b/i;
    if(transient.test(t)&&!durable.test(t)&&!liveStrategicText(t))score-=3;

    const genericPlayer=/^(?:you|i)\s+(?:leave|wait|look|watch|walk|move|go|eat|sleep|sit|stand|nod|turn|run)\b/i;
    if(genericPlayer.test(t)&&!durable.test(t)&&!liveStrategicText(t))score-=5;
    if(/^['\"“”]?[^.!?]{0,45}['\"“”]?\s*(?:,\s*)?(?:he|she|they)\s+says?\b/i.test(t)&&!durable.test(t)&&!liveStrategicText(t))score-=3;
    if(!names.length&&!world.length&&/^(?:i|you|he|she|they|his|her|their)\b/i.test(low)&&!durable.test(t)&&!liveStrategicText(t))score-=2;
    if(/\b(?:i['’]?ll|i will)\s+(?:be|stay|remain)\s+(?:alive|there|ready|fine|okay)\b/i.test(t)&&!liveStrategicText(t))score-=9;
    try{f.cardScore18=score;}catch(_){}
    return score;
  }
  function liveFactCardEligible(f) {
    return !!f&&!f.superseded&&!liveLooksQuestion(f.text)&&liveFactDurabilityScore(f)>=3;
  }
  function liveFactFacet(f) {
    const t=cleanText(f&&f.text||f);
    if(/\b(?:set(?:s|ting)? course|course (?:is )?locked|plot(?:s|ted|ting)? (?:a )?course|en route|heading (?:for|to|toward|towards)|current destination|destination set)\b/i.test(t))return"mission-course";
    if(/\b(?:destroy(?:s|ed)?|collapse(?:s|d)?)\b[^.!?]{0,60}\b(?:station|base|node|garrison|checkpoint|waystation|facility)\b|\b(?:station|base|node|garrison|checkpoint|waystation|facility)\b[^.!?]{0,60}\b(?:destroyed|collapsed|gone|offline)\b/i.test(t))return"site-destruction";
    if(/\b(?:worldship|planet[- ]sized (?:ship|vessel|construct)|invasion)\b/i.test(t)&&/\b(?:earth|destination|hostile|toward|towards|headed|approach|threat)\b/i.test(t))return"strategic-threat";
    if(/\b(?:hidden|secret)\b[^.!?]{0,50}\b(?:ship|vessel|platform)\b|\b(?:ship|vessel|platform)\b[^.!?]{0,70}\bmonitor(?:s|ed|ing)?\b/i.test(t))return"strategic-reveal";
    if(/\b(?:dead|died|killed|vapori[sz](?:e|es|ed)|disintegrat(?:e|es|ed)|alive|missing|unconscious|passed out|awake|imprisoned|abduct(?:s|ed)?|kidnap(?:s|ped)?|takes? hostage|taken hostage|captur(?:e|es|ed)|in custody|releas(?:e|es|ed)|freed?|rescu(?:e|es|ed)|escap(?:e|es|ed))\b/i.test(t))return"status";
    if(/\b(?:drain(?:s|ed|ing)?|siphon(?:s|ed|ing)?|harvest(?:s|ed|ing)?)\b[^.!?]{0,90}\b(?:energy|power|solar|magic|temporal|spatial)\b|\b(?:energy|power|solar|magic|temporal|spatial)\b[^.!?]{0,90}\b(?:drain(?:s|ed|ing)?|siphon(?:s|ed|ing)?|harvest(?:s|ed|ing)?)\b/i.test(t))return"energy-drain";
    if(/\b(?:true form|real identity|revealed (?:as|to be)|one of the (?:four|five|six|seven|eight|nine|ten))\b/i.test(t))return"identity";
    if(/\b(?:married|divorced|engaged|dating|partner|relationship|estranged|separated)\b/i.test(t))return"relationship";
    if(/\b(?:arrived|departed|returned|relocated|moved to|moved into|left for)\b/i.test(t))return"movement";
    if(/\b(?:discover(?:s|ed)?|reveal(?:s|ed)?|confirm(?:s|ed)?|admit(?:s|ted)?|found|identified?)\b/i.test(t))return"discovery";
    return safeText(f&&f.status)==="FACT"?"event":"statement";
  }
  function liveFactPriority(f) {
    if(!f)return-99;
    if(Number.isFinite(f.priority18))return f.priority18;
    let n=liveFactDurabilityScore(f)*2+Math.max(0,importance(f.text));
    if(f.status==="FACT"||f.status==="NEGATED")n+=2;
    else if(/^(?:CLAIM|BELIEF|INFERENCE|UNCONFIRMED)$/.test(safeText(f.status)))n-=1;
    if(liveStrategicText(f.text))n+=4;
    try{f.priority18=n;}catch(_){}
    return n;
  }
  function liveFactsShareSubject(a,b) {
    if(!a||!b)return false;
    if(liveFactFacet(a)==="mission-course"&&liveFactFacet(b)==="mission-course")return true;
    const an=[].concat(a.names||[],a.world||[]), bn=new Set([].concat(b.names||[],b.world||[]));
    for(let i=0;i<an.length;i++)if(bn.has(an[i]))return true;
    const at=new Set(tokenList(a.text,16)), bt=tokenList(b.text,16); let overlap=0;
    for(let i=0;i<bt.length;i++)if(at.has(bt[i]))overlap++;
    return overlap>=3;
  }

  function addLiveFact(text, owners, turn, kind, mode, imp, src) {
    const r=root(); if(!r||!liveFactEligible(text,mode,imp))return;
    const shown=displayText(text,EIDETIC_CONFIG.LIVE_FACT_CHARS), status=evidenceState(shown,mode);
    const finalStatus=(kind==="output"&&status==="FACT"&&/\b(?:means? |therefore|must |designed |specifically target|proves?|obviously|clearly)\b/i.test(shown))?"INFERENCE":status;
    const names=namesMentioned(shown), world=worldEntitiesMentioned(shown);
    const fp=hash(finalStatus+"|"+shown.toLowerCase());
    if((r.liveFacts||[]).some(x=>x&&x.fp===fp))return;
    if (INGEST_ORIGIN === "bootstrap" && !BOOTSTRAP_CAPTURE_LIVE) return;
    const f={id:"lf"+(++r.seq),turn,kind,mode,status:finalStatus,text:shown,owners:Array.from(owners||[PLAYER]),names,world,src,fp,origin:INGEST_ORIGIN};
    f.facet=liveFactFacet(f); f.priority18=liveFactPriority(f);
    if(!liveFactCardEligible(f))return;
    // New output-confirmed state supersedes stale or player-proposed state in the same
    // durable facet. Historical facts remain elsewhere in episodic memory.
    if(finalStatus==="FACT"||finalStatus==="NEGATED"){
      for(let i=r.liveFacts.length-1;i>=0;i--){
        const old=r.liveFacts[i]; if(!old||old.superseded)continue;
        if(liveFactFacet(old)!==f.facet||!liveFactsShareSubject(old,f))continue;
        const age=Math.abs(Number(turn||0)-Number(old.turn||0));
        if(f.facet==="mission-course"||age<=18){old.superseded=true; old.supersededBy=f.id; r.stats.liveFactSupersessions=Number(r.stats.liveFactSupersessions||0)+1;}
        if(f.facet==="mission-course")break;
      }
    }
    r.liveFacts.push(f);
    if (INGEST_ORIGIN === "bootstrap") r.stats.bootstrapLiveFacts = Number(r.stats.bootstrapLiveFacts || 0) + 1;
    if(r.liveFacts.length>EIDETIC_CONFIG.LIVE_FACT_LIMIT)r.liveFacts.splice(0,r.liveFacts.length-EIDETIC_CONFIG.LIVE_FACT_LIMIT);
    r.stats.liveFacts=Number(r.stats.liveFacts||0)+1;
  }

  // -------------------------------------------------------------------------
  // Character Insight Ledger (Schema 17+, retained in Schema 18)
  // -------------------------------------------------------------------------
  function insightCategory(text, speech) {
    const t=cleanText(text);
    if(/\b(?:confess(?:es|ed|ion)?|admits?|admitted|i\s+(?:killed|murdered|betrayed|lied|stole|caused|did it)|truth is)\b/i.test(t))return"CONFESSION";
    if(/\b(?:threat(?:en|ens|ened)?|i['’]?ll\s+(?:kill|hurt|destroy|expose|ruin)|i will\s+(?:kill|hurt|destroy|expose|ruin))\b/i.test(t))return"THREAT";
    // "I'll need..." is a requirement/goal, not a promise. Reserve PROMISE for an
    // explicit oath or an actual commitment rather than every English contraction.
    if(/\b(?:promise(?:s|d)?|swear(?:s)?|swore|vow(?:s|ed)?)\b/i.test(t))return"PROMISE";
    if(/\b(?:i['’]?ll|i will)\s+(?!need\b|have to\b|try\b|see\b|check\b|look\b)(?:protect|return|come back|testify|help|save|bring|tell|stay|keep|stop|find|finish|deliver|do)\b/i.test(t))return"PROMISE";
    if(/\b(?:real name|known as|codename|code name|alias|true form|actually\s+(?:am|is|was)|identity|one of the (?:four|five|six|seven|eight|nine|ten))\b/i.test(t))return"IDENTITY";
    if(/\b(?:mother|father|mum|mom|dad|sister|brother|daughter|son|wife|husband|spouse|partner|married|dating|engaged|divorced|separated|love\b|trust\b|hate\b)\b/i.test(t))return"RELATIONSHIP";
    if(/\b(?:works? for|worked for|joined|member of|belongs to|loyal to|defect(?:s|ed)?|betray(?:s|ed)?|faction|agency|organization|organisation)\b/i.test(t))return"ALLEGIANCE";
    if(/\b(?:power|ability|weakness|allergy|immune|vulnerable|limit(?:s|ation)?|teleport(?:s|ed|ing|ation)?|flight|healing|regeneration|electrokinesis|telekinesis|sorcery|magic)\b/i.test(t))return"ABILITY";
    if(/\b(?:dead|died|killed|vapori[sz]ed|disintegrated|destroyed|alive|injured|wounded|pregnant|missing|abducted|kidnapped|captured|released|freed|rescued|unconscious|awake|passed out|diagnos(?:ed|is)|hospitali[sz]ed|ill|sick|healthy|recovered|cleared for (?:field )?duty|retired|imprisoned)\b/i.test(t))return"STATUS";
    if(/\b(?:secret|classified|hid(?:den)?|kept from|nobody knows|don['’]?t tell|never told|cover[- ]?up)\b/i.test(t))return"SECRET";
    if(/\b(?:plan(?:s|ned)?|intend(?:s|ed)?|goal|objective|want(?:s|ed)? to|need(?:s|ed)? to|going to|means? to|i['’]?ll need|i will need)\b/i.test(t))return"GOAL";
    if(/\b(?:refuse(?:s|d)?|won['’]?t|will not|never again|boundary|do not|don['’]?t)\b/i.test(t))return"BOUNDARY";
    if(/\b(?:remember(?:s|ed)?|saw|witnessed|knows?|knew|found out|learned that|was there|used to|back when|years ago|before i)\b/i.test(t))return"HISTORY";
    if(/\b(?:believe(?:s|d)?|think(?:s|ing)?|suspect(?:s|ed)?|fear(?:s|ed)?|theory|guess)\b/i.test(t))return"BELIEF";
    if(/\b(?:anchor key|dead hour|target|coordinates?|checkpoint|waypoint|rendezvous|deadline|attack starts|attack begins|operation starts|operation begins|hidden in|stored in|located in|located at)\b/i.test(t))return"INTEL";
    if(/\b(?:warn(?:s|ed)?|evidence|proof|saw|heard|tracked|recorded|found|discovered)\b/i.test(t))return"KNOWLEDGE";
    return speech?"STATEMENT":"REVEAL";
  }

  function insightNoise(text, category, speaker, score) {
    const t=cleanText(text), cat=safeText(category); if(!t)return true;
    if(t.length<10)return true;
    // Pure blocking/micro-behaviour is not durable character continuity.
    if(/^(?:[^.!?]{0,35}\b)?(?:looks?|glances?|gaze|nods?|smiles?|grins?|shrugs?|steps?|walks?|moves?|turns?|sits?|stands?|breathes?|watches?)\b/i.test(t) &&
       !/\b(?:dead|alive|missing|abducted|kidnapped|captured|released|injured|wounded|identity|real name|true form|works? for|joined|betrayed|promise|swear|vow|secret|power|ability|weakness|married|engaged|pregnant|evidence|coordinates?|target)\b/i.test(t))return true;
    if(/\b(?:gaze stays|eyes stay|looks at you|looks up|looks over|steps closer|takes a sip|sets (?:his|her|their) glass down)\b/i.test(t) && Number(score||0)<10)return true;
    if(cat==="STATEMENT" && Number(score||0)<8)return true;
    if(cat==="REVEAL" && Number(score||0)<8)return true;
    if(/\b(?:nice weather|good morning|coffee|tea|how's the|how is the)\b/i.test(t)&&Number(score||0)<10)return true;
    if(/\b(?:need(?:s|ed)? (?:a )?cover|need(?:s|ed)? clearance|need(?:s|ed)? a ride|need(?:s|ed)? transport|need(?:s|ed)? to get (?:there|back|home))\b/i.test(t))return true;
    if(/\b(?:out of powered work|no powered work)\b/i.test(t))return true;
    return false;
  }

  function importantSpeechScore(text, verb) {
    const t=cleanText(text); if(!t||t.length<8||/\?\s*$/.test(t))return-99;
    let score=importance(t);
    const wc=t.split(/\s+/).filter(Boolean).length;
    if(wc<3)score-=3;
    if(/^(?:okay|ok|yes|no|yeah|yeh|thanks|thank you|hello|hi|bye|goodnight|fine|sure|right)[.!?]*$/i.test(t))return-99;
    if(/\b(?:admit|admits|admitted|confess|confesses|confessed|reveal|reveals|revealed|promise|promises|promised|swear|swears|swore|vow|vows|vowed|warn|warns|warned|threaten|threatens|threatened|deny|denies|denied|insist|insists|insisted)\b/i.test(safeText(verb)))score+=4;
    if(/\b(?:i['’]?m|i am|i was|i did|i killed|i lied|i betrayed|i stole|i caused|my real name|i work for|i worked for|i joined|i left|i love|i hate|i trust|i don['’]?t trust|i know|i knew|i saw|i remember|i promise|i swear|i['’]?ll|i will|i won['’]?t|i refuse|i want to|i need to|i plan to|i['’]?m going to)\b/i.test(t))score+=3;
    const tags=semanticTags(t);
    if(tags.indexOf("@secret")>=0||tags.indexOf("@promise")>=0||tags.indexOf("@identity")>=0)score+=4;
    if(tags.indexOf("@relationship")>=0||tags.indexOf("@status")>=0||tags.indexOf("@ability")>=0||tags.indexOf("@affiliation")>=0||tags.indexOf("@role")>=0)score+=3;
    if(tags.indexOf("@item")>=0||tags.indexOf("@location")>=0||tags.indexOf("@organization")>=0)score+=2;
    if(/\b(?:anchor key|dead hour|target|coordinates?|checkpoint|waypoint|rendezvous|deadline|attack|operation|evidence|proof|hidden|stored|located|midnight|dawn)\b/i.test(t))score+=2;
    try{if(worldEntitiesMentioned(t).length)score+=2;}catch(_){}
    if(/\b(?:never|always|forever|important|remember this|the truth|nobody knows|don['’]?t tell)\b/i.test(t))score+=2;
    if(/\b(?:weather|food|coffee|tea|nice|good|bad|fine|okay|hello|good morning)\b/i.test(t)&&score<5)score-=2;
    return score;
  }

  function characterRevealSubjectEvidence(text, charKey) {
    const r=root(), ch=r&&r.chars?r.chars[charKey]:null; if(!ch)return false;
    if(stateSlotsForCharacter(text,charKey).length)return true;
    const a=aliasRegexSourceForCharacter(charKey); if(!a)return false;
    const t=cleanText(text);
    const direct=[
      "(?:^|[^A-Za-z0-9])"+a+"(?:['’]s)?\\s+[^.!?]{0,34}\\b(?:is|was|has|had|became|becomes|remains|turned out to be|works? for|worked for|joined|left|betrayed|killed|murdered|vapori[sz]ed|disintegrated|abducted|kidnapped|captured|released|freed|rescued|hid|stole|owns?|possesses?)\\b",
      "(?:^|[^A-Za-z0-9])"+a+"['’]s\\s+(?:real name|identity|true form|secret|mother|father|mum|mom|dad|sister|brother|daughter|son|wife|husband|spouse|partner|power|ability|weakness|allergy|diagnosis|injury|job|role|allegiance)\\b",
      "\\b(?:confirms?|confirmed|reveals?|revealed|proves?|proved|shows?|showed|discovers?|discovered|learns?|learned)\\b[^.!?]{0,90}(?:^|[^A-Za-z0-9])"+a+"\\s+(?:is|was|has|had|works?|worked|joined|left|killed|vapori[sz]ed|disintegrated|abducted|kidnapped|captured|released|betrayed|owns?|possesses?)\\b",
      "(?:^|[^A-Za-z0-9])"+a+"['’]s\\s+true form\\b",
      "\\b(?:vorunn|alien|infiltrator|observer)\\b[^.!?]{0,70}(?:^|[^A-Za-z0-9])"+a+"\\b|(?:^|[^A-Za-z0-9])"+a+"\\b[^.!?]{0,70}\\b(?:vorunn|alien|infiltrator|observer)\\b"
    ];
    for(let i=0;i<direct.length;i++)if(new RegExp(direct[i],"i").test(t))return true;
    return false;
  }

  function characterRevealScore(text, charKey, mode, imp) {
    const t=cleanText(text); if(!t||mode==="question")return-99;
    let score=Math.max(1,Number(imp)||1);
    const slots=stateSlotsForCharacter(t,charKey);
    if(slots.length)score+=4;
    if(/\b(?:reveal(?:s|ed)?|discover(?:s|ed)?|learn(?:s|ed)? that|confirm(?:s|ed)?|prove(?:s|d)?|real name|identity|secret|confess(?:es|ed)?|betray(?:s|ed)?|actually\s+(?:is|was)|turns out|was responsible|killed|murdered|vapori[sz]ed|disintegrated|abducted|kidnapped|captured|released|true form|one of the (?:four|five|six|seven|eight|nine|ten)|parent|mother|father|sister|brother|wife|husband|spouse|partner|pregnant|diagnos(?:ed|is)|power|ability|weakness|allergy|works? for|joined|left the|defect(?:s|ed)?)\b/i.test(t))score+=4;
    if(mode==="claim"||mode==="belief"||mode==="uncertain")score-=1;
    if(/\b(?:looks?|glances?|nods?|smiles?|shrugs?|steps?|walks?|sits?|stands?|breathes?|gaze|hand|eyes?)\b/i.test(t)&&!slots.length)score-=3;
    return score;
  }

  function insightStatefulCategory(category) {
    return /^(?:LOCATION|ROLE|STATUS|IDENTITY|ALLEGIANCE)$/.test(safeText(category));
  }

  function addCharacterInsight(subject, text, category, status, owners, turn, kind, src, score, speaker) {
    const r=root(); if(!r||!subject||!r.chars[subject])return false;
    const shown=displayText(text,EIDETIC_CONFIG.CHARACTER_INSIGHT_CHARS);
    if(!shown||Number(score)<5)return false;
    const cat=safeText(category)||"REVEAL", stat=safeText(status)||"FACT", sp=safeText(speaker)||"";
    const fp=hash(subject+"|"+cat+"|"+stat+"|"+cleanText(shown).toLowerCase());
    if((r.insights||[]).some(x=>x&&x.fp===fp))return false;
    if(insightStatefulCategory(cat)){
      for(let i=r.insights.length-1;i>=0;i--){
        const old=r.insights[i]; if(!old||old.subject!==subject||old.category!==cat||old.superseded)continue;
        old.superseded=true; old.supersededBy=fp; r.stats.characterInsightSupersessions=Number(r.stats.characterInsightSupersessions||0)+1; break;
      }
    }
    r.insights.push({id:"ci"+(++r.seq),turn,subject,speaker:sp,category:cat,status:stat,text:shown,owners:Array.from(new Set(owners||[PLAYER])),kind,src,score:Number(score)||5,fp,origin:INGEST_ORIGIN,superseded:false});
    if(r.insights.length>EIDETIC_CONFIG.CHARACTER_INSIGHT_LIMIT)r.insights.splice(0,r.insights.length-EIDETIC_CONFIG.CHARACTER_INSIGHT_LIMIT);
    r.stats.characterInsights=Number(r.stats.characterInsights||0)+1;
    r.runtime.insightSyncSig=""; r.runtime.recallCacheKey="";
    return true;
  }

  function speechVerbPattern() {
    return "(?:says?|said|tells?|told|replies?|replied|answers?|answered|admits?|admitted|confesses?|confessed|reveals?|revealed|explains?|explained|warns?|warned|promises?|promised|swears?|swore|vows?|vowed|insists?|insisted|denies|denied|threatens?|threatened|whispers?|whispered|shouts?|shouted|yells?|yelled|mutters?|muttered)";
  }

  function aliasRegexSourceForCharacter(charKey) {
    const r=root(), ch=r&&r.chars?r.chars[charKey]:null; if(!ch)return"";
    const forms=[ch.name].concat(ch.aliases||[]).map(x=>safeText(x).trim()).filter(Boolean).sort((a,b)=>b.length-a.length);
    return forms.length?"(?:"+forms.map(escapeRe).join("|")+")":"";
  }

  function captureImportantDialogue(text, kind, turn, srcHash) {
    const r=root(); if(!r)return 0;
    let added=0; const keys=Object.keys(r.chars||{}), verb=speechVerbPattern();
    for(let ki=0;ki<keys.length;ki++){
      const key=keys[ki], a=aliasRegexSourceForCharacter(key); if(!a)continue;
      const patterns=[
        new RegExp("(?:^|[\\n.!?])\\s*"+a+"\\s+("+verb+")[^\\\"“]{0,60}[\\\"“]([^\\\"”\\n]{3,520})[\\\"”]","gi"),
        new RegExp("[\\\"“]([^\\\"”\\n]{3,520})[\\\"”][^\\n.!?]{0,70}\\b"+a+"\\s+("+verb+")","gi"),
        new RegExp("(?:^|[\\n])\\s*"+a+"\\s*:\\s*([^\\n]{3,420})","gi")
      ];
      for(let pi=0;pi<patterns.length;pi++){
        let m; while((m=patterns[pi].exec(safeText(text)))!==null){
          let quote, v;
          if(pi===0){v=m[1];quote=m[2];} else if(pi===1){quote=m[1];v=m[2];} else {quote=m[1];v="speaker-label";}
          quote=cleanText(quote); const score=importantSpeechScore(quote,v); if(score<5)continue;
          const owners=ownerSetFor(m[0],kind); owners.add(key);
          const cat=insightCategory(quote,true);
          if(insightNoise(quote,cat,true,score))continue;
          if(addCharacterInsight(key,quote,cat,"CLAIM",owners,turn,kind,srcHash+":speech:"+ki+":"+pi,score,key))added++;
        }
      }
      // Reported speech without quotation marks, e.g. "Nadia admits she sabotaged it."
      const reported=new RegExp("(?:^|[\\n.!?])\\s*("+a+")\\s+("+verb+")\\s+([^.!?]{5,320})[.!?]","gi");
      let rm; while((rm=reported.exec(safeText(text)))!==null){
        const statement=cleanText(rm[3]), score=importantSpeechScore(statement,rm[2]); if(score<6)continue;
        const owners=ownerSetFor(rm[0],kind); owners.add(key);
        const category=insightCategory(statement,true); if(insightNoise(statement,category,true,score))continue;
        if(addCharacterInsight(key,statement,category,"CLAIM",owners,turn,kind,srcHash+":reported:"+ki,score,key))added++;
      }
    }
    return added;
  }

  function captureCharacterReveals(text, owners, turn, kind, mode, imp, src) {
    const r=root(); if(!r)return 0; const names=namesMentioned(text); if(!names.length)return 0;
    let added=0;
    for(let i=0;i<names.length;i++){
      const key=names[i]; if(!r.chars[key])continue;
      // If this sentence is plainly attributed speech, dialogue capture handles it as SAID/CLAIM.
      const a=aliasRegexSourceForCharacter(key), verb=speechVerbPattern();
      if(a && new RegExp("\\b"+a+"\\s+"+verb+"\\b","i").test(text))continue;
      if(!characterRevealSubjectEvidence(text,key))continue;
      const score=characterRevealScore(text,key,mode,imp); if(score<5)continue;
      const status=evidenceState(text,mode);
      const category=insightCategory(text,false);
      if(insightNoise(text,category,false,score))continue;
      if(addCharacterInsight(key,text,category,status,owners,turn,kind,src+":reveal:"+i,score,""))added++;
    }
    return added;
  }

  function stripInsightNotes(text) {
    return stripManagedEntryBlock(text,EIDETIC_INSIGHT_NOTES_OPEN,EIDETIC_INSIGHT_NOTES_CLOSE);
  }

  function insightLine(x) {
    const label=x.speaker?"SAID/"+safeText(x.status):safeText(x.status);
    return "T"+x.turn+" ["+label+" • "+safeText(x.category)+"] "+displayText(x.text,EIDETIC_CONFIG.CHARACTER_INSIGHT_CHARS);
  }

  function characterInsightsForNotes(charKey,limit) {
    const r=root(); if(!r)return[]; const out=[], seen=new Set(), max=limit||EIDETIC_CONFIG.CHARACTER_NOTE_INSIGHTS;
    for(let i=r.insights.length-1;i>=0&&out.length<max;i--){
      const x=r.insights[i]; if(!x||x.subject!==charKey||x.superseded||x.mirrorSuppressed)continue;
      if(Number(x.score||0)<6&&!/^(?:STATUS|IDENTITY|RELATIONSHIP|ABILITY|CONFESSION|SECRET|PROMISE|THREAT|ALLEGIANCE)$/.test(safeText(x.category)))continue;
      if(insightNoise(x.text,x.category,x.speaker,Number(x.score)||0))continue;
      if(x.speaker&&/\b(?:out of powered work|no powered work|cleared for powered work|medical restriction)\b/i.test(x.text)){
        const mentioned=namesMentioned(x.text); if(mentioned.some(k=>k!==charKey))continue;
      }
      const stateKey=insightStatefulCategory(x.category)?x.category:"";
      if(stateKey&&seen.has(stateKey))continue;
      if(stateKey)seen.add(stateKey);
      out.push(x);
    }
    return out;
  }

  function characterNotesAllowed() {
    const r=root(); if(!r||!r.runtime)return false;
    if(r.runtime.characterNotesPersistence!=="degraded")return true;
    return currentTurn()>=Number(r.runtime.characterNotesRetryTurn||0);
  }

  function tryWriteCharacterInsightNotes(card, text) {
    const r=root(); if(!card||typeof card!=="object"||!characterNotesAllowed())return false;
    let ok=false;
    try{card.description=text;ok=true;}catch(_){}
    try{card.notes=text;ok=true;}catch(_){}
    if(r&&r.runtime&&ok){
      r.runtime.characterNoteExpected={id:card.id!=null?card.id:null,hash:hash(text),turn:currentTurn()};
      r.runtime.characterNotesPersistence="pending";
    }
    return ok;
  }

  function verifyCharacterInsightNotesPersistence() {
    const r=root(); if(!r||!r.runtime||!r.runtime.characterNoteExpected)return;
    if(typeof storyCards==="undefined"||!Array.isArray(storyCards))return;
    const ex=r.runtime.characterNoteExpected; if(currentTurn()<=Number(ex.turn||0))return;
    let card=null;
    if(ex.id!=null)card=storyCards.find(c=>c&&String(c.id)===String(ex.id))||null;
    if(!card){r.runtime.characterNotesPersistence="degraded";r.runtime.characterNotesRetryTurn=currentTurn()+EIDETIC_CONFIG.STORY_CARD_RETRY_TURNS;r.runtime.characterNoteExpected=null;return;}
    const got=safeText(card.description||card.notes);
    if(hash(got)===safeText(ex.hash)){r.runtime.characterNotesPersistence="confirmed";}
    else {r.runtime.characterNotesPersistence="degraded";r.runtime.characterNotesRetryTurn=currentTurn()+EIDETIC_CONFIG.STORY_CARD_RETRY_TURNS;}
    r.runtime.characterNoteExpected=null;
  }

  function writeCharacterInsightNotes(charKey) {
    const idx=findStoryCardForCharacter(charKey); if(idx<0||!storyCards[idx])return false;
    const insights=characterInsightsForNotes(charKey,EIDETIC_CONFIG.CHARACTER_NOTE_INSIGHTS); if(!insights.length)return false;
    const c=storyCards[idx], current=safeText(c.description||c.notes), base=stripInsightNotes(current);
    const head=EIDETIC_INSIGHT_NOTES_OPEN+"\nIMPORTANT REVEALS / STATEMENTS FROM PLAYED CANON. SAID/CLAIM records what the character said; it is not automatically objective fact. Newer explicit evidence overrides stale entries.\n";
    let lines=insights.map(insightLine), block="";
    while(lines.length){
      block=head+lines.join("\n")+"\n"+EIDETIC_INSIGHT_NOTES_CLOSE;
      if(block.length<=EIDETIC_CONFIG.CHARACTER_NOTE_BLOCK_CHARS)break;
      lines.pop();
    }
    if(!lines.length)return false;
    const next=(base?base+"\n\n":"")+block;
    if(current===next)return false;
    if(!tryWriteCharacterInsightNotes(c,next))return false;
    const r=root(); r.stats.characterInsightNotes=Number(r.stats.characterInsightNotes||0)+1; r.stats.cardNoteWrites=Number(r.stats.cardNoteWrites||0)+1;
    return true;
  }

  function profileDeltaLine(x) {
    const label=x.speaker?"SAID/"+safeText(x.status):safeText(x.status);
    return "• T"+x.turn+" ["+label+" • "+safeText(x.category)+"] "+displayText(x.text,220);
  }

  function characterProfileFactAbout(f, charKey) {
    if(!f||!charKey)return false;
    const names=f.names||[]; if(names.indexOf(charKey)<0)return false;
    if(names.length===1)return true;
    const a=aliasRegexSourceForCharacter(charKey), t=cleanText(f.text); if(!a)return false;
    const subject=new RegExp("(?:^|[^A-Za-z0-9])"+a+"(?:['’]s)?\\s+[^.!?]{0,38}\\b(?:is|was|has|had|became|becomes|remains|returns?|arrives?|leaves?|dies?|dead|alive|missing|abduct(?:s|ed)?|kidnap(?:s|ped)?|captur(?:e|es|ed)|releas(?:e|es|ed)|freed?|rescu(?:e|es|ed)|vapori[sz](?:e|es|ed)|disintegrat(?:e|es|ed)|drain(?:s|ed|ing)?|reveals?|revealed)\\b","i");
    const object=new RegExp("\\b(?:abduct(?:s|ed)?|kidnap(?:s|ped)?|captur(?:e|es|ed)|releas(?:e|es|ed)|free(?:s|d)?|rescu(?:e|es|ed)|kill(?:s|ed)?|vapori[sz](?:e|es|ed)|disintegrat(?:e|es|ed)|drain(?:s|ed|ing)?|siphon(?:s|ed|ing)?)\\b[^.!?]{0,35}(?:^|[^A-Za-z0-9])"+a+"\\b","i");
    return subject.test(t)||object.test(t);
  }

  function characterProfileItems(charKey, limit) {
    const insights=characterInsightsForNotes(charKey,Math.max(1,limit||EIDETIC_CONFIG.CHARACTER_PROFILE_INSIGHTS));
    const out=[], seen=new Set();
    for(let i=0;i<insights.length;i++){
      const x=insights[i], fp=hash(cleanText(x.text).toLowerCase()); if(seen.has(fp))continue;
      seen.add(fp); out.push({kind:"insight",x,priority:Number(x.score||0)+(/^(?:IDENTITY|STATUS|RELATIONSHIP|ABILITY|CONFESSION|SECRET)$/.test(x.category)?16:8)});
    }
    // Objective high-priority state can still update a profile even when the sentence was
    // not phrased as a formal "reveal". This catches abduction/release/injury/death etc.
    const facts=liveFactsForCharacter(charKey,6);
    for(let i=0;i<facts.length;i++){
      const f=facts[i]; if(!f||f.superseded||f.status!=="FACT"||liveFactPriority(f)<14)continue;
      if(!characterProfileFactAbout(f,charKey))continue;
      if(!/^(?:status|relationship|movement|discovery|energy-drain|identity|event|site-destruction|strategic-reveal)$/.test(liveFactFacet(f)))continue;
      const fp=hash(cleanText(f.text).toLowerCase()); if(seen.has(fp))continue;
      seen.add(fp); out.push({kind:"fact",f,priority:liveFactPriority(f)});
    }
    out.sort((a,b)=>b.priority-a.priority||Number((b.x||b.f).turn||0)-Number((a.x||a.f).turn||0));
    return out.slice(0,Math.max(1,limit||EIDETIC_CONFIG.CHARACTER_PROFILE_INSIGHTS));
  }

  function writeCharacterProfileDelta(charKey) {
    if(!EIDETIC_CONFIG.SYNC_CHARACTER_PROFILE_DELTAS||!cardSyncAllowed(false))return false;
    const idx=findStoryCardForCharacter(charKey); if(idx<0||!storyCards[idx])return false;
    const items=characterProfileItems(charKey,EIDETIC_CONFIG.CHARACTER_PROFILE_INSIGHTS); if(!items.length)return false;
    const c=storyCards[idx], original=safeText(c.entry!=null?c.entry:c.value);
    let base=stripManagedEntryBlock(original,EIDETIC_PROFILE_OPEN,EIDETIC_PROFILE_CLOSE);
    base=stripManagedEntryBlock(base,EIDETIC_ENTRY_OPEN,EIDETIC_ENTRY_CLOSE);
    const head=EIDETIC_PROFILE_OPEN+"\nPLAYED CANON ABOUT THIS CHARACTER. This is author continuity, not automatic knowledge for every NPC. SAID/CLAIM is not objective fact.\n";
    let lines=items.map(it=>it.kind==="insight"?profileDeltaLine(it.x):("• T"+it.f.turn+" [FACT • "+liveFactFacet(it.f).toUpperCase()+"] "+displayText(it.f.text,220)));
    let block="";
    while(lines.length){
      block=head+lines.join("\n")+"\n"+EIDETIC_PROFILE_CLOSE;
      if(block.length<=EIDETIC_CONFIG.CHARACTER_PROFILE_BLOCK_CHARS && (base.length+2+block.length)<=EIDETIC_CONFIG.MAX_CHARACTER_CARD_ENTRY_CHARS)break;
      lines.pop();
    }
    if(!lines.length)return false;
    const next=(base?base+"\n\n":"")+block; if(next===original)return false;
    if(!persistStoryCard(idx,safeText(c.keys),next,safeText(c.type)||"Character"))return false;
    const r=root(); r.stats.characterProfileWrites=Number(r.stats.characterProfileWrites||0)+1; r.stats.cardEntryWrites=Number(r.stats.cardEntryWrites||0)+1;
    return true;
  }

  function backfillCharacterProfileDeltas(limit) {
    const r=root(); if(!r)return 0;
    const newest=Object.create(null);
    for(let i=0;i<(r.insights||[]).length;i++){
      const x=r.insights[i]; if(!x||x.superseded||!x.subject)continue;
      newest[x.subject]=Math.max(Number(newest[x.subject]||-1),Number(x.turn||0));
    }
    for(let i=0;i<(r.liveFacts||[]).length;i++){
      const f=r.liveFacts[i]; if(!f||f.superseded||f.status!=="FACT")continue;
      for(const k of (f.names||[]))newest[k]=Math.max(Number(newest[k]||-1),Number(f.turn||0));
    }
    const subjects=Object.keys(newest).sort((a,b)=>newest[b]-newest[a]);
    let writes=0, max=Math.max(1,Number(limit)||12);
    for(let i=0;i<subjects.length&&writes<max;i++)if(writeCharacterProfileDelta(subjects[i]))writes++;
    return writes;
  }

  function backfillCharacterInsightNotes(limit) {
    const r=root(); if(!r||!Array.isArray(r.insights)||!r.insights.length)return 0;
    const newest=Object.create(null);
    for(let i=0;i<r.insights.length;i++){
      const x=r.insights[i]; if(!x||x.superseded||!x.subject)continue;
      newest[x.subject]=Math.max(Number(newest[x.subject]||-1),Number(x.turn||0));
    }
    const subjects=Object.keys(newest).sort((a,b)=>newest[b]-newest[a]);
    let writes=0, max=Math.max(1,Number(limit)||12);
    for(let i=0;i<subjects.length&&writes<max;i++){
      if(findStoryCardForCharacter(subjects[i])<0)continue;
      if(writeCharacterInsightNotes(subjects[i]))writes++;
    }
    if(r.runtime)r.runtime.insightBackfillSig=hash(subjects.join("|")+"|"+subjects.map(k=>newest[k]).join("|"));
    return writes;
  }

  function migrateCharacterInsightsFromExistingMemory() {
    const r=root(); if(!r||!r.runtime||r.runtime.insightMigrationDone)return 0;
    if(!r.runtime.needsSchema17InsightMigration){r.runtime.insightMigrationDone=true;return 0;}
    let added=0;
    for(let i=0;i<(r.liveFacts||[]).length;i++){
      const f=r.liveFacts[i]; if(!f)continue;
      const before=(r.insights||[]).length;
      const mode=safeText(f.mode)||"event";
      captureImportantDialogue(f.text,f.kind||"output",Number(f.turn)||0,safeText(f.src)||"schema17-migration");
      captureCharacterReveals(f.text,new Set(f.owners||[PLAYER]),Number(f.turn)||0,f.kind||"output",mode,importance(f.text),safeText(f.src)||"schema17-migration");
      added+=(r.insights||[]).length-before;
    }
    r.runtime.needsSchema17InsightMigration=false; r.runtime.insightMigrationDone=true;
    r.stats.characterInsightMigrations=Number(r.stats.characterInsightMigrations||0)+added;
    if(added)r.runtime.insightSyncSig="";
    return added;
  }

  function retrieveCharacterInsights(charKey, query, plan, activeKeys, limit) {
    const r=root(); if(!r||!Array.isArray(r.insights)||!r.insights.length)return[];
    const tokens=(plan&&plan.lexicalTokens)||tokenList(query,16), turn=currentTurn(), out=[];
    const active=new Set(activeKeys||[]), directName=(plan&&plan.names||[]).indexOf(charKey)>=0;
    for(let i=r.insights.length-1;i>=0;i--){
      const x=r.insights[i]; if(!x||x.subject!==charKey)continue;
      if(x.superseded && !(plan&&plan.temporal==="earliest"))continue;
      // A character-specific PRIVATE section may only contain insight that character knows.
      if(EIDETIC_CONFIG.STRICT_KNOWLEDGE && (x.owners||[]).indexOf(charKey)<0)continue;
      let score=Number(x.score||5), overlaps=0; const low=cleanText(x.text).toLowerCase();
      for(let j=0;j<tokens.length;j++)if(tokens[j]&&low.indexOf(tokens[j])>=0){score+=3;overlaps++;}
      const age=Math.max(0,turn-Number(x.turn||0));
      if(directName)score+=8;
      if(active.has(charKey))score+=3;
      if(age<=8)score+=3; else if(age>120)score-=2;
      if(/^(?:PROMISE|CONFESSION|SECRET|IDENTITY|RELATIONSHIP|ALLEGIANCE|GOAL|BOUNDARY|THREAT)$/.test(x.category))score+=2;
      if(plan&&(plan.explicitRecall||plan.directQuestion)&&tokens.length&&overlaps===0)continue;
      if(plan&&(plan.explicitRecall||plan.directQuestion)&&!directName&&overlaps<2)continue;
      if(!directName&&!active.has(charKey)&&overlaps===0)continue;
      out.push({x,score,overlaps});
    }
    out.sort((a,b)=>b.score-a.score||Number(b.x.turn||0)-Number(a.x.turn||0));
    return out.slice(0,Math.max(1,limit||EIDETIC_CONFIG.CHARACTER_INSIGHT_RECALL)).map(v=>v.x);
  }

  function retrieveNarrativeCharacterInsights(query, plan, limit, activeKeys) {
    const r=root(); if(!r||!Array.isArray(r.insights)||!r.insights.length)return[];
    const raw=cleanText(query).toLowerCase(), tokens=(plan&&plan.lexicalTokens)||tokenList(query,18), turn=currentTurn(), out=[];
    const gate=Array.isArray(activeKeys)?activeKeys:[];
    for(let i=r.insights.length-1;i>=0;i--){
      const x=r.insights[i]; if(!x||x.superseded)continue;
      if(EIDETIC_CONFIG.STRICT_KNOWLEDGE){
        const owners=x.owners||[];
        if(owners.indexOf(PLAYER)<0)continue;
        let safe=true; for(let gi=0;gi<gate.length;gi++)if(owners.indexOf(gate[gi])<0){safe=false;break;}
        if(!safe)continue;
      }
      const ch=r.chars&&r.chars[x.subject], forms=ch?[ch.name].concat(ch.aliases||[]):[];
      let named=false; for(let fi=0;fi<forms.length;fi++){const n=normName(forms[fi]);if(n&&raw.indexOf(n)>=0){named=true;break;}}
      let score=Number(x.score||5)+(named?9:0), overlaps=0; const low=cleanText(x.text).toLowerCase();
      for(let j=0;j<tokens.length;j++)if(tokens[j]&&low.indexOf(tokens[j])>=0){score+=3;overlaps++;}
      const age=Math.max(0,turn-Number(x.turn||0)); if(age<=8)score+=2; else if(age>180)score-=2;
      if(/^(?:PROMISE|CONFESSION|SECRET|IDENTITY|RELATIONSHIP|ALLEGIANCE|GOAL|BOUNDARY|THREAT)$/.test(x.category))score+=2;
      if(plan&&(plan.explicitRecall||plan.directQuestion)&&tokens.length&&overlaps===0)continue;
      if(plan&&(plan.explicitRecall||plan.directQuestion)&&!named&&overlaps<2)continue;
      if(!named&&overlaps===0)continue;
      out.push({x,score});
    }
    out.sort((a,b)=>b.score-a.score||Number(b.x.turn||0)-Number(a.x.turn||0));
    return out.slice(0,Math.max(1,limit||EIDETIC_CONFIG.CHARACTER_INSIGHT_RECALL)).map(v=>v.x);
  }

  function findStoryCardForCharacter(charKey) {
    if(typeof storyCards==="undefined"||!Array.isArray(storyCards))return -1;
    const r=root(), ch=r&&r.chars?r.chars[charKey]:null; if(!ch)return -1;
    const forms=[ch.name].concat(ch.aliases||[]).map(normName).filter(Boolean), candidates=[];
    for(let i=0;i<storyCards.length;i++){
      const c=storyCards[i]||{}, type=safeText(c.type).toLowerCase(); if(!/character|npc|person|people|cast/.test(type))continue;
      const base=stableStoryCardEntry(c), id=normName(storyCardIdentityName(base)), title=normName(c.title), keys=splitKeys(c.keys).map(normName);
      if(!forms.some(f=>f===id||f===title||keys.indexOf(f)>=0))continue;
      const meta=(safeText(c.title)+"\n"+safeText(c.description!=null?c.description:c.notes)+"\n"+base), low=meta.toLowerCase();
      let score=0;
      if(forms.indexOf(title)>=0)score+=16;
      if(forms.indexOf(id)>=0)score+=14;
      if(forms.some(f=>keys.indexOf(f)>=0))score+=12;
      if(c.isPinned)score+=18;
      if(/\b(?:current player profile|current injury|current played|current:|active ethical conflict|current status|homecoming)\b/i.test(meta))score+=7;
      if(/\b(?:archive detail|historical reference|triggers disabled|archive profile|historical .* character|old episode|older season)\b/i.test(meta))score-=28;
      if(/\b(?:future v\d+ payoff|future direction|author plan|writer[- ]room)\b/i.test(meta))score-=18;
      if(base.indexOf(EIDETIC_PROFILE_OPEN)>=0)score+=3;
      if(/^name\s*:/i.test(base))score+=2;
      candidates.push({i,score});
    }
    if(!candidates.length)return -1;
    candidates.sort((a,b)=>b.score-a.score||b.i-a.i);
    if(candidates.length>1&&r&&r.stats)r.stats.characterCardSelectionRepairs=Number(r.stats.characterCardSelectionRepairs||0)+1;
    return candidates[0].i;
  }

  function liveFactsForCharacter(charKey, limit) {
    const r=root(); if(!r)return[];
    const max=limit||EIDETIC_CONFIG.CARD_NOTE_FACTS, direct=[], witnessed=[];
    // Character-card continuity is primarily ABOUT the character. Merely witnessing a
    // general scene must not evict direct personal/state facts from the small card block.
    for(let i=r.liveFacts.length-1;i>=0;i--){
      const f=r.liveFacts[i]; if(!f||!liveFactCardEligible(f))continue;
      if((f.names||[]).indexOf(charKey)>=0) direct.push(f);
      else if((f.owners||[]).indexOf(charKey)>=0) witnessed.push(f);
      if(direct.length>=max && witnessed.length>=max)break;
    }
    const picked=direct.slice(0,max);
    // Witness-only facts are useful as a last resort, but keep at most one and only
    // when the card has spare room after character-specific facts.
    if(picked.length<max && witnessed.length) picked.push(witnessed[0]);
    return picked.slice(0,max).sort((a,b)=>Number(a.turn||0)-Number(b.turn||0));
  }
  function liveFactLine(f){ return "T"+f.turn+" ["+f.status+"] "+displayText(f.text,EIDETIC_CONFIG.LIVE_FACT_CHARS); }
  function writeCharacterLiveNotes(charKey) {
    if(!EIDETIC_CONFIG.SYNC_STORY_CARD_ENTRIES)return false;
    if(!cardSyncAllowed(false))return false;
    const idx=findStoryCardForCharacter(charKey); if(idx<0)return false;
    let facts=liveFactsForCharacter(charKey,EIDETIC_CONFIG.CARD_NOTE_FACTS); if(!facts.length)return false;
    const c=storyCards[idx];
    const original=safeText(c.entry!=null?c.entry:c.value);
    const base=stripManagedEntryBlock(original,EIDETIC_ENTRY_OPEN,EIDETIC_ENTRY_CLOSE);
    // Never bloat a large hand-written card merely to mirror state that is already
    // available through Front Memory.
    if(base.length>=EIDETIC_CONFIG.MAX_CHARACTER_CARD_ENTRY_CHARS-220)return false;
    const header=EIDETIC_ENTRY_OPEN+"\n"+
      "PRIVATE CURRENT CONTINUITY. Do not grant this knowledge to other characters. "+
      "CLAIM/BELIEF/INFERENCE/UNCONFIRMED are not objective fact.\n";
    let lines=facts.map(liveFactLine);
    while(lines.length){
      const block=header+lines.join("\n")+"\n"+EIDETIC_ENTRY_CLOSE;
      const next=(base?base+"\n\n":"")+block;
      if(next.length<=EIDETIC_CONFIG.MAX_CHARACTER_CARD_ENTRY_CHARS){
        if(original===next)return false;
        if(!persistStoryCard(idx,safeText(c.keys),next,safeText(c.type)||"Character"))return false;
        const r=root();
        r.stats.cardEntryWrites=Number(r.stats.cardEntryWrites||0)+1;
        r.stats.cardNoteWrites=Number(r.stats.cardNoteWrites||0)+1;
        return true;
      }
      lines.shift();
    }
    return false;
  }

  function characterKeyForStoryCard(card) {
    if(!card)return "";
    const candidates=[];
    const id=storyCardIdentityName(stableStoryCardEntry(card));
    if(id)candidates.push(id);
    if(safeText(card.title).trim())candidates.push(safeText(card.title).trim());
    splitKeys(card.keys).forEach(k=>candidates.push(k));
    for(let i=0;i<candidates.length;i++){
      const k=getCharKey(candidates[i]);
      if(k)return k;
    }
    return "";
  }

  function managedFactLines(text, open, close) {
    text=safeText(text); const a=text.indexOf(open), b=text.indexOf(close);
    if(a<0||b<a)return[];
    const inner=text.slice(a+open.length,b), out=[];
    const re=/^\s*T(\d+)\s+\[([A-Z-]+)\]\s+(.+?)\s*$/gmi;
    let m;
    while((m=re.exec(inner))!==null){
      const turn=Math.max(0,Number(m[1])||0), status=safeText(m[2]).toUpperCase(), fact=cleanText(m[3]);
      if(!fact)continue;
      out.push({turn,status,text:fact});
    }
    return out;
  }

  function managedInsightLines(text) {
    text=safeText(text); const a=text.indexOf(EIDETIC_INSIGHT_NOTES_OPEN), b=text.indexOf(EIDETIC_INSIGHT_NOTES_CLOSE);
    if(a<0||b<a)return[];
    const inner=text.slice(a+EIDETIC_INSIGHT_NOTES_OPEN.length,b), out=[];
    const re=/^\s*T(\d+)\s+\[([^\]•]+?)(?:\s*•\s*([^\]]+))?\]\s+(.+?)\s*$/gmi;
    let m; while((m=re.exec(inner))!==null){
      const turn=Math.max(0,Number(m[1])||0), lead=safeText(m[2]).trim().toUpperCase(), category=safeText(m[3]||"REVEAL").trim().toUpperCase(), fact=cleanText(m[4]);
      if(!fact)continue;
      const speaker=/^SAID\//.test(lead), status=lead.replace(/^SAID\//,"");
      out.push({turn,status:/^(?:FACT|CLAIM|BELIEF|INFERENCE|UNCONFIRMED|NEGATED)$/.test(status)?status:"CLAIM",category,speaker,text:fact});
    }
    return out;
  }

  function managedProfileDeltaLines(text) {
    text=safeText(text); const a=text.indexOf(EIDETIC_PROFILE_OPEN), b=text.indexOf(EIDETIC_PROFILE_CLOSE);
    if(a<0||b<a)return[];
    const inner=text.slice(a+EIDETIC_PROFILE_OPEN.length,b), out=[];
    const re=/^\s*[•*-]?\s*T(\d+)\s+\[([^\]]+)\]\s+(.+?)\s*$/gmi;
    let m; while((m=re.exec(inner))!==null){
      const turn=Math.max(0,Number(m[1])||0), tag=safeText(m[2]).trim(), fact=cleanText(m[3]); if(!fact)continue;
      const parts=tag.split(/\s*•\s*/); let lead=safeText(parts[0]).trim().toUpperCase(), category=safeText(parts[1]||"REVEAL").trim().toUpperCase();
      const speaker=/^SAID\//.test(lead); if(speaker)lead=lead.replace(/^SAID\//,"");
      const status=/^(?:FACT|CLAIM|BELIEF|INFERENCE|UNCONFIRMED|NEGATED)$/.test(lead)?lead:(speaker?"CLAIM":"UNCONFIRMED");
      out.push({turn,status,category,speaker,text:fact});
    }
    return out;
  }

  function portableProfileFactSafe(text, charKey) {
    const t=cleanText(text); if(!t||!charKey)return false;
    // Bare dialogue fragments were a known legacy false-positive path. A portable objective
    // FACT must name its subject (or an unambiguous alias) in the sentence.
    if(/^[\"“”'‘’]/.test(t)||/^(?:i|we|you|he|she|they)\b/i.test(t))return false;
    const a=aliasRegexSourceForCharacter(charKey); if(!a)return false;
    try{return new RegExp("(?:^|[^A-Za-z0-9])"+a+"(?:[^A-Za-z0-9]|$)","i").test(t);}catch(_){return false;}
  }

  function importPortableProfileDeltasFromStoryCards() {
    const r=root(); if(!r||!r.runtime||r.runtime.profileDeltaImportDone)return 0;
    r.runtime.profileDeltaImportDone=true;
    if(typeof storyCards==="undefined"||!Array.isArray(storyCards))return 0;
    const seenFacts=new Set((r.liveFacts||[]).map(f=>safeText(f&&f.fp)).filter(Boolean));
    let imported=0;
    for(let i=0;i<storyCards.length;i++){
      const c=storyCards[i]||{}, type=safeText(c.type).toLowerCase(); if(!/character|npc|person|people|cast/.test(type))continue;
      const entry=safeText(c.entry!=null?c.entry:c.value); if(entry.indexOf(EIDETIC_PROFILE_OPEN)<0)continue;
      const key=characterKeyForStoryCard(c); if(!key)continue;
      // A duplicate/archive card must never override the card the current-card selector chose.
      if(findStoryCardForCharacter(key)!==i)continue;
      const rows=managedProfileDeltaLines(entry);
      for(let j=0;j<rows.length;j++){
        const x=rows[j], owners=x.speaker?[PLAYER,key]:[PLAYER], cat=x.category||insightCategory(x.text,!!x.speaker);
        if(x.speaker||x.status!=="FACT"){
          const score=Math.max(5,importance(x.text)+(/^(?:STATUS|IDENTITY|RELATIONSHIP|ABILITY|CONFESSION|SECRET|PROMISE)$/.test(cat)?4:1));
          if(insightNoise(x.text,cat,!!x.speaker,score))continue;
          if(addCharacterInsight(key,x.text,cat,x.status==="FACT"?"CLAIM":x.status,owners,x.turn,"output","story-card-profile-import:"+i+":"+j,score,x.speaker?key:""))imported++;
          continue;
        }
        if(!portableProfileFactSafe(x.text,key))continue;
        const names=Array.from(new Set([key].concat(namesMentioned(x.text)||[])));
        const fp=hash("FACT|"+cleanText(x.text).toLowerCase()); if(seenFacts.has(fp))continue;
        const f={id:"lf"+(++r.seq),turn:x.turn,kind:"output",mode:"event",status:"FACT",text:displayText(x.text,EIDETIC_CONFIG.LIVE_FACT_CHARS),owners:[PLAYER],names,world:[],src:"story-card-profile-import:"+i+":"+j,fp,origin:"profile-import"};
        f.facet=liveFactFacet(f); f.priority18=liveFactPriority(f);
        if(!liveFactCardEligible(f))continue;
        r.liveFacts.push(f); seenFacts.add(fp); imported++; r.stats.liveFacts=Number(r.stats.liveFacts||0)+1;
      }
    }
    if(r.liveFacts.length>EIDETIC_CONFIG.LIVE_FACT_LIMIT)r.liveFacts.splice(0,r.liveFacts.length-EIDETIC_CONFIG.LIVE_FACT_LIMIT);
    r.stats.profileDeltaImports=Number(r.stats.profileDeltaImports||0)+imported;
    if(imported){r.runtime.liveSyncSig="";r.runtime.insightSyncSig="";r.runtime.recallCacheKey="";}
    return imported;
  }

  function importManagedInsightsFromStoryCards() {
    // Retired Notes mirrors are cleanup-only in Schema 23 (continued from Schema 21). They are human-readable mirrors
    // and older builds could contain gestures/logistics or stale-season material. Never use
    // them to rebuild authoritative memory. PROFILE DELTA is the portable structured path.
    const r=root(); if(!r||!r.runtime||r.runtime.managedInsightImportDone)return 0;
    r.runtime.managedInsightImportDone=true;
    if(typeof storyCards==="undefined"||!Array.isArray(storyCards))return 0;
    let found=0;
    for(let i=0;i<storyCards.length;i++){
      const c=storyCards[i]||{}, notes=safeText(c.description||c.notes);
      if(notes.indexOf(EIDETIC_INSIGHT_NOTES_OPEN)>=0)found++;
    }
    if(found){r.runtime.needsSchema20CardCleanup=true;r.runtime.schema20CleanupIndex=0;r.stats.legacyManagedQuarantined=Number(r.stats.legacyManagedQuarantined||0)+found;}
    return 0;
  }

  function rescanSchema20RecentContinuity(limit) {
    const r=root(); if(!r||!r.runtime||r.runtime.schema20RescanDone)return 0;
    if(typeof history==="undefined"||!Array.isArray(history)||!history.length){r.runtime.schema20RescanDone=true;return 0;}
    const oldOrigin=INGEST_ORIGIN, oldOverride=TURN_OVERRIDE; INGEST_ORIGIN="schema20-rescan";
    const start=Math.max(0,history.length-Math.max(24,Number(limit)||160)), now=currentTurn();
    let factsBefore=(r.liveFacts||[]).length, insightsBefore=(r.insights||[]).length;
    try{
      for(let hi=start;hi<history.length;hi++){
        const h=history[hi]||{}, raw=cleanText(h.text||h.rawText||""); if(!raw)continue;
        const kind=/^(?:continue|output|ai)$/i.test(safeText(h.type))?"output":"input";
        // History often contains alternating player/model actions. Approximate turn numbers
        // preserve recency ordering without rewriting the episodic archive.
        const back=Math.floor((history.length-1-hi)/2); TURN_OVERRIDE=Math.max(0,now-back);
        discover(raw); const src=hash("schema20-rescan|"+kind+"|"+raw);
        captureImportantDialogue(raw,kind,currentTurn(),src);
        const chunks=chunkText(raw);
        for(let ci=0;ci<chunks.length;ci++){
          const c=chunks[ci], owners=ownerSetFor(c,kind), mode=epistemicMode(c,kind), imp=mode==="question"?1:importance(c);
          addLiveFact(c,owners,currentTurn(),kind,mode,imp,src+":"+ci);
          captureCharacterReveals(c,owners,currentTurn(),kind,mode,imp,src+":"+ci);
        }
      }
    } finally {INGEST_ORIGIN=oldOrigin;TURN_OVERRIDE=oldOverride;}
    r.runtime.schema20RescanDone=true;
    const df=Math.max(0,(r.liveFacts||[]).length-factsBefore), di=Math.max(0,(r.insights||[]).length-insightsBefore);
    r.stats.schema20RescanFacts=Number(r.stats.schema20RescanFacts||0)+df; r.stats.schema20RescanInsights=Number(r.stats.schema20RescanInsights||0)+di;
    if(df||di){
      r.runtime.liveSyncSig="";r.runtime.insightSyncSig="";r.runtime.recallCacheKey="";
      syncLiveStoryCards(true); backfillCharacterInsightNotes(12); backfillCharacterProfileDeltas(12);
    }
    return df+di;
  }

  function importManagedContinuityFromStoryCards() {
    // Schema 23 quarantine: legacy LIVE CONTINUITY/dashboard blocks are old UI mirrors.
    // They are deliberately NOT re-imported because a Story Card export can carry them
    // across seasons and resurrect obsolete dialogue as current canon.
    const r=root(); if(!r||!r.runtime||r.runtime.managedCardImportDone)return 0;
    r.runtime.managedCardImportDone=true;
    if(typeof storyCards==="undefined"||!Array.isArray(storyCards))return 0;
    let foundManaged=0;
    for(let i=0;i<storyCards.length;i++){
      const c=storyCards[i]||{}, type=safeText(c.type).toLowerCase(), entry=safeText(c.entry!=null?c.entry:c.value);
      if(/character|npc|person|people|cast/.test(type)&&entry.indexOf(EIDETIC_ENTRY_OPEN)>=0)foundManaged++;
      if(entry.indexOf(EIDETIC_CURRENT_OPEN)>=0)foundManaged++;
    }
    if(foundManaged){
      r.runtime.needsSchema16CardCleanup=true;r.runtime.managedCardCleanupIndex=0;
      r.runtime.needsSchema18CardCleanup=true;r.runtime.liveDashboardRemoved=false;
      r.stats.legacyManagedQuarantined=Number(r.stats.legacyManagedQuarantined||0)+foundManaged;
    }
    r.runtime.legacyManagedQuarantineDone=true;
    return 0;
  }

  function cleanupLegacyManagedCharacterCards(batch) {
    const r=root();
    if(!r||!r.runtime||!r.runtime.needsSchema16CardCleanup)return;
    if(typeof storyCards==="undefined"||!Array.isArray(storyCards))return;
    if(!cardSyncAllowed(false))return;
    let i=Math.max(0,Number(r.runtime.managedCardCleanupIndex)||0), handled=0;
    const max=Math.max(1,Math.min(8,Number(batch)||4));
    for(;i<storyCards.length&&handled<max;i++){
      const c=storyCards[i]||{}, type=safeText(c.type).toLowerCase();
      const original=safeText(c.entry!=null?c.entry:c.value);
      if(!/character|npc|person|people|cast/.test(type)||original.indexOf(EIDETIC_ENTRY_OPEN)<0)continue;
      handled++;
      const key=characterKeyForStoryCard(c);
      const facts=key?liveFactsForCharacter(key,EIDETIC_CONFIG.CARD_NOTE_FACTS):[];
      if(EIDETIC_CONFIG.SYNC_STORY_CARD_ENTRIES&&key&&facts.length){
        writeCharacterLiveNotes(key);
      }else{
        const base=stripManagedEntryBlock(original,EIDETIC_ENTRY_OPEN,EIDETIC_ENTRY_CLOSE);
        if(base!==original)persistStoryCard(i,safeText(c.keys),base,safeText(c.type)||"Character");
      }
    }
    r.runtime.managedCardCleanupIndex=i;
    // Schema 18 keeps live continuity internal; never recreate the retired dashboard.
    if(i>=storyCards.length){
      r.runtime.needsSchema16CardCleanup=false;
      r.runtime.managedCardCleanupIndex=0;
    }
  }

  function cleanupSchema20CharacterCardClutter(batch) {
    const r=root(); if(!r||!r.runtime||!r.runtime.needsSchema20CardCleanup)return false;
    if(typeof storyCards==="undefined"||!Array.isArray(storyCards))return false;
    if(!cardSyncAllowed(false))return false;
    let i=Math.max(0,Number(r.runtime.schema20CleanupIndex)||0), handled=0, changed=false;
    const max=Math.max(1,Math.min(10,Number(batch)||5));
    for(;i<storyCards.length&&handled<max;i++){
      const c=storyCards[i]||{}, type=safeText(c.type).toLowerCase(); if(!/character|npc|person|people|cast/.test(type))continue;
      let original=safeText(c.entry!=null?c.entry:c.value), next=original;
      if(next.indexOf(EIDETIC_ENTRY_OPEN)>=0)next=stripManagedEntryBlock(next,EIDETIC_ENTRY_OPEN,EIDETIC_ENTRY_CLOSE);
      // Keep Schema 20 profile deltas intact. They are already compact, AI-visible managed
      // continuity and may be the only portable continuity carried in an exported Story Card.
      // writeCharacterProfileDelta() replaces this block safely when newer played canon exists.
      handled++;
      if(next!==original){persistStoryCard(i,safeText(c.keys),next,safeText(c.type)||"Character");changed=true;r.stats.schema20CardCleanups=Number(r.stats.schema20CardCleanups||0)+1;}
      // Remove old noisy Notes block; a clean selective mirror will be recreated only for
      // the best active card selected for each character.
      const notes=safeText(c.description||c.notes);
      if(notes.indexOf(EIDETIC_INSIGHT_NOTES_OPEN)>=0){
        const clean=stripInsightNotes(notes); tryWriteCharacterInsightNotes(c,clean); changed=true;
      }
    }
    r.runtime.schema20CleanupIndex=i;
    if(i>=storyCards.length){
      r.runtime.needsSchema20CardCleanup=false;r.runtime.schema20CleanupIndex=0;r.runtime.insightSyncSig="";r.runtime.profileDeltaSig="";
      backfillCharacterInsightNotes(12);
      backfillCharacterProfileDeltas(12);
    }
    return changed;
  }

  function cleanupSchema18StoryCardClutter() {
    const r=root(); if(!r||!r.runtime)return false;
    // The old dashboard was useful for debugging but duplicated Front Memory and cluttered
    // users' Story Card lists. Import happens before this cleanup, so no old durable facts
    // are lost when upgrading.
    const idx=findCurrentContinuityCardIndex();
    if(idx<0){r.runtime.needsSchema18CardCleanup=false;r.runtime.liveDashboardRemoved=true;r.runtime.liveCardId="";return false;}
    if(typeof removeStoryCard!=="function"){
      // Do not destructively fake a deletion on clients that do not expose the helper.
      // AUTO_CURRENT_CONTINUITY_CARD=false guarantees the old card will never be rewritten.
      r.runtime.needsSchema18CardCleanup=false;
      return false;
    }
    try{
      removeStoryCard(idx);
      r.runtime.liveCardId="";
      r.runtime.liveDashboardRemoved=true;
      r.runtime.needsSchema18CardCleanup=false;
      r.stats.liveDashboardRemovals=Number(r.stats.liveDashboardRemovals||0)+1;
      r.runtime.currentCardSeedSig="";
      r.runtime.currentCardSeedScanTurn=-1;
      r.runtime.currentCardSeedCardCount=-1;
      return true;
    }catch(_){r.runtime.needsSchema18CardCleanup=false;return false;}
  }

  function findCurrentContinuityCardIndex(){
    if(typeof storyCards==="undefined"||!Array.isArray(storyCards))return -1; const r=root(), id=r&&r.runtime?r.runtime.liveCardId:"";
    if(id!==""&&id!=null)for(let i=0;i<storyCards.length;i++)if(storyCards[i]&&String(storyCards[i].id)===String(id))return i;
    for(let i=0;i<storyCards.length;i++){const c=storyCards[i]||{}, keys=splitKeys(c.keys);if(keys.indexOf(EIDETIC_CONFIG.CURRENT_CONTINUITY_KEY)>=0||safeText(c.title)==="🧠 EIDETIC — Current Played Continuity")return i;} return -1;
  }
  function currentContinuityCardEntry(facts) {
    const lines=(facts||[]).map(liveFactLine);
    return "EIDETIC — CURRENT PLAYED CONTINUITY\n"+
      "Generated from live play. Newer played events supersede stale setup/history. "+
      "FACT is observed/played; CLAIM, BELIEF, INFERENCE and UNCONFIRMED must not be silently promoted.\n"+
      EIDETIC_CURRENT_OPEN+"\n"+
      (lines.length?lines.join("\n"):"No durable played facts captured yet.")+"\n"+
      EIDETIC_CURRENT_CLOSE;
  }

  function ensureCurrentContinuityCard(){
    if(!EIDETIC_CONFIG.AUTO_CURRENT_CONTINUITY_CARD||typeof storyCards==="undefined"||!Array.isArray(storyCards))return null;
    const r=root();
    let idx=findCurrentContinuityCardIndex();
    if(idx<0&&!cardSyncAllowed(false))return null;
    if(idx<0&&typeof addStoryCard==="function"){
      try{
        const made=addStoryCard(EIDETIC_CONFIG.CURRENT_CONTINUITY_KEY,currentContinuityCardEntry([]),"Custom");
        if(Number.isInteger(made))idx=made;
        if(idx<0)idx=findCurrentContinuityCardIndex();
      }catch(_){}
    }
    if(idx<0||!storyCards[idx]){
      if(r&&r.runtime){
        r.runtime.cardPersistence="degraded";
        r.runtime.cardWriteFailures=Number(r.runtime.cardWriteFailures||0)+1;
        r.runtime.cardRetryTurn=currentTurn()+EIDETIC_CONFIG.STORY_CARD_RETRY_TURNS;
      }
      return null;
    }
    const c=storyCards[idx];
    if(c.id!=null&&r&&r.runtime)r.runtime.liveCardId=c.id;
    // title is best-effort metadata only; keys/entry/type are the supported scripting fields.
    try{c.title="🧠 EIDETIC — Current Played Continuity";}catch(_){}
    return {card:c,index:idx};
  }

  function syncCurrentContinuityCard(){
    if(!EIDETIC_CONFIG.AUTO_CURRENT_CONTINUITY_CARD)return false;
    const r=root(),found=ensureCurrentContinuityCard(); if(!r||!found)return false;
    const c=found.card, idx=found.index;
    const facts=(r.liveFacts||[]).filter(liveFactCardEligible).slice(-EIDETIC_CONFIG.CURRENT_CARD_FACTS);
    const next=currentContinuityCardEntry(facts);
    const old=safeText(c.entry!=null?c.entry:c.value);
    if(old===next && safeText(c.keys)===EIDETIC_CONFIG.CURRENT_CONTINUITY_KEY && safeText(c.type)==="Custom")return false;
    if(!persistStoryCard(idx,EIDETIC_CONFIG.CURRENT_CONTINUITY_KEY,next,"Custom"))return false;
    r.stats.liveCardWrites=Number(r.stats.liveCardWrites||0)+1;
    return true;
  }

  function syncLiveStoryCards(force){
    const r=root(); if(!r||typeof storyCards==="undefined"||!Array.isArray(storyCards))return;
    if(!cardSyncAllowed(!!force))return;
    const t=currentTurn(), lf=r.liveFacts||[], ins=r.insights||[];
    const last=lf.length?lf[lf.length-1]:null, lastI=ins.length?ins[ins.length-1]:null;
    const sig=lf.length+"|"+(last?(last.fp||last.id||""):"")+"|"+ins.length+"|"+(lastI?(lastI.fp||lastI.id||""):"");
    if(!force && r.runtime.liveSyncSig===sig && r.runtime.insightSyncSig===sig)return;
    const touched=new Set();
    for(let i=Math.max(0,lf.length-18);i<lf.length;i++){
      const f=lf[i]||{}; if(Number(f.turn||0)<t-2)continue; (f.names||[]).forEach(k=>touched.add(k));
    }
    for(let i=Math.max(0,ins.length-18);i<ins.length;i++){
      const x=ins[i]||{}; if(Number(x.turn||0)<t-3)continue; if(x.subject)touched.add(x.subject);
    }
    touched.forEach(k=>{if(EIDETIC_CONFIG.SYNC_STORY_CARD_ENTRIES)writeCharacterLiveNotes(k);writeCharacterInsightNotes(k);writeCharacterProfileDelta(k);});
    r.runtime.liveSyncTurn=t; r.runtime.liveSyncSig=sig; r.runtime.insightSyncSig=sig;
  }

  function storyCardCharacterSeedPriority(card, index) {
    if(!card)return-999;
    const type=safeText(card.type).toLowerCase(); if(!/character|npc|person|people|cast/.test(type))return-999;
    const entry=stableStoryCardEntry(card), meta=safeText(card.title)+"\n"+safeText(card.description!=null?card.description:card.notes)+"\n"+entry;
    let score=0;
    if(card.isPinned)score+=100;
    if(/\b(?:current player profile|current injury|current status|current played|current:|active ethical conflict|homecoming|series regular|active story)\b/i.test(meta))score+=35;
    if(/\b(?:archive detail|historical reference|triggers disabled|archive profile|historical .* character|old episode|older season)\b/i.test(meta))score-=80;
    if(/\b(?:future v\d+ payoff|future direction|author plan|writer[- ]room)\b/i.test(meta))score-=55;
    if(/^name\s*:/i.test(entry))score+=8;
    if(safeText(card.keys).trim())score+=4;
    // A tiny recency tiebreaker makes later imported active profiles beat an earlier duplicate
    // without letting array order overpower explicit current/archive metadata.
    score+=Math.min(4,Math.max(0,Number(index)||0)/10000);
    return score;
  }

  function seedFromStoryCards() {
    if (typeof storyCards === "undefined" || !Array.isArray(storyCards)) return false;
    const r = root();
    const scanTurn=currentTurn(), count=storyCards.length, interval=Math.max(1,Number(EIDETIC_CONFIG.STORY_CARD_SCAN_INTERVAL)||6);
    const quickParts=[];
    for(let qi=0;qi<storyCards.length;qi++){const qc=storyCards[qi]||{}, qt=safeText(qc.type).toLowerCase();if(/character|npc|person|people|cast/.test(qt))quickParts.push([safeText(qc.id),qt,safeText(qc.title),safeText(qc.keys)].join("|"));}
    const quickSig=hash(quickParts.join("\u001e"));
    if(r&&r.runtime&&r.runtime.storyCardSig&&r.runtime.storyCardQuickSig===quickSig&&Number(r.runtime.storyCardCount)===count&&Number(r.runtime.storyCardScanTurn)>=0&&scanTurn>=Number(r.runtime.storyCardScanTurn)&&scanTurn-Number(r.runtime.storyCardScanTurn)<interval)return false;
    const sigParts = [];
    for (let i = 0; i < storyCards.length; i++) {
      const c = storyCards[i] || {};
      const type = safeText(c.type).toLowerCase();
      if (!/character|npc|person|people|cast/.test(type)) continue;
      const entryForSig = stableStoryCardEntry(c);
      sigParts.push(safeText(c.id) + "|" + type + "|" + safeText(c.title) + "|" + safeText(c.keys) + "|" + entryForSig);
    }
    const sig = hash(sigParts.join("\u001e"));
    if (r && r.runtime && r.runtime.storyCardSig === sig) return false;
    const seedOrder=[];
    for(let si=0;si<storyCards.length;si++){
      const sc=storyCards[si]||{}, st=safeText(sc.type).toLowerCase();
      if(/character|npc|person|people|cast/.test(st))seedOrder.push({i:si,score:storyCardCharacterSeedPriority(sc,si)});
    }
    seedOrder.sort((a,b)=>b.score-a.score||b.i-a.i);
    for (let oi = 0; oi < seedOrder.length; oi++) {
      const i=seedOrder[oi].i, c = storyCards[i] || {};
      const type = safeText(c.type).toLowerCase();
      const entry = stableStoryCardEntry(c);
      const rawKeys = splitKeys(c.keys).map(x => safeText(x).trim()).filter(Boolean);
      const characterish = /character|npc|person|people|cast/.test(type);
      if (!characterish) continue;

      const entryIdentity = storyCardIdentityName(entry);
      const titleName = safeText(c.title).trim();
      let canonical = "";
      if (entryIdentity && isPlausibleName(entryIdentity, true)) canonical = entryIdentity;
      else if (titleName && isPlausibleName(titleName, true) && detectionPenalty(titleName) < 8) canonical = titleName;
      else {
        for (let j = 0; j < rawKeys.length; j++) {
          if (isPlausibleName(rawKeys[j], true) && detectionPenalty(rawKeys[j]) < 8) { canonical = rawKeys[j]; break; }
        }
      }
      if (!canonical || isPlayerName(canonical)) continue;
      let charKey = ensureChar(canonical, entryIdentity ? "story-card-entry" : "story-card", true);
      if (!charKey) continue;
      if (entryIdentity && isPlausibleName(entryIdentity, true)) charKey = ensureChar(entryIdentity, "story-card-entry", true) || charKey;
      for (let j = 0; j < rawKeys.length; j++) {
        const alias = rawKeys[j];
        if (storyCardAliasCandidate(alias, canonical, entryIdentity, entry)) addAliasToCharacter(charKey, alias, "story-card-alias");
      }
      if (entryIdentity) addAliasToCharacter(charKey, entryIdentity, "story-card-entry");
    }
    if (r && r.runtime) { r.runtime.storyCardSig = sig; r.runtime.storyCardQuickSig=quickSig; r.runtime.storyCardScanTurn=scanTurn; r.runtime.storyCardCount=count; }
    return true;
  }

  function currentCardSeedScore(card) {
    if(!card)return-99;
    const type=safeText(card.type).toLowerCase();
    if(/character|npc|person|people|cast/.test(type))return-99;
    const title=safeText(card.title), desc=safeText(card.description!=null?card.description:card.notes), entry=stableStoryCardEntry(card);
    const all=(title+"\n"+desc+"\n"+entry+"\n"+safeText(card.keys));
    if(!entry||splitKeys(card.keys).indexOf(EIDETIC_CONFIG.CONFIG_CARD_KEY)>=0||/EIDETIC/i.test(title))return-99;
    // Schema 20: never guess which of hundreds of Story Cards represents "now". A card
    // becomes a global baseline only through a deliberate EIDETIC marker. This prevents an
    // old season card containing phrases such as "moving state" from contaminating a new era.
    const explicit=splitKeys(card.keys).indexOf(EIDETIC_CONFIG.CURRENT_CARD_SEED_MARKER)>=0 || /\bEIDETIC CURRENT SEED\b/i.test(all);
    if(EIDETIC_CONFIG.CURRENT_CARD_SEED_MODE==="explicit"&&!explicit)return-99;
    if(!explicit)return-99;
    if(/\b(?:archive detail|historical reference|triggers disabled|superseded|future direction|author plan|writer[- ]room)\b/i.test(all))return-30;
    return 20;
  }

  function refreshCurrentCardSeeds() {
    const r=root(); if(!r||!r.runtime||typeof storyCards==="undefined"||!Array.isArray(storyCards))return false;
    const scanTurn=currentTurn(), count=storyCards.length, interval=Math.max(1,Number(EIDETIC_CONFIG.CURRENT_CARD_SEED_SCAN_INTERVAL)||6);
    const quickParts=[];
    for(let qi=0;qi<storyCards.length;qi++){const qc=storyCards[qi]||{}, qt=safeText(qc.type).toLowerCase();if(/character|npc|person|people|cast/.test(qt)||/EIDETIC/i.test(safeText(qc.title)))continue;quickParts.push([safeText(qc.id),qt,safeText(qc.title),safeText(qc.keys),safeText(qc.description!=null?qc.description:qc.notes)].join("|"));}
    const quickSig=hash(quickParts.join("\u001e"));
    if(r.runtime.currentCardSeedSig&&r.runtime.currentCardSeedQuickSig===quickSig&&Number(r.runtime.currentCardSeedCardCount)===count&&Number(r.runtime.currentCardSeedScanTurn)>=0&&scanTurn>=Number(r.runtime.currentCardSeedScanTurn)&&scanTurn-Number(r.runtime.currentCardSeedScanTurn)<interval)return false;
    const sigParts=[];
    for(let i=0;i<storyCards.length;i++){
      const c=storyCards[i]||{}, type=safeText(c.type).toLowerCase();
      if(/character|npc|person|people|cast/.test(type)||/EIDETIC/i.test(safeText(c.title)))continue;
      sigParts.push([safeText(c.id),type,safeText(c.title),safeText(c.keys),safeText(c.description!=null?c.description:c.notes),stableStoryCardEntry(c)].join("|"));
    }
    const sig=hash(sigParts.join("\u001e"));
    if(r.runtime.currentCardSeedSig===sig)return false;
    const seeds=[];
    for(let i=0;i<storyCards.length;i++){
      const c=storyCards[i]||{}, score=currentCardSeedScore(c); if(score<6)continue;
      const entry=stableStoryCardEntry(c); if(!entry)continue;
      const title=safeText(c.title)||safeText(c.keys)||("Story Card "+i);
      const seedAll=title+"\n"+safeText(c.description)+"\n"+entry+"\n"+safeText(c.keys);
      const strong=splitKeys(c.keys).indexOf(EIDETIC_CONFIG.CURRENT_CARD_SEED_MARKER)>=0||/\bEIDETIC CURRENT SEED\b/i.test(seedAll);
      seeds.push({id:safeText(c.id)||String(i),title,score,strong,text:displayText(entry,EIDETIC_CONFIG.CURRENT_CARD_SEED_CHARS),tokens:tokenList(title+" "+entry,24)});
    }
    seeds.sort((a,b)=>b.score-a.score||String(a.title).localeCompare(String(b.title)));
    r.runtime.currentCardSeeds=seeds.slice(0,12);
    r.runtime.currentCardSeedSig=sig;
    r.runtime.currentCardSeedQuickSig=quickSig;
    r.runtime.currentCardSeedScanTurn=scanTurn;
    r.runtime.currentCardSeedCardCount=count;
    r.stats.currentCardSeedScans=Number(r.stats.currentCardSeedScans||0)+1;
    return true;
  }
  function relevantCurrentCardSeeds(query, plan, liveNow) {
    const r=root(); if(!r||!r.runtime||!Array.isArray(r.runtime.currentCardSeeds))return[];
    const tokens=(plan&&plan.lexicalTokens)||tokenList(query,20), live=(liveNow||[]).map(f=>cleanText(f.text).toLowerCase());
    const ranked=[];
    for(let i=0;i<r.runtime.currentCardSeeds.length;i++){
      const x=r.runtime.currentCardSeeds[i]; if(!x)continue;
      let score=Number(x.score||0), overlaps=0; const low=cleanText(x.text).toLowerCase();
      for(let j=0;j<tokens.length;j++)if(tokens[j]&&low.indexOf(tokens[j])>=0){score+=3;overlaps++;}
      // Avoid spending Front Memory twice on a line that is already nearly verbatim in live facts.
      let duplicate=false;
      for(let li=0;li<live.length;li++)if(live[li]&&low.indexOf(live[li])>=0){duplicate=true;break;}
      if(duplicate)score-=5;
      if(!x.strong&&overlaps===0)continue;
      ranked.push({x,score,overlaps});
    }
    ranked.sort((a,b)=>b.score-a.score||b.overlaps-a.overlaps);
    const out=[], seen=new Set(), max=Math.max(0,Number(EIDETIC_CONFIG.CURRENT_CARD_SEED_LIMIT)||0);
    for(let i=0;i<ranked.length&&out.length<max;i++){
      const x=ranked[i].x, fp=hash(cleanText(x.text).toLowerCase()); if(seen.has(fp))continue;
      seen.add(fp); out.push(x);
    }
    if(out.length)r.stats.currentCardSeedRecalls=Number(r.stats.currentCardSeedRecalls||0)+1;
    return out;
  }

  function candidateNamesFromText(text) {
    return candidateEvidenceFromText(text).map(e => e.name);
  }

  function discover(text) {
    const r = root();
    if (!r) return;
    const evidence = candidateEvidenceFromText(text);
    for (let i = 0; i < evidence.length; i++) {
      const e = evidence[i];
      ensureChar(e.name, "text:" + (e.reasons[0] || "detected"), false, e);
    }
    pruneNameCandidates();
  }

  function aliasIndex() {
    const r = root();
    if (!r) return { map: Object.create(null), patterns: [] };
    const keys = Object.keys(r.chars).sort();
    const sigParts = [];
    for (let i = 0; i < keys.length; i++) {
      const ch = r.chars[keys[i]] || {};
      sigParts.push(keys[i] + ":" + (ch.aliases || [ch.name]).map(normName).join(","));
    }
    const sig = hash(sigParts.join("|"));
    if (ALIAS_CACHE && ALIAS_CACHE_SIG === sig) return ALIAS_CACHE;
    const map = Object.create(null), patterns = [];
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i], ch = r.chars[key] || {};
      const aliases = Array.isArray(ch.aliases) && ch.aliases.length ? ch.aliases : [ch.name];
      for (let j = 0; j < aliases.length; j++) {
        const raw = safeText(aliases[j]).trim();
        const n = normName(raw);
        if (!raw || !n) continue;
        if (n.indexOf(" ") < 0 && (r.ambiguousFirstNames || []).indexOf(n) >= 0) continue;
        if (map[n] == null) map[n] = key;
        patterns.push({
          key,
          len: raw.length,
          re: new RegExp("(^|[^A-Za-z0-9À-ÖØ-öø-ÿĀ-ſ])" + escapeRe(raw) + "([^A-Za-z0-9À-ÖØ-öø-ÿĀ-ſ]|$)", "i")
        });
      }
    }
    patterns.sort((a,b) => b.len - a.len);
    ALIAS_CACHE_SIG = sig;
    ALIAS_CACHE = { map, patterns };
    return ALIAS_CACHE;
  }

  function namesMentioned(text) {
    const r = root();
    if (!r) return [];
    const out = [], seen = new Set();
    const raw = safeText(text);
    const idx = aliasIndex();
    for (let i = 0; i < idx.patterns.length; i++) {
      const p = idx.patterns[i];
      if (seen.has(p.key)) continue;
      if (p.re.test(raw)) { seen.add(p.key); out.push(p.key); }
    }
    const ambiguous = r.ambiguousFirstNames || [];
    for (let i = 0; i < ambiguous.length; i++) {
      const first = ambiguous[i];
      if (!new RegExp("(^|[^A-Za-z0-9À-ÖØ-öø-ÿĀ-ſ])" + escapeRe(first) + "([^A-Za-z0-9À-ÖØ-öø-ÿĀ-ſ]|$)", "i").test(raw)) continue;
      const active = uniqueActiveSameFirst(r, first);
      if (active && !seen.has(active)) { seen.add(active); out.push(active); }
    }
    return out;
  }

  function presenceEvidence(name, text) {
    const n = escapeRe(name);
    const v = PRESENCE_VERBS.map(escapeRe).join("|");
    const person = "[A-ZÀ-ÖØ-ÞĀ-Ž][A-Za-zÀ-ÖØ-öø-ÿĀ-ſ'\-]+(?:\\s+[A-ZÀ-ÖØ-ÞĀ-Ž][A-Za-zÀ-ÖØ-öø-ÿĀ-ſ'\-]+){0,2}";
    const coordinated = "(?:(?:\\s*,\\s*(?:and\\s+)?|\\s+and\\s+|\\s*&\\s*)" + person + "){0,3}";
    const patterns = [
      new RegExp("\\b" + n + "\\b" + coordinated + "\\s+(?:" + v + ")\\b", "i"),
      new RegExp("\\b" + n + "\\s+(?:" + v + ")\\b", "i"),
      new RegExp("\\b(?:with|beside|next to|toward|towards|at|near)\\s+" + n + "\\b", "i"),
      new RegExp("\\b(?:tell|tells|told|ask|asks|asked|show|shows|showed|give|gives|gave|hand|hands|handed|call|calls|called|phone|phones|phoned|meet|meets|met|join|joins|joined|approach|approaches|approached|hug|hugs|hugged|kiss|kisses|kissed|hit|hits|attacks?|attacked)\\s+(?:to\\s+)?" + n + "\\b", "i"),
      new RegExp("[\"”][^\"”]{1,220}[\"”][,.!?]?\\s*" + n + "\\s+(?:says|said|asks|asked|replies|replied|whispers|whispered|answers|answered)", "i")
    ];
    for (let i = 0; i < patterns.length; i++) if (patterns[i].test(text)) return true;
    return false;
  }

  function exitEvidence(name, text) {
    const n = escapeRe(name);
    const person = "[A-ZÀ-ÖØ-ÞĀ-Ž][A-Za-zÀ-ÖØ-öø-ÿĀ-ſ'\-]+(?:\\s+[A-ZÀ-ÖØ-ÞĀ-Ž][A-Za-zÀ-ÖØ-öø-ÿĀ-ſ'\-]+){0,2}";
    const coordinated = "(?:(?:\\s*,\\s*(?:and\\s+)?|\\s+and\\s+|\\s*&\\s*)" + person + "){0,3}";
    return new RegExp("\\b" + n + "\\b" + coordinated + "\\s+(?:" + EXIT_ALT + ")\\b", "i").test(text) ||
      new RegExp("\\b" + n + "\\s+(?:" + EXIT_ALT + ")\\b", "i").test(text);
  }

  function sceneResetEvidence(text) {
    const t = cleanText(text);
    if (!t) return false;
    if (/^(?:later\b|hours? later\b|days? later\b|weeks? later\b|months? later\b|years? later\b|the next (?:day|morning|afternoon|evening|night|week)\b|the following (?:day|morning|afternoon|evening|night|week)\b|meanwhile\b|elsewhere\b)/i.test(t)) return true;

    // First/second/third person travel into a different place is a scene boundary.
    if (/^(?:I|you|we|they|he|she)\s+(?:leave|left|head|headed|go|goes|went|drive|drives|drove|walk|walks|walked|fly|flies|flew|teleport|teleports|teleported|return|returns|returned|travel|travels|travelled|board|boards|boarded|enter|enters|entered|arrive|arrives|arrived|move|moves|moved)\b[^.!?]{0,100}\b(?:away|home|to|toward|towards|into|inside|aboard|back|there)\b/i.test(t)) return true;

    // Common scene-changing player actions that otherwise leave stale witnesses behind.
    if (/^(?:I|you|we)\s+(?:go|get|grab|have)\s+(?:to\s+bed|food|breakfast|lunch|dinner|coffee|tea|drinks?)\b(?:[^.!?]{0,60}\bwith\b)?/i.test(t)) return true;

    // A new paragraph opening on a concrete place followed by occupants/actions is a
    // useful generic boundary signal without hard-coding any scenario names.
    if (/^(?:the|a|an)\s+[A-Za-z][A-Za-z'’\- ]{0,45}\b(?:room|office|laboratory|lab|cafeteria|canteen|kitchen|bedroom|quarters|cabin|bridge|deck|corridor|hall|warehouse|workshop|street|park|hospital|clinic|school|university|station|ship|shuttle|vehicle|apartment|flat|house|home)\b[^.!?]{0,60}\b(?:is|are|was|were|looks?|sits?|stands?|opens?|holds?|contains?|smells?|feels?)\b/i.test(t)) return true;

    return /\bI\s+(?:leave|left)(?:\s+the)?\s+[A-Za-z][^.!?]{0,80}?(?:\.|,|\band\b|$)/i.test(t) ||
      /\bI\s+(?:head|headed|go|went|drive|drove|walk|walked|teleport|teleported|return|returned)\s+(?:away|home|to|toward|towards|back)\b/i.test(t);
  }

  function participantKeys(text) {
    const r = root();
    if (!r) return [];
    const mentioned = namesMentioned(text);
    const out = [];
    for (let i = 0; i < mentioned.length; i++) {
      const k = mentioned[i], ch = r.chars[k];
      if (!ch) continue;
      const aliases = (ch.aliases && ch.aliases.length ? ch.aliases : [ch.name]);
      if (aliases.some(a => presenceEvidence(a, text))) out.push(k);
    }
    return out;
  }

  function privateOwner(text) {
    const r = root();
    if (!r) return null;
    const patterns = [
      /^([A-ZÀ-ÖØ-ÞĀ-Ž][A-Za-zÀ-ÖØ-öø-ÿĀ-ſ'\-]+(?:\s+[A-ZÀ-ÖØ-ÞĀ-Ž][A-Za-zÀ-ÖØ-öø-ÿĀ-ſ'\-]+){0,2})\s+(?:thinks|thought|wonders|believes|suspects|remembers|hopes|fears|imagines)\b/i,
      /^([A-ZÀ-ÖØ-ÞĀ-Ž][A-Za-zÀ-ÖØ-öø-ÿĀ-ſ'\-]+(?:\s+[A-ZÀ-ÖØ-ÞĀ-Ž][A-Za-zÀ-ÖØ-öø-ÿĀ-ſ'\-]+){0,2})\b[^.!?]{0,90}\b(?:thinks? to (?:himself|herself|themself|themselves)|silently thinks?|privately believes?|keeps? .{0,45} to (?:himself|herself|themself|themselves))\b/i,
      /\b(?:inside|within)\s+([A-ZÀ-ÖØ-ÞĀ-Ž][A-Za-zÀ-ÖØ-öø-ÿĀ-ſ'\-]+(?:\s+[A-ZÀ-ÖØ-ÞĀ-Ž][A-Za-zÀ-ÖØ-öø-ÿĀ-ſ'\-]+){0,2})['’]s\s+(?:mind|head)\b/i
    ];
    for (let i = 0; i < patterns.length; i++) {
      const m = cleanText(text).match(patterns[i]);
      if (m) { const k = getCharKey(m[1]); if (k) return k; }
    }
    return null;
  }

  function updateScene(text) {
    const r = root();
    if (!r) return [];
    const turn = currentTurn();
    if (sceneResetEvidence(text)) r.scene = {};
    const mentioned = namesMentioned(text);
    for (let i = 0; i < mentioned.length; i++) {
      const key = mentioned[i];
      const ch = r.chars[key];
      if (!ch) continue;
      const aliases = (ch.aliases && ch.aliases.length ? ch.aliases : [ch.name]);
      if (aliases.some(a => exitEvidence(a, text))) {
        delete r.scene[key];
        continue;
      }
      if (aliases.some(a => presenceEvidence(a, text)) || (r.scene[key] != null && turn - r.scene[key] <= EIDETIC_CONFIG.PRESENCE_HOLD_TURNS)) {
        r.scene[key] = turn;
        ch.lastSeen = turn;
      }
    }
    const keys = Object.keys(r.scene);
    for (let i = 0; i < keys.length; i++) {
      if (turn - Number(r.scene[keys[i]]) > EIDETIC_CONFIG.PRESENCE_HOLD_TURNS) delete r.scene[keys[i]];
    }
    return mentioned;
  }

  function activeCharacters(query, plan) {
    const r = root();
    if (!r) return [];
    const turn = currentTurn();
    const ranked = [];
    const explicit = new Set(participantKeys(query));
    if (plan && plan.explicitRecall) {
      const requested = Array.isArray(plan.names) ? plan.names : namesMentioned(query);
      for (let i = 0; i < requested.length; i++) explicit.add(requested[i]);
    }
    const always = [].concat(EIDETIC_CONFIG.ALWAYS_FOCUS || [], r.manualFocus || []);
    for (let i = 0; i < always.length; i++) {
      const key = getCharKey(always[i]) || normName(always[i]);
      if (r.chars[key]) explicit.add(key);
    }
    const keys = Object.keys(r.chars);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      let score = 0;
      if (explicit.has(key)) score += 100;
      if (r.scene[key] != null) score += Math.max(0, 40 - (turn - r.scene[key]) * 10);
      if (r.chars[key].lastSeen >= 0) score += Math.max(0, 8 - (turn - r.chars[key].lastSeen));
      if (score > 0) ranked.push([key, score]);
    }
    ranked.sort((a, b) => b[1] - a[1]);
    return ranked.slice(0, EIDETIC_CONFIG.MAX_ACTIVE_CHARACTERS).map(x => x[0]);
  }


  function presentSceneCharacters() {
    const r=root(); if(!r)return[]; const turn=currentTurn(), out=[];
    const keys=Object.keys(r.scene||{});
    for(let i=0;i<keys.length;i++) if(turn-Number(r.scene[keys[i]])<=EIDETIC_CONFIG.PRESENCE_HOLD_TURNS) out.push(keys[i]);
    return out;
  }

  function ownerSetFor(text, kind) {
    const r = root();
    const out = new Set([PLAYER]);
    if (!r) return out;
    const turn = currentTurn();
    const po = privateOwner(text);
    if (po) return new Set([PLAYER, po]);

    if (EIDETIC_CONFIG.STRICT_KNOWLEDGE) {
      const sceneKeys = Object.keys(r.scene);
      for (let i = 0; i < sceneKeys.length; i++) {
        const k = sceneKeys[i];
        if (turn - Number(r.scene[k]) <= EIDETIC_CONFIG.PRESENCE_HOLD_TURNS) out.add(k);
      }
      const direct = participantKeys(text);
      for (let i = 0; i < direct.length; i++) out.add(direct[i]);
    } else {
      const mentioned = namesMentioned(text);
      for (let i = 0; i < mentioned.length; i++) out.add(mentioned[i]);
    }
    return out;
  }

  function chunkText(text) {
    text = cleanText(text);
    if (!text) return [];
    const max = EIDETIC_CONFIG.EVENT_CHUNK_CHARS;
    // Avoid cutting durable facts into nonsense fragments at titles/initials/decimals
    // such as "Dr. Nalini Choudhury" or "J. R. Vale".
    const DOT="\uE000";
    let protectedText=text
      .replace(/\b(Dr|Mr|Mrs|Ms|Mx|Prof|Professor|Capt|Captain|Cmdr|Commander|Sgt|Sergeant|Lt|Lieutenant|Gen|General|Col|Colonel|Maj|Major|Rev|St|Sr|Jr|No|Dept|Gov|Sen|Rep)\./gi,(m,a)=>a+DOT)
      .replace(/\b(?:[A-Z]\.){2,}/g,m=>m.replace(/\./g,DOT))
      .replace(/\b([A-Z])\.(?=\s*[A-ZÀ-ÖØ-Þ])/g,(m,a)=>a+DOT)
      .replace(/(\d)\.(\d)/g,(m,a,b)=>a+DOT+b)
      .replace(/\b([ap])\.m\./gi,(m,a)=>a+DOT+"m"+DOT);
    const restore=s=>safeText(s).replace(new RegExp(DOT,"g"),".");
    const sentences = protectedText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [protectedText];
    const out = [];
    for (let i = 0; i < sentences.length; i++) {
      const sentence = restore(sentences[i]).trim();
      if (!sentence) continue;
      if (sentence.length <= max) out.push(sentence);
      else {
        let p = 0;
        while (p < sentence.length) {
          out.push(sentence.slice(p, p + max).trim());
          p += max;
        }
      }
    }
    return out;
  }

  const STATE_SLOT_TAG = { location:"@location", role:"@role", status:"@status", relationship:"@relationship", ability:"@ability", possession:"@item", identity:"@identity", affiliation:"@affiliation" };

  function stateSlotsForCharacter(text, charKey) {
    const r = root(), ch = r && r.chars[charKey];
    if (!ch) return [];
    const aliases = (ch.aliases && ch.aliases.length ? ch.aliases : [ch.name]).slice().sort((a,b)=>b.length-a.length);
    const out = [];
    const add = slot => { if (out.indexOf(slot) < 0) out.push(slot); };
    for (let i = 0; i < aliases.length; i++) {
      const a = escapeRe(aliases[i]);
      const lead = "(?:^|[^A-Za-z0-9])" + a + "(?:[^A-Za-z0-9]|$)";
      if (new RegExp(lead + "[^.!?]{0,42}\\b(?:lives?|resides?|stays?)\\s+(?:in|at|on|near|with)\\b|" + lead + "[^.!?]{0,42}\\b(?:moved|moves|relocated)\\s+(?:(?:from\\s+[^.!?]{1,70}?\\s+)?(?:to|into|back to))\\b|" + lead + "[^.!?]{0,42}\\bis\\s+(?:now\\s+|currently\\s+)?(?:based|located)\\s+(?:in|at|on|near)\\b", "i").test(text)) add("location");
      if (new RegExp(lead + "[^.!?]{0,36}\\b(?:works?|serves?)\\s+as\\b|" + lead + "[^.!?]{0,36}\\b(?:became|becomes|is|remains)\\s+(?:an?\\s+)?(?:" + DETECT_ROLE_ALT + ")\\b", "i").test(text)) add("role");
      if (new RegExp(lead + "[^.!?]{0,34}\\b(?:is|was|became|becomes|remains|has become)\\s+(?:now\\s+|currently\\s+|still\\s+)?(?:dead|alive|resurrected|revived|injured|wounded|pregnant|missing|unconscious|awake|ill|sick|healthy|retired|imprisoned|incarcerated|hospitalized|hospitalised)\\b|" + lead + "[^.!?]{0,24}\\b(?:dies|died|recovered|recovers)\\b", "i").test(text)) add("status");
      if (new RegExp(lead + "[^.!?]{0,42}\\b(?:is|became|becomes|remains)\\s+(?:now\\s+|currently\\s+)?(?:married to|dating|engaged to|friends with|estranged from|divorced from|separated from|in a relationship with)\\b", "i").test(text)) add("relationship");
      if (/\b(?:power|ability|magic|spell|teleport|telepathy|telekinesis|phasing?|gravity|electro|electric|superhuman|superpower|powers)\b/i.test(text) && new RegExp(lead + "[^.!?]{0,36}\\b(?:can|cannot|can't|is able to|is unable to|has (?:the |an? )?(?:power|ability)|lost (?:the |an? )?(?:power|ability)|gained (?:the |an? )?(?:power|ability))\\b", "i").test(text)) add("ability");
      if (semanticTags(text).indexOf("@item") >= 0 && new RegExp(lead + "[^.!?]{0,30}\\b(?:owns?|keeps?|possesses?|has|carries)\\b", "i").test(text)) add("possession");
      if (new RegExp(lead + "[^.!?]{0,40}\\b(?:real name is|is known as|codename is|code name is|alias is|goes by)\\b", "i").test(text)) add("identity");
      if (new RegExp(lead + "[^.!?]{0,40}\\b(?:joined|joins|is a member of|belongs to|works for)\\b|" + lead + "[^.!?]{0,32}\\b(?:left|leaves)\\s+(?:the\\s+)?(?:team|guild|company|organization|organisation|agency|department|faction|group)\\b", "i").test(text)) add("affiliation");
      if (out.length >= 4) break;
    }
    return out;
  }

  function pruneStateLedger() {
    const r = root();
    if (!r || !Array.isArray(r.ledger)) return;
    const limit = Math.max(100, Number(EIDETIC_CONFIG.STATE_LEDGER_LIMIT) || 1800);
    if (r.ledger.length <= limit) return;
    const seen = new Set(), keep = new Array(r.ledger.length).fill(true);
    for (let i = r.ledger.length - 1; i >= 0; i--) {
      const e = r.ledger[i] || {}, owners = Array.isArray(e.owners) ? e.owners : [];
      if (e.manual) { for (let j=0;j<owners.length;j++) seen.add(owners[j]+"|"+e.subject+"|"+e.slot); continue; }
      let useful = false;
      for (let j = 0; j < owners.length; j++) {
        const k = owners[j] + "|" + e.subject + "|" + e.slot;
        if (!seen.has(k)) { useful = true; seen.add(k); }
      }
      if (!useful) keep[i] = false;
    }
    let remove = r.ledger.length - limit;
    if (remove > 0) {
      for (let i = 0; i < keep.length && remove > 0; i++) if (!keep[i]) { keep[i] = null; remove--; }
      for (let i = 0; i < keep.length && remove > 0; i++) if (keep[i] === true && !(r.ledger[i] && r.ledger[i].manual)) { keep[i] = null; remove--; }
      const before = r.ledger.length;
      r.ledger = r.ledger.filter((_,i) => keep[i] !== null);
      r.stats.statePruned = Number(r.stats.statePruned || 0) + (before - r.ledger.length);
    }
  }

  function addStateFacts(text, owners, turn, kind, sourceHash, mode, manual) {
    if (!EIDETIC_CONFIG.ENABLE_STATE_LEDGER) return;
    const r = root();
    if (!r || (mode !== "event" && mode !== "player-event") || /\b(?:asks?|asked|wonders?|wondered|if|whether|maybe|perhaps|possibly|might|could have)\b/i.test(text)) return;
    const subjects = namesMentioned(text);
    if (!subjects.length) return;
    const ownerArray = Array.from(owners || [PLAYER]);
    for (let si = 0; si < subjects.length; si++) {
      const subject = subjects[si], slots = stateSlotsForCharacter(text, subject);
      for (let sj = 0; sj < slots.length; sj++) {
        const slot = slots[sj], shown = displayText(text, EIDETIC_CONFIG.STATE_FACT_CHARS);
        const fp = hash(slot + "|" + subject + "|" + shown.toLowerCase());
        let same = false;
        for (let i = r.ledger.length - 1, scanned = 0; i >= 0 && scanned < 120; i--, scanned++) {
          const old = r.ledger[i];
          if (!old || old.subject !== subject || old.slot !== slot) continue;
          const shared = (old.owners || []).some(o => ownerArray.indexOf(o) >= 0);
          if (shared && old.fp === fp) { same = true; break; }
        }
        if (same) continue;
        r.ledger.push({ id:"s"+(++r.seq), turn, kind, text:shown, owners:ownerArray.slice(), subject, slot, k:tokenList(shown,20).concat(semanticTags(shown)).filter((x,i,a)=>a.indexOf(x)===i).join("|"), src:sourceHash, fp, manual:!!manual, origin: manual ? "manual" : INGEST_ORIGIN });
        r.stats.stateFacts = Number(r.stats.stateFacts || 0) + 1;
      }
    }
    pruneStateLedger();
  }

  function stateFactOwnerAllows(e, owner) {
    if (!EIDETIC_CONFIG.STRICT_KNOWLEDGE) return true;
    return !!(e && Array.isArray(e.owners) && (e.owners.indexOf(owner) >= 0 || e.owners.indexOf("*") >= 0));
  }

  function retrieveCurrentState(owner, plan, limit) {
    const r = root();
    if (!r || !EIDETIC_CONFIG.ENABLE_STATE_LEDGER || !Array.isArray(r.ledger)) return [];
    const wantedSubjects = new Set((plan.names || []).concat(owner ? [owner] : []));
    const wantedSlots = new Set();
    for (let slot in STATE_SLOT_TAG) if ((plan.tags || []).indexOf(STATE_SLOT_TAG[slot]) >= 0) wantedSlots.add(slot);
    const picked = [], seen = new Set(), lexical = plan.lexicalTokens || [];
    for (let i = r.ledger.length - 1; i >= 0; i--) {
      const e = r.ledger[i];
      if (!e || !stateFactOwnerAllows(e, owner)) continue;
      if (wantedSubjects.size && !wantedSubjects.has(e.subject)) continue;
      const key = e.subject + "|" + e.slot;
      if (seen.has(key)) continue;
      seen.add(key);
      const tagMatch = wantedSlots.size ? wantedSlots.has(e.slot) : false;
      const kw = "|" + safeText(e.k) + "|";
      let lexicalMatches = 0;
      for (let li=0; li<lexical.length; li++) {
        const vars = plan.variants && plan.variants[lexical[li]] ? plan.variants[lexical[li]] : lexicalVariants(lexical[li]);
        for (let vi=0; vi<vars.length; vi++) if (kw.indexOf("|"+vars[vi]+"|") >= 0) { lexicalMatches++; break; }
      }
      const subjectMatch = (plan.names || []).indexOf(e.subject) >= 0 || e.subject === owner;
      if (plan.currentStateLookup && wantedSlots.size && !tagMatch) continue;
      if ((plan.explicitRecall || plan.currentStateLookup) && !tagMatch && lexicalMatches === 0 && !subjectMatch) continue;
      if (!plan.explicitRecall && !plan.currentStateLookup && !tagMatch && lexicalMatches === 0) continue;
      const age = Math.max(0, currentTurn() - Number(e.turn || 0));
      const score = 8 + (tagMatch ? 6 : 0) + lexicalMatches * 2.4 + (subjectMatch ? 2 : 0) + 2 / Math.sqrt(1 + age / 20);
      picked.push({ e, score });
    }
    picked.sort((a,b)=>b.score-a.score || Number(b.e.turn||0)-Number(a.e.turn||0));
    return picked.slice(0, Math.max(1, limit || EIDETIC_CONFIG.STATE_FACTS_PER_CHARACTER)).map(x=>x.e);
  }


  const WORLD_LOCATION_HEADS = new Set("city town village street road avenue lane drive boulevard square district university school college hospital office room hall lab laboratory annex station base facility tower bridge park forest woods mountain river lake island planet moon country kingdom realm campus bar cafe restaurant hotel warehouse factory prison church temple port airport dock shipyard farm ranch estate manor castle palace apartment flat house home bunker compound arena stadium theatre theater shop store clinic library courthouse speakeasy vault sector deck level floor ward gate building corridor chamber museum exhibit gallery observatory archive archives".split(" "));
  const WORLD_LOCATION_PREFIXES = new Set("room sector deck level floor ward gate building vault chamber corridor zone block platform bay cell suite".split(" "));
  const WORLD_ORG_HEADS = new Set("company corporation corp agency department council guild team order faction organization organisation committee institute foundation government commission society board police army navy fleet club alliance coalition syndicate network authority directorate bureau ministry collective academy association consortium command service services group".split(" "));
  const WORLD_ITEM_HEADS = new Set("key keycard ring sword blade knife gun pistol rifle weapon amulet book journal diary notebook letter note photo photograph device artifact relic crown necklace pendant phone watch badge card chip drive disk datapad tablet laptop box case bag backpack bottle vial serum crystal stone gem map compass file folder document suit armor armour mask helmet receiver relay beacon token coin locket bracelet cup mug glass package parcel envelope tool scanner transmitter recorder module core sample capsule injector gauntlet staff wand".split(" "));
  const WORLD_VEHICLE_HEADS = new Set("car truck bike motorcycle ship shuttle craft vehicle jet plane aircraft helicopter train boat yacht cruiser freighter rover speeder van bus transport carrier frigate corvette fighter bomber pod capsule".split(" "));
  const WORLD_EVENT_HEADS = new Set("war battle attack incident disaster festival ceremony graduation funeral wedding election uprising rebellion invasion massacre crisis summit trial tournament accident explosion fire collapse siege operation mission catastrophe coronation conference".split(" "));
  const WORLD_META_BLOCK = new Set("chapter scene episode act part prologue epilogue title note notes author system user assistant narrator prompt input output context memory recap summary story scenario details comments update updates".split(" "));
  for (const x of DETECTION_FORTRESS_EXTRA_WORLD_LOCATION) WORLD_LOCATION_HEADS.add(x);
  for (const x of DETECTION_FORTRESS_EXTRA_WORLD_ITEM) WORLD_ITEM_HEADS.add(x);
  for (const x of DETECTION_FORTRESS_EXTRA_WORLD_VEHICLE) WORLD_VEHICLE_HEADS.add(x);
  for (const x of DETECTION_FORTRESS_EXTRA_WORLD_ORG) WORLD_ORG_HEADS.add(x);
  for (const x of DETECTION_FORTRESS_EXTRA_WORLD_EVENT) WORLD_EVENT_HEADS.add(x);
  const LEGACY_BAD_ENTITY_LABELS = new Set("name alias aliases age birthday role appearance power powers personality relationship relationships status designation type history known rule era start current family notes note entry keys key trigger triggers description".split(" "));
  const WORLD_FORBIDDEN_SINGLE = new Set("the a an this that these those not no yes around through toward towards into onto inside outside near at in on to from with by for of over under beside behind before after then now here there someone somebody anyone anybody everyone everybody everything something anything nothing it its he him his she her hers they them their theirs we us our ours you your yours i me my mine who whom whose which what when where why how and or but if because while although though as just very really still only even also already again away back out up down off all any each every either neither both another other same own such more most less least many much few several one two three four five six seven eight nine ten".split(" "));
  const WORLD_LEADING_NOISE = /^(?:(?:around|through|toward|towards|into|onto|inside|outside|near|at|in|on|to|from|with|by|for|of|over|under|beside|behind|before|after)\s+)+(?:the\s+|a\s+|an\s+)?/i;
  const WORLD_ACRONYM_PATTERN = "(?:[A-Z](?:\\.[A-Z]){1,}\\.?|[A-Z]{2,}(?:[- ][A-Z0-9]{2,})*)";
  const WORLD_NAMED_PATTERN = "(?:" + WORLD_ACRONYM_PATTERN + "|[A-Z][A-Za-z0-9]*[-][A-Z0-9][A-Za-z0-9-]*|" + DETECT_PROPER_PATTERN.slice(1,-1) + ")";
  const MONTH_INDEX = { january:0,february:1,march:2,april:3,may:4,june:5,july:6,august:7,september:8,october:9,november:10,december:11 };
  const NUMBER_WORDS = { a:1,an:1,another:1,half:0.5,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,ninety:90,hundred:100 };

  function worldRoot() { const r=root(); return r && r.world ? r.world : null; }
  function worldNorm(name) { return cleanText(name).toLowerCase().replace(/^["'“”‘’]+|["'“”‘’]+$/g,"").replace(/\s+/g," ").trim(); }
  function worldKey(name,type) { return safeText(type||"unknown").toLowerCase()+":"+worldNorm(name); }
  function worldPretty(name) {
    name=cleanText(name).replace(/^(?:the)\s+/i,"");
    const words=name.split(/\s+/);
    return words.map((w,i)=>{
      const low=w.toLowerCase();
      if(i>0 && i<words.length-1 && DETECT_NAME_PARTICLES.has(low)) return low;
      if(/^[A-Z0-9.:-]+$/.test(w) && /[A-Z0-9]/.test(w)) return w;
      return w.replace(/^[a-zà-öø-ÿā-ž]/,m=>m.toUpperCase());
    }).join(" ");
  }
  function singleTokenMatchesKnownCharacterInRoot(r,name) {
    const n=worldNorm(name); if(!r||!n||n.indexOf(" ")>=0)return false;
    const keys=Object.keys(r.chars||{});
    for(let i=0;i<keys.length;i++){
      const ch=r.chars[keys[i]]||{}, forms=[ch.name].concat(ch.aliases||[]);
      for(let j=0;j<forms.length;j++){
        const bits=normName(forms[j]).split(" ").filter(Boolean);
        if(bits.indexOf(n)>=0)return true;
      }
    }
    return false;
  }
  function singleTokenMatchesKnownCharacter(name) { return singleTokenMatchesKnownCharacterInRoot(root(),name); }
  function sanitizeWorldSurface(name, force) {
    let x=cleanText(name).replace(/^[,;:.\-\s]+|[,;:.\-\s]+$/g,"");
    if(!x)return"";
    if(!force){
      let prev="";
      while(prev!==x){
        prev=x;
        x=x.replace(WORLD_LEADING_NOISE,"").replace(/^(?:the|a|an|this|that|these|those)\s+/i,"").trim();
      }
    }
    return x.replace(/\s+/g," ").trim();
  }
  function worldSurfaceLooksNamed(name) {
    const x=safeText(name).trim();
    return /^[A-ZÀ-ÖØ-ÞĀ-Ž0-9]/.test(x) || /(?:[A-Z](?:\.[A-Z]){1,}\.?|[A-Z]{2,}(?:[- ][A-Z0-9]{2,})*)/.test(x) || /[A-Z0-9]+-[A-Z0-9]+/.test(x);
  }
  function worldGenericPhrase(name,type) {
    const n=worldNorm(name), bits=n.split(/\s+/).filter(Boolean); if(!bits.length)return true;
    const head=bits[bits.length-1];
    const typed=(type==="location"&&(WORLD_LOCATION_HEADS.has(head)||WORLD_LOCATION_PREFIXES.has(bits[0])))||
      (type==="organization"&&WORLD_ORG_HEADS.has(head))||(type==="item"&&WORLD_ITEM_HEADS.has(head))||
      (type==="vehicle"&&WORLD_VEHICLE_HEADS.has(head))||(type==="event"&&WORLD_EVENT_HEADS.has(head));
    return !!typed && !worldSurfaceLooksNamed(name);
  }
  function persistedWorldEntityInvalid(e,r) {
    if(!e||!e.name)return true;
    const n=worldNorm(e.name), bits=n.split(/\s+/).filter(Boolean);
    if(bits.length===1&&LEGACY_BAD_ENTITY_LABELS.has(bits[0]))return true;
    if(/story-card|manual|config/i.test(safeText(e.source)))return false;
    if(!bits.length)return true;
    if(bits.length===1&&WORLD_FORBIDDEN_SINGLE.has(bits[0]))return true;
    if(WORLD_META_BLOCK.has(bits[0]))return true;
    if(WORLD_LEADING_NOISE.test(safeText(e.name)))return true;
    if(e.type!=="character"&&bits.length===1&&singleTokenMatchesKnownCharacterInRoot(r,e.name))return true;
    if(!/story-card|manual|config/i.test(safeText(e.source)) && bits.length===1 && worldGenericSingle(e.name,e.type)) return true;
    return false;
  }
  function sanitizePersistedDetectionState(r) {
    if(!r||!r.world)return;
    const bad=new Set();
    Object.keys(r.world.entities||{}).forEach(k=>{ if(persistedWorldEntityInvalid(r.world.entities[k],r))bad.add(k); });
    bad.forEach(k=>delete r.world.entities[k]);
    r.world.facts=(r.world.facts||[]).filter(f=>{
      if(!f||f.slot==="history"||bad.has(f.entity))return false;
      if(f.slot==="profile"&&/story-card/i.test(safeText(f.src)))return false;
      if(f.manual)return true;
      const ent=r.world.entities&&r.world.entities[f.entity];
      if(!ent)return false;
      const src=entityPatternFromRecord(ent); if(!src)return false;
      const E="(?:"+src+")", text=cleanText(f.text);
      const direct=(patterns)=>{
        for(let i=0;i<patterns.length;i++)if(new RegExp(patterns[i].replace(/\{E\}/g,E),"i").test(text))return true;
        return false;
      };
      if(ent.type==="character"&&f.slot==="status")return direct([
        "(?:^|[^A-Za-z0-9]){E}\\s+(?:is|was|remains|became|becomes|has become)\\s+(?:now\\s+|currently\\s+|still\\s+)?(?:dead|alive|resurrected|revived|missing|injured|wounded|pregnant|unconscious|awake|ill|sick|healthy|retired|imprisoned|incarcerated|hospitalized|hospitalised)\\b",
        "(?:^|[^A-Za-z0-9]){E}\\s+(?:dies|died|recovers|recovered)\\b",
        "\\b(?:kills?|killed|murders?|murdered)\\s+(?:the\\s+)?{E}(?=$|[^A-Za-z0-9])"
      ]);
      if(ent.type==="character"&&f.slot==="location")return direct([
        "(?:^|[^A-Za-z0-9]){E}\\s+(?:lives?|resides?|stays?)\\s+(?:in|at|on|near|with)\\b",
        "(?:^|[^A-Za-z0-9]){E}\\s+(?:moved|moves|relocated)\\s+(?:to|into|back to)\\b",
        "(?:^|[^A-Za-z0-9]){E}\\s+(?:is|was)\\s+(?:now\\s+|currently\\s+)?(?:based|located)\\s+(?:in|at|on|near)\\b"
      ]);
      if((ent.type==="item"||ent.type==="vehicle")&&f.slot==="owner")return direct([
        "\\b(?:owns?|has|carries|keeps|holds|wears|receives|accepts|takes|took|picks up|picked up|steals|stole|pockets?|pocketed)\\s+(?:the\\s+|a\\s+|an\\s+)?{E}(?=$|[^A-Za-z0-9])",
        "(?:^|[^A-Za-z0-9]){E}\\s+(?:is|was)\\s+(?:owned|carried|held|kept|worn)\\s+by\\b",
        "\\b(?:gives|gave|gifted|hands|handed|passes|passed)\\s+(?:the\\s+|a\\s+|an\\s+)?{E}\\s+to\\b",
        "\\b(?:gives|gave|gifted|hands|handed|passes|passed)\\s+(?:him|her|them|[A-ZÀ-ÖØ-ÞĀ-Ž][A-Za-zÀ-ÖØ-öø-ÿĀ-ſ'’.-]*(?:\\s+[A-ZÀ-ÖØ-ÞĀ-Ž][A-Za-zÀ-ÖØ-öø-ÿĀ-ſ'’.-]*){0,3})\\s+(?:the\\s+|a\\s+|an\\s+)?{E}(?=$|[^A-Za-z0-9])"
      ]);
      if((ent.type==="item"||ent.type==="vehicle")&&f.slot==="location")return direct([
        "(?:^|[^A-Za-z0-9]){E}\\s+(?:is|was|has been)\\s+(?:hidden|stored|placed|put|buried|locked|left)\\s+(?:in|inside|at|under|beneath|within|on)\\b",
        "\\b(?:hide|hides|hid|store|stores|stored|place|places|placed|put|puts|bury|buries|buried|lock|locks|locked|leave|leaves|left)\\s+(?:the\\s+|a\\s+|an\\s+)?{E}\\s+(?:in|inside|at|under|beneath|within|on)\\b"
      ]);
      if((ent.type==="item"||ent.type==="vehicle")&&f.slot==="condition")return direct([
        "(?:^|[^A-Za-z0-9]){E}\\s+(?:is|was|has been|gets?|got)\\s+(?:lost|found|stolen|destroyed|broken|damaged|repaired|restored|missing|vaporised|vaporized|obliterated)\\b",
        "(?:^|[^A-Za-z0-9]){E}\\s+(?:(?:simply|just|suddenly|completely|effectively)\\s+)?(?:ceases?|ceased)\\s+to\\s+exist\\b",
        "\\b(?:destroyed|broke|broken|damaged|repaired|restored|vaporised|vaporized|obliterated)\\s+(?:the\\s+|a\\s+|an\\s+)?{E}(?=$|[^A-Za-z0-9])"
      ]);
      // Keep other structured slots only if they still contain their entity and a meaningful predicate.
      if(ent.type==="location"&&f.slot==="condition")return direct([
        "(?:^|[^A-Za-z0-9]){E}\\s+(?:is|was|has been|gets?|got)\\s+(?:destroyed|demolished|collapsed|burned down|burnt down|damaged|rebuilt|repaired|restored|closed|opened|reopened|abandoned|occupied|captured|evacuated|flooded)\\b"
      ]);
      if(ent.type==="organization"&&f.slot==="status")return direct([
        "(?:^|[^A-Za-z0-9]){E}\\s+(?:is|was|has been|became)\\s+(?:formed|founded|created|disbanded|dissolved|destroyed|collapsed|active|inactive|banned)\\b"
      ]);
      return /story-card|manual/i.test(safeText(f.src));
    });
    r.world.timeline=(r.world.timeline||[]).map(e=>{
      if(!e)return e;
      if(Array.isArray(e.entities))e.entities=e.entities.filter(k=>!bad.has(k));
      return e;
    }).filter(e=>{
      if(!e)return false;
      if(e.manual||/story-card|manual/i.test(safeText(e.src)))return true;
      if(/^(?:time-gap|current-date|time-marker)$/.test(safeText(e.category)))return true;
      const base=safeText(e.category).replace(/^(?:reported|uncertain)-/,"");
      const strict=strictEventCategory(e.text);
      const hasNamedEvent=(e.entities||[]).some(k=>r.world.entities[k]&&r.world.entities[k].type==="event");
      return !!strict || (base==="event"&&hasNamedEvent);
    });
    const ckeys=Object.keys(r.chars||{});
    for(let i=0;i<ckeys.length;i++){
      const k=ckeys[i], ch=r.chars[k]||{}, src=safeText(ch.lastSource);
      const n=normName(ch.name), bits=n.split(" ").filter(Boolean);
      if(bits.length===1&&LEGACY_BAD_ENTITY_LABELS.has(bits[0])){
        delete r.chars[k]; delete r.scene[k]; delete r.candidates[k]; continue;
      }
      if(/story-card|config|manual/i.test(src))continue;
      if((bits.length===1&&(WORLD_FORBIDDEN_SINGLE.has(bits[0])||STOPWORDS.has(bits[0])||NAME_BLOCKLIST.has(bits[0])))||detectionPenalty(ch.name)>=10){
        delete r.chars[k]; delete r.scene[k]; delete r.candidates[k];
      }
    }
    Object.keys(r.world.candidates||{}).forEach(k=>{ const c=r.world.candidates[k]||{}; const n=worldNorm(c.name||k), bits=n.split(/\s+/); if((bits.length===1&&WORLD_FORBIDDEN_SINGLE.has(bits[0]))||WORLD_META_BLOCK.has(bits[0]))delete r.world.candidates[k]; });
    r.runtime.lastWorldEntities=(r.runtime.lastWorldEntities||[]).filter(k=>r.world.entities[k]);
    r.runtime.recallCacheKey=""; r.runtime.recallCacheBlock=""; r.runtime.recallPayloadSig="";
  }

  function worldTypeFromCard(type) {
    type=safeText(type).toLowerCase();
    if (/character|npc|person|people|cast/.test(type)) return "character";
    if (/location|place|setting|region|city|building|room/.test(type)) return "location";
    if (/item|object|artifact|equipment|weapon|inventory|vehicle/.test(type)) return /vehicle/.test(type)?"vehicle":"item";
    if (/faction|organization|organisation|group|company|team|guild/.test(type)) return "organization";
    if (/event|history|incident|battle|war/.test(type)) return "event";
    return "";
  }
  function classifyWorldName(name, context) {
    const n=worldNorm(name); if (!n || n.length<2 || n.length>96) return "";
    const words=n.split(/\s+/), head=words[words.length-1], first=words[0];
    const ck=getCharKey(name); if (ck) return "character";
    if (WORLD_META_BLOCK.has(first) || (words.length===1 && WORLD_META_BLOCK.has(head))) return "";
    if (WORLD_VEHICLE_HEADS.has(head)) return "vehicle";
    if (WORLD_LOCATION_HEADS.has(head) || WORLD_LOCATION_PREFIXES.has(first)) return "location";
    if (WORLD_ORG_HEADS.has(head)) return "organization";
    if (WORLD_ITEM_HEADS.has(head) || WORLD_ITEM_HEADS.has(first)) return "item";
    if (WORLD_EVENT_HEADS.has(head) || WORLD_EVENT_HEADS.has(first)) return "event";
    const c=safeText(context);
    const q=escapeRe(name);
    if (new RegExp("\\b(?:in|at|inside|outside|near|from|toward|towards|returned to|arrived at|went to|moved to|entered|entering|left|departed from|visited|visits)\\s+(?:the\\s+)?"+q+"\\b","i").test(c)) return "location";
    if (new RegExp("\\b(?:joined|member of|works for|worked for|employed by|belongs to|founded|leads|led|serves|served)\\s+(?:the\\s+)?"+q+"\\b","i").test(c)) return "organization";
    if (new RegExp("\\b(?:boarded|boards|drove|drives|flew|flies|piloted|pilots|parked|parks|landed|launched)\\s+(?:the\\s+)?"+q+"\\b","i").test(c)) return "vehicle";
    if (new RegExp("\\b(?:picked up|picks up|took|takes|carried|carries|held|holds|gave|gives|stole|steals|found|finds|lost|loses|hid|hides|used|uses|wore|wears|opened|opens|read|reads)\\s+(?:the\\s+)?"+q+"\\b","i").test(c)) return "item";
    return "";
  }
  function worldGenericSingle(name,type) {
    const n=worldNorm(name), bits=n.split(/\s+/); if(bits.length!==1)return false;
    return (type==="location"&&(WORLD_LOCATION_HEADS.has(n)||WORLD_LOCATION_PREFIXES.has(n))) ||
      (type==="organization"&&WORLD_ORG_HEADS.has(n)) ||
      (type==="item"&&WORLD_ITEM_HEADS.has(n)) ||
      (type==="vehicle"&&WORLD_VEHICLE_HEADS.has(n)) ||
      (type==="event"&&WORLD_EVENT_HEADS.has(n));
  }
  function worldCandidatePlausible(name,type) {
    const n=worldNorm(name); if(!n||n.length<2||n.length>96)return false;
    const bits=n.split(/\s+/).filter(Boolean); if(!bits.length||bits.some(x=>IDENTITY_ABSOLUTE.has(x)))return false;
    if(isFortressMetaPhrase(n))return false;
    if(bits.length===1&&WORLD_FORBIDDEN_SINGLE.has(bits[0]))return false;
    if(WORLD_META_BLOCK.has(bits[0]))return false;
    if(WORLD_LEADING_NOISE.test(safeText(name)))return false;
    if(type!=="character"&&bits.length===1&&singleTokenMatchesKnownCharacter(name))return false;
    if(type==="unknown" && bits.length===1 && (STOPWORDS.has(n)||DETECT_HARD_SINGLE.has(n)||DETECT_SOFT_SINGLE.has(n))) return false;
    return /[A-Za-zÀ-ÖØ-öø-ÿĀ-ſ0-9]/.test(name);
  }
  function worldLooksNamed(name) {
    name=cleanText(name); if(!name)return false;
    if(new RegExp("^"+WORLD_ACRONYM_PATTERN+"$").test(name))return true;
    if(/^[A-ZÀ-ÖØ-ÞĀ-Ž][A-Za-zÀ-ÖØ-öø-ÿĀ-ſ0-9'\-]*(?:\s+(?:(?:de\s+la|de|del|della|di|da|dos|das|du|la|le|van|von|der|den|ter|ten|al|bin|ibn|ap|ben)\s+)?[A-ZÀ-ÖØ-ÞĀ-Ž][A-Za-zÀ-ÖØ-öø-ÿĀ-ſ0-9'\-]*){0,4}$/.test(name))return true;
    return /^[A-Z][A-Za-z0-9]*-[A-Z0-9][A-Za-z0-9-]*$/.test(name);
  }
  function worldHasExpectedHead(name,type) {
    const n=worldNorm(name), bits=n.split(/\s+/), head=bits[bits.length-1], first=bits[0];
    if(type==="location")return WORLD_LOCATION_HEADS.has(head)||WORLD_LOCATION_PREFIXES.has(first);
    if(type==="item")return WORLD_ITEM_HEADS.has(head)||WORLD_ITEM_HEADS.has(first);
    if(type==="vehicle")return WORLD_VEHICLE_HEADS.has(head)||WORLD_VEHICLE_HEADS.has(first);
    if(type==="organization")return WORLD_ORG_HEADS.has(head)||WORLD_ORG_HEADS.has(first);
    if(type==="event")return WORLD_EVENT_HEADS.has(head)||WORLD_EVENT_HEADS.has(first);
    return false;
  }
  function worldIndexedLocationValid(name) {
    const bits=cleanText(name).split(/\s+/); if(bits.length<2)return false;
    const tail=bits.slice(1).join(" ");
    return /^(?:\d+[A-Za-z]?|[A-Z]\d*|[A-Z]+-?\d+|one|two|three|four|five|six|seven|eight|nine|ten)$/i.test(tail) && !/^(?:was|is|are|were|has|had|will|would|can|could|should)$/i.test(tail);
  }
  function worldCodedItemValid(name) {
    const bits=cleanText(name).split(/\s+/); if(bits.length<2)return false;
    const tail=bits.slice(1).join(" ");
    return /^(?:[A-Z]{1,8}-?\d[A-Z0-9-]*|\d+[A-Z][A-Z0-9-]*|[A-Z]{2,6})$/.test(tail);
  }
  function existingWorldEntity(name,type) {
    const w=worldRoot(); if(!w)return null;
    const nk=worldNorm(name), keys=Object.keys(w.entities);
    for(let i=0;i<keys.length;i++){const e=w.entities[keys[i]];if(!e)continue;if(type&&e.type!==type)continue;if(worldNorm(e.name)===nk||(e.aliases||[]).some(a=>worldNorm(a)===nk))return keys[i];}
    return null;
  }
  function pruneWorldCandidates() {
    const w=worldRoot(), r=root(); if(!w||!w.candidates)return;
    const turn=currentTurn(), keys=Object.keys(w.candidates);
    for(let i=0;i<keys.length;i++){const c=w.candidates[keys[i]]||{};if(turn-Number(c.last||0)>EIDETIC_CONFIG.WORLD_CANDIDATE_TTL){delete w.candidates[keys[i]];r.stats.worldCandidatePruned=Number(r.stats.worldCandidatePruned||0)+1;}}
    const left=Object.keys(w.candidates); if(left.length<=EIDETIC_CONFIG.MAX_WORLD_CANDIDATES)return;
    left.sort((a,b)=>{const A=w.candidates[a]||{},B=w.candidates[b]||{};const best=x=>Math.max(0,...Object.values(x.scores||{}).map(Number));return(best(B)+Number(B.last||0)/1000)-(best(A)+Number(A.last||0)/1000);});
    for(let i=EIDETIC_CONFIG.MAX_WORLD_CANDIDATES;i<left.length;i++){delete w.candidates[left[i]];r.stats.worldCandidatePruned=Number(r.stats.worldCandidatePruned||0)+1;}
  }
  function ensureWorldEntity(name,type,source,aliases,force,evidence) {
    const w=worldRoot(), r=root(); if (!w || !EIDETIC_CONFIG.ENABLE_WORLD_MEMORY) return null;
    name=sanitizeWorldSurface(name,!!force); if (!name) return null;
    type=type||classifyWorldName(name,"")||"unknown";
    if(type==="character"){const ck=getCharKey(name);if(ck)name=r.chars[ck].name;else if(!force)return null;}
    if(!worldCandidatePlausible(name,type)) { r.stats.worldCandidateRejected=Number(r.stats.worldCandidateRejected||0)+1; return null; }

    let key=existingWorldEntity(name,type), e=key?w.entities[key]:null;
    if(!e && force){
      key=worldKey(name,type);
      e=w.entities[key];
    }
    if(!e && !force){
      const ev=evidence&&typeof evidence==="object"?evidence:{score:1,strong:0,reason:source||"text"};
      const nk=worldNorm(name), c=w.candidates[nk]||{name,hits:0,observations:0,last:0,lastObservation:"",scores:{},strong:{},reasons:{}};
      const turn=currentTurn(), obsId=safeText(ev.obs)||("turn:"+turn+":"+safeText(ev.reason));
      if(c.lastObservation!==obsId)c.hits=Number(c.hits||0)+1;
      c.observations=Number(c.observations||0)+1;
      c.lastObservation=obsId;c.last=turn;c.name=c.name||name;
      c.scores[type]=Number(c.scores[type]||0)+Math.max(0,Number(ev.score||0));
      c.strong[type]=Math.max(Number(c.strong[type]||0),Number(ev.strong||0));
      c.reasons[type]=Array.isArray(c.reasons[type])?c.reasons[type]:[];
      if(ev.reason&&c.reasons[type].indexOf(ev.reason)<0&&c.reasons[type].length<8)c.reasons[type].push(ev.reason);
      w.candidates[nk]=c;r.stats.worldCandidateObserved=Number(r.stats.worldCandidateObserved||0)+1;
      const ranked=Object.keys(c.scores).filter(t=>t!=="unknown").sort((a,b)=>Number(c.scores[b]||0)-Number(c.scores[a]||0));
      const top=ranked[0], second=ranked[1], topScore=Number(c.scores[top]||0), secondScore=Number(c.scores[second]||0), topStrong=Number(c.strong[top]||0);
      const generic=worldGenericSingle(name,top)||worldGenericPhrase(name,top);
      const repeatedEvidence=!generic && Number(c.observations||0)>=2 && topScore>=EIDETIC_CONFIG.WORLD_ENTITY_PROMOTION_SCORE*2;
      const strongEnough=topStrong>=EIDETIC_CONFIG.WORLD_ENTITY_STRONG_SCORE && (!generic || c.hits>=2);
      const accumulated=c.hits>=EIDETIC_CONFIG.WORLD_ENTITY_PROMOTION_HITS && topScore>=EIDETIC_CONFIG.WORLD_ENTITY_PROMOTION_SCORE;
      const margin=topScore-secondScore;
      if(!top || margin<2 || (!strongEnough&&!accumulated)){if(ranked.length>1&&margin<2)r.stats.worldTypeConflicts=Number(r.stats.worldTypeConflicts||0)+1;pruneWorldCandidates();return null;}
      type=top; key=worldKey(name,type); delete w.candidates[nk]; r.stats.worldCandidatePromoted=Number(r.stats.worldCandidatePromoted||0)+1;
    }
    if(!e){
      key=key||worldKey(name,type);
      if (Object.keys(w.entities).length>=Math.max(50,EIDETIC_CONFIG.WORLD_ENTITY_LIMIT||700)) return null;
      e=w.entities[key]={ key,name:worldPretty(name),type,aliases:[],created:currentTurn(),last:currentTurn(),source:source||"text" };
      r.stats.worldEntities=Number(r.stats.worldEntities||0)+1;
    }
    e.last=currentTurn();
    const all=[name].concat(Array.isArray(aliases)?aliases:[]);
    for(let i=0;i<all.length;i++){const a=cleanText(all[i]);if(a&&!e.aliases.some(x=>worldNorm(x)===worldNorm(a))&&e.aliases.length<16)e.aliases.push(a);}
    return key;
  }
  function seedWorldEntitiesFromStoryCards() {
    if (!EIDETIC_CONFIG.ENABLE_WORLD_MEMORY || typeof storyCards==="undefined" || !Array.isArray(storyCards)) return;
    const r=root(), scanTurn=currentTurn(), count=storyCards.length, interval=Math.max(1,Number(EIDETIC_CONFIG.STORY_CARD_SCAN_INTERVAL)||6);
    const quickParts=[];
    for(let qi=0;qi<storyCards.length;qi++){const qc=storyCards[qi]||{}, qt=worldTypeFromCard(qc.type);if(qt)quickParts.push([safeText(qc.id),safeText(qc.type),safeText(qc.title),safeText(qc.keys)].join("|"));}
    const quickSig=hash(quickParts.join("\u001e"));
    if(r&&r.runtime&&r.runtime.worldCardSig&&r.runtime.worldCardQuickSig===quickSig&&Number(r.runtime.worldCardCount)===count&&Number(r.runtime.worldCardScanTurn)>=0&&scanTurn>=Number(r.runtime.worldCardScanTurn)&&scanTurn-Number(r.runtime.worldCardScanTurn)<interval)return;
    const parts=[];
    for (let i=0;i<storyCards.length;i++) { const c=storyCards[i]||{}, t=worldTypeFromCard(c.type); if (!t) continue; parts.push(safeText(c.id)+"|"+safeText(c.type)+"|"+safeText(c.title)+"|"+safeText(c.keys)+"|"+stableStoryCardEntry(c)); }
    const sig=hash(parts.join("\u001e")); if (r.runtime.worldCardSig===sig) return;
    for (let i=0;i<storyCards.length;i++) {
      const c=storyCards[i]||{}, type=worldTypeFromCard(c.type); if (!type) continue;
      const keys=splitKeys(c.keys).map(x=>cleanText(x)).filter(Boolean), entry=stableStoryCardEntry(c), title=cleanText(c.title);
      let name=title;
      if (!name || /eidetic/i.test(name)) name=keys[0]||"";
      if (type==="character") {
        const ck=getCharKey(name)||getCharKey(keys[0]||""); if (ck) name=r.chars[ck].name; else continue;
      }
      if (!name) continue;
      const wk=ensureWorldEntity(name,type,"story-card",keys.slice(1),true);
      // Story Card content remains native Story Card context; EIDETIC seeds identity/type only.
    }
    r.runtime.worldCardSig=sig; r.runtime.worldCardQuickSig=quickSig; r.runtime.worldCardScanTurn=scanTurn; r.runtime.worldCardCount=count;
  }
  function worldEntityPatterns() {
    const w=worldRoot(), out=[]; if (!w) return out;
    const keys=Object.keys(w.entities).sort(), sigParts=[];
    for(let i=0;i<keys.length;i++){const e=w.entities[keys[i]]||{};sigParts.push(keys[i]+":"+(e.aliases||[]).map(worldNorm).join(",")+":"+worldNorm(e.name));}
    const sig=hash(sigParts.join("|")); if(WORLD_PATTERN_CACHE&&WORLD_PATTERN_SIG===sig)return WORLD_PATTERN_CACHE;
    for (let i=0;i<keys.length;i++) { const e=w.entities[keys[i]], aliases=(e.aliases||[]).concat([e.name]); for (let j=0;j<aliases.length;j++) { const a=cleanText(aliases[j]); if (a) out.push({key:keys[i],len:a.length,re:new RegExp("(^|[^A-Za-z0-9À-ÖØ-öø-ÿĀ-ſ])"+escapeRe(a)+"([^A-Za-z0-9À-ÖØ-öø-ÿĀ-ſ]|$)","i")}); } }
    out.sort((a,b)=>b.len-a.len); WORLD_PATTERN_SIG=sig; WORLD_PATTERN_CACHE=out; return out;
  }
  function worldEntitiesMentioned(text) {
    const out=[], seen=new Set(), pats=worldEntityPatterns();
    for (let i=0;i<pats.length;i++) if (!seen.has(pats[i].key) && pats[i].re.test(text)) { seen.add(pats[i].key); out.push(pats[i].key); }
    const chars=namesMentioned(text), r=root();
    for (let i=0;i<chars.length;i++) { const ch=r.chars[chars[i]]; if (!ch) continue; const k=ensureWorldEntity(ch.name,"character","character-memory",ch.aliases,true); if (k&&!seen.has(k)){seen.add(k);out.push(k);} }
    return out;
  }
  function worldNamedEventValid(name) {
    const raw=cleanText(name); if(!raw)return false;
    const bits=raw.split(/\s+/).filter(Boolean), low=bits.map(x=>x.toLowerCase().replace(/[^a-z-]/g,""));
    if(bits.length<2||bits.length>7)return false;
    const forbidden=new Set("is was are were be been being has have had do does did destroyed damaged killed murdered opened closed moved returned arrived by with from into during because while after before".split(" "));
    if(low.some(x=>forbidden.has(x)))return false;
    const hasHead=low.some(x=>WORLD_EVENT_HEADS.has(x));
    if(!hasHead)return false;
    let named=0;
    for(let i=0;i<bits.length;i++){
      if(/^[A-ZÀ-ÖØ-ÞĀ-Ž][A-Za-zÀ-ÖØ-öø-ÿĀ-ſ0-9'’.-]*$/.test(bits[i]) || /^[A-Z0-9][A-Z0-9.-]{1,}$/.test(bits[i]))named++;
    }
    return named>=1;
  }
  function worldEvidenceRegexes() {
    if (WORLD_EVIDENCE_REGEX_CACHE) return WORLD_EVIDENCE_REGEX_CACHE;
    const locHead=Array.from(WORLD_LOCATION_HEADS).concat(Array.from(WORLD_LOCATION_PREFIXES)).sort((a,b)=>b.length-a.length).map(escapeRe).join("|");
    const itemHead=Array.from(WORLD_ITEM_HEADS).sort((a,b)=>b.length-a.length).map(escapeRe).join("|");
    const vehHead=Array.from(WORLD_VEHICLE_HEADS).sort((a,b)=>b.length-a.length).map(escapeRe).join("|");
    const orgHead=Array.from(WORLD_ORG_HEADS).sort((a,b)=>b.length-a.length).map(escapeRe).join("|");
    const evtHead=Array.from(WORLD_EVENT_HEADS).sort((a,b)=>b.length-a.length).map(escapeRe).join("|");
    WORLD_EVIDENCE_REGEX_CACHE = {
      locNamed:new RegExp("\\b(?:entered|enter|enters|arrived at|arrives at|returned to|returns to|went to|goes to|visited|visits|moved to|moves to|left|leaves|from|inside|outside|near|at|in)\\s+(?:the\\s+)?("+WORLD_NAMED_PATTERN+")\\b","gi"),
      locDesc:new RegExp("\\b(?:entered|enter|enters|arrive at|arrived at|arrives at|return to|returned to|returns to|go to|went to|goes to|visit|visited|visits|move to|moved to|moves to|inside|outside|near|at|in)\\s+(?:the\\s+)?((?:[A-Za-zÀ-ÖØ-öø-ÿĀ-ſ0-9'\\-]+\\s+){0,3}(?:"+locHead+")(?:\\s+[A-Z0-9][A-Za-z0-9-]*)?)\\b","gi"),
      prefLoc:new RegExp("\\b((?:"+Array.from(WORLD_LOCATION_PREFIXES).map(escapeRe).join("|")+")\\s+(?:[A-Z0-9][A-Za-z0-9-]*|one|two|three|four|five|six|seven|eight|nine|ten))\\b","gi"),
      itemAct:new RegExp("\\b(?:pick up|picked up|picks up|take|took|takes|carry|carried|carries|hold|held|holds|give|gave|gives|hand|handed|hands|steal|stole|steals|find|found|finds|lose|lost|loses|hide|hid|hides|use|used|uses|wear|wore|wears|open|opened|opens|read|reads|examine|examined|examines|drop|dropped|drops)\\s+(?:the\\s+|a\\s+|an\\s+|his\\s+|her\\s+|their\\s+|my\\s+|your\\s+|our\\s+)?((?:[A-Za-zÀ-ÖØ-öø-ÿĀ-ſ0-9'\\-]+\\s+){0,3}(?:"+itemHead+")|"+WORLD_NAMED_PATTERN+")\\b","gi"),
      itemDesc:new RegExp("\\b(?:the|a|an|his|her|their|my|your|our)\\s+((?:[A-Za-zÀ-ÖØ-öø-ÿĀ-ſ0-9'\\-]+\\s+){0,2}(?:"+itemHead+"))\\b","gi"),
      codedItem:new RegExp("\\b((?:"+itemHead+")\\s+[A-Z0-9][A-Za-z0-9-]{1,20})\\b","gi"),
      vehicleAct:new RegExp("\\b(?:board|boarded|boards|enter|entered|enters|drive|drove|drives|fly|flew|flies|pilot|piloted|pilots|park|parked|parks|land|landed|launch|launched|ride|rode|rides)\\s+(?:the\\s+)?((?:[A-Za-zÀ-ÖØ-öø-ÿĀ-ſ0-9'\\-]+\\s+){0,2}(?:"+vehHead+")|"+WORLD_NAMED_PATTERN+")\\b","gi"),
      orgAct:new RegExp("\\b(?:join|joined|joins|member of|members of|work for|works for|worked for|employed by|belong to|belongs to|found|founded|founds|lead|leads|led|serve|serves|served|director of|agent of)\\s+(?:the\\s+)?("+WORLD_NAMED_PATTERN+"|(?:[A-Za-zÀ-ÖØ-öø-ÿĀ-ſ'\\-]+\\s+){0,3}(?:"+orgHead+"))\\b","gi"),
      orgNamed:new RegExp("\\b("+WORLD_NAMED_PATTERN+"\\s+(?:"+orgHead+"))\\b","g"),
      eventNamed1:new RegExp("\\b((?:"+evtHead+")\\s+(?:of\\s+)?"+WORLD_NAMED_PATTERN+")\\b","gi"),
      eventNamed2:new RegExp("\\b("+WORLD_NAMED_PATTERN+"\\s+(?:"+evtHead+"))\\b","gi")
    };
    return WORLD_EVIDENCE_REGEX_CACHE;
  }
  function worldEvidenceFromText(text, observationId) {
    const map=Object.create(null), observationHash=safeText(observationId)||hash(cleanText(text));
    const add=(name,type,score,strong,reason)=>{
      name=sanitizeWorldSurface(name,false);
      if(!name||!worldCandidatePlausible(name,type))return;
      if(/^(?:location-context|vehicle-use|organization-membership|named-event)$/.test(reason)&&!worldSurfaceLooksNamed(name)&&!worldGenericPhrase(name,type))return;
      const k=worldNorm(name)+"|"+type;
      if(worldGenericSingle(name,type)){score=Math.min(score,5);strong=Math.min(strong,5);}
      const prev=map[k];
      if(!prev||score>prev.score||strong>prev.strong)map[k]={name,type,score,strong,reason,obs:observationHash};
    };
    let m, re; const rx=worldEvidenceRegexes();
    // Precision mode deliberately does not harvest arbitrary capitalized phrases.
    // Existing known characters are resolved separately; new world entities need typed evidence.
    re=resetGlobalRegex(rx.locNamed);
    while((m=re.exec(text))!==null)if(worldLooksNamed(m[1]))add(m[1],"location",10,10,"location-context");
    re=resetGlobalRegex(rx.locDesc);
    while((m=re.exec(text))!==null)if(worldHasExpectedHead(m[1],"location"))add(m[1],"location",9,9,"entered-location");
    re=resetGlobalRegex(rx.prefLoc);
    while((m=re.exec(text))!==null)if(worldIndexedLocationValid(m[1]))add(m[1],"location",9,9,"indexed-location");
    re=resetGlobalRegex(rx.itemAct);
    while((m=re.exec(text))!==null)if(worldHasExpectedHead(m[1],"item")||worldLooksNamed(m[1]))add(m[1],"item",10,10,"item-interaction");
    re=resetGlobalRegex(rx.itemDesc);
    while((m=re.exec(text))!==null)if(worldHasExpectedHead(m[1],"item"))add(m[1],WORLD_VEHICLE_HEADS.has(worldNorm(m[1]).split(/\s+/).pop())?"vehicle":"item",6,0,"typed-object-phrase");
    re=resetGlobalRegex(rx.codedItem);
    while((m=re.exec(text))!==null)if(worldHasExpectedHead(m[1],"item")&&worldCodedItemValid(m[1]))add(m[1],"item",9,9,"coded-item");
    re=resetGlobalRegex(rx.vehicleAct);
    while((m=re.exec(text))!==null)if(worldHasExpectedHead(m[1],"vehicle")||worldLooksNamed(m[1]))add(m[1],"vehicle",10,10,"vehicle-use");
    re=resetGlobalRegex(rx.orgAct);
    while((m=re.exec(text))!==null)if(worldHasExpectedHead(m[1],"organization")||worldLooksNamed(m[1]))add(m[1],"organization",11,11,"organization-membership");
    re=resetGlobalRegex(rx.orgNamed);
    while((m=re.exec(text))!==null)if(worldHasExpectedHead(m[1],"organization"))add(m[1],"organization",8,8,"named-organization");
    re=resetGlobalRegex(rx.eventNamed1);
    while((m=re.exec(text))!==null)if(worldHasExpectedHead(m[1],"event"))add(m[1],"event",9,9,"named-event");
    re=resetGlobalRegex(rx.eventNamed2);
    while((m=re.exec(text))!==null)if(worldHasExpectedHead(m[1],"event"))add(m[1],"event",9,9,"named-event");

    return Object.keys(map).map(k=>map[k]).sort((a,b)=>b.score-a.score||b.strong-a.strong);
  }
  function discoverWorldEntities(text, observationId) {
    if (!EIDETIC_CONFIG.ENABLE_WORLD_MEMORY) return [];
    const found=[], evidence=worldEvidenceFromText(text, observationId);
    for(let i=0;i<evidence.length;i++){
      const ev=evidence[i], k=ensureWorldEntity(ev.name,ev.type,"text",null,ev.type==="character",{score:ev.score,strong:ev.strong,reason:ev.reason,obs:ev.obs});
      if(k&&found.indexOf(k)<0)found.push(k);
    }
    pruneWorldCandidates();
    return found;
  }

  function wordsToNumber(raw) {
    raw=safeText(raw).toLowerCase().trim(); const num=Number(raw); if(Number.isFinite(num))return num;
    const parts=raw.replace(/-/g," ").split(/\s+/); let total=0,current=0;
    for(let i=0;i<parts.length;i++){ const v=NUMBER_WORDS[parts[i]]; if(v==null)return NaN; if(v===100)current=Math.max(1,current)*100; else current+=v; } total+=current; return total||NaN;
  }
  function durationHours(amount,unit) {
    const n=wordsToNumber(amount); if(!Number.isFinite(n)||n<0)return 0; unit=safeText(unit).toLowerCase();
    if(/^minute/.test(unit))return n/60; if(/^hour/.test(unit))return n; if(/^day/.test(unit))return n*24; if(/^week/.test(unit))return n*24*7; if(/^month/.test(unit))return n*24*30.4375; if(/^year/.test(unit))return n*24*365; return 0;
  }
  function parseAgoHours(text) {
    const m=safeText(text).match(/\b(a|an|another|half|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|ninety|\d+(?:\.\d+)?)\s+(minutes?|hours?|days?|weeks?|months?|years?)\s+ago\b/i);
    return m?durationHours(m[1],m[2]):0;
  }
  function parseForwardGapHours(text) {
    const t=safeText(text), used=[], vals=[];
    const patterns=[
      /\b(a|an|another|half|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|ninety|\d+(?:\.\d+)?)\s+(minutes?|hours?|days?|weeks?|months?|years?)\s+(?:later|afterwards?|pass(?:es|ed)?|have passed|has passed)\b/gi,
      /\bafter\s+(a|an|another|half|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|ninety|\d+(?:\.\d+)?)\s+(minutes?|hours?|days?|weeks?|months?|years?)\b/gi
    ];
    for(let pi=0;pi<patterns.length;pi++){ let m; while((m=patterns[pi].exec(t))!==null){ const a=m.index,b=m.index+m[0].length; if(used.some(x=>a<x[1]&&b>x[0]))continue; used.push([a,b]); vals.push(durationHours(m[1],m[2])); } }
    if(/\b(?:the\s+)?(?:next|following)\s+day\b/i.test(t))vals.push(24); else if(/\b(?:the\s+)?(?:next|following)\s+(?:morning|afternoon|evening|night)\b/i.test(t))vals.push(24);
    return vals.reduce((a,b)=>a+b,0);
  }
  function parseAbsoluteDate(text) {
    const t=safeText(text); let m=t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/); let y,mo,d,label;
    if(m){y=+m[1];mo=+m[2]-1;d=+m[3];label=m[0];}
    if(!m){m=t.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s+(\d{4})\b/i); if(m){y=+m[3];mo=MONTH_INDEX[m[1].toLowerCase()];d=+m[2];label=m[0];}}
    if(!m){m=t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i); if(m){y=+m[3];mo=MONTH_INDEX[m[2].toLowerCase()];d=+m[1];label=m[0];}}
    if(!m||!Number.isFinite(y)||!Number.isFinite(mo)||!Number.isFinite(d))return null;
    const epoch=Date.UTC(y,mo,d)/3600000; return {label,epochHours:epoch};
  }
  function formatDurationHours(hours) {
    hours=Math.max(0,Number(hours)||0); const day=24,week=168,month=24*30.4375,year=24*365;
    const fmt=(n,u)=>{ const near=Math.abs(n-Math.round(n))<0.08; const v=near?Math.round(n):Math.round(n*10)/10; return v+" "+u+(v===1?"":"s"); };
    if(hours>=year*0.8)return fmt(hours/year,"year"); if(hours>=month*0.8)return fmt(hours/month,"month"); if(hours>=week*0.8)return fmt(hours/week,"week"); if(hours>=day*0.8)return fmt(hours/day,"day"); if(hours>=1)return fmt(hours,"hour"); return fmt(Math.max(1,hours*60),"minute");
  }
  function recomputeWorldClock() {
    const w=worldRoot(); if(!w)return; let hours=0,base=null,label="",timeLabel="",known=false,partial=false;
    for(let i=0;i<w.timeline.length;i++){
      const e=w.timeline[i]||{};
      if(e.category==="time-gap"&&Number.isFinite(e.deltaHours)){hours+=e.deltaHours;known=true;}
      if(e.category==="time-uncertain")partial=true;
      if(e.category==="current-date"&&Number.isFinite(e.epochHours)){base=e.epochHours-hours;label=e.dateLabel||label;}
      if(e.category==="time-marker"&&e.timeLabel)timeLabel=e.timeLabel;
    }
    w.clock.hours=hours; w.clock.baseEpochHours=base; w.clock.currentDateLabel=label; w.clock.currentTimeLabel=timeLabel; w.clock.knownElapsed=known||base!==null; w.clock.partial=partial;
  }
  function currentStoryHours(){ const w=worldRoot(); return w&&w.clock?Number(w.clock.hours)||0:0; }
  function currentStoryDateLabel(){ const w=worldRoot(); if(!w||!w.clock)return""; if(Number.isFinite(w.clock.baseEpochHours)){ const ms=(w.clock.baseEpochHours+currentStoryHours())*3600000; const d=new Date(ms); if(!isNaN(d.getTime()))return d.toISOString().slice(0,10); } return w.clock.currentDateLabel||""; }
  function relativeAgeLabel(eventHours) { const w=worldRoot(); if(!w||!w.clock||!w.clock.knownElapsed)return""; const diff=currentStoryHours()-Number(eventHours||0); if(diff<=0.01)return"now"; if(w.clock.partial)return"earlier"; return formatDurationHours(diff)+" ago"; }
  function addTimelineRecord(text,entities,owners,turn,kind,src,mode,category,storyHours,extra) {
    const w=worldRoot(); if(!w)return null; const fp=hash(category+"|"+cleanText(text).toLowerCase()+"|"+Number(storyHours||0).toFixed(3));
    for(let i=w.timeline.length-1,scan=0;i>=0&&scan<120;i--,scan++){const e=w.timeline[i];if(e&&e.fp===fp&&e.src===src)return e;}
    const e=Object.assign({id:"wte"+(++root().seq),turn,kind,text:displayText(text,EIDETIC_CONFIG.WORLD_FACT_CHARS),entities:(entities||[]).slice(),owners:Array.from(owners||[PLAYER]),mode,category:category||"event",storyHours:Number(storyHours)||0,src,origin:INGEST_ORIGIN,fp,k:tokenList(text,24).concat(semanticTags(text)).filter((x,i,a)=>a.indexOf(x)===i).join("|")},extra||{});
    w.timeline.push(e); root().stats.worldEvents=Number(root().stats.worldEvents||0)+1; pruneWorldMemory(); return e;
  }
  function addWorldFactRecord(entityKey,slot,text,owners,turn,kind,src,mode,manual) {
    const w=worldRoot(); if(!w||!entityKey)return; const shown=displayText(text,EIDETIC_CONFIG.WORLD_FACT_CHARS), fp=hash(entityKey+"|"+slot+"|"+shown.toLowerCase());
    for(let i=w.facts.length-1,scan=0;i>=0&&scan<160;i--,scan++){const e=w.facts[i];if(e&&e.entity===entityKey&&e.slot===slot&&e.fp===fp&&e.src===src)return;}
    w.facts.push({id:"wf"+(++root().seq),turn,kind,entity:entityKey,slot,text:shown,owners:Array.from(owners||[PLAYER]),mode,storyHours:currentStoryHours(),dateLabel:currentStoryDateLabel(),src,origin:manual?"manual":INGEST_ORIGIN,fp,k:tokenList(shown,24).concat(semanticTags(shown)).filter((x,i,a)=>a.indexOf(x)===i).join("|"),manual:!!manual});
    root().stats.worldFacts=Number(root().stats.worldFacts||0)+1; pruneWorldMemory();
  }
  function pruneWorldMemory() {
    const w=worldRoot(); if(!w)return; const fl=Math.max(200,EIDETIC_CONFIG.WORLD_FACT_LIMIT||3200), tl=Math.max(200,EIDETIC_CONFIG.WORLD_TIMELINE_LIMIT||3200);
    if(w.facts.length>fl){ const n=w.facts.length-fl; w.facts.splice(0,n); root().stats.worldPruned=Number(root().stats.worldPruned||0)+n; }
    if(w.timeline.length>tl){ const n=w.timeline.length-tl; w.timeline.splice(0,n); root().stats.worldPruned=Number(root().stats.worldPruned||0)+n; recomputeWorldClock(); }
  }
  function worldEntityAliasSource(entityKey) {
    const w=worldRoot(), e=w&&w.entities? w.entities[entityKey]:null; if(!e)return"";
    const forms=[e.name].concat(e.aliases||[]).filter(Boolean).sort((a,b)=>b.length-a.length);
    return forms.map(escapeRe).join("|");
  }
  function entityPatternFromRecord(e) {
    if(!e)return"";
    const forms=[e.name].concat(e.aliases||[]).map(cleanText).filter(Boolean).sort((a,b)=>b.length-a.length);
    return forms.length?forms.map(escapeRe).join("|"):"";
  }
  function entityPattern(entityKey) {
    const w=worldRoot(), e=w&&w.entities?w.entities[entityKey]:null;
    return entityPatternFromRecord(e);
  }
  function directEntityRelation(text, entityKey, tests, allowPronoun) {
    const src=entityPattern(entityKey); if(!src)return false;
    const E="(?:"+src+")";
    for(let i=0;i<tests.length;i++) {
      const pat=tests[i].replace(/\{E\}/g,E);
      if(new RegExp(pat,"i").test(text))return true;
    }
    if(allowPronoun && /^(?:he|she|they|it|this place|that place|the building|the room|the item|the object|the weapon|the vehicle)\b/i.test(cleanText(text))) {
      for(let i=0;i<tests.length;i++) {
        const p=tests[i].replace(/\{E\}/g,"(?:he|she|they|it|this place|that place|the building|the room|the item|the object|the weapon|the vehicle)");
        if(new RegExp(p,"i").test(text))return true;
      }
    }
    return false;
  }
  function worldFactSlots(type,text,entityKey,entityCount) {
    const out=[],add=x=>{if(out.indexOf(x)<0)out.push(x)}, pronoun=entityCount===1;
    if(type==="character") {
      if(directEntityRelation(text,entityKey,[
        "(?:^|[^A-Za-z0-9]){E}\\s+(?:is|was|remains|became|becomes|has become)\\s+(?:now\\s+|currently\\s+|still\\s+)?(?:dead|alive|resurrected|revived|missing|injured|wounded|pregnant|unconscious|awake|ill|sick|healthy|retired|imprisoned|incarcerated|hospitalized|hospitalised)\\b",
        "(?:^|[^A-Za-z0-9]){E}\\s+(?:dies|died|recovers|recovered)\\b",
        "\\b(?:kills?|killed|murders?|murdered)\\s+(?:the\\s+)?{E}(?=$|[^A-Za-z0-9])"
      ],pronoun))add("status");
      if(directEntityRelation(text,entityKey,[
        "(?:^|[^A-Za-z0-9]){E}\\s+(?:lives?|resides?|stays?)\\s+(?:in|at|on|near|with)\\b",
        "(?:^|[^A-Za-z0-9]){E}\\s+(?:moved|moves|relocated)\\s+(?:to|into|back to)\\b",
        "(?:^|[^A-Za-z0-9]){E}\\s+(?:is|was)\\s+(?:now\\s+|currently\\s+)?(?:based|located)\\s+(?:in|at|on|near)\\b",
        "(?:^|[^A-Za-z0-9]){E}['’]s\\s+(?:home|address|residence)\\s+(?:is|was)\\b"
      ],pronoun))add("location");
      if(directEntityRelation(text,entityKey,[
        "(?:^|[^A-Za-z0-9]){E}\\s+(?:works?|serves?)\\s+as\\b",
        "(?:^|[^A-Za-z0-9]){E}\\s+(?:became|becomes|is|was|remains)\\s+(?:an?\\s+)?(?:"+DETECT_ROLE_ALT+")\\b",
        "(?:^|[^A-Za-z0-9]){E}\\s+(?:was|is)\\s+promoted\\s+to\\b"
      ],pronoun))add("role");
      if(directEntityRelation(text,entityKey,[
        "(?:^|[^A-Za-z0-9]){E}\\s+(?:is|was|became|becomes|remains)\\s+(?:now\\s+|currently\\s+)?(?:married to|dating|engaged to|friends with|estranged from|divorced from|separated from|in a relationship with|partners? with)\\b",
        "(?:^|[^A-Za-z0-9]){E}\\s+(?:married|divorced|left|separated from|broke up with)\\b"
      ],pronoun))add("relationship");
      if(directEntityRelation(text,entityKey,[
        "(?:^|[^A-Za-z0-9]){E}\\s+(?:is|was)\\s+\\d{1,3}\\s+years?\\s+old\\b",
        "(?:^|[^A-Za-z0-9]){E}\\s+turns?\\s+\\d{1,3}\\b",
        "(?:^|[^A-Za-z0-9]){E}['’]s\\s+birthday\\s+(?:is|was)\\b"
      ],pronoun))add("age");
    } else if(type==="location") {
      if(directEntityRelation(text,entityKey,[
        "(?:^|[^A-Za-z0-9]){E}\\s+(?:is|was|has been|gets?|got)\\s+(?:destroyed|demolished|collapsed|burned down|burnt down|damaged|rebuilt|repaired|restored|closed|opened|reopened|abandoned|occupied|captured|evacuated|flooded)\\b",
        "\\b(?:destroyed|demolished|damaged|rebuilt|repaired|restored|closed|opened|reopened|evacuated|flooded)\\s+(?:the\\s+)?{E}(?=$|[^A-Za-z0-9])"
      ],pronoun))add("condition");
      if(directEntityRelation(text,entityKey,[
        "(?:^|[^A-Za-z0-9]){E}\\s+(?:is|was)\\s+(?:owned|controlled|captured|occupied)\\s+by\\b",
        "(?:^|[^A-Za-z0-9]){E}\\s+belongs\\s+to\\b"
      ],pronoun))add("control");
    } else if(type==="item"||type==="vehicle") {
      if(directEntityRelation(text,entityKey,[
        "\\b(?:owns?|has|carries|keeps|holds|wears|receives|accepts|takes|took|picks up|picked up|steals|stole|pockets?|pocketed)\\s+(?:the\\s+|a\\s+|an\\s+)?{E}(?=$|[^A-Za-z0-9])",
        "(?:^|[^A-Za-z0-9]){E}\\s+(?:is|was)\\s+(?:owned|carried|held|kept|worn)\\s+by\\b",
        "\\b(?:gives|gave|gifted|hands|handed|passes|passed)\\s+(?:the\\s+|a\\s+|an\\s+)?{E}\\s+to\\b",
        "\\b(?:gives|gave|gifted|hands|handed|passes|passed)\\s+(?:him|her|them|[A-ZÀ-ÖØ-ÞĀ-Ž][A-Za-zÀ-ÖØ-öø-ÿĀ-ſ'’.-]*(?:\\s+[A-ZÀ-ÖØ-ÞĀ-Ž][A-Za-zÀ-ÖØ-öø-ÿĀ-ſ'’.-]*){0,3})\\s+(?:the\\s+|a\\s+|an\\s+)?{E}(?=$|[^A-Za-z0-9])"
      ],pronoun))add("owner");
      if(directEntityRelation(text,entityKey,[
        "(?:^|[^A-Za-z0-9]){E}\\s+(?:is|was|has been)\\s+(?:hidden|stored|placed|put|buried|locked|left)\\s+(?:in|inside|at|under|beneath|within|on)\\b",
        "\\b(?:hide|hides|hid|store|stores|stored|place|places|placed|put|puts|bury|buries|buried|lock|locks|locked|leave|leaves|left)\\s+(?:the\\s+|a\\s+|an\\s+)?{E}\\s+(?:in|inside|at|under|beneath|within|on)\\b"
      ],pronoun))add("location");
      if(directEntityRelation(text,entityKey,[
        "(?:^|[^A-Za-z0-9]){E}\\s+(?:is|was|has been|gets?|got)\\s+(?:lost|found|stolen|destroyed|broken|damaged|repaired|restored|missing|vaporised|vaporized|obliterated)\\b",
        "(?:^|[^A-Za-z0-9]){E}\\s+(?:(?:simply|just|suddenly|completely|effectively)\\s+)?(?:ceases?|ceased)\\s+to\\s+exist\\b",
        "\\b(?:destroyed|broke|broken|damaged|repaired|restored|vaporised|vaporized|obliterated)\\s+(?:the\\s+|a\\s+|an\\s+)?{E}(?=$|[^A-Za-z0-9])"
      ],pronoun))add("condition");
    } else if(type==="organization") {
      if(directEntityRelation(text,entityKey,[
        "(?:^|[^A-Za-z0-9]){E}\\s+(?:is|was|has been|became)\\s+(?:formed|founded|created|disbanded|dissolved|destroyed|collapsed|active|inactive|banned)\\b",
        "(?:^|[^A-Za-z0-9]){E}\\s+(?:formed|founded|disbanded|dissolved|collapsed)\\b"
      ],pronoun))add("status");
      if(directEntityRelation(text,entityKey,[
        "(?:^|[^A-Za-z0-9]){E}\\s+(?:is|was)\\s+(?:led|directed|headed|commanded)\\s+by\\b",
        "(?:^|[^A-Za-z0-9]){E}['’]s\\s+(?:president|director|commander|leader|head)\\s+(?:is|was)\\b"
      ],pronoun))add("leadership");
    } else if(type==="event") add("event");
    return out.slice(0,4);
  }

  function strictEventCategory(text) {
    const t=cleanText(text);
    if(!t)return"";
    if(/\b(?:resurrected|revived|returned from the dead)\b/i.test(t))return"resurrection";
    if(/\b(?:[A-ZÀ-ÖØ-ÞĀ-Ž][\w'’.-]*(?:\s+[A-ZÀ-ÖØ-ÞĀ-Ž][\w'’.-]*){0,3}|he|she|they)\s+(?:dies|died)\b/i.test(t) ||
       /\b(?:was|is|gets?|got)\s+(?:killed|murdered)\b/i.test(t) ||
       /\b(?:killed|murdered)\s+(?:him|her|them|the\s+[\w'’.-]+|[A-ZÀ-ÖØ-ÞĀ-Ž])/i.test(t))return"death";
    if(/\b(?:gave birth|was born|is born)\b/i.test(t))return"birth";
    if(/\b(?:is|was|became|becomes)\s+(?:married to|engaged to|divorced from|separated from)\b/i.test(t) ||
       /\b(?:married|divorced|broke up with|separated from)\s+(?:him|her|them|[A-ZÀ-ÖØ-ÞĀ-Ž])/i.test(t))return"relationship";
    if(/\b(?:was|is|has been|gets?|got)\s+(?:rebuilt|repaired|restored|reopened)\b/i.test(t) ||
       /\b(?:rebuilt|repaired|restored|reopened)\s+(?:the|a|an|[A-ZÀ-ÖØ-ÞĀ-Ž])/i.test(t))return"restoration";
    if(/\b(?:was|is|has been|gets?|got)\s+(?:destroyed|demolished|vaporised|vaporized|obliterated|burned down|burnt down)\b/i.test(t) ||
       /\b(?:destroyed|demolished|vaporised|vaporized|obliterated|burned down|burnt down)\s+(?:the|a|an|[A-ZÀ-ÖØ-ÞĀ-Ž])/i.test(t) ||
       /\b(?:ceases?|ceased)\s+to\s+exist\b/i.test(t))return"destruction";
    if(/\b(?:was|is|gets?|got)\s+(?:injured|wounded|shot|stabbed|hospitalized|hospitalised)\b/i.test(t) ||
       /\b(?:injured|wounded|shot|stabbed)\s+(?:him|her|them|[A-ZÀ-ÖØ-ÞĀ-Ž])/i.test(t))return"injury";
    if(/\b(?:moved|relocated)\s+(?:to|into|back to)\b/i.test(t) ||
       /\b(?:arrived at|returned to|left home|departed from)\b/i.test(t))return"move";
    if(/\b(?:gave|gifted|handed|passed)\s+(?:(?:him|her|them|[A-ZÀ-ÖØ-ÞĀ-Ž][\w'’.-]*(?:\s+[A-ZÀ-ÖØ-ÞĀ-Ž][\w'’.-]*){0,3})\s+)?(?:the\s+|a\s+|an\s+)?[\w'’.-]+(?:\s+[\w'’.-]+){0,3}(?:\s+to\b|[.!?]?$)/i.test(t) ||
       /\b(?:pockets?|pocketed)\s+(?:the\s+|a\s+|an\s+)?[\w'’.-]+/i.test(t) ||
       /\b(?:was|is|has been)\s+(?:lost|stolen|found)\b/i.test(t))return"item-change";
    if(/\b(?:discovered|found out|confirmed|revealed|confessed)\s+(?:that\b|the\b|a\b|an\b|[A-ZÀ-ÖØ-ÞĀ-Ž])/i.test(t) || /\blearned\s+that\b/i.test(t))return"discovery";
    if(/\b(?:was|is|has been)\s+(?:founded|formed|created|established|closed|dissolved|disbanded)\b/i.test(t) ||
       /\b(?:founded|formed|established|dissolved|disbanded)\s+(?:the|a|an|[A-ZÀ-ÖØ-ÞĀ-Ž])/i.test(t))return"world-change";
    return"";
  }

  function worldEventCategory(text,mode) {
    const c=strictEventCategory(text);
    if(!c)return"";
    if(mode==="claim")return"reported-"+c;
    if(mode==="belief"||mode==="uncertain")return"uncertain-"+c;
    return c;
  }

  function applyTemporalMarkers(text,owners,turn,kind,src) {
    if(!EIDETIC_CONFIG.TRACK_STORY_TIME)return; const w=worldRoot(); if(!w)return;
    const gap=parseForwardGapHours(text); if(gap>0){ w.clock.hours+=gap; w.clock.knownElapsed=true; addTimelineRecord(text,[],owners,turn,kind,src,"event","time-gap",w.clock.hours,{deltaHours:gap}); root().stats.timeJumps=Number(root().stats.timeJumps||0)+1; }
    else if(/\b(?:go(?:es|ing)? to bed|went to bed|sleep(?:s|ing|t)?|falls? asleep|fell asleep|wake(?:s|n|ning)?|woke|when (?:you|i|we|they|he|she) wake|after a while|some time later|later that (?:day|night|morning|afternoon|evening))\b/i.test(text)){
      w.clock.partial=true;
      addTimelineRecord(text,[],owners,turn,kind,src,"event","time-uncertain",w.clock.hours,{uncertain:true});
    }
    const date=parseAbsoluteDate(text); if(date){ const currentMarker=/\b(?:today is|it is|current date is|the date is|now it is|as of)\b/i.test(text)||cleanText(text).length<40; if(currentMarker){ w.clock.baseEpochHours=date.epochHours-w.clock.hours; w.clock.currentDateLabel=date.label; w.clock.knownElapsed=true; addTimelineRecord(text,[],owners,turn,kind,src,"event","current-date",w.clock.hours,{epochHours:date.epochHours,dateLabel:date.label}); } }
    let tm=safeText(text).match(/\b(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?))\b/i); if(!tm)tm=safeText(text).match(/\b(?:early\s+|late\s+)?(morning|afternoon|evening|night|midnight|noon)\b/i);
    if(tm && /\b(?:now|today|tonight|this|it is|it's|currently|current time|at\s+\d|morning|afternoon|evening|night|midnight|noon)\b/i.test(text)){ w.clock.currentTimeLabel=tm[1]; addTimelineRecord(text,[],owners,turn,kind,src,"event","time-marker",w.clock.hours,{timeLabel:tm[1]}); }
  }
  function addWorldMemory(text,owners,turn,kind,src,mode) {
    if(!EIDETIC_CONFIG.ENABLE_WORLD_MEMORY)return; const w=worldRoot(); if(!w||!(mode==="event"||mode==="player-event"||mode==="claim"||mode==="belief"||mode==="uncertain"))return;
    const observationId=safeText(src).split(":")[0];
    const discovered=discoverWorldEntities(text,observationId), mentioned=worldEntitiesMentioned(text); let entities=Array.from(new Set(discovered.concat(mentioned)));
    const r=root(); if(!entities.length && /^(?:he|she|they|it|this place|that place|the building|the room|the item|the object|the weapon|the vehicle)\b/i.test(cleanText(text)) && Array.isArray(r.runtime.lastWorldEntities)) entities=r.runtime.lastWorldEntities.slice(0,3).filter(k=>w.entities[k]);
    if(entities.length) r.runtime.lastWorldEntities=entities.slice(0,4);
    const ago=parseAgoHours(text), eventHours=ago>0?currentStoryHours()-ago:currentStoryHours(), date=parseAbsoluteDate(text), allowCurrent=(mode==="event"||mode==="player-event"), pending=[]; let hasStateChange=false, hasEventEntity=false;
    for(let i=0;i<entities.length;i++){
      const e=w.entities[entities[i]]; if(!e)continue;
      if(e.type==="event")hasEventEntity=true;
      const slots=allowCurrent?worldFactSlots(e.type,text,entities[i],entities.length):[];
      if(slots.length)hasStateChange=true;
      pending.push([entities[i],slots]);
    }
    let category=worldEventCategory(text,mode); if(!category&&hasEventEntity&&allowCurrent)category="event";
    const routineNegation=/\b(?:routine|ordinary|nothing (?:important|major|in the exchange)|no major|without changing|does not change|doesn't change|harmless|clerical mismatch|same mundane|same as before)\b/i.test(text);
    const structured=!!category||hasStateChange||(ago>0&&(hasStateChange||hasEventEntity))||(!!date&&(hasStateChange||!!category));
    if(!routineNegation&&structured) addTimelineRecord(text,entities,owners,turn,kind,src,mode,category||"event",eventHours,date?{dateLabel:date.label,eventEpochHours:date.epochHours}:{});
    if(allowCurrent) for(let i=0;i<pending.length;i++) for(let j=0;j<pending[i][1].length;j++) addWorldFactRecord(pending[i][0],pending[i][1][j],text,owners,turn,kind,src,mode,false);
  }

  function worldRecordOwnerAllows(e,activeOwners) {
    if(!EIDETIC_CONFIG.STRICT_KNOWLEDGE)return true;
    const o=e&&Array.isArray(e.owners)?e.owners:[];
    if(o.indexOf("*")>=0)return true;
    if(!Array.isArray(activeOwners)||!activeOwners.length)return o.indexOf(PLAYER)>=0;
    for(let i=0;i<activeOwners.length;i++)if(o.indexOf(activeOwners[i])<0)return false;
    return true;
  }
  function retrieveWorldContinuity(query,plan,limitFacts,limitEvents,activeOwners) {
    const w=worldRoot(); if(!w||!EIDETIC_CONFIG.ENABLE_WORLD_MEMORY)return{facts:[],events:[]}; plan=plan||makeQueryPlan(query); const qkeys=new Set(worldEntitiesMentioned(query)), tokens=plan.lexicalTokens||[], tags=plan.tags||[];
    const score=(e,isEvent)=>{
      if(!worldRecordOwnerAllows(e,activeOwners))return-999;
      let s=0, exactEntity=false;
      const ents=e.entities||(e.entity?[e.entity]:[]);
      for(let i=0;i<ents.length;i++)if(qkeys.has(ents[i])){s+=8;exactEntity=true;}
      const kw="|"+safeText(e.k)+"|";
      let lm=0;
      for(let i=0;i<tokens.length;i++){
        const vs=plan.variants&&plan.variants[tokens[i]]?plan.variants[tokens[i]]:lexicalVariants(tokens[i]);
        if(keywordMatchesVariants(kw,vs))lm++;
      }
      if(plan.directQuestion && tokens.length && !lm && !exactEntity)return-999;
      s+=lm*2.7;
      for(let i=0;i<tags.length;i++)if(kw.indexOf("|"+tags[i]+"|")>=0)s+=1.2;
      if(/\b(?:die|died|death|dead|killed)\b/i.test(query)&&/death$/.test(safeText(e.category)))s+=e.category==="death"?10:5;
      if(/\b(?:how long|ago|when)\b/i.test(query)&&Number.isFinite(e.storyHours))s+=4;
      if(isEvent&&e.category!=="event")s+=1.5;
      const ageTurns=Math.max(0,currentTurn()-Number(e.turn||0));
      if(ageTurns<=12)s+=1.5; else if(ageTurns>120)s-=1; else if(ageTurns>500)s-=2;
      if(safeText(e.origin)==="bootstrap"&&!plan.explicitRecall)s-=1.25;
      else if(safeText(e.origin)==="live")s+=0.25;
      if(!plan.explicitRecall&&!qkeys.size&&!lm&&s<2)return-999;
      if(!plan.explicitRecall&&tokens.length<=1&&!exactEntity&&s<6)return-999;
      return s;
    };
    const facts=[],seen=new Set(); for(let i=w.facts.length-1;i>=0;i--){const e=w.facts[i];if(!e)continue;const k=e.entity+"|"+e.slot;if(seen.has(k))continue;seen.add(k);const sc=score(e,false);if(sc>=2)facts.push({e,sc});}
    const events=[]; for(let i=w.timeline.length-1;i>=0;i--){const e=w.timeline[i];if(!e||e.category==="time-gap"||e.category==="current-date"||e.category==="time-uncertain")continue;const sc=score(e,true);if(sc>=2)events.push({e,sc});}
    facts.sort((a,b)=>b.sc-a.sc||b.e.turn-a.e.turn);events.sort((a,b)=>b.sc-a.sc||b.e.turn-a.e.turn);
    return{facts:facts.slice(0,limitFacts||EIDETIC_CONFIG.WORLD_FACTS_PER_RECALL).map(x=>x.e),events:events.slice(0,limitEvents||EIDETIC_CONFIG.WORLD_EVENTS_PER_RECALL).map(x=>x.e)};
  }
  function shouldRetrieveWorld(query,plan) {
    if(!EIDETIC_CONFIG.ENABLE_WORLD_MEMORY)return false;
    plan=plan||makeQueryPlan(query);
    if(plan.explicitRecall||plan.currentStateLookup)return true;
    const tags=plan.tags||[], wanted=new Set(["@location","@item","@organization","@status","@time","@worldstate","@event","@affiliation","@relationship","@role"]);
    for(let i=0;i<tags.length;i++)if(wanted.has(tags[i]))return true;
    return worldEntitiesMentioned(query).length>0;
  }

  function worldRecallLines(query,plan,activeOwners) {
    const w=worldRoot(); if(!w)return[]; const got=retrieveWorldContinuity(query,plan,null,null,activeOwners), lines=[];
    if(!got.facts.length&&!got.events.length)return lines;
    lines.push("SCENARIO / WORLD CONTINUITY (only continuity available to every active character in this scene, or narrator/player history when no NPC is active):");
    if(w.clock.knownElapsed&&(tagsContain(plan,"@time")||/\b(?:ago|when|date|year|month|week|day|time)\b/i.test(query))) {
      const d=currentStoryDateLabel(), elapsed=Math.max(0,currentStoryHours()), pieces=[];
      if(d)pieces.push("current tracked date "+d); if(w.clock.currentTimeLabel)pieces.push("time "+w.clock.currentTimeLabel); if(elapsed>0.01)pieces.push((w.clock.partial?"at least ":"")+formatDurationHours(elapsed)+" explicitly elapsed from the tracked story-time origin"+(w.clock.partial?"; additional unquantified time passed":""));
      if(pieces.length)lines.push("• STORY TIME: "+pieces.join("; ")+".");
    }
    for(let i=0;i<got.facts.length;i++){const f=got.facts[i], ent=w.entities[f.entity], age=relativeAgeLabel(f.storyHours); lines.push("• CURRENT "+(ent?ent.type.toUpperCase():"WORLD")+" — "+(ent?ent.name:f.entity)+" / "+safeText(f.slot).toUpperCase()+": "+displayText(f.text,245)+(age&&age!=="now"?" [established "+age+"]":""));}
    for(let i=0;i<got.events.length;i++){
      const e=got.events[i]; let age="";
      const currentAbs=Number.isFinite(w.clock.baseEpochHours)?w.clock.baseEpochHours+currentStoryHours():null;
      if(Number.isFinite(currentAbs)&&Number.isFinite(e.eventEpochHours)) { const diff=currentAbs-e.eventEpochHours; if(diff>0)age=formatDurationHours(diff)+" ago"; }
      if(!age)age=relativeAgeLabel(e.storyHours);
      const when=age&&age!=="now"?age:(e.dateLabel||("T"+e.turn)); const evLabel=e.mode&&e.mode!=="event"&&e.mode!=="player-event"?" ["+modeLabel(e)+"]":""; lines.push("• "+safeText(e.category).replace(/-/g," ").toUpperCase()+evLabel+" — "+when+": "+displayText(e.text,245));
    }
    return lines;
  }
  function tagsContain(plan,tag){return !!(plan&&Array.isArray(plan.tags)&&plan.tags.indexOf(tag)>=0);}

  function anchorEligible(text, mode) {
    mode = mode || epistemicMode(text, "output");
    if (mode === "question" || mode === "belief" || mode === "uncertain") return false;
    if (/^\s*(?:I|we|you|he|she|they|[A-Z][A-Za-z'\-]+)\s+(?:ask|asks|asked|wonder|wonders|wondered|question|questions|questioned)\b/i.test(text) && explicitRecallLanguage(text)) return false;
    const routineNegation = /\b(?:routine|ordinary|nothing (?:important|major|in the exchange)|no major|unchanged|same as before|without changing|does not change|doesn't change)\b/i.test(text);
    const explicitChange = /\b(?:new|first|discovered|revealed|confessed|died|dead|killed|married|divorced|pregnant|born|classified|password|passphrase|promise|promised|betrayed|lost|gained|developed|awakened)\b/i.test(text);
    if (routineNegation && !explicitChange) return false;
    return importance(text) >= 4 || /\b(always|never|canonical|officially|real name|birthday|years old|is my|is his|is her|is their)\b/i.test(text);
  }

  function evidenceRank(mode, manual) {
    if (manual) return 10;
    if (mode === "event" || mode === "player-event") return 5;
    if (mode === "claim") return 3;
    if (mode === "belief") return 2;
    if (mode === "uncertain") return 1;
    return 0;
  }

  function addAnchor(text, owners, turn, source, manual, mode, names, subjects) {
    const r = root();
    if (!r) return;
    text = displayText(text, 300);
    if (!text) return;
    mode = manual ? "event" : (mode || epistemicMode(text, "output"));
    const fp = hash(text.toLowerCase().replace(/[^a-z0-9]+/g, " "));
    const ownerArray = Array.from(owners || [PLAYER]);
    for (let i = r.anchors.length - 1; i >= 0; i--) {
      if (r.anchors[i].fp === fp) {
        const a = r.anchors[i];
        a.turn = Math.max(a.turn || 0, turn);
        a.owners = Array.from(new Set((a.owners || []).concat(ownerArray)));
        a.names = Array.from(new Set((a.names || []).concat(names || [])));
        a.subjects = Array.from(new Set((a.subjects || []).concat(subjects || [])));
        if (evidenceRank(mode, manual) > evidenceRank(a.mode || "event", a.manual)) a.mode = mode;
        if (manual) a.manual = true;
        return;
      }
    }
    const tags = semanticTags(text);
    r.anchors.push({
      id: "a" + (++r.seq), turn: turn, text: text,
      owners: ownerArray,
      names: Array.isArray(names) ? names.slice() : namesMentioned(text),
      subjects: Array.isArray(subjects) ? subjects.slice() : [],
      k: tokenList(text, 20).concat(tags).filter((x, idx, a) => a.indexOf(x) === idx).join("|"),
      imp: manual ? 9 : Math.max(4, importance(text)),
      mode: mode,
      fp: fp,
      src: source || "auto",
      manual: !!manual,
      origin: manual ? "manual" : INGEST_ORIGIN,
    });
    if (r.anchors.length > EIDETIC_CONFIG.MAX_ANCHORS) {
      r.anchors.sort((a, b) => (((b.manual ? 100 : 0) + evidenceRank(b.mode, b.manual) * 8 + b.imp * 5 + b.turn / 1000) - ((a.manual ? 100 : 0) + evidenceRank(a.mode, a.manual) * 8 + a.imp * 5 + a.turn / 1000)));
      r.anchors.length = EIDETIC_CONFIG.MAX_ANCHORS;
      r.anchors.sort((a, b) => a.turn - b.turn);
    }
  }

  function sameOwnerSet(a, b) {
    a = Array.isArray(a) ? a.slice().sort() : [];
    b = Array.isArray(b) ? b.slice().sort() : [];
    return a.length === b.length && a.every((x, i) => x === b[i]);
  }

  function repeatFingerprint(text, kind, owners, mode) {
    const normalized = cleanText(text).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    return hash(kind + "|" + mode + "|" + (owners || []).slice().sort().join(",") + "|" + normalized);
  }

  function suppressExactRepeat(text, kind, owners, mode, imp) {
    const r = root();
    if (!r || imp > 1 || !EIDETIC_CONFIG.REPEAT_SUPPRESSION_WINDOW) return false;
    const fp = repeatFingerprint(text, kind, owners, mode);
    const turn = currentTurn();
    const min = Math.max(0, r.hot.length - EIDETIC_CONFIG.REPEAT_SCAN_LIMIT);
    for (let i = r.hot.length - 1; i >= min; i--) {
      const e = r.hot[i];
      const lastRepeat = Number(e.repeatLast != null ? e.repeatLast : e.turn) || 0;
      if (turn - lastRepeat > EIDETIC_CONFIG.REPEAT_SUPPRESSION_WINDOW) break;
      if (e.rfp !== fp) continue;
      e.repeatCount = (e.repeatCount || 1) + 1;
      e.repeatLast = turn;
      r.stats.suppressedRepeats = (r.stats.suppressedRepeats || 0) + 1;
      return true;
    }
    return false;
  }

  function moveHotToCold() {
    const r = root();
    if (!r) return;
    const limit = Math.max(1, EIDETIC_CONFIG.HOT_EVENT_LIMIT || 4500);
    const margin = Math.max(16, Math.min(48, Math.floor(limit * 0.004)));
    if (r.hot.length > limit + margin) {
      const count = r.hot.length - limit;
      const moved = r.hot.splice(0, count);
      for (let i = 0; i < moved.length; i++) {
        const e = moved[i];
        if (!e) continue;
        const t = displayText(e.text, EIDETIC_CONFIG.COLD_EVENT_CHARS);
        r.cold.push(packCold({
          id: e.id, turn: e.turn, kind: e.kind, text: t, owners: e.owners, names: e.names,
          subjects: e.subjects || [], k: e.k, imp: e.imp, mode: e.mode || "event", src: e.src, origin: e.origin || "legacy",
        }));
        r.stats.coldMoved = (r.stats.coldMoved || 0) + 1;
      }
    }
    const coldLimit = Math.max(1, EIDETIC_CONFIG.COLD_EVENT_LIMIT || 9000);
    if (r.cold.length > coldLimit) r.cold.splice(0, r.cold.length - coldLimit);
  }

  function rollbackFuture(turn) {
    const r = root();
    if (!r) return;
    const lastTurn = r.last && Number.isFinite(r.last.turn) ? r.last.turn : null;
    if (lastTurn != null && turn >= lastTurn) return;

    const before = r.hot.length + r.cold.length + r.anchors.length + r.ledger.length + (r.insights||[]).length + (r.world ? r.world.facts.length + r.world.timeline.length : 0);
    r.hot = r.hot.filter(e => (e.turn || 0) <= turn || e.manual);
    r.cold = r.cold.filter(e => recTurn(e) <= turn || recManual(e));
    r.anchors = r.anchors.filter(e => (e.turn || 0) <= turn || e.manual);
    r.ledger = r.ledger.filter(e => (Number(e && e.turn) || 0) <= turn || (e && e.manual));
    r.insights = (r.insights||[]).filter(e => (Number(e && e.turn) || 0) <= turn || (e && e.manual));
    if(r.runtime)r.runtime.insightSyncSig="";
    if (r.world) { r.world.facts = r.world.facts.filter(e => (Number(e&&e.turn)||0) <= turn || (e&&e.manual)); r.world.timeline = r.world.timeline.filter(e => (Number(e&&e.turn)||0) <= turn || (e&&e.manual)); recomputeWorldClock(); }
    const sceneKeys = Object.keys(r.scene);
    for (let i = 0; i < sceneKeys.length; i++) if (r.scene[sceneKeys[i]] > turn) delete r.scene[sceneKeys[i]];
    const after = r.hot.length + r.cold.length + r.anchors.length + r.ledger.length + (r.insights||[]).length + (r.world ? r.world.facts.length + r.world.timeline.length : 0);
    if (after < before) r.stats.undos = (r.stats.undos || 0) + 1;
    if ((r.last.outputTurn || -1) > turn) { r.last.outputTurn = -1; r.last.outputHash = ""; }
    if ((r.last.inputTurn || -1) > turn) { r.last.inputTurn = -1; r.last.inputHash = ""; }
    r.last.turn = turn;
  }

  function sameTurnSources(turn, kind) {
    const r = root();
    if (!r) return [];
    const out = [];
    const scanTail = arr => {
      for (let i = arr.length - 1; i >= 0; i--) {
        const rt = recTurn(arr[i]);
        if (rt < turn) break;
        if (rt === turn && recKind(arr[i]) === kind) {
          const src = recSource(arr[i]);
          if (src && out.indexOf(src) < 0) out.push(src);
        }
      }
    };
    scanTail(r.hot);
    if (!out.length) scanTail(r.cold);
    return out;
  }

  function purgeTurnKind(turn, kind) {
    const r = root();
    if (!r) return 0;
    let removed = 0;
    const purgeTail = arr => {
      for (let i = arr.length - 1; i >= 0; i--) {
        const rt = recTurn(arr[i]);
        if (rt < turn) break;
        if (rt === turn && recKind(arr[i]) === kind) {
          arr.splice(i, 1);
          removed++;
        }
      }
    };
    purgeTail(r.hot);
    purgeTail(r.cold);
    for (let i = r.anchors.length - 1; i >= 0; i--) {
      const a = r.anchors[i];
      const at = Number(a && a.turn) || 0;
      if (at < turn) break;
      if (!a.manual && at === turn && a.src === kind) r.anchors.splice(i, 1);
    }
    for (let i = r.ledger.length - 1; i >= 0; i--) {
      const e = r.ledger[i], et = Number(e && e.turn) || 0;
      if (et < turn) break;
      if (e && !e.manual && et === turn && e.kind === kind) { r.ledger.splice(i, 1); removed++; }
    }
    for (let i = (r.liveFacts||[]).length - 1; i >= 0; i--) {
      const e=r.liveFacts[i], et=Number(e&&e.turn)||0;
      if(et<turn)break;
      if(e&&et===turn&&e.kind===kind){r.liveFacts.splice(i,1);removed++;}
    }
    for (let i = (r.insights||[]).length - 1; i >= 0; i--) {
      const e=r.insights[i], et=Number(e&&e.turn)||0;
      if(et<turn)break;
      if(e&&et===turn&&e.kind===kind){r.insights.splice(i,1);removed++;}
    }
    if(r.runtime){r.runtime.liveSyncSig="";r.runtime.insightSyncSig="";}
    if (r.world) {
      for (let i=r.world.facts.length-1;i>=0;i--) { const e=r.world.facts[i], et=Number(e&&e.turn)||0; if(et<turn)break; if(e&&!e.manual&&et===turn&&e.kind===kind){r.world.facts.splice(i,1);removed++;} }
      for (let i=r.world.timeline.length-1;i>=0;i--) { const e=r.world.timeline[i], et=Number(e&&e.turn)||0; if(et<turn)break; if(e&&!e.manual&&et===turn&&e.kind===kind){r.world.timeline.splice(i,1);removed++;} }
      recomputeWorldClock();
    }
    return removed;
  }

  function replaceSameTurnKind(turn, kind, sourceHash) {
    const priorHashes = sameTurnSources(turn, kind);
    const sameHash = priorHashes.indexOf(sourceHash) >= 0;
    purgeTurnKind(turn, kind);
    return { sameHash, priorHashes };
  }

  function historyContainsOutputHash(sourceHash) {
    if (!sourceHash || typeof history === "undefined" || !Array.isArray(history)) return false;
    const start = Math.max(0, history.length - 8);
    for (let i = start; i < history.length; i++) {
      const h = history[i] || {};
      if (hash("output|" + cleanText(h.text)) === sourceHash) return true;
    }
    return false;
  }

  function purgeDanglingRetryOutput() {
    const r = root();
    if (!r || r.last.outputTurn !== currentTurn() || !r.last.outputHash) return;
    if (historyContainsOutputHash(r.last.outputHash)) return;
    const n = purgeTurnKind(currentTurn(), "output");
    if (n) {
      r.stats.retryPurges = (r.stats.retryPurges || 0) + 1;
      r.last.outputHash = "";
      r.last.outputTurn = -1;
    }
  }

  function ingest(text, kind) {
    if (!EIDETIC_CONFIG.ENABLED) return;
    const r = root();
    if (!r) return;
    const turn = currentTurn();
    const liveBefore=(r.liveFacts||[]).length+"|"+((r.liveFacts||[]).length?((r.liveFacts[r.liveFacts.length-1].fp)||""):"");
    const insightBefore=(r.insights||[]).length+"|"+((r.insights||[]).length?((r.insights[r.insights.length-1].fp)||""):"");
    rollbackFuture(turn);
    const cleaned = cleanText(text);
    if (!cleaned) return;

    discover(cleaned);
    const srcHash = hash(kind + "|" + cleaned);
    const wholeMode = epistemicMode(cleaned, kind);
    if (wholeMode === "event" || wholeMode === "player-event" || wholeMode === "claim") discoverWorldEntities(cleaned,srcHash);

    if (kind === "input") {
      const existingSources = sameTurnSources(turn, "input");
      if (existingSources.length && existingSources.indexOf(srcHash) < 0) purgeTurnKind(turn, "output");
    }

    const replacement = replaceSameTurnKind(turn, kind, srcHash);
    if (replacement.sameHash || replacement.priorHashes.length) r.stats.retries = (r.stats.retries || 0) + (replacement.priorHashes.length ? 1 : 0);

    captureImportantDialogue(cleaned, kind, turn, srcHash);
    const chunks = chunkText(cleaned);
    let previousStored = null;
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];

      if (sceneResetEvidence(c)) { r.scene = {}; if (r.runtime) r.runtime.lastWorldEntities = []; r.stats.sceneResets = Number(r.stats.sceneResets || 0) + 1; }

      const owners = ownerSetFor(c, kind);
      const ownerArray = Array.from(owners);
      const names = namesMentioned(c);
      const subjects = names.filter(k => ownerArray.indexOf(k) < 0);
      const mode = epistemicMode(c, kind);
      const tags = semanticTags(c);
      const tokens = tokenList(c, 22).concat(tags).filter((x, idx, a) => a.indexOf(x) === idx);
      const imp = mode === "question" ? 1 : importance(c);
      applyTemporalMarkers(c, owners, turn, kind, srcHash + ":" + i);
      addWorldMemory(c, owners, turn, kind, srcHash + ":" + i, mode);
      addLiveFact(c, owners, turn, kind, mode, imp, srcHash + ":" + i);
      captureCharacterReveals(c, owners, turn, kind, mode, imp, srcHash + ":" + i);

      const repeated = suppressExactRepeat(c, kind, ownerArray, mode, imp);
      if (!repeated) {
        const canMerge = previousStored &&
          previousStored.turn === turn && previousStored.kind === kind && previousStored.mode === mode &&
          sameOwnerSet(previousStored.owners, ownerArray) &&
          !sceneResetEvidence(c) &&
          (previousStored.text.length + 1 + c.length) <= EIDETIC_CONFIG.EVENT_CHUNK_CHARS;

        if (canMerge) {
          previousStored.text = displayText(previousStored.text + " " + c, EIDETIC_CONFIG.EVENT_CHUNK_CHARS);
          previousStored.names = Array.from(new Set((previousStored.names || []).concat(names)));
          previousStored.subjects = Array.from(new Set((previousStored.subjects || []).concat(subjects)));
          previousStored.k = tokenList(previousStored.text, 22).concat(semanticTags(previousStored.text)).filter((x, idx, a) => a.indexOf(x) === idx).join("|");
          previousStored.imp = Math.max(previousStored.imp || 1, imp);
          r.stats.mergedSegments = (r.stats.mergedSegments || 0) + 1;
        } else {
          const e = {
            id: "e" + (++r.seq), turn: turn, kind: kind,
            text: displayText(c, EIDETIC_CONFIG.EVENT_CHUNK_CHARS),
            owners: ownerArray, names: names, subjects: subjects,
            k: tokens.join("|"), imp: imp, mode: mode, src: srcHash, origin: INGEST_ORIGIN,
          };
          if (imp <= 1) e.rfp = repeatFingerprint(c, kind, ownerArray, mode);
          r.hot.push(e);
          previousStored = e;
          r.stats.stored = (r.stats.stored || 0) + 1;
        }

        if (anchorEligible(c, mode)) addAnchor(c, owners, turn, kind, false, mode, names, subjects);
      }
      addStateFacts(c, owners, turn, kind, srcHash, mode, false);

      updateScene(c);
    }
    moveHotToCold();
    r.last.turn = turn;
    if (kind === "input") { r.last.inputHash = srcHash; r.last.inputTurn = turn; }
    if (kind === "output") { r.last.outputHash = srcHash; r.last.outputTurn = turn; }
    const liveAfter=(r.liveFacts||[]).length+"|"+((r.liveFacts||[]).length?((r.liveFacts[r.liveFacts.length-1].fp)||""):"");
    const insightAfter=(r.insights||[]).length+"|"+((r.insights||[]).length?((r.insights[r.insights.length-1].fp)||""):"");
    if (INGEST_ORIGIN !== "bootstrap" && (liveAfter!==liveBefore || insightAfter!==insightBefore)) syncLiveStoryCards(true);
  }

  function eventOwnerAllows(e, charKey) {
    if (!EIDETIC_CONFIG.STRICT_KNOWLEDGE) return true;
    if (!e) return false;
    return recOwners(e).indexOf(charKey) >= 0;
  }

  function makeQueryPlan(query) {
    const qnames = namesMentioned(query);
    const nameTokens = new Set();
    const r = root();
    for (let i = 0; i < qnames.length; i++) {
      const ch = r && r.chars[qnames[i]];
      const aliases = ch ? (ch.aliases || [ch.name]) : [qnames[i]];
      for (let j = 0; j < aliases.length; j++) {
        const parts = normName(aliases[j]).split(" ").filter(Boolean);
        for (let k = 0; k < parts.length; k++) nameTokens.add(parts[k]);
      }
    }
    const lexicalTokens = tokenList(query, 28).filter(t => !nameTokens.has(t));
    const lexicalVariantGroups = lexicalTokens.map(t => lexicalVariants(t));
    const variants = Object.create(null);
    for (let i = 0; i < lexicalTokens.length; i++) variants[lexicalTokens[i]] = lexicalVariantGroups[i];
    const tags = semanticTags(query);
    const allTokens = lexicalTokens.slice();
    for (let i = 0; i < tags.length; i++) if (allTokens.indexOf(tags[i]) < 0) allTokens.push(tags[i]);
    const temporal = temporalIntent(query);
    const currentStateLookup = /\b(?:where|what|who|which|how)\b[\s\S]{0,100}\b(?:now|currently|current|presently|still|these days|nowadays|at present)\b/i.test(query) ||
      /\bwhere\b[\s\S]{0,80}\b(?:live|lives|living|stay|stays|home|work|works|located|based)\b/i.test(query);
    return {
      raw: query,
      tokens: allTokens,
      lexicalTokens: lexicalTokens,
      lexicalVariantGroups: lexicalVariantGroups,
      variants: variants,
      tags: tags,
      names: qnames,
      explicitRecall: explicitRecallLanguage(query) || currentStateLookup,
      currentStateLookup: currentStateLookup,
      epistemicIntent: queryEpistemicIntent(query),
      temporal: temporal,
      directQuestion: /\?\s*$/.test(query) || /^(?:who|what|when|where|why|how|which|whose|is|are|was|were|do|does|did|can|could|would|will|should|has|have|had)\b/i.test(query),
    };
  }

  function lexicalVariants(token) {
    token = safeText(token).toLowerCase().replace(/[^a-z0-9'\-]/g, "");
    if (!token || token.charAt(0) === "@") return token ? [token] : [];
    const out = [];
    const add = x => { if (x && x.length >= 3 && out.indexOf(x) < 0) out.push(x); };
    add(token);
    let base = token;
    if (token.length > 5 && /ing$/.test(token)) { base = token.slice(0, -3); add(base); add(base + "e"); }
    else if (token.length > 4 && /ied$/.test(token)) { base = token.slice(0, -3) + "y"; add(base); }
    else if (token.length > 4 && /ed$/.test(token)) { base = token.slice(0, -2); add(base); add(base + "e"); }
    else if (token.length > 4 && /es$/.test(token)) { base = token.slice(0, -2); add(base); add(base + "e"); }
    else if (token.length > 4 && /s$/.test(token)) { base = token.slice(0, -1); add(base); }
    const seeds = out.slice();
    for (let i = 0; i < seeds.length; i++) {
      const b = seeds[i];
      add(b + "s");
      if (b.endsWith("e")) { add(b + "d"); add(b.slice(0, -1) + "ing"); }
      else { add(b + "ed"); add(b + "ing"); }
    }
    return out.slice(0, 10);
  }

  function keywordMatchesLexical(keywordPipe, token) {
    const vars = lexicalVariants(token);
    for (let i = 0; i < vars.length; i++) if (keywordPipe.indexOf("|" + vars[i] + "|") >= 0) return true;
    return false;
  }

  function keywordMatchesVariants(keywordPipe, vars) {
    for (let i = 0; i < vars.length; i++) if (keywordPipe.indexOf("|" + vars[i] + "|") >= 0) return true;
    return false;
  }

  function scoreRecord(e, plan, charKey, turn, isAnchor, isCold) {
    if (!e) return -999;
    if (charKey && !eventOwnerAllows(e, charKey)) return -999;
    const age = Math.max(0, turn - recTurn(e));
    const recordMode = recMode(e);
    if (plan.epistemicIntent === "belief" && recordMode !== "belief" && recordMode !== "uncertain") return -999;
    if (plan.epistemicIntent === "uncertain" && recordMode !== "uncertain" && recordMode !== "belief") return -999;
    if (plan.epistemicIntent === "claim" && recordMode !== "claim") return -999;
    if (!isAnchor && age <= EIDETIC_CONFIG.RECENT_TURN_SUPPRESSION) return -10 + recImportance(e);
    let score = recImportance(e) * (isAnchor ? 1.65 : 0.8);
    if (recManual(e)) score += 12;
    const kw = "|" + recKeywords(e) + "|";
    let lexicalMatches = 0;
    const lexical = Array.isArray(plan.lexicalTokens) ? plan.lexicalTokens : plan.tokens.filter(x => x.charAt(0) !== "@");
    const variantGroups = Array.isArray(plan.lexicalVariantGroups) ? plan.lexicalVariantGroups : lexical.map(t => lexicalVariants(t));
    for (let i = 0; i < variantGroups.length; i++) if (keywordMatchesVariants(kw, variantGroups[i])) lexicalMatches++;
    let tagMatches = 0, strongTagMatches = 0;
    const tags = Array.isArray(plan.tags) ? plan.tags : plan.tokens.filter(x => x.charAt(0) === "@");
    for (let i = 0; i < tags.length; i++) {
      if (kw.indexOf("|" + tags[i] + "|") < 0) continue;
      tagMatches++;
      if (tags[i] !== "@time") strongTagMatches++;
    }
    let topicalEntityMatches = 0;
    const eNames = recNames(e);
    if (eNames.length && plan.names.length) {
      for (let i = 0; i < plan.names.length; i++) {
        if (eNames.indexOf(plan.names[i]) < 0) continue;
        score += 3;
        if (!charKey || plan.names[i] !== charKey) topicalEntityMatches++;
      }
    }
    if (plan.directQuestion && lexical.length && lexicalMatches + topicalEntityMatches + strongTagMatches === 0) return -999;
    if (!plan.explicitRecall && plan.temporal === "neutral" && lexicalMatches + topicalEntityMatches + strongTagMatches === 0 && recImportance(e) < 4) return -999;
    if (plan.explicitRecall || plan.temporal !== "neutral") {
      if (plan.currentStateLookup && tags.some(t => t !== "@time") && strongTagMatches === 0) return -999;
      if (plan.currentStateLookup && tags.indexOf("@location") >= 0) {
        const locFocus = lexical.filter(t => /^(?:live|lives|living|home|address|residence|located|based|stay|stays|staying|quarters|flat|apartment|house|room)$/i.test(t));
        if (locFocus.length) {
          let locMatches = 0;
          for (let i = 0; i < locFocus.length; i++) if (keywordMatchesLexical(kw, locFocus[i])) locMatches++;
          if (!locMatches) return -999;
        }
      }
      if (lexical.length && lexicalMatches + topicalEntityMatches === 0 && !(plan.currentStateLookup && strongTagMatches > 0)) return -999;
      if (!lexical.length && topicalEntityMatches + strongTagMatches === 0) return -999;
    }
    if (lexicalMatches) score += lexicalMatches * 3.1 + Math.min(4.5, lexicalMatches * lexicalMatches * 0.32);
    if (tagMatches) score += tagMatches * 1.05;
    if (charKey && eNames.indexOf(charKey) >= 0) score += 1.5;
    if (plan.explicitRecall) score += Math.min(3, recImportance(e));
    if (plan.temporal === "earliest") score += Math.min(4, age / 80);
    else if (plan.temporal === "latest") score += 3 / Math.sqrt(1 + age / 8);
    else score += 2 / Math.sqrt(1 + age / 20);
    if (recMode(e) === "question") score -= 3;
    if (recMode(e) === "belief" || recMode(e) === "uncertain") score -= 0.6;
    const origin = recOrigin(e);
    if (origin === "bootstrap" && !plan.explicitRecall) score -= 1.4;
    else if (origin === "live") score += 0.35;
    if (isCold) score -= 0.35;
    return score;
  }

  function dedupeRank(records, limit) {
    const out = [];
    const seen = new Set();
    records.sort((a, b) => b.score - a.score || (a._temporalBias || 0) - (b._temporalBias || 0) || b.turn - a.turn);
    for (let i = 0; i < records.length && out.length < limit; i++) {
      const rec = records[i];
      const key = hash(safeText(rec.text).toLowerCase().replace(/[^a-z0-9]+/g, " ").slice(0, 180));
      if (seen.has(key)) continue;
      if (out.some(x => x.turn === rec.turn && safeText(x.k) === safeText(rec.k))) continue;
      seen.add(key);
      out.push(rec);
    }
    return out;
  }

  function boundedCandidatePush(arr, e, score, cap) {
    if (score < EIDETIC_CONFIG.MIN_RECALL_SCORE) return;
    const candidate = {
      score: score, id: recId(e), turn: recTurn(e), text: recText(e), owners: recOwners(e),
      names: recNames(e), subjects: recSubjects(e), k: recKeywords(e), imp: recImportance(e),
      mode: recMode(e), manual: recManual(e), src: recSource(e), origin: recOrigin(e)
    };
    if (arr.length >= cap * 2) {
      let minIndex = 0;
      for (let i = 1; i < arr.length; i++) if (arr[i].score < arr[minIndex].score) minIndex = i;
      if (candidate.score <= arr[minIndex].score) return;
      arr[minIndex] = candidate;
    } else arr.push(candidate);
  }

  function shouldDeepArchiveScan(plan, turn) {
    if (!plan) return true;
    if (plan.explicitRecall || plan.temporal !== "neutral") return true;
    const highValue = new Set(["@secret", "@promise", "@relationship", "@status", "@item"]);
    for (let i = 0; i < (plan.tags || []).length; i++) if (highValue.has(plan.tags[i])) return true;
    const cadence = Math.max(1, EIDETIC_CONFIG.DEEP_SCAN_INTERVAL || 12);
    return turn % cadence === 0;
  }

  function retrieveForOwner(charKey, query, memoryLimit, anchorLimit) {
    const r = root();
    if (!r) return { anchors: [], memories: [] };
    const turn = currentTurn();
    const plan = makeQueryPlan(query);
    const deepScan = shouldDeepArchiveScan(plan, turn);
    plan.deepScan = deepScan;
    const acap = Math.max(anchorLimit || 0, 1) * EIDETIC_CONFIG.CANDIDATE_HEADROOM;
    const mcap = Math.max(memoryLimit || 0, 1) * EIDETIC_CONFIG.CANDIDATE_HEADROOM;
    const anchors = [], memories = [];
    for (let i = 0; i < r.anchors.length; i++) {
      const e = r.anchors[i], sc = scoreRecord(e, plan, charKey, turn, true, false);
      boundedCandidatePush(anchors, e, sc, acap);
    }
    const hotStart = deepScan ? 0 : Math.max(0, r.hot.length - Math.max(1, EIDETIC_CONFIG.ROUTINE_HOT_SCAN_LIMIT || 700));
    for (let i = hotStart; i < r.hot.length; i++) {
      const e = r.hot[i], sc = scoreRecord(e, plan, charKey, turn, false, false);
      boundedCandidatePush(memories, e, sc, mcap);
    }
    if (deepScan) {
      for (let i = 0; i < r.cold.length; i++) {
        const e = r.cold[i], sc = scoreRecord(e, plan, charKey, turn, false, true);
        boundedCandidatePush(memories, e, sc, mcap);
      }
      r.stats.deepScans = (r.stats.deepScans || 0) + 1;
    } else r.stats.routineScans = (r.stats.routineScans || 0) + 1;
    const ar = dedupeRank(anchors, anchorLimit || 0);
    const mr = dedupeRank(memories, memoryLimit || 0);
    if (plan.temporal === "earliest" && mr.length > 1) mr.sort((a, b) => a.turn - b.turn);
    if (plan.temporal === "latest" && mr.length > 1) mr.sort((a, b) => b.turn - a.turn);
    return { anchors: ar, memories: mr, plan: plan };
  }

  function retrieveForCharacter(charKey, query) {
    const r = root();
    if (!r || !r.chars[charKey]) return { anchors: [], memories: [], plan: makeQueryPlan(query) };
    return retrieveForOwner(charKey, query, EIDETIC_CONFIG.MEMORIES_PER_CHARACTER, EIDETIC_CONFIG.ANCHORS_PER_CHARACTER);
  }

  function modeLabel(e) {
    const m = recMode(e);
    if (m === "claim") return "SAID/CLAIMED";
    if (m === "belief") return "BELIEVED/SUSPECTED";
    if (m === "uncertain") return "UNCERTAIN";
    if (m === "question") return "QUESTION/UNRESOLVED";
    return "EVENT";
  }

  function currentStateFacet(text) {
    const t = cleanText(text).toLowerCase();
    if (/\b(?:lives?|living|moved?|move(?:s|d)? to|home|resides?|based|quarters|address)\b/.test(t)) return "location";
    if (/\b(?:works? as|works? at|job|employed|employment|became|promoted|retired|student|lawyer|doctor|teacher|engineer|officer)\b/.test(t)) return "role";
    if (/\b(?:died|dead|alive|resurrected|revived|injured|wounded|hospitalized|hospitalised|pregnant|gave birth)\b/.test(t)) return "status";
    if (/\b(?:married|divorced|engaged|dating|partner|girlfriend|boyfriend|wife|husband|spouse|broke up|break up)\b/.test(t)) return "relationship";
    return "";
  }

  function combinedRecallRecords(got) {
    const plan = got && got.plan ? got.plan : { temporal: "neutral", explicitRecall: false };
    const all = [];
    const add = (e, kind) => {
      if (!e) return;
      const fp = hash(safeText(e.text).toLowerCase().replace(/[^a-z0-9]+/g, " ").slice(0, 180));
      const existing = all.find(x => x.fp === fp);
      if (existing) {
        if (kind === "anchor" && existing.kind !== "anchor") { existing.e = e; existing.kind = kind; }
        return;
      }
      all.push({ e: e, kind: kind, fp: fp });
    };
    for (let i = 0; i < (got.anchors || []).length; i++) add(got.anchors[i], "anchor");
    for (let i = 0; i < (got.memories || []).length; i++) add(got.memories[i], "memory");
    all.sort((a, b) => {
      if (plan.temporal === "earliest") return (a.e.turn - b.e.turn) || (b.e.score - a.e.score);
      if (plan.temporal === "latest") return (b.e.turn - a.e.turn) || (b.e.score - a.e.score);
      return (b.e.score - a.e.score) || (b.e.turn - a.e.turn) || (a.kind === "anchor" ? -1 : 1);
    });
    const cap = plan.explicitRecall ? 5 : (EIDETIC_CONFIG.ANCHORS_PER_CHARACTER + EIDETIC_CONFIG.MEMORIES_PER_CHARACTER);
    if (plan.currentStateLookup && plan.temporal !== "earliest") {
      const filtered = [];
      const seenFacet = new Set();
      for (let i = 0; i < all.length && filtered.length < Math.max(1, cap); i++) {
        const facet = currentStateFacet(all[i].e.text);
        if (facet && seenFacet.has(facet)) continue;
        if (facet) seenFacet.add(facet);
        filtered.push(all[i]);
      }
      return filtered;
    }
    return all.slice(0, Math.max(1, cap));
  }

  function storyCardIdentityName(entry) {
    const t=cleanText(entry||""); if(!t)return"";
    let m=t.match(/(?:^|[|\n])\s*Name\s*[:=-]\s*([^|\n;]+)/i);
    if(m){
      let cand=cleanText(m[1]);
      cand=cand.split(/\s+(?=(?:Alias|Aliases|Birthday|Age|Role|Appearance|Powers?|Personality|Relationships?|Status|Designation|Type|History|Known|Rule|Era|Start|Current|Family)\s*:)/i)[0];
      cand=cand.split(/\s+[—–]\s+/)[0];
      cand=cand.replace(/[,;:]+$/,"").trim();
      if(isPlausibleName(cand,true)&&detectionPenalty(cand)<8)return cand;
    }
    m=t.match(/^([A-ZÀ-ÖØ-ÞĀ-Ž][A-Za-zÀ-ÖØ-öø-ÿĀ-ſ'\-]+(?:\s+(?:(?:de\s+la|de|del|della|di|da|dos|das|du|la|le|van|von|der|den|ter|ten|al|bin|ibn|ap|ben)\s+)?[A-ZÀ-ÖØ-ÞĀ-Ž][A-Za-zÀ-ÖØ-öø-ÿĀ-ſ'\-]+){0,3})\s+is\b/);
    return m&&isPlausibleName(m[1],true)&&detectionPenalty(m[1])<8?m[1]:"";
  }

  function safeStoryCardSeed(entry,ch) {
    const raw=cleanText(entry||""); if(!raw)return"";
    const segments=raw.split(/\s*[|\n]\s*/).map(x=>x.trim()).filter(Boolean), keep=[];
    const safeField=/^(?:Name|Alias|Aliases|Age|Birthday|Role|Appearance|Powers?|Personality|Relationships?)\s*[:=-]/i;
    const future=/\b(?:future|eventually|later returns?|will return|will become|should enter|if .* returns?|hidden|creator-canon override|future chronology|not yet)\b/i;
    for(let i=0;i<segments.length&&keep.length<5;i++) if(safeField.test(segments[i])&&!future.test(segments[i]))keep.push(segments[i]);
    if(!keep.length){
      const first=(raw.match(/^[^.!?]+[.!?]?/)||[])[0]||"";
      if(first&&ch&&new RegExp("^\\s*"+escapeRe(ch.name)+"\\b","i").test(first)&&!future.test(first))keep.push(first.trim());
    }
    return displayText(keep.join(" | "),EIDETIC_CONFIG.CARD_SEED_CHARS);
  }
  function relevantCardSeeds(activeKeys) {
    if (!EIDETIC_CONFIG.INCLUDE_RELEVANT_CARD_SEEDS || typeof storyCards === "undefined" || !Array.isArray(storyCards)) return [];
    const out = [], r=root();
    for (let ai = 0; ai < activeKeys.length; ai++) {
      const key = activeKeys[ai], ch = r && r.chars[key]; if (!ch) continue;
      const aliases=(ch.aliases&&ch.aliases.length?ch.aliases:[ch.name]).map(normName);
      for (let i = 0; i < storyCards.length && out.length < EIDETIC_CONFIG.MAX_CARD_SEEDS; i++) {
        const c=storyCards[i]||{}, type=safeText(c.type).toLowerCase(); if(!/character|npc|person|people|cast/.test(type))continue;
        const keys=splitKeys(c.keys).map(x=>normName(x)).filter(Boolean), entry=cleanText(c.entry!=null?c.entry:c.value), entryName=normName(storyCardIdentityName(entry));
        const exactAliasKey=aliases.some(a=>keys.indexOf(a)>=0);
        const exactIdentity=!!entryName&&aliases.indexOf(entryName)>=0;
        if(!exactAliasKey&&!exactIdentity)continue;
        if(entryName && !exactIdentity) continue;
        const seed=safeStoryCardSeed(entry,ch); if(seed&&!out.some(x=>x.key===key&&x.text===seed))out.push({key,name:ch.name,text:seed});
      }
    }
    return out.slice(0,EIDETIC_CONFIG.MAX_CARD_SEEDS);
  }


  function historyActionKind(item) {
    const t = safeText(item && item.type).toLowerCase();
    if (/^(do|say|story|see)$/.test(t)) return "input";
    return "output";
  }

  function bootstrapExistingHistory() {
    const r = root();
    if (!r || !EIDETIC_CONFIG.ENABLED || r.runtime.bootstrapDone || !EIDETIC_CONFIG.BOOTSTRAP_EXISTING_HISTORY) return 0;
    if (typeof history === "undefined" || !Array.isArray(history)) return 0;

    const maxActions = Math.max(0, Number(EIDETIC_CONFIG.BOOTSTRAP_HISTORY_ACTIONS) || 0);
    const maxChars = Math.max(0, Number(EIDETIC_CONFIG.BOOTSTRAP_HISTORY_CHARS) || 0);
    const baseBatchSize = Math.max(4, Math.min(48, Number(EIDETIC_CONFIG.BOOTSTRAP_BATCH_ACTIONS) || 24));
    const cardCount = (typeof storyCards !== "undefined" && Array.isArray(storyCards)) ? storyCards.length : 0;
    // Large Adventure Scripts already spend part of the hook budget inspecting Story Cards.
    // Reduce history import work further so attaching EIDETIC to 600–1000+ card adventures
    // cannot turn bootstrap into a single-hook timeout. The import simply finishes over more turns.
    const batchSize = cardCount >= 600 ? Math.min(baseBatchSize, 8) : (cardCount >= EIDETIC_CONFIG.LARGE_STORY_CARD_THRESHOLD ? Math.min(baseBatchSize, 12) : baseBatchSize);
    const picked = [];
    let chars = 0;
    for (let i = history.length - 1; i >= 0 && picked.length < maxActions; i--) {
      const item = history[i] || {};
      let txt = cleanText(safeText(item.text != null ? item.text : item.rawText));
      if (!txt || isCommandArtifact(txt)) continue;
      const perAction = Math.max(500, Number(EIDETIC_CONFIG.BOOTSTRAP_ACTION_CHARS) || 6000);
      if (txt.length > perAction) {
        const half = Math.floor((perAction - 5) / 2);
        txt = txt.slice(0, half) + " … " + txt.slice(-half);
      }
      if (maxChars && chars + txt.length > maxChars) {
        if (picked.length) break;
        txt = txt.slice(-maxChars);
      }
      picked.unshift({ item: item, text: txt, index: i, sig: hash(safeText(item.type)+"|"+i+"|"+txt) });
      chars += txt.length;
    }

    if(!picked.length){
      r.runtime.bootstrapTargetCount=0;
      return 0;
    }

    if(!Array.isArray(r.runtime.bootstrapSeen))r.runtime.bootstrapSeen=[];
    const seen=new Set(r.runtime.bootstrapSeen);
    r.runtime.bootstrapTargetCount=picked.length;
    r.runtime.bootstrapPending=true;

    const remaining=picked.filter(x=>!seen.has(x.sig));
    if(!remaining.length){
      r.runtime.bootstrapDone=true;
      r.runtime.bootstrapPending=false;
      r.runtime.bootstrapSeen=[];
      r.runtime.recallCacheKey=""; r.runtime.recallCacheBlock=""; r.runtime.recallPayloadSig="";
      return 0;
    }

    // Import a small oldest-first slice per hook. Added/published scripts share the same
    // 2-second sandbox limit as scenario scripts; incremental import avoids a one-turn
    // timeout when EIDETIC is attached to a long existing Adventure.
    const batch=remaining.slice(0,batchSize);
    const endTurn=currentTurn(), baseTurn=Math.max(0,endTurn-picked.length);
    let imported=0;
    const previousOverride=TURN_OVERRIDE, previousOrigin=INGEST_ORIGIN, previousCapture=BOOTSTRAP_CAPTURE_LIVE;
    try{
      INGEST_ORIGIN="bootstrap";
      for(let bi=0;bi<batch.length;bi++){
        const x=batch[bi], pos=picked.findIndex(y=>y.sig===x.sig);
        TURN_OVERRIDE=baseTurn+Math.max(0,pos);
        BOOTSTRAP_CAPTURE_LIVE=pos>=Math.max(0,picked.length-12);
        ingest(x.text,historyActionKind(x.item));
        imported++;
        seen.add(x.sig);
      }
    }finally{
      TURN_OVERRIDE=previousOverride; INGEST_ORIGIN=previousOrigin; BOOTSTRAP_CAPTURE_LIVE=previousCapture;
    }

    r.runtime.bootstrapSeen=Array.from(seen).slice(-maxActions);
    r.runtime.bootstrapImported=Number(r.runtime.bootstrapImported||0)+imported;
    const still=picked.some(x=>!seen.has(x.sig));
    r.runtime.bootstrapDone=!still;
    r.runtime.bootstrapPending=still;
    if(!still)r.runtime.bootstrapSeen=[];
    r.runtime.recallCacheKey=""; r.runtime.recallCacheBlock=""; r.runtime.recallPayloadSig="";
    if(imported>0)r.stats.bootstrapBatches=Number(r.stats.bootstrapBatches||0)+1;
    return imported;
  }

  function announceActivation(imported) {
    const r = root();
    if (!r || r.runtime.activationAnnounced || !EIDETIC_CONFIG.ENABLED) return;
    r.runtime.activationAnnounced = true;
    const existing = Number(imported) > 0 || currentTurn() > 1;
    const totalImported=Number(r.runtime.bootstrapImported||0);
    const msg = existing
      ? "EIDETIC active — existing Adventure detected; imported " + totalImported + " recent exposed actions so far and will remember new turns automatically."
      : "EIDETIC active — memory tracking is automatic. No command is required.";
    if (typeof state !== "undefined" && state && safeText(state.message).trim()) {
      if (typeof log === "function") log("EIDETIC: " + msg);
      return;
    }
    setMessage(msg);
  }

  function recentNonCommandHistory(limit) {
    const out=[];
    if(typeof history==="undefined"||!Array.isArray(history))return out;
    for(let i=history.length-1;i>=0&&out.length<(limit||1);i--){
      const h=cleanText(safeText(history[i]&&(history[i].text!=null?history[i].text:history[i].rawText)));
      if(!h||isCommandArtifact(h))continue;
      out.unshift(h);
    }
    return out;
  }

  function buildQuery(extraText) {
    const focus = cleanText(extraText || "");
    if (focus) {
      const directQuestion = /\?\s*$/.test(focus) || /^(?:who|what|when|where|why|how|which|whose|is|are|was|were|do|does|did|can|could|would|will|should|has|have|had)\b/i.test(focus);
      const contentTokens=tokenList(focus,12);
      const lowDirection=/^(?:continue|go on|carry on|next|wait|watch|listen|sleep|rest|eat|drink|nod|okay|ok|alright|yes|yeah|yeh|sure|do it|keep going|you (?:wait|watch|listen|sleep|rest|eat|drink|nod))[\s.!?…]*$/i.test(focus);
      // A meaningful short action is its own query. Borrowing the previous AI paragraph
      // here was a major source of irrelevant character/world recall.
      if (!lowDirection || directQuestion || explicitRecallLanguage(focus) || focus.length >= 64 || namesMentioned(focus).length || contentTokens.length>=2) return focus.slice(-1400);
      const parts = [];
      const prior=recentNonCommandHistory(1);
      if(prior.length)parts.push(prior[0].slice(-420));
      parts.push(focus);
      return cleanText(parts.join(" ")).slice(-1400);
    }
    const parts = recentNonCommandHistory(2);
    return cleanText(parts.join(" ")).slice(-1400);
  }

  function effectiveRecallBudget() {
    const r = root();
    let maxChars = r && r.runtime && Number.isFinite(r.runtime.lastMaxChars) ? r.runtime.lastMaxChars : 0;
    if (typeof info !== "undefined" && info && Number.isFinite(info.maxChars)) maxChars = info.maxChars;
    if (!maxChars) return Math.min(EIDETIC_CONFIG.RECALL_BLOCK_MAX_CHARS, 1400);

    const memoryLength=(typeof info!=="undefined"&&info&&Number.isFinite(info.memoryLength))?Math.max(0,info.memoryLength):0;
    const nominal=Math.min(EIDETIC_CONFIG.RECALL_BLOCK_MAX_CHARS,Math.max(EIDETIC_CONFIG.RECALL_MIN_CHARS,Math.floor(maxChars*EIDETIC_CONFIG.RECALL_CONTEXT_FRACTION)));
    const headroom=Math.floor(maxChars*EIDETIC_CONFIG.CONTEXT_HEADROOM_FRACTION);
    const freeAfterMemory=Math.max(0,maxChars-memoryLength-headroom);
    // Recall is appended in onModelContext. Reserve room for user-authored required
    // components, recent history, and triggered Story Cards instead of filling the window.
    let budget=Math.min(nominal,Math.max(280,Math.floor(freeAfterMemory*0.16)));
    if(memoryLength>maxChars*0.50)budget=Math.min(budget,700);
    else if(memoryLength>maxChars*0.35)budget=Math.min(budget,1000);
    budget=Math.max(280,Math.min(EIDETIC_CONFIG.RECALL_BLOCK_MAX_CHARS,budget));
    if(r&&r.stats&&budget<nominal)r.stats.contextTrimAvoided=Number(r.stats.contextTrimAvoided||0)+1;
    return budget;
  }


  function relevantLiveContinuity(query, plan, limit, activeCharactersForScene) {
    const r=root(); if(!r||!Array.isArray(r.liveFacts)||!r.liveFacts.length)return[];
    const turn=currentTurn(), tokens=(plan&&plan.lexicalTokens)||tokenList(query,20);
    const qnames=new Set((plan&&plan.names)||[]), candidates=[];
    const start=Math.max(0,r.liveFacts.length-72);
    for(let i=start;i<r.liveFacts.length;i++){
      const f=r.liveFacts[i]; if(!f||f.superseded||!liveFactCardEligible(f)||liveLooksQuestion(f.text))continue;
      if(EIDETIC_CONFIG.STRICT_KNOWLEDGE){
        const gate=(Array.isArray(activeCharactersForScene)&&activeCharactersForScene.length?activeCharactersForScene:presentSceneCharacters());
        if(gate.length){
          const owners=Array.isArray(f.owners)?f.owners:[]; let visible=true;
          for(let gi=0;gi<gate.length;gi++) if(owners.indexOf(gate[gi])<0){visible=false;break;}
          if(!visible)continue;
        }
      }
      const age=Math.max(0,turn-Number(f.turn||0));
      if(age>72&&safeText(f.origin)!=="live")continue;
      let score=liveFactPriority(f), overlaps=0;
      const low=cleanText(f.text).toLowerCase();
      for(let j=0;j<tokens.length;j++){const tok=tokens[j]; if(tok&&low.indexOf(tok)>=0){score+=4;overlaps++;}}
      const names=f.names||[]; for(let j=0;j<names.length;j++)if(qnames.has(names[j]))score+=7;
      if(age<=2)score+=5; else if(age<=6)score+=4; else if(age<=14)score+=2; else if(age<=30)score+=1;
      if(f.status==="FACT")score+=2;
      if(f.origin==="bootstrap"||f.origin==="card-import")score-=1;
      candidates.push({f,score,priority:liveFactPriority(f),dur:liveFactDurabilityScore(f),overlaps,age,i,facet:liveFactFacet(f)});
    }
    candidates.sort((a,b)=>b.score-a.score||b.priority-a.priority||b.i-a.i);

    const out=[], seen=new Set(), facets=new Set(), max=Math.max(1,limit||EIDETIC_CONFIG.LIVE_RECALL_FACTS);
    for(let pass=0;pass<2&&out.length<max;pass++){
      for(let i=0;i<candidates.length&&out.length<max;i++){
        const c=candidates[i], f=c.f, id=f.fp||f.id; if(seen.has(id))continue;
        if(pass===0){
          if(plan&&plan.directQuestion){
            const nameHit=(f.names||[]).some(n=>qnames.has(n)); if(!(c.overlaps>=2||nameHit))continue;
          }else if(!(c.overlaps>0||c.priority>=14||c.score>=18))continue;
        }else{
          if(plan&&plan.directQuestion)continue;
          if(c.dur<4)continue;
          if(c.age>24&&!(c.priority>=16&&c.age<=60))continue;
        }
        // One line per state facet prevents duplicates such as a proposed destination and
        // the immediately confirmed course lock from occupying half the recall block.
        if(facets.has(c.facet)&&/^(?:mission-course|status|relationship|movement|strategic-threat|strategic-reveal)$/.test(c.facet))continue;
        seen.add(id); facets.add(c.facet); out.push(f);
      }
    }
    out.sort((a,b)=>Number(a.turn||0)-Number(b.turn||0));
    return out;
  }

  function buildRecall(extraText) {
    const r = root();
    if (!r || !EIDETIC_CONFIG.ENABLED) return "";
    seedConfiguredCharacters();
    seedPlayerIdentity();
    seedFromStoryCards();
    refreshCurrentCardSeeds();
    const query = buildQuery(extraText);
    const turn = currentTurn();
    const plan = makeQueryPlan(query);
    let budget = effectiveRecallBudget();
    // An explicit memory question deserves enough room to return at least one useful
    // verified answer even on small-context models. Routine turns stay aggressively compact.
    if (plan.explicitRecall) {
      const maxCtx=(typeof info!=="undefined"&&info&&Number.isFinite(info.maxChars))?Number(info.maxChars):0;
      const explicitFloor=Math.min(EIDETIC_CONFIG.RECALL_BLOCK_MAX_CHARS,Math.max(750,maxCtx?Math.floor(maxCtx*0.08):750));
      budget=Math.max(budget,explicitFloor);
    }
    const sceneSig = Object.keys(r.scene || {}).sort().map(k => k + ":" + r.scene[k]).join(",");
    const focusSig = (r.manualFocus || []).join(",");
    const cacheKey = hash([turn, r.seq || 0, query, budget, sceneSig, focusSig, Object.keys(r.chars || {}).length, r.world ? Object.keys(r.world.entities||{}).length : 0, r.world ? (r.world.facts||[]).length : 0, r.world ? currentStoryHours() : 0, r.liveFacts ? r.liveFacts.length : 0, r.liveFacts && r.liveFacts.length ? r.liveFacts[r.liveFacts.length-1].fp : "", r.insights ? r.insights.length : 0, r.insights && r.insights.length ? r.insights[r.insights.length-1].fp : "", r.runtime.currentCardSeedSig||""].join("|"));
    if (r.runtime.recallCacheKey === cacheKey) return r.runtime.recallCacheBlock || "";

    const active = activeCharacters(query, plan);
    const body = [];

    const liveNow = relevantLiveContinuity(query, plan, EIDETIC_CONFIG.LIVE_RECALL_FACTS, active);
    if (liveNow.length) {
      body.push("CURRENT PLAYED CONTINUITY (recent live canon; newer facts override stale setup. CLAIM/BELIEF/INFERENCE/UNCONFIRMED remain uncertain):");
      for (let li=0; li<liveNow.length; li++) body.push("• "+liveFactLine(liveNow[li]));
      r.stats.liveRecallInjects=Number(r.stats.liveRecallInjects||0)+1;
    }

    const currentSeeds=relevantCurrentCardSeeds(query,plan,liveNow);
    if(currentSeeds.length){
      body.push("SCENARIO CURRENT BASELINE (scenario-authored moving state; newer live play overrides it. This is author continuity, not automatic NPC knowledge):");
      for(let ci=0;ci<currentSeeds.length;ci++)body.push("• "+displayText(currentSeeds[ci].text,EIDETIC_CONFIG.CURRENT_CARD_SEED_CHARS));
    }

    const seeds = relevantCardSeeds(active);
    if (!plan.explicitRecall) for (let i = 0; i < seeds.length; i++) body.push("ESTABLISHED — " + seeds[i].name + ": " + seeds[i].text);

    for (let i = 0; i < active.length; i++) {
      const key = active[i], ch = r.chars[key];
      if (!ch) continue;
      const got = retrieveForCharacter(key, query);
      const records = combinedRecallRecords(got);
      const stateFacts = retrieveCurrentState(key, got.plan || plan, EIDETIC_CONFIG.STATE_FACTS_PER_CHARACTER);
      let insights = retrieveCharacterInsights(key, query, got.plan || plan, active, EIDETIC_CONFIG.CHARACTER_INSIGHT_RECALL);
      const liveTextSet=new Set(liveNow.map(f=>cleanText(f.text).toLowerCase()));
      insights=insights.filter(x=>!liveTextSet.has(cleanText(x.text).toLowerCase()));
      const noVerifiedMemory = !records.length && !stateFacts.length && !insights.length;
      if (noVerifiedMemory && !seeds.some(s => s.key === key)) {
        if (plan.explicitRecall && EIDETIC_CONFIG.ABSTAIN_ON_EXPLICIT_RECALL_MISS) body.push(ch.name.toUpperCase() + " — PRIVATE CONTINUITY: no verified matching memory found; do not invent one.");
        continue;
      }
      body.push(ch.name.toUpperCase() + " — PRIVATE CONTINUITY:");
      if (noVerifiedMemory && plan.explicitRecall && EIDETIC_CONFIG.ABSTAIN_ON_EXPLICIT_RECALL_MISS) body.push("• no verified matching memory found; do not invent one.");
      for (let sj = 0; sj < stateFacts.length; sj++) {
        const sf = stateFacts[sj];
        body.push("• CURRENT KNOWN " + safeText(sf.slot).toUpperCase() + " T" + sf.turn + ": " + displayText(sf.text, 245));
      }
      for (let ij=0;ij<insights.length;ij++) {
        const ix=insights[ij];
        body.push("• IMPORTANT T"+ix.turn+" ["+(ix.speaker?"SAID/":"")+safeText(ix.status)+" • "+safeText(ix.category)+"]: "+displayText(ix.text,230));
        r.stats.characterInsightRecalls=Number(r.stats.characterInsightRecalls||0)+1;
      }
      for (let j = 0; j < records.length; j++) {
        const rec = records[j];
        const e = rec.e;
        body.push("• " + (rec.kind === "anchor" ? "anchor " : "remembers ") + "T" + e.turn + " [" + modeLabel(e) + "]: " + displayText(e.text, 250));
      }
      if (plan.explicitRecall && noVerifiedMemory) {
        const seed = seeds.find(s => s.key === key);
        if (seed) body.push("• ESTABLISHED IDENTITY ONLY (not evidence of the requested past event): " + displayText(seed.text, 190));
      }
    }

    const narrativeInsights=retrieveNarrativeCharacterInsights(query,plan,EIDETIC_CONFIG.CHARACTER_INSIGHT_RECALL,active);
    if(narrativeInsights.length){
      body.push("NARRATIVE IMPORTANT CHARACTER CONTINUITY (player/narrator-known; do not grant this knowledge to an NPC unless their own PRIVATE CONTINUITY also contains it):");
      for(let ni=0;ni<narrativeInsights.length;ni++){
        const ix=narrativeInsights[ni], ch=r.chars&&r.chars[ix.subject];
        body.push("• "+safeText(ch&&ch.name||ix.subject)+" T"+ix.turn+" ["+(ix.speaker?"SAID/":"")+safeText(ix.status)+" • "+safeText(ix.category)+"]: "+displayText(ix.text,230));
        r.stats.characterInsightRecalls=Number(r.stats.characterInsightRecalls||0)+1;
      }
    }

    if (EIDETIC_CONFIG.ENABLE_NARRATIVE_RECALL && !active.length && (plan.explicitRecall || plan.names.length)) {
      const got = retrieveForOwner(PLAYER, query, EIDETIC_CONFIG.NARRATIVE_MEMORIES, 1);
      if (got.anchors.length || got.memories.length) {
        body.push("NARRATIVE CONTINUITY (player/narrator-known history ONLY; no NPC may know this unless the same fact appears in that NPC's PRIVATE CONTINUITY):");
        for (let i = 0; i < got.anchors.length; i++) body.push("• anchor T" + got.anchors[i].turn + " [" + modeLabel(got.anchors[i]) + "]: " + displayText(got.anchors[i].text, 230));
        for (let i = 0; i < got.memories.length; i++) body.push("• T" + got.memories[i].turn + " [" + modeLabel(got.memories[i]) + "]: " + displayText(got.memories[i].text, 230));
      } else if (plan.explicitRecall && EIDETIC_CONFIG.ABSTAIN_ON_EXPLICIT_RECALL_MISS) {
        body.push("NARRATIVE CONTINUITY: no verified matching archived memory found. Do not fabricate a past event to answer the recall request.");
      }
    }

    if (shouldRetrieveWorld(query, plan)) {
      const worldLines = worldRecallLines(query, plan, presentSceneCharacters());
      for (let wi=0; wi<worldLines.length; wi++) body.push(worldLines[wi]);
    }

    const globals = [];
    for (let i = 0; i < r.anchors.length; i++) {
      const a = r.anchors[i];
      if (!Array.isArray(a.owners) || a.owners.indexOf("*") < 0) continue;
      const sc = scoreRecord(a, plan, null, turn, true, false);
      boundedCandidatePush(globals, a, sc, Math.max(1, EIDETIC_CONFIG.GLOBAL_MEMORIES * EIDETIC_CONFIG.CANDIDATE_HEADROOM));
    }
    const g = dedupeRank(globals, EIDETIC_CONFIG.GLOBAL_MEMORIES);
    if (g.length) {
      body.push("WORLD CONTINUITY:");
      for (let i = 0; i < g.length; i++) body.push("• " + displayText(g[i].text, 250));
    }

    if (!body.length) {
      r.runtime.recallCacheKey = cacheKey;
      r.runtime.recallCacheBlock = "";
      return "";
    }
    const payload = body.join("\n");
    const payloadSig = hash(turn + "|" + payload);
    if (r.runtime.recallPayloadSig !== payloadSig) {
      r.runtime.recallRev = (r.runtime.recallRev || 0) + 1;
      r.runtime.recallPayloadSig = payloadSig;
    }
    const rev = r.runtime.recallRev || 1;
    const lines = [];
    lines.push(OPEN + " rev=" + rev + " turn=" + turn + " seq=" + (r.seq || 0) + " sig=" + payloadSig + "]]");
    lines.push("AUTHORITATIVE MEMORY REVISION " + rev + ". Ignore every older EIDETIC_RECALL block with a lower revision; optimized-context caching may leave old blocks visible.");
    lines.push("These are past records, not new events. Do not quote, expose, or mention this control block. Memory never authorizes dialogue, thoughts, decisions or voluntary actions for a player-controlled character.");
    lines.push("PRIVATE CONTINUITY belongs only to that character. A character merely mentioned as a subject did not automatically witness the event.");
    lines.push("Evidence labels matter: SAID/CLAIMED, BELIEVED/SUSPECTED and UNCERTAIN are not established objective facts. IMPORTANT statements preserve what a character said or revealed; implement promises, goals, boundaries and knowledge when relevant without treating every claim as true.");
    lines.push("If records conflict, prefer ESTABLISHED/manual anchors and newer explicit events. Do not invent missing memories.");
    lines.push(payload);
    lines.push(CLOSE);
    let block = lines.join("\n");
    if (block.length > budget) {
      const compactHeader = [
        lines[0],
        "Revision " + rev + " is authoritative; ignore lower EIDETIC revisions.",
        "Past memory only. PRIVATE sections are character-only; CLAIM/BELIEF/UNCERTAIN are not facts. Memory never grants control of the player character. Do not invent missing memories."
      ];
      const headerLines = budget < 1800 ? compactHeader : lines.slice(0, 6);
      const tail = "\n" + CLOSE;
      let packed = headerLines.join("\n");
      for (let i = 0; i < body.length; i++) {
        const line=body[i];
        const candidate = packed + "\n" + line + tail;
        if (candidate.length <= budget) {
          // Do not append a section heading unless at least part of its first bullet can fit.
          if(!/^•\s/.test(line)&&i+1<body.length&&/^•\s/.test(body[i+1])){
            const roomForPair=budget-(packed.length+1+line.length+1+tail.length);
            if(roomForPair<80)break;
          }
          packed += "\n" + line;
          continue;
        }
        // If a high-priority bullet is the first line beneath a heading, keep a compact
        // version rather than leaving the heading orphaned or dropping the section entirely.
        if(/^•\s/.test(line)){
          const room=Math.max(0,budget-packed.length-tail.length-2);
          if(room>=80){packed += "\n"+displayText(line,room);}
        }
        break;
      }
      // Remove a final orphan section heading if compaction still ended on one.
      const packedLines=packed.split("\n");
      if(packedLines.length&&/CONTINUITY|BASELINE|WORLD CONTINUITY|PRIVATE CONTINUITY/i.test(packedLines[packedLines.length-1])&&!/^•/.test(packedLines[packedLines.length-1]))packedLines.pop();
      block = packedLines.join("\n") + tail;
      if (block.length > budget) {
        const room = Math.max(0, budget - compactHeader.join("\n").length - tail.length - 2);
        const emergency = body.length ? displayText(body[0], room) : "";
        block = compactHeader.join("\n") + (emergency ? "\n" + emergency : "") + tail;
      }
    }
    r.last.recallSig = payloadSig;
    r.last.recallRev = rev;
    r.last.recallTurn = turn;
    r.stats.recalls = (r.stats.recalls || 0) + 1;
    r.runtime.recallCacheKey = cacheKey;
    r.runtime.recallCacheBlock = block;
    return block;
  }

  function idleActivationRecallBlock() {
    const r = root();
    if (!r || !EIDETIC_CONFIG.ENABLED) return "";
    return "[[EIDETIC_RECALL turn=" + currentTurn() + " seq=" + (r.seq || 0) + " idle=1]]\n" +
      "EIDETIC ACTIVE: automatic memory initialized; Story Cards scanned. No played events are stored yet.\n" +
      "[[/EIDETIC_RECALL]]";
  }

  function removeOurFrontMemory(existing) {
    existing = safeText(existing);
    const re = /\n?\[\[EIDETIC_RECALL[^\n]*\]\][\s\S]*?\[\[\/EIDETIC_RECALL\]\]\n?/gi;
    return existing.replace(re, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  // Schema 19 add-on safety:
  // Do NOT write state.memory.context/authorsNote/frontMemory. AI Dungeon protects
  // Plot Essentials from added scripts, and some clients report any state.memory mutation
  // as an attempted Plot Essentials write. EIDETIC stores recall in its own persistent
  // state and injects the bounded block only during onModelContext.
  function setFrontMemory(block) {
    const r=root(); if(!r||!r.runtime)return;
    r.runtime.contextRecallBlock=safeText(block);
    r.runtime.contextRecallTurn=currentTurn();
    r.runtime.contextRecallSeq=Number(r.seq||0);
  }

  function clearFrontMemory() {
    const r=root(); if(!r||!r.runtime)return;
    r.runtime.contextRecallBlock="";
    r.runtime.contextRecallTurn=-1;
    r.runtime.contextRecallSeq=-1;
  }

  function currentFrontRecallBlock() {
    const r=root(); if(!r||!r.runtime)return "";
    const block=safeText(r.runtime.contextRecallBlock);
    if(!block)return "";
    if(Number(r.runtime.contextRecallTurn)===currentTurn()&&Number(r.runtime.contextRecallSeq)===Number(r.seq||0))return block;
    const firstLine=block.split("\n",1)[0];
    const turnMarker=new RegExp("\\bturn="+currentTurn()+"(?:\\s|\\])","i");
    const seqMarker=new RegExp("\\bseq="+Number(r.seq||0)+"(?:\\s|\\])","i");
    if(turnMarker.test(firstLine)&&seqMarker.test(firstLine))return block;
    return "";
  }

  function currentRecallAlreadyInText(text, block) {
    if (!block) return true;
    const m = block.match(/\[\[EIDETIC_RECALL\s+rev=(\d+)/i);
    if (!m) return safeText(text).indexOf(block) >= 0;
    const marker = new RegExp("\\[\\[EIDETIC_RECALL\\s+rev=" + escapeRe(m[1]) + "(?:\\s|\\])", "i");
    return marker.test(safeText(text));
  }

  // Schema 23 Optimized Context contract:
  // AI Dungeon's cache-compatible Context modifier must preserve the complete supplied
  // prompt as an unchanged prefix. Dynamic EIDETIC material may only be appended.
  // Never trim, delete, reorder, scrub, or replace any byte from `text` here.
  function compactRecallForAppendRoom(block, room) {
    block=safeText(block).trim();
    room=Math.max(0,Number(room||0));
    if(!block||room<96)return "";
    if(block.length<=room)return block;

    const parts=block.split("\n");
    const close=(parts.length&&parts[parts.length-1].trim()===CLOSE)?CLOSE:"";
    const head=parts.length?parts[0]:"";
    if(!head)return "";
    const required=head.length+(close?(1+close.length):0);
    if(required>room)return "";

    let out=head;
    const end=close?parts.length-1:parts.length;
    for(let i=1;i<end;i++){
      const line=safeText(parts[i]);
      if(!line)continue;
      const reserve=close?(1+close.length):0;
      const full="\n"+line;
      if(out.length+full.length+reserve<=room){out+=full;continue;}
      const left=room-out.length-reserve-1;
      if(left>=48){
        const clipped=displayText(line,left);
        if(clipped)out+="\n"+clipped;
      }
      break;
    }
    if(close)out+="\n"+close;
    return out.length<=room?out:"";
  }

  function appendRecallToContext(text, block) {
    const base=safeText(text);
    block=safeText(block).trim();
    if(!block||currentRecallAlreadyInText(base,block))return base;

    const sep=base&& !base.endsWith("\n")?"\n":"";
    let maxChars=(typeof info!=="undefined"&&info&&Number.isFinite(info.maxChars))?Math.max(0,Number(info.maxChars)):0;
    let suffix=block;

    if(maxChars){
      const room=Math.max(0,maxChars-base.length-sep.length);
      suffix=compactRecallForAppendRoom(block,room);
      if(!suffix){
        const r=root();
        if(r&&r.stats)r.stats.contextRecallSkippedNoRoom=Number(r.stats.contextRecallSkippedNoRoom||0)+1;
        return base;
      }
    }

    const out=base+sep+suffix;
    // Hard invariant for // @cache-compatible: original context MUST remain the exact prefix.
    if(out.slice(0,base.length)!==base)return base;
    const r=root();
    if(r&&r.stats){
      r.stats.contextRecallAppends=Number(r.stats.contextRecallAppends||0)+1;
      r.stats.cacheCompatibleAppends=Number(r.stats.cacheCompatibleAppends||0)+1;
    }
    return out;
  }

  function appendUtilityCommandToContext(text) {
    const base=safeText(text);
    const instruction=utilityCommandContext();
    if(!instruction)return base;
    const sep=base&&!base.endsWith("\n")?"\n":"";
    let maxChars=(typeof info!=="undefined"&&info&&Number.isFinite(info.maxChars))?Math.max(0,Number(info.maxChars)):0;
    if(maxChars&&base.length+sep.length+instruction.length>maxChars){
      const r=root(); if(r&&r.stats)r.stats.commandContextNoRoom=Number(r.stats.commandContextNoRoom||0)+1;
      return base;
    }
    const out=base+sep+instruction;
    return out.slice(0,base.length)===base?out:base;
  }

  function scrubLeak(text) {
    const original = safeText(text);
    if (!/\[\[EIDETIC_RECALL/i.test(original)) return original;
    let cleaned = original.replace(/\[\[EIDETIC_RECALL[^\n]*\]\][\s\S]*?\[\[\/EIDETIC_RECALL\]\]/gi, "");
    const open = cleaned.search(/\[\[EIDETIC_RECALL/i);
    if (open >= 0) cleaned = cleaned.slice(0, open);
    if (/^\s/.test(original) && cleaned && !/^\s/.test(cleaned)) cleaned = " " + cleaned;
    return cleaned;
  }

  function normalizeOutputSpacing(text) {
    text = safeText(text);
    if (EIDETIC_CONFIG.OUTPUT_SPACING !== "auto" || !text || /^\s/.test(text) || /^[,.;:!?…)\]}]/.test(text)) return text;
    if (typeof history === "undefined" || !Array.isArray(history) || !history.length) return text;
    const prev = safeText(history[history.length - 1] && history[history.length - 1].text);
    if (!prev || /\s$/.test(prev)) return text;
    return " " + text;
  }

  function getCharKey(name) {
    const r = root();
    if (!r) return null;
    const k = normName(name);
    if (!k) return null;
    if (k.split(" ").length === 1 && (r.ambiguousFirstNames || []).indexOf(k) >= 0) {
      const active = uniqueActiveSameFirst(r, k);
      return active || null;
    }
    if (r.chars[k]) return k;
    const idx = aliasIndex();
    return idx.map[k] || null;
  }

  function commandText(raw) {
    let s = safeText(raw).trim();
    s = s.replace(/^>\s*You\s+say\s+["“]?/i, "").replace(/["”]\s*$/g, "").trim();
    s = s.replace(/^>\s*You\s+/i, "").trim();
    return s;
  }

  function setMessage(msg) {
    const r = root();
    const out = safeText(msg).replace(/\s+/g, " ").trim().slice(0, 1000);
    if (r && r.runtime) r.runtime.lastMessage = out;
    // Phoenix documents state.message as not yet implemented. Keep it opt-in only
    // for legacy clients so it cannot be a mobile failure dependency.
    if (EIDETIC_CONFIG.LEGACY_STATE_MESSAGE && typeof state !== "undefined" && state) {
      try { state.message = out; } catch (_) {}
    }
    if (typeof log === "function") log("EIDETIC: " + out);
    else if (typeof console !== "undefined" && console.log) console.log("EIDETIC: " + out);
    return out;
  }

  function isCommandArtifact(text) {
    const t = safeText(text);
    return t.indexOf(COMMAND_INPUT_MARKER) >= 0 ||
      /^\s*EIDETIC\s*[•:-]/im.test(t) ||
      /^\s*\/(?:eidetic|memory|config|remember|recall|focus|roster|world|timeline|entity|live|memstats|memdetect|memdebug|memclear)\b/im.test(t);
  }

  function stripCommandArtifactsFromContext(text) {
    let t = safeText(text);
    if (!t || !isCommandArtifact(t)) return t;
    t = t.replace(new RegExp("^.*" + escapeRe(COMMAND_INPUT_MARKER) + ".*(?:\\r?\\n|$)", "gmi"), "");
    t = t.replace(/^\s*EIDETIC\s*[•:-].*(?:\r?\n|$)/gmi, "");
    t = t.replace(/^\s*>?\s*(?:You\s+(?:say\s+)?["“]?)?\/(?:eidetic|memory|config|remember|recall|focus|roster|world|timeline|entity|live|memstats|memdetect|memdebug|memclear)\b.*(?:\r?\n|$)/gmi, "");
    return t.replace(/\n{3,}/g, "\n\n").trim();
  }

  function finishCommand(cmd) {
    const r = root();
    const display = r && r.runtime && r.runtime.pendingCommandInput ? safeText(r.runtime.pendingCommandInput) : ("/" + safeText(cmd));
    if (!r) return { text: display || ("/" + safeText(cmd)), stop: false };
    const result = safeText(r.runtime.lastMessage) || ("Command /" + safeText(cmd) + " completed.");
    r.runtime.pendingCommand = { command: safeText(cmd), result, turn: currentTurn() };
    r.runtime.pendingCommandInput = "";
    r.stats.commandTurns = Number(r.stats.commandTurns || 0) + 1;
    // Never use stop in onInput: AI Dungeon documents that it produces the red
    // "Unable to run scenario scripts" error. Keep the user's command as non-empty
    // input, run one tiny utility generation, then replace that generation in onOutput.
    return { text: display || ("/" + safeText(cmd)), stop: false };
  }

  function handleCommand(raw) {
    const r = root();
    const s = commandText(raw);
    if (!/^\/(?:eidetic|memory|config|remember|recall|focus|roster|world|timeline|entity|live|memstats|memdetect|memdebug|memclear)\b/i.test(s)) return null;
    const m = s.match(/^\/(\w+)\s*(.*)$/);
    if (!m) return null;
    const cmd = m[1].toLowerCase();
    const arg = (m[2] || "").trim();
    if (r && r.runtime) r.runtime.pendingCommandInput = s;

    if (cmd === "eidetic" || cmd === "memory") {
      const chars = Object.keys(r.chars).length;
      setMessage("EIDETIC Schema " + SCHEMA_REVISION + " • " + chars + " characters • " + r.hot.length + " hot memories • " + r.cold.length + " cold memories • " + r.anchors.length + " anchors • " + r.ledger.length + " current-state facts • " + (r.liveFacts||[]).length + " live continuity facts • " + (r.insights||[]).length + " character insights • " + (r.world ? Object.keys(r.world.entities||{}).length : 0) + " world entities • " + (r.world ? r.world.timeline.length : 0) + " timeline events • existing-history import " + Number(r.runtime.bootstrapImported || 0) + " actions • Story Cards " + ((typeof storyCards!=="undefined"&&Array.isArray(storyCards))?storyCards.length:0) + " • large-card phase " + Number(r.runtime.largeCardPhase||0) + " • turn " + currentTurn());
      return finishCommand(cmd);
    }

    if (cmd === "config") {
      // A manual /config request is also a safe retry signal. This is useful when a mobile
      // client initially refused Story Card persistence but the user later opens the same
      // Adventure on desktop/PC where card editing works.
      if(r&&r.runtime){r.runtime.cardRetryTurn=0;if(r.runtime.cardPersistence==="degraded")r.runtime.cardPersistence="unknown";}
      const c=ensureConfigCard();
      const src=c?configSettingsSource(c):configCardEntry();
      const status=c?"Config Story Card available":"Config Story Card unavailable; internal defaults active";
      setMessage("EIDETIC • "+status+" • "+cleanText(src).replace(/\n/g," • "));
      return finishCommand(cmd);
    }

    if (cmd === "live") {
      syncLiveStoryCards(true);
      const lf=(r.liveFacts||[]).slice(-6), ix=(r.insights||[]).filter(x=>x&&!x.superseded).slice(-4);
      let liveMsg="EIDETIC live continuity: "+(r.liveFacts||[]).filter(f=>f&&!f.superseded).length+" active durable facts • "+(r.insights||[]).filter(x=>x&&!x.superseded).length+" character insights • "+Number(r.stats.characterInsightNotes||0)+" character-Notes mirrors • "+Number(r.stats.characterInsightRecalls||0)+" insight recalls • "+Number((r.runtime.currentCardSeeds||[]).length)+" scenario-current baselines cached • "+Number(r.stats.currentCardSeedRecalls||0)+" baseline recalls • "+Number(r.stats.liveRecallInjects||0)+" live-recall injections • Story Card dashboard OFF • Notes sync "+safeText(r.runtime.characterNotesPersistence||"unknown");
      if(Number(r.runtime.cardWriteFailures||0))liveMsg+=" ("+Number(r.runtime.cardWriteFailures||0)+" failed persistence checks)";
      if(ix.length)liveMsg+=" • important: "+ix.map(insightLine).join(" • ");
      else if(lf.length)liveMsg+=" • latest: "+lf.map(liveFactLine).join(" • ");
      setMessage(liveMsg);
      return finishCommand(cmd);
    }

    if (cmd === "memstats") {
      const approx = JSON.stringify(r).length;
      setMessage("EIDETIC archive: " + r.hot.length + " hot + " + r.cold.length + " cold + " + r.anchors.length + " anchors + " + r.ledger.length + " state facts + " + (r.world ? r.world.facts.length : 0) + " world facts + " + (r.world ? r.world.timeline.length : 0) + " timeline events • ~" + Math.round(approx / 1024) + " KB serialized • recall rev " + (r.runtime.recallRev || 0) + " • retry purges " + (r.stats.retryPurges || 0));
      return finishCommand(cmd);
    }

    if (cmd === "roster") {
      const names = Object.keys(r.chars).map(k => r.chars[k].name).slice(0, 30);
      setMessage("Tracked characters: " + (names.length ? names.join(", ") : "none yet"));
      return finishCommand(cmd);
    }

    if (cmd === "world") {
      const w=r.world||{entities:{},facts:[],timeline:[],clock:{}};
      const date=currentStoryDateLabel();
      setMessage("World memory: "+Object.keys(w.entities||{}).length+" entities • "+(w.facts||[]).length+" current/history facts • "+(w.timeline||[]).length+" timeline events"+(w.clock&&w.clock.knownElapsed?" • story time "+(w.clock.partial?"at least ":"")+formatDurationHours(currentStoryHours())+" explicitly elapsed"+(w.clock.partial?" + unquantified time":""):"")+(date?" • date "+date:""));
      return finishCommand(cmd);
    }
    if (cmd === "timeline") {
      const ev=(r.world&&r.world.timeline?r.world.timeline:[]).filter(e=>e.category!=="time-gap"&&e.category!=="current-date"&&e.category!=="time-uncertain").slice(-8);
      setMessage("Recent timeline: "+(ev.length?ev.map(e=>(relativeAgeLabel(e.storyHours)||("T"+e.turn))+" — "+displayText(e.text,90)).join(" • "):"no major world events stored yet"));
      return finishCommand(cmd);
    }
    if (cmd === "entity") {
      const q=worldNorm(arg), w=r.world; if(!q||!w){setMessage("Usage: /entity Name");return finishCommand(cmd);}
      const keys=Object.keys(w.entities||{}).filter(k=>{const e=w.entities[k];return worldNorm(e.name)===q||(e.aliases||[]).some(a=>worldNorm(a)===q)});
      if(!keys.length){setMessage("No tracked world entity named "+arg+".");return finishCommand(cmd);}
      const e=w.entities[keys[0]], facts=(w.facts||[]).filter(f=>f.entity===keys[0]).slice(-5);
      setMessage(e.name+" ["+e.type+"]: "+(facts.length?facts.map(f=>f.slot+"="+displayText(f.text,85)).join(" • "):"tracked, no current facts yet"));
      return finishCommand(cmd);
    }

    if (cmd === "memdetect") {
      const candidates = Object.keys(r.candidates || {}).map(k => r.candidates[k]).sort((a,b) => (Number(b.evidence||0) + Number(b.strong||0)*2) - (Number(a.evidence||0) + Number(a.strong||0)*2)).slice(0, 8);
      const preview = candidates.map(c => c.name + "[" + Number(c.evidence||0).toFixed(0) + "]").join(", ");
      const wc = r.world && r.world.candidates ? Object.keys(r.world.candidates).length : 0;
      const we = r.world && r.world.entities ? Object.keys(r.world.entities).length : 0;
      setMessage("EIDETIC detector: " + DETECTION_FORTRESS_COVERAGE_ROWS + " expanded detection coverage rows • " + Object.keys(r.chars || {}).length + " characters • " + Object.keys(r.candidates || {}).length + " character candidates • " + we + " world entities • " + wc + " world candidates • " + Number(r.stats.detectorRejected || 0) + " character junk rejected • " + Number(r.stats.worldCandidateRejected || 0) + " world junk rejected • " + Number(r.stats.detectorPruned || 0) + " character candidates pruned • " + Number(r.stats.worldCandidatePruned || 0) + " world candidates pruned" + (preview ? " • watching characters: " + preview : ""));
      return finishCommand(cmd);
    }

    if (cmd === "focus") {
      if (!arg || /^auto$/i.test(arg)) {
        r.manualFocus = [];
        setMessage("EIDETIC focus returned to automatic scene detection.");
      } else {
        const names = arg.split(/[,|]/).map(x => x.trim()).filter(Boolean);
        r.manualFocus = [];
        for (let i = 0; i < names.length; i++) {
          ensureChar(prettyName(names[i]), "manual-focus", true);
          const k = getCharKey(names[i]);
          if (k) r.manualFocus.push(r.chars[k].name);
        }
        setMessage("EIDETIC focus: " + (r.manualFocus.join(", ") || "none"));
      }
      return finishCommand(cmd);
    }

    if (cmd === "remember") {
      const parts = arg.split("|");
      if (parts.length < 2) {
        setMessage("Usage: /remember Character | fact   or   /remember * | world fact");
        return finishCommand(cmd);
      }
      const who = parts.shift().trim();
      const fact = parts.join("|").trim();
      if (!fact) {
        setMessage("Nothing to remember.");
        return finishCommand(cmd);
      }
      let owners;
      if (who === "*") owners = new Set(["*"]);
      else if (/^(player|you)$/i.test(who)) owners = new Set([PLAYER]);
      else {
        ensureChar(prettyName(who), "manual", true);
        const k = getCharKey(who);
        owners = new Set(k ? [k] : [PLAYER]);
      }
      addAnchor(fact, owners, currentTurn(), "manual", true);
      addStateFacts(fact, owners, currentTurn(), "manual", "manual:" + hash(fact), "event", true);
      addWorldMemory(fact, owners, currentTurn(), "manual", "manual:" + hash(fact), "event");
      setMessage("Pinned memory for " + who + ": " + displayText(fact, 180));
      return finishCommand(cmd);
    }

    if (cmd === "recall") {
      const parts = arg.split("|");
      const who = (parts.shift() || "").trim();
      const q = parts.join("|").trim() || buildQuery("");
      const k = getCharKey(who);
      if (!k) {
        setMessage("Unknown character. Use /roster or /focus Name first.");
        return finishCommand(cmd);
      }
      const got = retrieveForCharacter(k, q);
      const lines = got.anchors.concat(got.memories).slice(0, 6).map(x => "T" + x.turn + " " + displayText(x.text, 110));
      setMessage(r.chars[k].name + " recalls: " + (lines.length ? lines.join(" • ") : "no matching archived memory"));
      return finishCommand(cmd);
    }

    if (cmd === "memdebug") {
      if (/^on$/i.test(arg)) { r.debug = true; setConfigValueInCard("debug", "on"); }
      else if (/^off$/i.test(arg)) { r.debug = false; setConfigValueInCard("debug", "off"); }
      setMessage("EIDETIC debug " + (r.debug ? "ON" : "OFF"));
      return finishCommand(cmd);
    }

    if (cmd === "memclear") {
      if (arg !== "CONFIRM") {
        setMessage("To erase EIDETIC's archive, type /memclear CONFIRM");
        return finishCommand(cmd);
      }
      delete state[ROOT];
      setMessage("EIDETIC archive cleared.");
      return finishCommand(cmd);
    }
    return null;
  }


  function verifyStoryCardPersistence() {
    const r=root(); if(!r||!r.runtime||!r.runtime.cardExpected)return;
    const exp=r.runtime.cardExpected;
    if(Number(exp.turn||0)>=currentTurn())return;
    let found=null;
    if(typeof storyCards!=="undefined"&&Array.isArray(storyCards)){
      for(let i=0;i<storyCards.length;i++){
        const c=storyCards[i]||{};
        if(exp.id!=null&&String(c.id)===String(exp.id)){found=c;break;}
        if(exp.keys&&splitKeys(c.keys).indexOf(exp.keys)>=0){found=c;break;}
      }
    }
    if(found&&hash(safeText(found.entry!=null?found.entry:found.value))===exp.hash){
      r.runtime.cardPersistence="ok";
      r.runtime.cardWriteFailures=0;
    }else{
      r.runtime.cardPersistence="degraded";
      r.runtime.cardWriteFailures=Number(r.runtime.cardWriteFailures||0)+1;
      r.stats.cardWriteFailures=Number(r.stats.cardWriteFailures||0)+1;
      r.runtime.cardRetryTurn=currentTurn()+EIDETIC_CONFIG.STORY_CARD_RETRY_TURNS;
    }
    r.runtime.cardExpected=null;
  }

  function cardSyncAllowed(force) {
    const r=root(); if(!r||!r.runtime)return false;
    if(force)return true;
    if(r.runtime.cardPersistence!=="degraded")return true;
    return currentTurn()>=Number(r.runtime.cardRetryTurn||0);
  }

  function utilityCommandContext() {
    return "EIDETIC utility command. This is not a story action. Output a single period only.";
  }

  function consumePendingCommandOutput() {
    const r=root(); if(!r||!r.runtime||!r.runtime.pendingCommand)return null;
    const pending=r.runtime.pendingCommand;
    r.runtime.pendingCommand=null;
    const msg=safeText(pending.result)||("Command /"+safeText(pending.command)+" completed.");
    return /^EIDETIC\s*[•:-]/i.test(msg) ? msg : COMMAND_OUTPUT_PREFIX+msg;
  }


  function debugLog(msg) {
    const r = root();
    if (!r || !r.debug) return;
    if (typeof log === "function") log("EIDETIC DEBUG: " + msg);
    else if (typeof console !== "undefined" && console.log) console.log("EIDETIC DEBUG: " + msg);
  }

  function runStoryCardMaintenance(r) {
    const count=(typeof storyCards!=="undefined"&&Array.isArray(storyCards))?storyCards.length:0;
    const large=count>=Math.max(1,Number(EIDETIC_CONFIG.LARGE_STORY_CARD_THRESHOLD)||240);
    let storyCardsChanged=false, insightMigrated=false;

    if (!large) {
      storyCardsChanged=seedFromStoryCards();
      refreshCurrentCardSeeds();
      importManagedContinuityFromStoryCards();
      importManagedInsightsFromStoryCards();
      importPortableProfileDeltasFromStoryCards();
      cleanupSchema18StoryCardClutter();
      cleanupLegacyManagedCharacterCards(4);
      cleanupSchema20CharacterCardClutter(10);
      rescanSchema20RecentContinuity(160);
      insightMigrated=migrateCharacterInsightsFromExistingMemory();
      seedWorldEntitiesFromStoryCards();
      if(insightMigrated)syncLiveStoryCards(true);
      if(storyCardsChanged){backfillCharacterInsightNotes(12);backfillCharacterProfileDeltas(12);}
      return;
    }

    // Adventure Scripts may be attached to adventures with hundreds of Story Cards.
    // AI Dungeon gives each hook only 2 seconds / 16 MB, so never run every full-card
    // pass in the same hook. Rotate maintenance across hooks; live input/output memory
    // remains immediate while background card awareness catches up over a few hooks.
    if(!r.runtime)r.runtime={};
    if(Number(r.runtime.largeCardLastCount)!==count){
      r.runtime.largeCardLastCount=count;
      r.runtime.largeCardPhase=0;
    }
    const phases=Math.max(6,Number(EIDETIC_CONFIG.LARGE_STORY_CARD_MAINTENANCE_PHASES)||6);
    const phase=Math.max(0,Number(r.runtime.largeCardPhase)||0)%phases;

    if(phase===0){
      storyCardsChanged=seedFromStoryCards();
    }else if(phase===1){
      refreshCurrentCardSeeds();
    }else if(phase===2){
      importManagedContinuityFromStoryCards();
      importManagedInsightsFromStoryCards();
      importPortableProfileDeltasFromStoryCards();
    }else if(phase===3){
      cleanupSchema18StoryCardClutter();
      cleanupLegacyManagedCharacterCards(4);
      cleanupSchema20CharacterCardClutter(10);
      rescanSchema20RecentContinuity(80);
      insightMigrated=migrateCharacterInsightsFromExistingMemory();
      if(insightMigrated)syncLiveStoryCards(true);
    }else if(phase===4){
      seedWorldEntitiesFromStoryCards();
    }else{
      backfillCharacterInsightNotes(storyCardsChanged?8:2);
      backfillCharacterProfileDeltas(storyCardsChanged?8:2);
    }

    r.runtime.largeCardPhase=(phase+1)%phases;
    if(r.runtime.largeCardPhase===0)r.runtime.largeCardCycles=Number(r.runtime.largeCardCycles||0)+1;
  }

  function init() {
    const r = root();
    if (!r) return;
    verifyStoryCardPersistence();
    verifyCharacterInsightNotesPersistence();
    seedPlayerIdentity();
    seedConfiguredCharacters();
    applyConfigCard();
    runStoryCardMaintenance(r);
    // Retry a failed Notes mirror sparingly. Internal structured memory remains authoritative.
    if(r.runtime&&r.runtime.characterNotesPersistence==="degraded"&&currentTurn()>=Number(r.runtime.characterNotesRetryTurn||0))backfillCharacterInsightNotes(2);
    const imported = bootstrapExistingHistory();
    announceActivation(imported);
    rollbackFuture(currentTurn());
    purgeDanglingRetryOutput();
    if (typeof info !== "undefined" && info && Number.isFinite(info.maxChars)) r.runtime.lastMaxChars = info.maxChars;
  }

  function run(hook, text) {
    init();
    if (!EIDETIC_CONFIG.ENABLED) {
      clearFrontMemory();
      // Cache-compatible Context must be an exact pass-through while disabled.
      return { text: text, stop: false };
    }
    const r = root();

    if (hook === "input") {
      const command = handleCommand(text);
      if (command) {
        clearFrontMemory();
        return command;
      }
      ingest(text, "input");
      // A brand-new Adventure has no history to backfill, so its first real input closes
      // bootstrap. Existing long Adventures keep importing in small batches across hooks.
      if (!r.runtime.bootstrapDone && cleanText(text) && !r.runtime.bootstrapPending && Number(r.runtime.bootstrapTargetCount||0)===0) r.runtime.bootstrapDone = true;
      const block = buildRecall(text);
      if (block) setFrontMemory(block);
      else clearFrontMemory();
      debugLog("input turn=" + currentTurn() + " hot=" + r.hot.length + " cold=" + r.cold.length);
      return { text: text, stop: false };
    }

    if (hook === "context" || hook === "contextAppend") {
      // Mobile/Phoenix-safe command path: never return stop from Input or Context.
      // The command costs a tiny utility generation which Output intercepts.
      if (r.runtime.pendingCommand) {
        clearFrontMemory();
        // Do not replace the prompt: Optimized Context only accepts an unchanged prefix
        // plus an appended suffix from // @cache-compatible Context scripts.
        return { text: appendUtilityCommandToContext(text), stop: false };
      }

      // IMPORTANT: keep the platform-supplied prompt byte-for-byte intact. Old cleanup
      // helpers remain for non-context data migration only; they must not touch Context.
      const contextText = safeText(text);
      let block = currentFrontRecallBlock();
      if (!block) block = buildRecall("");
      if (!block) {
        const noHistory = (typeof history === "undefined" || !Array.isArray(history) || history.length === 0);
        const noArchive = !(r.hot && r.hot.length) && !(r.cold && r.cold.length) && !(r.anchors && r.anchors.length) && !(r.ledger && r.ledger.length);
        if (noHistory && noArchive) block = idleActivationRecallBlock();
      }
      if (block) {
        setFrontMemory(block); // runtime buffer only; never touches state.memory
        const out=appendRecallToContext(contextText,block);
        debugLog("context recall appended " + block.length + " chars");
        return { text: out, stop: false };
      }
      return { text: contextText, stop: false };
    }

    if (hook === "output") {
      const commandResult = consumePendingCommandOutput();
      if (commandResult != null) {
        // Do not ingest the model's throwaway utility output as story memory.
        r.stats.outputModified=Number(r.stats.outputModified||0)+1;
        return { text: commandResult || "EIDETIC • command completed.", stop: false };
      }

      const original = safeText(text);
      let cleaned = scrubLeak(original);
      // Preserve ordinary model output byte-for-byte by default. Cosmetic spacing edits
      // are opt-in only; users who explicitly select outputSpacing=auto accept that edit.
      if (EIDETIC_CONFIG.OUTPUT_SPACING === "auto") cleaned = normalizeOutputSpacing(cleaned);
      if (cleaned === "") cleaned = original || " ";
      if (cleaned === original) r.stats.outputPassThrough=Number(r.stats.outputPassThrough||0)+1;
      else r.stats.outputModified=Number(r.stats.outputModified||0)+1;

      ingest(cleaned, "output");
      syncLiveStoryCards(false);
      if (EIDETIC_CONFIG.REFRESH_RECALL_AFTER_OUTPUT) {
        const block = buildRecall(cleaned);
        if (block) setFrontMemory(block);
        else clearFrontMemory();
      }
      debugLog("output turn=" + currentTurn() + " stored=" + r.stats.stored);
      return { text: cleaned, stop: false };
    }

    return { text: text, stop: false };
  }

  run._test = {
    schema: SCHEMA_REVISION,
    root: root,
    buildRecall: buildRecall,
    retrieveForCharacter: retrieveForCharacter,
    getCharKey: getCharKey,
    cleanText: cleanText,
    hash: hash,
    epistemicMode: epistemicMode,
    makeQueryPlan: makeQueryPlan,
    participantKeys: participantKeys,
    effectiveRecallBudget: effectiveRecallBudget,
    storyCardAliasCandidate: storyCardAliasCandidate,
    ensureConfigCard: ensureConfigCard,
    applyConfigCard: applyConfigCard,
    normalizeOutputSpacing: normalizeOutputSpacing,
    scrubLeak: scrubLeak,
    activeCharacters: activeCharacters,
    currentStateFacet: currentStateFacet,
    retrieveCurrentState: retrieveCurrentState,
    stateSlotsForCharacter: stateSlotsForCharacter,
    worldEvidenceFromText: worldEvidenceFromText,
    worldLooksNamed: worldLooksNamed,
    classifyWorldName: classifyWorldName,
    worldFactSlots: worldFactSlots,
    worldEventCategory: worldEventCategory,
    strictEventCategory: strictEventCategory,
    evidenceState: evidenceState,
    addLiveFact: addLiveFact,
    liveFactDurabilityScore: liveFactDurabilityScore,
    liveFactCardEligible: liveFactCardEligible,
    cleanupLegacyManagedCharacterCards: cleanupLegacyManagedCharacterCards,
    importManagedContinuityFromStoryCards: importManagedContinuityFromStoryCards,
    syncLiveStoryCards: syncLiveStoryCards,
    stripEideticNotes: stripEideticNotes,
    idleActivationRecallBlock: idleActivationRecallBlock,
    sceneResetEvidence: sceneResetEvidence,
    ownerSetFor: ownerSetFor,
    recOrigin: recOrigin,
    relevantLiveContinuity: relevantLiveContinuity,
    addCharacterInsight: addCharacterInsight,
    captureImportantDialogue: captureImportantDialogue,
    captureCharacterReveals: captureCharacterReveals,
    retrieveCharacterInsights: retrieveCharacterInsights,
    retrieveNarrativeCharacterInsights: retrieveNarrativeCharacterInsights,
    characterInsightsForNotes: characterInsightsForNotes,
    writeCharacterInsightNotes: writeCharacterInsightNotes,
    writeCharacterProfileDelta: writeCharacterProfileDelta,
    characterProfileItems: characterProfileItems,
    characterProfileFactAbout: characterProfileFactAbout,
    findStoryCardForCharacter: findStoryCardForCharacter,
    storyCardCharacterSeedPriority: storyCardCharacterSeedPriority,
    currentCardSeedScore: currentCardSeedScore,
    refreshCurrentCardSeeds: refreshCurrentCardSeeds,
    relevantCurrentCardSeeds: relevantCurrentCardSeeds,
    cleanupSchema20CharacterCardClutter: cleanupSchema20CharacterCardClutter,
    importManagedInsightsFromStoryCards: importManagedInsightsFromStoryCards,
    rescanSchema20RecentContinuity: rescanSchema20RecentContinuity,
    insightCategory: insightCategory,
    insightNoise: insightNoise,
    backfillCharacterInsightNotes: backfillCharacterInsightNotes,
    backfillCharacterProfileDeltas: backfillCharacterProfileDeltas,
    persistStoryCard: persistStoryCard,
    stripCommandArtifactsFromContext: stripCommandArtifactsFromContext,
    cardSyncAllowed: cardSyncAllowed,
    appendRecallToContext: appendRecallToContext,
  };

  return run;
})();
