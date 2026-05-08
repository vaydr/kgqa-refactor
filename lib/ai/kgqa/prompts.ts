export const ALLOWABLE_RELATIONSHIPS: string[] = [
  "be",
  "is",
  "am",
  "are",
  "was",
  "were",
  "been",
  "become",
  "became",
  "seem",
  "seemed",
  "appear",
  "appeared",
  "remain",
  "remained",
  "stay",
  "stayed",
  "look",
  "looked",
  "feel",
  "felt",
  "sound",
  "sounded",
  "taste",
  "tasted",
  "smell",
  "smelled",
  "grow",
  "grew",
  "turn",
  "turned",
  "prove",
  "proved",
  "have",
  "had",
  "do",
  "did",
  "say",
  "said",
  "get",
  "got",
  "make",
  "made",
  "go",
  "went",
  "know",
  "knew",
  "take",
  "took",
  "see",
  "saw",
  "come",
  "came",
  "think",
  "thought",
  "look",
  "looked",
  "want",
  "wanted",
  "give",
  "gave",
  "use",
  "used",
  "find",
  "found",
  "tell",
  "told",
  "ask",
  "asked",
  "work",
  "worked",
  "seem",
  "seemed",
  "feel",
  "felt",
  "try",
  "tried",
  "leave",
  "left",
  "call",
  "called",
  "put",
  "put",
  "keep",
  "kept",
  "let",
  "let",
  "begin",
  "began",
  "show",
  "showed",
  "hear",
  "heard",
  "play",
  "played",
  "run",
  "ran",
  "move",
  "moved",
  "moves",
  "live",
  "lived",
  "believe",
  "believed",
  "bring",
  "brought",
  "write",
  "wrote",
  "provide",
  "provided",
  "sit",
  "sat",
  "stand",
  "stood",
  "lose",
  "lost",
  "pay",
  "paid",
  "meet",
  "met",
  "include",
  "included",
  "continue",
  "continued",
  "set",
  "set",
  "learn",
  "learned",
  "change",
  "changed",
  "lead",
  "led",
  "start",
  "started",
  "understand",
  "understood",
  "watch",
  "watched",
  "follow",
  "followed",
  "stop",
  "stopped",
  "create",
  "created",
  "speak",
  "spoke",
  "read",
  "read",
  "allow",
  "allowed",
  "add",
  "added",
  "spend",
  "spent",
  "grow",
  "grew",
  "open",
  "opened",
  "walk",
  "walked",
  "win",
  "won",
  "offer",
  "offered",
  "remember",
  "remembered",
  "love",
  "loved",
  "consider",
  "considered",
  "appear",
  "appeared",
  "buy",
  "bought",
  "wait",
  "waited",
  "serve",
  "served",
  "die",
  "died",
  "send",
  "sent",
  "expect",
  "expected",
  "build",
  "built",
  "stay",
  "stayed",
  "fall",
  "fell",
  "cut",
  "cut",
  "reach",
  "reached",
  "kill",
  "killed",
  "remain",
  "remained",
  "is_in",
  "was_in",
  "own",
  "owns",
  "owned",
  "rule",
  "rules",
  "ruled",
  "form",
  "forms",
  "formed",
  "coined_by",
  "pass",
  "passed",
  "murder",
  "murdered",
  "remove",
  "removed",
  "discover",
  "discovered",
  "invent",
  "invented",
  "found",
  "founded",
  "contain",
  "contains",
  "contained",
  "produce",
  "produced",
  "cause",
  "caused",
  "require",
  "required",
  "connect",
  "connected",
  "border",
  "borders",
  "bordered",
  "inhabit",
  "inhabited",
  "compose",
  "composed",
  "govern",
  "governed",
  "defeat",
  "defeated",
  "inspire",
  "inspired",
  "influence",
  "influenced",
  "publish",
  "published",
  "teach",
  "taught",
  "study",
  "studied",
  "represent",
  "represented",
  "support",
  "supported",
  "define",
  "defined",
  "defines",
  "destroy",
  "destroyed",
  "establish",
  "established",
  "develop",
  "developed",
  "belong",
  "belongs",
  "belonged",
  "precede",
  "preceded",
  "succeed",
  "succeeded",
  "surround",
  "surrounded",
  "involve",
  "involved",
];

const relationshipList = ALLOWABLE_RELATIONSHIPS.filter(
  (v, i, a) => a.indexOf(v) === i
).join(", ");

