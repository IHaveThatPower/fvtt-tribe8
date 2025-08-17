const { Actor } = foundry.documents;
import { Tribe8Item } from './item.js'; // For sorting

export class Tribe8Actor extends Actor {
	/**
	 * Compute a differential model of system data used to initialize
	 * this Actor, that data after the Character model has run
	 * migrateData() on it, then store it as flag data to be used for
	 * true migration in the setup Hook
	 *
	 * @param  {object} data    Object containing data fed in for migration
	 * @return {object}         Mutated data object for migration
	 * @see    ../tribe8.js
	 */
	static migrateData(data) {
		if (data.system && data.type) {
			const ourModel = (CONFIG.Actor?.dataModels || {})[data.type];
			if (ourModel) {
				console.log(`Beginning Migration for Actor.${data._id}`);
				const originalSystemData = foundry.utils.deepClone(data.system);
				const migratedSystem = ourModel.migrateData(data.system);
				let mutatedSystem = foundry.utils.deepClone(ourModel.migrateData(migratedSystem));
				// TODO: This is _almost_ the same thing that
				// Tribe8ChracterModel.recursivelyFixLabelsAndNames()
				// does...possible unification?
				const migrateReport = {
					'keysDeleted': 0,
					'keysInitial': Object.keys(mutatedSystem).length,
					'recursion': {}
				};

				/**
				 * Recursive function that determines what pieces of
				 * data to preserve for flagging, and which would be
				 * redundant.
				 *
				 * @param  {object} mData
				 * @param  {object} systemData
				 * @param  {object} originalData
				 * @param  {int}    depth
				 * @return {object}
				 */
				mutatedSystem = (function flag(mData, systemData, originalData, depth) {
					let newDataObject = {};
					if (mData.constructor.name !== 'Object') {
						console.warn("Attempted to generate a set of migration flags for a non-object");
						return mData;
					}
					for (let key of Object.keys(mData)) {
						// Objects are where we actually need recursion
						if (mData[key].constructor.name === 'Object') {
							// Initialize a new entry in our return object
							newDataObject[key] = {};
							migrateReport.recursion[depth+1] = {'keysDeleted': 0, 'keysInitial': Object.keys(mData[key]).length};

							// Recursive call!
							newDataObject[key] = flag(mData[key], systemData[key] ?? {}, originalData[key] ?? {}, depth + 1);

							// Post-recursion analysis
							// If the resulting object is now empty, delete it
							if (Object.keys(newDataObject[key] || {}).length === 0 && Object.keys(systemData[key] || {}).length != 0) {
								// If the property exists on the prototype, delete it first, or it'll just come right back
								if (newDataObject.prototype && newDataObject.prototype[key])
									delete newDataObject.prototype[key];
								// Now delete the property itself
								delete newDataObject[key];
								if (Object.hasOwn(newDataObject, key)) console.error("Property still set after destructuring!");
								if (depth == 0) migrateReport.keysDeleted++;
							}
						}
						// Arrays we don't mess with; we just don't clone them
						else if (mData.constructor.name === 'Array') {
							console.log(`Ignoring Array field ${key}`);
							if (depth === 0) migrateReport.keysDeleted++;
							else migrateReport.recursion[depth].keysDeleted++
						}
						// Here's where we really change stuff
						else {
							/**
							 * If the data's the same, we don't
							 * need to flag it for migration
							 */
							if (systemData[key] === originalData[key]) {
								if (depth === 0) migrateReport.keysDeleted++;
								else migrateReport.recursion[depth].keysDeleted++;
							}
							else {
								newDataObject[key] = systemData[key];
							}
						}
					}
					// if (depth != 0) console.log(migrateReport.recursion[depth]);
					return newDataObject;
				})(mutatedSystem, migratedSystem, originalSystemData, 0);
				if (migrateReport.keysDeleted == 0 || migrateReport.keysInitial == Object.keys(mutatedSystem).length) {
					console.warn(`We destructured ${migrateReport.keysDeleted} keys, but the initial key count was ${migrateReport.keysInitial} and the current count is ${Object.keys(mutatedSystem).length}`);
				}
				if (Object.keys(mutatedSystem).length > 0) {
					// Now store what we just computed as flags.
					if (!data.flags) data.flags = {};
					if (!data.flags.tribe8) data.flags.tribe8 = {};
					data.flags.tribe8.migrateSystemData = mutatedSystem;
				}
			}
		}
		return super.migrateData(data);
	}

