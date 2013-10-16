function svgify(element) {
    element = element || document;
    [].forEach.call(element.querySelectorAll('[data-svg-inline]'), embedInline);
    [].forEach.call(element.querySelectorAll('[data-svg-iframe]'), embedIframe);

    function embedInline(elem) {
        var dp = new window.DOMParser(),
            src = elem.dataset.svgInline;
        ajax(src, function (svgText) {
            console.time('inline');
            var svgDoc = dp.parseFromString(fixSVGText(src, svgText), 'image/svg+xml');
            svgDoc = document.importNode(svgDoc.documentElement, true);
            svgDoc.style.width = '100%';
            svgDoc.style.height = '100%';
            elem.appendChild(svgDoc);
            console.timeEnd('inline');
        });
    }

    function embedIframe(elem) {
        var dp = new window.DOMParser(),
            src = elem.dataset.svgIframe;
        ajax(src, function (svgText) {
            console.time('iframe');
            var svgDoc = document.createElement('iframe');
            svgDoc.src = src;
            elem.appendChild(svgDoc);
            console.timeEnd('iframe');
        });
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