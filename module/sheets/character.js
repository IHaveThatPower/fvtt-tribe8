const { DialogV2 } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
import { Tribe8Sheet } from './sheet.js';

export class Tribe8CharacterSheet extends Tribe8Sheet(ActorSheetV2) {
	static DEFAULT_OPTIONS = {
		form: {
			closeOnSubmit: false,
			submitOnChange: true
		},
		position: {
			width: 1024,
			height: 768
		},
		window: {
			resizable: true,
			contentClasses: ["tribe8", "character", "sheet", "actor"]
		},
		actions: {
			incrementEdie: Tribe8CharacterSheet.incrementEdie,
			decrementEdie: Tribe8CharacterSheet.decrementEdie,
			editItem: Tribe8CharacterSheet.editItem,
			addNewItem: Tribe8CharacterSheet.addNewItem,
			useEminence: Tribe8CharacterSheet.useEminence,
		}
	}

	static PARTS = {
		form: {
			template: 'systems/tribe8/templates/sheet_character.html'
		}
	}

	/**
	 * Basic character name, no prefix.
	 *
	 * @return {string} The name of the character
	 * @access public
	 */
	get title() {
		return this.document.name;
	}

	/**
	 * Prepare the context with which the Application renders.
	 * This used to be getData() in Application V1
	 *
	 * @param  {object} options    The set of options provided for rendering the sheet
	 * @return {object}            The computed context object for Handlebars to use in populating the sheet
	 * @access protected
	 */
	async _prepareContext(options) {
		const context = await super._prepareContext(options);

		// Who's the player for this?
		const playerOwner = this.document.getPlayerOwner();
		if (playerOwner)
			context.playerName = playerOwner.name;

		// Define a little helper function on our context to handle all
		// the various things we need to ensure exist along the way
		context.ensureHas = function(name, empty) {
			if (typeof this != 'object' || this?.constructor?.name !== 'Object')
				throw new Error("Invalid state for context object; continuing would be unsafe");
			if (!this[name])
				this[name] = empty;
		}
		context.ensureHas('magic', {});
		context.magic.ensureHas = context.ensureHas;

		// Differentiate items
		for (let item of this.document.items) {
			let collectionName = `${item.type}s`; // Default context collection name we add items of this type to
			switch (item.type) {
				case 'specialization':
					// Handled by skills
					break;
				case 'skill':
					context.ensureHas(collectionName, []);
					item.specializations = ""; // Transient property for display
					if (item.system.specializations.length)
						item.specializations = item.system.specializations.map((s) => { return item.parent.getEmbeddedDocument("Item", s).name; }).join(', ');
					context[collectionName].push(item);

					// Track Synthesis and Ritual, specifically
					if (CONFIG.Tribe8.slugify(item.system.name) == 'synthesis') {
						context.magic.synthesisSkill = item;
					}
					if (CONFIG.Tribe8.slugify(item.system.name) == 'ritual') {
						context.magic.ritualSkill = item;
					}
					break;
				case 'perk':
				case 'flaw':
					context.ensureHas(collectionName = 'perksAndFlaws', []);
					context[collectionName].push(item);

					// Track Dreamer and Awakened Dreamer Perks
					if (CONFIG.Tribe8.slugify(item.name) == 'dreamer') {
						context.magic.hasDreamerPerk = true;
					}
					if (CONFIG.Tribe8.slugify(item.name) == 'awakeneddreamer') {
						context.magic.hasAwakenedDreamerPerk = true;
					}
					break;
				case 'maneuver':
					context.ensureHas(collectionName = 'sortedManeuvers', []);
					context[collectionName].push(item);
					break;
				case 'eminence':
				case 'totem':
				case 'aspect':
					if (item.type == 'aspect') {
						collectionName = `${collectionName[0].toUpperCase()}${collectionName.slice(1)}`;
						collectionName = item.system.ritual ? `ritual${collectionName}` : `synthesis${collectionName}`;
					}
					context.magic.ensureHas(collectionName, []);
					item.cost = CONFIG.Tribe8.costs[item.type];
					context.magic[collectionName].push(item);
					break
				default:
					context.ensureHas(collectionName, []);
					context[collectionName].push(item);
					break;
			}
		}

		// Sort various items for display
		for (let itemGroup of ['skills', 'perksAndFlaws', 'sortedManeuvers', 'magic.eminences', 'magic.synthesisAspects', 'magic.totems', 'magic.ritualAspects']) {
			let contextTarget = context[itemGroup];
			const itemGroupParts = itemGroup.split('.');
			if (itemGroupParts.length > 1) {
				contextTarget = context;
				for (let c = 0; c < itemGroupParts.length; c++) {
					const contextProp = itemGroupParts[c];
					if (!contextTarget[contextProp]) {
						break;
					}
					contextTarget = contextTarget[contextProp];
				}
			}
			if (contextTarget && contextTarget.length) {
				if (contextTarget[0]?.constructor?.cmp) {
					contextTarget.sort(contextTarget[0].constructor.cmp);
				}
			}
		}
		return context;
	}