	/**
	 * Updates system properties based on those saved to the Actor's
	 * flags by migrateData(), above.
	 */
	async migrateSystemData() {
		const systemMigrateFlags = this.getFlag('tribe8', 'migrateSystemData');
		if (!systemMigrateFlags || !Object.keys(systemMigrateFlags || {}).length)
			return;
		// Dive down into each property to construct an update() path
		const that = this;
		let encounteredErrors = false;
		await (async function descend(path, value) {
			// If we hit a non-object, we've got a thing to set
			if (value.constructor.name !== 'Object') {
				return await that.update({path: value});
			}
			// If we've got an object, time to dive in...
			for (let key of Object.keys(value)) {
				const newPath = `${path}.${key}`;
				// Sanity check
				if (newPath.length > 255) {
					console.error(`Flag update path exceeded 255 characters, breaking at ${newPath}`);
					break;
				}
				const result = descend(`${newPath}`, value[key]);
				if (!result) {
					console.warn(`Unsuccessful recursion when updating ${newPath}`);
					encounteredErrors = true;
				}
			}
		})('system', systemMigrateFlags);
		if (!encounteredErrors) {
			this.unsetFlag('tribe8', 'migrateSystemData');
		}
	}

	/**
	 * Converts legacy specializations backed up on Item flags into
	 * actual Specialization documents associated with the proper
	 * Skill
	 */
	async createSpecializationsFromLegacy() {
		const skills = Array.from(this.getEmbeddedCollection("Item")).filter((i) => (i.type == 'skill' && i.getFlag('tribe8', 'legacy-specializations')));
		for (let skill of skills) {
			await skill.createSpecializationsFromLegacy();
		}
	}

	/**
	 * Align Specialization and Skill items
	 */
	async alignSkillsAndSpecializations() {
		const items = Array.from(this.getEmbeddedCollection("Item"));
		const skills = items.filter((s) => s.type == 'skill');
		const specializations = items.filter((s) => s.type == 'specialization');

		// Specializations first
		const removeSpecs = [];
		for (let spec of specializations) {
			// Make sure the Specialization's Skill exists on the Actor
			const skillItems = skills.filter((s) => s.id == spec.system.skill);
			if (!skillItems.length) {
				console.warn(`Actor.${this.id}.Specialization.${spec.id} lists Skill.${spec.system.skill}, but no matching Skill was found on the Actor`);
				removeSpecs.push(spec.id);
				continue;
			}
			// Make sure the Skill lists the Specialization
			const specSkill = skillItems[0];
			if (specSkill.system.specializations.indexOf(spec.id) < 0) {
				console.warn(`Actor.${this.id}.Skill.${specSkill.id} does not list Specialization.${spec.id}, but the Specialization lists Skill.${spec.system.skill}. Updating.`);
				await specSkill.update({'system.specializations': [...specSkill.system.specializations, spec.id]});
			}
		}

		// Skills second
		for (let skill of skills) {
			if (skill.system.specializations.length) {
				for (let specId of skill.system.specializations) {
					// Make sure the listed Specialization exists on the Actor
					const specItems = specializations.filter((s) => s.id == specId);
					if (!specItems.length) {
						console.warn(`Specialization.${specId} not found on Actor.${skill.parent.id}.Skill${skill.id}. Removing from list.`);
						const removeIndex = skill.system.specializations.indexOf(specId);
						if (removeIndex >= 0) {
							await skill.update({'system.specializations': skill.system.specializations.splice(removeIndex, 1)});
						}
						continue;
					}

					// Make sure the Specialization's Skill matches the currently-evaluated Skill
					const expectedSkill = specItems[0].system['skill'];
					if (expectedSkill != skill.id) {
						console.warn(`Actor.${this.id}.Skill.${skill.id} lists Specialization.${specId}, but the Specialization lists Skill.${expectedSkill}. Updating the Specialization.`);
						await specItems[0].update({'system.skill': skill.id});
					}
				}
			}
		}

		// Nuke the errant Specializations
		if (removeSpecs.length) {
			// console.log(`Should remove the following specs from Actor ${this.id}'s ${skill.name} skill`, removeSpecs);
			await this.deleteEmbeddedDocuments("Item", removeSpecs);
		}
	}

