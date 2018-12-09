'use babel';

import axios from 'axios';
import { regex } from '../core/types';

export async function publishToRedmine(url, key, content) {
  const host = url.match(regex.url)[2];
  const apiKeys = atom.config.get('prelum.apiKeys') || [];
  const apiConfig = apiKeys.find(i => i.host === host);

  if (!apiConfig) {
    return { error: 'Не найден ключ API', url };
  }

  let reqData = {
    issue: {
      description: content,
    },
  };

  if (key === 'redmine-wiki') {
    reqData = {
      wiki_page: {
        text: content,
      },
    };
  }

  try {
    const { data } = axios({
      method: 'PUT',
      url: `${url}.json?key=${apiConfig.key}`,
      headers: {
        'Content-Type': 'application/json',
      },
      responseType: 'json',
      withCredentials: true,
      data: reqData,
    });

    return Object.assign({ url }, data);
  } catch (err) {
    return {
      url,
      error: err.message || err,
    };
  }
}
