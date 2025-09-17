import { Tribe8 } from '../config.js';
import { Tribe8GearSheet } from './gear.js';

export class Tribe8WeaponSheet extends Tribe8GearSheet {
	static DEFAULT_OPTIONS = {
		window: { contentClasses: ["tribe8", "gear", "sheet", "item", "weapon"] },
		actions: {
			toggleRange: Tribe8WeaponSheet.action_toggleRange
		}
	}

	static PARTS = {
		form: { template: 'systems/tribe8/templates/sheets/items/weapon.hbs' }
	}

	/**
	 * Prepend the owner to the sheet title, if the Weapon is owned.
	 *
	 * @return {string} The assembled sheet title
	 * @access public
	 */
	get title() {
		let key = 'title';
		key += (this.document.parent ? '.owned' : '.unowned');
		// NOTE: Shares title format with Gear
		return game.i18n.format(`tribe8.item.gear.${key}`, {item: this.document.name, owner: this.document.parent?.name});
	}

	/**
	 * Prepare the context to inform what the Weapon sheet renders.
	 *
	 * @param  {object} options    The set of options provided for rendering the sheet
	 * @return {object}            The computed context object for Handlebars to use in populating the sheet
	 * @access protected
	 */
	async _prepareContext(options) {
		const context = await super._prepareContext(options);

		// If we have multiple accuracy, parry, or damage values, we
		// need to reframe them for display. This means parallel storage
		// directly on the context object.
		if (!Object.hasOwn(context, 'system'))
			context.system = {};
		context.system.accuracy = this.document.system.accuracy;
		if (this.document.system.accuracy instanceof Array && this.document.system.accuracy.length > 1) {
			context.system.accuracy = this.document.system.accuracy.join('/');
		}
		context.system.parry = this.document.system.parry;
		if (this.document.system.parry instanceof Array && this.document.system.parry.length > 1) {
			context.system.parry = this.document.system.parry.join('/');
		}
		context.system.damage = this.document.system.damage;
		if (this.document.system.damage instanceof Array && this.document.system.damage.length > 1) {
			// For damage, we need to be a little fancier, since we want
			// to combine the damage prefix
			let prefix = this.document.system.constructor.extractWeaponDamagePrefix(this.document.system.damage[0]);
			context.system.damage = this.#applyWeaponDamagePrefix(this.document.system.damage, prefix, true).join('/');
		}

		// If we have ROF data, we need to combine that into a single
		// value for sheet rendering.
		if (context.document?.system && Object.hasOwn(context.document.system, 'rof')) {
			if (!context.document.system.rofRounds || context.document.system.rofRounds == 0)
				context.system.rof = `${context.document.system.rof ?? 0}`;
			else
				context.system.rof = `${context.document.system.rof ?? 0}/${context.document.system.rofRounds ?? 0}`;
		}

		// If this item is owned, get a list of all the other items that
		// the owner has, which might be listed as eligible storage for
		// this one.
		if (this.document.parent) {
			context.otherGear = this.document.parent.getGear().filter(g => g.id != this.id);
			context.otherGear.sort(context.otherGear[0].constructor.cmp);
		}

		// The form needs to know the possible options for several fields
		context.valueOptions = Object.fromEntries(Tribe8.gearValueOptions.map((o) => [o, `tribe8.item.gear.value.strings.${o}.full`]));
		context.weaponCategories = Object.fromEntries(Object.keys(Tribe8.weaponCategories).map((o) => [o, `tribe8.item.weapon.category.${o}.full`]));
		if (this.document.system.category) {
			context.weaponSubcategories = Object.fromEntries(Tribe8.weaponCategories[this.document.system.category].map((o) => [o, `tribe8.item.weapon.category.${this.document.system.category}.${o}.full`]));
		}
		context.weaponRanges = Object.fromEntries(Tribe8.weaponRanges.map((o) => [o, `tribe8.item.weapon.ranges.${o}.full`]));
		context.ranges = Object.fromEntries(this.document.system.ranges.map((r) => [r, true]));
		context.fumbleRisk = Object.fromEntries(Tribe8.fumble.map((f) => [f, `tribe8.item.weapon.fumble.${f}`]));
		return context;
	}

	/**
	 * Handle the submit data. In particular, parse out the single ROF
	 * field into the rate and the rounds.
	 *
	 * @param  {Event}            event              The triggering event
	 * @param  {HTMLFormElement}  form               The top-level form element
	 * @param  {FormDataExtended} formData           The actual data payload
	 * @param  {object}           [updateData={}]    Any supplemental data
	 * @return {object}                              Prepared submission data as an object
	 * @access protected
	 */
	_prepareSubmitData(event, form, formData, updateData) {
		const oFormData = formData.object;
		if (Object.hasOwn(oFormData, "system.rof")) {
			const [rof, rounds] = oFormData["system.rof"].split('/');
			oFormData["system.rof"] = rof ?? 0;
			oFormData["system.rofRounds"] = rounds ?? 0;
		}

		// If we have multiple accuracy, parry, or damage values, we
		// need to reframe them for storage
		if (Object.hasOwn(oFormData, "system.accuracy")) {
			oFormData["system.accuracy"] = oFormData["system.accuracy"].split('/');
		}
		if (Object.hasOwn(oFormData, "system.parry")) {
			oFormData["system.parry"] = oFormData["system.parry"].split('/');
		}
		if (Object.hasOwn(oFormData, "system.damage")) {
			let submitDamage = oFormData["system.damage"].split('/');
			let prefix = this.document.system.constructor.extractWeaponDamagePrefix(submitDamage[0]);
			oFormData["system.damage"] = this.#applyWeaponDamagePrefix(submitDamage, prefix);
		}

		return super._prepareSubmitData(event, form, formData, updateData);
	}

	/**
	 * Apply a supplied common damage prefix to all damage array elements
	 *
	 * @param  {Array<string>} weaponDamageList    The list of weapon damage strings
	 * @param  {string}        prefix              The prefix to apply to the list
	 * @param  {boolean}       [remove=false]      Whether we should invert the behavior and remove strings instead
	 * @return {Array<string>}                     The transformed list
	 * @access private
	 */
	#applyWeaponDamagePrefix(weaponDamageList, prefix, remove=false) {
		if (!prefix || prefix.length == 0)
			return weaponDamageList
		return weaponDamageList.map((d, idx) => (idx > 0 ? (remove ? d.replace(prefix, '') : `${prefix}${d}`) : d));
	}

	/**
	 * Toggle a range type on or off. May affect other ranges.
	 *
	 * @param {Event}           event     The event triggered by interaction with the form element
	 * @param {HTMLFormElement} target    The element that triggered the event
	 * @access public
	 */
	static action_toggleRange(event, target) {
		event.stopPropagation();
		event.preventDefault();

		// What range's button did we press?
		const rangeSelected = target.name.split(/[[.\]]/).filter(s => s).pop();

		// What are our current states?
		const currentRanges = this.document.system.ranges;
		let newRanges = [...currentRanges];;

		// Was this range already selected? If so, toggle it off.
		if (newRanges.includes(rangeSelected)) {
			newRanges.splice(newRanges.indexOf(rangeSelected), 1);
		}
		else {
			newRanges.push(rangeSelected);
		}
		this.document.update({'system.==ranges': newRanges}, {diff: false}).then(() => {
			this.render();
		});
	}
}
