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
			template: 'systems/tribe8/templates/character-sheet.html'
		}
	}

	/**
	 * Title of the sheet
	 */
	get title() {
		return this.document.name;
	}

	/**
	 * Prepare the context with which the Application renders.
	 * This used to be getData() in Application V1
	 */
	async _prepareContext(options) {
		const context = await super._prepareContext(options);

		// Who's the player for this?
		const playerOwner = this.document.getPlayerOwner();
		if (playerOwner)
			context.playerName = playerOwner.name;

		// Differentiate items
		for (let item of this.document.items) {
			switch (item.type) {
				case 'skill':
					if (!context.skills) context.skills = [];
					item.specializations = ""; // Transient property for display
					if (item.system.specializations.length)
						item.specializations = item.system.specializations.map((s) => { return item.parent.getEmbeddedDocument("Item", s).name; }).join(', ');
					context.skills.push(item);
					if (CONFIG.Tribe8.slugify(item.system.name) == 'synthesis') {
						if (!context.magic) context.magic = {};
						context.magic.synthesisSkill = item;
					}
					break;
				case 'perk':
				case 'flaw':
					if (!context.perksAndFlaws)
						context.perksAndFlaws = [];
					context.perksAndFlaws.push(item);
					if (CONFIG.Tribe8.slugify(item.name) == 'dreamer') {
						if (!context.magic) context.magic = {};
						context.magic.hasDreamerPerk = true;
					}
					if (CONFIG.Tribe8.slugify(item.name) == 'awakeneddreamer') {
						if (!context.magic) context.magic = {};
						context.magic.hasAwakenedDreamerPerk = true;
					}
					break;
				case 'maneuver':
					if (!context.sortedManeuvers) context.sortedManeuvers = [];
					context.sortedManeuvers.push(item);
					break;
				case 'eminence':
				case 'aspect':
				case 'totems':
					if (!context.magic) context.magic = {};
					const collectionName = `${item.type}s`;
					if (!context.magic[collectionName]) context.magic[collectionName] = [];
					context.magic[collectionName].push(item);
					break
				case 'specialization':
					// Handled by skills
					break;
				default:
					console.warn(`Unsupported character item type '${item.type}', will not display`);
					break;
			}
		}

		// Sort various items for display
		for (let itemGroup of ['skills', 'perksAndFlaws', 'sortedManeuvers', 'magic.eminences', 'magic.aspects', 'magic.totems']) {
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
	 * Handle the submit data
	 */
	_prepareSubmitData(event, form, formData, updateData) {
		// Identify array-based form elements
		const checkKeys = CONFIG.Tribe8.checkFormArrayElements(formData);

		// Extract identified array-based elements
		let systemShockChecked = 0;
		for (const key of checkKeys) {
			let propertyPath = key.split(/[\[\.]/);
			if (propertyPath[0] == 'systemShock') {
				if (formData.object[key]) {
					systemShockChecked++;
				}
				delete formData.object[key];
			}
		}

		// Having counted up the number of system shock checkboxes that
		// were checked, re-build the array
		formData.object['system.attributes.secondary.physical.shock.current'] = systemShockChecked;

		return super._prepareSubmitData(event, form, formData, updateData);
	}

	/**
	 * Handle any special _onRender events.
	 */
	async _onRender(context, options) {
		// Rig up manual input on eDie fields
		this.element.querySelectorAll('div.edie-block div.value input[type=number]').forEach((i) => {
			i.addEventListener('keyup', (e) => {
				if (!e.target) {
					return;
				}
				// Find the skill
				const skillId = (e.target.closest('div.skill') || {}).dataset?.id;
				if (!skillId) {
					return;
				}
				const skill = this.document.getEmbeddedDocument("Item", skillId);
				if (!skill) {
					return;
				}
				skill.system.eDieKeyInputEventHandler(e);
			});
		});
		super._onRender(context, options);
	}

	/**
	 * Increment edie "other" amount
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
	 */
	static addNewItem(event, target) {
		event.preventDefault();
		event.stopPropagation();
		const addItemType = target.name?.split('-')[1];
		if (!addItemType || (Object.keys(CONFIG.Item.dataModels).indexOf(addItemType) < 0 && addItemType != 'pf')) {
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
				if (result) {
					switch (result) {
						case 'perk':
						case 'flaw':
							that._addNewItem(result);
							break;
						default:
							break;
					}
				}
			});
		}
		else {
			this._addNewItem(addItemType);
		}
	}

	/**
	 * Actually create a new item
	 *
	 * @param	String itemType
	 */
	_addNewItem(itemType) {
		const newItemName = `New ${itemType[0].toUpperCase()}${itemType.slice(1)}`;
		this.document.createEmbeddedDocuments('Item', [{type: itemType, name: newItemName}]).then((resolve) => {
			const newItem = resolve[0];
			// Open the editing window for it
			newItem.sheet.render(true);
		});
	}

	/**
	 * Open the editing dialog for an existing item
	 */
	static editItem(event, target) {
		event.preventDefault();
		event.stopPropagation();
		const item = this._getItemFromTarget(target);
		if (!item) return;
		item.sheet.render(true);
	}

	/**
	 * Get an embedded item by way of the button used to edit it.
	 *
	 * @param	HTMLElement
	 * @param	String [optional] action
	 * @return	Tribe8Item
	 */
	_getItemFromTarget(target) {
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
	 */
	static useEminence(event, target) {
		event.stopPropagation();
		const item = this._getItemFromTarget(target);
		if (!item) return;
		item.update({'system.used': target.checked});
	}
}
