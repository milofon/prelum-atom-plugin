'use babel';

import fs from 'fs';
import axios from 'axios';
import msgpack from 'msgpack-lite';
import { getSourceInfo, checkOpenedFile } from './editor';
import { log, clearLogs, getOutputUri } from '../utils';
import plugin from '../../prelum';
import config from '../../config.json';
import { PrelumMsgpackBuilder } from '../translate/msgpack';

export async function translate(_format, logging = true) {
  const source = getSourceInfo();

  if (!source.saved) {
    log('error', {
      detail: 'Сохраните файл перед трансляцией',
    });
    return;
  }

  const params = plugin.getParams();
  const format = _format || params.format;
  const formatCode = config.format.enum.indexOf(format);
  const formatSupported = formatCode >= 0;

  if (!formatSupported) {
    log('error', {
      detail: `Формат ${format} не поддерживается`,
    });
    return;
  }

  const outPath = getOutputUri(source, format);
  const uri = (format === 'html' ? 'prehtml://' : '') + outPath;
  const openedPaneItem = checkOpenedFile(uri);

  if (!openedPaneItem && logging) {
    log('info', {
      title: 'Трансляция документа',
    });
  }

  const response = await axios({
    url: params.translateUri,
    method: 'POST',
    responseType: 'arraybuffer',
    withCredentials: true,
    headers: {
      'Content-Type': 'application/octet-stream',
    },
    data: new PrelumMsgpackBuilder(source, formatCode).prepare(),
    timeout: 30000,
  });

  const codec = msgpack.createCodec({ useraw: true });
  const result = msgpack.decode(new Uint8Array(response.data), { codec });
  const isError = result[0];

  if (isError) {
    const title = result[0][1] ? result[0][1][0] : result[1] || '';
    throw new Error(title + ': ' + result[0][0][0].toString());
  }

  const content = result[1];

  fs.writeFileSync(outPath, content);

  source.editor.bar.setColor('success', format);

  if (openedPaneItem) {
    const pane = atom.workspace.paneForURI(uri);
    pane.activateItem(openedPaneItem);
  } else if (logging) {
    log('success', {
      title: 'Трансляция завершена',
      detail: 'Результаты записаны в файл ' + outPath,
      buttons: [
        {
          className: 'btn btn-success',
          text: 'Открыть файл',
          onDidClick() {
            atom.workspace.open(uri, { split: 'right' });
            clearLogs();
          },
        },
      ],
    });
  }

  return content;
}