	/**
	 * Transform/manipulate the form submission data
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
		const checkKeys = CONFIG.Tribe8.checkFormArrayElements(formData);

		// Extract identified array-based elements
		this.#interpretSystemShock(formData.object, checkKeys);

		return super._prepareSubmitData(event, form, formData, updateData);
	}

	/**
	 * Reinterpret the system shock data
	 *
	 * @param {FormData}      formDataObject    The inner FormData object from the submitted FormDataExtended
	 * @param {Array<string>} checkKeys         Array-style form field names to be parsed
	 * @access private
	 */
	#interpretSystemShock(formDataObject, checkKeys) {
		let systemShockChecked = 0;
		for (const key of checkKeys) {
			let propertyPath = key.split(/[[.]/);
			if (propertyPath[0] == 'systemShock') {
				if (formDataObject[key]) {
					systemShockChecked++;
				}
				delete formDataObject[key];
			}
		}

		// Having counted up the number of system shock checkboxes that
		// were checked, re-build the array
		formDataObject['system.attributes.secondary.physical.shock.current'] = systemShockChecked;
	}

	/**
	 * Handle any special _onRender events, including event listeners
	 * that we need to ensure re-register with their elements on each
	 * re-render.
	 *
	 * @param {object} context    The rendering context
	 * @param {object} options    Supplemental rendering options
	 * @access protected
	 */
	async _onRender(context, options) {
		// Artwork editing
		this.element.querySelector('div.portrait')?.addEventListener('click', () => {
			new foundry.applications.apps.ImagePopout({
				src: this.document.img,
				uuid: this.document.uuid,
				window: { title: this.document.name }
			}).render({ force: true });
		});

		// Rig up manual input on eDie fields
		this.element.querySelectorAll('div.edie-block div.value input[type=number]').forEach((i) => {
			i.addEventListener('keyup', (e) => {
				if (!e.target) return;

				// Find the skill
				const skillId = (e.target.closest('div.skill') || {}).dataset?.itemId;
				if (!skillId) return;
				const skill = this.document.getEmbeddedDocument("Item", skillId);
				if (!skill) return;
				skill.system.eDieKeyInputEventHandler(e);
			});
		});

		// Scale System Shock icon font size based on container
		const shockIcons = this.element.querySelectorAll('div.shock-state i');
		const baseIconHeight = shockIcons[0]?.parentNode?.offsetHeight; // Just use offset here, since we're (probably...) not dealing with CSS transforms
		if (baseIconHeight) {
			shockIcons.forEach((i) => {
				const height = baseIconHeight * 0.75;
				i.style.fontSize = `${height}px`;
			});
		}

		super._onRender(context, options);
	}

	/**
	 * Increment edie "other" amount
	 *
	 * @param {Event}           event     The event triggered by interaction with the form element
	 * @param {HTMLFormElement} target    The element that triggered the event
	 * @access public
	 */
	static incrementEdie(event, target) {
		event.preventDefault();
		event.stopPropagation();
		const skillRow = target.closest('div.skill');
		if (!skillRow) {
			// Wasn't the skill row; probably the general parent
			let currentAmount = this.document.system.edie.other;
			this.document.update({'system.edie.other': ++currentAmount});
			return;
		}
		const skillItem = this.document.getEmbeddedDocument("Item", skillRow.dataset?.id);
		if (!skillItem) {
			foundry.ui.notifications.error(`Could not find a Skill with the id ${skillRow.dataset?.id}`);
			return;
		}
		skillItem.system.alterEdie();
	}

