import { Tribe8 } from './config.js';
/* Documents */
import { Tribe8Actor } from './documents/actor.js';
import { Tribe8Item } from './documents/item.js';
/* Sheets */
import { Tribe8CharacterSheet } from './sheets/character.js';
import { Tribe8ItemSheet } from './sheets/item.js';
import { Tribe8SkillSheet } from './sheets/skill.js';
import { Tribe8PerkSheet, Tribe8FlawSheet } from './sheets/perkflaw.js';
import { Tribe8ManeuverSheet } from './sheets/maneuver.js';
import { Tribe8EminenceSheet } from './sheets/eminence.js';
import { Tribe8AspectSheet } from './sheets/aspect.js';
import { Tribe8TotemSheet } from './sheets/totem.js';
import { Tribe8GearSheet } from './sheets/gear.js';
/* Models */
import { Tribe8CharacterModel } from './datamodels/character.js';
import { Tribe8ItemModel } from './datamodels/item.js';
import { Tribe8SkillModel } from './datamodels/skill.js';
import { Tribe8SpecializationModel } from './datamodels/specialization.js';
import { Tribe8PerkFlawModel } from './datamodels/perkflaw.js';
import { Tribe8ManeuverModel } from './datamodels/maneuver.js';
import { Tribe8EminenceModel } from './datamodels/eminence.js';
import { Tribe8AspectModel } from './datamodels/aspect.js';
import { Tribe8TotemModel } from './datamodels/totem.js';
import { Tribe8GearModel } from './datamodels/gear.js';
/*
import { Tribe8WeaponModel } from './datamodels/weapon.js';
import { Tribe8ArmorModel } from './datamodels/armor.js';
*/
import * as initHandlebars from './handlebars.js';

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */

Hooks.once('init', function() {
	// Splash Screen
	console.log(`Initializing Tribe 8 Roleplaying Game System`);

	// Create a namespace within the game global
	game.tribe8 = {
		applications: {
			Tribe8CharacterSheet,
			Tribe8ItemSheet,
			Tribe8SkillSheet,
			Tribe8PerkSheet,
			Tribe8FlawSheet,
			Tribe8ManeuverSheet,
			Tribe8EminenceSheet,
			Tribe8AspectSheet,
			Tribe8TotemSheet,
			Tribe8GearSheet,
		},
		entities: {
			Tribe8Actor,
			Tribe8Item
		}
	};

	CONFIG.Tribe8 = Tribe8;

	// Define initiative for the system.
	// TODO: Setup initiative stuff
	/*
	CONFIG.Combat.initiative = {
		formula: '@disciplines.security.value',
		decimals: 0
	};
	*/

	// Define custom Entity classes
	CONFIG.Actor.documentClass = Tribe8Actor;
	CONFIG.Actor.dataModels = {
		character: Tribe8CharacterModel
	};
	CONFIG.Item.documentClass = Tribe8Item;
	CONFIG.Item.dataModels = {
		item: Tribe8ItemModel,
		skill: Tribe8SkillModel,
		specialization: Tribe8SpecializationModel,
		perk: Tribe8PerkFlawModel,
		flaw: Tribe8PerkFlawModel,
		maneuver: Tribe8ManeuverModel,
		eminence: Tribe8EminenceModel,
		aspect: Tribe8AspectModel,
		totem: Tribe8TotemModel,
		gear: Tribe8GearModel,
		/*
		weapon: Tribe8WeaponModel,
		armor: Tribe8ArmorModel,
		*/
	};

	// Register sheet application classes
	const { Actors, Items } = foundry.documents.collections;
	CONFIG.Tribe8.registerSheets('Actor', Actors);
	CONFIG.Tribe8.registerSheets('Item', Items);

	// Register system settings
	// Attempt to add Chainprinter font, if present
	CONFIG.fontDefinitions.Chainprinter = {
		editor: true,
		fonts: [
			{
				urls: [
					"systems/tribe8/assets/Chainprinter Regular.ttf"
				]
			}
		]
	};

	initHandlebars.default();

	/*
	game.settings.register('tribe8', 'totalAttAllowed', {
		name: 'Attribute Points:',
		hint: 'Total number of character points that may be spent on attributes at character creation.',
		scope: 'world',
		type: Boolean,
		default: true,
		config: true
	});
	*/
});

Hooks.on('setup', function() {
	(async () => {
		for (let a of game.actors) {
			await a.migrateSystemData(); // Assumes a.migrateData(data) was called previous, but Foundry itself
			await a.createSpecializationsFromLegacy();
			a.alignSkillsAndSpecializations();
		}
	})();
});