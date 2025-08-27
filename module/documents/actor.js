const { Actor } = foundry.documents;

export class Tribe8Actor extends Actor {
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
		// Intercept impossible edie inputs
		if (typeof changes.system?.edie !== 'undefined') {
			if (changes.system.edie < 0) {
				foundry.ui.notifications.error("tribe8.errors.negative-edie");
				return false;
			}
		}
		// Intercept negative wounds
		if (typeof changes.system?.wounds !== 'undefined') {
			if (changes.system.wounds.flesh < 0 || changes.system.wounds.deep < 0) {
				foundry.ui.notifications.error("tribe8.errors.negative-wounds");
				return false;
			}
		}
		return await super._preUpdate(changes, options, user);
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
	 * @param  {object} data       The initial or differential data from the request
	 * @param  {object} options    Additional options modifying the request
	 * @return {void}
	 * @access private
	 */
	#processNewUpdate(data, options) {
		if (options.action == 'update') {
			this.#auditSkillsAndSpecs();
		}
	}

	/**
	 * Audit the Actor's Skill and Specialization Items to ensure they
	 * agree with one another's relationships.
	 *
	 * @return {void}
	 * @access private
	 */
	#auditSkillsAndSpecs() {
		// console.log(`Actor.${this.id} auditing Skill and Specializations`);
		const skills = this.getItems({type: 'skill'});
		const specs = this.getItems({type: 'specialization'});

		// Process Specializations first
		const deleteSpecs = []; //
		const addSpecsToSkills = {};
		const removeSpecsFromSkills = {};
		for (let spec of specs) {
			// Make sure the Skill exists on the Actor
			const candidateSkills = skills.filter((s) => s.id == spec.system.skill);
			if (!candidateSkills.length) {
				console.warn(`Actor.${this.id}.Specialization.${spec.id} lists Skill.${spec.system.skill}, but no matching Skill was found on the Actor.`);
				deleteSpecs.push(spec.id);
				continue;
			}
			// Make sure the Skill lists the Specialization
			const specSkill = candidateSkills[0];
			if (specSkill.system.specializations.indexOf(spec.id) < 0) {
				console.warn(`Actor.${this.id}.Skill.${specSkill.id} does not list Specialization.${spec.id}, but the Specialization lists Skill.${spec.system.skill}.`);
				if (!addSpecsToSkills[specSkill.id]) addSpecsToSkills[specSkill.id] = [];
				addSpecsToSkills[specSkill.id].push(spec.id);
			}
		}

		// Now process Skills
		for (let skill of skills) {
			if (skill.system.specializations.length) {
				for (let specId of skill.system.specializations) {
					// Make sure the listed Specialization exists on the Actor
					const specItems = specs.filter((s) => s.id == specId);
					if (!specItems.length) {
						console.warn(`Specializations.${specId} not found on Actor.${this.id}.Skills.${skill.id}. Removing from list.`);
						if (!removeSpecsFromSkills[skill.id]) removeSpecsFromSkills[skill.id] = [];
						removeSpecsFromSkills[skill.id].push(specId);
						continue;
					}

					// Make sure the Specialization's linked Skill actually matches this Skill
					const expectedSkillId = specItems[0].system?.skill;
					if (expectedSkillId != skill.id) {
						console.warn(`Actor.${this.id}.Skill.${skill.id} lists Specialization.${specId}, but the Specialization lists Skill.${expectedSkillId}.`);
						if (!removeSpecsFromSkills[skill.id]) removeSpecsFromSkills[skill.id] = [];
						removeSpecsFromSkills[skill.id].push(specId);
					}
				}
			}
		}

		// Delete orphaned Specializations
		if (deleteSpecs.length) {
			console.log(`Deleting orphaned Specializations from Actor.${this.id}.`);
			this.deleteEmbeddedDocuments("Item", [deleteSpecs]);
		}

		// Adjust Skill specialization lists
		const adjustSkillIds = [...Object.keys(addSpecsToSkills), ...Object.keys(removeSpecsFromSkills)];
		if (adjustSkillIds.length) {
			for (let skillId of adjustSkillIds) {
				const skill = (skills.filter((s) => s.id == skillId) ?? [])[0];
				// Get the current list.
				let skillSpecs = [...skill.system.specializations];
				// Add new spec IDs
				if (addSpecsToSkills[skillId]) {
					skillSpecs = skillSpecs.concat(addSpecsToSkills[skillId]);
				}
				// Remove bad spec IDs
				if (removeSpecsFromSkills[skillId]) {
					skillSpecs = skillSpecs.filter((s) => !removeSpecsFromSkills[skillId].includes(s));
				}
				skill.update({'system.==specializations': skillSpecs}, {diff: false});
			}
		}
	}

	/**
	 * Utility function to determine which player (if any) owns this
	 * actor.
	 *
	 * @return {string|bool} A matching User ID, or false if no player owner was found
	 * @access public
	 */
	get playerOwner() {
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
		return possibleOwners[0];
		// return game.users.get(possibleOwners[0]);
	}

	/**
	 * Search through a list of items for ones that match the supplied
	 * search strings when both are slugified.
	 *
	 * @param  {Array<Tribe8Item>} searchIn     List of items to search in.
	 * @param  {Array<string>}     searchFor    List of terms to search for.
	 * @return {Array<Tribe8Item>}              The matching set of items, if any
	 * @access private
	 */
	#searchForItems(searchIn, searchFor) {
		let returnItems = [];
		for (let searchTerm of searchFor) {
			searchTerm = CONFIG.Tribe8.slugify(searchTerm);
			const foundItems = searchIn.filter(s => CONFIG.Tribe8.slugify(s.system?.name || '') == searchTerm || CONFIG.Tribe8.slugify(s.name || '') == searchTerm);
			if (foundItems.length) {
				returnItems = returnItems.concat(foundItems);
			}
		}
		return returnItems;
	}

	/**
	 * Validate that the requested getItem() search types are valid.
	 *
	 * @param  {Array<string>} typesRequested    The search types requested
	 * @param  {string}        [type='']         The item type being searched
	 * @return {bool}                            Whether or not the search type is valid
	 * @access private
	 */
	#areValidSearchTypes(typesRequested, type = '') {
		if (typesRequested.constructor.name !== 'Array') {
			console.error(`Invalid type filter syntax; supply an array of strings`);
			return false;
		}

		let validTypes = [];
		if (type == 'skill') {
			validTypes = ['combat', 'magic'];
		}
		// If the categories include any of the physical Item types...
		if (typesRequested.some(t => CONFIG.Tribe8.PHYSICAL_ITEMS.includes(t))) {
			// If we also specified a type, return just that one type
			if (type) validTypes = [type];
			// Otherwise, all types are considered valid
			else validTypes = CONFIG.Tribe8.PHYSICAL_ITEMS;
		}
		if (!validTypes.length) {
			console.error(`No search types are valid for ${type}`);
			return false;
		}

		for (let reqType of typesRequested) {
			if (!validTypes.includes(reqType) < 0) {
				console.error(`Invalid category filter '${type}' requested`);
				return false;
			}
		}
		return true;
	}

	/**
	 * Get a list of this character's Items, optionally filtered by
	 * type or other options. In its most basic form, this is just an
	 * alias of Actor.getEmbeddedDocuments("Item").
	 *
	 * @param  {object}                   [options={}]            Filtering options
	 * @param  {bool}                     [options.count]         Return just a count of the Items found
	 * @param  {Array<string>}            [options.search]        Return Items matching a provided set of one or more names
	 * @param  {Array<string>}            [options.categories]    Return Items belonging to a specific, supported category
	 *                                                            (e.g. combat or magic for Skills, weapons or armor for Gear)
	 * @return {Array<Tribe8Item>|object}                         The resulting item list, or reference object for combat skills
	 * @access public
	 */
	getItems(options = {}) {
		const allItems = Array.from(this.getEmbeddedCollection("Item"));
		if (allItems.length == 0 || Object.keys(options).length == 0)
			return allItems;

		let returnItems = allItems;
		// Type filter
		if (options.type) {
			returnItems = returnItems.filter((i) => i.type === options.type);
		}

		// Search?
		if (options.search && options.search instanceof Array)
			returnItems = this.#searchForItems(returnItems, options.search);

		// Categories?
		if (options.categories && !this.#areValidSearchTypes(options.categories, options.type))
			return;
		const itemCategories = [...(options.categories ?? [])];

		if (itemCategories.length > 0) {
			const returnItemsByCategory = {};
			for (let cat of itemCategories) {
				if (cat === 'combat')
					returnItemsByCategory[cat] = this.#getCombatSkills(returnItems);
				else if (cat === 'magic')
					returnItemsByCategory[cat] = this.#getMagicSkills(returnItems);
				else
					returnItemsByCategory[cat] = returnItems.filter(i => i.type === cat);
			}

			// If we only requested one type, just use it
			if (itemCategories.length == 1) {
				returnItems = returnItemsByCategory[itemCategories[0]]
			}
			else {
				// If we requested multiple types, we may need to spread out
				// types that return objects instead of arrays
				returnItems = []; // Reset the returnItems array, since we filtered by type
				for (let cat in returnItemsByCategory) {
					if (returnItemsByCategory[cat].constructor.name === 'Object') {
						for (let key in returnItemsByCategory[cat]) {
							returnItems = returnItems.concat(returnItemsByCategory[cat][key]);
						}
						continue;
					}
					returnItems = returnItems.concat(returnItemsByCategory[cat]);
				}
			}
		}

		// Just a count?
		if (options.count) {
			// If we asked specifically for combat skills, which are
			// keyed objects, and combat skills ONLY, we need to reduce
			// them to provide a count
			if (
				options.categories?.indexOf('combat') >= 0 &&
				itemCategories.length === 1 &&
				returnItems.constructor.name === 'Object'
			) {
				return Object.entries(returnItems).reduce((sum, entry) => { return sum + entry.length; }, 0);
			}
			// Otherwise, just return the count of the filtered returnItems list
			return returnItems.length;
		}

		return returnItems;
	}

	/**
	 * Wrapper for getItems that specifically targets Skills.
	 *
	 * When Skills are returned, they are returned as an array, except
	 * when specifically searching exclusively for combat Skills.
	 *
	 * For combat Skills, an Object is returned instead. The Object's
	 * keys are  the single-letter combat Skill category identifiers,
	 * and its values are arrays of Skills found that belong to those
	 * categories.
	 *
	 * @param  {object}                            [options]    Options that can be used to adjust search parameters and output
	 * @return {Array<Tribe8Item>|object|int|void}              Exact return type depends on options chosen
	 * @access public
	 */
	getSkills(options = {}) {
		if (!options.type || options.type != 'skill')
			options.type = 'skill';
		return this.getItems(options);
	}

	/**
	 * Filter a supplied list of Skills down to those that can be used
	 * to make attacks in combat.
	 *
	 * @param  {Array<Tribe8Item>} skills    The skill list to be filtered
	 * @return {object}                      An object containing all of the valid combat skills possessed by this Actor
	 * @access private
	 * @see    {@link getItems}
	 */
	#getCombatSkills(skills) {
		// Filter the skill list to just those that qualify
		skills = skills.filter((s) => s.system.combatCategory || false);

		/**
		 * Reduce that list down to an object that's keyed with the
		 * single-letter skill group as the property key, and the
		 * list of skills as the property value.
		 */
		const combatSkills = skills.reduce((obj, s) => {
			const refKey = s.system.combatCategory;
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
	 * Get a list of this character's Magic skills
	 *
	 * @param  {Array<Tribe8Item>} skills    This skill list to be filtered
	 * @return {Array<Tribe8Item>}           An array containing all of the skills identified as magic-related
	 * @access private
	 * @see    {@link getItems}
	 */
	#getMagicSkills(skills) {
		// Define the default names of the combat Skills, based on config
		const magicSkillNames = CONFIG.Tribe8.MAGIC_SKILLS.map(n => game.i18n.localize(n).toLowerCase());

		// Filter the skill list to just those that qualify
		return skills.filter((i) => {
			if (i.type != 'skill') return false;
			let lookupName = CONFIG.Tribe8.slugify(i.system.name);
			if (magicSkillNames.includes(lookupName)) return true;
			return false;
		});
	}

	/**
	 * Wrapper for getItems that specifically targets physical items.
	 *
	 * @param  {object}                   [options]    Options that can be used to adjust search parameters and output
	 * @return {Array<Tribe8Item>|object}              Exact return type depends on options chosen
	 * @throws {TypeError}                             If the supplied categories field is not an array
	 * @throws {RangeError}                            If any of the categories do not match the physical items set
	 * @access public
	 */
	getGear(options = {}) {
		// Do some pre-validation
		if (options.categories) {
			if (options.categories.constructor.name !== 'Array')
				throw new TypeError("'categories' option must be an array");
			for (let cat of options.categories) {
				if (!CONFIG.Tribe8.PHYSICAL_ITEMS.includes(cat))
					throw new RangeError(`'${cat}' is not a valid category`);
			}
		}
		else {
			options.categories = [...CONFIG.Tribe8.PHYSICAL_ITEMS];
		}
		return this.getItems(options);
	}

	/**
	 * Perform any source data migration steps that need to be done
	 * at the Actor level to account for changes to overall design.
	 *
	 * @param  {object} data    Object containing data fed in for migration
	 * @return {object}         Mutated data object for migration
	 * @access public
	 * @see    ../tribe8.js
	 */
	static migrateData(data) {
		if (data.system && data.type) {
			this.#deepSystemMigration(data);
		}
		if (data.items && data.items.length) {
			this.#itemMigration(data);
		}
		return super.migrateData(data);
	}

	/**
	 * Compute a differential model of system data used to initialize
	 * this Actor, that data after the Character model has run
	 * migrateData() on it, then store it as flag data to be used for
	 * true migration in the setup Hook
	 *
	 * @param  {object} data    Object containing data fed in for migration
	 * @return {void}
	 * @access private
	 * @see    migrateData
	 */
	static #deepSystemMigration(data) {
		const ourModel = (CONFIG.Actor?.dataModels || {})[data.type];
		if (ourModel) {
			const migratedSystem = ourModel.migrateData(data.system);
			let needsMigration = false;
			for (let key of Object.keys(migratedSystem)) {
				if (migratedSystem[key] != data.system[key]) {
					needsMigration = true;
					break;
				}
			}

			if (needsMigration) {
				if (!data.flags) data.flags = {};
				if (!data.flags.tribe8) data.flags.tribe8 = {};
				console.log(`Migration required for Actor.${data._id}`);
				data.flags.tribe8.migrateSystemData = foundry.utils.deepClone(migratedSystem);
			}
		}
	}

	/**
	 * Perform any embedded document migration steps necessary
	 *
	 * @param  {object} data    Object containing data fed in for migration
	 * @return {void}
	 * @access private
	 * @see    migrateData
	 */
	static #itemMigration(data) {
		// Hunt for Skills that need to be marked as being for a
		// particular combat Skill group.
		for (let item of data.items) {
			if (item.type !== 'skill')
				continue;
			if (!item.system?.combatCategory) {
				if (item.name == 'Melee')
					item.system.combatCategory = 'M';
				if (item.name.match(/^Hand/))
					item.system.combatCategory = 'H';
				if (item.name == 'Archery')
					item.system.combatCategory = 'R';
				if (item.name == 'Defense')
					item.system.combatCategory = 'D';
				if (item.name == 'Throwing')
					item.system.combatCategory = 'R';
				if (item.name == 'Riding')
					item.system.combatCategory = 'C';
			}
		}
		// Now that we've done that, hunt for Maneuvers to assign
		// to skills.
		for (let item of data.items) {
			if (item.type !== 'maneuver')
				continue;
			if (!item.system?.skill) {
				const targetSkill = (data.items.filter((i) => i.type === 'skill' && i.system?.combatCategory == (item.system.allowedTypes ?? [])[0]) ?? [])[0];
				if (targetSkill) {
					item.system.skill = targetSkill.id;
					continue;
				}
			}
		}
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
	async zShimCreateSpecializationsFromLegacy() {
		const skills = this.getSkills().filter(s => s.getFlag('tribe8', 'legacy-specializations'));
		for (let skill of skills) {
			await skill.zShimCreateSpecializationsFromLegacy();
		}
	}
}