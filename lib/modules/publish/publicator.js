'use babel';
import axios from 'axios';
import plugin from '../../prelum';
import { PrelumMsgpackBuilder } from '../translate/msgpack';
import { log, getDocKeywordParams, updateParamInDocKeyword } from '../utils';
import { getSourceInfo } from '../core/editor';

const PARAM_KEYS = ['public'];

export async function publish() {
  const params = plugin.getParams();

  log('info', {
    title: 'Публикация документа',
    detail: params.publicatorUrl,
  });

  // поиск параметров публикации в ключевом слове документ()
  let pubParams = getDocKeywordParams(PARAM_KEYS).map(item => {
    const [url, id] = item.param.split(',');
    return { docId: (id || '').trim(), url: url.trim() };
  });

  if (pubParams.length === 0) {
    pubParams.push({ url: params.publicatorUrl });
  }

  const source = getSourceInfo();
  const builder = new PrelumMsgpackBuilder(source);
  const content = builder.prepare();

  const requests = pubParams.map(({ url, docId }) => {
    return publishOnServer(url, docId, content);
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
        const prefix = result.error ? 'Ошибка' : 'Успешно';
        return `${prefix}: ${result.url}`;
      })
      .join('\n'),
  });

  plugin.bar.setColor(haveErrors ? 'warning' : 'success', 'publicator');
}

async function publishOnServer(url, docId, content) {
  const docUrl = url + '/document';

  try {
    const { data } = await axios({
      method: docId ? 'PUT' : 'POST',
      url: docId ? `${docUrl}/${docId}` : docUrl,
      responseType: 'json',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      data: content,
    });

    const paramStr = genPublicParams({
      url,
      docId: data.docId,
    });

    updateParamInDocKeyword({
      keys: PARAM_KEYS,
      searchString: url,
      newString: paramStr,
    });

    return Object.assign({ url }, data);
  } catch (err) {
    log('error', {
      title: 'Ошибка публикации',
      detail: `Не удалось опубликовать документ на ресурсе ${url}`,
      description: err.message || err,
    });

    return {
      url,
      error: err.message || err,
    };
  }
}

function genPublicParams({ url, docId }) {
  return `public - ${url}, ${docId}`;
}
