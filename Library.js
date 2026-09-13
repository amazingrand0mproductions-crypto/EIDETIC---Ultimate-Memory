
const EIDETIC_CONFIG = {
  ENABLED: true,
  AUTO_CONFIG_CARD: true,
  CONFIG_CARD_KEY: "%__EIDETIC_CFG_A9F3C1__%",
  OUTPUT_SPACING: "auto",
  BOOTSTRAP_EXISTING_HISTORY: true,
  BOOTSTRAP_HISTORY_ACTIONS: 240,
  BOOTSTRAP_HISTORY_CHARS: 120000,
  BOOTSTRAP_ACTION_CHARS: 6000,

  SEED_CHARACTERS: [],
  ALWAYS_FOCUS: [],

  AUTO_DISCOVER_CHARACTERS: true,
  NAME_PROMOTION_HITS: 2,
  NAME_PROMOTION_SCORE: 7,
  NAME_STRONG_PROMOTION_SCORE: 7,
  NAME_CANDIDATE_TTL: 80,
  MAX_NAME_CANDIDATES: 240,
  MAX_TRACKED_CHARACTERS: 80,
  MAX_ACTIVE_CHARACTERS: 4,
  MAX_ALIASES_PER_CHARACTER: 24,
  PRESENCE_HOLD_TURNS: 3,

  HOT_EVENT_LIMIT: 4500,
  COLD_EVENT_LIMIT: 9000,
  EVENT_CHUNK_CHARS: 420,
  COLD_EVENT_CHARS: 190,
  MAX_ANCHORS: 1200,

  MEMORIES_PER_CHARACTER: 5,
  ANCHORS_PER_CHARACTER: 3,
  NARRATIVE_MEMORIES: 3,
  GLOBAL_MEMORIES: 2,
  CANDIDATE_HEADROOM: 4,
  MIN_RECALL_SCORE: 2.0,
  RECENT_TURN_SUPPRESSION: 3,
  ROUTINE_HOT_SCAN_LIMIT: 700,
  DEEP_SCAN_INTERVAL: 12,

  REPEAT_SUPPRESSION_WINDOW: 60,
  REPEAT_SCAN_LIMIT: 96,

  RECALL_BLOCK_MAX_CHARS: 3200,
  RECALL_CONTEXT_FRACTION: 0.12,
  RECALL_MIN_CHARS: 850,

  STRICT_KNOWLEDGE: true,
  ENABLE_NARRATIVE_RECALL: true,
  ABSTAIN_ON_EXPLICIT_RECALL_MISS: true,

  USE_FRONT_MEMORY: true,
  APPEND_CONTEXT_FALLBACK: true,
  REFRESH_RECALL_AFTER_OUTPUT: false,

  INCLUDE_RELEVANT_CARD_SEEDS: true,
  CARD_SEED_CHARS: 260,
  MAX_CARD_SEEDS: 2,

  ENABLE_STATE_LEDGER: true,
  STATE_LEDGER_LIMIT: 1800,
  STATE_FACTS_PER_CHARACTER: 3,
  STATE_FACT_CHARS: 280,

  DEBUG: false,
};

