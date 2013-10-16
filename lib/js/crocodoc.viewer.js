/*!
 * Crocodoc Viewer v2.0.1-alpha | (c) 2013 Box
 */

/**
 * @fileoverview Base namespaces for Crocodoc JavaScript.
 * @author clakenen
 */

/**
 * The one global object for Crocodoc JavaScript.
 * @namespace
 */
var Crocodoc = (function () {

    'use strict';

    var modules = {},
        services = {};

    return {
        // Zoom, scroll, page status, layout constants
        ZOOM_FIT_WIDTH: 'fitwidth',
        ZOOM_FIT_HEIGHT: 'fitheight',
        ZOOM_AUTO: 'auto',
        ZOOM_IN: 'in',
        ZOOM_OUT: 'out',

        SCROLL_PREVIOUS: 'previous',
        SCROLL_NEXT: 'next',

        PAGE_STATUS_CONVERTING: 'converting',
        PAGE_STATUS_NOT_LOADED: 'not loaded',
        PAGE_STATUS_LOADING: 'loading',
        PAGE_STATUS_LOADED: 'loaded',
        PAGE_STATUS_ERROR: 'error',

        LAYOUT_VERTICAL: 'vertical',
        LAYOUT_VERTICAL_SINGLE_COLUMN: 'vertical-single-column',
        LAYOUT_HORIZONTAL: 'horizontal',
        LAYOUT_PRESENTATION: 'presentation',
        LAYOUT_PRESENTATION_TWO_PAGE: 'presentation-two-page',

        /**
         * Register a new module
         * @param  {string} name    The (unique) name of the module
         * @param  {Function} creator Factory function used to create an instance of the module
         * @returns {void}
         */
        addModule: function (name, creator) {
            modules[name] = {
                creator: creator
            };
        },

        /**
         * Create and return an instance of the named module
         * @param  {string} name The name of the module to create
         * @returns {?Object}     The module instance or null if the module doesn't exist
         */
        createModuleInstance: function (name, scope) {
            var module = modules[name];

            if (module) {
                return module.creator(scope);
            }

            return null;
        },

        /**
         * Create and return a viewer instance initialized with the given parameters
         * @param {string|Element|jQuery} el The element to bind the viewer to
         * @param {Object} options The viewer configuration options
         * @returns {Object}     The viewer instance
         */
        createViewer: function (el, options) {
            var scope = new Crocodoc.Scope(this);
            var viewer = scope.createModuleInstance('viewer-api');
            viewer.init(el, options);
            return viewer;
        },


        /**
         * Register a new service
         * @param  {string} name    The (unique) name of the service
         * @param  {Function} creator Factory function used to create an instance of the service
         * @returns {void}
         */
        addService: function (name, creator) {
            services[name] = {
                creator: creator,
                instance: null
            };
        },

        /**
         * Retrieve the named service
         * @param {string} name The name of the service to retrieve
         * @returns {?Object}    The service or null if the service doesn't exist
         */
        getService: function (name) {
            var service = services[name];

            if (service) {
                if (!service.instance) {
                    service.instance = service.creator(this);
                }

                return service.instance;
            }

            return null;
        }
    };
})();
/**
 * @fileoverview Scope class definition
 * @author clakenen
 */

/*global Crocodoc*/

/**
 * Scope class used for module scoping (creating, destroying, broadcasting messages)
 * @param {Crocodoc} framework The framework object to wrap
 * @constructor
 */
Crocodoc.Scope = (function () {

    'use strict';

    return function Scope(framework) {

        var util = framework.getService('util');

        var instances = [];

        /**
         * Create and return an instance of the named module,
         * and add it to the list of instances in this scope
         * @param  {string} moduleName The name of the module to create
         * @returns {?Object}     The module instance or null if the module doesn't exist
         */
        this.createModuleInstance = function (moduleName) {
            var instance = framework.createModuleInstance(moduleName, this);
            if (instance) {
                instance.moduleName = moduleName;
                instances.push(instance);
            }
            return instance;
        };

        /**
         * Remove and call the destroy method on a module instance
         * @param  {Object} instance The module instance to remove
         * @returns {void}
         */
        this.removeModuleInstance = function (instance) {
            var i, len;

            for (i = 0, len = instances.length; i < len; ++i) {
                if (instance === instances[i]) {
                    if (typeof instance.destroy === 'function') {
                        instance.destroy();
                    }
                    instances.splice(i, 1);
                    break;
                }
            }
        };

        /**
         * Remove and call the destroy method on all instances in this scope
         * @returns {void}
         */
        this.destroy = function () {
            var i, len, instance;

            for (i = 0, len = instances.length; i < len; ++i) {
                instance = instances[i];
                if (typeof instance.destroy === 'function') {
                    instance.destroy();
                }
            }
            instances.length = 0;
        };

        /**
         * Broadcast a message to all modules in this scope that have registered
         * a listener for the named message type
         * @param  {string} messageName The message name
         * @param  {any} data The message data
         * @returns {void}
         */
        this.broadcast = function (messageName, data) {
            var i, len, instance, messages;

            for (i = 0, len = instances.length; i < len; ++i) {
                instance = instances[i];
                messages = instance.messages || [];

                if ($.inArray(messageName, messages) !== -1) {
                    if (typeof instance.onmessage === 'function') {
                        instance.onmessage.call(instance, messageName, data);
                    }
                }
            }
        };

        /**
         * Given a module instance and a module name, create an instance of the named module,
         * and mix it into the instance.
         * @param   {Object} instance   The module instance to recieve the mixin
         * @param   {string} moduleName The name of the module to mixin
         * @returns {Object}            The mixed-in module
         */
        this.mixinModule = function (instance, moduleName) {
            var moduleToMixin = framework.createModuleInstance(moduleName, this);
            return util.extend(instance, moduleToMixin);
        };

        /**
         * Passthrough method to the framework that retrieves services.
         * @param {string} name The name of the service to retrieve
         * @returns {?Object}    An object if the service is found or null if not
         */
        this.getService = function (name) {
            return framework.getService(name);
        };
    };
})();
/**
 * @fileoverview Definition of a custom event type. This is used as a utility
 * throughout the framework whenever custom events are used. It is intended to
 * be inherited from, either through the prototype or via mixin.
 * @author nzakas
 * @author clakenen
 */

/*global Crocodoc*/
(function () {
    'use strict';

    /**
     * An object that is capable of generating custom events and also
     * executing handlers for events when they occur.
     * @constructor
     */
    Crocodoc.EventTarget = function() {

        /**
         * Map of events to handlers. The keys in the object are the event names.
         * The values in the object are arrays of event handler functions.
         * @type {Object}
         * @private
         */
        this._handlers = {};
    };

    Crocodoc.EventTarget.prototype = {

        // restore constructor
        constructor: Crocodoc.EventTarget,

        /**
         * Adds a new event handler for a particular type of event.
         * @param {string} type The name of the event to listen for.
         * @param {Function} handler The function to call when the event occurs.
         * @returns {void}
         */
        on: function(type, handler) {
            if (typeof this._handlers[type] === 'undefined') {
                this._handlers[type] = [];
            }

            this._handlers[type].push(handler);
        },

        /**
         * Fires an event with the given name and data.
         * @param {string} type The type of event to fire.
         * @param {Object} data An object with properties that should end up on
         *      the event object for the given event.
         * @returns {void}
         */
        fire: function(type, data) {
            var handlers,
                i,
                len,
                event = {
                    type: type,
                    data: data
                };

            // if there are handlers for the event, call them in order
            handlers = this._handlers[event.type];
            if (handlers instanceof Array) {
                for (i = 0, len = handlers.length; i < len; i++) {
                    if (handlers[i]) {
                        handlers[i].call(this, event);
                    }
                }
            }

            // call handlers for `all` event type
            handlers = this._handlers.all;
            if (handlers instanceof Array) {
                for (i = 0, len = handlers.length; i < len; i++) {
                    if (handlers[i]) {
                        handlers[i].call(this, event);
                    }
                }
            }
        },

        /**
         * Removes an event handler from a given event.
         * If the handler is not provided, remove all handlers of the given type.
         * @param {string} type The name of the event to remove from.
         * @param {Function} handler The function to remove as a handler.
         * @returns {void}
         */
        off: function(type, handler) {

            var handlers = this._handlers[type],
                i,
                len;

            if (handlers instanceof Array) {
                if (!handler) {
                    handlers.length = 0;
                    return;
                }
                for (i = 0, len = handlers.length; i < len; i++) {
                    if (handlers[i] === handler || handlers[i].handler === handler) {
                        handlers.splice(i, 1);
                        break;
                    }
                }
            }
        },


        /**
         * Adds a new event handler that should be removed after it's been triggered once.
         * @param {string} type The name of the event to listen for.
         * @param {Function} handler The function to call when the event occurs.
         * @returns {void}
         */
        one: function(type, handler) {
            var self = this,
                proxy = function (event) {
                    self.off(type, proxy);
                    handler.call(self, event);
                };
            proxy.handler = handler;
            this.on(type, proxy);
        }
    };

})();
/**
 * @fileoverview Crocodoc.Viewer definition
 * @author clakenen
 */

/*global Crocodoc*/

Crocodoc.Viewer = (function () {
    'use strict';

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    return {

        // Global defaults
        defaults: {
            url: null,

            page: 1, // page to start on
            layout: Crocodoc.LAYOUT_VERTICAL,
            enableTextSelection: true,
            enableLinks: true
        }
    };
})();

/**
 * @fileOverview browser detection for use when feature detection won't work
 */
// @TODO: get rid of this whenever possible

/*global Crocodoc, navigator*/

Crocodoc.addService('browser', function () {

    'use strict';

    var ua = navigator.userAgent,
        browser = {},
        ios, android, blackberry,
        webos, silk, ie;

    ios = /iphone|ipod|ipad/i.test(ua);
    android = /android/i.test(ua);
    webos = /webos/i.test(ua);
    blackberry = /blackberry/i.test(ua);
    silk = /blackberry/i.test(ua);
    ie = /MSIE/i.test(ua);

    if (ie) {
        browser.ie = true;
        browser.version = parseFloat(/MSIE\s+(\d+\.\d+)/i.exec(ua)[1]);
        browser.ielt9 = browser.version < 9;
        browser.ielt10 = browser.version < 10;
    }
    if (ios) {
        browser.ios = true;
    }
    browser.mobile = /mobile/i.test(ua) || ios || android || blackberry || webos || silk;
    browser.firefox = /firefox/i.test(ua);
    if (/safari/i.test(ua)) {
        browser.chrome = /chrome/i.test(ua);
        browser.safari = !browser.chrome;
    }

    return browser;
});
/**
 * @fileOverview Subpixel rendering fix for browsers that do not support subpixel rendering
 * @author clakenen
 */

