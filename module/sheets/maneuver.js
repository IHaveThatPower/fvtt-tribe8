import { Tribe8ItemSheet } from './item.js';

export class Tribe8ManeuverSheet extends Tribe8ItemSheet {
	static DEFAULT_OPTIONS = {
		window: { contentClasses: ["tribe8", "maneuver", "sheet", "item"] },
		position: { width: 360 }
	}

	static PARTS = {
		form: { template: 'systems/tribe8/templates/sheets/items/maneuver.hbs' }
	}

	static COMBAT_MODIFIER_FIELDS = ['accuracy', 'initiative', 'defense', 'parry', 'damage'];

	/**
	 * Title of the sheet, prefixed with "Maneuver" and the Skill to
	 * which it applies.
	 *
	 * @return {string} The assembled title
	 * @access public
	 */
	get title() {
		let localizationKey = 'maneuver.title';
		localizationKey += (this.document.system?.skill ? '-skill' : '');
		return game.i18n.format(
			`tribe8.item.${localizationKey}`,
			{
				maneuver: this.document.name,
				skill: this.document?.parent?.getEmbeddedDocument("Item", this.document.system.skill)?.name
			}
		);
	}

	/**
	 * Assemble data relevant to combat skills, in addition to other
	 * required rendering context.
	 *
	 * @param  {object} options    The set of options provided for rendering the sheet
	 * @return {object}            The computed context object for Handlebars to use in populating the sheet
	 * @access protected
	 */
	async _prepareContext(options) {
		const context = await super._prepareContext(options);
		const skills = (this.document.parent ? this.document.parent.getSkills({categories: ['combat']}) : {});

		// Given the allowed types, create a human-readable list of Skill choices
		context.skillChoices = {};
		if (context.document.system.allowedTypes && context.document.system.allowedTypes.length != 0) {
			for (let allowedType of context.document.system.allowedTypes) {
				if (skills[allowedType] && skills[allowedType].length) {
					for (let skill of skills[allowedType])
						context.skillChoices[skill.id] = skill.name;
				}
			}
		}
		context.allowedTypes = Object.fromEntries((context.document?.system?.allowedTypes || []).map((t) => [t, true]));
		if (Object.keys(context.skillChoices).length == 0) {
			context.skillChoices["N/A"] = "tribe8.item.maneuver.allowedTypes.na";
		}

		// Add a + prefix to any positive (or 0) values in the various
		// combat modifier fields.
		for (let field of this.constructor.COMBAT_MODIFIER_FIELDS) {
			if (context.document.system[field] === null || context.document.system[field] === "") {
				continue;
			}
			let asNumber = Number(context.document.system[field]);
			if (asNumber && asNumber >= 0) {
				context.document.system[field] = `+${asNumber}`;
			}
		}
		return context;
	}

	/**
	 * Handle the submit data
	 *
	 * @param  {Event}            event              The triggering event
	 * @param  {HTMLFormElement}  form               The top-level form element
	 * @param  {FormDataExtended} formData           The actual data payload
	 * @param  {object}           [updateData={}]    Any supplemental data
	 * @return {object}                              Prepared submission data as an object
	 * @access protected
	 */
	_prepareSubmitData(event, form, formData, updateData) {
		// TODO: This probably needs to be broken up at this point.
		// Identify array-based form elements
		const checkKeys = CONFIG.Tribe8.checkFormArrayElements(formData);

		// If N/A was selected, or the only option, drop it from internal storage
		if (formData.object['system.skill'] === "N/A" || formData.object['system.free']) {
			delete formData.object['system.skill'];
			formData.object['system.==skill'] = null;
		}

		// Extract identified array-based elements
		let allowedTypes = {}; // Object so we can use explicit keys
		for (const key of checkKeys) {
			const propertyPath = key.split(/[\][.]/).filter(p => p);
			if ((propertyPath[0] ?? "") == 'system' && (propertyPath[1] ?? "") == 'allowedTypes' && (propertyPath[2] ?? "").length == 1) {
				// Found a valid value, so store it and then delete it from the formData
				if (formData.object[key]) {
					allowedTypes[propertyPath[2]] = formData.object[key];
				}
				delete formData.object[key];
			}
		}
		allowedTypes = Object.keys(allowedTypes);
		if (allowedTypes.length) {
			formData.object['system.==allowedTypes'] = allowedTypes;
		}
		else {
			// Reset skill and allowedTypes if the chosen value is no longer valid
			formData.object['system.skill'] = null;
			formData.object['system.==allowedTypes'] = null;
		}

		// Handle blanks, N/As, and plus-prefixed numbers
		for (let field of this.constructor.COMBAT_MODIFIER_FIELDS.map((f) => `system.${f}`).concat(['system.category'])) {
			if (Object.hasOwn(formData.object, field)) {
				const submittedValue = (formData.object[field] ?? "").trim();
				// If the user submitted some variation of N/A or empty, null out the field
				if (submittedValue.toUpperCase() == "N/A" || submittedValue == "") {
					formData.object[field] = null;
					continue;
				}
				// If the user submitted a number with a + in front, strip it
				if (submittedValue[0] == "+") {
					formData.object[field] = Number(submittedValue) || parseInt(submittedValue) || submittedValue; // Fallback to leaving it alone
				}
			}
		}
		return super._prepareSubmitData(event, form, formData, updateData);
	}
}