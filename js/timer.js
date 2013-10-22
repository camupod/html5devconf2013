/**
 * Timer that uses window.performance if available, works in child frames using postMessage
 */

window.Timer = (function () {

    var Timer = {
        startTime: {},
        stopTime: {},
        handlers: {},
        currentTime: function () {
            return window.performance ? window.performance.now() : new Date().getTime();
        },
        start: function (label) {
            this.startTime[label] = this.currentTime();
        },
        stop: function (label) {
            this.stopTime[label] = this.currentTime();

            this.trigger(label, this.getElapsed(label));
        },
        getElapsed: function (label) {
            return this.stopTime[label] - this.startTime[label];
        },
        trigger: function (label, time) {
            var i, l;
            if (this.handlers[label]) {
                for (i = 0, l = this.handlers[label].length; l > i; ++i) {
                    this.handlers[label][i](label, time);
                }
            }
        },
        on: function (label, cb) {
            if (!this.handlers[label]) {
                this.handlers[label] = [];
            }
            this.handlers[label].push(cb);

            // trigger it now if available
            if (this.stopTime[label]) {
                cb(label, this.getElapsed(label));
            }
        },
        off: function (label, cb) {
            var i, l;
            if (this.handlers[label]) {
                for (i = 0, l = this.handlers[label].length; l > i; ++i) {
                    if (this.handlers[label][i] === cb) {
                        this.handlers[label].splice(i, 1);
                    }
                }
            }
        }
    };

    window.addEventListener('message', function (ev) {
        var data = ev.data;
        if (data) {
            Timer.trigger(data.label, data.time);
        }
    });

    return Timer;
})();
