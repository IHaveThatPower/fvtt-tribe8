// Import Modules
/*
import {
	STATaskRoll, STAChallengeRoll
} from './roll.js';
*/
/* Documents */
import { Tribe8Actor } from './documents/actor.js';
import { Tribe8Item } from './documents/item.js';
/* Sheets */
import { Tribe8CharacterSheet } from './sheets/character.js';
import { Tribe8ItemSheet } from './sheets/item.js';
import { Tribe8SkillSheet } from './sheets/skill.js';
import { Tribe8PerkSheet, Tribe8FlawSheet } from './sheets/perkflaw.js';
import { Tribe8ManeuverSheet } from './sheets/maneuver.js';
import { Tribe8AspectSheet } from './sheets/aspect.js';
/* Models */
import { Tribe8CharacterModel } from './datamodels/character.js';
import { Tribe8ItemModel } from './datamodels/item.js';
import { Tribe8SkillModel } from './datamodels/skill.js';
import { Tribe8PerkFlawModel } from './datamodels/perkflaw.js';
import { Tribe8ManeuverModel } from './datamodels/maneuver.js';
/*
import { Tribe8AspectModel } from './datamodels/aspect.js';
*/
import * as initHandlebars from './handlebars.js';

/*
import { 
	STATracker 
} from './apps/tracker.js';
import * as macros from './macro.js';
import { 
	STAItem
} from './items/item.js';
import {
	register_dsn_ufp_themes
} from './dice/dice-so-nice.js';
*/

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */

Hooks.once('init', function() {
	let versionInfo = game.world.coreVersion;
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
			Tribe8AspectSheet
		},
		entities: {
			Tribe8Actor,
			Tribe8Item
		}
	};

	// Define initiative for the system.
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
		perk: Tribe8PerkFlawModel, 
		flaw: Tribe8PerkFlawModel,
		maneuver: Tribe8ManeuverModel,
		/*
		aspect: Tribe8AspectModel,
		weapon: Tribe8ItemModel,
		armor: Tribe8ItemModel,
		cpBasis: Tribe8ItemModel // TODO: Do we actually want/need this?
		*/
	};
	
	// Define custom Roll classes
	/*
	CONFIG.Dice.STATaskRoll = STATaskRoll;
	CONFIG.Dice.STAChallengeRoll = STAChallengeRoll;
	*/

	// Register Roll Extensions
	/*
	CONFIG.Dice.rolls.push(STATaskRoll);
	CONFIG.Dice.rolls.push(STAChallengeRoll);
	*/

	// Register sheet application classes
	Actors.unregisterSheet('core', ActorSheet);
	Actors.registerSheet('tribe8', Tribe8CharacterSheet, {
		types: ['character'],
		makeDefault: true
	});
	Items.unregisterSheet('core', ItemSheet);
	Items.registerSheet('tribe8', Tribe8ItemSheet, {
		types: ['item'],
		makeDefault: true
	});
	Items.registerSheet('tribe8', Tribe8SkillSheet, {
		types: ['skill'],
	});
	Items.registerSheet('tribe8', Tribe8PerkSheet, {
		types: ['perk'],
	});
	Items.registerSheet('tribe8', Tribe8FlawSheet, {
		types: ['flaw'],
	});
	Items.registerSheet('tribe8', Tribe8ManeuverSheet, {
		types: ['maneuver'],
	});
	Items.registerSheet('tribe8', Tribe8AspectSheet, {
		types: ['aspect'],
	});

	// Register system settings
	// Attempt to add Chainprinter font, if present
	CONFIG.fontDefinitions["Chainprinter"] = {
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

	/*
	game.settings.register('sta', 'threatPermissionLevel', {
		name: 'Threat Tracker User Role:',
		hint: 'Who should be allowed to amend the threat tracker?',
		scope: 'world',
		type: String,
		default: 'ASSISTANT',
		config: true,
		choices: {
			'PLAYER': 'Players',
			'TRUSTED': 'Trusted Players',
			'ASSISTANT': 'Assistant Gamemaster',
			'GAMEMASTER': 'Gamemasters',
		}
	});

	game.settings.register('sta', 'momentumPermissionLevel', {
		name: 'Momentum Tracker User Role:',
		hint: 'Who should be allowed to amend the momentum tracker?',
		scope: 'world',
		type: String,
		default: 'PLAYER',
		config: true,
		choices: {
			'PLAYER': 'Players',
			'TRUSTED': 'Trusted Players',
			'ASSISTANT': 'Assistant Gamemaster',
			'GAMEMASTER': 'Gamemasters',
		}
	});

	game.settings.register('sta', 'maxNumberOfReputation', {
		name: 'Maximum amount of Reputation:',
		hint: 'Max number of reputation that can be given to a character. 20 is default.',
		scope: 'world',
		type: Number,
		default: 20,
		config: true
	});
		
	game.settings.register('sta', 'threat', {
		scope: 'world',
		type: Number,
		default: 0,
		config: false
	});

	game.settings.register('sta', 'momentum', {
		scope: 'world',
		type: Number,
		default: 0,
		config: false
	});
	*/
});