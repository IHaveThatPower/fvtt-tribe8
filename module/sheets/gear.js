import { Tribe8ItemSheet } from './item.js';

export class Tribe8GearSheet extends Tribe8ItemSheet {
	static DEFAULT_OPTIONS = {
		window: { contentClasses: ["tribe8", "gear", "sheet", "item"] },
		position: { width: 360 }
	}

	static PARTS = {
		form: { template: 'systems/tribe8/templates/sheets/items/gear.html' }
	}

	/**
	 * Prepend 'Aspect' to the sheet title, and include the tribe, if
	 * specified
	 *
	 * @return {string} The assembled sheet title
	 * @access public
	 */
	get title() {
		if (this.document.parent)
			return game.i18n.format("tribe8.item.gear.title.owned", {ownerName: this.document.parent.name, itemName: this.document.name});
		return game.i18n.format("tribe8.item.gear.title.unowned", {itemName: this.document.name});
	}
}