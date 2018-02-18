'use babel';

import plugin from '../../../prelum';
import commands from './commands';
import provider from '../provider';
import { getSourceInfo, goToLineHtml } from '../editor';
import PrelumHtmlView from '../../../view/html';
import translate from '../translate';
import $ from 'jquery';

function dblclick(event) {
    const element = $(event.target);
   
    if (element.hasClass('line-number')) {
        const line = parseInt(element.text().trim());
        const format = plugin.getParams(null, 'format');

        if (Number.isNaN(line) || format !== 'html') return;

        goToLineHtml(Math.max(0, line - 1));
    }
};

export default function() {
    
    let subscriptions = [ 
        
        commands(),
        
        atom.workspace.onDidChangeActivePaneItem(() => {
            plugin.updateStatus();
        }),

        atom.workspace.addOpener(uri => {
            if (uri.indexOf('prehtml://') === 0) {
                return new PrelumHtmlView(uri);
            }
        }),

        atom.workspace.onDidOpen(event => {
            const src = getSourceInfo();

            if (!src || !src.isPrelum) return;

            $(src.editor.element).bind('dblclick', dblclick);
            provider.setLinks(src);
        })
    ];

    atom.workspace.observeTextEditors((editor) => {
        const src = getSourceInfo(editor);
        
        if (src && src.isPrelum) {
            provider.setLinks(src);
        }

        subscriptions.push(

            editor.onDidSave(() => {
                let src = getSourceInfo();
                if (!src || !src.isPrelum) return;
                let auto = plugin.getParams(src, 'autoTranslate');
                if (auto) translate();
            }),

            editor.onDidChangeGrammar(grammar => {
                plugin.updateStatus();

                const editor = atom.workspace.getActiveTextEditor();

                if (!editor) return;
                
                if (grammar.name === 'Prelum') {
                    $(editor.element).bind('dblclick', dblclick);
                } else {
                    $(editor.element).unbind('dblclick', dblclick);
                }
            })
        );

    });

    plugin.subscriptions.add(...subscriptions)
}

