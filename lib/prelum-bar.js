'use babel';

import $ from 'jquery';
import config from './config.json';
import specs from './templates/index.js';


const specName = /поле-3-д\s+\-\s+([^\n]+)/;
const keyword = /^(документ)(\()([^\)\n]*)(\))(\s|$)+/;

const prefix = 'prelum-bar';
const CLASSES = {
    left: prefix + '__left',
    right: prefix + '__right',
    translate: prefix + '__translate',
    auto: prefix + '__auto',
    formats: prefix + '__formats',
    newSpec: prefix + '__new-spec',
    specList: prefix + '__spec-list',
    overlay: prefix + '__overlay',
    logo: prefix + '__logo',
    loader: prefix + '__loader',
    settings: prefix + '__settings',
    publish: prefix + '__publish',
    status: prefix + '__status'
}

export default class PrelumBarView {

	constructor(plugin) {

        let element = $(`
            <div class="${prefix}">
                <div class="${CLASSES.status}">
                    <div class="${CLASSES.status}-title"></div>
                    <div class="${CLASSES.status}-right">
                        <div class="loading loading-spinner-tiny ${CLASSES.status}-loader"></div>
                        <button class="btn icon icon-remove-close ${CLASSES.status}-close"></button>
                    </div>
                </div>
                <div class="${CLASSES.left}">
                    <button class="inline-block btn ${CLASSES.translate}">Трансляция</button>
                    <label class="input-label ${CLASSES.auto}">
                        <input type="checkbox" class="input-toggle"></input>
                    </label>
                    <div class="btn-group ${CLASSES.formats}"></div>
                    <button class="btn ${CLASSES.newSpec} icon icon-file"></button>
                    <button class="btn ${CLASSES.settings} icon icon-gear"></button>
                    <button class="btn ${CLASSES.publish} icon icon-globe"></button>
                </div>
                <div class="${CLASSES.right}">
                    <div class="loading loading-spinner-tiny ${CLASSES.loader}"></div>
                    <div class="${CLASSES.logo}">Prelum</div>
                </div>
            </div>
        `);

        let links = {
            translate: element.find(`.${CLASSES.translate}`),
            auto: element.find(`.${CLASSES.auto}`),
            autoInput: element.find(`.${CLASSES.auto} input`),
            formats: element.find(`.${CLASSES.formats}`),
            newSpec: element.find(`.${CLASSES.newSpec}`),
            loader: element.find(`.${CLASSES.loader}`),
            settings: element.find(`.${CLASSES.settings}`),
            publish: element.find(`.${CLASSES.publish}`),
            status: element.find(`.${CLASSES.status}`),
            statusTitle: element.find(`.${CLASSES.status}-title`),
            statusLoader: element.find(`.${CLASSES.status}-loader`),
            statusClose: element.find(`.${CLASSES.status}-close`),
        };

        let that = this;

        // generate modal window for spec selecting
        let genSpecWindow = () => {

            let modal = $(`
                <div class="select-list ${CLASSES.specList}">
                    <input type="search"
                           placeholder="Наименование спецификации"
                           class="input-search native-key-bindings">
                    </input>
                    <ol class="list-group"></ol>
                </div>
            `)

            let genSpecList = (_input) => {

                let _specs = specs,
                    _specList = modal.find('ol');

                if (_input) {
                    let str = _input.toLowerCase().trim();
                    _specs = _specs.filter(i => {
                        return i.text.toLowerCase().indexOf(str) >= 0;
                    });
                }

                _specList.children().remove();

                _specs.forEach(spec => {
                    $('<li/>')
                    .html(spec.text)
                    .appendTo(_specList)
                    .click(() => {
                        atom.confirm({
                            message: 'Выполнить замену спецификации?',
                            detailedMessage: spec.text,
                            buttons: {
                                Да: () => {
                                    that.plugin.changeEditorContent(spec.snippet)
                                    atom.workspace.panelForItem(modal).destroy();
                                },
                                Нет: () => {}
                            }
                        });
                    });
                })
            };

            modal.find('.input-search')
                 .on('input', function(e) {
                     genSpecList(e.target.value);
                 });

            genSpecList();

            return modal;
        };

        // create event listeners
        {
            links.translate.click(function() {
                atom.commands.dispatch(this, 'prelum:translate')
            });

            links.auto.click(function(e) {
                that.setParam('autoTranslate', e.target.checked);
            });

            links.newSpec.click(function() {
                let specModal = genSpecWindow(),
                    modalPanel = atom.workspace.addModalPanel({
                        item: specModal
                    });

                $(`<div class="${CLASSES.overlay}"></div>`)
                .appendTo(modalPanel.element)
                .click(function(e) {
                    modalPanel.destroy();
                });

                specModal.find('.input-search').focus();
            });

            links.settings.click(function() {
                atom.workspace.open('atom://config/packages/prelum');
            });

            links.publish.click(function() {
                atom.commands.dispatch(this, 'prelum:redmine-publish');
            });

            links.statusClose.click(() => {
                this.hideStatus();
            })
        }

        // create format buttons
        {
            config.format.enum.forEach(i => {
                $('<button/>')
                    .addClass('btn')
                    .appendTo(links.formats)
                    .html(i)
                    .click(function() {
                        that.setParam('format', $(this).html());
                    });
            });
        }

        // create tooltips
        {
            atom.tooltips.add(links.auto[0], {
                title: 'Автоматическая трансляция при сохранении',
                delay: 1000
            });

            atom.tooltips.add(links.newSpec[0], {
                title: 'Изменить спецификацию документа',
                delay: 1000
            });

            atom.tooltips.add(links.settings[0], {
                title: 'Открыть настройки плагина',
                delay: 1000
            });
        }

        links.loader.hide();
        links.status.hide();
        links.statusClose.hide();

        this.element = element[0];
        this.params = {};
        this.plugin = plugin;
        this.links = links;
        this.timers = [];
	}

