const { Item } = foundry.documents;
import { Tribe8Actor } from './actor.js';

export class Tribe8Item extends Item {
	/**
	 * Identify whether or not this item is a physical item (i.e. a
	 * weapon, piece of armor, piece of gear) or is a modular element
	 * of an Actor.
	 *
	 * @return {bool} Whether or not the Item is a physical item
	 * @access public
	 */
	get isPhysicalItem() {
		if (CONFIG.Tribe8.PHYSICAL_ITEMS.indexOf(this.type) < 0)
			return false;
		return true;
	}

	/**
	 * Return the number of "steps" it takes to get from this Item,
	 * through any Item-type-specific "parents", to the Actor on which
	 * it's actually embedded. Applies to things like Gear in
	 * containers or Specializations on Skills.
	 *
	 * @return {int} Steps to reach the Actor from the Item; 0 if not embedded
	 * @access public
	 */
	get depth() {
		if (!this.isEmbedded) return 0;
		if (this.type == 'specialization')
			return 2; // If embedded, will always belong to a Skill
		if (this.isPhysicalItem) {
			return (Tribe8Item.#pathToActor(this).length - 1); // The first item is always the item itself, which we won't count
		}
		return 1; // The Actor
	}

	/**
	 * Get the weight of a physical Item's contents (i.e. everything
	 * that includes it in the "path" from Item to Actor).
	 *
	 * @return {float} The weight in kg of all the Item's contents.
	 *                 Does not include the Item itself.
	 * @access public
	 */
	get contentWeight() {
		if (!this.isEmbedded) return 0;
		if (!this.isPhysicalItem) return 0;

		// Find all Items that list this item as their storage Item
		const contentItems = this.parent.getGear().filter((g) => g.system.storage == this.id);
		if (!contentItems.length) return 0;

		return contentItems.reduce((weight, item) => (item.weight * item.qty) + (item.contentWeight), 0);
	}

	/**
	 * Pre-process a creation operation for a single Document instance.
	 * Pre-operation events only occur for the client which requested
	 * the operation.
	 *
	 * Modifications to the pending Document instance must be performed
	 * using {@link updateSource}.
	 *
	 * @param  {object}                data       The initial data object provided to the document creation request
	 * @param  {object}                options    Additional options which modify the creation request
	 * @param  {BaseUser}              user       The User requesting the document creation
	 * @return {Promise<boolean|void>}            Return false to exclude this Document from the creation operation
	 * @access protected
	 */
	async _preCreate(data, options, user) {
		try {
			this.#validateNewUpdate('create', data);
		}
		catch (error) {
			foundry.ui.notifications.error(error);
			return false;
		}
		return await super._preUpdate(data, options, user);
	}

	/**
	 * Pre-process an update operation for a single Document instance.
	 * Pre-operation events only occur for the client which requested
	 * the operation.
	 *
	 * @param  {object}                changes    The candidate changes to the Document
	 * @param  {object}                options    Additional options which modify the update request
	 * @param  {BaseUser}              user       The User requesting the document update
	 * @return {Promise<boolean|void>}            A return value of false indicates the update operation should be canceled.
	 * @access protected
	 */
	async _preUpdate(changes, options, user) {
		try {
			this.#validateNewUpdate('update', changes);
		}
		catch (error) {
			foundry.ui.notifications.error(error);
			return false;
		}
		return await super._preUpdate(changes, options, user);
	}

	/**
	 * Validate create/update requests.
	 *
	 * @param  {string}         request    The request being made (create or update)
	 * @param  {object}         data       The changes object passed along by _preCreate or _preUpdate
	 * @return {void}
	 * @throws {RangeError}                When Gear updates or Specialization creation has invalid parameters
	 * @throws {ReferenceError}            When Specialization creation has invalid parameters
	 * @access private
	 */
	#validateNewUpdate(request, data) {
		// A lot of these will want to know about the parent Actor, or
		// if one isn't (yet) assigned.
		const actor = this.parent;

		// Intercept dumb Gear inputs
		if (request == 'update' && this.isPhysicalItem) {
			if (Object.hasOwn(data.system, 'storage')) {
				if (data.system.storage == this.id) {
					throw new RangeError("tribe8.errors.circular-container");
				}
			}
			if (Object.hasOwn(data.system, 'qty')) {
				if (data.system.qty != 1 && this.system.isContainer) {
					throw new RangeError("tribe8.errors.quantity-on-container");
				}
			}
		}
		if (request == 'create' && data.type === 'specialization') {
			if (!actor) {
				throw new ReferenceError("tribe8.errors.unowned-specialization");
			}
			// Does this Specialization already exist?
			const targetSkill = actor.getEmbeddedDocument("Item", data.system.skill);
			if (!targetSkill) {
				throw new ReferenceError("tribe8.errors.skill-not-exist");
			}
			if (
				targetSkill.system.specializations
				.map((s) => actor.getEmbeddedDocument("Item", s))
				.filter((s) => s.type == 'specialization')
				.some((s) => s.name == data.name)
			) {
				throw new RangeError("tribe8.errors.existing-skill-specialization");
			}
		}
	}

