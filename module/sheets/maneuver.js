import { Tribe8ItemSheet } from './item.js';

export class Tribe8ManeuverSheet extends Tribe8ItemSheet {
	static DEFAULT_OPTIONS = {
		window: {
			contentClasses: ["tribe8", "maneuver", "sheet", "item"]
		},
		position: {
			width: 360
		}
	}

	static PARTS = {
		form: {
			template: 'systems/tribe8/templates/maneuver-sheet.html'
		}
	}

	static COMBAT_MODIFIER_FIELDS = ['accuracy', 'initiative', 'defense', 'parry', 'damage'];

	/**
	 * Title of the sheet, prefixed with "Maneuver" and the Skill to
	 * which it applies.
	 *
	 * @return {string} The assembled title
	 */
	get title() {
		return `Maneuver: ${this.document.name}` + (this.document.system.forSkill ? ` (${CONFIG.Tribe8.COMBAT_SKILLS[this.document.system.forSkill]})` : '');
	}

	/**
	 * Assemble data relevant to combat skills, in addition to other
	 * required rendering context.
	 *
	 * @param  {object} options    The set of options provided for rendering the sheet
	 * @return {object}            The computed context object for Handlebars to use in populating the sheet
	 */
	async _prepareContext(options) {
		const context = await super._prepareContext(options);

		// Given the allowed types, create a human-readable list of skill choices
		context.allowedTypes = {};
		if (context.document.system.allowedTypes && Object.keys(context.document.system.allowedTypes).length != 0) {
			for (let skillShort of Object.keys(context.document.system.allowedTypes)) {
				switch (skillShort) {
					case 'C':
						context.allowedTypes[skillShort] = "Cavalry";
						break;
					case 'D':
						context.allowedTypes[skillShort] = "Defense";
						break;
					case 'H':
						context.allowedTypes[skillShort] = "Hand-to-Hand";
						break;
					case 'M':
						context.allowedTypes[skillShort] = "Melee";
						break;
					case 'R':
						context.allowedTypes[skillShort] = "Ranged";
						break;
				}
			}
		}
		if (Object.keys(context.allowedTypes).length == 0) {
			context.allowedTypes["N/A"] = "No Skills Allowed";
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
	 * @inheritdoc
	 */
	_prepareSubmitData(event, form, formData, updateData) {
		// Identify array-based form elements
		const checkKeys = CONFIG.Tribe8.checkFormArrayElements(formData);

		// Extract identified array-based elements
		const allowedTypes = {}; // Object so we can use explicit keys
		for (const key of checkKeys) {
			const propertyPath = key.split(/[[.]/);
			let chosenType;
			if ((propertyPath[0] ?? "") == 'system' && (propertyPath[1] ?? "") == 'allowedTypes' && (chosenType = propertyPath[2].replace(']', '') ?? "").length == 1) {
				// Found a valid value, so store it and then delete it from the formData
				if (formData.object[key]) {
					allowedTypes[chosenType] = formData.object[key];
				}
				delete formData.object[key];
			}
		}
		// Bolt them back onto the formData as a proper array
		for (let type in allowedTypes) {
			if (Object.hasOwn(allowedTypes, type)) { // Make sure we're only targeting the properties of the specializations object, and not its inherited ones
				if (!formData.object['system.==allowedTypes']) {
					formData.object['system.==allowedTypes'] = {};
				}
				formData.object['system.==allowedTypes'][type] = allowedTypes[type];
			}
		}
		// Reset forSkill if the chosen value is no longer valid
		if (!Object.keys(allowedTypes).length) {
			formData.object['system.forSkill'] = null;
			formData.object['system.==allowedTypes'] = null;
		}

		// Handle blanks, N/As, and plus-prefixed numbers
		for (let field of this.constructor.COMBAT_MODIFIER_FIELDS.map((f) => `system.${f}`).concat(['system.forSkill'])) {
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