'use babel';

import { translate } from '../translate';
import { runPublish } from '../../publish/run';
import redminePublish from '../../publish/redmine';
import { getSourceInfo, goToLineHtml } from '../editor';
import { log } from '../../utils';
import plugin from '../../../prelum';

const commands = {
  'prelum:translate': () => prelumRun(translate),
  'prelum:publish': () => prelumRun(runPublish),
  'prelum:goToLineHtml': () => goToLineHtml(),
  'prelum:PDF': () => prelumRun(translate, 'pdf'),
  'prelum:TEX': () => prelumRun(translate, 'tex'),
  'prelum:HTML': () => prelumRun(translate, 'html'),
  'prelum:TEXTILE': () => prelumRun(translate, 'textile'),
  'prelum:redmine-publish': () => redminePublish(),
};

async function prelumRun(func, arg) {
  if (plugin.processing) return;

  plugin.bar.disable();

  plugin.processing = true;
  const source = getSourceInfo();

  if (!source.isPrelum) {
    return log('error', {
      detail: 'Ожидается файл формата Prelum',
    });
  }

  try {
    await func(arg);
  } catch (err) {
    log('error', {
      title: 'Ошибка',
      detail: err.message || err,
    });
  }

  plugin.processing = false;
  plugin.bar.enable();
}

export default function() {
  return atom.commands.add('atom-workspace', commands);
}
