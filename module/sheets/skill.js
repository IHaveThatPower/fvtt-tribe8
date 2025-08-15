import { Tribe8ItemSheet } from './item.js';
import { Tribe8SkillModel } from '../datamodels/skill.js';
const { DialogV2 } = foundry.applications.api;

export class Tribe8SkillSheet extends Tribe8ItemSheet {
	static DEFAULT_OPTIONS = {
		window: {
			contentClasses: ["tribe8", "skill", "sheet", "item"]
		},
		position: {
			width: 300
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
			template: 'systems/tribe8/templates/skill-sheet.html'
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
	 * Prepare the context object supplied to the application
	 */
	async _prepareContext(options) {
		const item = this.document;
		const context = await super._prepareContext(options);

		// Bolt on the Specializations
		if (item.system.specializations.length) {
			context.specializations = item.system.specializations.map((s) => { return item.parent.getEmbeddedDocument("Item", s); });
		}
		return context;
	}

	/**
	 * Handle the submit data
	 */
	_prepareSubmitData(event, form, formData, updateData) {
		// Identify array-based form elements
		const checkKeys = CONFIG.Tribe8.checkFormArrayElements(formData);

		// Setup objects for the types of form elements we know we want
		this.specializations = {}

		// Extract identified array-based elements
		for (let key of checkKeys) {
			let propertyPath = key.split(/[\[\]\.]/).filter(p => p);
			this._extractSpecializationsFromForm(key, propertyPath, formData, this.specializations);
		}

		// Restructure the submitted edie value to be differential, drop it off the formData
		const eDieDelta = Number(formData.object['system.eDieSpent'] || 0) - this.document.system.eDieSpent;
		if (formData.object['system.eDieSpent'])
			delete formData.object['system.eDieSpent'];

		// Get the normal submit stuff, now with the specializations removed
		const data = super._prepareSubmitData(event, form, formData, updateData);

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
	 * Process the submitted data
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

		// Now, update any specializations
		await this._updateSpecializations();

		// Finally, process the submission
		await super._processSubmitData(event, form, submitData, options);
	}

	/**
	 * Extract specializations from formData and return them separately
	 */
	_extractSpecializationsFromForm(key, propertyPath, formData = {}, specializations = {}) {
		if (key.match(/^specializations\[/)) {
			if (propertyPath.length != 3)
				console.warn("Unexpected propertyPath pattern", propertyPath);
			propertyPath.shift(); // Drop 'specializations' off the front
			let specID = propertyPath[0]
			if (!specializations[specID])
				specializations[specID] = {};
			specializations[specID][propertyPath[1]] = foundry.utils.deepClone(formData.object[key], {strict: true});
			delete formData.object[key];
		}
	}
	
	/**
	 * Update Specialization Items attached to this Skill
	 */
	async _updateSpecializations() {
		if (this.specializations) {
			const sheet = this;
			const actor = this.document.parent;
			for (let specId of Object.keys(sheet.specializations)) {
				const specItem = actor.getEmbeddedDocument("Item", specId);
				if (!specItem) {
					console.warn(`No Specialization item matching id ${specId} found on actor '${actor.name}'`);
					continue;
				}
				const srcData = sheet.specializations[specId];
				const updateData = {};
				for (let f of Object.keys(srcData)) {
					let targetProp = (f != 'name' ? `system.${f}` : f);
					updateData[targetProp] = srcData[f];
				}
				await specItem.update(updateData);
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
		this.document.system.alterEdie();
	}

	/**
	 * Decrement edie "other" amount
	 */
	static decrementEdie(event, target) {
		// Don't _also_ submit the form
		event.preventDefault();
		event.stopPropagation();
		this.document.system.alterEdie(-1);
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

		// Gather up some info.
		const specNode = target.parentNode;
		const nameNode = specNode.querySelector("input[name='newSpecialization.name']");
		const pointsNode = specNode.querySelector("input[name='newSpecialization.pointSource']:checked");
		const grantedNode = specNode.querySelector("input[name='newSpecialization.granted']");
		const specDef = {
			'name': nameNode?.value,
			'system.points': pointsNode?.value,
			'system.granted': grantedNode?.checked,
			'system.skill': this.document.id
		};
		specDef.name = specDef.name.trim();
		specDef['system.points'] = specDef['system.points'].toUpperCase();
		
		// Hand off to the model's method
		this.document.system.addSpecialization(specDef);

		// Now clear out the existing form fields and re-render
		if (nameNode)
			nameNode.value = "";
		if (pointsNode)
			pointsNode.checked = false;
		if (grantedNode)
			grantedNode.checked = false;
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