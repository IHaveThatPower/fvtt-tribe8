const { Roll } = foundry.dice;

/**
 * 0d6 => 2d6kl
 * Nd6 => Nd6kh
 * Any additional 6s beyond the first are +1
 */
export class Tribe8Roll extends Roll {
	/**
	 * The HTML template path used to render a complete Roll object to the chat log
	 * @type {string}
	 */
	static CHAT_TEMPLATE = "systems/tribe8/templates/dice/roll.hbs";

	/**
	 * We implement our own parse method, but in order for it to kick
	 * in, we've got to override the parent constructor so that we
	 * repeat its last two steps, so we can use our own parser.
	 *
	 * @param  {string} [formula=""]    The string representation of the formula
	 * @param  {object} [data={}]       Supplemental roll data
	 * @param  {object} [options={}]    Options modifying the nature of the roll
	 * @return {void}
	 * @access public
	 */
	constructor(formula="", data={}, options={}) {
		// Call the parent, but then repeat part of what it does
		super(formula, data, options);
		this.terms = this.constructor.parse(formula, this.data);
		this._formula = this.resetFormula();
	}

	/**
	 * Let the parent evaluate the roll, then adjust the _total property
	 * based on what came back.
	 *
	 * @param  {object}        [options={}]    Options which inform how evaluation is performed
	 * @return {Promise<Roll>}                 The fulfilled roll result
	 * @access protected
	 */
	async _evaluate(options={}) {
		const result = await super._evaluate(options);

		// Was this unskilled?
		const unskilled = this.terms.filter((t) => t.constructor.name == 'SilhouetteDie' && t.isUnskilled).length > 0;

		// Did it fumble?
		const fumbled = this.terms.filter((t) => t.constructor.name == 'SilhouetteDie' && t.fumble).length > 0;

		// If it did both, the total is always just 1
		if (fumbled && unskilled) {
			result._total = 1;
		}
		return result;
	}

	/**
	 * The only thing we add to this over what the parent provides is
	 * whether or not the roll was a fumble. As such, we don't define
	 * any arguments of our own, but pass any supplied arguments up
	 * to the parent.
	 *
	 * @return {Promise<{object}>} The context for the chat display
	 * @access protected
	 */
	async _prepareChatRenderContext() {
		const context = await super._prepareChatRenderContext(...arguments);

		context.formula = this.formula;

		const silDieTerms = this.terms.filter((t) => t.constructor.name == 'SilhouetteDie');
		// Was this unskilled?
		context.unskilled = silDieTerms.filter((t) => t.isUnskilled).length > 0;

		// Did it fumble?
		context.fumbled = silDieTerms.filter((t) => t.fumble).length > 0;

		// Were there multiple sixes?
		context.multisix = silDieTerms.filter((t) => t.results.filter(r => r.result == 6 && r.active).length > 1).length > 0;

		// Were there *all* sixes?
		context.allsix = silDieTerms.filter((t) => t.results.filter(r => r.result == 6 && r.active).length == t.results.length).length > 0;

		return context;
	}

	/**
	 * Our parser implements support for SilhouetteDie, which are
	 * otherwise incorrectly recognized by the Peggy grammar as
	 * StringTerms, due to their two-character denomination.
	 *
	 * @param  {string}     formula    The original string expression to parse.
	 * @param  {object}     data       A data object used to substitute for attributes in the formula.
	 * @return {RollTerm[]}            An array of roll terms parsed from the supplied formula
	 * @throws {Error}                 If a string isn't provided for formula
	 * @access public
	 */
	static parse(formula="", data={}) {
		if (typeof formula !== "string") throw new Error(game.i18n.format("DICE.ErrorNotParsable", {formula}));
		if (!formula) return [];

		// Step 1: Replace formula and remove all spaces.
		let replaced = this.replaceFormulaData(formula, data, { missing: "0" });

		// Step 1a: See if we can pre-simplify it by removing unneeded parens.
		replaced = replaced.replace(/\((\d+)\)/g, "$1");

		// Step 2: Use configured RollParser to parse the formula into a parse tree.
		let tree = foundry.dice.RollGrammar.parse(replaced);

		// Step 3: Flatten the tree into infix notation and instantiate all the nodes as RollTerm instances.
		return this.instantiateAST(tree);
	}
}