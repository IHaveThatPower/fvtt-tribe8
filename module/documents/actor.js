export class Tribe8Actor extends Actor {
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