const EIDETIC = (() => {
  "use strict";

  const SCHEMA_REVISION = 5;
  const ROOT = "__EIDETIC";
  const OPEN = "[[EIDETIC_RECALL";
  const CLOSE = "[[/EIDETIC_RECALL]]";
  const PLAYER = "@player";
  let ROOT_CACHE_STATE = null;
  let ROOT_CACHE_VALUE = null;
  let TURN_OVERRIDE = null;
  let ALIAS_CACHE_SIG = "";
  let ALIAS_CACHE = null;
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

  const DETECT_PROPER_PATTERN = "([A-ZÀ-ÖØ-ÞĀ-Ž][A-Za-zÀ-ÖØ-öø-ÿĀ-ſ\'\\-]+(?:\\s+[A-ZÀ-ÖØ-ÞĀ-Ž][A-Za-zÀ-ÖØ-öø-ÿĀ-ſ\'\\-]+){0,2})";
  const DETECT_PRESENCE_ALT = PRESENCE_VERBS.map(escapeRe).join("|");
  const DETECT_KIN_ALT = Array.from(DETECT_KINSHIP).map(escapeRe).sort((a,b)=>b.length-a.length).join("|");
  const DETECT_ROLE_ALT = Array.from(DETECT_PERSON_ROLES).filter(x => x.length > 1).map(escapeRe).sort((a,b)=>b.length-a.length).join("|");
  const DETECT_HUMAN_ALT = Array.from(DETECT_HUMAN_CONTEXT).map(escapeRe).sort((a,b)=>b.length-a.length).join("|");
  const EXIT_ALT = EXIT_VERBS.map(escapeRe).sort((a,b)=>b.length-a.length).join("|");

  const IMPORTANCE_PATTERNS = [
    [5, /\b(dies|died|dead|death|killed|murdered|funeral|resurrected|revived)\b/i],
    [5, /\b(married|wedding|divorced|pregnant|pregnancy|born|gave birth|adopted)\b/i],
    [5, /\b(secret|classified|password|passphrase|access code|launch code|override code|security code|confess(?:ed|ion)?|reveal(?:ed)?|identity|real name|truth is|betray(?:ed|al)?)\b/i],
    [5, /\b(promise(?:s|d)?|swear(?:s)?|swore|vow(?:s|ed)?|oath|deal|agreement|owe(?:s|d)?|debt)\b/i],
    [4, /\b(love(?:s|d)?|hate(?:s|d)?|kiss(?:ed|es)?|break up|broke up|dating|partner|girlfriend|boyfriend|wife|husband|spouse|engaged|engagement)\b/i],
    [4, /\b(mother|father|mom|mum|dad|sister|brother|aunt|uncle|cousin|grandmother|grandfather|daughter|son|family)\b/i],
    [4, /\b(weakness|allergy|diagnosed|lost (?:his|her|their|a|the)? ?(?:power|ability)|gained (?:a|the)? ?(?:power|ability)|developed (?:a|the)? ?(?:power|ability)|power awakened|ability awakened)\b/i],
    [3, /\b(power|ability|condition|scar|injury|injured|wounded|hospital|relationship)\b/i],
    [4, /\b(learned|discovered|found out|realized|remembered|forgot|recognizes|recognized)\b/i],
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
      chars: {},
      candidates: {},
      scene: {},
      manualFocus: [],
      playerNames: [],
      ambiguousFirstNames: [],
      runtime: { lastMaxChars: 0, recallRev: 0, recallPayloadSig: "", recallCacheKey: "", recallCacheBlock: "", storyCardSig: "", bootstrapDone: false, bootstrapImported: 0, activationAnnounced: false },
      last: { turn: 0, inputHash: "", outputHash: "", inputTurn: -1, outputTurn: -1, recallSig: "" },
      stats: { stored: 0, retries: 0, undos: 0, recalls: 0, promoted: 0, coldMoved: 0, migrations: 0, retryPurges: 0, suppressedRepeats: 0, mergedSegments: 0, detectorObserved: 0, detectorRejected: 0, detectorPruned: 0, stateFacts: 0, stateReplacements: 0, statePruned: 0 },
      debug: !!EIDETIC_CONFIG.DEBUG,
    };
  }

  function migrateRoot(old) {
    const r = old && typeof old === "object" ? old : makeFreshRoot();
    if (!Array.isArray(r.hot)) r.hot = [];
    if (!Array.isArray(r.cold)) r.cold = [];
    if (!Array.isArray(r.anchors)) r.anchors = [];
    if (!Array.isArray(r.ledger)) r.ledger = [];
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
    if (typeof r.runtime.configGuideSig !== "string") r.runtime.configGuideSig = "";
    if (typeof r.runtime.configCardMode !== "string") r.runtime.configCardMode = "";
    if (typeof r.runtime.configProbePending !== "boolean") r.runtime.configProbePending = false;
    if (typeof r.runtime.configCardWarned !== "boolean") r.runtime.configCardWarned = false;
    if (!(typeof r.runtime.configCardId === "number" || typeof r.runtime.configCardId === "string")) r.runtime.configCardId = "";
    if (typeof r.runtime.bootstrapDone !== "boolean") r.runtime.bootstrapDone = !!((r.hot && r.hot.length) || (r.cold && r.cold.length) || (r.anchors && r.anchors.length) || (r.ledger && r.ledger.length));
    if (!Number.isFinite(r.runtime.bootstrapImported)) r.runtime.bootstrapImported = 0;
    if (typeof r.runtime.activationAnnounced !== "boolean") r.runtime.activationAnnounced = !!r.runtime.bootstrapDone;
    if (!r.stats || typeof r.stats !== "object") r.stats = {};
    if (!r.last || typeof r.last !== "object") r.last = {};
    if (!Number.isFinite(r.last.inputTurn)) r.last.inputTurn = -1;
    if (!Number.isFinite(r.last.outputTurn)) r.last.outputTurn = -1;
    const needsSchemaMigration = (Number(r.schema) || 0) < SCHEMA_REVISION;
    const needsColdPacking = r.cold.some(x => x && !Array.isArray(x));
    if (needsSchemaMigration || needsColdPacking || Object.prototype.hasOwnProperty.call(r, "v")) {
      r.stats.migrations = (r.stats.migrations || 0) + 1;
      r.cold = r.cold.map(packCold).filter(Boolean);
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
  function packCold(e) {
    if (!e) return null;
    if (isPackedRecord(e)) return e;
    return [recId(e), recTurn(e), recKind(e), recText(e), recOwners(e), recNames(e), recSubjects(e), recKeywords(e), recImportance(e), recMode(e), recSource(e)];
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
    if (/\b(?:rumou?r|alleged(?:ly)?|apparently|reportedly|maybe|perhaps|possibly|might|could have|seems?|appears to)\b/i.test(t)) return "uncertain";
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
    return out;
  }

  function explicitRecallLanguage(text) {
    const t = safeText(text);
    return /\b(?:remember|recall|forgot|before|last time|previously|used to|again|what happened|when did|where did|who was|first time|earliest|originally)\b/i.test(t) ||
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
    if (!name || name.length < 2 || name.length > 64) return false;
    const bits = nameBits(name);
    if (!bits.length || bits.length > (trusted ? 6 : 4)) return false;
    for (let i = 0; i < bits.length; i++) {
      const raw = bits[i];
      const b = raw.replace(/[^A-Za-z0-9À-ÖØ-öø-ÿĀ-ſ\-']/g, "");
      if (!b) return false;
      if (IDENTITY_ABSOLUTE.has(b.toLowerCase())) return false;
      if (trusted) {
        if (!/^[A-Za-z0-9À-ÖØ-öø-ÿĀ-ſ][A-Za-z0-9À-ÖØ-öø-ÿĀ-ſ'\-]*$/.test(b)) return false;
      } else if (!/^[A-ZÀ-ÖØ-ÞĀ-Ž][A-Za-zÀ-ÖØ-öø-ÿĀ-ſ'\-]*$/.test(b)) return false;
    }
    return true;
  }

  function detectionPenalty(name) {
    const n = normName(name);
    const bits = n.split(" ").filter(Boolean);
    if (!bits.length) return 99;
    if (DETECT_NONPERSON_PHRASES.has(n)) return 10;
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
      const penalty = detectionPenalty(name);
      const hardOverride = reason === "dialogue-attribution" || reason === "speaker-verb" || reason === "direct-address";
      const appliedPenalty = strong ? (hardOverride ? Math.min(3, penalty) : Math.min(6, penalty)) : penalty;
      let score = Math.max(-8, base - appliedPenalty);
      if (penalty >= 8 && !hardOverride) score = Math.min(0, score);
      if (!map[k]) map[k] = { name, score: -99, strong: 0, requiresStrong: false, reasons: [] };
      const e = map[k];
      if (score > e.score) e.score = score;
      if (penalty >= 3) e.requiresStrong = true;
      if (strong) e.strong = Math.max(e.strong, score);
      if (e.reasons.indexOf(reason) < 0) e.reasons.push(reason);
    };

    const proper = DETECT_PROPER_PATTERN;
    const verbs = DETECT_PRESENCE_ALT;
    let m;

    const actor = new RegExp("\\b" + proper + "\\s+(" + verbs + ")\\b", "g");
    while ((m = actor.exec(text)) !== null) {
      const speech = /^(?:says|asks|replies|whispers|shouts|yells|answers|speaks)$/i.test(m[2] || "");
      add(m[1], speech ? 12 : 10, speech ? "speaker-verb" : "actor-verb", true);
    }

    const afterQuote = new RegExp("[.!?][”\"]?\\s*,?\\s*" + proper + "\\s+(?:says|asks|replies|whispers|shouts|yells|answers|murmurs|mutters)\\b", "g");
    while ((m = afterQuote.exec(text)) !== null) add(m[1], 12, "dialogue-attribution", true);

    const introPatterns = [
      new RegExp("\\b(?:this is|meet|introducing|introduced as|known as|called|named)\\s+" + proper + "\\b", "gi"),
      new RegExp("\\b(?:my name is|I am|I'm)\\s+" + proper + "\\b", "g"),
      new RegExp("\\b(?:name is|real name is|goes by)\\s+" + proper + "\\b", "gi")
    ];
    for (let pi = 0; pi < introPatterns.length; pi++) while ((m = introPatterns[pi].exec(text)) !== null) add(m[1], 13, "explicit-introduction", true);

    const relation = new RegExp("\\b(?:my|your|his|her|their|our|the)\\s+(?:" + DETECT_KIN_ALT + ")\\s+" + proper + "\\b", "gi");
    while ((m = relation.exec(text)) !== null) add(m[1], 11, "named-relation", true);

    const titled = new RegExp("\\b(?:" + DETECT_ROLE_ALT + ")\\.?\\s+" + proper + "\\b", "gi");
    while ((m = titled.exec(text)) !== null) add(m[1], 10, "person-title", true);

    const vocative = new RegExp("(?:^|[\\n.!?\"“”])\\s*" + proper + "\\s*[,—-]\\s*(?:please\\s+)?(?:wait|listen|look|stop|come|go|help|tell|answer|stay|run|move|wake|sit|stand|hey)\\b", "g");
    while ((m = vocative.exec(text)) !== null) add(m[1], 9, "direct-address", true);

    const possessive = new RegExp("\\b" + proper + "['’]s\\s+(?:" + DETECT_HUMAN_ALT + ")\\b", "g");
    while ((m = possessive.exec(text)) !== null) add(m[1], 8, "human-possessive", true);

    const recipient = new RegExp("\\b(?:tell|tells|told|ask|asks|asked|call|calls|called|phone|phones|phoned|text|texts|texted|hug|hugs|hugged|kiss|kisses|kissed|meet|meets|met|follow|follows|followed|help|helps|helped|thank|thanks|thanked)\\s+(?:to\\s+)?" + proper + "\\b", "gi");
    while ((m = recipient.exec(text)) !== null) add(m[1], 9, "interpersonal-recipient", true);

    const generic = /\b([A-ZÀ-ÖØ-ÞĀ-Ž][a-zà-öø-ÿā-ž][A-Za-zÀ-ÖØ-öø-ÿĀ-ſ'\-]{1,20}(?:\s+[A-ZÀ-ÖØ-ÞĀ-Ž][a-zà-öø-ÿā-ž][A-Za-zÀ-ÖØ-öø-ÿĀ-ſ'\-]{1,20}){0,2})\b/g;
    while ((m = generic.exec(text)) !== null) add(m[1], 4, "generic-capitalized", false);

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
          if (ch.aliases.indexOf(name) < 0 && ch.aliases.length < EIDETIC_CONFIG.MAX_ALIASES_PER_CHARACTER) ch.aliases.push(name);
          ch.name = name;
          ch.lastSource = source || ch.lastSource;
          return ek;
        }
        if (incomingParts.length === 1 && existingParts.length > 1) {
          const fullCandidates = existingKeys.filter(k2 => normName(r.chars[k2].name || k2).split(" ")[0] === first && normName(r.chars[k2].name || k2).split(" ").length > 1);
          if (fullCandidates.length === 1) {
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
      strictKnowledge: "on",
      autoDetect: "on",
      narrativeRecall: "on",
      abstainOnMiss: "on",
      currentState: "on",
      memoryDepth: "deep",
      recallSize: "balanced",
      activeCharacters: "4",
      outputSpacing: "auto",
      debug: "off",
    };
  }

  function configCardNotes(values) {
    const v = Object.assign(configCardDefaults(), values || {});
    return [
      "🧠 EIDETIC — CONFIG & QUICK GUIDE",
      "Config schema: 4",
      "",
      "EIDETIC works automatically. No setup card, commands, or character list is required.",
      "Edit only the value after =. Settings are kept in player-only Notes when supported, with a hidden-trigger Entry fallback.",
      "",
      "⚙️ SETTINGS",
      "enabled = " + v.enabled,
      "strictKnowledge = " + v.strictKnowledge,
      "autoDetect = " + v.autoDetect,
      "narrativeRecall = " + v.narrativeRecall,
      "abstainOnMiss = " + v.abstainOnMiss,
      "currentState = " + v.currentState,
      "memoryDepth = " + v.memoryDepth,
      "recallSize = " + v.recallSize,
      "activeCharacters = " + v.activeCharacters,
      "outputSpacing = " + v.outputSpacing,
      "debug = " + v.debug,
      "",
      "📖 SIMPLE GUIDE",
      "enabled — on/off master switch.",
      "strictKnowledge — Keeps private memories with characters who actually knew/witnessed them. Recommended: on.",
      "autoDetect — Finds NPCs automatically while rejecting locations, objects, organizations and other junk. Recommended: on.",
      "narrativeRecall — Allows relevant player/narrator-known history when appropriate.",
      "abstainOnMiss — Prevents explicit recall from inventing a past memory when no evidence exists. Recommended: on.",
      "currentState — Keeps each NPC's latest known location, role, status, relationship, ability, possession and identity while preserving older history.",
      "memoryDepth — compact / standard / deep. Compact = 1,200 + 2,400 + 500 anchors; standard = 2,800 + 5,600 + 800; deep = 4,500 + 9,000 + 1,200.",
      "recallSize — small / balanced / large. Smaller saves context; larger can surface more memory. Balanced is recommended.",
      "activeCharacters — 1–8 NPC memory sections considered at once. Recommended: 4.",
      "outputSpacing — auto repairs a missing space before AI continuation text; preserve leaves spacing untouched.",
      "debug — Extra diagnostics. Leave off unless troubleshooting.",
      "",
      "✨ AUTOMATIC FEATURES",
      "• Deep hot + cold episodic memory and durable anchors",
      "• Character-scoped knowledge, witnesses and private continuity",
      "• Facts / claims / suspicions / uncertainty / questions stay distinct",
      "• Knowledge-scoped current-state ledger + time-aware recall",
      "• Smart relevance ranking and semantic tags",
      "• Detection Fortress anti-junk NPC detection",
      "• Alias, title and codename merging",
      "• Scene presence and private-thought ownership",
      "• Retry / undo / abandoned-branch cleanup",
      "• Repetition compression and Story Card identity awareness",
      "• Adaptive context budgeting, revision safety and leak scrubbing",
      "",
      "💡 NORMAL USE — Just play. Commands are optional.",
      "",
      "🛠️ OPTIONAL COMMANDS",
      "/eidetic or /memory — quick status   /memstats — archive statistics",
      "/memdetect — detection status   /roster — tracked NPCs",
      "/focus Alice — prioritize Alice   /focus auto — automatic focus",
      "/remember Alice | fact — pin a creator-confirmed memory",
      "/recall Alice | topic — inspect matching memory",
      "/memdebug on/off — diagnostics   /memclear CONFIRM — erase EIDETIC memory",
      "",
      "⚠️ Keep setting names unchanged. Invalid values safely fall back to defaults."
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

  function configValue(notes, key) {
    const m = safeText(notes).match(new RegExp("^\\s*" + escapeRe(key) + "\\s*=\\s*([^\\r\\n#]+)", "im"));
    return m ? m[1].trim().toLowerCase() : "";
  }

  function configCardValues(notes) {
    const d = configCardDefaults(), out = {};
    Object.keys(d).forEach(k => { const v = configValue(notes, k); out[k] = v || d[k]; });
    return out;
  }

  function configNotesSource(c) {
    if (!c || typeof c !== "object") return "";
    const fields = ["description", "notes"];
    for (let i = 0; i < fields.length; i++) {
      const v = safeText(c[fields[i]]);
      if (/EIDETIC — CONFIG & QUICK GUIDE/.test(v)) return v;
    }
    return "";
  }

  function configGuideSource(c) {
    const r = root();
    const fields = [];
    ["description", "notes", "entry", "value"].forEach(field => {
      const v = safeText(c && c[field]);
      if (/EIDETIC — CONFIG & QUICK GUIDE/.test(v)) fields.push(v);
    });
    if (!fields.length) return "";
    const prior = r && r.runtime ? safeText(r.runtime.configGuideSig) : "";
    if (prior) {
      for (let i = 0; i < fields.length; i++) if (hash(fields[i]) !== prior) return fields[i];
    }
    return fields[0];
  }

  function tryWriteConfigNotes(c, guide) {
    if (!c || typeof c !== "object") return false;
    try { c.description = guide; } catch (_) {}
    try { c.notes = guide; } catch (_) {}
    return /EIDETIC — CONFIG & QUICK GUIDE/.test(safeText(c.description)) ||
      /EIDETIC — CONFIG & QUICK GUIDE/.test(safeText(c.notes));
  }

  function warnConfigCardUnavailable() {
    const r = root();
    if (!r || !r.runtime || r.runtime.configCardWarned) return;
    r.runtime.configCardWarned = true;
    const msg = "EIDETIC is running, but its Config & Guide card could not be created. Enable Story Cards/Memory Bank if you want the in-game settings card.";
    if (typeof state !== "undefined" && state && !safeText(state.message)) setMessage(msg);
    else debugLog(msg);
  }

  function ensureConfigCard() {
    if (!EIDETIC_CONFIG.AUTO_CONFIG_CARD || typeof storyCards === "undefined" || !Array.isArray(storyCards)) return null;
    const r = root();
    let idx = findConfigCardIndex();
    let created = false;
    if (idx < 0 && typeof addStoryCard === "function") {
      try {
        const made = addStoryCard(EIDETIC_CONFIG.CONFIG_CARD_KEY, configCardNotes(), "Custom");
        created = made !== false;
        if (Number.isInteger(made) && made >= 0 && made < storyCards.length) idx = made;
        if (idx < 0) idx = findConfigCardIndex();
      } catch (_) {}
    }
    if (idx < 0 || !storyCards[idx]) {
      warnConfigCardUnavailable();
      return null;
    }

    const c = storyCards[idx];
    if (r && r.runtime && c.id != null) r.runtime.configCardId = c.id;
    const persistedNotesBeforeWrite = configNotesSource(c);
    if (r && r.runtime) {
      if (persistedNotesBeforeWrite) {
        r.runtime.configCardMode = "notes";
        r.runtime.configProbePending = false;
      } else if (r.runtime.configProbePending) {
        r.runtime.configCardMode = "entry";
        r.runtime.configProbePending = false;
      }
    }

    const source = configGuideSource(c);
    const values = configCardValues(source);
    const guide = configCardNotes(values);
    c.type = "Custom";
    try { c.title = "🧠 EIDETIC — Config & Guide"; } catch (_) {}
    c.keys = EIDETIC_CONFIG.CONFIG_CARD_KEY;

    tryWriteConfigNotes(c, guide);
    if ("value" in c) {
      try { c.value = (r && r.runtime && r.runtime.configCardMode === "notes") ? "" : guide; } catch (_) {}
    }

    if (r && r.runtime) {
      if (created && !r.runtime.configCardMode) {
        c.entry = guide;
        r.runtime.configProbePending = true;
      } else if (r.runtime.configCardMode === "notes") {
        c.entry = "";
      } else {
        c.entry = guide;
      }
      r.runtime.configGuideSig = hash(guide);
      r.runtime.configCardWarned = false;
    } else {
      c.entry = guide;
    }
    return c;
  }

  function setConfigValueInCard(key, value) {
    const c = ensureConfigCard();
    if (!c) return false;
    const re = new RegExp("^(\\s*" + escapeRe(key) + "\\s*=\\s*)[^\\r\\n#]+", "im");
    let changed = false;
    ["description", "notes", "entry", "value"].forEach(field => {
      if (typeof c[field] === "string" && re.test(c[field])) {
        c[field] = c[field].replace(re, "$1" + safeText(value));
        changed = true;
      }
    });
    const r = root();
    const source = configGuideSource(c);
    if (r && r.runtime && source) r.runtime.configGuideSig = hash(source);
    return changed;
  }

  function applyConfigCard() {
    const c = ensureConfigCard();
    if (!c) return;
    const r = root();
    const n = configGuideSource(c) || safeText(c.entry);
    const on = v => /^(on|true|yes|1|enabled)$/.test(v);
    const off = v => /^(off|false|no|0|disabled)$/.test(v);
    const bool = (key, fallback) => { const v = configValue(n,key); return on(v) ? true : off(v) ? false : fallback; };
    EIDETIC_CONFIG.ENABLED = bool("enabled", true);
    EIDETIC_CONFIG.STRICT_KNOWLEDGE = bool("strictKnowledge", true);
    EIDETIC_CONFIG.AUTO_DISCOVER_CHARACTERS = bool("autoDetect", true);
    EIDETIC_CONFIG.ENABLE_NARRATIVE_RECALL = bool("narrativeRecall", true);
    EIDETIC_CONFIG.ABSTAIN_ON_EXPLICIT_RECALL_MISS = bool("abstainOnMiss", true);
    EIDETIC_CONFIG.ENABLE_STATE_LEDGER = bool("currentState", true);
    EIDETIC_CONFIG.DEBUG = bool("debug", false);
    const spacing = configValue(n,"outputSpacing");
    EIDETIC_CONFIG.OUTPUT_SPACING = spacing === "preserve" ? "preserve" : "auto";
    const depth = configValue(n,"memoryDepth");
    if (depth === "compact") { EIDETIC_CONFIG.HOT_EVENT_LIMIT=1200; EIDETIC_CONFIG.COLD_EVENT_LIMIT=2400; EIDETIC_CONFIG.MAX_ANCHORS=500; }
    else if (depth === "standard") { EIDETIC_CONFIG.HOT_EVENT_LIMIT=2800; EIDETIC_CONFIG.COLD_EVENT_LIMIT=5600; EIDETIC_CONFIG.MAX_ANCHORS=800; }
    else { EIDETIC_CONFIG.HOT_EVENT_LIMIT=4500; EIDETIC_CONFIG.COLD_EVENT_LIMIT=9000; EIDETIC_CONFIG.MAX_ANCHORS=1200; }
    const recall = configValue(n,"recallSize");
    if (recall === "small") { EIDETIC_CONFIG.RECALL_BLOCK_MAX_CHARS=1800; EIDETIC_CONFIG.RECALL_CONTEXT_FRACTION=0.08; EIDETIC_CONFIG.RECALL_MIN_CHARS=650; }
    else if (recall === "large") { EIDETIC_CONFIG.RECALL_BLOCK_MAX_CHARS=4200; EIDETIC_CONFIG.RECALL_CONTEXT_FRACTION=0.16; EIDETIC_CONFIG.RECALL_MIN_CHARS=1000; }
    else { EIDETIC_CONFIG.RECALL_BLOCK_MAX_CHARS=3200; EIDETIC_CONFIG.RECALL_CONTEXT_FRACTION=0.12; EIDETIC_CONFIG.RECALL_MIN_CHARS=850; }
    const ac=Number(configValue(n,"activeCharacters"));
    EIDETIC_CONFIG.MAX_ACTIVE_CHARACTERS=Number.isFinite(ac)?Math.max(1,Math.min(8,Math.floor(ac))):4;
    if (r) r.debug=EIDETIC_CONFIG.DEBUG;
  }

  function seedFromStoryCards() {
    if (typeof storyCards === "undefined" || !Array.isArray(storyCards)) return;
    const r = root();
    const sigParts = [];
    for (let i = 0; i < storyCards.length; i++) {
      const c = storyCards[i] || {};
      const type = safeText(c.type).toLowerCase();
      if (!/character|npc|person|people|cast/.test(type)) continue;
      const entryForSig = cleanText(c.entry != null ? c.entry : c.value);
      sigParts.push(safeText(c.id) + "|" + type + "|" + safeText(c.title) + "|" + safeText(c.keys) + "|" + entryForSig);
    }
    const sig = hash(sigParts.join("\u001e"));
    if (r && r.runtime && r.runtime.storyCardSig === sig) return;
    for (let i = 0; i < storyCards.length; i++) {
      const c = storyCards[i] || {};
      const type = safeText(c.type).toLowerCase();
      const entry = cleanText(c.entry != null ? c.entry : c.value);
      const rawKeys = splitKeys(c.keys).map(x => safeText(x).trim()).filter(Boolean);
      const characterish = /character|npc|person|people|cast/.test(type);
      if (!characterish) continue;

      const entryName = entry.match(/^(?:name\s*[:=-]\s*)?([A-ZÀ-ÖØ-ÞĀ-Ž][A-Za-zÀ-ÖØ-öø-ÿĀ-ſ'\-]+(?:\s+[A-ZÀ-ÖØ-ÞĀ-Ž][A-Za-zÀ-ÖØ-öø-ÿĀ-ſ'\-]+){0,2})(?:\s+is\b|\s*[,;:\-])/);
      const titleName = safeText(c.title).trim();
      let canonical = "";
      if (entryName && isPlausibleName(entryName[1], true)) canonical = entryName[1];
      else if (titleName && isPlausibleName(titleName, true) && detectionPenalty(titleName) < 8) canonical = titleName;
      else {
        for (let j = 0; j < rawKeys.length; j++) {
          if (isPlausibleName(rawKeys[j], true) && detectionPenalty(rawKeys[j]) < 8) { canonical = rawKeys[j]; break; }
        }
      }
      if (!canonical || isPlayerName(canonical)) continue;
      let charKey = ensureChar(canonical, entryName ? "story-card-entry" : "story-card", true);
      if (!charKey) continue;
      if (entryName && isPlausibleName(entryName[1], true)) charKey = ensureChar(entryName[1], "story-card-entry", true) || charKey;
      for (let j = 0; j < rawKeys.length; j++) {
        const alias = rawKeys[j];
        if (storyCardAliasCandidate(alias, canonical, entryName && entryName[1], entry)) addAliasToCharacter(charKey, alias, "story-card-alias");
      }
      if (entryName) addAliasToCharacter(charKey, entryName[1], "story-card-entry");
    }
    if (r && r.runtime) r.runtime.storyCardSig = sig;
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
      new RegExp("\\b(?:tell|tells|told|ask|asks|asked|show|shows|showed|give|gives|gave|hand|hands|handed|call|calls|called|phone|phones|phoned|meet|meets|met|hug|hugs|hugged|kiss|kisses|kissed|hit|hits|attacks?|attacked)\\s+(?:to\\s+)?" + n + "\\b", "i"),
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
    return /^(?:later\b|hours? later\b|days? later\b|the next (?:day|morning|evening|week)\b|the following (?:day|morning|week)\b|meanwhile\b|elsewhere\b)/i.test(t) ||
      /\bI\s+(?:leave|left)(?:\s+the)?\s+[A-Za-z][^.!?]{0,80}?(?:\.|,|\band\b|$)/i.test(t) ||
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
    const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
    const out = [];
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
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
      if (new RegExp(lead + "[^.!?]{0,42}\\b(?:lives?|resides?|stays?)\\s+(?:in|at|on|near|with)\\b|" + lead + "[^.!?]{0,42}\\b(?:moved|moves|relocated)\\s+(?:to|into|back to)\\b|" + lead + "[^.!?]{0,42}\\bis\\s+(?:now\\s+|currently\\s+)?(?:based|located)\\s+(?:in|at|on|near)\\b", "i").test(text)) add("location");
      if (new RegExp(lead + "[^.!?]{0,36}\\b(?:works?|serves?)\\s+as\\b|" + lead + "[^.!?]{0,36}\\b(?:became|becomes|is|remains)\\s+(?:an?\\s+)?(?:" + DETECT_ROLE_ALT + ")\\b", "i").test(text)) add("role");
      if (new RegExp(lead + "[^.!?]{0,34}\\b(?:is|was|became|becomes|remains|has become)\\s+(?:now\\s+|currently\\s+|still\\s+)?(?:dead|alive|injured|wounded|pregnant|missing|unconscious|awake|ill|sick|healthy|retired|imprisoned|incarcerated|hospitalized|hospitalised)\\b|" + lead + "[^.!?]{0,24}\\b(?:dies|died|recovered|recovers)\\b", "i").test(text)) add("status");
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
        r.ledger.push({ id:"s"+(++r.seq), turn, kind, text:shown, owners:ownerArray.slice(), subject, slot, k:tokenList(shown,20).concat(semanticTags(shown)).filter((x,i,a)=>a.indexOf(x)===i).join("|"), src:sourceHash, fp, manual:!!manual });
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
          subjects: e.subjects || [], k: e.k, imp: e.imp, mode: e.mode || "event", src: e.src,
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

    const before = r.hot.length + r.cold.length + r.anchors.length + r.ledger.length;
    r.hot = r.hot.filter(e => (e.turn || 0) <= turn || e.manual);
    r.cold = r.cold.filter(e => recTurn(e) <= turn || recManual(e));
    r.anchors = r.anchors.filter(e => (e.turn || 0) <= turn || e.manual);
    r.ledger = r.ledger.filter(e => (Number(e && e.turn) || 0) <= turn || (e && e.manual));
    const sceneKeys = Object.keys(r.scene);
    for (let i = 0; i < sceneKeys.length; i++) if (r.scene[sceneKeys[i]] > turn) delete r.scene[sceneKeys[i]];
    const after = r.hot.length + r.cold.length + r.anchors.length + r.ledger.length;
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
    rollbackFuture(turn);
    const cleaned = cleanText(text);
    if (!cleaned) return;

    discover(cleaned);
    const srcHash = hash(kind + "|" + cleaned);

    if (kind === "input") {
      const existingSources = sameTurnSources(turn, "input");
      if (existingSources.length && existingSources.indexOf(srcHash) < 0) purgeTurnKind(turn, "output");
    }

    const replacement = replaceSameTurnKind(turn, kind, srcHash);
    if (replacement.sameHash || replacement.priorHashes.length) r.stats.retries = (r.stats.retries || 0) + (replacement.priorHashes.length ? 1 : 0);

    const chunks = chunkText(cleaned);
    let previousStored = null;
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];

      if (sceneResetEvidence(c)) r.scene = {};

      const owners = ownerSetFor(c, kind);
      const ownerArray = Array.from(owners);
      const names = namesMentioned(c);
      const subjects = names.filter(k => ownerArray.indexOf(k) < 0);
      const mode = epistemicMode(c, kind);
      const tags = semanticTags(c);
      const tokens = tokenList(c, 22).concat(tags).filter((x, idx, a) => a.indexOf(x) === idx);
      const imp = mode === "question" ? 1 : importance(c);

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
            k: tokens.join("|"), imp: imp, mode: mode, src: srcHash,
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
      mode: recMode(e), manual: recManual(e), src: recSource(e)
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

  function relevantCardSeeds(activeKeys) {
    if (!EIDETIC_CONFIG.INCLUDE_RELEVANT_CARD_SEEDS || typeof storyCards === "undefined" || !Array.isArray(storyCards)) return [];
    const out = [];
    for (let ai = 0; ai < activeKeys.length; ai++) {
      const key = activeKeys[ai];
      const r = root();
      const ch = r && r.chars[key];
      if (!ch) continue;
      for (let i = 0; i < storyCards.length && out.length < EIDETIC_CONFIG.MAX_CARD_SEEDS; i++) {
        const c = storyCards[i] || {};
        const type = safeText(c.type).toLowerCase();
        if (!/character|npc|person|people|cast/.test(type)) continue;
        const keys = splitKeys(c.keys).map(x => x.trim().toLowerCase());
        const entry = cleanText(c.entry != null ? c.entry : c.value);
        const aliases = (ch.aliases && ch.aliases.length ? ch.aliases : [ch.name]);
        const matchKey = aliases.some(a => keys.indexOf(normName(a)) >= 0) || keys.indexOf(key) >= 0;
        const matchEntry = aliases.some(a => new RegExp("(^|[^a-z0-9])" + escapeRe(a) + "([^a-z0-9]|$)", "i").test(entry));
        if (matchKey || matchEntry) {
          const seed = displayText(entry, EIDETIC_CONFIG.CARD_SEED_CHARS);
          if (seed && !out.some(x => x.key === key && x.text === seed)) out.push({ key: key, name: ch.name, text: seed });
        }
      }
    }
    return out.slice(0, EIDETIC_CONFIG.MAX_CARD_SEEDS);
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
    const picked = [];
    let chars = 0;
    for (let i = history.length - 1; i >= 0 && picked.length < maxActions; i--) {
      const item = history[i] || {};
      let txt = cleanText(safeText(item.text != null ? item.text : item.rawText));
      if (!txt) continue;
      const perAction = Math.max(500, Number(EIDETIC_CONFIG.BOOTSTRAP_ACTION_CHARS) || 6000);
      if (txt.length > perAction) {
        const half = Math.floor((perAction - 5) / 2);
        txt = txt.slice(0, half) + " … " + txt.slice(-half);
      }
      if (maxChars && chars + txt.length > maxChars) {
        if (picked.length) break;
        txt = txt.slice(-maxChars);
      }
      picked.unshift({ item: item, text: txt, index: i });
      chars += txt.length;
    }

    const endTurn = currentTurn();
    const baseTurn = Math.max(0, endTurn - picked.length);
    let imported = 0;
    const previousOverride = TURN_OVERRIDE;
    try {
      for (let i = 0; i < picked.length; i++) {
        TURN_OVERRIDE = baseTurn + i;
        ingest(picked[i].text, historyActionKind(picked[i].item));
        imported++;
      }
    } finally {
      TURN_OVERRIDE = previousOverride;
    }
    r.runtime.bootstrapDone = true;
    r.runtime.bootstrapImported = imported;
    r.runtime.recallCacheKey = "";
    r.runtime.recallCacheBlock = "";
    r.runtime.recallPayloadSig = "";
    return imported;
  }

  function announceActivation(imported) {
    const r = root();
    if (!r || r.runtime.activationAnnounced || !EIDETIC_CONFIG.ENABLED) return;
    r.runtime.activationAnnounced = true;
    const existing = Number(imported) > 0 || currentTurn() > 1;
    const msg = existing
      ? "EIDETIC active — existing Adventure detected; imported " + (Number(imported) || 0) + " recent exposed actions and will remember new turns automatically."
      : "EIDETIC active — memory tracking is automatic. No command is required.";
    if (typeof state !== "undefined" && state && safeText(state.message).trim()) {
      if (typeof log === "function") log("EIDETIC: " + msg);
      return;
    }
    setMessage(msg);
  }

  function buildQuery(extraText) {
    const focus = cleanText(extraText || "");
    if (focus) {
      if (explicitRecallLanguage(focus) || focus.length >= 64 || namesMentioned(focus).length) return focus.slice(-1400);
      const parts = [];
      if (typeof history !== "undefined" && Array.isArray(history) && history.length) {
        const h = cleanText(safeText(history[history.length - 1] && history[history.length - 1].text));
        if (h) parts.push(h.slice(-420));
      }
      parts.push(focus);
      return cleanText(parts.join(" ")).slice(-1400);
    }
    const parts = [];
    if (typeof history !== "undefined" && Array.isArray(history)) {
      const start = Math.max(0, history.length - 2);
      for (let i = start; i < history.length; i++) parts.push(safeText(history[i] && history[i].text));
    }
    return cleanText(parts.join(" ")).slice(-1400);
  }

  function effectiveRecallBudget() {
    const r = root();
    let maxChars = r && r.runtime && Number.isFinite(r.runtime.lastMaxChars) ? r.runtime.lastMaxChars : 0;
    if (typeof info !== "undefined" && info && Number.isFinite(info.maxChars)) maxChars = info.maxChars;
    if (!maxChars) return Math.min(EIDETIC_CONFIG.RECALL_BLOCK_MAX_CHARS, 2200);
    let budget = Math.floor(maxChars * EIDETIC_CONFIG.RECALL_CONTEXT_FRACTION);
    const safeFloor = Math.min(EIDETIC_CONFIG.RECALL_MIN_CHARS, budget);
    budget = Math.max(safeFloor, budget);
    budget = Math.min(EIDETIC_CONFIG.RECALL_BLOCK_MAX_CHARS, budget);
    if (typeof info !== "undefined" && info && Number.isFinite(info.memoryLength) && info.memoryLength > maxChars * 0.45) budget = Math.max(EIDETIC_CONFIG.RECALL_MIN_CHARS, Math.floor(budget * 0.7));
    return budget;
  }

  function buildRecall(extraText) {
    const r = root();
    if (!r || !EIDETIC_CONFIG.ENABLED) return "";
    seedConfiguredCharacters();
    seedPlayerIdentity();
    seedFromStoryCards();
    const query = buildQuery(extraText);
    const turn = currentTurn();
    const budget = effectiveRecallBudget();
    const sceneSig = Object.keys(r.scene || {}).sort().map(k => k + ":" + r.scene[k]).join(",");
    const focusSig = (r.manualFocus || []).join(",");
    const cacheKey = hash([turn, r.seq || 0, query, budget, sceneSig, focusSig, Object.keys(r.chars || {}).length].join("|"));
    if (r.runtime.recallCacheKey === cacheKey) return r.runtime.recallCacheBlock || "";

    const plan = makeQueryPlan(query);
    const active = activeCharacters(query, plan);
    const body = [];

    const seeds = relevantCardSeeds(active);
    if (!plan.explicitRecall) for (let i = 0; i < seeds.length; i++) body.push("ESTABLISHED — " + seeds[i].name + ": " + seeds[i].text);

    for (let i = 0; i < active.length; i++) {
      const key = active[i], ch = r.chars[key];
      if (!ch) continue;
      const got = retrieveForCharacter(key, query);
      const records = combinedRecallRecords(got);
      const stateFacts = retrieveCurrentState(key, got.plan || plan, EIDETIC_CONFIG.STATE_FACTS_PER_CHARACTER);
      const noVerifiedMemory = !records.length && !stateFacts.length;
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
    lines.push("These are past records, not new events. Do not quote, expose, or mention this control block.");
    lines.push("PRIVATE CONTINUITY belongs only to that character. A character merely mentioned as a subject did not automatically witness the event.");
    lines.push("Evidence labels matter: SAID/CLAIMED, BELIEVED/SUSPECTED and UNCERTAIN are not established objective facts. Preserve uncertainty.");
    lines.push("If records conflict, prefer ESTABLISHED/manual anchors and newer explicit events. Do not invent missing memories.");
    lines.push(payload);
    lines.push(CLOSE);
    let block = lines.join("\n");
    if (block.length > budget) {
      const compactHeader = [
        lines[0],
        "Revision " + rev + " is authoritative; ignore lower EIDETIC revisions.",
        "Past memory only. PRIVATE sections are character-only; CLAIM/BELIEF/UNCERTAIN are not facts. Do not invent missing memories."
      ];
      const headerLines = budget < 1800 ? compactHeader : lines.slice(0, 6);
      const tail = "\n" + CLOSE;
      let packed = headerLines.join("\n");
      for (let i = 0; i < body.length; i++) {
        const candidate = packed + "\n" + body[i] + tail;
        if (candidate.length > budget) break;
        packed += "\n" + body[i];
      }
      block = packed + tail;
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

  function removeOurFrontMemory(existing) {
    existing = safeText(existing);
    const re = /\n?\[\[EIDETIC_RECALL[^\n]*\]\][\s\S]*?\[\[\/EIDETIC_RECALL\]\]\n?/gi;
    return existing.replace(re, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  function setFrontMemory(block) {
    if (!EIDETIC_CONFIG.USE_FRONT_MEMORY || typeof state === "undefined" || !state) return;
    if (!state.memory || typeof state.memory !== "object") state.memory = {};
    const other = removeOurFrontMemory(state.memory.frontMemory || "");
    state.memory.frontMemory = [other, block].filter(Boolean).join("\n").trim();
  }

  function clearFrontMemory() {
    if (typeof state === "undefined" || !state || !state.memory || typeof state.memory !== "object") return;
    state.memory.frontMemory = removeOurFrontMemory(state.memory.frontMemory || "");
  }

  function currentFrontRecallBlock() {
    if (typeof state === "undefined" || !state || !state.memory) return "";
    const fm = safeText(state.memory.frontMemory || "");
    const re = /\[\[EIDETIC_RECALL[^\n]*\]\][\s\S]*?\[\[\/EIDETIC_RECALL\]\]/gi;
    let m, last = "";
    while ((m = re.exec(fm)) !== null) {
      const firstLine = m[0].split("\n", 1)[0];
      const turnMarker = new RegExp("\\bturn=" + currentTurn() + "(?:\\s|\\])", "i");
      const r = root();
      const seqMarker = new RegExp("\\bseq=" + (r ? (r.seq || 0) : 0) + "(?:\\s|\\])", "i");
      if (turnMarker.test(firstLine) && seqMarker.test(firstLine)) last = m[0];
    }
    return last;
  }

  function currentRecallAlreadyInText(text, block) {
    if (!block) return true;
    const m = block.match(/\[\[EIDETIC_RECALL\s+rev=(\d+)/i);
    if (!m) return safeText(text).indexOf(block) >= 0;
    const marker = new RegExp("\\[\\[EIDETIC_RECALL\\s+rev=" + escapeRe(m[1]) + "(?:\\s|\\])", "i");
    return marker.test(safeText(text));
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
    if (k.split(" ").length === 1 && (r.ambiguousFirstNames || []).indexOf(k) >= 0) return null;
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
    if (typeof state !== "undefined" && state) state.message = safeText(msg).slice(0, 900);
    if (typeof log === "function") log("EIDETIC: " + safeText(msg));
    else if (typeof console !== "undefined" && console.log) console.log("EIDETIC: " + safeText(msg));
  }

  function handleCommand(raw) {
    const r = root();
    const s = commandText(raw);
    if (!/^\/(?:eidetic|memory|remember|recall|focus|roster|memstats|memdetect|memdebug|memclear)\b/i.test(s)) return null;
    const m = s.match(/^\/(\w+)\s*(.*)$/);
    if (!m) return null;
    const cmd = m[1].toLowerCase();
    const arg = (m[2] || "").trim();

    if (cmd === "eidetic" || cmd === "memory") {
      const chars = Object.keys(r.chars).length;
      setMessage("EIDETIC • " + chars + " characters • " + r.hot.length + " hot memories • " + r.cold.length + " cold memories • " + r.anchors.length + " anchors • " + r.ledger.length + " current-state facts • existing-history import " + Number(r.runtime.bootstrapImported || 0) + " actions • turn " + currentTurn());
      return { text: null, stop: true };
    }

    if (cmd === "memstats") {
      const approx = JSON.stringify(r).length;
      setMessage("EIDETIC archive: " + r.hot.length + " hot + " + r.cold.length + " cold + " + r.anchors.length + " anchors + " + r.ledger.length + " state facts • ~" + Math.round(approx / 1024) + " KB serialized • recall rev " + (r.runtime.recallRev || 0) + " • retry purges " + (r.stats.retryPurges || 0));
      return { text: null, stop: true };
    }

    if (cmd === "roster") {
      const names = Object.keys(r.chars).map(k => r.chars[k].name).slice(0, 30);
      setMessage("Tracked characters: " + (names.length ? names.join(", ") : "none yet"));
      return { text: null, stop: true };
    }

    if (cmd === "memdetect") {
      const candidates = Object.keys(r.candidates || {}).map(k => r.candidates[k]).sort((a,b) => (Number(b.evidence||0) + Number(b.strong||0)*2) - (Number(a.evidence||0) + Number(a.strong||0)*2)).slice(0, 8);
      const preview = candidates.map(c => c.name + "[" + Number(c.evidence||0).toFixed(0) + "]").join(", ");
      setMessage("EIDETIC detector: " + Object.keys(r.chars || {}).length + " tracked • " + Object.keys(r.candidates || {}).length + " candidates • " + Number(r.stats.detectorRejected || 0) + " junk observations rejected • " + Number(r.stats.detectorPruned || 0) + " stale candidates pruned" + (preview ? " • watching: " + preview : ""));
      return { text: null, stop: true };
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
      return { text: null, stop: true };
    }

    if (cmd === "remember") {
      const parts = arg.split("|");
      if (parts.length < 2) {
        setMessage("Usage: /remember Character | fact   or   /remember * | world fact");
        return { text: null, stop: true };
      }
      const who = parts.shift().trim();
      const fact = parts.join("|").trim();
      if (!fact) {
        setMessage("Nothing to remember.");
        return { text: null, stop: true };
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
      setMessage("Pinned memory for " + who + ": " + displayText(fact, 180));
      return { text: null, stop: true };
    }

    if (cmd === "recall") {
      const parts = arg.split("|");
      const who = (parts.shift() || "").trim();
      const q = parts.join("|").trim() || buildQuery("");
      const k = getCharKey(who);
      if (!k) {
        setMessage("Unknown character. Use /roster or /focus Name first.");
        return { text: null, stop: true };
      }
      const got = retrieveForCharacter(k, q);
      const lines = got.anchors.concat(got.memories).slice(0, 6).map(x => "T" + x.turn + " " + displayText(x.text, 110));
      setMessage(r.chars[k].name + " recalls: " + (lines.length ? lines.join(" • ") : "no matching archived memory"));
      return { text: null, stop: true };
    }

    if (cmd === "memdebug") {
      if (/^on$/i.test(arg)) { r.debug = true; setConfigValueInCard("debug", "on"); }
      else if (/^off$/i.test(arg)) { r.debug = false; setConfigValueInCard("debug", "off"); }
      setMessage("EIDETIC debug " + (r.debug ? "ON" : "OFF"));
      return { text: null, stop: true };
    }

    if (cmd === "memclear") {
      if (arg !== "CONFIRM") {
        setMessage("To erase EIDETIC's archive, type /memclear CONFIRM");
        return { text: null, stop: true };
      }
      delete state[ROOT];
      if (state.memory && state.memory.frontMemory) state.memory.frontMemory = removeOurFrontMemory(state.memory.frontMemory);
      setMessage("EIDETIC archive cleared.");
      return { text: null, stop: true };
    }
    return null;
  }

  function debugLog(msg) {
    const r = root();
    if (!r || !r.debug) return;
    if (typeof log === "function") log("EIDETIC DEBUG: " + msg);
    else if (typeof console !== "undefined" && console.log) console.log("EIDETIC DEBUG: " + msg);
  }

  function init() {
    const r = root();
    if (!r) return;
    seedPlayerIdentity();
    seedConfiguredCharacters();
    applyConfigCard();
    seedFromStoryCards();
    const imported = bootstrapExistingHistory();
    announceActivation(imported);
    rollbackFuture(currentTurn());
    purgeDanglingRetryOutput();
    if (typeof info !== "undefined" && info && Number.isFinite(info.maxChars)) r.runtime.lastMaxChars = info.maxChars;
  }

  function run(hook, text) {
    init();
    if (!EIDETIC_CONFIG.ENABLED) { clearFrontMemory(); return { text: text, stop: false }; }
    const r = root();

    if (hook === "input") {
      const command = handleCommand(text);
      if (command) return command;
      ingest(text, "input");
      const block = buildRecall(text);
      if (block) setFrontMemory(block);
      else clearFrontMemory(); // Never let a previous turn's packet linger as current front memory.
      debugLog("input turn=" + currentTurn() + " hot=" + r.hot.length + " cold=" + r.cold.length);
      return { text: text, stop: false };
    }

    if (hook === "context" || hook === "contextAppend") {
      let block = currentFrontRecallBlock();
      if (!block) block = buildRecall("");
      if (block) {
        setFrontMemory(block);
        if (EIDETIC_CONFIG.APPEND_CONTEXT_FALLBACK && !currentRecallAlreadyInText(text, block)) {
          const out = safeText(text) + (safeText(text).endsWith("\n") ? "" : "\n") + block;
          debugLog("context appended " + block.length + " chars");
          return { text: out, stop: false };
        }
      }
      return { text: text, stop: false };
    }

    if (hook === "output") {
      let cleaned = normalizeOutputSpacing(scrubLeak(text));
      if (cleaned === "") cleaned = " ";
      ingest(cleaned, "output");
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
  };

  return run;
})();