	/**
	 * Utility function to determine which player (if any) owns this
	 * actor.
	 *
	 * @return {string|bool} A matching User ID, or false if no player owner was found
	 */
	getPlayerOwner() {
		if (!this.hasPlayerOwner)
			return false;

		const possibleOwners = Object.entries(this.ownership) // Get all ownership entries
								.filter(([id, level]) => (level == foundry.CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER && id != 'default')) // Get only true, non-default owners
								.map(([id]) => id) // Drop the level, now that we're dealing only with owners
								.sort((a, b) => { // We assume the "older" owner is the primary one
									const aUser = game.users.get(a);
									const bUser = game.users.get(b);
									if (aUser?._stats?.createdTime < bUser?._stats?.createdTime)
										return -1;
									if (aUser?._stats?.createdTime > bUser?._stats?.createdTime)
										return 1;
									return 0;
								});
		// If we don't have any owners after all that
		if (!possibleOwners.length)
			return false;

		// Return the top-sorted owner found
		return game.users.get(possibleOwners[0]);
	}

	/**
	 * Get a list of this character's Skills that can be used to make
	 * attacks in combat.
	 *
	 * @return {object} An object containing all of the valid combat skills possessed by this Actor
	 */
	getCombatSkills() {
		// Define the default names of the combat Skills, based on config
		const combatSkillNames = Object.values(CONFIG.Tribe8.COMBAT_SKILLS).map((s) => CONFIG.Tribe8.slugify(s));

		// Gather all Skills from this character that might qualify
		const skills = Array.from(this.getEmbeddedCollection("Item")).filter((i) => {
			if (i.type != 'skill') return false;
			let lookupName = CONFIG.Tribe8.slugify(i.system.name);
			// Special case Hand to Hand checks
			if (CONFIG.Tribe8.HAND_TO_HAND_VARIATIONS.indexOf(lookupName) >= 0)
				lookupName = 'handtohand';
			// Special case Ranged checks
			if (CONFIG.Tribe8.RANGED_COMBAT_SKILL_REFERENCE.indexOf(lookupName) >= 0)
				lookupName = 'ranged';
			if (combatSkillNames.indexOf(lookupName) < 0) return false;
			return true;
		});

		/**
		 * Reduce that list down to an object that's keyed with the
		 * single-letter skill group as the property key, and the
		 * list of skills as the property value.
		 */
		const combatSkills = skills.reduce((obj, s) => {
			let referenceName = CONFIG.Tribe8.slugify(s.system.name);
			if (CONFIG.Tribe8.RANGED_COMBAT_SKILL_REFERENCE.indexOf(referenceName) >= 0)
				referenceName = 'ranged';
			const refKey = referenceName[0].toUpperCase();
			if (obj[refKey])
				obj[refKey].push(s);
			else
				obj[refKey] = [s];
			return obj;
		}, {});

		// If we had multiple valid skills for the reference key, sort them
		for (let k of Object.keys(combatSkills)) {
			if (combatSkills[k].length > 1) {
				combatSkills[k] = combatSkills[k].sort(Tribe8Item.cmp);
			}
		}
		return combatSkills;
	}
}