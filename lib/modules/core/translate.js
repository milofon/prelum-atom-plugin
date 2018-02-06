'use babel';

import fs from 'fs';
import msgpack from 'msgpack-lite';
import { vars } from './types';
import { getSourceInfo, checkOpenedFile } from './editor';
import log, { clearLogs } from './log';
import plugin from '../../prelum';
import config from '../../config.json';
import provider from './provider';

class TranslateData {

    constructor(params, source, format) {
        this.params = params;
        this.source = source;
        this.format = format;
    }

    get meta() {
        const meta = this.params.meta || {};
        
        return Object.keys(meta).map(key => {
            return [0, key, meta[key]];
        });
    }

    get imagesPath() {
        const _path = this.params.imagePath;
        return _path[0] === '/' ? _path : this.source.dir + '/' + _path;
    }

    getImages() {
        provider.setLinks();

        const { source, imagesPath, maxFileSize } = this;

        let provData = provider.data[source.fullPath],
            links = provData ? provData.links : null;

        if (!links) return;

        let images = links.filter(i => i.keyword === 'рисунок');

        if (!images.length) return;

        if (!fs.existsSync(imagesPath)) {
            log('warning', {
                title: 'Отсутствует директория',
                detail: `Документ содержит ссылки на изображения, но директория с изображениями ${imagesPath} отсутствует`
            });

            return [];
        }
        
        return images.map(image => {
            let imgFile = image.name + '.' + image.second,
                imgPath = imagesPath + '/' + imgFile;

            const { maxFileSize } = vars;

            if (fs.existsSync(imgPath)) {
                let imgStat = fs.statSync(imgPath);

                if (imgStat.size <= maxFileSize) {
                    const imgData = fs.readFileSync(imgPath);
                    return [1, imgFile, imgData];
                } else {
                    const mb = 1024 * 1024;
                    const maxSize = Math.round(maxFileSize / mb * 100) / 100;
                    const factSize = Math.round(imgStat.size / mb * 100) / 100;
                    
                    log('warning', {
                        title: 'Превышение размера файла',
                        detail: `Размер файла ${imgFile} ${factSize} МБ превышает допустимый (${maxSize} МБ)`
                    });
                }
            } else {
                log('warning', {
                    title: 'Отсутствует файл',
                    detail: `Документ содержит ссылку на файл ${imgFile}, но в директории ${imagesPath} он не найден`
                });
            }
        });
    }

    prepare() {
        const text = this.source.editor.getText();
        const imgMeta = this.getImages();
        const meta = this.meta.concat(imgMeta);

        return msgpack.encode([ this.format, text, meta ]);
    }
}

async function translate(_format, logging = true) {
    if (plugin.processing) return;
    plugin.processing = true;

    const source = getSourceInfo();

    if (!source.saved) {
        log('error', {
            detail: 'Сохраните файл перед трансляцией'
        });
        return;
    }

    if (!source.isPrelum) {
        log('error', {
            detail: 'Ожидается файл формата Prelum'
        });
        return;
    }

    const params = plugin.getParams();
    const format = _format || params.format;
    const formatCode = config.format.enum.indexOf(format);
    const formatSupported = formatCode >= 0;

    if (!formatSupported) {
        log('error', {
            detail: `Формат ${format} не поддерживается`
        });
        return;
    }

    plugin.bar.disable();

    const data = new TranslateData(params, source, formatCode);
    const outPath = getOutputUri(source, format);
    const uri = (format === 'html' ? 'prehtml://' : '') + outPath;
    const openedPaneItem = checkOpenedFile(uri);

    if (!openedPaneItem && logging) {
        log('info', {
            title: 'Трансляция документа'
        });
    }

    const final = () => {
        plugin.processing = false;
        plugin.bar.enable();
    };

    try {
        const translatorData = await sendRequest(data.prepare(), params);
        const codec = msgpack.createCodec({ useraw: true });
        const result = msgpack.decode(new Uint8Array(translatorData), { codec });
        const isError = result[0];

        if (isError) {
            const title = result[0][1] ? result[0][1][0] : (result[1] || '');

            log('error', {
                title: String(title),
                detail: result[0][0][0].toString()
            });

            Promise.reject();
            return;
        }

        const content = result[1];

        fs.writeFileSync(outPath, content);

        final();
        plugin.bar.setColor('success');

        if (openedPaneItem) {
            const pane = atom.workspace.paneForURI(uri);
            pane.activateItem(openedPaneItem);
        } else if (logging) {
            log('success', {
                title: 'Трансляция завершена',
                detail: 'Результаты записаны в файл ' + outPath,
                buttons: [{
                    className: 'btn btn-success',
                    text: 'Открыть файл',
                    onDidClick() {
                        atom.workspace.open(uri, { split: 'right' });
                        clearLogs();
                    }
                }]
            });
        }

        return Promise.resolve(content);

    } catch (error) {
        final();

        if (error instanceof Error) {
            console.error(error);
        } else if (error.status === 404 || error.status === 0) {
            log('error', { 
                detail: 'Отсутствует подключение к транслятору' 
            });
        } else {
            log('error', {
                detail: error.status + ': ' + error.statusText
            });
        }
    }
}

async function sendRequest(data, params) {
    
    const { useSsl, host, port } = params;
    const url = (() => {
        const protocol = useSsl ? 'https' : 'http';
        return `${protocol}://${host}:${port}/translate`;
    })();
   
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.open('POST', url);
        xhr.responseType = 'arraybuffer';
        xhr.withCredentials = true;

        xhr.onreadystatechange = () => {
            if (xhr.readyState != 4) return;
            if (xhr.status == 200) {
                resolve(xhr.response);
            } else {
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
}

export function getOutputUri(source, format) {
    if (!format || !source) return null;

    const { dir, name } = source;
    return `${dir}/${name}.${format}`;
}



export default translate;