	/**
	 * Decrement edie "other" amount
	 *
	 * @param {Event}           event     The event triggered by interaction with the form element
	 * @param {HTMLFormElement} target    The element that triggered the event
	 * @access public
	 */
	static decrementEdie(event, target) {
		event.preventDefault();
		event.stopPropagation();
		const skillRow = target.closest('div.skill');
		if (!skillRow) {
			// Wasn't the skill row; probably the general parent
			let currentAmount = parseInt(this.document?.system?.edie?.other) || 0;
			this.document.update({'system.edie.other': --currentAmount});
			return;
		}
		const skillItem = this.document.getEmbeddedDocument("Item", skillRow.dataset?.id);
		if (!skillItem) {
			foundry.ui.notifications.error(`Could not find a Skill with the id ${skillRow.dataset?.id}`);
			return;
		}
		skillItem.system.alterEdie(-1);
	}

	/**
	 * Add a new Item
	 *
	 * @param {Event}           event     The event triggered by interaction with the form element
	 * @param {HTMLFormElement} target    The element that triggered the event
	 * @access public
	 */
	static addNewItem(event, target) {
		event.preventDefault();
		event.stopPropagation();
		const actionParts = (target.name?.split('-') || []).slice(1);
		const addItemType = actionParts.shift();
		if (!addItemType || (Object.keys(CONFIG.Item.dataModels).push('pf').indexOf(addItemType) < 0)) {
			foundry.ui.notifications.warn("Requested creation of unrecognized item type");
			return;
		}
		// Present special dialog for Perks/Flaws
		if (addItemType == 'pf') {
			const that = this;
			DialogV2.wait({
				window: {title: "Choose Perk or Flaw"},
				content: "Do you wish to create a Perk or a Flaw?",
				buttons: [
					{label: "Perk", action: "perk"},
					{label: "Flaw", action: "flaw"},
					{label: "Cancel", action: "cancel"}
				],
				modal: true
			}).then((result) => {
				if (result == 'perk' || result == 'flaw') {
					that.#addNewItem(result, actionParts);
				}
			});
		}
		else {
			this.#addNewItem(addItemType, actionParts);
		}
	}

	/**
	 * Actually create a new item
	 *
	 * @param {string}        itemType            The item type derived from inspecting the 'action' data
	 * @param {Array<string>} [actionParts=[]]    List of strings previously obtained by splitting apart the 'action' data on a form element
	 * @access private
	 */
	#addNewItem(itemType, actionParts = []) {
		const newItemName = `New ${itemType[0].toUpperCase()}${itemType.slice(1)}`;
		const newItemPayload = {type: itemType, name: newItemName};
		if (itemType == 'aspect' && actionParts.length)
			newItemPayload.ritual = (actionParts[0] == 'ritual');
		this.document.createEmbeddedDocuments('Item', [newItemPayload]).then((resolve) => {
			const newItem = resolve[0];
			// Open the editing window for it
			newItem.sheet.render(true);
		});
	}

	/**
	 * Open the editing dialog for an existing item
	 *
	 * @param {Event}           event     The event triggered by interaction with the form element
	 * @param {HTMLFormElement} target    The element that triggered the event
	 * @access public
	 */
	static editItem(event, target) {
		event.preventDefault();
		event.stopPropagation();
		const item = this.#getItemFromTarget(target);
		if (!item) return;
		item.sheet.render(true);
	}

	/**
	 * Get an embedded item by way of the button used to edit it.
	 *
	 * @param  {HTMLFormElement} target    The form element interacted with
	 * @return {Tribe8Item|bool}           Either the matching Item, or false if it couldn't be found
	 * @access private
	 */
	#getItemFromTarget(target) {
		// Check the provided item, its parent, and any .identity div child
		const id =
			target.dataset?.itemId ??
			target.parentNode?.dataset?.itemId ??
			false;
		if (!id) {
			foundry.ui.notifications.warn("Item ID could not be determined");
			return false;
		}
		const item = this.document.getEmbeddedDocument('Item', id);
		if (!item) {
			foundry.ui.notifications.warn("Item not found");
			return false;
		}
		return item;
	}

	/**
	 * Mark an Eminence as used or not
	 *
	 * @param {Event}           event     The event triggered by interaction with the form element
	 * @param {HTMLFormElement} target    The element that triggered the event
	 * @access public
	 */
	static useEminence(event, target) {
		event.stopPropagation();
		const item = this._getItemFromTarget(target);
		if (!item) return;
		item.update({'system.used': target.checked});
	}
}
