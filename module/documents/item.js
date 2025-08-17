const { Item } = foundry.documents;
import { Tribe8Actor } from './actor.js';

export class Tribe8Item extends Item {
	/**
	 * Create Specialization Items and add them to the Item's parent
	 * Actor, if applicable, if they were originally created in the
	 * basic object format.
	 *
	 * This should not be called until after the game setup completes
	 */
	async createSpecializationsFromLegacy() {
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

	/**
	 * Get the actor owner of this item, if there is one.
	 *
	 * @return {Actor|bool} Either the parent Tribe8Actor or false if none is found
	 */
	getActorOwner() {
		if (this.isEmbedded) {
			return this.parent;
		}
		return false;
	}

	/**
	 * Handle any document-level migration hacks we need to do
	 *
	 * @param  {object} data    The supplied data migration object
	 * @return {object}         The transformed migration data
	 */
	static migrateData(data) {
		if (data.type == 'skill') this.migrateSpecializations(data);
		this.migrateNames(data);

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
	 */
	static migrateSpecializations(data) {
		/**
		 * If the specializations property has an Object constructor
		 * (as opposed to an Array constructor, as is the case with
		 * ArrayField), good bet it's the old-style.
		 */
		if (data?.system?.specializations && data.system.specializations.constructor?.name === 'Object' && Object.keys(data.system.specializations).length) {
			if (!data.flags) data.flags = {};
			if (!data.flags['tribe8']) data.flags['tribe8'] = {};
			try {
				// Stash the data on a flag.
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
	 */
	static migrateNames(data) {
		// If we don't have ANY name data, assume this is a different sort of update and leave it alone
		if (!data.name && !data.system?.name && !data.system?.specific)
			return;
		const {
			name: canonName,
			system: {
				name: canonSystemName,
				specific: canonSpecificName
			}
		} = this.canonizeName(data.name, data.system?.name, data.system?.specific, data.system?.specify);
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
	 * Return the default artwork for the given item type
	 *
	 * @param  {object} itemData    Data object that includes item type
	 * @return {object}             An object with a single key pointing to the default artwork path
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
	 */
	static cmp(a, b) {
		if (a.type === 'skill')
			return Tribe8Item.cmpSkill(a, b);
		if (a.type === 'perk' || a.type === 'flaw')
			return Tribe8Item.cmpPerkFlaw(a, b);
		if (a.type === 'maneuver')
			return Tribe8Item.cmpManeuver(a, b);
		if (a.type === 'aspect')
			return Tribe8Item.cmpAspect(a, b);
		if (a.type === 'eminence')
			return Tribe8Item.cmpEminence(a, b);
		if (a.type === 'totem')
			return Tribe8Item.cmpTotem(a, b);
		return Tribe8Item.cmpFallback(a, b);
	}

	/**
	 * Fallback sort, if other sorting attempts have resulted equal
	 *
	 * @param  {Tribe8Item} a    The first comparison item
	 * @param  {Tribe8Item} b    The second comparison item
	 * @return {int}             The result of the comparison
	 * @throws {Error}           When the Item types mismatch
	 */
	static cmpFallback(a, b) {
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
	 */
	static cmpSkill(a, b) {
		if (a.type != 'skill' || b.type != 'skill')
			throw new Error("Cannot use Skill comparison function to sort non-Skill items");

		if (a.system.level > b.system.level) return -1;
		if (a.system.level < b.system.level) return 1;

		if (a.system.cpx > b.system.cpx) return -1;
		if (a.system.cpx < b.system.cpx) return 1;

		return Tribe8Item.cmpFallback(a, b);
	}

	/**
	 * Sort for Perks and Flaws
	 *
	 * @param  {Tribe8Item} a    The first comparison item
	 * @param  {Tribe8Item} b    The second comparison item
	 * @return {int}             The result of the comparison
	 * @throws {Error}           When the Item types mismatch
	 */
	static cmpPerkFlaw(a, b) {
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

		return Tribe8Item.cmpFallback(a, b);
	}

	/**
	 * Sort for Maneuvers
	 *
	 * @param  {Tribe8Item} a    The first comparison item
	 * @param  {Tribe8Item} b    The second comparison item
	 * @return {int}             The result of the comparison
	 * @throws {Error}           When the Item types mismatch
	 */
	static cmpManeuver(a, b) {
		if (a.type != 'maneuver' || b.type != 'maneuver')
			throw new Error("Cannot use Maneuver comparison function to sort non-Maneuver items");

		// If the skills don't match, we need to first consult their sorting algorithm
		if (a.system.forSkill != b.system.forSkill)
		{
			const combatSkills = a.parent?.getCombatSkills() || {};

			// Identify the relevant skills to our a and b
			const aSkill = (combatSkills[a.system.forSkill] || [])[0];
			const bSkill = (combatSkills[b.system.forSkill] || [])[0];
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
		return Tribe8Item.cmpFallback(a, b);
	}

	/**
	 * Sort for Eminences
	 *
	 * @param  {Tribe8Item} a    The first comparison item
	 * @param  {Tribe8Item} b    The second comparison item
	 * @return {int}             The result of the comparison
	 * @throws {Error}           When the Item types mismatch
	 */
	static cmpEminence(a, b) {
		if (a.type != 'eminence' || b.type != 'eminence')
			throw new Error("Cannot use Eminence comparison function to sort non-Eminence items");
		if (!a.system.used && b.system.used) return -1;
		if (a.system.used && !b.system.used) return 1;
		return Tribe8Item.cmpFallback(a, b);
	}

	/**
	 * Sort for Aspects
	 *
	 * @param  {Tribe8Item} a    The first comparison item
	 * @param  {Tribe8Item} b    The second comparison item
	 * @return {int}             The result of the comparison
	 * @throws {Error}           When the Item types mismatch
	 */
	static cmpAspect(a, b) {
		if (a.type != 'aspect' || b.type != 'aspect')
			throw new Error("Cannot use Aspect comparison function to sort non-Aspect items");
		// TBD if we want to change this up at all
		return Tribe8Item.cmpFallback(a, b);
	}

	/**
	 * Sort for Totems
	 *
	 * @param  {Tribe8Item} a    The first comparison item
	 * @param  {Tribe8Item} b    The second comparison item
	 * @return {int}             The result of the comparison
	 * @throws {Error}           When the Item types mismatch
	 */
	static cmpTotem(a, b) {
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
		return Tribe8Item.cmpFallback(a, b);
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
	 */
	static canonizeName(name = '', sysName = '', specific = '', specify = false) {
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
}