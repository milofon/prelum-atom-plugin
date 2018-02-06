'use babel';

import fs from 'fs';
import path from 'path';
import { CompositeDisposable, Disposable } from 'atom';
import apd from 'atom-package-dependencies';
import msgpack from 'msgpack-lite';
import $ from 'jquery';

import bar from './prelum-bar';
import PrelumHtmlView from './prelum-html-view';
import provider from './provider';
import specs from './templates/index.js';
import config from './config.json';
// import mathjax from 'mathjax-node'

import redminePublish from './modules/redmine/publish.js';

const { notifications:notify } = atom;

const maxFileSize = 20971520;

const grammars = {
    prelum: 'source.prelum',
    keyword: 'entity.name.function.prelum',
    block: 'block.prelum',
    blockKeyword: 'entity.name.block.function.prelum'
};

const _keyword = /^([а-яА-Яa-zA-Z-_]+)(\()([^\)\n]*)(\))(\s|$)+/;
const htmlUri = 'prehtml://';

export default {

	// outputFormat: null,
	subscriptions: null,
    processing: false,
	config,

	activate(state) {
        if (atom.inDevMode()) {
            try {
                this.realActivate();
                console.log('reloading prelum package');
            } catch(e) {
                console.error(e);
            }
        } else {
            this.realActivate();
        }
	},

    deactivate() {
        this.subscriptions.dispose();
        this.bar.destroy();
    },

    realActivate() {
        // init provider
        {
            this.provider = Object.assign(provider, {
                plugin: this,
                specs
            });
            this.provider.keywords['документ'].params = specs;
        }
        // set subscriptions
        {
            let dblclick = (e) => {
                let el = $(e.target);
                if (el.hasClass('line-number')) {
                    let line = parseInt(el.text().trim());
                    if (Number.isNaN(line)
                        || this.getParams(null, 'format') !== 'html') return;
                    this.goToLineHtml(Math.max(0, line - 1));
                }
            };

            this.subscriptions = new CompositeDisposable();

            this.subscriptions.add(
                atom.commands.add('atom-workspace', {
                    'prelum:translate': () => this.translate(),
                    'prelum:goToLineHtml': () => this.goToLineHtml(),
                    'prelum:PDF': () => this.translate('pdf'),
                    'prelum:TEX': () => this.translate('tex'),
                    'prelum:HTML': () => this.translate('html'),
                    'prelum:TEXTILE': () => this.translate('textile'),
                    'prelum:redmine-publish': () => redminePublish(this)
    		    }),
                atom.workspace.onDidChangeActivePaneItem(() => {
                    this.updateStatus();
                }),
                atom.workspace.addOpener(uri => {
                    if (uri.indexOf(htmlUri) === 0) {
                        return new PrelumHtmlView(this, uri);
                    }
                }),
                atom.workspace.onDidOpen((e) => {
                    let src = this.getSourceInfo();
                    if (src === null || typeof(src) !== 'object' || !src.editor) return;

                    $(src.editor.element).bind('dblclick', dblclick);
                    this.provider.setLinks(this.getSourceInfo());
                })
            );

            atom.workspace.observeTextEditors((editor) => {
                let _src = this.getSourceInfo(editor);
                if (typeof(_src) === 'object' && _src !== null) {
                    this.provider.setLinks(_src);
                }
                this.subscriptions.add(
                    editor.onDidSave((e) => {
                        let src = this.getSourceInfo();
                        if (!src || src === 'notprelum') return;
                        let auto = this.getParams(src, 'autoTranslate');
                        if (auto) this.translate();
                    }),
                    editor.onDidChangeGrammar((grammar, e) => {
                        this.updateStatus();
                        let editor = atom.workspace.getActiveTextEditor();
                        if (grammar.name === 'Prelum') {
                            $(editor.element).bind('dblclick', dblclick);
                        } else {
                            $(editor.element).unbind('dblclick', dblclick);
                        }
                    })
                );
            });
        }
        // init bar
        {
            this.bar = new bar(this);
            atom.workspace.addBottomPanel({
                item: this.bar,
                priority: 100
            });
        }
        // check pdf-view package
        {
            if (!atom.packages.isPackageLoaded('pdf-view')) apd.install();
        }
        // set autocomplete-plus params
        {
            let _conf = {
                    enableExtendedUnicodeSupport: true,
                    backspaceTriggersAutocomplete: true
                };

            Object.keys(_conf).forEach(i => {
                atom.config.set('autocomplete-plus.' + i, _conf[i]);
            });
        }
        this.updateStatus();
    },

    translate(_fmt, callback) {
        if (this.processing) return;
        this.processing = true;

        let src = this.getSourceInfo();

        if (src === 'notsaved') {
            this.message('error', { detail: 'Сохраните файл перед трансляцией' });
            return;
        }

        if (src === 'notprelum') {
            this.message('error', { detail: 'Ожидается файл формата Prelum' });
            return;
        }

        let params = this.getParams(src),
            fmt = _fmt || params.format,
            fmtCode = config.format.enum.indexOf(fmt);

        if (fmt && fmtCode < 0) {
            this.message('error', { detail: `Формат ${fmt} не поддерживается` });
            return;
        }

        let that = this, data;
        this.bar.disable();

        // data preparation
        {
            let meta = [];
            // meta
            {
                let _meta = params.meta || {};
                Object.keys(_meta).forEach(i => {
                    meta.push([ 0, i, _meta[i] ]);
                });
            }
            // images
            (() => {
                this.provider.setLinks();

                let provData = this.provider.data[src.fullPath],
                    links = provData ? provData.links : null;

                if (!links) return;
                let images = links.filter(i => i.keyword === 'рисунок');
                if (!images.length) return;

                let j = params.imagePath,
                    imagesPath = j[0] === '/' ? j : src.dir + '/' + j;

                if (!fs.existsSync(imagesPath)) {
                    this.message('warning', {
                        title: 'Отсутствует директория',
                        detail: `Документ содержит ссылки на изображения, но директория с изображениями ${imagesPath} отсутствует`
                    });
                } else {
                    images.forEach(i => {
                        let _imgFile = i.name + '.' + i.second,
                            _imgPath = imagesPath + '/' + _imgFile;

                        if (fs.existsSync(_imgPath)) {
                            let _stat = fs.statSync(_imgPath);

                            if (_stat.size <= maxFileSize) {
                                meta.push([ 1, _imgFile, fs.readFileSync(_imgPath) ]);
                            } else {
                                let mb = 1024 * 1024,
                                    _max = Math.round(maxFileSize / mb * 100) / 100,
                                    _fact = Math.round(_stat.size / mb * 100) / 100;
                                this.message('warning', {
                                    title: 'Превышение размера файла',
                                    detail: `Размер файла ${_imgFile} ${_fact} МБ превышает допустимый (${_max} МБ)`
                                });
                            }
                        } else {
                            this.message('warning', {
                                title: 'Отсутствует файл',
                                detail: `Документ содержит ссылку на файл ${_imgFile}, но в директории ${imagesPath} он не найден`
                            });
                        }
                    });
                }
            })();

            data = msgpack.encode([ fmtCode, src.editor.getText(), meta ]);
        }

        let isOpened, paneForUri, paneItemForUri,
            outPath = `${src.dir}/${src.name}.${fmt}`,
            uri = (fmt === 'html' ? htmlUri : '') + outPath;

        // check for opened pane with output file
        {
            if (typeof(callback) === 'function') {
                isOpened = true;
                this.bar.setColor('info');
            } else {
                paneForUri = atom.workspace.paneForURI(uri);
                if (paneForUri) {
                    paneItemForUri = paneForUri.itemForURI(uri);
                }
                isOpened = paneForUri && paneItemForUri;
            }
        }

        if (!isOpened && !paneItemForUri) {
            this.message('info', { title: 'Трансляция документа' })
        };

		this.sendRequest(data, params).then(r => {
            let codec = msgpack.createCodec({ useraw: true }),
                result = msgpack.decode(new Uint8Array(r), { codec });

            if (result[0]) {

                let title = result[0][1] ? result[0][1][0] : (result[1] || '');

                this.message('error', {
                    title:  String(title),
                    detail: result[0][0][0].toString()
                });
                return;
            }

            let content = result[1];
            fs.writeFile(outPath, content);

            this.bar.enable();
            this.processing = false;
            this.bar.setColor('success');

            if (typeof(callback) === 'function') {
                callback(content);
                return;
            }

            if (isOpened) {
                paneForUri.activateItem(paneItemForUri);
                return;
            }

            this.message('success', {
                title: 'Трансляция завершена',
                detail: 'Результаты записаны в файл ' + outPath,
                buttons: [{
                    className: 'btn btn-success',
                    text: 'Открыть файл',
                    onDidClick() {
                        atom.workspace.open(uri, { split: 'right' });
                    }
                }]
            });

        }, e => {
            if (e.status === 404 || e.status === 0) {
                this.message('error', { detail: 'Отсутствует подключение к транслятору' });
                return;
            }
            this.message('error', { detail: e.status + ': ' + e.statusText });
        });
	},

    sendRequest(data, p) {

		let url;
        // url generator
        {
            let protocol = p.useSsl ? 'https' : 'http',
                pfx = '/translate';
            url = `${protocol}://${p.host}:${p.port}${pfx}`;
        }

        return new Promise((resolve, reject) => {
            let xhr = new XMLHttpRequest();
    		xhr.open('POST', url);
    		xhr.responseType = 'arraybuffer';
    		xhr.withCredentials = true;
    		xhr.onreadystatechange = () => {
      			if (xhr.readyState != 4) return;
                if (xhr.status == 200) resolve(xhr.response);
                if (xhr.status == 404 || xhr.status == 0) {
                    reject({
                        status: xhr.status,
                        statusText: xhr.statusText
                    });
    			}
    		};
            xhr.onerror = () => {
                reject({
                    status: xhr.status,
                    statusText: xhr.statusText
                });
            };
            xhr.send(data);
        });
	},

    getParams(_src, name) {

        let src = _src || this.getSourceInfo();
        if (!src) return;
        let read = function(i) {
            let data = {};
            if (fs.existsSync(i)) {
                let fileData = fs.readFileSync(i);

                if (fileData.length) {
                    data = JSON.parse(fs.readFileSync(i));
                }
            }
            return data;
        };

        const s = {
            panel: this.bar.getParams(src.fullPath),
            file: read(`${src.dir}/${src.name}.json`),
            dir: read(`${src.dir}/prelum.json`),
            atom: atom.config.get('prelum')
        };

        let params = Object.assign(s.atom, s.dir, s.file, s.panel);
        if (name) return params[name];
        return params;
    },

    updateStatus() {
        this.bar.update();
    },

    getSourceInfo(_editor) {
        let editor = _editor || atom.workspace.getActiveTextEditor();
        if (!editor) return null;

        let res = {},
            savedPath = editor.getPath();

        res.status = savedPath ? 'saved' : 'notsaved';

        if (savedPath) {
            res = Object.assign(res, path.parse(savedPath));
        }

        let isPrelum =
            ['.pre', '.prelum'].indexOf(res.ext) >= 0
         || editor.getGrammar().name === 'Prelum';

        if (!isPrelum) return 'notprelum';
        res.fullPath = savedPath;
        res.editor = editor;
        return res;
    },

    goToLineHtml(_row) {
        let src = this.getSourceInfo(),
            editor = src.editor,
            row = _row || editor.getCursorBufferPosition().row;

        let line;
        // get keyword line number
        if (!line) {
            let getKeywordLine = function(_row) {
                if (_row < 0) return;

                let lineScopes = editor.scopeDescriptorForBufferPosition([ _row, 0 ]).scopes

                if (lineScopes.indexOf(grammars.block) >= 0) {

                    if (lineScopes.indexOf(grammars.blockKeyword) >= 0) {
                        return _row;
                    } else {
                        return getKeywordLine(_row - 1);
                    }

                } else if (lineScopes.indexOf(grammars.keyword) >= 0) {
                    return _row;
                } else {
                    return getKeywordLine(_row - 1);
                }
            };

            line = getKeywordLine(row) + 1;
        }

        this.translate('html', (content) => {
            let _uri = this.getOutputUri(src.fullPath, 'html'),
                paneItem = this.getOutputPaneItem(_uri)

            if (paneItem) {
                paneItem.scrollToDataLine(line);
            } else {
                atom.workspace.open(_uri, { split: 'right' }).then(i => {
                    i.scrollToDataLine(line);
                });
            }
        });
    },

    getOutputUri(_path, fmt) {
        if (fmt === null) return null;

        let p = path.parse(_path),
            pfx = fmt === 'html' ? htmlUri : '',
            baseUri = `${pfx}${p.dir}/${p.name}.`,
            uri;

        if (typeof(fmt) === 'string') {
            uri = baseUri + fmt;
        }

        if (typeof(fmt) === 'object') {
            uri = [];
            fmt.forEach(i => {
                uri.push(baseUri + i);
            });
        }

        return uri;
    },

    getOutputPaneItem(_uri) {
        let pane;

        let getItem = function(uri) {
            let _pane = atom.workspace.paneForURI(uri)
            if (_pane) return _pane.itemForURI(uri);
        }

        if (typeof(_uri) === 'string') {
            pane = getItem(_uri);
        }

        if (typeof(_uri) === 'object') {
            _uri.forEach(i => {
                if (pane) return;
                pane = getItem(i);
            });
        }

        return pane;
    },

    dismissNotifications() {
        notify.getNotifications().forEach(i => {
            i.dismiss();
        });
    },

    message(type, _p) {
        let params = _p;
        params.dismissable = true;

        notify.getNotifications().forEach(i => {
            if (i.type === 'warning') return;
            i.dismiss();
        });

        switch(type) {
            case 'error':
                notify.addError(`PRELUM: ${params.title || 'Ошибка трансляции документа'}`, params);
                this.bar.setColor('error');
                if (this.processing) {
                    this.bar.enable();
                    this.processing = false;
                }
                break;
            case 'warning':
                notify.addWarning(`PRELUM: ${params.title}`, params);
                break;
            case 'success':
                notify.addSuccess(`PRELUM: ${params.title}`, params);
                this.bar.setColor('success')
                break;
            default:
                notify.addInfo(`PRELUM: ${params.title}`, _p);
                this.bar.setColor('info');
                break;
        }
    },

    changeEditorContent(content) {
        let editor = atom.workspace.getActiveTextEditor();
        editor.selectAll();
        editor.delete();
        editor.insertText(content);
        editor.setCursorBufferPosition([0, 0]);
    },

    serialize() {},
    getProvider() { return this.provider; },
    consumeAutoreload(reloader) {
        return reloader({
            pkg: 'prelum',
            files: ["package.json",
                    "lib/prelum.js",
                    "lib/prelum-html-view.js",
                    "lib/completions.json",
                    "lib/modules/redmine/publish.js",
                    "grammars/prelum.json",
                    "lib/provider.js",
                    "lib/prelum-view.js",
                    "lib/prelum-bar.js",
                    "styles/htmlview.less",
                    "styles/prelum.less",
                    "styles/bar.less"]
        });
    }
};
