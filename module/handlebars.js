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
Handlebars.registerHelper('add', function (a, b)
{
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
Handlebars.registerHelper('sub', function (a, b)
{
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
Handlebars.registerHelper('roman', function (a)
{
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
 * @param  int times      Final number
 * @param  bool includeZero  Whether we start at 0 or 1
 * @return  string
 */
Handlebars.registerHelper('repeat', function ()
{
	if (arguments.length <= 1) // We were only passed the default options
		throw new Error("Must supply at least a number of times to repeat");
	const times = arguments[0];
	const includeZero = (arguments.length == 3) ? arguments[1] : false;
	const options = arguments[arguments.length - 1];
	let data = {};
	if (options.data)
		data = Handlebars.createFrame(options.data);
	
	let content = [];
	let i = includeZero ? 0 : 1;
	for (i; i <= times; i++)
	{
		if (data)
		{
			data.index = i;
		}
		content.push(options.fn(i, {data: data}));
	}
	return content.join('');
});

// Load supplemental templates
foundry.applications.handlebars.loadTemplates([
	"systems/tribe8/templates/item-sheet_buttons.html",
	"systems/tribe8/templates/item-sheet_description.html"
]);

}