	/**
	 * Post-process a creation operation for a single Document instance.
	 * Post-operation events occur for all connected clients.
	 *
	 * @param  {object} data       The initial data object provided to the document creation request
	 * @param  {object} options    Additional options which modify the creation request
	 * @param  {string} userId     The id of the User requesting the document update
	 * @return {void}
	 * @access protected
	 */
	_onCreate(data, options, userId) {
		this.#processNewUpdate(data, options);
		super._onCreate(data, options, userId);
	}

	/**
	 * Post-process an update operation for a single Document instance.
	 * Post-operation events occur for all connected clients.
	 *
	 * @param  {object} changed    The differential data that was changed relative to the documents prior values
	 * @param  {object} options    Additional options which modify the update request
	 * @param  {string} userId     The id of the User requesting the document update
	 * @return {void}
	 * @access protected
	 */
	_onUpdate(changed, options, userId) {
		this.#processNewUpdate(changed, options);
		super._onUpdate(changed, options, userId);
	}

	/**
	 * After a create or update successfully transpires, execute any
	 * post-operation changes that need to be made.
	 *
	 * @param  {object}         data       The initial or differential data from the request
	 * @param  {object}         options    Additional options modifying the request
	 * @return {void}
	 * @throws {ReferenceError}            When the Skill doesn't exist on the Actor
	 * @access private
	 */
	#processNewUpdate(data, options) {
		// A lot of these will want to know about the parent Actor, or
		// if one isn't (yet) assigned.
		const actor = this.parent;

