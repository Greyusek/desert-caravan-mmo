# Stage 4.5 — Player-facing UI Vertical Slice decomposition

Status: accepted implementation plan after Checkpoint 71 / COMBAT-001  
Canonical UX source: [`PRESENTATION_BIBLE.md`](PRESENTATION_BIBLE.md)

## Goal

Build the first coherent desktop browser client through which a player who does
not know the simulation internals can complete the existing core loop:

`city → prepare → route → travel → encounter → tactical battle → result →
continue → destination city → trade or information operation`.

The stage is a presentation and interaction vertical slice. It does not add
Multiplayer, accounts, network synchronization, a production database, a broad
RPG inventory, full Magic/System 256, final art or a new simulation model.

## Architecture boundary

The mandatory data flow is:

`authoritative simulation → player-facing projection → Player UI`.

### Authoritative simulation

- Owns world coordinates, hidden objects, encounter geometry, time, resources,
  economy, tactical legality, damage, cargo and persistent consequences.
- Accepts explicit actions through validated functions and returns a new state.
- Remains deterministic and UI-independent.

### Player-facing projection

- Is an allow-listed, serializable view derived from authoritative state.
- Contains only facts known to the current player and opaque action references
  needed to request permitted operations.
- Never exposes exact hidden coordinates, world seed, patrol routes, internal
  battle IDs, unseen entities or formula breakdowns.
- Does not calculate prices, movement, discovery, combat or cargo outcomes.

### Player UI

- Renders the projection and submits declared actions.
- May format values, manage selection, disclosure and local visual preferences.
- May not infer authoritative outcomes or enable actions absent from the current
  action projection.

### Developer / Debug UI

- The existing debug map remains a separate application and may retain seed,
  exact coordinates, hidden entities, internal IDs, formula breakdowns and DEV
  controls.
- Player UI styles and navigation are not implemented by continuously extending
  the existing debug page.

## Minimal screens

| Screen | Always understandable | Progressive detail / actions |
| --- | --- | --- |
| Global Map / Caravan Command | known map, caravan, destination, movement state, water, food, cargo, members, speed and ETA | map layers, route building, start/cancel where supported, event response, collapsible journal |
| City | current city and available real institutions | market, library/information and caravan preparation |
| Caravan Preparation / Formation | participants, combat roles, supplies, goods, used/free capacity | load/unload through existing operations and place units/baggage only through validated formation actions |
| Battle | readable 2D field, sides, turn, selected unit, HP, baggage and status | legal move cells, attack targets, authoritative command, minimal auto/manual control supported by the core |
| Battle Result | victory/defeat/retreat, survivors, losses and cargo outcome | continue/stop route action and return to Global Map |

## Checkpoint sequence

Every item below receives its own branch, versioned checkpoint, automated tests,
ready PR and green CI before the next item starts.

### PLAYER-PROJECTION-001 — safe session contract

- Add one deterministic player-session composition around existing world,
  trading and COMBAT-001 systems.
- Define allow-listed screen state, player event entries and permitted actions.
- Keep authoritative state private to the composition boundary.
- Prove identical seed/actions reproduce the same player projection.
- Reject forbidden server-truth fields through structural and serialized tests.

Exit: a UI can render the seeded loop without receiving exact coordinates,
hidden entities, seed, internal battle identities or formula breakdowns.

### PLAYER-SHELL-001 — separate application and visual language

- Add a dependency-light `player-ui` application and local launch command.
- Keep the existing debug map separately launchable and visually identifiable.
- Establish CSS design tokens for typography, spacing, surfaces, controls,
  selection, disabled state, focus and critical warnings.
- Add top-level screen navigation driven only by projected session state.

Exit: the player client opens independently at desktop size, contains no DEV
controls/server truth and clearly distinguishes available and unavailable
screens.

### PLAYER-GLOBAL-001 — map, command panel and journal

- Render only player-known north-up geography and travelled/known routes.
- Add layer toggles for cities, known objects, routes, threats/rumors and events.
- Show compact caravan state, resources, cargo, members, speed, ETA and warnings.
- Add route/destination actions supported by the session contract.
- Add a compact collapsible player event journal distinct from debug logs.

