'use babel';

import plugin from '../../prelum';
import log, { clearLogs } from '../core/log';
import { getSourceInfo } from '../core/editor';

const { notifications } = atom;
const urlRegex = /(https?:\/\/)?(([\da-zа-я0-9\.-]+)\.([a-zа-я\.]{2,10})(:[0-9]+)?)([\/\w\.~-]*)*\//;

export default function() {

    const src = getSourceInfo();

    if (!src.isPrelum) {
        log('error', { 
            detail: 'Ожидается файл формата Prelum' 
        });
        return;
    }

    clearLogs();

    let links = [];

    // get links
    {
        let metaRange;

        src.editor.scan(/^документ\(.*\)((.|\s(?!--))*)/m, function(result) {
            metaRange = result.range;
        });

        src.editor.scanInBufferRange(/(redmine-wiki|redmine-issue)\s\-\s(.+)/mg, metaRange, function(result) {
            const match = result.match;
            const url = match[2].trim();

            links.push({
                type: match[1].trim(),
                host: (url.match(urlRegex) || [])[2],
                url
            });
        });
    }

    if (links.length === 0) {
        log('info', {
            title: 'Нет ресурсов для публикации'
        });
        return;
    }

    plugin.bar.showStatus();

    let counter = 0;

    const apiKeys = atom.config.get('prelum.apiKeys') || [];

    function publish(resource) {

        if (!resource) return;

        plugin.bar.updateStatusPanel({
            title: 'Публикация на ресурсе ' + resource.url,
            loader: true,
            close: false
        });

        const apiKey = (apiKeys.find(i => i.host === resource.host) || {}).key;

        if (!apiKey) {
            error(resource, 'Не найден ключ API для ресурса ' + resource.host);
            next();
        } else {
            const xhr = new XMLHttpRequest();

            xhr.open('PUT', resource.url + '.json?key=' + apiKey);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.responseType = 'json';
            xhr.withCredentials = true;
            xhr.onreadystatechange = () => {
                if (xhr.readyState != 4) return;
                if (xhr.status == 200) {
                    resource.status = 'success';
                }

                if (xhr.status === 0 && xhr.statusText === '') {
                    error(resource, 'Неизвестная ошибка, возможно нет связи с ресурсом');
                } else if (/^0|4/.test(xhr.status)) {
                    error(resource, xhr.statusText);
                }

                next();
            };

            const data = (function() {

                const editorContent = src.editor.getText();

                return resource.type === 'redmine-wiki' ?
                    {
                        "wiki_page": {
                            "text": editorContent
                        }
                    } :
                    {
                        "issue": {
                            "description": editorContent
                        }
                    }
            })();

            xhr.send(JSON.stringify(data));
        }
    }

    function error(resource, error) {
        resource.status = 'error';
        notifications.addError('PRELUM: Ошибка публикации', {
            detail: `${error} (${resource.url})`,
            dismissable: true
        })
    }

    function next() {
        const next = links[++counter];

        if (next) {
            publish(next);
        } else {
            final();
        }
    }

    function final() {

        let success = [];
        let errors = [];

        links.forEach(link => {
            if (link.status === 'success') {
                success.push(link);
            } else if (link.status === 'error') {
                errors.push(link);
            }
        });

        plugin.bar.updateStatusPanel({
            title: `<span class="text-success">Опубликовано</span> - <b>${success.length}</b>&ensp;&ensp;<span${errors.length ? ' class="text-error"' : ''}>Ошибок</span> - <b>${errors.length}</b>&ensp;&ensp;Всего - <b>${links.length}</b>`,
            loader: false,
            close: true
        })
    }

    publish(links[counter]);

}
