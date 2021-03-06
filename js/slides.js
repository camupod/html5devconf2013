var Demo = {
    demos: {},
    currentDemo: null,
    add: function (demoName, creator) {
        this.demos[demoName] = creator();
    },
    get: function (demoName) {
        return this.demos[demoName];
    },
    load: function (demoEl, demoName) {
        var currentDemo = this.currentDemo;
        if (currentDemo && currentDemo.destroy) {
            setTimeout(function () {
                currentDemo.destroy();
            });
        }
        this.currentDemo = this.get(demoName);
        if (this.currentDemo) {
            this.currentDemo.init(demoEl);
        }
    }
};

// Full list of configuration options available here:
// https://github.com/hakimel/reveal.js#configuration
Reveal.initialize({
    center: true,
    controls: false,
    progress: false,
    history: true,
    transition: 'linear',
    transitionSpeed: 'fast',
    dependencies:  [
        { src: 'plugin/markdown/marked.js', condition: function() { return !!document.querySelector( '[data-markdown]' ); } },
        { 
            src: 'plugin/markdown/markdown.js',
            condition: function() { return !!document.querySelector( '[data-markdown]' ); },
            callback: function() {
                [].forEach.call(document.querySelectorAll('*[data-fragmentize] li'), function(ele){ ele.className = 'fragment'; });
            }
        },
        { src: 'plugin/highlight/highlight.js', async: true, callback: function() { window.hljs.initHighlightingOnLoad(); } },
        { src: 'plugin/notes/notes.js' }
    ]
});

Reveal.addEventListener('ready', function (ev) {
    // only do this for slide 0
    if (window.parent === window) {
        if (ev.indexh === 0) {
            Demo.load(ev.currentSlide, ev.currentSlide.dataset.demo);
        } else {
            // hack to remove contact style if not reloaded on slide 0... too lazy to do this better
            Demo.demos.contact.destroy();
        }
    } else {
        Demo.demos.contact.destroy();
    }
});

Reveal.addEventListener('slidechanged', function (ev) {
    if (window.parent === window) {
        Demo.load(ev.currentSlide, ev.currentSlide.dataset.demo);
    }
});

function viewerDemo(cfg) {
    var viewer,
        handler;

    return {
        init: function (el) {
            viewer = Crocodoc.createViewer($(el).find('.demo-viewer'), cfg);
            viewer.load();
            handler = createViewerKeydownHandler(viewer);
            $(window).on('keydown', handler);
        },
        destroy: function () {
            viewer.destroy();
            $(window).off('keydown', handler);
        }
    };
}

function videoDemo() {
    var video;
    return {
        init: function (el) {
            video = el.querySelector('video');
            video.currentTime = 0;
            video.play();
        },
        destroy: function () {
            video.pause();
        }
    };
}

function createViewerKeydownHandler(viewer) {
    return function (ev) {
        if (ev.metaKey) {
            if (ev.keyCode === 48) viewer.zoom(1);
            else if (ev.keyCode === 189) viewer.zoom('out');
            else if (ev.keyCode === 187) viewer.zoom('in');
            else return;
            return false;
        }
    };
}

Demo.add('viewer-example', function () {
    return viewerDemo({
        url: 'assets/documents-reimagined',
        enableTextSelection: false
    });
});

Demo.add('viewer-zooming', function () {
    return viewerDemo({
        url: 'assets/box-floor-plan',
        enableTextSelection: false
    });
});


Demo.add('viewer-inline', function () {
    return viewerDemo({
        url: 'assets/article-trends',
        embedStrategy: 3,
        enableTextSelection: false,
        zoom: Crocodoc.ZOOM_FIT_HEIGHT
    });
});

Demo.add('viewer-iframe', function () {
    return viewerDemo({
        url: 'assets/article-trends',
        enableTextSelection: false,
        zoom: Crocodoc.ZOOM_FIT_HEIGHT
    });
});

Demo.add('spinner-video', videoDemo);

Demo.add('iframe-vs-inline', function () {
    var $el, $inline, $iframe, top,
        src = 'assets/object-vs-inline/page-46.svg';
    return {
        init: function (el) {
            top = 0;
            $el = $(el);
            $el.find('button.reload').on('click', this.reload);
            $el.find('button.reload-iframe').on('click', this.reloadIframe);
            $el.find('button.reload-inline').on('click', this.reloadInline);
            this.reload();
            Timer.on('inline', this.printTimes);
            Timer.on('iframe', this.printTimes);
            Timer.on('svg-inline', this.printTimes);
            Timer.on('svg-iframe', this.printTimes);
        },
        destroy: function () {
            $el.find('button.reload').off('click', this.reload);
            $el.find('button.reload-iframe').off('click', this.reloadIframe);
            $el.find('button.reload-inline').off('click', this.reloadInline);
        },
        reload: function () {
            $inline = $('<div data-svg-inline="'+src+'#inline">');
            $iframe = $('<div data-svg-iframe="'+src+'#iframe">');
            $el.find('.demo-container').empty().append($iframe, $inline);
            svgify($el[0]);
        },
        reloadIframe: function () {
            $iframe.html('');
            svgify($el[0], 'iframe');
        },
        reloadInline: function () {
            $inline.html('');
            svgify($el[0], 'inline');
        },
        printTimes: function (label, time) {
            console.log(label, time);
        }
    };
});

Demo.add('contact', function () {
    return {
        init: function () {
            $(document.body).addClass('contact');
        },
        destroy: function () {
            $(document.body).removeClass('contact');
        }
    };
});

Demo.add('boxercopter', function () {
    var $frame;
    return {
        init: function (el) {
            $frame = $('<iframe src="../boxercopter.com">');
            $(el).find('.demo-container').append($frame);
        },
        destroy: function () {
            $frame.remove();
        }
    };
});

// open notes with the S key
window.addEventListener('keydown', function (ev) {
    if (ev.keyCode === 83) {
        RevealNotes.open();
    }
});

