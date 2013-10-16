(function svgify(element) {
    element = element || document;
    [].forEach.call(element.querySelectorAll('[data-svg]'), function fn(elem){
        var dp = new window.DOMParser(),
            src = elem.dataset.svg;
        ajax(src, function (svgText) {
            var svgDoc = dp.parseFromString(fixSVGText(src, svgText), 'image/svg+xml');
            svgDoc = document.importNode(svgDoc.documentElement, true);
            svgDoc.style.width = '100%';
            svgDoc.style.height = '100%';
            elem.appendChild(svgDoc);
        });
    });

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

}());