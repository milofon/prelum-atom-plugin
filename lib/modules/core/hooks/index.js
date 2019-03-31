'use babel';

import plugin from '../../../prelum';
import commands from './commands';
import provider from '../provider';
import { getSourceInfo, goToLineHtml } from '../editor';
import PrelumHtmlView from '../../../view/html';
import fs from 'fs';
import $ from 'jquery';
import PrelumBarView from '../../../view/bar';

function dblclick(event) {
  const element = $(event.target);

  if (element.hasClass('line-number')) {
    const line = parseInt(element.text().trim());

    if (Number.isNaN(line)) return;

    goToLineHtml(Math.max(0, line - 1));
  }
}

function appendBarToPrelumEditor(editor) {
  const src = getSourceInfo(editor);

  if (src && src.isPrelum && src.editor && !src.editor.bar) {
    src.editor.bar = new PrelumBarView(src);
  }
}

export default function() {
  let subscriptions = [
    commands(),

    atom.workspace.addOpener(uri => {
      if (uri.indexOf('prehtml://') === 0) {
        return new PrelumHtmlView(uri);
      }
    })
  ];

  atom.workspace.observeTextEditors(editor => {
    const src = getSourceInfo(editor);

    appendBarToPrelumEditor(editor);

    if (src && src.isPrelum) {
      $(src.editor.element).bind('dblclick', dblclick);
      provider.setLinks(src);
    }

    subscriptions.push(
      editor.onDidSave(e => {
        let src = getSourceInfo();

        if (src && !src.ext) {
          const text = editor.getText();

          if (/^документ\(.*\)((.|\s(?!--))*)/m.test(text)) {
            editor.saveAs(e.path + '.pre');
            fs.unlinkSync(e.path);
          }
        }
      }),
      editor.onDidChangeGrammar(grammar => {
        const editor = atom.workspace.getActiveTextEditor();

        if (!editor) return;

        if (grammar.name === 'Prelum' && !editor.bar) {
          $(editor.element).bind('dblclick', dblclick);
          appendBarToPrelumEditor(editor);
        }
      })
    );
  });

  plugin.subscriptions.add(...subscriptions);
}
