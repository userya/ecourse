//=========================================
//  ���ݽ���ģ��
//==========================================
define("mmRequest", ["avalon", "mmDeferred"], function(avalon, mmDeferred) {
    var global = window,
            DOC = global.document,
            r20 = /%20/g,
            rCRLF = /\r?\n/g,
            encode = encodeURIComponent,
            decode = decodeURIComponent,
            rheaders = /^(.*?):[ \t]*([^\r\n]*)\r?$/mg,
            // IE�Ļ��з������� \r
            rlocalProtocol = /^(?:about|app|app-storage|.+-extension|file|res|widget):$/,
            rnoContent = /^(?:GET|HEAD)$/,
            rquery = /\?/,
            rurl = /^([\w.+-]+:)(?:\/\/(?:[^\/?#]*@|)([^\/?#:]*)(?::(\d+)|)|)/,
            //��IE�����������document.domain��ֱ�ӷ���window.location���״�����document.URL��ok��
            //http://www.cnblogs.com/WuQiang/archive/2012/09/21/2697474.html
            curl = DOC.URL,
            segments = rurl.exec(curl.toLowerCase()) || [],
            isLocal = rlocalProtocol.test(segments[1]),
            head = DOC.head || DOC.getElementsByTagName("head")[0], //HEADԪ��
            //http://www.cnblogs.com/rubylouvre/archive/2010/04/20/1716486.html
            s = ["XMLHttpRequest", "ActiveXObject('Msxml2.XMLHTTP.6.0')",
                "ActiveXObject('Msxml2.XMLHTTP.3.0')", "ActiveXObject('Msxml2.XMLHTTP')"
            ];
    if (!"1" [0]) { //�ж�IE67
        s[0] = location.protocol === "file:" ? "!" : s[0]
    }
    for (var i = 0, axo; axo = s[i++]; ) {
        try {
            if (eval("new " + axo)) {
                avalon.xhr = new Function("return new " + axo)
                break;
            }
        } catch (e) {
        }
    }

    var accepts = {
        xml: "application/xml, text/xml",
        html: "text/html",
        text: "text/plain",
        json: "application/json, text/javascript",
        script: "text/javascript, application/javascript",
        "*": ["*/"] + ["*"] //���ⱻѹ����
    },
    defaults = {
        type: "GET",
        contentType: "application/x-www-form-urlencoded; charset=UTF-8",
        async: true,
        jsonp: "callback"
    };
    //��dataת��Ϊ�ַ�����typeת��Ϊ��д�����hasContent��crossDomain���ԣ������GET������������URL����

    function ajaxExtend(opts) {
        opts = avalon.mix({}, defaults, opts)

        if (typeof opts.crossDomain !== "boolean") { //�ж��Ƿ����
            var parts = rurl.exec(opts.url.toLowerCase())
            opts.crossDomain = !!(parts && (parts[1] !== segments[1] || parts[2] !== segments[2] || (parts[3] || (parts[1] === "http:" ? 80 : 443)) !== (segments[3] || (segments[1] === "http:" ? 80 : 443))))
        }

        var querystring = typeof opts.data === "string" ? opts.data : avalon.param(opts.data)
        opts.querystring = querystring || ""
        opts.url = opts.url.replace(/#.*$/, "").replace(/^\/\//, segments[1] + "//")
        opts.type = opts.type.toUpperCase()
        opts.hasContent = !rnoContent.test(opts.type)  //�Ƿ�Ϊpost����
        if (!opts.hasContent) {
            if (querystring) { //���ΪGET����,�����������url��
                opts.url += (rquery.test(opts.url) ? "&" : "?") + querystring;
            }
            if (opts.cache === false) { //���ʱ���
                opts.url += (rquery.test(opts.url) ? "&" : "?") + "_time=" + (new Date - 0)
            }
        }
        return opts;
    }
    var rvalidchars = /^[\],:{}\s]*$/,
            rvalidescape = /\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g,
            rvalidtokens = /"[^"\\\r\n]*"|true|false|null|-?(?:\d+\.|)\d+(?:[eE][+-]?\d+|)/g,
            rvalidbraces = /(?:^|:|,)(?:\s*\[)+/g

    function parseJSON(data) {
        if (typeof data === "string") {
            data = data.trim()  //IE����ȥ���ַ������ߵĿհ�
            if (window.JSON && JSON.parse) {
                //ʹ��ԭ����JSON.parseת���ַ���Ϊ����
                return JSON.parse(data)
            }
            if (rvalidchars.test(data.replace(rvalidescape, "@").replace(rvalidtokens, "]").replace(rvalidbraces, ""))) {
                //ʹ��new Function����һ��JSON����
                return (new Function("return " + data))()
            }
        }
        avalon.error("Invalid JSON: " + data)
    }

    function parseXML(data, xml, tmp) {
        try {
            var mode = document.documentMode
            if (window.DOMParser && (!mode || mode > 8)) { // Standard
                tmp = new DOMParser()
                xml = tmp.parseFromString(data, "text/xml")
            } else { // IE
                xml = new ActiveXObject("Microsoft.XMLDOM")  //"Microsoft.XMLDOM"
                xml.async = "false";
                xml.loadXML(data)
            }
        } catch (e) {
            xml = undefined;
        }
        if (!xml || !xml.documentElement || xml.getElementsByTagName("parsererror").length) {
            avalon.error("Invalid XML: " + data)
        }
        return xml;
    }
    var head = document.getElementsByTagName("head")[0] || document.head

    function parseJS(code) {
        var indirect = eval
        code = code.trim()
        if (code) {
            if (code.indexOf("use strict") === 1) {
                var script = document.createElement("script")
                script.text = code;
                head.appendChild(script).parentNode.removeChild(script)
            } else {
                indirect(code)
            }
        }
    }
    //ajax������
    avalon.ajax = function(opts, promise) {
        if (!opts || !opts.url) {
            avalon.error("��������ΪObject����ӵ��url����")
        }
        opts = ajaxExtend(opts)  //�����û���������������querystring, type��д��
        //����һ��αXMLHttpRequest,�ܴ���complete,success,error�ȶ�Ͷ�¼�
        var XHRProperties = {
            responseHeadersString: "",
            responseHeaders: {},
            requestHeaders: {},
            querystring: opts.querystring,
            readyState: 0,
            uniqueID: setTimeout("1"),
            status: 0
        }
        var dummyXHR = mmDeferred(function(p) {
            promise = p
            p.options = opts
            p.deferred = dummyXHR
            avalon.mix(p, XHRProperties, XHRMethods)
        })
        promise.then(opts.success, opts.error)
        "success error".replace(avalon.rword, function(name) { //�󶨻ص�
            delete opts[name]
        })

        var dataType = opts.dataType  //Ŀ�귵����������
        var transports = avalon.ajaxTransports
        var name = opts.form ? "upload" : dataType
        var transport = transports[name] || transports.xhr
        avalon.mix(promise, transport)  //ȡ�ô�������request, respond, preproccess
        if (promise.preproccess) { //������jsonp upload������
            dataType = promise.preproccess() || dataType
        }
        //�����ײ� 1��Content-Type�ײ�
        if (opts.contentType && name !== "upload") {
            promise.setRequestHeader("Content-Type", opts.contentType)
        }
        //2.����Accept�ײ�
        promise.setRequestHeader("Accept", accepts[dataType] ? accepts[dataType] + ", */*; q=0.01" : accepts["*"])
        for (var i in opts.headers) { //3. ����headers������ײ�
            promise.setRequestHeader(i, opts.headers[i])
        }
        // 4.����ʱ
        if (opts.async && opts.timeout > 0) {
            promise.timeoutID = setTimeout(function() {
                promise.abort("timeout")
            }, opts.timeout)
        }
        promise.request()
        return promise;
    };
    "get,post".replace(avalon.rword, function(method) {
        avalon[method] = function(url, data, callback, type) {
            if (typeof data === "function") {
                type = type || callback
                callback = data
                data = void 0
            }
            return avalon.ajax({
                type: method,
                url: url,
                data: data,
                success: callback,
                dataType: type
            })
        };
    })

    function isValidParamValue(val) {
        var t = typeof val; // ֵֻ��Ϊ null, undefined, number, string, boolean
        return val == null || (t !== 'object' && t !== 'function')
    }

    avalon.mix({
        ajaxTransports: {
            xhr: {
                //��������
                request: function() {
                    var self = this;
                    var opts = this.options;
                    avalon.log("XhrTransport.request.....")
                    var transport = this.transport = new avalon.xhr;
                    if (opts.crossDomain && !("withCredentials" in transport)) {
                        avalon.error("���������֧��crossdomain xhr")
                    }
                    if (opts.username) {
                        transport.open(opts.type, opts.url, opts.async, opts.username, opts.password)
                    } else {
                        transport.open(opts.type, opts.url, opts.async)
                    }
                    if (this.mimeType && transport.overrideMimeType) {
                        transport.overrideMimeType(this.mimeType)
                    }
                    this.requestHeaders["X-Requested-With"] = "XMLHttpRequest";
                    for (var i in this.requestHeaders) {
                        transport.setRequestHeader(i, this.requestHeaders[i])
                    }
                    var dataType = this.options.dataType;
                    if ("responseType" in transport && /^(blob|arraybuffer|text)$/.test(dataType)) {
                        transport.responseType = dataType;
                        this.useResponseType = true;
                    }
                    transport.send(opts.hasContent && (this.formdata || this.querystring) || null)
                    //��ͬ��ģʽ��,IE6,7���ܻ�ֱ�Ӵӻ����ж�ȡ���ݶ����ᷢ������,���������Ҫ�ֶ���������
                    if (!opts.async || transport.readyState === 4) {
                        this.respond()
                    } else {
                        if (transport.onerror === null) { //���֧��onerror, onload��API
                            transport.onload = transport.onerror = function(e) {
                                this.readyState = 4 //IE9+ 
                                this.status = e.type === "load" ? 200 : 500
                                self.respond()
                            }
                        } else {
                            transport.onreadystatechange = function() {
                                self.respond()
                            }
                        }
                    }
                },
                //���ڻ�ȡԭʼ��responseXMLresponseText ����status statusText
                //�ڶ�������Ϊ1ʱ��ֹ����
                respond: function(event, forceAbort) {
                    var transport = this.transport
                    if (!transport) {
                        return;
                    }
                    try {
                        var completed = transport.readyState === 4
                        if (forceAbort || completed) {
                            transport.onreadystatechange = avalon.noop
                            if ("onerror" in transport) {//IE6�¶�XHR��������onerror���Կ��ܱ���
                                transport.onerror = transport.onload = null
                            }
                            if (forceAbort) {
                                if (!completed && typeof transport.abort === "function") { // ����Ժ� abort ��Ҫ����
                                    transport.abort()
                                }
                            } else {
                                var status = transport.status
                                this.responseText = transport.responseText
                                try {
                                    //��responseXMLΪ[Exception: DOMException]ʱ��
                                    //���������ס�An attempt was made to use an object that is not, or is no longer, usable���쳣
                                    var xml = transport.responseXML
                                } catch (e) {
                                }
                                if (this.useResponseType) {
                                    this.response = transport.response
                                }
                                if (xml && xml.documentElement) {
                                    this.responseXML = xml;
                                }
                                this.responseHeadersString = transport.getAllResponseHeaders()
                                //����ڿ������ʱ����statusTextֵ���׳��쳣
                                try {
                                    var statusText = transport.statusText
                                } catch (e) {
                                    this.error = e
                                    statusText = "firefoxAccessError"
                                }
                                //���ڴ����������,�����һ����������,ֻҪ�����ܻ�ȡ���ݾͼٵ����ǳɹ���
                                if (!status && isLocal && !this.options.crossDomain) {
                                    status = this.responseText ? 200 : 404
                                    //IE��ʱ���204����Ϊ1223
                                } else if (status === 1223) {
                                    status = 204
                                }
                                this.dispatch(status, statusText)
                            }
                        }
                    } catch (err) {
                        // �����������ʱ����XHR�����ԣ���FF�����쳣
                        // http://helpful.knobs-dials.com/index.php/Component_returned_failure_code:_0x80040111_(NS_ERROR_NOT_AVAILABLE)
                        if (!forceAbort) {
                            this.dispatch(500, err)
                        }
                    }
                }
            },
            jsonp: {
                preproccess: function() {
                    var opts = this.options;
                    var name = this.jsonpCallback = opts.jsonpCallback || "jsonp" + setTimeout("1")
                    opts.url = opts.url + (rquery.test(opts.url) ? "&" : "?") + opts.jsonp + "=avalon." + name
                    //����̨���ص�json�����ڶ��Ժ�����
                    avalon[name] = function(json) {
                        avalon[name] = json
                    };
                    return "script"
                }
            },
            script: {
                request: function() {
                    var opts = this.options;
                    var node = this.transport = DOC.createElement("script")
                    avalon.log("ScriptTransport.sending.....")
                    if (opts.charset) {
                        node.charset = opts.charset;
                    }
                    var load = node.onerror === null; //�ж��Ƿ�֧��onerror
                    var self = this;
                    node.onerror = node[load ? "onload" : "onreadystatechange"] = function() {
                        self.respond()
                    };
                    node.src = opts.url;
                    head.insertBefore(node, head.firstChild)
                },
                respond: function(event, forceAbort) {
                    var node = this.transport;
                    if (!node) {
                        return;
                    }
                    var execute = /loaded|complete|undefined/i.test(node.readyState)
                    if (forceAbort || execute) {
                        node.onerror = node.onload = node.onreadystatechange = null
                        var parent = node.parentNode;
                        if (parent) {
                            parent.removeChild(node)
                        }
                        if (!forceAbort) {
                            var args = typeof avalon[this.jsonpCallback] === "function" ? [500, "error"] : [200, "success"]
                            this.dispatch.apply(this, args)
                        }
                    }
                }
            },
            upload: {
                preproccess: function() {
                    var opts = this.options;
                    var formdata = new FormData(opts.form)  //��������ʲôһ���Ӵ����formdata
                    avalon.each(opts.data, function(key, val) {
                        formdata.append(key, val)  //��ӿ�������
                    })
                    this.formdata = formdata;
                }
            }
        },
        ajaxConverters: {//ת�����������û���Ҫ��������
            text: function(text) {
                return text || "";
            },
            xml: function(text, xml) {
                return xml !== void 0 ? xml : parseXML(text)
            },
            html: function(text) {
                return avalon.parseHTML(text)  //һ���ĵ���Ƭ,����ֱ�Ӳ���DOM��
            },
            json: function(text) {
                return parseJSON(text)
            },
            script: function(text) {
                parseJS(text)
            },
            jsonp: function() {
                var json = avalon[this.jsonpCallback];
                delete avalon[this.jsonpCallback];
                return json;
            }
        },
        getScript: function(url, callback) {
            return avalon.get(url, null, callback, "script")
        },
        getJSON: function(url, data, callback) {
            return avalon.get(url, data, callback, "jsonp")
        },
        upload: function(url, form, data, callback, dataType) {
            if (typeof data === "function") {
                dataType = callback;
                callback = data;
                data = void 0;
            }
            return avalon.ajax({
                url: url,
                type: 'post',
                dataType: dataType,
                form: form,
                data: data,
                success: callback
            });
        },
        //��һ������ת��Ϊ�ַ���
        param: function(json, bracket) {
            if (!avalon.isPlainObject(json)) {
                return "";
            }
            bracket = typeof bracket === "boolean" ? bracket : !0;
            var buf = [],
                    key, val;
            for (key in json) {
                if (json.hasOwnProperty(key)) {
                    val = json[key];
                    key = encode(key)
                    if (isValidParamValue(val)) { //ֻ���������������,���Կ�����,����,����,����,�ڵ��
                        buf.push(key, "=", encode(val + ""), "&")
                    } else if (Array.isArray(val) && val.length) { //����Ϊ������
                        for (var i = 0, n = val.length; i < n; i++) {
                            if (isValidParamValue(val[i])) {
                                buf.push(key, (bracket ? encode("[]") : ""), "=", encode(val[i] + ""), "&")
                            }
                        }
                    }
                }
            }
            buf.pop()
            return buf.join("").replace(r20, "+")
        },
        //��һ���ַ���ת��Ϊ����
        //avalon.deparam = jq_deparam = function( params, coerce ) {
        //https://github.com/cowboy/jquery-bbq/blob/master/jquery.ba-bbq.js
        unparam: function(url, query) {
            var json = {};
            if (!url || !avalon.type(url) === "string") {
                return json;
            }
            url = url.replace(/^[^?=]*\?/ig, '').split('#')[0]; //ȥ����ַ��hash��Ϣ
            //���ǵ�key�п�������������硰[].���ȣ���[]ȴ���Ƿ񱻱���Ŀ��ܣ����ԣ�����Ч�������Ͻ������㴫��key������Ҳ��ȫ������url��
            var pairs = url.split("&"),
                    pair, key, val, i = 0,
                    len = pairs.length;
            for (; i < len; ++i) {
                pair = pairs[i].split("=")
                key = decode(pair[0])
                try {
                    val = decode(pair[1] || "")
                } catch (e) {
                    avalon.log(e + "decodeURIComponent error : " + pair[1], 3)
                    val = pair[1] || "";
                }
                key = key.replace(/\[\]$/, "")  //�����������[]��β����������
                var item = json[key];
                if (item === void 0) {
                    json[key] = val; //��һ��
                } else if (Array.isArray(item)) {
                    item.push(val)  //�����λ���������
                } else {
                    json[key] = [item, val]; //�ڶ���,����ת��Ϊ����
                }
            }
            return query ? json[query] : json;
        },
        serialize: function(form) { //��Ԫ�ر��ַ���
            var json = {};
            // ��ֱ��ת��form.elements����ֹ���������   <form > <input name="elements"/><input name="test"/></form>
            avalon.slice(form || []).filter(function(el) {
                return el.name && !el.disabled && (el.checked === true || /radio|checkbox/.test(el.type))
            }).forEach(function(el) {
                var val = avalon(el).val(),
                        vs;
                val = Array.isArray(val) ? val : [val];
                val = val.map(function(v) {
                    return v.replace(rCRLF, "\r\n")
                })
                // ȫ��������飬��ֹͬ��
                vs = json[el.name] || (json[el.name] = [])
                vs.push.apply(vs, val)
            })
            return avalon.param(json, false)  // ��ֵ��ֵ�����л�,����Ԫ������ǰ���� []
        }
    })
    var transports = avalon.ajaxTransports;
    avalon.mix(transports.jsonp, transports.script)
    avalon.mix(transports.upload, transports.xhr)
    /**
     * αXMLHttpRequest��,�������������������
     * var ajax = new(self.XMLHttpRequest||ActiveXObject)("Microsoft.XMLHTTP")
     * ajax.onreadystatechange = function(){
     *   if (ajax.readyState==4 && ajax.status==200){
     *        alert(ajax.responseText)
     *   }
     * }
     * ajax.open("POST", url, true) 
     * ajax.send("key=val&key1=val2") 
     */

    var XHRMethods = {
        setRequestHeader: function(name, value) {
            this.requestHeaders[name] = value;
            return this;
        },
        getAllResponseHeaders: function() {
            return this.readyState === 4 ? this.responseHeadersString : null;
        },
        getResponseHeader: function(name, match) {
            if (this.readyState === 4) {
                while ((match = rheaders.exec(this.responseHeadersString))) {
                    this.responseHeaders[match[1]] = match[2];
                }
                match = this.responseHeaders[name];
            }
            return match === undefined ? null : match;
        },
        overrideMimeType: function(type) {
            this.mimeType = type;
            return this;
        },
        // ��ֹ����
        abort: function(statusText) {
            statusText = statusText || "abort";
            if (this.transport) {
                this.respond(0, statusText)
            }
            return this;
        },
        /**
         * �����ɷ�success,error,complete�Ȼص�
         * http://www.cnblogs.com/rubylouvre/archive/2011/05/18/2049989.html
         * @param {Number} status ״̬��
         * @param {String} statusText ��Ӧ�Ķ�Ҫ����
         */
        dispatch: function(status, nativeStatusText) {
            var statusText = nativeStatusText
            // ֻ��ִ��һ�Σ���ֹ�ظ�ִ��
            if (!this.transport) { //2:��ִ�лص�
                return;
            }
            this.readyState = 4;
            var isSuccess = status >= 200 && status < 300 || status === 304
            if (isSuccess) {
                if (status === 204) {
                    statusText = "nocontent";
                } else if (status === 304) {
                    statusText = "notmodified";
                } else {
                    //����������ֱ�ӷ���ת���õ����ݾ���ò���,������Ҫ�ֶ�ת��
                    if (typeof this.response === "undefined") {
                        var dataType = this.options.dataType || this.options.mimeType
                        if (!dataType) { //���û��ָ��dataType�������mimeType��Content-Type���д���
                            dataType = this.getResponseHeader("Content-Type") || ""
                            dataType = dataType.match(/json|xml|script|html/) || ["text"]
                            dataType = dataType[0];
                        }
                        try {
                            this.response = avalon.ajaxConverters[dataType].call(this, this.responseText, this.responseXML)
                        } catch (e) {
                            isSuccess = false
                            this.error = e
                            statusText = "parsererror"
                        }
                    }
                }
            }
            this.status = status;
            this.statusText = statusText + ""
            if (this.timeoutID) {
                clearTimeout(this.timeoutID)
                delete this.timeoutID
            }
            this._transport = this.transport;
            // ����Ҫô�ɹ�������success, Ҫôʧ�ܣ����� error, ���ն������ complete
            var deferred = this.deferred
            if (isSuccess) {
                deferred.resolve(this.response, statusText, this)
            } else {
                deferred.reject(this, statusText, this.error || statusText)
            }
            var completeFn = this.options.complete
            if (typeof completeFn === "function") {
                completeFn.call(this, this, statusText)
            }
            delete this.transport
        }
    }
    if (!window.FormData) {
        var str = 'Function BinaryToArray(binary)\r\n\
                 Dim oDic\r\n\
                 Set oDic = CreateObject("scripting.dictionary")\r\n\
                 length = LenB(binary) - 1\r\n\
                 For i = 1 To length\r\n\
                     oDic.add i, AscB(MidB(binary, i, 1))\r\n\
                 Next\r\n\
                 BinaryToArray = oDic.Items\r\n\
              End Function'
        execScript(str, "VBScript");
        avalon.fixAjax = function() {
            avalon.ajaxConverters.arraybuffer = function() {
                var body = this.tranport && this.tranport.responseBody
                if (body) {
                    return  new VBArray(BinaryToArray(body)).toArray();
                }
            };
            function createIframe(ID) {
                var iframe = avalon.parseHTML("<iframe " + " id='" + ID + "'" +
                        " name='" + ID + "'" + " style='position:absolute;left:-9999px;top:-9999px;'/>").firstChild;
                return (DOC.body || DOC.documentElement).insertBefore(iframe, null);
            }
            function addDataToForm(form, data) {
                var ret = [],
                        d, isArray, vs, i, e;
                for (d in data) {
                    isArray = Array.isArray(data[d]);
                    vs = isArray ? data[d] : [data[d]];
                    // �����ԭ��һ���Դ����������ͬ��������
                    for (i = 0; i < vs.length; i++) {
                        e = DOC.createElement("input");
                        e.type = 'hidden';
                        e.name = d;
                        e.value = vs[i];
                        form.appendChild(e);
                        ret.push(e);
                    }
                }
                return ret;
            }
            //https://github.com/codenothing/Pure-Javascript-Upload/blob/master/src/upload.js
            avalon.ajaxTransports.upload = {
                request: function() {
                    var self = this;
                    var opts = this.options;
                    var ID = "iframe-upload-" + this.uniqueID;
                    var form = opts.form;
                    var iframe = this.transport = createIframe(ID);
                    //form.enctype��ֵ
                    //1:application/x-www-form-urlencoded   �ڷ���ǰ���������ַ���Ĭ�ϣ�
                    //2:multipart/form-data �����ַ����롣��ʹ�ð����ļ��ϴ��ؼ��ı�ʱ������ʹ�ø�ֵ��
                    //3:text/plain  �ո�ת��Ϊ "+" �Ӻţ������������ַ����롣
                    var backups = {
                        target: form.target || "",
                        action: form.action || "",
                        enctype: form.enctype,
                        method: form.method
                    };
                    var fields = opts.data ? addDataToForm(form, opts.data) : [];
                    //����ָ��method��enctype��Ҫ����FF����
                    //�������ļ���ʱ�����ȱ�� method=POST �Լ� enctype=multipart/form-data��
                    // ����target������iframe��������ҳˢ��
                    form.target = ID;
                    form.action = opts.url;
                    form.method = "POST";
                    form.enctype = "multipart/form-data";
                    avalon.log("iframe transport...");
                    this.uploadcallback = avalon.bind(iframe, "load", function(event) {
                        self.respond(event);
                    });
                    form.submit();
                    //��ԭform������
                    for (var i in backups) {
                        form[i] = backups[i];
                    }
                    //�Ƴ�֮ǰ��̬��ӵĽڵ�
                    fields.forEach(function(input) {
                        form.removeChild(input);
                    });
                },
                respond: function(event) {
                    var node = this.transport, child
                    // ��ֹ�ظ�����,�ɹ��� abort
                    if (!node) {
                        return;
                    }
                    if (event && event.type === "load") {
                        var doc = node.contentWindow.document;
                        this.responseXML = doc;
                        if (doc.body) {//�������body����,˵�����Ƿ���XML
                            this.responseText = doc.body.innerHTML;
                            //��MIMEΪ'application/javascript' 'text/javascript",�����������ݷŵ�һ��PRE��ǩ��
                            if ((child = doc.body.firstChild) && child.nodeName.toUpperCase() === 'PRE' && child.firstChild) {
                                this.responseText = child.firstChild.nodeValue;
                            }
                        }
                        this.dispatch(200, "success");
                    }
                    this.uploadcallback = avalon.unbind(node, "load", this.uploadcallback);
                    delete this.uploadcallback;
                    setTimeout(function() {  // Fix busy state in FF3
                        node.parentNode.removeChild(node);
                        avalon.log("iframe.parentNode.removeChild(iframe)");
                    });
                }
            };
            delete avalon.fixAjax;
        };
        avalon.fixAjax()
    }

    return avalon
})
/**
 2011.8.31
 ���ᴫ������abort�����ϴ���avalon.XHR.abortȥ����
 �޸�serializeArray��bug
 ��XMLHttpRequest.abort����try...catch
 2012.3.31 v2 ���ع�,֧��XMLHttpRequest Level2
 2013.4.8 v3 ���ع� ֧�ֶ������ϴ�������
 http://www.cnblogs.com/heyuquan/archive/2013/05/13/3076465.html
 */