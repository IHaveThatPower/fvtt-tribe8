/**
 *
 * Handlebars helpers
 *
 */
export default function () {

/**
 * Add a number to another number
 *
 * @param  Number a
 * @param  Number b
 * @return Number
 */
Handlebars.registerHelper('add', function (a, b) {
	if (arguments.length != 3) // We were only passed the default options
		throw new Error("Must supply exactly two numbers");
	a = Number(a);
	if (typeof a !== "number")
		throw new Error("First argument must be a number");
	b = Number(b);
	if (typeof b !== "number")
		throw new Error("Second argument must be a number");
	return a + b;
});

/**
 * Subtract a number from another number
 *
 * @param  Number a
 * @param  Number b
 * @return Number
 */
Handlebars.registerHelper('sub', function (a, b) {
	if (arguments.length != 3) // We were only passed the default options
		throw new Error("Must supply exactly two numbers");
	a = Number(a);
	if (typeof a !== "number")
		throw new Error("First argument must be a number");
	b = Number(b);
	if (typeof b !== "number")
		throw new Error("Second argument must be a number");
	return a - b;
});

/**
 * Convert a number to Roman numerals
 *
 * @param  Number a
 * @return String
 */
Handlebars.registerHelper('roman', function (a) {
	if (arguments.length != 2) // We were only passed the default options
		throw new Error("Must supply exactly one number");
	a = Number(a);
	if (typeof a !== "number")
		throw new Error("Argument must be a number");

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
});

/**
 * Repeat a block from either 0 or 1 to the specified value.
 *
 * @param  int times      Repetition count
 * @param  bool includeZero  Whether we start at 0 or 1
 * @return  string
 */
Handlebars.registerHelper('repeat', function() {
	if (arguments.length <= 1) // We were only passed the default options
		throw new Error("Must supply at least a number of times to repeat");
	const includeZero = ((suppliedValue, numArgs) => {
		if (numArgs != 3) return false;
		if (typeof suppliedValue == 'boolean') return suppliedValue;
		if (Number(suppliedValue)) return !!(Number(suppliedValue));
		if (suppliedValue.trim().toLowerCase() === 'true') return true;
		return false;
	})(arguments[1], arguments.length);
	const times = Number(arguments[0]) || 0;
	const options = arguments[arguments.length - 1];
	const data = options.data ? Handlebars.createFrame(options.data) : {};

	const content = [];
	for (let i = (includeZero ? 0 : 1); i <= times; i++) {
		if (data) data.index = i;
		const result = options.fn(i, {data: data});
		content.push(result);
	}
	return content.join('');
});

// Load supplemental templates
foundry.applications.handlebars.loadTemplates([
	"systems/tribe8/templates/character-sheet_left-column.html",
	"systems/tribe8/templates/character-sheet_middle-column.html",
	"systems/tribe8/templates/character-sheet_right-column.html",
	"systems/tribe8/templates/item-sheet_buttons.html",
	"systems/tribe8/templates/item-sheet_description.html"
]);

}