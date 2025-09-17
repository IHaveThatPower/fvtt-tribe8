import { Tribe8 } from '../config.js';
import { Tribe8ItemSheet } from './item.js';
const { DialogV2 } = foundry.applications.api;

export class Tribe8SkillSheet extends Tribe8ItemSheet {
	static DEFAULT_OPTIONS = {
		window: { contentClasses: ["tribe8", "skill", "sheet", "item"] },
		position: { width: 300 },
		actions: {
			incrementEdie:         Tribe8SkillSheet.action_incrementEdie,
			decrementEdie:         Tribe8SkillSheet.action_decrementEdie,
			addSpecialization:     Tribe8SkillSheet.action_addSpecialization,
			removeSpecialization:  Tribe8SkillSheet.action_removeSpecialization
		}
	}

	static PARTS = {
		form: { template: 'systems/tribe8/templates/sheets/items/skill.hbs' }
	}

	static DEFAULT_ICON = "systems/tribe8/icons/skill.svg";

	/**
	 * Modified title, with Skill prefix
	 *
	 * @return {string} The document name, prefixed with "Skill"
	 * @access public
	 */
	get title() {
		return game.i18n.format(`tribe8.item.skill.title`, {skill: this.document.name});
	}

	/**
	 * Prepare the context object supplied to the application
	 *
	 * @param  {object} options    The set of options provided for rendering the sheet
	 * @return {object}            The computed context object for Handlebars to use in populating the sheet
	 * @access protected
	 */
	async _prepareContext(options) {
		const item = this.document;
		const context = await super._prepareContext(options);

		// Supply combat category reference
		context.combatCategories = Tribe8.COMBAT_SKILLS;

		// Bolt on the Specializations
		if (item.system.specializations.length) {
			context.specializations = item.system.specializations.map((s) => { return item.parent.getEmbeddedDocument("Item", s); });
		}
		return context;
	}

	/**
	 * Handle the submit data. In particular:
	 *
	 * - Extract Specialization-related form fields and stash them for
	 *   separate processing
	 * - Compute any eDie delta and handle that separately
	 *
	 * @param  {Event}            event              The triggering event
	 * @param  {HTMLFormElement}  form               The top-level form element
	 * @param  {FormDataExtended} formData           The actual data payload
	 * @param  {object}           [updateData={}]    Any supplemental data
	 * @return {object}                              Prepared submission data as an object
	 * @access protected
	 */
	_prepareSubmitData(event, form, formData, updateData) {
		// Identify array-based form elements
		const checkKeys = Tribe8.checkFormArrayElements(formData);

		// Setup objects for the types of form elements we know we want
		this.specializations = {}

		// Extract identified array-based elements
		for (let key of checkKeys) {
			let propertyPath = key.split(/[[\].]/).filter(p => p);
			this.#extractSpecializationsFromForm(key, propertyPath, formData, this.specializations);
		}

		// Restructure the submitted edie value to be differential, drop it off the formData
		const eDieDelta = Number(formData.object['system.eDieSpent'] || 0) - this.document.system.eDieSpent;
		if (formData.object['system.eDieSpent'])
			delete formData.object['system.eDieSpent'];

		// Get the normal submit stuff, now with the specializations removed
		const data = super._prepareSubmitData(event, form, formData, updateData);
		if (Object.hasOwn(data.system || {}, 'combatCategory')) {
			data.system['==combatCategory'] = data.system.combatCategory ? data.system.combatCategory : null; // `${data.system.combatCategory}`;
			delete data.system.combatCategory;
		}

		// Bold eDieDelta back on
		if (eDieDelta)
			data.eDieDelta = eDieDelta;
		// Ensure correct type
		data.system.specify = (data.system.specify == "1");

		// Update the data object with the submitted specialization IDs
		data.system['==specializations'] = Object.keys(this.specializations);

		return data;
	}

	/**
	 * Process the submitted data, or rather don't if the instigator
	 * of the submission was a form input the name of which starts with
	 * `newSpecialization`.
	 *
	 * Prior to actually submitting:
	 * - Process the eDie
	 * - Update Specializations
	 *
	 * @param {Event}           event           The event that triggered submission
	 * @param {HTMLFormElement} form            The form element doing the submitting
	 * @param {object}          submitData      The processed submit data
	 * @param {object}          [options={}]    Any extra options that need to be passed along
	 * @access protected
	 */
	async _processSubmitData(event, form, submitData, options={}) {
		// Stop the process if the event was emitted by one of the newSpecialization inputs
		const submittingElement = event.submitter ?? event.target;
		if (submittingElement.nodeName == 'INPUT' && submittingElement.name.match(/^newSpecialization/))
			return;

		// Process eDie changes
		const eDieDelta = (Number(submitData.eDieDelta) || 0);
		if (eDieDelta) {
			await this.document.system.alterEdie(eDieDelta);
		}

		// Update any Specializations we interacted with
		for (let specId in this.specializations) {
			const spec = this.document?.parent?.getEmbeddedDocument("Item", specId);
			if (spec) {
				const payload = {...this.specializations[specId]};
				payload['system.skill'] = this.document.id;
				await spec.update(payload);
			}
		}

		// Finally, process the submission
		await super._processSubmitData(event, form, submitData, options);
	}