  	serialize() {}

	destroy() {
        this.getPanel().destroy();
        $(this.element).remove();
	}

    setEditorParams() {
        if (!this.plugin.checkScope()) return;
    }

    getPanel() {
        return atom.workspace.panelForItem(this);
    }

    update() {
        let src = this.plugin.getSourceInfo(),
            panel = this.getPanel();

        if (!panel) return;

        if (src !== null && typeof(src) === 'object') {
            panel.show();
            this.updateValues(src.fullPath);
        } else {
            panel.hide();
        }
    }

    updateValues(path) {
        let params = this.getParams(path),
            links = this.links;

        links.autoInput[0].checked = links.translate[0].disabled = params.autoTranslate;
        links.formats.children().each((i, _el) => {
            let el = $(_el);
            if (el.html() === params.format) {
                el.addClass('selected');
            } else {
                el.removeClass('selected');
            }
        });
    }

    setParam(param, value) {
        let src = this.plugin.getSourceInfo(),
            fileParams = this.getParams(src.fullPath);

        fileParams[param] = value;
        this.update();
    }

    getParams(path) {
        if (!this.params[path]) {
            let _p = {};
            _p['autoTranslate'] = atom.config.get('prelum.autoTranslate');
            _p['format'] = this.links.formats.find('.selected').html()
                        || atom.config.get('prelum.format');

            this.params[path] = _p;
        }
        return this.params[path];
    }

    clearTimers() {
        this.timers.forEach(i => {
            clearTimeout(i);
        });
    }

    setColor(type) {
        if (!type) return;

        this.clearTimers();

        let translate = this.links.translate,
            cls = 'btn-info btn-success btn-error';

        translate.removeClass(cls);
        translate.addClass('btn-' + type);

        this.timers.push(setTimeout(() => {
            translate.removeClass(cls);
        }, 2400));
    }

    disable() {
        $(this.element).find('input, button').each((i, el) => {
            el.disabled = true;
        });
        this.links.loader.show();
    }

    enable() {
        let src = this.plugin.getSourceInfo();
        $(this.element).find('input, button').each((i, el) => {
            if ($(el).hasClass(CLASSES.translate)
                && this.params[src.fullPath]['autoTranslate']) {
                el.disabled = true;
                return;
            }
            el.disabled = false;
        });
        this.links.loader.hide();
    }

    showStatus() {
        this.links.status.show();
    }

    hideStatus() {
        this.links.status.hide();
    }

    updateStatusPanel(params) {
        if (!params) return;

        if (typeof params === 'string') {
            this.links.statusTitle.html(params);
        } else {
            this.links.statusTitle.html(params.title);

            if (params.loader) {
                this.links.statusLoader.show();
            } else if (params.loader === false) {
                this.links.statusLoader.hide();
            }

            if (params.close) {
                this.links.statusClose.show();
            } else if (params.close === false) {
                this.links.statusClose.hide();
            }
        }
    }
}
