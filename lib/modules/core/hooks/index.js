"use babel";

import plugin from "../../../prelum";
import commands from "./commands";
import provider from "../provider";
import { getSourceInfo, goToLineHtml } from "../editor";
import PrelumHtmlView from "../../../view/html";
import fs from "fs";
import $ from "jquery";
import PrelumBarView from "../../../view/bar";

function dblclick(event) {
  const element = $(event.target);

  if (element.hasClass("line-number")) {
    const line = parseInt(element.text().trim());
    const format = plugin.getParams(null, "format");

    if (Number.isNaN(line) || format !== "html") return;

    goToLineHtml(Math.max(0, line - 1));
  }
}

function appendBarToPrelumEditor(editor) {
  const src = getSourceInfo(editor);

  if (src && src.isPrelum && src.editor) {
    src.editor.bar = new PrelumBarView(src);
  }
}

export default function() {
  let subscriptions = [
    commands(),

    // atom.workspace.onDidChangeActivePaneItem(item => {
    //   plugin.updateStatus();
    // }),

    // atom.workspace.onDidAddTextEditor(item => {
    //   appendBarToPrelumEditor(item.textEditor);
    // }),

    atom.workspace.addOpener(uri => {
      if (uri.indexOf("prehtml://") === 0) {
        return new PrelumHtmlView(uri);
      }
    })

    // atom.workspace.onDidOpen(({ item }) => {
    //   const src = getSourceInfo();
    //   console.log(item);

    //   if (!src || !src.isPrelum) return;

    //   $(src.editor.element).bind('dblclick', dblclick);
    //   provider.setLinks(src);
    // }),
  ];

  atom.workspace.observeTextEditors(editor => {
    const src = getSourceInfo(editor);

    appendBarToPrelumEditor(editor);

    if (src && src.isPrelum) {
      provider.setLinks(src);
    }

    subscriptions.push(
      editor.onDidSave(e => {
        let src = getSourceInfo();

        editor.getTitle();

        if (!src) return;

        if (!src.ext) {
          const text = editor.getText();

          if (/^документ\(.*\)((.|\s(?!--))*)/m.test(text)) {
            editor.saveAs(e.path + ".pre");
            fs.unlinkSync(e.path);
          }
        }

        if (!src.isPrelum) return;

        // let auto = plugin.getParams(src, 'autoTranslate');
        // if (auto) {
        //   atom.commands.dispatch(
        //     plugin.bar.links.translate[0],
        //     'prelum:translate'
        //   );
        // }
      }),

      editor.onDidChangeGrammar(grammar => {
        // plugin.updateStatus();

        const editor = atom.workspace.getActiveTextEditor();

        if (!editor) return;

        if (grammar.name === "Prelum") {
          $(editor.element).bind("dblclick", dblclick);
        } else {
          $(editor.element).unbind("dblclick", dblclick);
        }
      })
    );
  });

  plugin.subscriptions.add(...subscriptions);
}
