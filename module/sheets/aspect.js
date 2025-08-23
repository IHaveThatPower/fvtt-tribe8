import { Tribe8ItemSheet } from './item.js';

export class Tribe8AspectSheet extends Tribe8ItemSheet {
	static DEFAULT_OPTIONS = {
		window: { contentClasses: ["tribe8", "aspect", "sheet", "item"] },
		position: { width: 360 }
	}

	static PARTS = {
		form: { template: 'systems/tribe8/templates/sheets/items/aspect.html' }
	}

	/**
	 * Prepend 'Aspect' to the sheet title, and include the tribe, if
	 * specified
	 *
	 * @return {string} The assembled sheet title
	 * @access public
	 */
	get title() {
		let localizationKey = 'aspect.title';
		localizationKey += (this.document.system.ritual ? '.ritual' : '.synthesis');
		localizationKey += (this.document.system.tribe ? '-tribe' : '');
		return game.i18n.format(`tribe8.item.${localizationKey}`, {aspect: this.document.name, tribe: this.document.system?.tribe});
	}
}