	/**
	 * Extract specializations from formData and return them separately
	 *
	 * @param {string}           key                The full name of the form element we're checking
	 * @param {Array<string>}    propertyPath       Identifying information from the form element that triggerd this
	 * @param {FormDataExtended} [formData={}]      The submitted form data
	 * @param {object}           specializations    Any existing specializations we've already found, and which we'll write to
	 * @access private
	 */
	#extractSpecializationsFromForm(key, propertyPath, formData = {}, specializations = {}) {
		if (key.match(/^specializations\[/)) {
			propertyPath.shift(); // Drop 'specializations' off the front
			let specID = propertyPath.shift();
			if (!specializations[specID]) specializations[specID] = {};
			specializations[specID][propertyPath.join('.')] = foundry.utils.deepClone(formData.object[key], {strict: true});
			delete formData.object[key];
		}
	}

	/**
	 * Increment edie "other" amount
	 *
	 * @param {Event} event    The event triggered by interaction with the form element
	 * @access public
	 */
	static action_incrementEdie(event) {
		// Don't _also_ submit the form
		event.preventDefault();
		event.stopPropagation();
		this.document.system.alterEdie();
	}

	/**
	 * Decrement edie "other" amount
	 *
	 * @param {Event} event    The event triggered by interaction with the form element
	 * @access public
	 */
	static action_decrementEdie(event) {
		// Don't _also_ submit the form
		event.preventDefault();
		event.stopPropagation();
		this.document.system.alterEdie(-1);
	}

	/**
	 * Add a Specialization to an Actor, and then tie it to a Skill.
	 * Once done, re-render the form.
	 *
	 * @param {Event}           event     The event triggered by interaction with the form element
	 * @param {HTMLFormElement} target    The element that triggered the event
	 * @access public
	 */
	static action_addSpecialization(event, target) {
		event.stopPropagation();
		event.preventDefault();
		if (!this.document.parent) {
			foundry.ui.notifications.error("tribe8.error.specializations-on-unowned");
			return;
		}

		// Gather up some info.
		const specNode = target.parentNode;
		const specDef = {
			'name':           specNode.querySelector("input[name='newSpecialization.name']")?.value || "",
			'type':           "specialization",
			'system.points':  specNode.querySelector("input[name='newSpecialization.pointSource']:checked")?.value || "",
			'system.granted': specNode.querySelector("input[name='newSpecialization.granted']")?.checked || false,
			'system.skill':   this.document.id
		};
		specDef.name = specDef.name.trim();
		specDef['system.points'] = specDef['system.points'].toUpperCase();

		// Hand off to the actor, which will handle the rest of the process
		this.document.parent.createEmbeddedDocuments("Item", [specDef]).then(() => {
			// Reset the form and render
			specNode.querySelectorAll('input[name^="newSpecialization."]').forEach((i) => {
				if (i.type.toLowerCase() == 'text') i.value = "";
				if (i.type.toLowerCase() == 'radio') i.checked = false;
				if (i.type.toLowerCase() == 'checkbox') i.checked = false;
			});
			this.render();
		});
	}

	/**
	 * Remove an existing specialization
	 *
	 * @param {Event}           event     The event triggered by interaction with the form element
	 * @param {HTMLFormElement} target    The element that triggered the event
	 * @access public
	 */
	static action_removeSpecialization(event, target) {
		event.stopPropagation();
		event.preventDefault();

		// Can we find a specialization ID?
		const specId = target?.parentNode?.dataset?.editId;
		if (!specId) return; // Let this fail silently

		// Can we find the specialization among the Skill's list?
		const currentSpecializations = this.document.system.specializations;
		if (!currentSpecializations.includes(specId)) {
			foundry.ui.notifications.error(game.i18n.format("tribe8.errors.spec-missing-from-skill", {'specId': `Specialization.${specId}`, 'skill': this.document.name}))
			return;
		}

		const spec = this.document.parent.getEmbeddedDocument("Item", specId);
		const that = this;
		DialogV2.confirm({
			content: game.i18n.format("tribe8.item.skill.delete-specialization", {'name': spec.name}),
			modal: true
		}).then((result) => {
			if (result) {
				// Delete the Specialization Item off the Actor, which will take care of the rest
				this.document.parent.deleteEmbeddedDocuments("Item", [specId]).then(() => {
					that.render();
				});
			}
		});
	}
}
