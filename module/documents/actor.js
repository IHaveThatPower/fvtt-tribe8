export class Tribe8Actor extends Actor {
	/**
	 * Utility function to determine which player (if any) owns this 
	 * actor.
	 */
	getPlayerOwner() {
		if (!this.hasPlayerOwner)
			return false;
		
		const possibleOwners = Object.entries(this.ownership) // Get all ownership entries
								.filter(([id, level]) => (level == foundry.CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER && id != 'default')) // Get only true, non-default owners
								.map(([id, level]) => id) // Drop the level, now that we're dealing only with owners
								.sort((a, b) => { // We assume the "older" owner is the primary one
									const aUser = game.users.get(a);
									const bUser = game.users.get(b);
									if (aUser?._stats?.createdTime < bUser?._stats?.createdTime)
										return -1;
									if (aUser?._stats?.createdTime > bUser?._stats?.createdTime)
										return 1;
									return 0;
								});
		// If we don't have any owners after all that
		if (!possibleOwners.length)
			return false;
		
		// Return the top-sorted owner found
		return game.users.get(possibleOwners[0]);
	}

	/**
	 * Add an item to the character, with validation
	 */
	async addItem(uuid) {
		const item = await foundry.utils.fromUuid(uuid);
		if (!item) {
			foundry.ui.notifications.error(`Tried to add an unknown item`);
			return;
		}
		switch (item.type) {
			case 'skill':
			case 'perk':
			case 'flaw':
				this.createEmbeddedDocuments('Item', [item]);
				break;
			default:
				foundry.ui.notifications.warn(`Adding ${item.type}s to actors is not (yet) supported`);
				break;
		}
	}
}