		// When a specialization is created, associate it with its skill
		if (options.action == 'create' && data.type == 'specialization') {
			const skill = game.actors.get(actor.id).getEmbeddedDocument("Item", data.system.skill);
			if (!skill) {
				throw new ReferenceError("tribe8.errors.skill-not-exist");
			}
			skill.update({'system.specializations': [...skill.system.specializations, this.id]});
		}
		// When a skill is updated, audit its specializations
		if (options.action == 'update' && data.type == 'skill') {
			const skillSpecs = this.system.specializations;
			const actorSpecs = actor.getItems({type: 'specialization'});
			for (let s = 0; s < skillSpecs.length; s++) {
				const spec = skillSpecs[s];

				// Actor has *no* specializations?
				if (actorSpecs.length == 0) {
					skillSpecs.splice(spec, 1);
				}

				// Actor doesn't have *this* specialization?
				if (!actorSpecs.some(c => c.id == spec.id)) {
					skillSpecs.splice(spec, 1);
				}
			}
			// Fire off another update with the updated specializations
			this.update({'system.==specializations': [...skillSpecs]});
		}
	}

	/**
	 * Post-process a deletion operation for a single Document instance.
	 * Post-operation events occur for all connected clients.
	 *
	 * @param  {object} options    Additional options which modify the deletion request
	 * @param  {string} userId     The id of the User requesting the document update
	 * @return {void}
	 * @access protected
	 */
	_onDelete(options, userId) {
		super._onDelete(options, userId);

		// A lot of these will want to know about the parent Actor, or
		// if one isn't (yet) assigned.
		const actor = this.parent;

		// When a specializations is deleted from an actor, also delete
		// it from the skill listing it.
		if (actor && this.type == 'specialization') {
			const skill = actor.getEmbeddedDocument("Item", this.system.skill);
			if (!skill) return;
			const skillSpecializations = [...skill.system.specializations];
			const specIdx = skillSpecializations.indexOf(this.id);
			if (specIdx < 0) return;
			skillSpecializations.splice(specIdx, 1);
			skill.update({'system.==specializations': skillSpecializations});
		}

		// When a Skill is deleted, check to see if there are any
		// attached Specializations that should also be deleted
		if (actor && this.type == 'skill') {
			const specs = actor.getItems({type: 'specialization'}).filter((s) => s.system.skill == this.id);
			if (specs.length) {
				this.actor.deleteEmbeddedDocuments("Item", specs.map((s) => s.id));
			}
		}
	}

	/**
	 * Return the default artwork for the given item type
	 *
	 * @param  {object} itemData    Data object that includes item type
	 * @return {object}             An object with a single key pointing to the default artwork path
	 * @access public
	 */
	static getDefaultArtwork(itemData) {
		const {type} = itemData;
		if (type === 'skill')
			return {img: "systems/tribe8/icons/skill.svg"};
		if (type === 'perk')
			return {img: "systems/tribe8/icons/perk.svg"};
		if (type === 'flaw')
			return {img: "systems/tribe8/icons/flaw.svg"};
		if (type === 'maneuver')
			return {img: "systems/tribe8/icons/maneuver.svg"};
		return super.getDefaultArtwork(itemData);
	}

	/**
	 * Item sort comparison meta-function
	 *
	 * @param  {Tribe8Item} a    The first comparison item
	 * @param  {Tribe8Item} b    The second comparison item
	 * @return {int}             The result of the comparison
	 * @access public
	 */
	static cmp(a, b) {
		if (a.type === 'skill')
			return Tribe8Item.#cmpSkill(a, b);
		if (a.type === 'perk' || a.type === 'flaw')
			return Tribe8Item.#cmpPerkFlaw(a, b);
		if (a.type === 'maneuver')
			return Tribe8Item.#cmpManeuver(a, b);
		if (a.type === 'aspect')
			return Tribe8Item.#cmpAspect(a, b);
		if (a.type === 'eminence')
			return Tribe8Item.#cmpEminence(a, b);
		if (a.type === 'totem')
			return Tribe8Item.#cmpTotem(a, b);
		if (a.type === 'weapon' && b.type === 'weapon')
			return Tribe8Item.#cmpWeapon(a, b);
		if (a.type === 'armor' && b.type === 'armor')
			return Tribe8Item.#cmpArmor(a, b);
		// Special case for all physical item types, which can sort
		const canSortGear = (a.isPhysicalItem && b.isPhysicalItem);
		if (canSortGear) return Tribe8Item.#cmpGear(a, b);
		// General-purpose fallback
		return Tribe8Item.#cmpFallback(a, b);
	}

	/**
	 * Fallback sort, if other sorting attempts have resulted equal
	 *
	 * @param  {Tribe8Item} a    The first comparison item
	 * @param  {Tribe8Item} b    The second comparison item
	 * @return {int}             The result of the comparison
	 * @throws {Error}           When the Item types mismatch
	 * @access private
	 */
	static #cmpFallback(a, b) {
		if (a.type != b.type)
			throw new Error("Cannot compare items of different types");
		if (a.name < b.name) return -1;
		if (a.name > b.name) return 1;
		if (a._stats.createdTime < b._stats.createdTime) return -1;
		if (a._stats.createdTime > b._stats.createdTime) return 1;
		return 0;
	}

	/**
	 * Sort for Skills
	 *
	 * @param  {Tribe8Item} a    The first comparison item
	 * @param  {Tribe8Item} b    The second comparison item
	 * @return {int}             The result of the comparison
	 * @throws {Error}           When the Item types mismatch
	 * @access private
	 */
	static #cmpSkill(a, b) {
		if (a.type != 'skill' || b.type != 'skill')
			throw new Error("Cannot use Skill comparison function to sort non-Skill items");

		if (a.system.level > b.system.level) return -1;
		if (a.system.level < b.system.level) return 1;

		if (a.system.cpx > b.system.cpx) return -1;
		if (a.system.cpx < b.system.cpx) return 1;

		return Tribe8Item.#cmpFallback(a, b);
	}

	/**
	 * Sort for Perks and Flaws
	 *
	 * @param  {Tribe8Item} a    The first comparison item
	 * @param  {Tribe8Item} b    The second comparison item
	 * @return {int}             The result of the comparison
	 * @throws {Error}           When the Item types mismatch
	 * @access private
	 */
	static #cmpPerkFlaw(a, b) {
		if ((a.type != 'perk' && a.type != 'flaw') || (b.type != 'perk' && b.type != 'flaw'))
			throw new Error("Cannot use Perk/Flaw comparison function to sort non-Perk/Flaw items");

		if (a.type == 'perk' && b.type == 'flaw') return -1;
		if (a.type == 'flaw' && b.type == 'perk') return 1;

		if (a.system.granted && !b.system.granted) return -1;
		if (!a.system.granted && b.system.granted)return 1;

		// Fallback does this too, but we want it to come before Ranks
		if (a.name < b.name) return -1;
		if (a.name > b.name) return 1;

		if (a.system.points.length > b.system.points.length) return -1;
		if (a.system.points.length < b.system.points.length) return 1;

		return Tribe8Item.#cmpFallback(a, b);
	}

	/**
	 * Sort for Maneuvers
	 *
	 * @param  {Tribe8Item} a    The first comparison item
	 * @param  {Tribe8Item} b    The second comparison item
	 * @return {int}             The result of the comparison
	 * @throws {Error}           When the Item types mismatch
	 * @access private
	 */
	static #cmpManeuver(a, b) {
		if (a.type != 'maneuver' || b.type != 'maneuver')
			throw new Error("Cannot use Maneuver comparison function to sort non-Maneuver items");

		// If the skills don't match, we need to first consult their sorting algorithm
		if (a.system.category != b.system.category)
		{
			const combatSkills = a.parent?.getSkills({combat: true}) || {};

			// Identify the relevant skills to our a and b
			// TODO: (Future) Right now, this only uses the first matching Skill from each category.
			// In most cases, there *is* only one, but Ranged throws a monkey wrench in that.
			const aSkill = (combatSkills[a.system.category] || [])[0];
			const bSkill = (combatSkills[b.system.category] || [])[0];
			if (aSkill && !bSkill) return -1;
			if (!aSkill && bSkill) return 1;
			if (aSkill && bSkill) {
				let skillCmp;
				if ((skillCmp = Tribe8Item.cmp(aSkill, bSkill)) != 0)
					return skillCmp;
			}
		}

		// If the skills match, *now* we can sort our maneuvers
		if (a.system.granted && !b.system.granted) return -1;
		if (!a.system.granted && b.system.granted) return 1;
		if (a.system.fromCpx || b.system.fromCpx) {
			let aFromCpx = a.system.fromCpx;
			let bFromCpx = b.system.fromCpx;
			if (aFromCpx && a.usesPoints)
				aFromCpx = false;
			if (bFromCpx && b.usesPoints)
				bFromCpx = false;
			if (aFromCpx && !bFromCpx) return -1;
			if (!aFromCpx && bFromCpx) return 1;
		}
		if (a.system.complexity > b.system.complexity) return -1;
		if (a.system.complexity < b.system.complexity) return 1;
		return Tribe8Item.#cmpFallback(a, b);
	}

	/**
	 * Sort for Eminences
	 *
	 * @param  {Tribe8Item} a    The first comparison item
	 * @param  {Tribe8Item} b    The second comparison item
	 * @return {int}             The result of the comparison
	 * @throws {Error}           When the Item types mismatch
	 * @access private
	 */
	static #cmpEminence(a, b) {
		if (a.type != 'eminence' || b.type != 'eminence')
			throw new Error("Cannot use Eminence comparison function to sort non-Eminence items");
		if (!a.system.used && b.system.used) return -1;
		if (a.system.used && !b.system.used) return 1;
		return Tribe8Item.#cmpFallback(a, b);
	}

	/**
	 * Sort for Aspects
	 *
	 * @param  {Tribe8Item} a    The first comparison item
	 * @param  {Tribe8Item} b    The second comparison item
	 * @return {int}             The result of the comparison
	 * @throws {Error}           When the Item types mismatch
	 * @access private
	 */
	static #cmpAspect(a, b) {
		if (a.type != 'aspect' || b.type != 'aspect')
			throw new Error("Cannot use Aspect comparison function to sort non-Aspect items");
		// TBD if we want to change this up at all
		return Tribe8Item.#cmpFallback(a, b);
	}

	/**
	 * Sort for Totems
	 *
	 * @param  {Tribe8Item} a    The first comparison item
	 * @param  {Tribe8Item} b    The second comparison item
	 * @return {int}             The result of the comparison
	 * @throws {Error}           When the Item types mismatch
	 * @access private
	 */
	static #cmpTotem(a, b) {
		if (a.type != 'totem' || b.type != 'totem')
			throw new Error("Cannot use Totem comparison function to sort non-Totem items");
		if (a.system.granted && !b.system.granted) return -1;
		if (!a.system.granted && b.system.granted) return 1;
		if (a.system.fromCpx || b.system.fromCpx) {
			let aFromCpx = a.system.fromCpx;
			let bFromCpx = b.system.fromCpx;
			if (aFromCpx && a.usesPoints)
				aFromCpx = false;
			if (bFromCpx && b.usesPoints)
				bFromCpx = false;
			if (aFromCpx && !bFromCpx) return -1;
			if (!aFromCpx && bFromCpx) return 1;
		}
		return Tribe8Item.#cmpFallback(a, b);
	}

	/**
	 * Sort for Gear
	 *
	 * @param  {Tribe8Item} a    The first comparison item
	 * @param  {Tribe8Item} b    The second comparison item
	 * @return {int}             The result of the comparison
	 * @throws {Error}           When the Item types mismatch
	 * @access private
	 */
	static #cmpGear(a, b) {
		const validGearTypes = ['gear', 'weapon', 'armor'];
		if (validGearTypes.indexOf(a.type) < 0 || validGearTypes.indexOf(b.type) < 0)
			throw new Error("Cannot use Gear comparison function to sort non-Gear items");

		// Is one of these items the container for the other?
		if (a.system.storage == b.id) return 1;
		if (a.id == b.system.storage) return -1;

		// Make sure we're dealing with matching types
		a.system.storage = a.system.storage ? a.system.storage : undefined;
		b.system.storage = b.system.storage ? b.system.storage : undefined;
		// Do these items have different storage?
		if (a.system.storage != b.system.storage) {
			// Trace the path to the parent actor through each item, then
			// Flip it around so it's actor-first
			const aPath = this.#pathToActor(a).reverse();
			const bPath = this.#pathToActor(b).reverse();

			// Find the common ancestor
			let spliceCount = 1;
			for (let i = 0; i < aPath.length && i < bPath.length; i++) {
				if (aPath[i] != bPath[i]) {
					spliceCount = i;
					break;
				}
			}

			// Chop out the path elements up to the common step.
			const actor = a.parent;
			aPath.splice(0, spliceCount);
			bPath.splice(0, spliceCount);
			const aCmp = (aPath[0] == a.id ? a : actor.getEmbeddedDocument("Item", aPath[0]));
			const bCmp = (bPath[0] == b.id ? b : actor.getEmbeddedDocument("Item", bPath[0]));
			return this.#cmpGear(aCmp, bCmp);
		}

		// Same storage, so just sort within tier
		return Tribe8Item.#cmpFallback(a, b);
	}

	/**
	 * Trace a path back to the parent Actor for the given Item
	 *
	 * @param  {Tribe8Item}     item    The Item we're tracing back to the Actor
	 * @return {Array<string>}          List of Item IDs going back to the Actor.
	 *                                  The final entry is always the Actor id
	 * @throws {TypeError}              If the provided Item is not a physical item type.
	 * @throws {ReferenceError}         If the provided Item is not in the Actor's embedded documents
	 * @access private
	 */
	static #pathToActor(item) {
		if (!item.isPhysicalItem) {
			throw new TypeError("Cannot trace path to Actor for non-physical Item types");
		}
		if (item.system.storage == item.id) { // Break this, if something goofy happened
			if (!item.fixingStorageRecursion) {
				item.fixingStorageRecursion = true;
				item.update({'system.==storage': null}, {diff: false});
				console.error(`Item.${item.id} listed itself as storage, which would lead to infinite recursion. This link has been broken.`);
			}
			return [item.id, item.parent.id];
		}
		let path = [item.id];
		if (item.system.storage) {
			const storageItem = item.parent.getEmbeddedDocument("Item", item.system.storage);
			if (!storageItem) {
				throw new ReferenceError("Indicated storage Item did not exist on the Actor!");
			}
			return path.concat(this.#pathToActor(storageItem));
		}
		// No storage item, so return the actor
		path.push(item.parent.id);
		return path;
	}

	/**
	 * Sort for IWeapons, which just wraps the Gear sort
	 *
	 * @param  {Tribe8Item} a    The first comparison item
	 * @param  {Tribe8Item} b    The second comparison item
	 * @return {int}             The result of the comparison
	 * @throws {Error}           When the Item types mismatch
	 * @access private
	 */
	static #cmpWeapon(a, b) {
		if (a.type != 'weapon' || b.type != 'weapon')
			throw new Error("Cannot use Weapon comparison function to sort non-Weapon items");
		return this.#cmpGear(a, b);
	}

	/**
	 * Sort for Armor, which just wraps the Gear sort
	 *
	 * @param  {Tribe8Item} a    The first comparison item
	 * @param  {Tribe8Item} b    The second comparison item
	 * @return {int}             The result of the comparison
	 * @throws {Error}           When the Item types mismatch
	 * @access private
	 */
	static #cmpArmor(a, b) {
		if (a.type != 'armor' || b.type != 'armor')
			throw new Error("Cannot use Armor comparison function to sort non-Armor items");
		return this.#cmpGear(a, b);
	}

	/**
	 * Handle proper Skill and Perk/Flaw naming, accounting for special
	 * sub-identifiers
	 *
	 * @param  {string} [name='']          The top-level Item name
	 * @param  {string} [sysName='']       The name on the system object of the Item, if any
	 * @param  {string} [specific='']      The subtype ("specific") sub-identifier on the system object of the Item, if any
	 * @param  {bool}   [specify=false]    Whether or not the toggle was enabled to include a sub-identifier
	 * @return {object}                    An object containing the derived identification data, in {name: {string}, system: {name: {string}, specific: {string}}} format
	 * @throws {Error}                     If we go through the whole process and end up with an empty name
	 * @access private
	 */
	static #canonizeName(name = '', sysName = '', specific = '', specify = false) {
		// Setup our storage object
		const canonName = {name: '', system: { name: '', specific: ''}};

		// If we had a document name and no system name, apply the document name to the system name
		if ((!sysName || sysName.length == 0) && (name && name.length > 0)) {
			canonName.system.name = name.split('(')[0].trim();
		}
		// If we did have a system name, set it to the system name
		else if (sysName && sysName.trim().length > 0) {
			canonName.system.name = sysName;
		}
		// If we didn't have either...give it a placeholder name?
		else {
			canonName.name = "Broken Skill";
			canonName.system.name = `${canonName.name}`;
			console.warn("Cannot determine system base name for Item, so giving it a dummy name");
		}
		// Did we indicate that this Item uses a specification/category?
		// Note that we may not have checked the checkbox, but the item might still have had one in its data, so we check both
		if (specify || specific) {
			// If the value given to us was empty...
			if (!specific || specific.length == 0) {
				// ...see if we can split something off of the document name
				canonName.system.specific = name.split(/[()]/g)?.filter(n => n)?.slice(1)?.join(' ')?.trim();

				// If we didn't find anything, give it a stand-in name if we definitively indicated that we want a specifier
				if (!canonName.system.specific && specify)
					canonName.system.specific = 'Unspecified';
			}
			// If it wasn't, just use it.
			else {
				canonName.system.specific = specific;
			}
		}
		// Compose the document name from the now-defined parts
		canonName.name = `${canonName.system.name}`;
		if (specify)
			canonName.name = `${canonName.name} (${canonName.system.specific})`;

		// If we get this far and have a zero-length name, bail out
		if (!canonName.name || canonName.length == 0)
			throw new Error("Should never generate a name of no value");

		// Return the assembled name data
		return canonName;
	}

	/**
	 * Handle any document-level migration hacks we need to do
	 *
	 * @param  {object} data    The supplied data migration object
	 * @return {object}         The transformed migration data
	 * @access public
	 */
	static migrateData(data) {
		if (data.type == 'skill') this.#migrateSpecializations(data);
		this.#migrateNames(data);

		// Invoke the system migration, too
		if (data.system && data.type) {
			const ourModel = (CONFIG.Item?.dataModels || {})[data.type];
			if (ourModel) {
				data.system = ourModel.migrateData(data.system);
			}
		}
		return super.migrateData(data);
	}

	/**
	 * Store legacy object Specializations from Skills to the Skill's
	 * flags, for later regeneration as proper Embedded Items
	 *
	 * @param {object} data    The supplied data migration object
	 * @access private
	 */
	static #migrateSpecializations(data) {
		/**
		 * If the specializations property has an Object constructor
		 * (as opposed to an Array constructor, as is the case with
		 * ArrayField), good bet it's the old-style.
		 */
		if (data?.system?.specializations && data.system.specializations.constructor?.name === 'Object' && Object.keys(data.system.specializations).length) {
			// Save the data as a flag instead, directly on the supplied data
			if (!data.flags) data.flags = {};
			if (!data.flags['tribe8']) data.flags['tribe8'] = {};
			try {
				// deepClone can't handle advanced data fields, hence the try/catch, just incase
				data.flags['tribe8']['legacy-specializations'] = foundry.utils.deepClone(data.system.specializations, {strict: true});

				// Having safely stashed it, nuke it from the migration data
				delete data.system.specializations;

				// If it didn't work for some reason, raise a ruckus
				if (!Object.keys(data.flags['tribe8']['legacy-specializations']).length)
					throw new Error("Failed to migrate specialization data");
			}
			catch {
				// No need to report anything
			}
		}
	}

	/**
	 * Align certain Items' names, system names, and system sub-names
	 * for consistency.
	 *
	 * @param {object} data    The supplied data migration object
	 * @access private
	 */
	static #migrateNames(data) {
		// If we don't have ANY name data, assume this is a different sort of update and leave it alone
		if (!data.name && !data.system?.name && !data.system?.specific)
			return;
		const {
			name: canonName,
			system: {
				name: canonSystemName,
				specific: canonSpecificName
			}
		} = this.#canonizeName(data.name, data.system?.name, data.system?.specific, data.system?.specify);
		data.name = canonName;

		// Only correct data.system if the data package included it
		if (data.system) {
			if (canonSystemName) {
				if (!data.system.name || data.system.name != canonSystemName)
					data.system.name = canonSystemName;
			}
			if (canonSpecificName) {
				if (!data.system.specific || data.system.specific != canonSpecificName)
					data.system.specific = canonSpecificName;
			}
		}
	}

	/**
	 * Create Specialization Items and add them to the Item's parent
	 * Actor, if applicable, if they were originally created in the
	 * basic object format.
	 *
	 * This should not be called until after the game setup completes
	 *
	 * @access public
	 */
	async zShimCreateSpecializationsFromLegacy() {
		const source = this.getFlag('tribe8', 'legacy-specializations');
		// Probably nothing to do
		if (!source || !Object.keys(source).length)
			return;

		try {
			if (this.parent && this.parent instanceof Tribe8Actor) {
				// What specializations do we already have for this current item?
				const currSpecs = Array.from(this.parent.getEmbeddedCollection("Item")).filter((i) => i.type == 'specialization');
				const specsToCreate = [];
				for (let key of Object.keys(source)) {
					const oldSpec = source[key];
					const oldSpecNameSlug = CONFIG.Tribe8.slugify(oldSpec.name);
					// Do we have any specializations that match?
					if (currSpecs.map((s) => CONFIG.Tribe8.slugify(s.name)).indexOf(oldSpecNameSlug) > -1) {
						// console.log(`A '${oldSpec.name}' Specialization already exists for the ${this.name} Skill`);
						continue;
					}
					// Are we already creating this?
					if (specsToCreate.map((s) => CONFIG.Tribe8.slugify(s.name)).indexOf(oldSpecNameSlug) > -1) {
						// console.log(`A '${oldSpec.name}' Specialization is already going to be created for the ${this.name} Skill`);
						continue;
					}
					specsToCreate.push({type: 'specialization', name: oldSpec.name, system: {points: oldSpec.points.toUpperCase(), skill: this.id}});
				}
				if (specsToCreate.length) {
					const newSpecs = await this.parent.createEmbeddedDocuments("Item", specsToCreate);
					await this.update({'system.specializations': newSpecs.map((n) => n.id)});
				}
			}
		}
		catch (error) {
			console.error(error);
			return;
		}

		// Clear the flag
		await this.setFlag('tribe8', 'legacy-specializations', 1); // Override the object first
		await this.unsetFlag('tribe8', 'legacy-specializations'); // Now clear it out
	}
}