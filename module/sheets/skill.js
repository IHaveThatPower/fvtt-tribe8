import { Tribe8ItemSheet } from './item.js';
import { Tribe8SkillModel } from '../datamodels/skill.js';
const { DialogV2 } = foundry.applications.api;

export class Tribe8SkillSheet extends Tribe8ItemSheet {
	static DEFAULT_OPTIONS = {
		window: {
			contentClasses: ["tribe8", "skill", "sheet", "item"]
		},
		position: {
			width: 300,
			height: 400
		},
		actions: {
			incrementEdie: Tribe8SkillSheet.incrementEdie,
			decrementEdie: Tribe8SkillSheet.decrementEdie,
			addSpecialization:  Tribe8SkillSheet.addSpecialization,
			removeSpecialization:  Tribe8SkillSheet.removeSpecialization
		}
	}

	static PARTS = {
		form: {
			template: 'systems/tribe8/templates/skill-sheet.html' // TODO: Limited sheet support
		}
	}
	
	static DEFAULT_ICON = "systems/tribe8/icons/skill.svg";

	/**
	 * Title of the sheet
	 */
	get title() {
		return `Skill: ${this.document.name}`;
	}
	
	/**
	 * When re-rendering, always re-render the title
	 */
	async _onRender(context, options)
	{
		if (this.window.title.textContent != this.title) {
			this._updateFrame({window: { title: this.title }});
		}
		return super._onRender(context, options);
	}

	/**
	 * Prepare the context object supplied to the application
	 */
	async _prepareContext(options) {
		const context = await super._prepareContext(options);
		return context;
	}
	
	/**
	 * Handle the submit data
	 */
	_prepareSubmitData(event, form, formData, updateData) {
		// Identify array-based form elements
		const checkKeys = this._checkFormArrayElements(formData);

		// Setup objects for the types of form elements we know we want
		const specializations = {}

		// Extract identified array-based elements
		for (const key of checkKeys) {
			let propertyPath = key.split(/[\[\.]/);
			this._extractSpecializationsFromForm(key, propertyPath, formData, specializations);
		}
		
		// Get the normal submit stuff, now with the specializations removed
		const data = super._prepareSubmitData(event, form, formData, updateData);
		if (data.system.specify == "1")
			data.system.specify = true;
		else
			data.system.specify = false;

		// Update the data object with the now-processed array parameters
		this._appendSpecializations(specializations, data);
		return data;
	}

	/**
	 * Process the submitted data
	 */
	async _processSubmitData(event, form, submitData, options={}) {
		// Stop the process if the event was emitted by one of the newSpecialization inputs
		const submittingElement = event.submitter ?? event.target;
		if (submittingElement.nodeType == 'INPUT' && submittingElement.name.match(/^newSpecialization/))
			return;
		const that = this;
		return await super._processSubmitData(event, form, submitData, options);
	}
	
	/**
	 * Extract specializations from formData and return them separately
	 */
	_extractSpecializationsFromForm(key, propertyPath, formData = {}, specializations = {}) {
		if (propertyPath.length < 3)
			return;
		if (propertyPath[0] != 'system' || propertyPath[1] != 'specializations')
			return;
			
		propertyPath.shift(); // Drop the system part
		propertyPath.shift(); // Drop the specializations part
		if (propertyPath.length != 2)
			return;

		let index = propertyPath.shift().replace(/[\[\]]/, '');
		let specKey = propertyPath.shift();
		if (!specializations[index])
			specializations[index] = {};
		specializations[index][specKey] = formData.object[key];
		delete formData.object[key];
	}
	
	/**
	 * Append specializations to the processed form data object
	 */
	_appendSpecializations(specializations, data) {
		for (let prop in specializations) {
			if (specializations.hasOwnProperty(prop)) { // Make sure we're only targeting the properties of the specializations object, and not its inherited ones
				if (!data.system.specializations)
					data.system.specializations = {}
				let targetProp = Tribe8SkillModel.generateSpecializationKey(prop);
				
				// TODO: Validate that we don't already have this specialization
				// Shouldn't happen, but it might with weird data situations
				data.system.specializations[targetProp] = specializations[prop];
			}
		}
	}

	/**
	 * Increment edie "other" amount
	 */
	static incrementEdie(event, target) {
		// Don't _also_ submit the form
		event.preventDefault();
		event.stopPropagation();
		this.document.system.spendEdie();
	}
	
	/**
	 * Decrement edie "other" amount
	 */
	static decrementEdie(event, target) {
		// Don't _also_ submit the form
		event.preventDefault();
		event.stopPropagation();
		this.document.system.refundEdie();
	}
	
	/**
	 * Add a specialization to a skill
	 * 
	 * TODO: Move a lot of this code to the Skill Model, which already
	 * does a version of it for the inline editing.
	 */
	static addSpecialization(event, target) {
		event.stopPropagation();
		event.preventDefault();
		// TODO: Do we have permission to do this?
		/*
		if (!this.options.document.isOwned)
		{
			foundry.ui.notifications.error("Cannot add a Specialization to a Skill that is not owned by a Character");
			return;
		}
		*/
		// Gather up some info.
		const nSpecName = target.parentNode.querySelector("input[name='newSpecialization.name']");
		if (!nSpecName || !nSpecName.value || nSpecName.value.length == 0)
		{
			foundry.ui.notifications.error("Specialization needs a name");
			return;
		}
		const sSpecName = nSpecName.value.trim();
		const sSpecKey = Tribe8SkillModel.generateSpecializationKey(sSpecName);
		const nSpecPoints = target.parentNode.querySelector("input[name='newSpecialization.pointSource']:checked");
		if (!nSpecPoints || !nSpecPoints.value || (nSpecPoints.value != "cp" && nSpecPoints.value != "xp")) {
			foundry.ui.notifications.error("Please select a points pool to pay for this Specialization");
			return;
		}
		const sSpecPoints = nSpecPoints.value;
		// Does this Specialization already exist?
		const currentSpecializations = this.document.system.specializations;
		if (Object.keys(currentSpecializations).filter((s) => s == sSpecKey).length > 0) {
			foundry.ui.notifications.error("A Specialization with that ID already exists for this Skill");
			return;
		}
		for (let specKey of Object.keys(currentSpecializations)) {
			const spec = currentSpecializations[specKey];
			if (spec.name == sSpecName) {
				foundry.ui.notifications.error("A Specialization with that name already exists for this Skill");
				return;
			}
		}
		// Okay, let's add it!
		const nSpec = {"name": sSpecName, "points": sSpecPoints};
		currentSpecializations[sSpecKey] = nSpec;
		this.document.update({'system.specializations': currentSpecializations});

		// Now clear out the existing form fields
		nSpecName.value = "";
		nSpecPoints.checked = false;
		
		// Now re-render
		this.render();
	}
	
	/**
	 * Remove an existing specialization
	 * 
	 * TODO: Move a lot of this code to the Skill Model, which already
	 * does a version of it for the inline editing.
	 */
	static removeSpecialization(event, target) {
		event.stopPropagation();
		event.preventDefault();
		const specUUID = target?.parentNode?.dataset?.uuid;
		if (!specUUID)
			return;
		const currentSpecializations = this.document.system.specializations;
		if (!currentSpecializations[specUUID])
			return;
		const that = this;
		DialogV2.confirm({
			content: `Are you sure you want to delete the Specialization '${currentSpecializations[specUUID].name}'?`,
			modal: true
		}).then((result) => {
			if (result) {
				this.document.update({[`system.specializations.-=${specUUID}`]: null}).then(() => {
					that.render();
				});
			}
		});
	}
}