export const generateClausesPrompt = `You are a Knowledge Graph reasoning expert. Given a user question, build a CONNECTED chain of triples that traces a logical path from the question's subject to the answer.

Each clause is a triple: (node1, relationship, node2)
- node1 and node2: MUST be proper nouns or named concepts. Every node is a specific, real thing with a name.
  Use this heuristic: every node should reasonably look like a Wikipedia article title.
  GOOD nodes: "Isaac Newton", "Paris", "DNA", "Mitochondria", "World War II", "Photosynthesis", "The Great Gatsby"
  BAD nodes: "the man who discovered gravity", "capital of France", "brother of X", "improve X", "increase oxygen", "analyze data"
  Never use an imperative, an action phrase, or a verb + noun phrase as a node.
  If you need to express a concept, use its actual name — not a description or a phrase containing another node.
- relationship: MUST be one of these verbs: ${relationshipList}

CRITICAL RULES:
1. The path MUST be connected: each clause's node1 or node2 must share an entity with at least one other clause. No isolated triples.
2. The FIRST clause should start from the main entity in the question.
3. The LAST clause should arrive at or contain the answer.
4. Each clause should represent a real, verifiable fact.
5. Use 2-5 clauses. Every clause must advance toward the answer — no filler.
6. Think about what the ANSWER actually is, then build the path backward from there.

Example:
Question: "Who is the brother of the man who discovered gravity?"
Think: The answer is "Humphrey Newton". Path: Isaac Newton → Gravity → Humphrey Newton.
Clauses:
1. (Isaac Newton, found, Gravity)
2. (Humphrey Newton, was, Isaac Newton)

Example:
Question: "What is the capital of the country where the Eiffel Tower is located?"
Think: The answer is "Paris". Path: Eiffel Tower → France → Paris.
Clauses:
1. (Eiffel Tower, be, France)
2. (Paris, be, France)`;

export const generateGraphPrompt = `You are a Knowledge Graph expansion expert. Given a question and its reasoning clauses, expand them into a connected knowledge graph of exactly 25 triples.

RELATIONSHIP CONSTRAINT: Every relationship MUST be one of these verbs: ${relationshipList}
Do NOT invent other relationships. Pick the closest verb from this list.

NODE CONSTRAINT: Every node MUST be a proper noun or named concept — a specific real thing with a name.
Use this heuristic: every node should reasonably look like a Wikipedia article title.
GOOD: "Isaac Newton", "MIT", "Chlorophyll", "Jupiter", "The Renaissance"
BAD: "the discoverer", "a university", "green pigment", "largest planet", "historical period", "improve X", "optimize process", "build model"
Never use an imperative, an action phrase, or a verb + noun phrase as a node.

Requirements:
1. The original clauses MUST appear in the output with scores 0.95-1.0
2. Expand by adding real facts about the same entities and their neighbors
3. Try to keep the graph connected — reuse existing nodes when possible
4. Assign confidence scores (0-1) based on relevance:
   - 0.9-1.0: Directly on the answer path (original clauses)
   - 0.6-0.9: About the same entities
   - 0.3-0.6: Related context
   - 0.1-0.3: Tangential but connected facts
5. All facts must be real and verifiable`;

export const bridgeEdgesPrompt = `You are a Knowledge Graph expert. You are given groups of entities that are currently disconnected in a knowledge graph. Generate bridging triples to connect them.

RELATIONSHIP CONSTRAINT: Every relationship MUST be one of these verbs: ${relationshipList}
NODE CONSTRAINT: Every node MUST be a proper noun or named concept — a specific real thing with a name. No descriptions or generic phrases.
Every node should reasonably look like a Wikipedia article title.
Never use an imperative, an action phrase, or a verb + noun phrase as a node.
BAD node examples: "improve X", "reduce cost", "analyze data", "the relevant enzyme".

For each pair of groups, generate exactly ONE triple where node1 comes from one group and node2 comes from the other. The triple must be a real, verifiable fact.

Output only the bridging triples, nothing else.`;

export const answerWithGraphPrompt = `You are a question-answering expert. Given a question and a knowledge graph context, provide a clear and accurate answer.

Use the knowledge graph triples to support your answer. Your response should demonstrate that the answer was derived by following the reasoning path through the graph.

Requirements:
1. Provide a direct, concise answer first
2. Explain your reasoning by referencing the logical path through the graph
3. The reasoning should read naturally, as if you inherently know this information (do not mention "the graph shows" or "according to the triples")
4. Be confident and authoritative in your explanation`;

export const classifierPrompt = `You are a classification assistant that determines if a user's question relates to their selected topics.

### TASK
Determine if the user's question can be reasonably answered using information about the USER SELECTION topics.

### CATEGORIES
- **Contained**: The question relates to, mentions, or can be answered using the selected topics. This includes:
  - Direct questions about the selected entities
  - Questions about relationships between selected entities
  - Questions where the selected topics provide relevant context

- **Uncontained**: The question is completely unrelated to the selected topics. This includes:
  - Questions about entirely different subjects
  - General knowledge questions with no connection to the selection
  - Questions where the selected topics would not help answer

### EXAMPLES
If USER SELECTION is: "Albert Einstein, Physics, Relativity"
- "What did Einstein discover?" → Contained (directly about selection)
- "How does relativity work?" → Contained (about selection topic)
- "What's the weather today?" → Uncontained (completely unrelated)
- "Who invented the telephone?" → Uncontained (different subject)

### OUTPUT
Return exactly one category: "Contained" or "Uncontained"`;

export const directAnswerPrompt = `You are a helpful assistant. Answer the user's question directly and concisely.

Requirements:
1. Provide a clear, direct answer
2. Include a brief explanation or reasoning
3. Be accurate and helpful
4. Keep the response concise but informative`;
