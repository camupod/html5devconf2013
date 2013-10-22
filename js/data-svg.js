/**
 * Find all elements in the dom (or the given element) with data-svg-[type]="foo.svg"
 * and embed the given svg into the element with the named method [type].
 *
 * Supported types are inline and iframe
 *
 * e.g., <div data-svg-inline="foo.svg"></div> will embed foo.svg inline into the div
 */

function svgify(element, type) {
    // embed types available
    var embedType = {
        iframe: function (elem) {
            var src = elem.dataset.svgIframe;
            Timer.start('iframe');
            var svgDoc = document.createElement('iframe');
            svgDoc.src = src;
            elem.appendChild(svgDoc);
            Timer.stop('iframe');
        },
        inline: function (elem) {
            var dp = new window.DOMParser(),
                src = elem.dataset.svgInline;
            ajax(src, function (svgText) {
                Timer.start('inline');
                var svgDoc = dp.parseFromString(fixSVGText(src, svgText), 'image/svg+xml');
                svgDoc = document.importNode(svgDoc.documentElement, true);
                svgDoc.style.width = '100%';
                svgDoc.style.height = '100%';
                elem.appendChild(svgDoc);
                Timer.stop('inline');
            });
        }
    };
    element = element || document;
    if (type) {
        svgifyType(type);
    } else {
        for (type in embedType) {
            svgifyType(type);
        }
    }

    function svgifyType(type) {
        [].forEach.call(element.querySelectorAll('[data-svg-'+type+']'), embedType[type]);
    }

    function fixSVGText(src, text) {
        var baseURL = src.substring(0, src.lastIndexOf('/') + 1);

        // modify urls for absolute path
        text = text.replace(/href="([^"#:]*)"/g, function(match, group){
            return 'href="' + baseURL + group + '"';
        });
        text = text.replace(/url\(\"([^"#:]*)\"\)/g, function(match, group){
            return 'url("' + baseURL + group + '")';
        });

        return text;
    }

    function ajax(src, cb) {
        var xhr = new XMLHttpRequest();
        xhr.onload = function () {
            cb(this.responseText);
        };
        xhr.open('GET', src, true);
        xhr.send();
    }
}
svgify();
