/**
 *
 * Handlebars helpers
 *
 */
export default function () {

Handlebars.registerHelper('add',
	/**
	 * Add a number to another number
	 *
	 * @param  {int}   a    first addend
	 * @param  {int}   b    second addend
	 * @return {int}        sum
	 * @throws {Error}      If any conditions are not met
	 */
	function (a, b) {
		a = Number(a);
		if (typeof a !== "number")
			throw new TypeError("The first addend must be a number");
		b = Number(b);
		if (typeof b !== "number")
			throw new TypeError("The second addend must be a number");
		return a + b;
	}
);

Handlebars.registerHelper('sub',
	/**
	 * Subtract a number from another number
	 *
	 * @param  {int}   a    minuend
	 * @param  {int}   b    subtrahend
	 * @return {int}        difference
	 * @throws {Error}      If any required conditions are not met
	 */
	function (a, b) {
		a = Number(a);
		if (typeof a !== "number")
			throw new TypeError("The minuend must be a number");
		b = Number(b);
		if (typeof b !== "number")
			throw new TypeError("The subtrahend must be a number");
		return a - b;
	}
);

Handlebars.registerHelper('mult',
	/**
	 * Multiply two numbers
	 *
	 * @param  {int}   a    multiplicand
	 * @param  {int}   b    multiplier
	 * @return {int}        product
	 * @throws {Error}      If any required conditions are not met
	 */
	function (a, b) {
		a = Number(a);
		if (typeof a !== "number")
			throw new TypeError("The multiplicand must be a number");
		b = Number(b);
		if (typeof b !== "number")
			throw new TypeError("The multiplier must be a number");
		return a * b;
	}
);

Handlebars.registerHelper('mod',
	/**
	 * Return the modulus of two numbers
	 *
	 * @param  {int}   a    dividend
	 * @param  {int}   b    divisor
	 * @return {int}        modulus
	 * @throws {Error}      If any required conditions are not met
	 */
	function (a, b) {
		a = Number(a);
		if (typeof a !== "number")
			throw new TypeError("The dividend must be a number");
		b = Number(b);
		if (typeof b !== "number")
			throw new TypeError("The divisor must be a number");
		return a % b;
	}
);

Handlebars.registerHelper('ifIn',
	/**
	 * Check if a supplied value is in a supplied array.
	 *
	 * @param  {Array}       array      The array to be searched
	 * @param  {mixed}       elem       The element to be found
	 * @param  {object}      options    Handlebars options object
	 * @return {string|bool}            Either the appropriate block of
	 *                                  contained HTML or a boolean
	 */
	function(array, elem, options) {
		if (!(array instanceof Array)) return (options.inverse ? options.inverse(this) : false);
		if (array.includes(elem)) return (options.fn ? options.fn(this) : true);
		return (options.inverse ? options.inverse(this) : false);
	}
);

Handlebars.registerHelper('repeat',
	/**
	 * Repeat a block from either 0 or 1 to the specified value.
	 *
	 * @param  {int}    times                  Repetition count
	 * @param  {bool}   [includeZero=false]    Whether we start at 0 or 1
	 * @param  {object} [options={}]           Additional configuration for how this helper performs.
	 *                                         This is supplied autoamtically.
	 * @return {string}                        The supplied block, repeated
	 * @throws {Error}                         If insufficient arguments are supplied
	 */
	function(times, includeZero=false, options={}) {
		// includeZero might be omitted
		if (typeof includeZero !== 'boolean' && Object.keys(options).length === 0) {
			options = includeZero;
			includeZero = false;
		}

		// Make sure we have a number
		times = Number(times);
		if (!(typeof times === 'number')) throw new TypeError("Must supply at least a number of times to repeat");

		// Might be 0, in the case of conditional loops, in which case we should return nothing
		if (times === 0) return '';

		// Repeat!
		const data = options.data ? Handlebars.createFrame(options.data) : {};
		const content = [];
		for (let i = (includeZero === true ? 0 : 1); i <= times; i++) {
			if (data) data.index = i;
			const result = options.fn(i, {data: data});
			content.push(result);
		}
		return content.join('');
	}
);

Handlebars.registerHelper('roman',
	/**
	 * Convert a number to Roman numerals
	 *
	 * @param  {int}    a    The number to be converted
	 * @return {string}      The resulting Roman numerals
	 * @throws {Error}       If any required conditions are not met
	 */
	function (a) {
		a = Number(a);
		if (typeof a !== "number") throw new TypeError("Argument must be a number");

		const roman = {
			M: 1000, CM: 900,
			D: 500, CD: 400,
			C: 100, XC: 90,
			L: 50, XL: 40,
			X: 10, IX: 9,
			V: 5, IV: 4,
			I: 1
		};
		let str = '';

		for (const i of Object.keys(roman)) {
			const q = Math.floor(a / roman[i]);
			a -= q * roman[i];
			str += i.repeat(q);
		}
		return str;
	}
);

Handlebars.registerHelper('setVar',
	/**
	 * Set an arbitrary value to an arbitrary variable name that a
	 * template can use from that point forward.
	 *
	 * @param  {string} name       The name by which the variable is referenced
	 * @param  {mixed}  value      The value to be set into the variable
	 * @param  {object} options    Handlebars options object
	 * @return {void}
	 */
	function (name, value, options) {
		if (!options.data?.root) return;
		options.data.root[name] = value;
	}
);

// Load supplemental templates
foundry.applications.handlebars.loadTemplates(
	[
		// Character sheet parts
		"sheets/actors/partials/armor.html",
		"sheets/actors/partials/attributes.html",
		"sheets/actors/partials/basic_info.html",
		"sheets/actors/partials/gear.html",
		"sheets/actors/partials/injuries.html",
		"sheets/actors/partials/magic.html",
		"sheets/actors/partials/magic_aspects.html",
		"sheets/actors/partials/maneuvers.html",
		"sheets/actors/partials/pf.html",
		"sheets/actors/partials/points.html",
		"sheets/actors/partials/portrait.html",
		"sheets/actors/partials/skills.html",
		"sheets/actors/partials/weapon.html",

		// Shared Item sheet parts
		"sheets/items/partials/gearCommonProperties.html",
		"sheets/items/partials/buttons.html",
		"sheets/items/partials/description.html"
	]
	.map((t) => `systems/tribe8/templates/${t}`)
);

}