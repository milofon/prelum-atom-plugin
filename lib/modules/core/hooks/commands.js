'use babel';

import translate from '../translate';
import redminePublish from '../../redmine/publish';
import { goToLineHtml } from '../editor';

const commands = {
    'prelum:translate': () => translate(),
    'prelum:goToLineHtml': () => goToLineHtml(),
    'prelum:PDF': () => translate('pdf'),
    'prelum:TEX': () => translate('tex'),
    'prelum:HTML': () => translate('html'),
    'prelum:TEXTILE': () => translate('textile'),
    'prelum:redmine-publish': () => redminePublish()
};

export default function() {
    return atom.commands.add('atom-workspace', commands);
}