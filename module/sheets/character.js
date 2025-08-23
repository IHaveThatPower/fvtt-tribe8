const { DialogV2 } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
import { Tribe8Application } from '../apps/base-app.js';
import { Tribe8AttributeEditor } from '../apps/attribute-editor.js';

export class Tribe8CharacterSheet extends Tribe8Application(ActorSheetV2) {
	static DEFAULT_OPTIONS = {
		form: { closeOnSubmit: false, submitOnChange: true },
		position: { width: 1024, height: 768 },
		window: {
			resizable: true,
			contentClasses: ["tribe8", "character", "sheet", "actor"]
		},
		actions: {
			incrementEdie: Tribe8CharacterSheet.action_incrementEdie,
			decrementEdie: Tribe8CharacterSheet.action_decrementEdie,
			editItem:      Tribe8CharacterSheet.action_editItem,
			addNewItem:    Tribe8CharacterSheet.action_addNewItem,
			useEminence:   Tribe8CharacterSheet.action_useEminence,
		}
	}

	static PARTS = {
		tabs: { template: 'templates/generic/tab-navigation.hbs' },
		main: { template: 'systems/tribe8/templates/sheets/actors/character_main.html' },
		equipment: { template: 'systems/tribe8/templates/sheets/actors/character_equipment.html' }
	}

	static TABS = {
		character: {
			tabs: [
				{ id: "main", },
				{ id: "equipment", },
				{ id: "combat", }
			],
			labelPrefix: "tribe8.actor.character.tabs",
			initial: "main"
		}
	};

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

		// Who's the player for this?
		if (this.document.playerOwner)
			context.playerName = game.users.get(this.document.playerOwner)?.name;

		// Prepare specific Skill categories
		context.hasCombatSkills = this.document.getSkills({categories: ['combat'], count: true})
		context.hasMagicSkills = this.document.getSkills({categories: ['magic'], count: true});

		this.#prepareContext_collectItems(context);
		this.#prepareContext_sortCollections(context);

