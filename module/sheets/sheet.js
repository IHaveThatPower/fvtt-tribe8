const { HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * This class provides a common set of base behaviors to any application
 * that uses the HandlebarsApplicationMixin (namely, ActorSheetV2 and
 * ItemSheetV2);
 *
 * This is mainly for utility behaviors, like setting up common
 * listeners or recording data about sheets.
 */
export function Tribe8Sheet(BaseApplication) {
	class Tribe8Sheet extends HandlebarsApplicationMixin(BaseApplication) {
		static MIN_WIDTH = 32;
		static MIN_HEIGHT = 32;
		static MIN_TOP = 0;
		static MIN_LEFT = 0;

		/**
		 * Directly inherit from parent
		 */
		constructor(...args) {
		  super(...args);
		}

		/**
		 * Handle any special _onRender events.
		 */
		async _onRender(context, options) {
			// When rendering, always re-render the title
			if (this.window.title.textContent != this.title) {
				this._updateFrame({window: { title: this.title }});
			}

			// Setup input resizers
			const inputSizers = this.element.querySelectorAll('span.input-sizer input');
			inputSizers.forEach((s) => {
				s.addEventListener('input', (e) => {
					if (e.target?.parentNode?.dataset)
						e.target.parentNode.dataset.value = e.target.value;
				});
			});

			/**
			 * If the user has stored position preferences for this
			 * type of sheet, override the defaults with them.
			 */
			const {width, height, top, left} = game.user.getFlag("tribe8", `sheetDimensions.${this.windowKey}`) ?? {};
			if (width) options.width = Math.min(Math.max(width, this.constructor.MIN_WIDTH), window.innerWidth);
			if (height) options.height = Math.min(Math.max(height, this.constructor.MIN_HEIGHT), window.innerHeight);
			if (left) options.left = Math.min(Math.max(left, this.constructor.MIN_LEFT), window.innerWidth - this.constructor.MIN_WIDTH);
			if (top) options.top = Math.min(Math.max(top, this.constructor.MIN_TOP), window.innerHeight - this.constructor.MIN_HEIGHT);

			return await super._onRender(context, options);
		}

		/**
		 * Record the sheet's window position for the user just before
		 * it closes.
		 */
		async _preClose(options) {
			await super._preClose(options);

			// Store window position data for next time it's opened
			const { width, height, top, left } = this.position;
			if (this.windowKey.length)
				game.user.setFlag("tribe8", `sheetDimensions.${this.windowKey}`, {width, height, top, left});
		}

		/**
		 * Utility for generating a key for the current window
		 */
		get windowKey() {
			return `${this.document.type}${this.document.limited ? ":limited" : ""}`;
		}
	}
	return Tribe8Sheet;
}