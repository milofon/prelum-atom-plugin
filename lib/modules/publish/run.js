'use babel';

import plugin from '../../prelum';
import { PrelumMsgpackBuilder } from '../translate/msgpack';
import { log, getDocKeywordParams } from '../utils';
import { getSourceInfo } from '../core/editor';
import { publishToRedmine } from './redmine';
import { publishToPublicator } from './publicator';

const PARAM_KEYS = ['public', 'redmine-wiki', 'redmine-issue'];

export async function runPublish() {
  const params = plugin.getParams();

  // поиск параметров публикации в ключевом слове документ()
  let pubParams = getDocKeywordParams(PARAM_KEYS).map(item => {
    const [url, id] = item.param.split(',');
    return {
      docId: (id || '').trim(),
      url: url.trim(),
      key: item.key,
    };
  });

  log('info', {
    title: 'Публикация документа',
    detail: pubParams.map(param => param.url).join('\n'),
  });

  if (pubParams.length === 0) {
    if (!params.publicatorUrl) {
      throw new Error('Не найдены ресурсы публикации');
    }

    pubParams.push({
      key: 'public',
      url: params.publicatorUrl,
    });
  }

  const source = getSourceInfo();
  const builder = new PrelumMsgpackBuilder(source);
  const msgpackData = builder.prepare();
  const requests = pubParams.map(({ url, docId, key }) => {
    if (key === 'public') {
      return publishToPublicator(url, docId, msgpackData);
    }
    return publishToRedmine(url, key, source.editor.getText());
  });

  let results = await Promise.all(requests);
  let haveErrors = false;

  results = results.filter(result => {
    if (result.error) {
      haveErrors = true;
    }
    return !!result;
  });

  log(haveErrors ? 'warning' : 'success', {
    title: 'Публикация завершена',
    detail: results
      .map(result => {
        const msg = result.error || 'Успешно';
        return `${result.url}\n${msg}`;
      })
      .join('\n---\n'),
  });

  plugin.bar.setColor(haveErrors ? 'warning' : 'success', 'publicator');
}