/*global Crocodoc*/
Crocodoc.addService('subpx', function (framework) {

    'use strict';

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    var CSS_CLASS_SUBPX_FIX = 'crocodoc-subpx-fix',
        TEST_SPAN_TEMPLATE = '<span style="font-size:{{size}}px;"></span>';

    var util = framework.getService('util');

    var subpixelRenderingIsSupported = isSupported();

    /**
     * Return true if subpixel rendering is supported
     * @returns {Boolean}
     * @private
     */
    function isSupported() {
        // Test if subpixel rendering is supported
        // @NOTE: jQuery.support.leadingWhitespace is apparently false if browser is IE6-8
        if (!$.support.leadingWhitespace) {
            return false;
        } else {
            //span #1 - desired font-size: 12.5px
            var span = $(util.template(TEST_SPAN_TEMPLATE, { size: 12.5 }))
                .appendTo(document.documentElement).get(0);
            var fontsize1 = $(span).css('font-size');
            $(span).remove();

            //span #2 - desired font-size: 12.6px
            span = $(util.template(TEST_SPAN_TEMPLATE, { size: 12.6 }))
                .appendTo(document.documentElement).get(0);
            var fontsize2 = $(span).css('font-size');
            $(span).remove();
            if (fontsize1 === fontsize2 && !('ontouchstart' in window)) {
                return false;
            }
        }
        return true;
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    return {
        /**
         * Apply the subpixel rendering fix to the given element if necessary
         * @param   {Element} el The element
         * @returns {Element} The element
         */
        fix: function (el) {
            if (!subpixelRenderingIsSupported) {
                var $wrap = $('<div>').addClass(CSS_CLASS_SUBPX_FIX);
                $(el).children().wrapAll($wrap);
            }
            return el;
        }
    };
});
/**
 * @fileoverview Support service
 * @author clakenen
 */

/*global window, document */

Crocodoc.addService('support', function () {

    'use strict';
    var support = {};

    support.svg = document.implementation.hasFeature('http://www.w3.org/TR/SVG11/feature#BasicStructure', '1.1');
    support.csstransform  = !!getVendorCSSPropertyName('transform');
    support.csstransition = !!getVendorCSSPropertyName('transition');
    support.csszoom       = !!getVendorCSSPropertyName('zoom');
    support.fullscreen  = (function () {
        return typeof document.webkitCancelFullScreen === 'function' ||
            typeof document.mozCancelFullScreen === 'function' ||
            typeof document.cancelFullScreen === 'function' ||
            typeof document.exitFullscreen === 'function';
        })();

    // Helper function to get the proper vendor property name.
    // (`transition` => `WebkitTransition`)
    function getVendorCSSPropertyName(prop) {
        var testDiv = document.createElement('div');
        // Handle unprefixed versions (FF16+, for example)
        if (prop in testDiv.style) {
            return prop;
        }

        var prefixes = ['Moz', 'Webkit', 'O', 'ms'];
        var prop_ = prop.charAt(0).toUpperCase() + prop.substr(1);

        if (prop in testDiv.style) {
            return prop;
        }

        for (var i=0; i<prefixes.length; ++i) {
            var vendorProp = prefixes[i] + prop_;
            if (vendorProp in testDiv.style) {
                return uncamel(vendorProp);
            }
        }
    }

    // ### uncamel(str)
    // Converts a camelcase string to a dasherized string.
    // (`marginLeft` => `margin-left`)
    function uncamel(str) {
        return str.replace(/([A-Z])/g, function(letter) { return '-' + letter.toLowerCase(); });
    }

    // requestAnimationFrame based on:
    // http://paulirish.com/2011/requestanimationframe-for-smart-animating/
    // http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating
    var raf, caf;
    (function() {
        var lastTime = 0;
        var vendors = ['ms', 'moz', 'webkit', 'o'];
        for (var x = 0; x < vendors.length && !raf; ++x) {
            raf = window[vendors[x]+'RequestAnimationFrame'];
            caf = window[vendors[x]+'CancelAnimationFrame'] || window[vendors[x]+'CancelRequestAnimationFrame'];
        }
        if (!raf) {
            raf = function(callback) {
                var currTime = new Date().getTime();
                var timeToCall = Math.max(0, 16 - (currTime - lastTime));
                var id = window.setTimeout(function() { callback(currTime + timeToCall); },
                  timeToCall);
                lastTime = currTime + timeToCall;
                return id;
            };
        }
        if (!caf) {
            caf = function(id) {
                clearTimeout(id);
            };
        }
    }());
    support.requestAnimationFrame = function () {
        return raf.apply(window, arguments);
    };
    support.cancelAnimationFrame = function () {
        return caf.apply(window, arguments);
    };


    return support;
});
/**
 * @fileoverview Utility service
 * @author clakenen
 * @TODO(clakenen): documentation
 */

/*global window, document */

Crocodoc.addService('util', function () {

    'use strict';

    var util = {};

    util.extend = $.extend;
    util.each = $.each;
    util.map = $.map;

    return $.extend(util, {

        // left bistect of list, optionally of property of objects in list
        // @NOTE: not actually bisect
        bisectLeft: function (list, x, prop) {
            var i = 0, l = list.length;
            if (prop) {
                while (i < l && list[i][prop] < x) {
                    i++;
                }
            } else {
                while (i < l && list[i] < x) {
                    i++;
                }
            }
            return i;
        },

        // right bistect of list, optionally of property of objects in list
        // @NOTE: not actually bisect (not even the same result as a correct right bisect)
        bisectRight: function (list, x, prop) {
            var i = list.length - 1;
            if (prop) {
                while (i > 0 && list[i][prop] > x) {
                    i--;
                }
            } else {
                while(i > 0 && list[i] > x) {
                    i--;
                }
            }
            return i;
        },

        // @TODO: either rename or implement bisect fns correctly:
        // @NOTE: bisectRight is used in a way that assumes incorrect behavior throughout the codebase
        /*
        bisectLeft: function (list, x, prop) {
            var val, mid, low = 0, high = list.length;
            while (low < high) {
                mid = Math.floor((low + high) / 2);
                val = prop ? list[mid][prop] : list[mid];
                if (val < x) {
                    low = mid + 1;
                } else {
                    high = mid;
                }
            }

            return low;
        },

        bisectRight: function (list, x, prop) {
            var val, mid, low = 0, high = list.length;
            while (low < high) {
                mid = Math.floor((low + high) / 2);
                val = prop ? list[mid][prop] : list[mid];
                if (x < val) {
                    high = mid;
                } else {
                    low = mid + 1;
                }
            }

            return low;
        },
        */

        clamp: function (x, a, b) {
            if (x < a) {
                return a;
            } else if (x > b) {
                return b;
            }
            return x;
        },

        isFn: function (fn) {
            return typeof fn === 'function';
        },

        /**
         * Search for a specified value within an array, and return its index (or -1 if not found)
         * @param   {*} value       The value to search for
         * @param   {Array} array   The array to search
         * @returns {int}           The index of value in array or -1 if not found
         */
        inArray: function (value, array) {
            if (util.isFn(array.indexOf)) {
                return array.indexOf(value);
            } else {
                return $.inArray(value, array);
            }
        },

        constrainRange: function (low, high, max) {
            var length = high - low;
            low = util.clamp(low, 0, max);
            high = util.clamp(low + length, 0, max);
            if (high - low < length) {
                low = util.clamp(high - length, 0, max);
            }
            return {
                min: low,
                max: high
            };
        },

        // if path doesn't contain protocol and domain, prepend the current protocol and domain
        // if the path is relative (eg. doesn't begin with /), also fill in the current path
        makeAbsolute: function (path) {
            var location = window.location,
                href = location.href;
            if (/^http|^\/\//i.test(path)) {
                return path;
            }
            if (path.charAt(0) !== '/') {
                if (href.lastIndexOf('/') !== href.length - 1) {
                    href = href.substring(0, href.lastIndexOf('/') + 1);
                }
                return href + path;
            } else {
                return location.protocol + '//' + location.host + path;
            }
        },

        throttle: function (fn, wait) {
            var context, args, timeout, result;
            var previous = 0;
            var later = function() {
                previous = new Date();
                timeout = null;
                result = fn.apply(context, args);
            };
            return function() {
                var now = new Date();
                var remaining = wait - (now - previous);
                context = this;
                args = arguments;
                if (remaining <= 0) {
                    clearTimeout(timeout);
                    timeout = null;
                    previous = now;
                    result = fn.apply(context, args);
                } else if (!timeout) {
                    timeout = setTimeout(later, remaining);
                }
                return result;
            };
        },

        insertStylesheet: function (src) {
            var el;
            if (document.createStyleSheet) { // IE
                el = document.createStyleSheet(src).owningElement;
            } else {
                el = document.createElement('link');
                el.type = 'text/css';
                el.rel = 'stylesheet';
                el.href = src;
                document.getElementsByTagName('head')[0].appendChild(el);
            }
            return el;
        },

        //@TODO: somehow return all selected nodes?
        getSelectedNode: function () {
            var node, sel, range;
            if (window.getSelection) {
                sel = window.getSelection();
                if (sel.rangeCount) {
                    range = sel.getRangeAt(0);
                    if (!range.collapsed) {
                        node = sel.anchorNode.parentNode;
                    }
                }
            } else if (document.selection) {
                node = document.selection.createRange().parentElement();
            }
            return node;
        },

        /**
         * Cross-browser getComputedStyle, which is faster than jQuery.css
         * @param   {HTMLElement} el      The element
         * @returns {CSSStyleDeclaration} The computed styles
         */
        getComputedStyle: function (el) {
            return window.getComputedStyle && window.getComputedStyle(el) || el.currentStyle;
        },

        calculatePtSize: function () {
            var div = document.createElement('div');
            div.style.position = 'absolute';
            div.style.width = '10000pt';
            document.body.appendChild(div);
            var width = util.getComputedStyle(div).width;
            var px = parseFloat(width)/10000;
            document.body.removeChild(div);
            return px;
        },

        template: function (str, data) {
            for (var p in data) {
                if (data.hasOwnProperty(p)) {
                    str = str.replace(new RegExp('\\{\\{'+p+'\\}\\}', 'g'), data[p]);
                }
            }
            return str;
        }
    });
});
/**
 * @fileoverview Layout module definition
 * @author clakenen
 */

/*global Crocodoc */

/**
 * Base layout module for controlling viewer layout and viewport
 */
Crocodoc.addModule('layout-base', function (scope) {

    'use strict';

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    var CSS_CLASS_LAYOUT_PREFIX = 'crocodoc-layout-',
        CSS_CLASS_CURRENT_PAGE = 'crocodoc-current-page',
        CSS_CLASS_PAGE_PREFIX = 'crocodoc-page-',
        CSS_CLASS_PAGE_VISIBLE = CSS_CLASS_PAGE_PREFIX + 'visible',
        STYLE_PADDING_PREFIX = 'padding-',
        STYLE_PADDING_TOP = STYLE_PADDING_PREFIX + 'top',
        STYLE_PADDING_RIGHT = STYLE_PADDING_PREFIX + 'right',
        STYLE_PADDING_LEFT = STYLE_PADDING_PREFIX + 'left',
        STYLE_PADDING_BOTTOM = STYLE_PADDING_PREFIX + 'bottom';

    var util = scope.getService('util'),
        support = scope.getService('support'),
        browser = scope.getService('browser');

    /**
     * Returns true if we should use CSS transform for zooming (as opposed to manual resize)
     * @returns {bool} Whether to use CSS transform for zooming
     * @private
     */
    function shouldUseTransformZoom() {
        return support.csstransform && !browser.firefox && !browser.ielt10;
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    return {
        messages: ['resize', 'scroll', 'afterscroll'],

        /**
         * Handle framework messages
         * @param {string} name The name of the message
         * @param {Object} data The related data for the message
         * @returns {void}
         */
        onmessage: function (name, data) {
            switch (name) {
                case 'resize':
                    this.handleResize(data);
                    break;
                case 'scroll':
                    this.handleScroll(data);
                    break;
                case 'afterscroll':
                    this.handleAfterscroll(data);
                    break;
                // no default
            }
        },

        /**
         * Initialize the Layout module
         * @returns {void}
         */
        init: function (config) {
            this.config = config;
            // shortcut references to jq DOM objects
            this.$el = config.$el;
            this.$doc = config.$doc;
            this.$viewport = config.$viewport;
            this.$pages = config.$pages;
            this.$pagesWrapper = config.$pagesWrapper;
            this.numPages = config.numPages;

            if (shouldUseTransformZoom()) {
                this.zoomStrategy = 'transform';
            } else {
                this.zoomStrategy = 'resize';
            }

            // add the layout css class
            this.layoutClass = CSS_CLASS_LAYOUT_PREFIX + config.layout;
            this.$el.addClass(this.layoutClass);

            this.initState();
            this.initZoomLevels();
            this.updatePageStates();
        },

        /**
         * Initalize the state object
         * @returns {void}
         */
        initState: function () {
            // setup initial state
            this.state = {
                pages: [],
                widestPage: {
                    index: 0,
                    actualWidth: 0
                },
                tallestPage: {
                    index: 0,
                    actualHeight: 0
                },
                sumWidths: 0,
                sumHeights: 0,
                rows: [],
                scrollTop: this.$viewport.scrollTop(),
                scrollLeft: this.$viewport.scrollLeft(),
                viewportWidth: this.$viewport.width(),
                viewportHeight: this.$viewport.height(),
                zoomState: {
                    zoom: 1,
                    prevZoom: 0,
                    zoomMode: null
                },
                currentPage: null,
                visiblePages: [],
                initialWidth: 0,
                initialHeight: 0
            };
            this.zoomLevels = [];
        },

        /**
         * Destroy the Layout module
         * @returns {void}
         */
        destroy: function () {
            this.$pagesWrapper.add(this.$doc).removeAttr('style');
            this.$pages.css('padding', '');
            this.$el.removeClass(this.layoutClass);
        },

        /**
         * Set the zoom level for the layout
         * @param {float|string} val The zoom level (float or one of the zoom constants)
         */
        setZoom: function (val) {
            var state = this.state,
                zoom = this.parseZoomValue(val),
                zoomState = state.zoomState,
                currentZoom = zoomState.zoom,
                topPageIndex,
                leftPageIndex,
                x0,
                y0,
                offsetX,
                offsetY,
                shouldNotCenter;

            // check if we landed on a named mode
            switch (zoom) {
                case this.calculateZoomValue(Crocodoc.ZOOM_AUTO):
                    zoomState.zoomMode = Crocodoc.ZOOM_AUTO;
                    break;
                case this.calculateZoomValue(Crocodoc.ZOOM_FIT_WIDTH):
                    zoomState.zoomMode = Crocodoc.ZOOM_FIT_WIDTH;
                    break;
                case this.calculateZoomValue(Crocodoc.ZOOM_FIT_HEIGHT):
                    zoomState.zoomMode = Crocodoc.ZOOM_FIT_HEIGHT;
                    break;
                default:
                    zoomState.zoomMode = null;
                    break;
            }

            //respect zoom constraints
            zoom = util.clamp(zoom, state.minZoom, state.maxZoom);

            if (this.zoomStrategy === 'transform') {
                this.applyZoomTransform(zoom);
            } else if (this.zoomStrategy === 'resize') {
                this.applyZoomResize(zoom);
            }

            // update the zoom state
            zoomState.prevZoom = currentZoom;
            zoomState.zoom = zoom;

            // can the document be zoomed in/out further?
            zoomState.canZoomIn = this.calculateNextZoomLevel(Crocodoc.ZOOM_IN) !== false;
            zoomState.canZoomOut = this.calculateNextZoomLevel(Crocodoc.ZOOM_OUT) !== false;

            // update page states, because they will have changed after zooming
            this.updatePageStates();

            // layout mode specific stuff
            this.updateLayout();

            // update scroll position for the new zoom
            // @NOTE: updateScrollPosition() must be called AFTER updateLayout(),
            // because the scrollable space may change in updateLayout
            // @NOTE: shouldNotCenter is true when using a named zoom level
            // so that resizing the browser zooms to the current page offset
            // rather than to the center like when zooming in/out
            shouldNotCenter = val === Crocodoc.ZOOM_AUTO ||
                                  val === Crocodoc.ZOOM_FIT_WIDTH ||
                                  val === Crocodoc.ZOOM_FIT_HEIGHT;
            this.updateScrollPosition(shouldNotCenter);

            // update again, because updateLayout could have changed page positions
            this.updatePageStates();

            // broadcast zoom event with new zoom state
            scope.broadcast('zoom', util.extend({
                page: state.currentPage,
                visiblePages: util.extend([], state.visiblePages)
            }, zoomState));
        },

        /**
         * Parse the given zoom value into a number to zoom to.
         * @param   {float|string} val The zoom level (float or one of the zoom constants)
         * @returns {float} The parsed zoom level
         */
        parseZoomValue: function (val) {
            var zoomVal = parseFloat(val),
                state = this.state,
                zoomState = state.zoomState,
                currentZoom = zoomState.zoom,
                nextZoom = currentZoom;

            // number
            if (zoomVal) {
                nextZoom = zoomVal;
            } else {
                switch (val) {
                    case Crocodoc.ZOOM_FIT_WIDTH:
                        // falls through
                    case Crocodoc.ZOOM_FIT_HEIGHT:
                        // falls through
                    case Crocodoc.ZOOM_AUTO:
                        nextZoom = this.calculateZoomValue(val);
                        break;

                    case Crocodoc.ZOOM_IN:
                        // falls through
                    case Crocodoc.ZOOM_OUT:
                        nextZoom = this.calculateNextZoomLevel(val) || currentZoom;
                        break;

                    // bad mode or no value
                    default:
                        // there hasn't been a zoom set yet
                        if (!currentZoom) {
                            //use default zoom
                            nextZoom = this.calculateZoomValue(this.config.zoom || Crocodoc.ZOOM_AUTO);
                        }
                        else if (zoomState.zoomMode) {
                            //adjust zoom
                            nextZoom = this.calculateZoomValue(zoomState.zoomMode);
                        } else {
                            nextZoom = currentZoom;
                        }
                        break;
                }
            }

            return nextZoom;
        },

        /**
         * Calculate the next zoom level for zooming in or out
         * @param   {[type]} direction [description]
         * @returns {Object} an object with params:
         *                      zoom: false or numeric value to zoom to
         *                      mode: null or string zoom mode ('fitWidth', 'fitHeight')
         * @TODO(clakenen): consider making auto, fitWidth, and fitHeight optional additions?
         */
        calculateNextZoomLevel: function (direction) {
            var i,
                config = this.config,
                zoom = false,
                currentZoom = this.state.zoomState.zoom,
                zoomLevels = this.zoomLevels.slice(),
                auto = this.calculateZoomValue(Crocodoc.ZOOM_AUTO),
                fitWidth = this.calculateZoomValue(Crocodoc.ZOOM_FIT_WIDTH),
                fitHeight = this.calculateZoomValue(Crocodoc.ZOOM_FIT_HEIGHT),
                additions = [fitWidth, fitHeight];

            // if auto is not the same as fitWidth or fitHeight,
            // add it as a possible next zoom
            if (auto !== fitWidth && auto !== fitHeight) {
                additions.push(auto);
            }

            // add auto-zoom levels and sort
            zoomLevels = zoomLevels.concat(additions);
            zoomLevels.sort(function sortZoomLevels(a, b){
                return a - b;
            });

            if (direction === Crocodoc.ZOOM_IN) {
                for (i = 0; i < zoomLevels.length; ++i) {
                    if (zoomLevels[i] > currentZoom) {
                        zoom = zoomLevels[i];
                        break;
                    }
                }
            } else if (direction === Crocodoc.ZOOM_OUT) {
                for (i = zoomLevels.length - 1; i >= 0; --i) {
                    if (zoomLevels[i] < currentZoom) {
                        zoom = zoomLevels[i];
                        break;
                    }
                }
            }

            return zoom;
        },

        /**
         * Calculate the numeric value for a given zoom mode (or return the value if it's already numeric)
         * @param   {string} mode The mode to zoom to
         * @returns {float}       The zoom value
         */
        calculateZoomValue: function (mode) {
            var state = this.state,
                val = parseFloat(mode);
            if (val) {
                return val;
            }
            if (mode === Crocodoc.ZOOM_FIT_WIDTH) {
                return state.viewportWidth / state.widestPage.totalActualWidth;
            }
            else if (mode === Crocodoc.ZOOM_FIT_HEIGHT) {
                return state.viewportHeight / state.tallestPage.totalActualHeight;
            }
            else if (mode === Crocodoc.ZOOM_AUTO) {
                return this.calculateZoomAutoValue();
            } else {
                return state.zoomState.zoom;
            }
        },

        /**
         * Apply a zoom value to the layout for browsers that support CSS transforms
         * @param   {float} zoom The zoom value
         * @returns {void}
         */
        applyZoomTransform: function (zoom) {
            var state = this.state,
                pages = state.pages,
                z = zoom.toFixed(4),
                transform;
            // transform using css
            if (this.config.enable3dTransforms) {
                transform = 'scale3d('+z+','+z+',1)';
            } else {
                transform = 'scale('+z+')';
            }
            this.$pagesWrapper.css({
                transform: transform
            });
        },

        /**
         * Apply a zoom value to the layout for browsers that don't support CSS transforms
         * (using width/height instead)
         * @param   {float} zoom The zoom value
         * @returns {void}
         */
        applyZoomResize: function (zoom) {
            // manually resize pages width/height
            var i, len, page,
                state = this.state,
                pages = state.pages;
            for (i = 0, len = pages.length; i < len; ++i) {
                page = pages[i];
                // @NOTE: this.config.pages are page module instances
                this.config.pages[i].resize(zoom, {
                    width: page.actualWidth * zoom,
                    height: page.actualHeight * zoom,
                    paddingTop: page.paddingTop * zoom,
                    paddingRight: page.paddingRight * zoom,
                    paddingBottom: page.paddingBottom * zoom,
                    paddingLeft: page.paddingLeft * zoom
                });
            }
        },

        /**
         * Scroll to the given value (page number or one of the scroll constants)
         * @param   {int|string} val  The value to scroll to
         * @returns {void}
         * @TODO(clakenen): decide whether or not to keep the top, left args
         */
        scrollTo: function (val) {
            var state = this.state,
                pageNum = parseInt(val, 10);
            if (typeof val === 'string') {
                if (val === Crocodoc.SCROLL_PREVIOUS && state.currentPage > 1) {
                    pageNum = this.calculatePreviousPage();
                }
                else if (val === Crocodoc.SCROLL_NEXT && state.currentPage < this.numPages) {
                    pageNum = this.calculateNextPage();
                }
                else if (!pageNum) {
                    return;
                }
            }
            else if (!pageNum && pageNum !== 0) {
                // pageNum is not a number
                return;
            }
            pageNum = util.clamp(pageNum, 1, this.numPages);
            this.scrollToPage(pageNum);
        },

        /**
         * Scrolls by the given pixel amount from the current location
         * @param  {int} top  Top offset to scroll to
         * @param  {int} left Left offset to scroll to
         * @returns {void}
         */
        scrollBy: function (top, left) {
            top = parseInt(top, 10) || 0;
            left = parseInt(left, 10) || 0;
            this.scrollToOffset(top + this.state.scrollTop, left + this.state.scrollLeft);
        },

        /**
         * Scroll to the given page number
         * @param   {int} page The page number to scroll to
         * @returns {void}
         */
        scrollToPage: function (page) {
            var offset = this.calculateScrollPositionForPage(page);
            this.scrollToOffset(offset.top, offset.left);
        },

        /**
         * Calculate which page is currently the "focused" page.
         * By default, it's just the state's current page.
         * @NOTE: this method will be overridden in most layouts.
         * @returns {int} The current page
         */
        calculateCurrentPage: function () {
            return this.state.currentPage;
        },

        /**
         * Given a page number, return an object with top and left properties
         * of the scroll position for that page
         * @param   {int} pageNum The page number
         * @returns {Object}      The scroll position object
         */
        calculateScrollPositionForPage: function (pageNum) {
            var index = util.clamp(pageNum - 1, 0, this.numPages - 1),
                page = this.state.pages[index];
            return { top: page.y0, left: page.x0 };
        },

        /**
         * Calculates the current range of pages that are visible
         * @returns {Object} Range object with min and max values
         */
        calculateVisibleRange: function () {
            var state = this.state,
                viewportY0 = state.scrollTop,
                viewportY1 = viewportY0 + state.viewportHeight,
                viewportX0 = state.scrollLeft,
                viewportX1 = viewportX0 + state.viewportWidth,
                lowY = util.bisectLeft(state.pages, viewportY0, 'y1'),
                highY = util.bisectRight(state.pages, viewportY1, 'y0'),
                lowX = util.bisectLeft(state.pages, viewportX0, 'x1'),
                highX = util.bisectRight(state.pages, viewportX1, 'x0'),
                low = Math.max(lowX, lowY),
                high = Math.min(highX, highY);
            return util.constrainRange(low, high, this.numPages - 1);
        },

        /**
         * Scroll to the given top and left offset
         * @param   {int} top  The top offset
         * @param   {int} left The left offset
         * @returns {void}
         */
        scrollToOffset: function (top, left) {
            this.$viewport.scrollTop(top);
            this.$viewport.scrollLeft(left);
        },

        /**
         * Set the current page, update the visible pages, and broadcast a
         * pagefocus  message if the given page is not already the current page
         * @param {int} page The page number
         */
        setCurrentPage: function (page) {
            var state = this.state;
            if (state.currentPage !== page) {
                // page has changed
                this.$pagesWrapper.find('.' + CSS_CLASS_CURRENT_PAGE).removeClass(CSS_CLASS_CURRENT_PAGE);
                this.$pages.eq(page - 1).addClass(CSS_CLASS_CURRENT_PAGE);
                state.currentPage = page;
                this.updateVisiblePages();
                scope.broadcast('pagefocus', {
                    page: state.currentPage,
                    numPages: this.numPages,
                    visiblePages: util.extend([], state.visiblePages)
                });
            } else {
                // still update visible pages!
                this.updateVisiblePages();
            }
        },

        /**
         * Calculate and update which pages are visible
         * @returns {void}
         */
        updateVisiblePages: function () {
            var i, len, index, $page, hasVisibleClass,
                state = this.state,
                visibleRange = this.calculateVisibleRange();
            state.visiblePages.length = 0;
            for (i = 0, len = this.$pages.length; i < len; ++i) {
                $page = this.$pages.eq(i);
                hasVisibleClass = $page.hasClass(CSS_CLASS_PAGE_VISIBLE);
                if (i < visibleRange.min || i > visibleRange.max) {
                    if (hasVisibleClass) {
                        $page.removeClass(CSS_CLASS_PAGE_VISIBLE);
                    }
                } else {
                    if (!hasVisibleClass) {
                        $page.addClass(CSS_CLASS_PAGE_VISIBLE);
                    }
                    state.visiblePages.push(i+1);
                }
            }
        },

        /**
         * Update page positions, sizes, and rows
         * @returns {void}
         */
        updatePageStates: function () {
            var state = this.state,
                zoom = state.zoomState.zoom || 1,
                pages = state.pages,
                rows = state.rows,
                scrollTop = this.$viewport.scrollTop(),
                scrollLeft = this.$viewport.scrollLeft(),
                position = this.$el.offset(),
                row = 0, lastY1 = 0,
                oldPadding, style,
                i, len, page,
                pageEl, $pageEl,
                rect, y0, x0;

            rows.length = state.sumWidths = state.sumHeights = 0;
            state.widestPage.totalActualWidth = state.tallestPage.totalActualHeight = 0;

            // update the x/y positions and sizes of each page
            // this is basically used as a cache, since accessing the DOM is slow
            for (i = 0, len = this.$pages.length; i < len; ++i) {
                $pageEl = this.$pages.eq(i);
                pageEl = $pageEl[0];
                rect = pageEl.getBoundingClientRect();
                y0 = rect.top + scrollTop - position.top;
                x0 = rect.left + scrollLeft - position.left;
                page = pages[i] || {
                    index: i
                };

                // stash and remove any padding we added to the pages during the resize zoom
                if (this.zoomStrategy === 'resize') {
                    style = util.getComputedStyle(pageEl);
                    oldPadding = [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft].join(' ');
                    $pageEl.css('padding', '');
                }

                page.paddingLeft = parseFloat($pageEl.css(STYLE_PADDING_LEFT));
                page.paddingRight = parseFloat($pageEl.css(STYLE_PADDING_RIGHT));
                page.paddingTop = parseFloat($pageEl.css(STYLE_PADDING_TOP));
                page.paddingBottom = parseFloat($pageEl.css(STYLE_PADDING_BOTTOM));

                // re-apply the padding we stashed
                if (this.zoomStrategy === 'resize') {
                    $pageEl.css('padding', oldPadding);
                }

                page.width = rect.width;
                page.height = rect.height;
                page.y0 = y0;
                page.y1 = rect.height + y0;
                page.x0 = x0;
                page.x1 = rect.width + x0;

                if (!page.actualWidth) {
                    page.actualWidth = parseFloat(pageEl.getAttribute('data-width'));
                }
                if (!page.actualHeight) {
                    page.actualHeight = parseFloat(pageEl.getAttribute('data-height'));
                }

                page.totalActualWidth = page.actualWidth + page.paddingLeft + page.paddingRight;
                page.totalActualHeight = page.actualHeight + page.paddingTop + page.paddingBottom;

                // it is in the same row as the prev if y0 >= prev y1
                if (lastY1 && Math.abs(y0 - lastY1) < zoom) {
                    row++;
                }
                lastY1 = page.y1;
                if (!rows[row]) {
                    rows[row] = [];
                }
                // all pages are not created equal
                if (page.totalActualWidth > state.widestPage.totalActualWidth) {
                    state.widestPage = page;
                }
                if (page.totalActualHeight > state.tallestPage.totalActualHeight) {
                    state.tallestPage = page;
                }
                state.sumWidths += page.width;
                state.sumHeights += page.height;
                page.row = row;
                pages[i] = page;
                rows[row].push(i);
            }

            state.scrollTop = scrollTop;
            state.scrollLeft = scrollLeft;
            this.setCurrentPage(this.calculateCurrentPage());
        },

        /**
         * Initialize zoom levels and the min and max zoom
         * @returns {void}
         */
        initZoomLevels: function () {
            this.zoomLevels = this.config.zoomLevels || [1];
            this.state.minZoom = this.config.minZoom || this.zoomLevels[0];
            this.state.maxZoom = this.config.maxZoom || this.zoomLevels[this.zoomLevels.length - 1];
        },

        /**
         * Calculate and update the current page
         * @returns {void}
         */
        updateCurrentPage: function () {
            var currentPage = this.calculateCurrentPage();
            this.setCurrentPage(currentPage);
        },

        /**
         * Handle resize messages
         * @param   {Object} data Object containing width and height of the viewport
         * @returns {void}
         */
        handleResize: function (data) {
            var zoom,
                zoomMode = this.state.zoomState.zoomMode;

            this.state.viewportWidth = data.width;
            this.state.viewportHeight = data.height;

            this.updatePageStates();
            this.setZoom(zoomMode);
        },

        /**
         * Handle scroll messages
         * @param   {Object} data Object containing scrollTop and scrollLeft of the viewport
         * @returns {void}
         */
        handleScroll: function (data) {
            this.state.scrollTop = data.scrollTop;
            this.state.scrollLeft = data.scrollLeft;
        },

        /**
         * Handle afterscroll messages (forwarded to handleScroll)
         * @param   {Object} data Object containing scrollTop and scrollLeft of the viewport
         * @returns {void}
         */
        handleAfterscroll: function (data) {
            this.handleScroll(data);
        },

        /**
         * Update the scroll position after a zoom
         * @param {bool} shouldNotCenter Whether or not the scroll position
         *                               should be updated to center the new
         *                               zoom level
         * @returns {void}
         */
        updateScrollPosition: function (shouldNotCenter) {
            var state = this.state,
                zoomState = state.zoomState,
                ratio = zoomState.zoom / zoomState.prevZoom,
                newScrollLeft, newScrollTop;

            // update scroll position
            newScrollLeft = state.scrollLeft * ratio;
            newScrollTop = state.scrollTop * ratio;

            // zoom to center
            if (shouldNotCenter !== true) {
                newScrollTop += state.viewportHeight * (ratio - 1) / 2;
                newScrollLeft += state.viewportWidth * (ratio - 1) / 2;
            }
            this.$viewport.scrollLeft(newScrollLeft);
            this.$viewport.scrollTop(newScrollTop);
        },

        /** MUST BE IMPLEMENTED IN LAYOUT **/
        updateLayout: function () {},
        calculateZoomAutoValue: function () { return 1; }
    };
});
/**
 * @fileoverview layout-horizontal module definition
 * @author clakenen
 */

/*global Crocodoc */

/**
 *
 */
Crocodoc.addModule('layout-horizontal', function (context) {

    'use strict';

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    var util = context.getService('util'),
        browser = context.getService('browser');

    var api = context.mixinModule({}, 'layout-base'),
        base = {
            init: api.init,
            handleResize: api.handleResize,
            handleScroll: api.handleScroll,
            updateLayout: api.updateLayout
        };

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    return util.extend(api, {
        /**
         * Calculate the numeric value for zoom 'auto' for this layout mode
         * @returns {float} The zoom value
         */
        calculateZoomAutoValue: function () {
            var state = this.state,
                fitWidth = this.calculateZoomValue(Crocodoc.ZOOM_FIT_WIDTH),
                fitHeight = this.calculateZoomValue(Crocodoc.ZOOM_FIT_HEIGHT);

            // landscape
            if (state.widestPage.actualWidth > state.tallestPage.actualHeight) {
                return Math.min(fitWidth, fitHeight);
            }
            // portrait
            else {
                if (browser.mobile) {
                    return fitHeight;
                }
                // limit max zoom to 1.0
                return Math.min(1, fitHeight);
            }
        },

        /**
         * Calculate which page is currently the "focused" page.
         * In horizontal mode, this is the page farthest to the left,
         * where at least half of the page is showing.
         * @returns {int} The current page
         */
        calculateCurrentPage: function () {
            var prev, page,
                state = this.state,
                pages = state.pages;

            prev = util.bisectRight(pages, state.scrollLeft, 'x0');
            page = util.bisectRight(pages, state.scrollLeft + (pages[prev].width)/2, 'x0');
            return 1 + page;
        },

        /**
         * Calculates the next page
         * @returns {int} The next page number
         */
        calculateNextPage: function () {
            return this.state.currentPage + 1;
        },

        /**
         * Calculates the previous page
         * @returns {int} The previous page number
         */
        calculatePreviousPage: function () {
            return this.state.currentPage - 1;
        },

        /**
         * Handle resize mesages
         * @param   {Object} data The message data
         * @returns {void}
         */
        handleResize: function (data) {
            base.handleResize.call(this, data);
            this.updateCurrentPage();
        },

        /**
         * Handle scroll mesages
         * @param   {Object} data The message data
         * @returns {void}
         */
        handleScroll: function (data) {
            base.handleScroll.call(this, data);
            this.updateCurrentPage();
        },

        /**
         * Updates the layout elements (pages, doc, etc) CSS
         * appropriately for the current zoom level
         * @returns {void}
         */
        updateLayout: function () {
            var state = this.state,
                zoomState = state.zoomState,
                zoom = zoomState.zoom,
                zoomedWidth = state.sumWidths,
                zoomedHeight = Math.floor(state.tallestPage.totalActualHeight * zoom),
                docWidth = Math.max(zoomedWidth, state.viewportWidth),
                docHeight = Math.max(zoomedHeight, state.viewportHeight),
                wrapWidth = Math.floor(docWidth / zoom),
                wrapHeight = Math.floor(docHeight / zoom);

            if (this.zoomStrategy === 'resize') {
                wrapHeight = docHeight;
                wrapWidth = docWidth;
            }

            this.$pagesWrapper.css({
                height: wrapHeight,
                lineHeight: wrapHeight + 'px',
                width: wrapWidth
            });
            this.$doc.css({
                height: docHeight,
                width: docWidth
            });
        }
    });
});

/**
 * @fileoverview layout-presentation-two-page module definition
 * @author clakenen
 */

/*global Crocodoc */

/**
 * The presentation-two-page layout
 */
Crocodoc.addModule('layout-presentation-two-page', function (scope) {

    'use strict';

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    var util = scope.getService('util');

    var api = scope.mixinModule({}, 'layout-' + Crocodoc.LAYOUT_PRESENTATION),
        base = {
            init: api.init
        };

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    return util.extend(api, {
        /**
         * Initialize the presentation-two-page layout module
         * @param   {Object} config The configuration options for the layout
         * @returns {void}
         */
        init: function (config) {
            config.layout = Crocodoc.LAYOUT_PRESENTATION_TWO_PAGE;
            this.twoPageMode = true;
            base.init.call(this, config);
        }
    });
});
/**
 * @fileoverview layout-presentation module definition
 * @author clakenen
 */

/*global Crocodoc */

/**
 *
 */
Crocodoc.addModule('layout-presentation', function (scope) {

    'use strict';

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    var CSS_CLASS_PAGE_PREFIX = 'crocodoc-page-',
        CSS_CLASS_PAGE_PREV = CSS_CLASS_PAGE_PREFIX + 'prev',
        CSS_CLASS_PAGE_NEXT = CSS_CLASS_PAGE_PREFIX + 'next',
        CSS_CLASS_PAGE_BEFORE = CSS_CLASS_PAGE_PREFIX + 'before',
        CSS_CLASS_PAGE_AFTER = CSS_CLASS_PAGE_PREFIX + 'after',
        CSS_CLASS_PAGE_BEFORE_BUFFER = CSS_CLASS_PAGE_PREFIX + 'before-buffer',
        CSS_CLASS_PAGE_AFTER_BUFFER = CSS_CLASS_PAGE_PREFIX + 'after-buffer',
        PRESENTATION_CSS_CLASSES = [
            CSS_CLASS_PAGE_NEXT,
            CSS_CLASS_PAGE_AFTER,
            CSS_CLASS_PAGE_PREV,
            CSS_CLASS_PAGE_BEFORE,
            CSS_CLASS_PAGE_BEFORE_BUFFER,
            CSS_CLASS_PAGE_AFTER_BUFFER
        ].join(' ');


    var util = scope.getService('util');

    var api = scope.mixinModule({}, 'layout-base'),
        base = {
            init: api.init,
            destroy: api.destroy,
            setCurrentPage: api.setCurrentPage,
            calculateZoomValue: api.calculateZoomValue,
            updateLayout: api.updateLayout
        };

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    return util.extend(api, {
        /**
         * Initialize the presentation layout module
         * @param   {Object} config The configuration options for the layout
         * @returns {void}
         */
        init: function (config) {
            base.init.call(this, config);
            this.updatePageMargins();
            this.updatePageClasses();
        },

        /**
         * Destroy the module
         * @returns {void}
         */
        destroy: function () {
            base.destroy.call(this);
            this.$pages.css({ margin: '', left: '' }).removeClass(PRESENTATION_CSS_CLASSES);
        },

        /**
         * Calculate the numeric value for zoom 'auto' for this layout mode
         * @returns {float} The zoom value
         */
        calculateZoomAutoValue: function () {
            var fitWidth = this.calculateZoomValue(Crocodoc.ZOOM_FIT_WIDTH),
                fitHeight = this.calculateZoomValue(Crocodoc.ZOOM_FIT_HEIGHT);
            return Math.min(fitWidth, fitHeight);
        },

        /**
         * Calculate the numeric value for a given zoom mode (or return the value if it's already numeric)
         * @param   {string} mode The mode to zoom to
         * @returns {float}       The zoom value
         */
        calculateZoomValue: function (mode) {
            var baseVal = base.calculateZoomValue.call(this, mode);
            if (mode === Crocodoc.ZOOM_FIT_WIDTH && this.twoPageMode) {
                baseVal /= 2;
            }
            return baseVal;
        },

        /**
         * Calculate which page is currently the "focused" page.
         * In presentation mode, it's just the state's current page.
         * @returns {int} The current page
         */
        calculateCurrentPage: function () {
            return this.state.currentPage;
        },

        /**
         * Calculates the next page
         * @returns {int} The next page number
         */
        calculateNextPage: function () {
            return this.state.currentPage + (this.twoPageMode ? 2 : 1);
        },

        /**
         * Calculates the previous page
         * @returns {int} The previous page number
         */
        calculatePreviousPage: function () {
            return this.state.currentPage - (this.twoPageMode ? 2 : 1);
        },

        /**
         * Calculates the current range of pages that are visible
         * @returns {Object} Range object with min and max values
         */
        calculateVisibleRange: function () {
            var min = this.state.currentPage - 1,
                max = min + (this.twoPageMode ? 1 : 0);
            return util.constrainRange(min, max, this.numPages);
        },

        /**
         * Set the current page and updatePageClasses
         * @param {int} page The page number
         */
        setCurrentPage: function (page) {
            var index = util.clamp(page - 1, 0, this.numPages);
            base.setCurrentPage.call(this, page);
            this.updatePageClasses(index);
        },

        /**
         * Scroll to the given page number
         * @param   {int} page The page number to scroll to
         * @returns {void}
         */
        scrollToPage: function (page) {
            if (this.twoPageMode) {
                // pick the left page
                page = page - (page+1) % 2;
            }
            this.setCurrentPage(page);
        },

        /**
         * Updates the layout elements (pages, doc, etc) CSS
         * appropriately for the current zoom level
         * @returns {void}
         */
        updateLayout: function () {
            var state = this.state,
                zoomState = state.zoomState,
                zoom = zoomState.zoom,
                page = this.currentPage || 1,
                currentPage = state.pages[page - 1],
                secondPage = this.twoPageMode ? state.pages[page] : currentPage,
                secondPageWidth,
                currentPageWidth,
                currentPageHeight,
                zoomedWidth, zoomedHeight,
                docWidth, docHeight;

            secondPageWidth = secondPage.actualWidth;
            currentPageWidth = currentPage.actualWidth + (this.twoPageMode ? secondPageWidth : 0);
            currentPageHeight = currentPage.actualHeight;

            zoomedWidth = Math.floor((currentPageWidth + currentPage.paddingLeft + secondPage.paddingRight) * zoom);
            zoomedHeight = Math.floor((currentPage.totalActualHeight) * zoom);

            docWidth = Math.max(zoomedWidth, state.viewportWidth);
            docHeight = Math.max(zoomedHeight, state.viewportHeight);

            this.$pagesWrapper.add(this.$doc).css({
                width: docWidth,
                height: docHeight
            });

            this.updatePageMargins();

            if (docWidth > state.viewportWidth || docHeight > state.viewportHeight) {
                this.$el.addClass('crocodoc-scrollable');
            } else {
                this.$el.removeClass('crocodoc-scrollable');
            }
        },

        /**
         * Update page margins for the viewport size and zoom level
         * @returns {void}
         */
        updatePageMargins: function () {
            var i, len, $page, page,
                width, height, left, top, paddingH,
                state = this.state;
            // update pages so they are centered (preserving margins)
            for (i = 0, len = this.$pages.length; i < len; ++i) {
                $page = this.$pages.eq(i);
                page = state.pages[i];

                if (this.twoPageMode) {
                    paddingH = (i % 2 === 1) ? page.paddingRight : page.paddingLeft;
                } else {
                    paddingH = page.paddingRight + page.paddingLeft;
                }
                width = (page.actualWidth + paddingH) * state.zoomState.zoom;
                height = (page.actualHeight + page.paddingTop + page.paddingBottom) * state.zoomState.zoom;

                if (this.twoPageMode) {
                    left = Math.max(0, (state.viewportWidth - width * 2) / 2);
                    if (i % 2 === 1) {
                        left += width;
                    }
                } else {
                    left = (state.viewportWidth - width) / 2;
                }
                top = (state.viewportHeight - height) / 2;

                if (this.zoomStrategy === 'transform') {
                    left /= state.zoomState.zoom || 1;
                    top /= state.zoomState.zoom || 1;
                }

                left = Math.max(left, 0);
                top = Math.max(top, 0);
                $page.css({
                    marginLeft: left,
                    marginTop: top
                });
            }
        },

        /**
         * Update page classes for presentation mode transitions
         * @returns {void}
         */
        updatePageClasses: function () {
            var $pages = this.$pages,
                index = this.state.currentPage - 1,
                next = index + 1,
                prev = index - 1,
                buffer = 20;

            // @TODO: optimize this a bit
            // add/removeClass is expensive, so try using hasClass
            $pages.removeClass(PRESENTATION_CSS_CLASSES);
            if (this.twoPageMode) {
                next = index + 2;
                prev = index - 2;
                $pages.slice(Math.max(prev, 0), index).addClass(CSS_CLASS_PAGE_PREV);
                $pages.slice(next, next + 2).addClass(CSS_CLASS_PAGE_NEXT);
            } else {
                if (prev >= 0) {
                    $pages.eq(prev).addClass(CSS_CLASS_PAGE_PREV);
                }
                if (next < this.numPages) {
                    $pages.eq(next).addClass(CSS_CLASS_PAGE_NEXT);
                }
            }
            $pages.slice(0, index).addClass(CSS_CLASS_PAGE_BEFORE);
            $pages.slice(Math.max(0, index - buffer), index).addClass(CSS_CLASS_PAGE_BEFORE_BUFFER);
            $pages.slice(next).addClass(CSS_CLASS_PAGE_AFTER);
            $pages.slice(next, Math.min(this.numPages, next + buffer)).addClass(CSS_CLASS_PAGE_AFTER_BUFFER);

            /*
            // OPTIMIZATION CODE NOT YET WORKING PROPERLY
            $pages.slice(0, index).each(function () {
                var $p = $(this),
                    i = $p.index(),
                    toAdd = '',
                    toRm = '';
                if (!$p.hasClass(beforeClass.trim())) toAdd += beforeClass;
                if ($p.hasClass(nextClass.trim())) toRm += nextClass;
                if ($p.hasClass(afterClass.trim())) toRm += afterClass;
                if ($p.hasClass(afterBufferClass.trim())) toRm += afterBufferClass;
                if (i >= index - buffer && !$p.hasClass(beforeBufferClass.trim()))
                    toAdd += beforeBufferClass;
                else if ($p.hasClass(beforeBufferClass.trim()))
                    toRm += beforeBufferClass;
                if (i >= prev && !$p.hasClass(prevClass.trim()))
                    toAdd += prevClass;
                else if ($p.hasClass(prevClass.trim()))
                    toRm += prevClass;
                $p.addClass(toAdd).removeClass(toRm);
//                console.log('before', $p.index(), toRm, toAdd);
            });
            $pages.slice(next).each(function () {
                var $p = $(this),
                    i = $p.index(),
                    toAdd = '',
                    toRm = '';
                if (!$p.hasClass(afterClass.trim())) toAdd += afterClass;
                if ($p.hasClass(prevClass.trim())) toRm += prevClass;
                if ($p.hasClass(beforeClass.trim())) toRm += beforeClass;
                if ($p.hasClass(beforeBufferClass.trim())) toRm += beforeBufferClass;
                if (i <= index + buffer && !$p.hasClass(afterBufferClass.trim()))
                    toAdd += afterBufferClass;
                else if ($p.hasClass(afterBufferClass.trim()))
                    toRm += afterBufferClass;
                if (i <= next + 1 && !$p.hasClass(nextClass.trim()))
                    toAdd += nextClass;
                else if ($p.hasClass(nextClass.trim()))
                    toRm += nextClass;
                $p.addClass(toAdd).removeClass(toRm);
//                console.log('after', $p.index(), toRm, toAdd);
            });*/
        }
    });

});
/**
 * @fileoverview layout-vertical-single-column module definition
 * @author clakenen
 */

/*global Crocodoc */

/**
 * The vertical-single-column layout
 */
Crocodoc.addModule('layout-vertical-single-column', function (scope) {

    'use strict';

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    var util = scope.getService('util');

    var api = scope.mixinModule({}, 'layout-' + Crocodoc.LAYOUT_VERTICAL),
        base = {
            init: api.init
        };

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    return util.extend(api, {
        /**
         * Initialize the vertical-single-column layout module
         * @param   {Object} config The configuration options for the layout
         * @returns {void}
         */
        init: function (config) {
            config.layout = Crocodoc.LAYOUT_VERTICAL_SINGLE_COLUMN;
            base.init.call(this, config);
        }
    });
});
/**
 * @fileoverview layout-vertical module definition
 * @author clakenen
 */

/*global Crocodoc */

/**
 * The vertical layout plugin
 */
Crocodoc.addModule('layout-vertical', function (scope) {

    'use strict';

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    var util = scope.getService('util'),
        browser = scope.getService('browser');

    // @TODO(clakenen): refactor mixin logic to make more sense
    var api = scope.mixinModule({}, 'layout-base'),
        base = {
            init: api.init,
            handleResize: api.handleResize,
            handleScroll: api.handleScroll,
            updateLayout: api.updateLayout
        };

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    return util.extend(api, {
        /**
         * Calculate the numeric value for zoom 'auto' for this layout mode
         * @returns {float} The zoom value
         */
        calculateZoomAutoValue: function () {
            var state = this.state,
                fitWidth = this.calculateZoomValue(Crocodoc.ZOOM_FIT_WIDTH),
                fitHeight = this.calculateZoomValue(Crocodoc.ZOOM_FIT_HEIGHT);
            // landscape
            if (state.widestPage.actualWidth > state.tallestPage.actualHeight) {
                // max zoom 1 for vertical mode
                return Math.min(1, fitWidth, fitHeight);
            }
            // portrait
            else {
                if (browser.mobile) {
                    return fitWidth;
                }
                // limit max zoom to 100% of the doc
                return Math.min(1, fitWidth);
            }
        },

        /**
         * Calculate which page is currently the "focused" page.
         * In vertical mode, this is the page at the top (and if multiple columns, the leftmost page),
         * where at least half of the page is showing.
         * @returns {int} The current page
         */
        calculateCurrentPage: function () {
            var prev, page, row,
                state = this.state,
                pages = state.pages;

            prev = util.bisectRight(pages, state.scrollTop, 'y0');
            if (prev < 0) {
                return 1;
            }
            page = util.bisectRight(pages, state.scrollTop + (pages[prev].height)/2, 'y0');
            row = state.rows[pages[page].row];
            return 1 + row[0];

        },

        /**
         * Calculates the next page
         * @returns {int} The next page number
         */
        calculateNextPage: function () {
            var state = this.state,
                row = state.pages[state.currentPage - 1].row,
                nextRow = state.rows[row + 1];
            return nextRow && nextRow[0] + 1 || state.currentPage;
        },

        /**
         * Calculates the previous page
         * @returns {int} The previous page number
         */
        calculatePreviousPage: function () {
            var state = this.state,
                row = state.pages[state.currentPage - 1].row,
                prevRow = state.rows[row - 1];
            return prevRow && prevRow[0] + 1 || state.currentPage;
        },

        /**
         * Handle resize mesages
         * @param   {Object} data The message data
         * @returns {void}
         */
        handleResize: function (data) {
            base.handleResize.call(this, data);
            this.updateCurrentPage();
        },

        /**
         * Handle scroll mesages
         * @param   {Object} data The message data
         * @returns {void}
         */
        handleScroll: function (data) {
            base.handleScroll.call(this, data);
            this.updateCurrentPage();
        },

        /**
         * Updates the layout elements (pages, doc, etc) CSS
         * appropriately for the current zoom level
         * @returns {void}
         */
        updateLayout: function () {
            // vertical stuff
            var state = this.state,
                zoomState = state.zoomState,
                zoom = zoomState.zoom,
                zoomedWidth,
                docWidth,
                wrapWidth,
                wrapHeight;

            zoomedWidth = Math.floor(state.widestPage.totalActualWidth * zoom);
            docWidth = Math.max(zoomedWidth, state.viewportWidth);
            wrapWidth = Math.max(Math.floor(docWidth / zoom), state.widestPage.totalActualWidth);
            if (this.zoomStrategy === 'resize') {
                wrapWidth = docWidth;
            }
            wrapHeight = this.$pagesWrapper.height();
            this.$pagesWrapper.css({
                height: 'auto',
                width: wrapWidth
            });
            wrapHeight = this.$pagesWrapper.height();
            if (this.zoomStrategy !== 'resize') {
                wrapHeight = Math.floor(wrapHeight * zoom);
            }
            this.$doc.css({
                height: Math.max(wrapHeight, state.viewportHeight),
                width: docWidth
            });
        }
    });
});

/**
 * @fileoverview LazyLoader module definition
 * @author clakenen
 * @TODO(clakenen): documentation
 */

/*global Crocodoc, setTimeout, clearTimeout*/

/**
 * LazyLoader module for controlling when pages should be loaded and unloaded
 */
Crocodoc.addModule('lazy-loader', function (scope) {

    'use strict';

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------


    var util = scope.getService('util'),
        browser = scope.getService('browser'),
        api = {},
        pages,
        numPages,
        pagefocusTriggerLoadingTID,
        pageLoadTID,
        pageLoadQueue = [],
        pageLoadRange = 1,
        pageLoadingStopped = true,
        layoutState = {
            page: 1,
            visiblePages: [1]
        };

    var PAGE_LOAD_ERROR_MAX_RETRIES = 1,
        PAGE_LOAD_INTERVAL = (browser.mobile || browser.ielt10) ? 100 : 50, //ms between initiating page loads
        MAX_PAGE_LOAD_RANGE = (browser.mobile || browser.ielt10) ? 8 : 32;

    /**
     * Create and return a range object (eg., { min: x, max: y })
     * for the current pageLoadRange constrained to the number of pages
     * @param  {int} range The range from current page
     * @returns {Object}    The range object
     * @private
     */
    function calculateRange(range) {
        range = range || pageLoadRange;
        var currentIndex = layoutState.page - 1,
            low = currentIndex - range,
            high = currentIndex + range;
        return util.constrainRange(low, high, numPages - 1);
    }

    /**
     * Loop through the pageLoadQueue and load pages sequentially,
     * setting a timeout to run again after PAGE_LOAD_INTERVAL ms
     * until the queue is empty
     * @returns {void}
     * @private
     */
    function pageLoadLoop() {
        var index;
        clearTimeout(pageLoadTID);
        if (pageLoadQueue.length > 0) {
            // found a page to load
            index = pageLoadQueue.shift();
            // @TODO: check if things in the queue are actually not necessary
            api.loadPageIfNecessary(index, function loadPageCallback(error) {
                if (error) {
                    // the page failed for some reason...
                    // put it back in the queue to be loaded again immediately
                    // try reloading a page PAGE_LOAD_ERROR_MAX_RETRIES times before giving up
                    if (pages[index].errorCount < PAGE_LOAD_ERROR_MAX_RETRIES) {
                        pageLoadQueue.unshift(index);
                    } else {
                        pages[index].fail();
                    }
                    pages[index].errorCount++;
                }
                pageLoadTID = setTimeout(pageLoadLoop, PAGE_LOAD_INTERVAL);
            });
        } else {
            stopPageLoadLoop();
        }
    }

    /**
     * Start the page load loop
     * @returns {void}
     * @private
     */
    function startPageLoadLoop() {
        clearTimeout(pageLoadTID);
        pageLoadingStopped = false;
        pageLoadTID = setTimeout(pageLoadLoop, PAGE_LOAD_INTERVAL);
    }

    /**
     * Stop the page load loop
     * @returns {void}
     * @private
     */
    function stopPageLoadLoop() {
        clearTimeout(pageLoadTID);
        pageLoadingStopped = true;
    }

    /**
     * Add a page to the page load queue and start the page
     * load loop if necessary
     * @param  {int} index The index of the page to add
     * @returns {void}
     * @private
     */
    function pushPageLoadQueue(index) {
        pageLoadQueue.push(index);
        if (pageLoadingStopped) {
            startPageLoadLoop();
        }
    }

    /**
     * Clear all pages from the page load queue and stop the loop
     * @returns {void}
     * @private
     */
    function clearPageLoadQueue() {
        pageLoadQueue.length = 0;
        stopPageLoadLoop();
    }

    /**
     * Returns true if the given page index should be loaded, and false otherwise
     * @param   {int} index The page index
     * @returns {bool}      Whether the page should be loaded
     */
    function shouldLoadPage(index) {
        var page = pages[index];

        // does the page exist, and is not already load(ed|ing)?
        if (page && page.shouldLoad()) {

            // within page load range?
            if (indexInRange(index)) {
                return true;
            }

            // is it visible?
            if (pageIsVisible(index)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Returns true if the given page index should be unloaded, and false otherwise
     * @param   {int} index The page index
     * @returns {bool}      Whether the page should be unloaded
     */
    function shouldUnloadPage(index) {

        // within page load range?
        if (indexInRange(index)) {
            return false;
        }

        // is it visible?
        if (pageIsVisible(index)) {
            return false;
        }

        return true;
    }

    /**
     * Returns true if the given index is in the page load range, and false otherwise
     * @param   {int} index The page index
     * @returns {bool}      Whether the page index is in the page load range
     */
    function indexInRange(index) {
        var range = calculateRange();
        if (index >= range.min && index <= range.max) {
            return true;
        }
        return false;
    }

    /**
     * Returns true if the given page is visible, and false otherwise
     * @param   {int} index The page index
     * @returns {bool}      Whether the page is visible
     */
    function pageIsVisible(index) {
        // is it visible?
        return util.inArray(index + 1, layoutState.visiblePages) > -1;
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    return util.extend(api, {
        messages: ['zoom', 'resize', 'pagefocus', 'scroll', 'afterscroll', 'ready'],

        /**
         * Handle framework messages
         * @param {string} name The name of the message
         * @param {Object} data The related data for the message
         * @returns {void}
         */
        onmessage: function (name, data) {
            switch (name) {
                case 'ready':
                    // falls through
                case 'resize':
                    this.loadNecessaryPages();
                    break;
                case 'zoom':
                    this.updateLayoutState(data);
                    this.loadNecessaryPages();
                    break;
                case 'scroll':
                    this.cancelAllLoading();
                    break;
                case 'afterscroll':
                    this.loadNecessaryPages();
                    this.unloadUnnecessaryPages(pageLoadRange);
                    break;
                case 'pagefocus':
                    this.updateLayoutState(data);
                    this.cancelAllLoading();
                    pagefocusTriggerLoadingTID = setTimeout(function () {
                        api.loadNecessaryPages();
                    }, 200);
                    break;
                // no default
            }
        },

        /**
         * Initialize the LazyLoader module
         * @param {Array} pageModules The array of page modules to lazily load
         * @returns {void}
         */
        init: function (pageModules) {
            pages = pageModules;
            numPages = pages.length;
            pageLoadRange = Math.min(MAX_PAGE_LOAD_RANGE, numPages);
        },

        /**
         * Destroy the LazyLoader module
         * @returns {void}
         */
        destroy: function () {
            this.cancelAllLoading();
        },

        /**
         * Updates the current layout state
         * @param   {Object} state The layout state
         * @returns {void}
         */
        updateLayoutState: function (state) {
            layoutState = state;
        },

        /**
         * Queue pages to load in the following order:
         * 1) current page
         * 2) visible pages
         * 3) pages within pageLoadRange of the viewport
         * @returns {void}
         */
        loadNecessaryPages: function () {
            // cancel anything that happens to be loading first
            this.cancelAllLoading();

            // load current page first
            this.queuePageToLoad(layoutState.page - 1);

            // then load pages that are visible in the viewport
            this.loadVisiblePages();

            // then load pages beyond the viewport
            this.loadPagesInRange(pageLoadRange);
        },

        /**
         * Queue pages to load within the given range such that
         * proceeding pages are added before preceding pages
         * @param  {int} range The range to load beyond the current page
         * @returns {void}
         */
        loadPagesInRange: function (range) {
            var i,
                currentIndex = layoutState.page - 1;
            if (range > 0) {
                range = calculateRange(range);
                for (i = currentIndex + 1; i <= range.max; ++i) {
                    this.queuePageToLoad(i);
                }
                for (i = currentIndex - 1; i >= range.min; --i) {
                    this.queuePageToLoad(i);
                }
            }
        },

        /**
         * Queue to load all pages that are visible according
         * to the current layoutState
         * @returns {void}
         */
        loadVisiblePages: function () {
            var i, len;
            for (i = 0, len = layoutState.visiblePages.length; i < len; ++i) {
                this.queuePageToLoad(layoutState.visiblePages[i] - 1);
            }
        },

        /**
         * Add the page at the given index to the page load queue
         * and call the preload function on the page
         * @param  {int} index The index of the page to load
         * @returns {void}
         */
        queuePageToLoad: function (index) {
            if (shouldLoadPage(index)) {
                pages[index].preload();
                pushPageLoadQueue(index);
            }
        },

        /**
         * Clear the page load queue
         * @returns {void}
         */
        cancelAllLoading: function () {
            clearTimeout(pagefocusTriggerLoadingTID);
            clearPageLoadQueue();
        },

        /**
         * Call the load method on the page object at the specified index
         * if the index is within the page load range of the current page,
         * otherwise execture the callback function immediately
         * @param  {int}      index    The index of the page to load
         * @param  {Function} callback Callback function to pass to the page.load() method
         * @returns {void}
         */
        loadPageIfNecessary: function (index, callback) {
            if (shouldLoadPage(index)) {
                pages[index].load().then(callback);
            } else if (util.isFn(callback)) {
                callback();
            }
        },

        /**
         * Call the unload method on the page object at the specified index
         * @param  {int} index The page index
         * @returns {void}
         */
        unloadPage: function (index) {
            var page = pages[index];
            if (page) {
                page.unload();
            }
        },

        /**
         * Unload all pages that are not within the given range
         * @param {int} range The page range
         * @returns {void}
         */
        unloadUnnecessaryPages: function (range) {
            var i, l,
                currentIndex = layoutState.page - 1,
                low = currentIndex - range,
                high = currentIndex + range;

            range = util.constrainRange(low, high, numPages - 1);
            // remove out-of-range SVG from DOM
            for (i = 0, l = pages.length; i < l; ++i) {
                if (shouldUnloadPage(i)) {
                    this.unloadPage(i);
                }
            }
        }

    });
});
/**
 * @fileoverview page-link module
 * @author clakenen
 */

/*global Crocodoc*/

/**
 * page-links module
 */
Crocodoc.addModule('page-links', function (scope) {

    'use strict';

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    var CSS_CLASS_PAGE_LINK = 'crocodoc-page-link';

    var support = scope.getService('support');

    var currentScale = 1,
        $el;

    /**
     * Create a link element given link data
     * @param   {Object} link The link data
     * @returns {void}
     */
    function createLink(link) {
        var $link = $('<a>').addClass(CSS_CLASS_PAGE_LINK),
            left = link.bbox[0],
            top = link.bbox[1],
            attr = {};
        $link.css({
            left: left + 'pt',
            top: top + 'pt',
            width: link.bbox[2] - left + 'pt',
            height: link.bbox[3] - top + 'pt'
        });
        if (link.uri) {
            if (/^http|^mailto/.test(link.uri)) {
                attr.href = encodeURI(link.uri);
                attr.target = '_blank';
            } else {
                // don't embed this link... we don't trust the protocol
                return;
            }
        } else if (link.destination) {
            attr.href = '#page-' + link.destination.pagenum;
        }
        $link.attr(attr);
        $link.data('link', link);
        $link.appendTo($el);
    }

    /**
     * Handle link clicks
     * @param   {Event} ev The event object
     * @returns {void}
     */
    function handleClick(ev) {
        var $link = $(ev.target),
            data = $link.data('link');
        if (data) {
            scope.broadcast('linkclicked', data);
        }
        ev.preventDefault();
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    return {
        /**
         * Initialize the page-links module
         * @param  {Array} links Links configuration array
         * @returns {void}
         */
        init: function (el, links) {
            $el = $(el);
            this.createLinks(links);
            $el.on('click', '.'+CSS_CLASS_PAGE_LINK, handleClick);
        },

        /**
         * Destroy the page-links module
         * @returns {void}
         */
        destroy: function () {
            $el.empty().off('click');
        },

        /**
         * Scale the links layer to the given zoom value
         * @param  {number} zoom The zoom value
         * @returns {void}
         */
        scale: function (zoom) {
            currentScale = zoom;
            if (!$el) {
                return;
            }
            if (support.csstransform) {
                $el.css({
                    transform: 'scale('+zoom+')'
                });
            } else if (support.csszoom) {
                $el.css({
                    zoom: zoom
                });
            }
        },

        /**
         * Create and insert link elements into the element
         * @param   {Array} links Array of link data
         * @returns {void}
         */
        createLinks: function (links) {
            var i, len;
            for (i = 0, len = links.length; i < len; ++i) {
                createLink(links[i]);
            }
        }
    };
});
/**
 * @fileoverview page-svg module
 * @author clakenen
 */

/*global Crocodoc */

/**
 * page-svg module
 */
Crocodoc.addModule('page-svg', function (scope) {

    'use strict';

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    var HTML_TEMPLATE = '<link rel="stylesheet" href="{{css}}"/>' +
                        '<style>html, body { width:100%; height: 100%; margin: 0; overflow: hidden; }</style>',
        PROXY_SCRIPT_TEMPLATE = '<script type="text/javascript" src="data:text/javascript;base64,{{encodedScript}}"></script>',
        SVG_CONTAINER_TEMPLATE = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"><script><![CDATA[('+proxySVG+')()]]></script></svg>',

        // Embed the svg in an iframe (initialized to about:blank), and inject
        // the SVG directly to the iframe window using document.write()
        // @NOTE: this breaks images in Safari because [?]
        EMBED_STRATEGY_DOCUMENT_WRITE = 1,

        // Embed the svg with a data-url
        // @NOTE: ff allows direct script access to objects embedded with a data url,
        //        and this method prevents a throbbing spinner because document.write
        //        causes a spinner in ff
        // @NOTE: NOT CURRENTLY USED - this breaks images in firefox because:
        //        https://bugzilla.mozilla.org/show_bug.cgi?id=922433
        EMBED_STRATEGY_DATA_URL = 2,

        // Embed the svg directly in html via inline svg.
        // @NOTE: NOT CURRENTLY USED -  seems to be slow everywhere, but I'm keeping
        //        this here because it's very little extra code, and inline SVG might
        //        be better some day?
        EMBED_STRATEGY_INLINE_SVG = 3,

        // Embed the svg directly with an object tag; don't replace linked resources
        // @NOTE: NOT CURRENTLY USED - this is only here for testing purposes, because
        //        it works in every browser; it doesn't support query string params
        //        and causes a spinner
        EMBED_STRATEGY_BASIC_OBJECT = 4,

        // Embed the svg directly with an img tag; don't replace linked resources
        // @NOTE: NOT CURRENTLY USED - this is only here for testing purposes
        EMBED_STRATEGY_BASIC_IMG = 5,

        // Embed a proxy svg script as an object tag via data:url, which exposes a
        // loadSVG method on its contentWindow, then call the loadSVG method directly
        // with the svg text as the argument
        // @NOTE: only works in firefox because of its security policy on data:uri
        EMBED_STRATEGY_DATA_URL_PROXY = 6,

        // Embed in a way similar to the EMBED_STRATEGY_DATA_URL_PROXY, but in this
        // method we use an iframe initialized to about:blank and document.write()
        // the proxy script before calling loadSVG on the iframe's contentWindow
        // @NOTE: this is a workaround for the image issue with EMBED_STRATEGY_DOCUMENT_WRITE
        //        in safari; it also works in firefox, but causes a spinner because of
        //        document.write()
        EMBED_STRATEGY_IFRAME_PROXY = 7;

    var util = scope.getService('util'),
        browser = scope.getService('browser'),
        DOMParser = window.DOMParser;

    var $svg, $el,
        config, baseURL,
        svgSrc, cssSrc,
        queryString, svgText,
        destroyed = false,
        svgLoaded = false,
        removeOnUnload = (browser.ie && browser.version < 10) || browser.mobile,
        embedStrategy = browser.firefox ? EMBED_STRATEGY_DATA_URL_PROXY :
                        browser.safari ? EMBED_STRATEGY_IFRAME_PROXY :
                        EMBED_STRATEGY_DOCUMENT_WRITE;

    /**
     * Create and return a jQuery object for the SVG element
     * @returns {Object} The SVG $element
     * @private
     */
    function createSVGEl() {
        switch (embedStrategy) {
            case EMBED_STRATEGY_DOCUMENT_WRITE:
            case EMBED_STRATEGY_IFRAME_PROXY:
                return $('<iframe>');

            case EMBED_STRATEGY_DATA_URL_PROXY:
            case EMBED_STRATEGY_DATA_URL:
                return $('<object>').attr({
                    type: 'image/svg+xml',
                    data: 'data:image/svg+xml;base64,' + window.btoa(SVG_CONTAINER_TEMPLATE)
                });

            case EMBED_STRATEGY_INLINE_SVG:
                // just return a div with 100% w/h and the svg will be inserted on load
                return $('<div style="width:100%; height:100%"">');

            case EMBED_STRATEGY_BASIC_OBJECT:
                return $('<object>');

            case EMBED_STRATEGY_BASIC_IMG:
                return $('<img width="100%" height="100%">');

            // no default
        }
    }

    /**
     * Create the svg element if it hasn't been created,
     * insert the SVG into the DOM if necessary
     * @returns {void}
     * @private
     */
    function prepareSVG() {
        if (!$svg || $svg.length === 0) {
            svgLoaded = false;
            $svg = createSVGEl();
        }
        if ($svg.parent().length === 0) {
            $svg.appendTo($el);
        }
    }

    /**
     * Load svg text and call callback. If there was an error,
     * the error message will be passed as the first arg to the callback function
     * @param   {Function} callback The callback function
     * @returns {void}
     * @private
     */
    function loadSVGText(callback) {
        if (!svgText) {
            $.ajax({ url: svgSrc + queryString })
                .done(function loadSVGTextCallback(r, s, xhr) {
                    // we need to replace & characters in the query string, because they are invalid in SVG
                    var query = queryString.replace('&', '&#38;');
                    var text = xhr.responseText;
                    // if the response comes back empty,
                    if (!text) {
                        callback('SVG response was empty');
                        return;
                    }

                    // modify urls for absolute path
                    text = text.replace(/href="([^"#:]*)"/g, function(match, group){
                        return 'href="' + baseURL + group + query + '"';
                    });
                    text = text.replace(/url\(\"([^"#:]*)\"\)/g, function(match, group){
                        return 'url("' + baseURL + group + query + '")';
                    });

                    svgText = text;
                    callback();
                })
                .fail(function loadSVGTextFailCallback(jqXHR, textStatus, error) {
                    svgText = null;
                    callback(error);
                });
        } else {
            callback();
        }
    }


    /**
     * Embed the SVG into the page
     * @returns {void}
     */
    function embedSVG() {
        var domParser, svgDoc, svgEl, html;
        switch (embedStrategy) {
            case EMBED_STRATEGY_DOCUMENT_WRITE:
                // @NOTE: IE 9 fix. This line in the file is causing the page not to render in IE 9.
                // The link is not needed here anymore because we are including the stylesheet separately.
                if (browser.ie && browser.version < 10) {
                    svgText = svgText.replace(/<xhtml:link.*/,'');
                }
                html = util.template(HTML_TEMPLATE, { css: cssSrc + queryString }) + svgText;
                svgDoc = $svg[0].contentDocument;
                svgDoc.open();
                svgDoc.write(html);
                svgDoc.close();
                svgEl = svgDoc.getElementsByTagName('svg')[0];
                break;

            case EMBED_STRATEGY_IFRAME_PROXY:
                html = util.template(HTML_TEMPLATE, { css: cssSrc + queryString }) +
                       util.template(PROXY_SCRIPT_TEMPLATE, { encodedScript: window.btoa('('+proxySVG+')()') });
                svgDoc = $svg[0].contentDocument;
                svgDoc.open();
                svgDoc.write(html);
                svgDoc.close();
                if ($svg[0].contentDocument.readyState === 'complete') {
                    $svg[0].contentWindow.loadSVG(svgText);
                } else {
                    $svg[0].contentWindow.onload = function () {
                        this.loadSVG(svgText);
                    };
                }
                return;

            case EMBED_STRATEGY_DATA_URL:
                domParser = new DOMParser();
                svgDoc = domParser.parseFromString(svgText, 'image/svg+xml');
                svgEl = $svg[0].contentDocument.importNode(svgDoc.documentElement, true);
                $svg[0].contentDocument.documentElement.appendChild(svgEl);
                break;

            case EMBED_STRATEGY_DATA_URL_PROXY:
                $svg[0].contentWindow.loadSVG(svgText);
                svgEl = $svg[0].contentDocument.querySelector('svg');
                break;

            case EMBED_STRATEGY_INLINE_SVG:
                domParser = new DOMParser();
                svgDoc = domParser.parseFromString(svgText, 'image/svg+xml');
                svgEl = document.importNode(svgDoc.documentElement, true);
                $svg.append(svgEl);
                break;

            case EMBED_STRATEGY_BASIC_OBJECT:
                $svg.attr({
                    type: 'image/svg+xml',
                    data: svgSrc + queryString
                });
                // @NOTE: return here because there's no svgEl to set width and height on
                return;

            case EMBED_STRATEGY_BASIC_IMG:
                $svg.attr({
                    src: svgSrc + queryString
                });
                // @NOTE: return here because there's no svgEl to set width and height on
                return;

            // no default
        }

        // make sure the svg width/height are explicity set to 100%
        svgEl.setAttribute('width', '100%');
        svgEl.setAttribute('height', '100%');
    }

    /**
     * Creates a global method for loading svg text into the proxy svg object
     * @NOTE: this function should never be called directly in this context;
     * it's converted to a string and encoded into the proxy svg data:url
     * @returns {void}
     */
    function proxySVG() {
        window.loadSVG = function (svgText) {
            var domParser = new window.DOMParser(),
                svgDoc = domParser.parseFromString(svgText, 'image/svg+xml'),
                svgEl = document.importNode(svgDoc.documentElement, true);
            // make sure the svg width/height are explicity set to 100%
            svgEl.setAttribute('width', '100%');
            svgEl.setAttribute('height', '100%');

            if (document.body) {
                document.body.appendChild(svgEl);
            } else {
                document.documentElement.appendChild(svgEl);
            }
        };
    }

    /**
     * Function to call when loading is complete (success or not)
     * @param   {*} error Error param; if truthy, assume there was an error
     * @returns {void}
     */
    function completeLoad(error) {
        if (error) {
            svgLoaded = false;
        } else {
            if ($svg.parent().length === 0) {
                $svg.appendTo($el);
            }
            $svg.show();
            svgLoaded = true;
        }
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------


    return {
        /**
         * Initialize the page-svg module
         * @param  {Object} conf Configuration object
         * @returns {void}
         */
        init: function (el, conf) {
            $el = $(el);
            config = conf;
            baseURL = config.url;
            svgSrc = config.svgSrc;
            cssSrc = config.cssSrc;
            queryString = config.queryString || '';
            embedStrategy = config.viewerConfig.embedStrategy || embedStrategy;
        },

        /**
         * Destroy the page-svg module
         * @returns {void}
         */
        destroy: function () {
            destroyed = true;
            $el.empty();
        },

        /**
         * Prepare the SVG object to be loaded
         * @returns {void}
         */
        preload: function () {
            prepareSVG();
        },

        /**
         * Load the SVG and call callback when complete.
         * If there was an error, callback's first argument will be
         * an error message, and falsy otherwise.
         * @returns {$.Deferred}    A jQuery Deferred object
         */
        load: function () {
            var $deferred = $.Deferred();

            if (svgLoaded) {
                completeLoad();
                $deferred.resolve();
            } else {
                prepareSVG();
                if (embedStrategy === EMBED_STRATEGY_BASIC_OBJECT ||
                    embedStrategy === EMBED_STRATEGY_BASIC_IMG)
                {
                    // don't load the SVG text, just embed the object with
                    // the source pointed at the correct location
                    embedSVG();
                    completeLoad();
                    $deferred.resolve();
                } else {
                    loadSVGText(function loadSVGTextCallback(error) {
                        if (destroyed) {
                            return;
                        }
                        if (error || !$svg || $svg.length === 0) {
                            completeLoad(error);
                            $deferred.reject(error);
                        } else {
                            embedSVG();
                            completeLoad();
                            $deferred.resolve();
                        }
                    });
                }
            }
            return $deferred;
        },

        /**
         * Unload (or hide) the SVG object
         * @returns {void}
         */
        unload: function () {
            if (removeOnUnload) {
                $svg.remove();
                $svg = null;
                svgLoaded = false;
            } else {
                $svg.hide();
            }
        }
    };
});
/**
 * @fileoverview page-text module
 * @author clakenen
 */

/*global Crocodoc*/

/**
 * page-text module
 */
Crocodoc.addModule('page-text', function (scope) {

    'use strict';

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    var CSS_CLASS_PAGE_TEXT = 'crocodoc-page-text';

    var browser = scope.getService('browser'),
        support = scope.getService('support'),
        subpx   = scope.getService('subpx');

    var loaded = false,
        loading = false,
        currentScale = 1,
        $el, src, config;

    /**
     * Return true if we should use the text layer, false otherwise
     * @returns {bool}
     * @private
     */
    function shouldUseTextLayer() {
        // @TODO(clakenen): refactor this so that it doesn't depend on the viewerConfig object
        return config.viewerConfig.enableTextSelection && !browser.ielt9;
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    return {
        /**
         * Initialize the page-text module
         * @param  {Object} conf Configuration options
         * @returns {void}
         */
        init: function (el, conf) {
            $el = $(el);
            config = conf;
            src = config.textSrc + config.queryString;
        },

        /**
         * Destroy the page-text module
         * @returns {void}
         */
        destroy: function () {
            $el.empty();
        },

        /**
         * Load the html text for the text layer and insert it into the element
         * if text layer is enabled and is not loading/has not already been loaded
         * @returns {void}
         */
        load: function () {
            var self = this;
            if (shouldUseTextLayer() && !loaded && !loading) {
                loading = true;
                // get the html for the text layer, selecting just the element we want (.crocodoc-page-text)
                // @TODO(clakenen -> plai): the html asset should just be the html necessary, so I don't have to do this nonsense
                // @TODO(clakenen): handle failure case
                $('<div>').load(src + ' .' + CSS_CLASS_PAGE_TEXT, function loadTextHTMLCallback(responseText, textStatus) {
                    if (textStatus !== 'success') {
                        loading = false;
                        return;
                    }
                    var $text = $(this).children().unwrap();
                    $el.attr('class', $text.attr('class'));
                    $el.html($text.html());
                    subpx.fix($el);

                    loaded = true;
                    loading = false;
                });
            }
        },

        /**
         * Scale the text layer to the given zoom value
         * @param  {number} zoom The zoom value
         * @returns {void}
         */
        scale: function (zoom) {
            currentScale = zoom;
            if (!$el) {
                return;
            }
            if (support.csstransform) {
                $el.css({
                    transform: 'scale('+zoom+')',
                    width: (100/zoom)+'%',
                    height: (100/zoom)+'%'
                });
            } else if (support.csszoom) {
                $el.css({
                    zoom: zoom
                });
            }
        },

        /**
         * Enable text selection
         * @returns {void}
         */
        enable: function () {
            $el.css('display', '');
        },

        /**
         * Disable text selection
         * @returns {void}
         */
        disable: function () {
            $el.css('display', 'none');
        }
    };
});
/**
 * @fileoverview Page module
 * @author clakenen
 */

/*global Crocodoc */

/**
 * Page module
 */
Crocodoc.addModule('page', function (scope) {

    'use strict';

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------
    var $el, $deferred,
        pageText, pageSVG, pageLinks,
        pageNum, index,
        isVisible, status, pageScale,
        shouldLoad = false;

    var CSS_CLASS_PAGE_PREFIX = 'crocodoc-page-',
        CSS_CLASS_PAGE_INNER = CSS_CLASS_PAGE_PREFIX + 'inner',
        CSS_CLASS_PAGE_LOADING = CSS_CLASS_PAGE_PREFIX + 'loading',
        CSS_CLASS_PAGE_ERROR = CSS_CLASS_PAGE_PREFIX + 'error',
        CSS_CLASS_PAGE_TEXT = CSS_CLASS_PAGE_PREFIX + 'text',
        CSS_CLASS_PAGE_SVG = CSS_CLASS_PAGE_PREFIX + 'svg',
        CSS_CLASS_PAGE_LINKS = CSS_CLASS_PAGE_PREFIX + 'links',
        CSS_CLASS_PAGE_OVERLAY = CSS_CLASS_PAGE_PREFIX + 'overlay';

    return {
        messages: ['pageavailable', 'textenabledchange', 'pagefocus'],

        /**
         * Handle framework messages
         * @param {string} name The name of the message
         * @param {Object} data The related data for the message
         * @returns {void}
         */
        onmessage: function (name, data) {
            switch (name) {
                case 'pageavailable':
                    if (data.page === index + 1 || data.upto > index) {
                        if (status === Crocodoc.PAGE_STATUS_CONVERTING) {
                            status = Crocodoc.PAGE_STATUS_NOT_LOADED;
                            this.loadIfNecessary();
                        }
                    }
                    break;
                case 'textenabledchange':
                    if (data.enabled === true) {
                        this.enableTextSelection();
                    } else {
                        this.disableTextSelection();
                    }
                    break;
                case 'pagefocus':
                    isVisible = pageNum === data.page || (pageNum in data.visiblePages);
                    break;

                // no default
            }
        },

        /**
         * Initialize the Page module
         * @returns {void}
         */
        init: function (el, config) {
            var $text, $svg, $inner, $overlay, $links;
            $el = $(el);
            $inner = $el.find('.' + CSS_CLASS_PAGE_INNER);
            $overlay = $inner.find('.' + CSS_CLASS_PAGE_OVERLAY);
            $svg = $inner.find('.' + CSS_CLASS_PAGE_SVG);
            $text = $inner.find('.' + CSS_CLASS_PAGE_TEXT);
            $links = $inner.find('.' + CSS_CLASS_PAGE_LINKS);

            config.url = config.url || '';
            pageText = scope.createModuleInstance('page-text');
            pageSVG = scope.createModuleInstance('page-svg');
            pageLinks = scope.createModuleInstance('page-links');
            pageText.init($text, config);
            pageSVG.init($svg, config);
            pageLinks.init($links, config.links);

            status = config.status || Crocodoc.PAGE_STATUS_NOT_LOADED;
            index = config.index;
            pageNum = index + 1;
            pageScale = config.pageScale || 1;
            this.resize(1);
        },

        /**
         * Return true if the page should load, false otherwise
         * (eg., it's not already loaded and it's not converting)
         * @returns {bool}   Whether or not the page should load
         */
        shouldLoad: function () {
            return status === Crocodoc.PAGE_STATUS_NOT_LOADED || status === Crocodoc.PAGE_STATUS_CONVERTING;
        },

        /**
         * Preload the SVG if the page is not loaded
         * @returns {void}
         */
        preload: function () {
            if (status === Crocodoc.PAGE_STATUS_NOT_LOADED) {
                pageSVG.preload();
            }
        },

        /**
         * Load and show SVG and text assets for this page
         * @returns {$.Deferred}    jQuery Deferred object
         */
        load: function () {
            shouldLoad = true;

            //already loaded or page converting?
            if (status !== Crocodoc.PAGE_STATUS_NOT_LOADED) {
                return;
            }

            //load page
            status = Crocodoc.PAGE_STATUS_LOADING;
            $deferred = $.when(pageText.load(), pageSVG.load())
                .done(function handleLoadDone() {
                    status = Crocodoc.PAGE_STATUS_LOADED;
                    $el.removeClass(CSS_CLASS_PAGE_LOADING);
                    scope.broadcast('pageload', { page: pageNum });
                })
                .fail(function handleLoadFail(error) {
                    if (error === 'canceled') {
                        return;
                    }
                    status = Crocodoc.PAGE_STATUS_ERROR;
                    $el.removeClass(CSS_CLASS_PAGE_LOADING).addClass(CSS_CLASS_PAGE_ERROR);
                    scope.broadcast('pageerror', { page: pageNum, error: 'Error loading page: ' + error });
                });

            return $deferred;
        },

        /**
         * Call load() if shouldLoad is true
         * This could be the case if the page was converting, then finished
         * at a point when load (and not unload) had been called
         * @returns {void}
         * @TODO: refactor this (shouldLoad is used twice for two different things)
         */
        loadIfNecessary: function () {
            if (shouldLoad) {
                this.load();
            }
        },

        /**
         * Unload/hide SVG and text assets for this page
         * @returns {void}
         */
        unload: function () {
            shouldLoad = false;
            if (status === Crocodoc.PAGE_STATUS_LOADING) {
                $deferred.rejectWith('canceled');
            }
            if (status === Crocodoc.PAGE_STATUS_LOADED) {
                pageSVG.unload();
                status = Crocodoc.PAGE_STATUS_NOT_LOADED;
                $el.addClass(CSS_CLASS_PAGE_LOADING);
                scope.broadcast('pageunload', { page: pageNum });
            }
        },

        /**
         * Resize the page to the given width and height
         * NOTE: zoom is used to scale the text layer, as text
         * won't scale proportionately with width and height
         * @param  {number} zoom The zoom value
         * @param {Object} css   The CSS object to apply
         * @returns {void}
         */
        resize: function (zoom, css) {
            pageText.scale(zoom * pageScale);
            pageLinks.scale(zoom * pageScale);
            if (css) {
                $el.css(css);
            }
        },

        /**
         * Enable text selection, loading text assets if the page is visible
         * @returns {void}
         */
        enableTextSelection: function () {
            if (isVisible) {
                pageText.load();
            }
            pageText.enable();
        },

        /**
         * Disable text selection
         * @returns {void}
         */
        disableTextSelection: function () {
            pageText.disable();
        }
    };
});


/**
 * @fileoverview Resizer module used to watch an element and fire
 * an event when the object's width or height changes
 * @author clakenen
 */

/*global Crocodoc, window, document*/

Crocodoc.addModule('resizer', function (scope) {

    'use strict';

    var util = scope.getService('util'),
        support = scope.getService('support');

    var FULLSCREENCHANGE_EVENT = ['webkit',' moz', ' ', ''].join('fullscreenchange');

    var element,
        currentHeight,
        currentWidth,
        resizeFrameID;

    /**
     * Fire the resize event with the proper data
     * @returns {void}
     * @private
     */
    function broadcast() {
        scope.broadcast('resize', {
            width: currentWidth,
            height: currentHeight
        });
    }

    /**
     * Check if the element has resized every animation frame
     * @returns {void}
     * @private
     */
    function loop() {
        checkResize();
        resizeFrameID = support.requestAnimationFrame(loop, element);
    }

    /**
     * Check if the element has resized, and broadcast the resize event if so
     * @returns {void}
     * @private
     */
    function checkResize () {
        var newHeight = element.clientHeight || element.innerWidth,
            newWidth = element.clientWidth || element.innerHeight;
        //on touch devices, the offset height is sometimes zero as content is loaded
        if (newHeight) {
            if (newHeight !== currentHeight || newWidth !== currentWidth) {
                currentHeight = newHeight;
                currentWidth = newWidth;
                broadcast();
            }
        }
    }

    return {
        messages: ['ready'],

        onmessage: function (name, data) {
            if (name === 'ready') {
                // broadcast initial resize event
                loop();
            }
        },

        /**
         * Initialize the Resizer module with an element to watch
         * @param  {HTMLElement} el The element to watch
         * @returns {void}
         */
        init: function (el) {
            element = $(el).get(0);

            currentHeight = 0;
            currentWidth = 0;

           $(document).on(FULLSCREENCHANGE_EVENT, broadcast);
        },

        /**
         * Destroy the Resizer module
         * @returns {void}
         */
        destroy: function () {
           $(document).off(FULLSCREENCHANGE_EVENT, broadcast);
            support.cancelAnimationFrame(resizeFrameID);
        }
    };
});
/**
 * @fileoverview Scroller module used to watch an element and fire
 *               events on scroll ('scroll') and after scrolling stops ('afterscroll')
 * @author clakenen
 */

/*global Crocodoc, setTimeout, clearTimeout */

Crocodoc.addModule('scroller', function (scope) {

    'use strict';

    var util = scope.getService('util'),
        browser = scope.getService('browser');

    var GHOST_SCROLL_TIMEOUT = 3000,
        GHOST_SCROLL_INTERVAL = 30,
        SCROLL_EVENT_THROTTLE_INTERVAL = 200,
        AFTER_SCROLL_TIMEOUT = browser.mobile ? 500 : 250;

    var $el,
        afterScrollTID,
        touchStarted = false,
        touchEnded = false,
        touchMoved = false,
        touchEndTime = 0,
        ghostScrollStart = null;

        // throttle firing of scroll events
    var throttledFireScroll = util.throttle(fireScroll, SCROLL_EVENT_THROTTLE_INTERVAL);

    /**
     * Handle touch start events
     * @returns {void}
     */
    function handleTouchstart() {
        touchStarted = true;
        touchEnded = false;
        touchMoved = false;
        handleScroll();
    }

    /**
     * Handle touchmove events
     * @returns {void}
     */
    function handleTouchmove() {
        touchMoved = true;
        handleScroll();
    }

    /**
     * Handle touchend events
     * @returns {void}
     */
    function handleTouchend() {
        touchStarted = false;
        touchEnded = true;
        touchEndTime = new Date().getTime();
        if (touchMoved) {
            ghostScroll();
        }
    }

    /**
     * Fire fake scroll events.
     * iOS doesn't fire events during the 'momentum' part of scrolling
     * so this is used to fake these events until the page stops moving.
     * @returns {void}
     */
    function ghostScroll() {
        clearTimeout(afterScrollTID);
        if (ghostScrollStart === null) {
            ghostScrollStart = new Date().getTime();
        }
        if (new Date().getTime() - ghostScrollStart > GHOST_SCROLL_TIMEOUT) {
            handleAfterscroll();
            return;
        }
        throttledFireScroll();
        afterScrollTID = setTimeout(ghostScroll, GHOST_SCROLL_INTERVAL);
    }

    /**
     * Handle scroll events
     * @returns {void}
     */
    function handleScroll() {
        clearTimeout(afterScrollTID);
        afterScrollTID = setTimeout(handleAfterscroll, AFTER_SCROLL_TIMEOUT);
        throttledFireScroll('onscroll');
    }

    /**
     * Handle afterscroll
     * @returns {void}
     */
    function handleAfterscroll() {
        ghostScrollStart = null;
        clearTimeout(afterScrollTID);
        scope.broadcast('afterscroll', buildEventData());
    }

    /**
     * Broadcast a scroll event
     * @returns {void}
     */
    function fireScroll() {
        scope.broadcast('scroll', buildEventData());
    }

    /**
     * Build event data object for firing scroll events
     * @returns {Object} Scroll event data object
     */
    function buildEventData() {
        return {
            scrollTop: $el.scrollTop(),
            scrollLeft: $el.scrollLeft()
        };
    }

    return {
        /**
         * Initialize the scroller module
         * @param   {Element} el The Element
         * @returns {void}
         */
        init: function (el) {
            $el = $(el);
            $el.on('scroll', handleScroll);
            $el.on('touchstart', handleTouchstart);
            $el.on('touchmove', handleTouchmove);
            $el.on('touchend', handleTouchend);
        },

        /**
         * Destroy the scroller module
         * @returns {void}
         */
        destroy: function () {
            clearTimeout(afterScrollTID);
            $el.off('scroll', handleScroll);
            $el.off('touchstart', handleTouchstart);
            $el.off('touchmove', handleTouchmove);
            $el.off('touchend', handleTouchend);
        }
    };
});
/**
 * @fileoverview viewer-api module
 * @author clakenen
 */

/*global window, document*/

Crocodoc.addModule('viewer-api', function (scope) {

    'use strict';

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    var CSS_CLASS_PREFIX = 'crocodoc-',
        CSS_CLASS_VIEWER = CSS_CLASS_PREFIX + 'viewer',
        CSS_CLASS_DOC = CSS_CLASS_PREFIX + 'doc',
        CSS_CLASS_PAGES = CSS_CLASS_PREFIX + 'pages',
        CSS_CLASS_VIEWPORT = CSS_CLASS_PREFIX + 'viewport',
        CSS_CLASS_ZOOMING =  CSS_CLASS_PREFIX + 'zooming',
        CSS_CLASS_SCROLLING =  CSS_CLASS_PREFIX + 'scrolling',
        CSS_CLASS_LOADING =  CSS_CLASS_PREFIX + 'loading',
        CSS_CLASS_TEXT_SELECTED = CSS_CLASS_PREFIX + 'text-selected',
        CSS_CLASS_TEXT_DISABLED = CSS_CLASS_PREFIX + 'text-disabled',
        CSS_CLASS_LINKS_DISABLED = CSS_CLASS_PREFIX + 'links-disabled',
        CSS_CLASS_PAGE = CSS_CLASS_PREFIX + 'page',
        CSS_CLASS_PAGE_INNER = CSS_CLASS_PAGE + '-inner',
        CSS_CLASS_PAGE_SVG = CSS_CLASS_PAGE + '-svg',
        CSS_CLASS_PAGE_TEXT = CSS_CLASS_PAGE + '-text',
        CSS_CLASS_PAGE_LINKS = CSS_CLASS_PAGE + '-links',
        CSS_CLASS_PAGE_OVERLAY = CSS_CLASS_PAGE + '-overlay',
        CSS_CLASS_PAGE_LOADING = CSS_CLASS_PAGE + '-loading',
        CSS_CLASS_MOBILE = CSS_CLASS_PREFIX + 'mobile',
        CSS_CLASS_3D_ENABLED = CSS_CLASS_PREFIX + '3d-enabled',
        CSS_CLASS_IELT9 = CSS_CLASS_PREFIX + 'ielt9',
        CSS_CLASS_SUPPORTS_SVG = CSS_CLASS_PREFIX + 'supports-svg';

    var PAGE_HTML_TEMPLATE =
        '<div class="' + CSS_CLASS_PAGE + ' ' + CSS_CLASS_PAGE_LOADING + '" ' +
            'style="width:{{w}}px; height:{{h}}px;" data-width="{{w}}" data-height="{{h}}">' +
            '<div class="' + CSS_CLASS_PAGE_INNER + '">' +
                '<div class="' + CSS_CLASS_PAGE_SVG + '"></div>' +
                '<div class="' + CSS_CLASS_PAGE_OVERLAY + '"></div>' +
                '<div class="' + CSS_CLASS_PAGE_TEXT + '"></div>' +
                '<div class="' + CSS_CLASS_PAGE_LINKS + '"></div>' +
            '</div>' +
        '</div>';

    // the width to consider the 100% zoom level; zoom levels are calculated based
    // on this width relative to the actual document width
    var DOCUMENT_100_PERCENT_WIDTH = 1024;

    var util = scope.getService('util'),
        browser = scope.getService('browser'),
        support = scope.getService('support');

    var api = new Crocodoc.EventTarget(),
        // undocumented defaults
        config = {
            // template for loading assets... this should rarely (if ever) change
            template: {
                svg: 'page-{{page}}.svg',
                html: 'text-{{page}}.html',
                css: 'stylesheet.css',
                json: 'info.json'
            },

            //------------------------------------
            // EXPERIMENTAL/NOT FULLY SUPPORTED
            //------------------------------------

            queryParams: null,

            // @TODO (clakenen): consider renaming this
            ready: true,


            //------------------------------------
            // TO BE REMOVED
            //------------------------------------
            zoom: Crocodoc.ZOOM_AUTO,

            // @TODO (clakenen): probably should just remove these params
            pageStart: null,
            pageEnd: null,

            // zoom levels are relative to the viewport size,
            // and the dynamic zoom levels (auto, fitwidth, etc) will be added into the mix
            zoomLevels: [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0]
        },
        $el,
        stylesheet,
        queryString,
        lazyLoader,
        layout,
        scroller,
        resizer,
        destroyed = false;

    /**
     * Load the document metadata
     * @param  {Function} callback Callback to call on success
     * @returns {void}
     */
    function loadMetadata(callback) {
        var infoURL;
        // check if the files were specified or if we
        // should build the file paths from config.url
        if (config.url) {
            infoURL = util.makeAbsolute(config.url) + config.template.json;
        } else {
            throw new Error('No URL specified.');
        }
        $.getJSON(infoURL + queryString)
            .done(function loadMetadataSuccessHandler(response) {
                if (destroyed) {
                    return;
                }
                callback(response);
            })
            .fail(function loadMetadataFailHandler($xhr, textStatus, error) {
                if (destroyed) {
                    return;
                }
                handleBadMetadata(error);
            });
    }

    /**
     * Insert the document stylesheet into the page
     * @returns {void}
     */
    function loadStylesheet() {
        var stylesheetURL;
        if (config.url) {
            stylesheetURL = util.makeAbsolute(config.url) + config.template.css;
            stylesheet = util.insertStylesheet(stylesheetURL + queryString);
        }
    }

    /**
     * Add CSS classes to the element for necessary feature/support flags
     * @returns {void}
     */
    function setCSSFlags() {
        config.enable3dTransforms = false;
        //add CSS flags
        if (browser.mobile) {
            $el.addClass(CSS_CLASS_MOBILE);      //Mobile?
            config.enable3dTransforms = true;
        }
        if (browser.firefox) {
            config.enable3dTransforms = true;
        }
        if (config.enable3dTransforms) {
            $el.addClass(CSS_CLASS_3D_ENABLED);  //Use 3d transformations?
        }
        if (browser.ielt9) {
            $el.addClass(CSS_CLASS_IELT9);       //IE7 or IE8?
        }
        if (support.svg) {
            $el.addClass(CSS_CLASS_SUPPORTS_SVG);
        }
    }

    /**
     * Validates the config options
     * @returns {void}
     */
    function validateConfig() {
        var metadata = config.metadata;
        config.numPages = metadata.numpages;
        if (!config.pageStart) {
            config.pageStart = 1;
        } else if (config.pageStart < 0) {
            config.pageStart = metadata.numpages + config.pageStart;
        }
        config.pageStart = util.clamp(config.pageStart, 1, metadata.numpages);
        if (!config.pageEnd) {
            config.pageEnd = metadata.numpages;
        } else if (config.pageEnd < 0) {
            config.pageEnd = metadata.numpages + config.pageEnd;
        }
        config.pageEnd = util.clamp(config.pageEnd, config.pageStart, metadata.numpages);
        config.numPages = config.pageEnd - config.pageStart + 1;
    }

    /**
     * Create and insert basic viewer DOM structure
     * @returns {void}
     */
    function initViewerHTML() {
        // create viewer HTML
        config.$viewport = $('<div tabindex="-1">').addClass(CSS_CLASS_VIEWPORT);
        config.$doc = $('<div>').addClass(CSS_CLASS_DOC);
        config.$pagesWrapper = $('<div>').addClass(CSS_CLASS_PAGES);

        config.$doc.append(config.$pagesWrapper);
        config.$viewport.append(config.$doc);
        $el.html(config.$viewport);
    }

    /**
     * Create the html skeleton for the viewer and pages
     * @returns {void}
     */
    function prepareDOM() {
        var i, pageNum,
            zoomLevel, maxZoom,
            ptWidth, ptHeight,
            pxWidth, pxHeight,
            pt2px = util.calculatePtSize(),
            dimensions = config.metadata.dimensions,
            skeleton = '';

        // adjust page scale if the pages are too small/big
        // it's adjusted so 100% == DOCUMENT_100_PERCENT_WIDTH px;
        config.pageScale = DOCUMENT_100_PERCENT_WIDTH / (dimensions.width * pt2px);

        // add zoom levels to accomodate the scale
        zoomLevel = config.zoomLevels[config.zoomLevels.length - 1];
        maxZoom = 3 / config.pageScale;
        while (zoomLevel < maxZoom) {
            zoomLevel += zoomLevel / 2;
            config.zoomLevels.push(zoomLevel);
        }

        dimensions.exceptions = dimensions.exceptions || {};

        // create skeleton
        for (i = config.pageStart - 1; i < config.pageEnd; i++) {
            pageNum = i + 1;
            if (pageNum in dimensions.exceptions) {
                ptWidth = dimensions.exceptions[pageNum].width;
                ptHeight = dimensions.exceptions[pageNum].height;
            } else {
                ptWidth = dimensions.width;
                ptHeight = dimensions.height;
            }
            pxWidth = ptWidth * pt2px;
            pxHeight = ptHeight * pt2px;
            pxWidth *= config.pageScale;
            pxHeight *= config.pageScale;
            skeleton += util.template(PAGE_HTML_TEMPLATE, {
                w: pxWidth,
                h: pxHeight
            });
        }

        // insert skeleton and keep a reference to the jq object
        config.$pages = $(skeleton).appendTo(config.$pagesWrapper);
    }

    /**
     * Complete intialization after document metadata has been loaded;
     * ie., bind events, init lazyloader and layout, broadcast ready message
     * @returns {[type]} [description]
     */
    function completeInit() {
        // create viewer skeleton
        prepareDOM();

        // setup pages
        createPages();

        loadStylesheet();

        initHandlers();

        // initialize scroller and resizer modules
        scroller = scope.createModuleInstance('scroller');
        scroller.init(config.$viewport);
        resizer = scope.createModuleInstance('resizer');
        resizer.init(config.$viewport);

        // Setup lazy loader and layout manager
        lazyLoader = scope.createModuleInstance('lazy-loader');
        lazyLoader.init(config.pages);

        // disable links if necessary
        if (!config.enableLinks) {
            api.disableLinks();
        }

        $el.removeClass(CSS_CLASS_LOADING);

        // set the initial layout
        api.setLayout(config.layout);

        // broadcast ready message
        scope.broadcast('ready', {
            page: config.page || 1,
            numPages: config.numPages
        });
    }

    /**
     * Create and init all necessary page module instances
     * @returns {void}
     */
    function createPages() {
        var i,
            currentPage = 0,
            pages = [],
            page,
            svgSrc,
            textSrc,
            cssSrc,
            start = config.pageStart - 1,
            end = config.pageEnd,
            url = util.makeAbsolute(config.url),
            status = config.ready ? Crocodoc.PAGE_STATUS_NOT_LOADED : Crocodoc.PAGE_STATUS_CONVERTING,
            links = sortPageLinks();

        //initialize pages
        for (i = start; i < end; i++) {
            svgSrc = url + util.template(config.template.svg, {page: i + 1});
            textSrc = url + util.template(config.template.html, {page: i + 1});
            cssSrc = url + config.template.css;
            page = scope.createModuleInstance('page');
            page.init(config.$pages.eq(i - start), {
                index: i,
                url: url,
                svgSrc: svgSrc,
                textSrc: textSrc,
                cssSrc: cssSrc,
                status: status,
                queryString: queryString,
                viewerConfig: config,
                links: links[i],
                pageScale: config.pageScale
            });
            pages.push(page);
        }
        config.pages = pages;
    }

    /**
     * Returns all links associated with the given page
     * @param  {int} page The page
     * @returns {Array}   Array of links
     */
    function sortPageLinks() {
        var i, len, link,
            links = config.metadata.links || [],
            sorted = [];

        for (i = 0, len = config.metadata.numpages; i < len; ++i) {
            sorted[i] = [];
        }

        for (i = 0, len = links.length; i < len; ++i) {
            link = links[i];
            sorted[link.pagenum - 1].push(link);
        }

        return sorted;
    }

    /**
     * Init window and document events
     * @returns {void}
     */
    function initHandlers() {
        $(document).on('mouseup', handleMouseUp);
    }

    /**
     * Handler for scroll messages
     * @returns {void}
     */
    function handleScroll() {
        if (!$el.hasClass(CSS_CLASS_SCROLLING)) {
            $el.addClass(CSS_CLASS_SCROLLING);
        }
    }

    /**
     * Handler for afterscroll messages
     * @returns {void}
     */
    function handleAfterScroll() {
        if ($el.hasClass(CSS_CLASS_SCROLLING)) {
            $el.removeClass(CSS_CLASS_SCROLLING);
        }
    }

    /**
     * Handler for linkclicked messages
     * @returns {void}
     */
    function handleLinkClicked(data) {
        if (data.uri) {
            window.open(data.uri);
        } else if (data.destination) {
            api.scrollTo(data.destination.pagenum);
        }
    }

    /**
     * Handler for when document metadata is received
     * @param  {Object} metadata The metadata
     * @returns {void}
     */
    function handleMetadata(metadata) {
        if (!metadata) {
            handleBadMetadata('response was empty');
            return;
        }
        config.metadata = metadata;
        validateConfig();
        completeInit();
    }

    /**
     * Handler for failed loading or empty metadata
     * @param   {string} errorMessage Error message to broadcast
     * @returns {void}
     */
    function handleBadMetadata(errorMessage) {
        errorMessage = errorMessage || 'unknown error';
        scope.broadcast('fail', { error: 'Error loading document metadata: ' + errorMessage });
    }

    /**
     * Handle mouseup events
     * @returns {void}
     */
    function handleMouseUp() {
        updateSelectedPages();
    }

    /**
     * Check if text is selected on any page, and if so, add a css class to that page
     * @returns {void}
     * @TODO(clakenen): this method currently only adds the selected class to one page,
     * so we should modify it to add the class to all pages with selected text
     * @private
     */
    function updateSelectedPages() {
        var node = util.getSelectedNode();
        var $page = $(node).closest('.'+CSS_CLASS_PAGE);
        $el.find('.'+CSS_CLASS_TEXT_SELECTED).removeClass(CSS_CLASS_TEXT_SELECTED);
        if (node && $el.has(node)) {
            $page.addClass(CSS_CLASS_TEXT_SELECTED);
        }
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    return util.extend(api, {

        messages: [
            'ready',
            'zoom',
            'resize',
            'destroy',
            'fail',
            'pagefocus',
            'pageload',
            'pageunload',
            'pageerror',
            'resize',
            'scroll',
            'afterscroll',
            'linkclicked'
        ],

        /**
         * Handle framework messages
         * @param {string} name The name of the message
         * @param {any} data The related data for the message
         * @returns {void}
         */
        onmessage: function (name, data) {
            switch (name) {
                case 'scroll':
                    handleScroll(data);
                    break;

                case 'afterscroll':
                    handleAfterScroll(data);
                    break;

                case 'linkclicked':
                    handleLinkClicked(data);
                    break;

                case 'zoom':
                    // artificially adjust the reported zoom to be accuate given the page scale
                    data.zoom *= config.pageScale;
                    data.prevZoom *= config.pageScale;

                    // forward zoom event to external event handlers
                    this.fire(name, data);
                    break;

                default:
                    // forward subscribed framework messages to external event handlers
                    this.fire(name, data);
                    break;
            }
        },

        /**
         * Initialize the viewer api
         * @param  {Element} el      The element to wrap
         * @param  {Object}  options The configuration options
         * @returns {void}
         */
        init: function (el, options) {
            // deep extend defaults/options
            config = util.extend(true, config, Crocodoc.Viewer.defaults, options);
            queryString = config.queryParams && '?' + $.param(config.queryParams) || '';

            // Setup container
            config.$el = $el = $(el);

            //Container exists?
            if ($el.length === 0) {
                throw new Error('Invalid container element');
            }

            // add crocodoc viewer and loading classes
            $el.addClass(CSS_CLASS_VIEWER);

            setCSSFlags();

            initViewerHTML();
        },

        /**
         * Destroy the viewer
         * @returns {void}
         */
        destroy: function () {
            var prop,
                noop = function () {};

            // remove document event handlers
            $(document).off('mouseup', handleMouseUp);

            // empty container and remove all class names that contain "crocodoc"
            $el.empty().removeClass(function (i, cls) {
                var match = cls.match(new RegExp('crocodoc\\S+', 'g'));
                return match && match.join(' ');
            });

            // remove the stylesheet
            $(stylesheet).remove();

            // @TODO(clakenen): decide if this is really necessary
            // make sure nothing can be called on this object anymore
            for (prop in api) {
                if (api.hasOwnProperty(prop) && util.isFn(api[prop])) {
                    api[prop] = noop;
                }
            }

            destroyed = true;

            // broadcast a destroy message
            scope.broadcast('destroy');

            // destroy all modules in this scope
            scope.destroy();
        },

        /**
         * Intiate loading of document assets
         * @returns {void}
         */
        load: function () {
            // add a / to the end of the base url if necessary
            if (config.url && !/\/$/.test(config.url)) {
                config.url += '/';
            }

            $el.addClass(CSS_CLASS_LOADING);

            // Load doc metadata
            loadMetadata(handleMetadata);
        },

        /**
         * Zoom to the given value
         * @param  {float|string} val Numeric zoom level to zoom to or one of:
         *                            Crocodoc.ZOOM_IN
         *                            Crocodoc.ZOOM_OUT
         *                            Crocodoc.ZOOM_AUTO
         *                            Crocodoc.ZOOM_FIT_WIDTH
         *                            Crocodoc.ZOOM_FIT_HEIGHT
         * @returns {void}
         */
        zoom: function (val) {
            // adjust for page scale if passed value is a number
            var valFloat = parseFloat(val);
            if (valFloat) {
                val = valFloat / (config.pageScale || 1);
            }
            $el.addClass(CSS_CLASS_ZOOMING);
            layout.setZoom(val);
            $el.removeClass(CSS_CLASS_ZOOMING);
        },

        /**
         * Scroll to the given page
         * @param  {int|string} page Page number or one of:
         *                           Crocodoc.SCROLL_PREVIOUS
         *                           Crocodoc.SCROLL_NEXT
         * @returns {void}
         */
        scrollTo: function (page) {
            layout.scrollTo(page);
        },

        /**
         * Scrolls by the given pixel amount from the current location
         * @param  {int} top  Top offset to scroll to
         * @param  {int} left Left offset to scroll to
         * @returns {void}
         */
        scrollBy: function (top, left) {
            layout.scrollBy(top, left);
        },

        /**
         * Set the layout to the given mode, destroying and cleaning up the current
         * layout if there is one
         * @param  {string} mode The layout mode
         * @returns {void}
         */
        setLayout: function (mode) {
            var lastPage = config.page,
                lastZoom = config.zoom;

            if (layout) {
                // ignore if we already have the specified layout
                if (mode === config.layout) {
                    return;
                }
                lastPage = layout.state.currentPage;
                lastZoom = layout.state.zoomState;

                // remove and destroy the existing layout module
                scope.removeModuleInstance(layout);
            }

            // if there is only one page and it's not presentation mode,
            // force it into presentation mode so the page gets centered in the viewport
            if (config.numPages === 1 && mode !== Crocodoc.LAYOUT_PRESENTATION) {
                mode = Crocodoc.LAYOUT_PRESENTATION;
            }

            config.layout = mode;

            // create a layout module with the new layout config
            layout = scope.createModuleInstance('layout-' + mode);
            if (layout) {
                layout.init(config);
                layout.setZoom(lastZoom.zoomMode || lastZoom.zoom || lastZoom);
                layout.scrollTo(lastPage);
            } else {
                throw new Error('Invalid layout ' +  mode);
            }
        },

        /**
         * Enable text selection, loading text assets per page if necessary
         * @returns {void}
         */
        enableTextSelection: function () {
            $el.removeClass(CSS_CLASS_TEXT_DISABLED);
            config.enableTextSelection = true;
            scope.broadcast('textenabledchange', { enabled: true });
        },

        /**
         * Disable text selection, hiding text layer on pages if it's already there
         * and disabling the loading of new text assets
         * @returns {void}
         */
        disableTextSelection: function () {
            $el.addClass(CSS_CLASS_TEXT_DISABLED);
            config.enableTextSelection = false;
            scope.broadcast('textenabledchange', { enabled: false });
        },

        /**
         * Enable links
         * @returns {void}
         */
        enableLinks: function () {
            $el.removeClass(CSS_CLASS_LINKS_DISABLED);
        },

        /**
         * Disable links
         * @returns {void}
         */
        disableLinks: function () {
            $el.addClass(CSS_CLASS_LINKS_DISABLED);
        },

        /**
         * Notify the viewer that a page is available (ie., it's finished converting)
         * @param  {int} page The page that's available
         * @returns {void}
         * @TODO(clakenen): maybe come up with a better name for this?
         * @TODO(clakenen): if this is called before the viewer has recieved document metadata
         * it will be ignored; perhaps we should cache these messages in that condition?
         */
        setPageAvailable: function (page) {
            scope.broadcast('pageavailable',  { page: page });
        },

        /**
         * Notify the viewer that all pages up to a given page are available
         * @param  {int} page The page that is (and all pages up to are) available
         * @returns {void}
         * @TODO(clakenen): see TODOs on setPageAvailable
         */
        setPagesAvailableUpTo: function (page) {
            scope.broadcast('pageavailable',  { upto: page });
        },

        /**
         * Focuses the viewport so it can be natively scrolled with the keyboard
         * @returns {void}
         */
        focus: function () {
            config.$viewport.focus();
        }
    });
});
