'use babel';

import path from 'path';
import translate, { getOutputUri } from './translate';
import { grammars, vars } from './types';

export function getSourceInfo(_editor) {
    const editor = _editor || atom.workspace.getActiveTextEditor();
    if (!editor) return null;

    const grammar = editor.getGrammar();
    const savedPath = editor.getPath();
    let info = path.parse(savedPath || '');
    
    info.saved = !!savedPath;
    info.isPrelum = /pre|prelum/.test(info.ext) || grammar.name === 'Prelum';
    info.fullPath = savedPath;
    info.editor = editor;

    return info;
}

export function getKeywordLine(row, editor) {
    if (row < 0) return;

    const lineScopes = editor.scopeDescriptorForBufferPosition([row, 0]).scopes;
    
    if (lineScopes.indexOf(grammars.block) >= 0) {

        if (lineScopes.indexOf(grammars.blockKeyword) >= 0) {
            return row;
        } else {
            return getKeywordLine(row - 1, editor);
        }

    } else if (lineScopes.indexOf(grammars.keyword) >= 0) {
        return row;
    } else {
        return getKeywordLine(row - 1, editor);
    }
}

export function goToLineHtml(_row) {

    const src = getSourceInfo();
    
    if (!src) return;

    const editor = src.editor;
    const row = _row || editor.getCursorBufferPosition().row;
    const line = getKeywordLine(row, editor) + 1;

    translate('html', false).then((content) => {

        const uri = vars.htmlUriPrefix + getOutputUri(src, 'html');
        const paneItem = checkOpenedFile(uri);

        if (paneItem) {
            paneItem.scrollToDataLine(line);
        } else {
            atom.workspace.open(uri, { split: 'right' }).then(newPaneItem => {
                newPaneItem.scrollToDataLine(line);
            });
        }
    });
}

export function checkOpenedFile(uri) {
    const pane = atom.workspace.paneForURI(uri);
    const paneItem = pane ? pane.itemForURI(uri) : null;
    return paneItem;
}

export function changeEditorContent(content) {
    const editor = atom.workspace.getActiveTextEditor();
    editor.selectAll();
    editor.delete();
    editor.insertText(content);
    editor.setCursorBufferPosition([0, 0]);
}