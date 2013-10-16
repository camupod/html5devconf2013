

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
        url: '/crocodoc/docviewer/testing/article-trends',
        embedStrategy: 3,
        enableTextSelection: false,
        zoom: Crocodoc.ZOOM_FIT_HEIGHT
    });
});

Demo.add('viewer-object', function () {
    return viewerDemo({
        url: '/crocodoc/docviewer/testing/article-trends',
        embedStrategy: 4,
        enableTextSelection: false,
        zoom: Crocodoc.ZOOM_FIT_HEIGHT
    });
});

Demo.add('object-vs-inline', function () {
    var src = 'assets/article-trends/page-46.svg';
    var $object = $('<object>').attr({
        data: src,
        type: 'image/svg+xml'
    });
    var $inline = $('<div data-svg="'+src+'">');
    return {
        init: function (el) {
            $(el).find('.demo-container').empty().append($object, $inline);
        }
    }
});