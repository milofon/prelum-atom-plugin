'use babel';

import { translate } from '../translate';
import { runPublish } from '../../publish/run';
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
  'prelum:redmine-publish': () => prelumRun(runPublish),
  'prelum:reload-styles': () => plugin.getStyles()
};

async function prelumRun(func, arg) {
  if (plugin.processing) return;

  const source = getSourceInfo();

  if (!source.isPrelum) {
    return log('error', {
      detail: 'Ожидается файл формата Prelum'
    });
  }

  try {
    source.editor.bar.disable();
    plugin.processing = true;
    await func(arg);
  } catch (err) {
    log('error', {
      title: 'Ошибка',
      detail: err.message || err
    });
  }

  plugin.processing = false;
  source.editor.bar.enable();
}

export default function() {
  return atom.commands.add('atom-workspace', commands);
}
