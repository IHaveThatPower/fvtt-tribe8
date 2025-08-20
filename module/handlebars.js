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
		if (arguments.length != 3) // We were only passed the default options
			throw new Error("Must supply exactly two numbers");
		a = Number(a);
		if (typeof a !== "number")
			throw new Error("First argument must be a number");
		b = Number(b);
		if (typeof b !== "number")
			throw new Error("Second argument must be a number");
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
		if (arguments.length != 3) // We were only passed the default options
			throw new Error("Must supply exactly two numbers");
		a = Number(a);
		if (typeof a !== "number")
			throw new Error("First argument must be a number");
		b = Number(b);
		if (typeof b !== "number")
			throw new Error("Second argument must be a number");
		return a - b;
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
		if (typeof a !== "number") throw new Error("Argument must be a number");

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
		if (typeof includeZero !== 'boolean' && Object.keys(options).length === 0) options = includeZero;
		times = Number(times) || 0;
		if (!times) throw new Error("Must supply at least a number of times to repeat");
		const data = options.data ? Handlebars.createFrame(options.data) : {};
		const content = [];
		for (let i = (includeZero ? 0 : 1); i <= times; i++) {
			if (data) data.index = i;
			const result = options.fn(i, {data: data});
			content.push(result);
		}
		return content.join('');
	}
);

// Load supplemental templates
foundry.applications.handlebars.loadTemplates(
	[
		// Character sheet parts
		"sheets/actors/partials/attributes.html",
		"sheets/actors/partials/basic_info.html",
		"sheets/actors/partials/injuries.html",
		"sheets/actors/partials/magic.html",
		"sheets/actors/partials/magic_aspects.html",
		"sheets/actors/partials/maneuvers.html",
		"sheets/actors/partials/pf.html",
		"sheets/actors/partials/points.html",
		"sheets/actors/partials/portrait.html",
		"sheets/actors/partials/skills.html",

		// Shared Item sheet parts
		"sheets/items/partials/buttons.html",
		"sheets/items/partials/description.html"
	]
	.map((t) => `systems/tribe8/templates/${t}`)
);

}