Exit: a new player can understand current state, choose a known destination,
start the seeded journey and observe meaningful events without reading JSON.

### PLAYER-CITY-001 — city, market and information

- Add one functional city view over existing institutions only.
- Present market prices, owned quantity, capacity and transaction total without
  persistent scarcity/demand breakdowns.
- Present physical knowledge bundles, known provenance/confidence and local
  value without hidden coordinates.
- Route every buy/sell/deposit action through existing authoritative APIs.

Exit: the player completes one material or information transaction and sees the
updated wallet, cargo, market/library and journal state.

### PLAYER-PREP-001 — caravan preparation and formation

- Present members, combat roles, supplies, goods, used/free capacity and key
  caravan characteristics.
- Reuse existing cargo operations instead of adding a parallel inventory.
- Show the tactical deployment zone, combatants and physical baggage.
- Allow only formation changes supported and validated by the tactical core; if
  the core cannot express a move, the UI shows the current fixed formation and
  does not invent one.

Exit: the player understands what will travel and fight, and the accepted
formation is the exact input used by the later battle.

### PLAYER-BATTLE-001 — readable field and authoritative controls

- Render a real 2D field with cells, units, baggage, sides, HP and defeated
  state using the shared tactical state.
- Support unit selection and project legal movement cells/attack targets from
  core queries.
- Submit MOVE/ATTACK/WAIT through the tactical command API and rerender the
  returned projection.
- Provide a minimal auto/manual affordance only to the extent supported by one
  deterministic core policy; do not create a broad tactical AI subsystem.

Exit: the player can select a living caravan unit, execute at least one legal
command, cannot submit an illegal command from the UI and can complete the
seeded battle without browser combat formulas.

### PLAYER-RESULT-001 — consequences and global continuation

- Add a dedicated result state for winner/retreat, survivors, deaths and
  preserved, captured or destroyed physical cargo.
- Offer an explicit continue/stop decision where the authoritative scenario
  permits it.
- Return to Global Map with the same exactly-once world consequence and show
  the route continuing to the destination.

Exit: losses and cargo shown in the result remain identical on the map, in the
caravan panel and at the destination city; repeated UI rendering cannot apply
the battle again.

### PLAYER-VERTICAL-001 — final seeded playable loop

- Compose all completed screens into one stable seeded acceptance session.
- Cover preparation, a real transaction, route start, travel event, contact,
  manual tactical action, battle completion, result, continuation, city arrival
  and a destination operation.
- Add a one-command local acceptance runner and a concise manual test document.
- Verify player/debug separation and every prior checkpoint.

Exit: a person unfamiliar with `sim-core` can complete the complete loop from
the visible UI, understand every available decision and never needs debug data.

## Automated acceptance contract

Each applicable checkpoint must cover:

- deterministic player projection for identical seed and actions;
- forbidden server-truth absence, including deep serialized payload checks;
- hidden entities absent until actually known;
- actions resolved through authoritative APIs, including rejection paths;
- UI modules containing no duplicated market, route, discovery, combat, damage
  or cargo formulas;
- debug and player applications remaining separate;
- global → battle → result → global identity and consequence continuity;
- earlier `594/594` regressions remaining green.

## Manual acceptance contract

The final stable seed must let a tester:

1. open the Player UI and understand the current caravan;
2. toggle map layers and open/close the event journal;
3. enter the city, inspect market/library and prepare cargo/supplies;
4. select a destination, build/start the supported route and observe movement;
5. receive a contact and enter the tactical scene;
6. select a fighter and execute at least one legal action;
7. finish the battle and understand survivor/cargo consequences;
8. continue to the destination city;
9. perform one real material or information operation;
10. confirm that Debug UI remains separately available with DEV-only data.

## Stage 4.5 exit criteria

Stage 4.5 closes only after `PLAYER-VERTICAL-001` passes local verification and
GitHub CI, the stable manual scenario is accepted, and all five screens operate
through the shared player projection/action boundary. Stage 5 remains gated and
requires a separate explicit command.
