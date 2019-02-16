'use babel';
import axios from 'axios';
import { updateParamInDocKeyword } from '../utils';

export async function publishToPublicator(url, docId, content) {
  const docUrl = url + '/documents';

  try {
    const { data } = await axios({
      method: docId ? 'PUT' : 'POST',
      url: docId ? `${docUrl}/${docId}` : docUrl,
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      data: content,
    });

    const paramStr = genPublicParams({
      url,
      docId: data.id,
    });

    updateParamInDocKeyword({
      keys: ['public'],
      searchString: url,
      newString: paramStr,
    });

    return Object.assign({ url }, data);
  } catch (err) {
    return {
      url,
      error: (err && err.response && err.response.data) || err,
    };
  }
}

function genPublicParams({ url, docId }) {
  return `public - ${url}, ${docId}`;
}
