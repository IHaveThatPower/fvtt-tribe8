import { Tribe8ItemSheet } from './item.js';

export class Tribe8GearSheet extends Tribe8ItemSheet {
	static DEFAULT_OPTIONS = {
		window: { contentClasses: ["tribe8", "gear", "sheet", "item"] },
		position: { width: 360 }
	}

	static PARTS = {
		form: { template: 'systems/tribe8/templates/sheets/items/gear.hbs' }
	}

	/**
	 * Prepend the owner to the sheet title, if the Gear is owned.
	 *
	 * @return {string} The assembled sheet title
	 * @access public
	 */
	get title() {
		let key = 'title';
		key += (this.document.parent ? '.owned' : '.unowned');
		return game.i18n.format(`tribe8.item.gear.${key}`, {item: this.document.name, owner: this.document.parent?.name});
	}

	/**
	 * Prepare the context to inform what the Gear sheet renders.
	 *
	 * @param  {object} options    The set of options provided for rendering the sheet
	 * @return {object}            The computed context object for Handlebars to use in populating the sheet
	 * @access protected
	 */
	async _prepareContext(options) {
		const context = await super._prepareContext(options);

		// If this item is owned, get a list of all the other items that
		// the owner has, which might be listed as eligible storage for
		// this one.
		if (this.document.parent) {
			context.otherGear = this.document.parent.getGear().filter(g => g.id != this.id);
			context.otherGear.sort(context.otherGear[0].constructor.cmp);
		}

		// The form needs to know the possible options for values
		context.valueOptions = Object.fromEntries(CONFIG.Tribe8.gearValueOptions.map((o) => [o, `tribe8.item.gear.value.strings.${o}.full`]));
		return context;
	}
}