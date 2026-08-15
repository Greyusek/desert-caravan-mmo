# Checkpoint 06 — WORLD-003 / SIM-007: route-aware static discovery

Version: `0.0.6`

## Goal

Detect a hidden static object only when the caravan's real spherical route enters its concealed-discovery radius, and report the first discovery moment without sampling route positions.

## Implemented

- public `discoverStaticObjectsAlongRoute(...)` simulation API;
- default concealed-object radius of 150 m with a validated custom radius;
- exact first radius entry on every great-circle route segment;
- discovery segment, cumulative route distance, ETA, caravan coordinate, and current separation from the object;
- stable output ordered by travel time rather than world-object storage order;
- correct handling of route starts, segment endpoints, tangent contact, missed radii, and antimeridian crossing;
- unchanged `WORLD-001` cities and `WORLD-002` static objects for every seed.

The returned event is authoritative server-side data and still contains the hidden object coordinate. It is not a player-facing map DTO. A future interaction check may use the separate 500 m interaction radius, but that larger radius does not reveal a concealed object: discovery at 150 m is the knowledge gate, after which the object is already within interaction range.

## Automated verification

Ten WORLD-003 tests cover direct first entry, the 150 m default, starting inside the radius, a near miss, tangent contact, rejection of the infinite route outside segment endpoints, cumulative multi-segment distance/ETA, antimeridian continuity, travel-order sorting, zero radius, and invalid-radius validation. The complete suite contains 58 tests.

## Next checkpoint

`WORLD-004` — add a deterministic wandering monster with a cyclic route so a later time-aware encounter check can compare two moving entities.
