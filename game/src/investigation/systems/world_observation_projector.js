import { createObservableWorldProfile } from '../domain/world_discovery.js';

/** Inactive, owner-facing projection contract. Only the explicitly observable
 * section is consumed. Board cells, unresolved sockets and enemy/Trial truth are
 * never interpreted as discoveries. A future world owner must supply this section
 * from existing world objects under its own observation policy.
 */
export class WorldObservationProjector {
    project(ownerSnapshot = null) {
        const observations = ownerSnapshot?.observable?.observations;
        if (observations === undefined) return createObservableWorldProfile();
        return createObservableWorldProfile({ observations });
    }
}