		// Add the tabs
		const contextWithTabs = {...context, tabs: this._prepareTabs("character")};
		return contextWithTabs;
	}

	/**
	 * Prepare collections of Items for the render context
	 *
	 * @param  {object} context    The render context as thus far assembled
	 * @return {void}
	 * @access private
	 */
	#prepareContext_collectItems(context) {
		for (let item of this.document.items) {
			let collectionName = `${item.type}s`; // Default context collection name we add items of this type to
			switch (item.type) {
				case 'specialization':
					// Handled in Skills, below
					break;
				case 'skill':
					context.ensureHas(collectionName, []);
					item.specializations = ""; // Transient property for display
					if (item.system.specializations.length)
						item.specializations = item.system.specializations.map((s) => { return item.parent.getEmbeddedDocument("Item", s)?.name; }).filter((s) => s == s).join(', ');
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
				case 'gear':
				case 'armor':
					collectionName = item.type; // Already plural
					context.ensureHas(collectionName, []);
					context[collectionName].push(item);
					break;
				default:
					context.ensureHas(collectionName, []);
					context[collectionName].push(item);
					break;
			}
		}
	}

	/**
	 * Sort the Item collections added to the context
	 *
	 * @param  {object} context    The render context as thus far assembled
	 * @return {void}
	 * @access private
	 */
	#prepareContext_sortCollections(context) {
		const itemSortGroups = [
			'skills', 'perksAndFlaws', 'sortedManeuvers',
			'magic.eminences', 'magic.totems',
			'magic.synthesisAspects', 'magic.ritualAspects',
			'weapons', 'armor', 'gear'
		];
		for (let itemGroup of itemSortGroups) {
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
		// TODO: Support different user-driven sort methods for gear
	}

	/**
	 * We don't need to do anything fancy here, just tell the context
	 * that the current tab is the defined by the given part ID
	 *
	 * @param  {string} partId     The name of the tab/part that's active
	 * @param  {object} context    The supplied context, which we could potentially augment per-part if we needed to
	 * @return {object}            The part's prepared context
	 * @access public
	 */
	async _preparePartContext(partId, context) {
		context.tab = context.tabs[partId];
		return context;
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
		this.#listeners_artwork();
		this.#listeners_edie();
		this.#listeners_attEditor();

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
	 * Setup event listeners related to the display and editing of
	 * character artwork.
	 *
	 * @return {void}
	 * @access private
	 */
	#listeners_artwork() {
		this.element.querySelector('div.portrait')?.addEventListener('click', () => {
			new foundry.applications.apps.ImagePopout({
				src: this.document.img,
				uuid: this.document.uuid,
				window: { title: this.document.name }
			}).render({ force: true });
		});
	}

	/**
	 * Setup event listeners related to handling interaction with EDie
	 * fields.
	 *
	 * @return {void}
	 * @access private
	 */
	#listeners_edie() {
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
	}

	/**
	 * Spawn the Attribute Editor when any primary Attribute is clicked
	 *
	 * @return {void}
	 * @access private
	 */
	#listeners_attEditor() {
		this.element.querySelector('div.primary-attributes').addEventListener('click', (e) => {
			if (e.target.nodeName == 'H2') return;
			// Do we already have an open attribute editor for this character? If so, just focus it
			const attEditorId = `Tribe8AttributeEditor-Actor-${this.document.id}`;
			const attEditor = foundry.applications.instances[attEditorId];
			if (attEditor) {
				attEditor.render({force: true});
				return;
			}
			// Okay, make one!
			new Tribe8AttributeEditor({id: attEditorId, document: this.document}).render({force: true});
		});
	}

	/**
	 * When we first render, create context menus.
	 *
	 * @param {object} context    The rendering context
	 * @param {object} options    Supplemental rendering options
	 * @access protected
	 */
	async _onFirstRender(context, options) {
		// TODO: Create context menus
		// Invocation of createContextMenu.
		// First arg is the handler that should hand back an array of
		// objects that have all the data needed for a menu item
		// this._createContextMenu(() => ['Option 1', 'Option 2', 'Option 3'], 'div.portrait');

		// Structure for a handler's response
		/*
		return [{
			name: "SIDEBAR.CharArt",
			icon: '<i class="fa-solid fa-image"></i>',
			condition: li => {
				const actor = this.collection.get(li.dataset.entryId);
				const { img } = actor.constructor.getDefaultArtwork(actor._source);
				return actor.img !== img;
			},
			callback: li => {
				const actor = this.collection.get(li.dataset.entryId);
				new foundry.applications.apps.ImagePopout({
					src: actor.img,
					uuid: actor.uuid,
					window: { title: actor.name }
				}).render({ force: true });
			}
		},
		...
		*/
		super._onFirstRender(context, options);
	}

	/**
	 * Increment edie "other" amount
	 *
	 * @param {Event}           event     The event triggered by interaction with the form element
	 * @param {HTMLFormElement} target    The element that triggered the event
	 * @access public
	 */
	static action_incrementEdie(event, target) {
		event.preventDefault();
		event.stopPropagation();
		const skillRow = target.closest('div.skill');
		if (!skillRow) {
			// Wasn't the skill row; probably the general parent
			let currentAmount = this.document.system.edie;
			this.document.update({'system.edie': ++currentAmount});
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
	static action_decrementEdie(event, target) {
		event.preventDefault();
		event.stopPropagation();
		const skillRow = target.closest('div.skill');
		if (!skillRow) {
			// Wasn't the skill row; probably the general parent
			let currentAmount = parseInt(this.document?.system?.edie) || 0;
			this.document.update({'system.edie': --currentAmount});
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
	 * Add a new Item to this character
	 *
	 * @param {Event}           event     The event triggered by interaction with the form element
	 * @param {HTMLFormElement} target    The element that triggered the event
	 * @access public
	 */
	static action_addNewItem(event, target) {
		event.preventDefault();
		event.stopPropagation();
		const actionParts = (target.name?.split('-') || []).slice(1);
		const addItemType = actionParts.shift();
		if (!addItemType || ([...Object.keys(CONFIG.Item.dataModels), 'pf'].indexOf(addItemType) < 0)) {
			foundry.ui.notifications.warn("Requested creation of unrecognized item type");
			return;
		}
		// Present special dialog for Perks/Flaws
		if (addItemType == 'pf')
			this.#presentPerkFlawPrompt(actionParts);
		else
			this.#addNewItem(addItemType, actionParts);
	}

	/**
	 * If the User requested creation of a Perk or Flaw, we need to ask
	 * them which type they want.
	 *
	 * @param {Array<string>} actionParts    The component strings that made up the form request
	 * @access private
	 */
	#presentPerkFlawPrompt(actionParts) {
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

	/**
	 * Open the editing dialog for an existing item
	 *
	 * @param {Event}           event     The event triggered by interaction with the form element
	 * @param {HTMLFormElement} target    The element that triggered the event
	 * @access public
	 */
	static action_editItem(event, target) {
		event.preventDefault();
		event.stopPropagation();
		const item = this.#getItemFromTarget(target);
		if (!item) return;
		item.sheet.render(true);
	}

	/**
	 * Mark an Eminence as used or not
	 *
	 * @param {Event}           event     The event triggered by interaction with the form element
	 * @param {HTMLFormElement} target    The element that triggered the event
	 * @access public
	 */
	static action_useEminence(event, target) {
		event.stopPropagation();
		const item = this.#getItemFromTarget(target);
		if (!item) return;
		item.update({'system.used': target.checked});
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
			console.log("resolve", resolve);
			const newItem = resolve[0];
			// Open the editing window for it
			newItem.sheet.render(true);
		});
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
}
