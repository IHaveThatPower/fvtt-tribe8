const { Actor } = foundry.documents;

export class Tribe8Actor extends Actor {
	/**
	 * Align Specialization and Skill items
	 *
	 * @access public
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
	 * @access public
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
	 * Get a list of this character's Skills. Several options can be
	 * supplied to adjust the output and filter the Skill list.
	 *
	 * When searching for a specific Skill, an array will be returned,
	 * even if it only has one Skill in it. When searching for types of
	 * Skills (e.g. those for combat), an object with properties
	 * corresponding to the Combat Skill groups will be returned.
	 *
	 * Options include:
	 * ```
	 * - {bool} combat           return only combat skills)
	 * - {Array<string>} search  return skills matching a provided name or set of names
	 * ```
	 *
	 * If no options are provided, all Skills are returned
	 *
	 * @param  {object}                   [options]    Options that can be used to adjust search parameters and output
	 * @return {Array<Tribe8Item>|object}              Exact return type depends on options chosen
	 * @access public
	 */
	getSkills(options = {}) {
		const allSkills = Array.from(this.getEmbeddedCollection("Item")).filter(i => i.type == 'skill');
		if (Object.keys(options).length == 0)
			return allSkills;

		// Otherwise, subset
		let returnSkills = [];

		// Search?
		if (options.search && options.search instanceof Array) {
			for (let searchTerm of options.search) {
				searchTerm = CONFIG.Tribe8.slugify(searchTerm);
				const foundSkills = allSkills.filter(s => CONFIG.Tribe8.slugify(s.system.name) == searchTerm || CONFIG.Tribe8.slugify(s.name) == searchTerm);
				if (foundSkills.length) {
					returnSkills = returnSkills.concat(foundSkills);
				}
			}
		}

		// Combat?
		if (options.combat) {
			returnSkills = this.#getCombatSkills(returnSkills.length ? returnSkills : allSkills);
		}

		return returnSkills;
	}

	/**
	 * Get a list of this character's Skills that can be used to make
	 * attacks in combat.
	 *
	 * @param  {Array<Tribe8Item>} skills    This Actor's full Skill list
	 * @return {object}                      An object containing all of the valid combat skills possessed by this Actor
	 * @access private
	 */
	#getCombatSkills(skills) {
		// Define the default names of the combat Skills, based on config
		const combatSkillNames = Object.values(CONFIG.Tribe8.COMBAT_SKILLS).map((s) => CONFIG.Tribe8.slugify(s));

		// Filter the skill list to just those that qualify
		skills = skills.filter((i) => {
			if (i.type != 'skill') return false;
			let lookupName = CONFIG.Tribe8.slugify(i.system.name);
			// Special case Hand to Hand checks
			if (CONFIG.Tribe8.HAND_TO_HAND_VARIATIONS.indexOf(lookupName) >= 0)
				lookupName = 'handtohand';
			// Special case Ranged checks
			else if (CONFIG.Tribe8.RANGED_COMBAT_SKILL_REFERENCE.indexOf(lookupName) >= 0)
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
				combatSkills[k] = combatSkills[k].sort(combatSkills[k][0].constructor.cmp);
			}
		}
		return combatSkills;
	}

	/**
	 * Compute a differential model of system data used to initialize
	 * this Actor, that data after the Character model has run
	 * migrateData() on it, then store it as flag data to be used for
	 * true migration in the setup Hook
	 *
	 * @param  {object} data    Object containing data fed in for migration
	 * @return {object}         Mutated data object for migration
	 * @access public
	 * @see    ../tribe8.js
	 */
	static migrateData(data) {
		if (data.system && data.type) {
			const ourModel = (CONFIG.Actor?.dataModels || {})[data.type];
			if (ourModel) {
				const migratedSystem = ourModel.migrateData(data.system);

				if (!data.flags) data.flags = {};
				if (!data.flags.tribe8) data.flags.tribe8 = {};
				console.log(`Migration required for Actor.${data._id}`);
				data.flags.tribe8.migrateSystemData = foundry.utils.deepClone(migratedSystem);
			}
		}
		return super.migrateData(data);
	}

	/**
	 * Updates system properties based on those saved to the Actor's
	 * flags by migrateData(), above.
	 *
	 * @access public
	 */
	async migrateSystemData() {
		const systemMigrateFlags = this.getFlag('tribe8', 'migrateSystemData');
		if (!systemMigrateFlags)
			return;
		if (!(systemMigrateFlags instanceof Object)) { // !Object.keys(systemMigrateFlags || {}).length)
			console.log("Migrate flags wasn't an object; what was it?", foundry.utils.deepClone(systemMigrateFlags));
			return;
		}
		if (!(Object.keys(systemMigrateFlags).length)) {
			await this.unsetFlag('tribe8', 'migrateSystemData');
			return;
		}

		console.log(`Beginning Migration for Actor.${this.id}`);
		await this.update({'==system': systemMigrateFlags}, {diff: false});

		// Replace the object with a single value, since unsetFlag
		// seems to stumble on that.
		await this.setFlag('tribe8', 'migrateSystemData', 1);

		// Now clear the flag entirely.
		await this.unsetFlag('tribe8', 'migrateSystemData');
		console.log(`Successfully migrated Actor.${this.id}`);
	}

	/**
	 * Converts legacy specializations backed up on Item flags into
	 * actual Specialization documents associated with the proper
	 * Skill
	 *
	 * @access public
	 */
	async createSpecializationsFromLegacy() {
		const skills = this.getSkills().filter(s => s.getFlag('tribe8', 'legacy-specializations'));
		for (let skill of skills) {
			await skill.createSpecializationsFromLegacy();
		}
	}
}