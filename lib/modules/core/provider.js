'use babel';

import completions from '../../templates/completions.json';
import specs from '../../templates/spec/index';
import plugin from '../../prelum';

const patterns = {
    dirty: /\S+/,
    // spec: /([а-яА-Яa-zA-Z-_\)\=\+]+)$/,
    supposedKeyword: /^(\S*)$/,
    keyword: /^([а-яА-Яa-zA-Z-_\)\=\+]+)(\()([^\)\n]*)(\))(\s|$)+/,
    link: /==([\s]*[\-а-яa-z0-9]*)$/
};

const _keywordNames = Object.keys(completions.keywords);

const preScopes = {
    param: 'support.class.var.prelum',
    bracket: 'support.function.prelum'
};

const keywordLinksExcluded = ['документ', 'листинг', 'содержание'];
const specKeyword = 'документ';

export default {
    selector: '.source.prelum, .plain.null-grammar',
    keywords: (() => {
        completions.keywords['документ'].params = specs;
        return completions.keywords;
    })(),
    excludeLowerPriority: true,

    /*
     * Объект для хранения собирательных артефактов
     */
    data: {},

    linksEdit: false,

    getSuggestions(request) {
        this.checkLinksChange(request);
        let s = this.getKeywords(request);
        if (!s.length) s = this.getKeywordParams(request);
        if (!s.length) s = this.getLinksData(request);
        return s;
    },

    onDidInsertSuggestion({ editor, suggestion, triggerPosition: tp }) {

        if (suggestion.symbol) {
            // автокомплит не может заменить ввод из символов
            if (tp.column > 0) {
                editor.setSelectedBufferRange([[tp.row, 0], tp])
                editor.delete();
                editor.moveRight(suggestion.displayText.length + 1);
            }
        }

        let _params = suggestion.params || [];

        if (_params.length) {
            return setTimeout(this.triggerAutocomplete.bind(this, editor), 1);
        }

        if (suggestion.type === 'import') {

            let scope = editor.getRootScopeDescriptor(),
                isEmptyScope = this.checkEmptyScope(scope),
                insert = function (text, pos) {
                    let _pos = pos || [0, 0];
                    editor.selectAll();
                    editor.delete();
                    editor.insertText(text);
                    editor.setCursorBufferPosition(_pos);
                };

            if (suggestion.meta.rowCount === 0 || isEmptyScope) {
                insert(suggestion.snippet);

                let preGram = atom.grammars.grammarForScopeName('source.prelum');
                editor.setGrammar(preGram);
                plugin.updateStatus();
                return;
            }

            atom.confirm({
                message: "Выполнить замену спецификации?",
                detailedMessage: suggestion.displayText,
                buttons: {
                    Да: function () {
                        insert(suggestion.snippet);
                    },
                    Нет: function () {
                        let srcText = suggestion.meta.sourceText,
                            srcPos = suggestion.meta.calledFromPosition;
                        insert(srcText, srcPos);
                    }
                }
            });
        }
    },

    triggerAutocomplete(editor) {
        return atom.commands.dispatch(atom.views.getView(editor), 'autocomplete-plus:activate', {
            activatedManually: false
        });
    },

    getKeywords({ editor, bufferPosition: bp, scopeDescriptor }) {
        /*
         * Определяем возможное ключевое слово по переносу строки, захватывая
         * предыдующую строку [строка, столбец]
         */
        let completions = [],
            text = editor.lineTextForBufferRow(bp.row),
            results = patterns.supposedKeyword.exec(text),
            isEmptyScope = this.checkEmptyScope(scopeDescriptor);


        if (results !== null) {
            let _word = results ? results[1].toLowerCase() : '',
                _keywords = [],
                // фильтруем если введена часть слова, если пусто - выводим все
                _flt = _src => _src.indexOf(_word) >= 0 || !_word;

            if (isEmptyScope) {

                if (bp.row === 0 && _word && specKeyword.indexOf(_word) >= 0) {
                    _keywords.push(specKeyword);
                }

            } else {
                _keywords = _keywordNames.filter(kwd => _flt(kwd));
            }

            _keywords.forEach(keyword => {
                let data = this.keywords[keyword] || {};
                completions.push({
                    snippet: data.snippet,
                    displayText: keyword,
                    description: data.description,
                    symbol: data.symbol,
                    params: data.params || [],
                    rightLabel: 'prelum',
                    type: data.type || 'keyword'
                });
            });
        }

        return completions;
    },

    getKeywordParams({ editor, bufferPosition: bp, scopeDescriptor }) {
        let _scopes = scopeDescriptor.getScopesArray(),
            completions = [],
            rowText = editor.lineTextForBufferRow(bp.row),
            isEmptyScope = this.checkEmptyScope(scopeDescriptor),
            isKeywordParam = this.checkParam(_scopes);

        if (!isKeywordParam && !isEmptyScope) return [];

        let results = patterns.keyword.exec(rowText);

        if (!results) return [];

        let keyword = results[1].toLowerCase(),
            param = results[3].toLowerCase(),
            keywordData = this.keywords[keyword] || {};

        if (keyword === specKeyword) {
            completions = this.setSpecParams({
                keywordData,
                param,
                bp,
                editor
            });
        } else if (!isEmptyScope) {
            let _params = keywordData.params || [];
            _params.forEach(_param => {
                if (_param.indexOf(param) < 0) return;
                completions.push({
                    text: _param,
                    rightLabel: 'prelum',
                    type: keywordData.paramsType || 'variable'
                });
            });
        }

        return completions;
    },

    setSpecParams({ keywordData: specData, param: entry, editor, bp }) {
        let sourceText = editor.getText();
        return specData.params
            .filter(i => i.text.toLowerCase().indexOf(entry) >= 0 || !entry)
            .map(_param => {
                let spec = specs.filter(i => i.key === _param.key)[0]
                return {
                    snippet: spec.snippet,
                    displayText: spec.text,
                    description: spec.description,
                    type: specData.paramsType,
                    rightLabel: 'prelum',
                    meta: {
                        rowCount: editor.getLastBufferRow(),
                        calledFromPosition: bp,
                        sourceText
                    },
                    info: function () {
                        this.text = '';
                        this.snippet = '';
                    }
                }
            });
    },

    setData(key, value, editor) {
        let path = editor.getPath(),
            data = this.data[path];

        if (!data) {
            data = this.data[path] = {};
        }

        data[key] = value;
    },

    getData(key, editor) {
        let currentEditorData = this.data[editor.getPath()] || {};
        return currentEditorData[key];
    },

    setLinks(params) {

        let editor = params ? params.editor : null;
        if (!editor) return;

        let _links = [],
            _regex = new RegExp(patterns.keyword, 'gm');

        editor.scan(_regex, (r) => {

            if (keywordLinksExcluded.indexOf(r.match[1]) >= 0) return;

            let _link = r.match[3];

            if (_link) {
                let args = _link.split(',');
                _links.push({
                    name: args[0],
                    keyword: r.match[1],
                    second: args[1] ? args[1].trim() : null
                });
            }
        });

        this.setData('links', _links, editor);
    },

    checkParam(_s) {
        return _s.indexOf(preScopes.param) >= 0 || _s.indexOf(preScopes.bracket) >= 0;
    },

    checkLinksChange({ editor, scopeDescriptor }) {
        let _scopes = scopeDescriptor.getScopesArray();

        if (this.checkParam(_scopes)) {
            this.linksEdit = true;
        } else if (this.linksEdit) {
            this.linksEdit = false;
            this.setLinks({ editor });
        }
    },

    checkEmptyScope(scopeDescriptor) {
        let _scope = scopeDescriptor.getScopesArray();
        return _scope.indexOf('text.plain.null-grammar') >= 0;
    },

    getLinksData({ editor, bufferPosition: bp, scopeDescriptor }) {
        let _completions = [],
            _start = [bp.row, 0];
        _text = editor.getTextInBufferRange([_start, bp]),
            entry = patterns.link.exec(_text);
        if (!entry) return [];

        let _result = [],
            _linkKey = entry[1],
            _editorLinks = this.getData('links', editor) || [];

        if (!_linkKey) {
            _result = _editorLinks;
        } else {
            _editorLinks.forEach(_link => {
                if (_link.name.indexOf(_linkKey) >= 0) {
                    _result.push(_link);
                };
            });
        }

        _result.forEach(r => {
            _completions.push({
                displayText: r.name,
                text: r.name + '==',
                leftLabel: r.keyword,
                rightLabel: 'prelum',
                type: 'constant',
                description: 'Ссылка на элемент в тексте'
            });
        });

        return _completions;
    },

    init() {
        let _conf = {
            enableExtendedUnicodeSupport: true,
            backspaceTriggersAutocomplete: true
        };

        Object.keys(_conf).forEach(i => {
            atom.config.set('autocomplete-plus.' + i, _conf[i]);
        });
    }
};
