

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
        if (this.currentDemo && this.currentDemo.destroy) {
            this.currentDemo.destroy();
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
    transition: 'fade',
    dependencies:  [
        { src: 'lib/plugin/marked.js', condition: function() { return !!document.querySelector( '[data-markdown]' ); } },
        { src: 'lib/plugin/markdown.js', condition: function() { return !!document.querySelector( '[data-markdown]' ); } }
    ]
});

Reveal.addEventListener('slidechanged', function (ev) {
    Demo.load(ev.currentSlide, ev.currentSlide.dataset.demo);
});

function viewerDemo(cfg) {
    var viewer;
    return {
        init: function (el) {
            viewer = Crocodoc.createViewer(el, cfg);
            viewer.load();
        },
        destroy: function () {
            viewer.destroy();
        }
    }
}

Demo.add('viewer-inline', function () {
    return viewerDemo({
        url: '/crocodoc/docviewer/testing/article-realestate',
        embedStrategy: 3,
        enableTextSelection: false,
        zoom: Crocodoc.ZOOM_FIT_HEIGHT
    });
});

Demo.add('viewer-object', function () {
    return viewerDemo({
        url: '/crocodoc/docviewer/testing/article-realestate',
        embedStrategy: 4,
        enableTextSelection: false,
        zoom: Crocodoc.ZOOM_FIT_HEIGHT
    });
});

Demo.add('iframe-vs-inline', function () {
    var $el, $inline, $iframe, top,
        src = 'assets/object-vs-inline/page-46.svg';
    return {
        init: function (el) {
            top = 0;
            $el = $(el);
            $el.find('button.reload').on('click', this.reload);
            this.reload();
        },
        destroy: function () {
            $el.find('button.reload').off('click', this.reload);
        },
        reload: function () {
            $inline = $('<div data-svg-inline="'+src+'">'),
            $iframe = $('<div data-svg-iframe="'+src+'">');
            $el.find('.demo-container').empty().append($iframe, $inline);
            svgify($el[0]);
        }
    };
});