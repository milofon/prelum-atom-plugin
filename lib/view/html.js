'use babel';

import { log } from '../modules/utils';
import Prism from '../helpers/prism';
import $ from 'jquery';
import { File } from 'atom';
import hyphen from '../helpers/hyphen';
import rus from '../helpers/hyphen/patterns/ru.js';
import eng from '../helpers/hyphen/patterns/en-us.js';
import { getOutputUri } from '../modules/utils';
import { checkOpenedFile } from '../modules/core/editor';
import fs from 'fs';
import path from 'path';
import plugin from '../prelum';
import { loadAndTypeset } from 'mathjax-electron';

const hyphens = {
  ru: new hyphen(rus),
  en: new hyphen(eng),
};

const CLASSES = {
  view: 'prelum-html-view',
  key: 'p-key',
  menu: 'p-key-menu',
  image: 'p-image',
  link: {
    in: 'p-19-106-link-local',
  },
};

const htmlUri = 'prehtml://';

$.fn.hyphenate = function(language) {
  let hyphLang = hyphens[language];
  if (hyphLang) {
    return this.each(function() {
      var i = 0,
        len = this.childNodes.length;
      for (; i < len; i += 1) {
        if (this.childNodes[i].nodeType === 3) {
          this.childNodes[i].nodeValue = hyphLang.hyphenateText(
            this.childNodes[i].nodeValue
          );
        }
      }
    });
  }
};

let checkViewReady = function(ctx) {
  return new Promise(function(resolve) {
    function waitUntil() {
      setTimeout(function() {
        let container = ctx.getContentContainer();

        if (container.children().length > 0) {
          resolve();
        } else {
          waitUntil();
        }
      }, 100);
    }
    waitUntil();
  });
};

class PrelumHtmlView {
  constructor(uri) {
    this.uri = uri;
    this.plugin = plugin;
    this.timers = [];
    this.element = $('<div/>')
      .attr({
        id: CLASSES.view,
        lang: 'ru',
      })
      .click(e => {
        this.clickHandler(e);
      })[0];

    this.file = new File(uri.slice(htmlUri.length, uri.length));
    this.file.onDidChange(() => {
      this.read();
    });
    this.read();
  }

  read() {
    this.file.read(false).then(entry => {
      this.setContent(entry);
    });
  }

  clickHandler(e) {
    let _el = $(e.target),
      isInLink = _el.hasClass(CLASSES.link.in);

    if (isInLink) {
      this.scrollFromInLink(_el);
      return;
    }

    if (e.metaKey || e.altKey) {
      let line = null,
        _getLine = __el => {
          if (__el.attr('id') === CLASSES.view) return;
          line = __el.data('line');
          if (typeof line === 'number') {
            this.setSourceLine(line);
          } else {
            _getLine(__el.parent());
          }
        };
      _getLine(_el);
    }
  }

  setContent(content) {
    const that = this;

    let vNode = $(content),
      params = this.plugin.getParams(path.parse(this.file.path));
    //transform key & menu elements
    {
      vNode.find('.' + CLASSES.key).map((idx, _el) => {
        let key = $(_el),
          data = key.html().split(' ');
        key.html('');
        data.forEach((i, idx) => {
          if (idx % 2) {
            if (!key.hasClass(CLASSES.menu)) key.append('+');
          } else {
            key.append($('<span/>').html(i.trim()));
          }
        });
      });
    }
    //check image urls and highlight if not exists
    {
      let fileDir = this.file.getParent().path,
        j = params.imagePath,
        imgPath = j[0] === '/' ? j : fileDir + '/' + j,
        images = vNode.find('.' + CLASSES.image),
        imgMiss = function(i) {
          return $('<p/>')
            .addClass('p-image__miss')
            .html(`Файл изображения отсутствует<br/>${imgPath}/${i}`);
        };

      if (fs.existsSync(imgPath)) {
        images.each((idx, _el) => {
          let el = $(_el),
            _file = el.attr('src'),
            _path = imgPath + '/' + _file;

          if (fs.existsSync(_path)) {
            el.attr('src', 'file://' + _path);
          } else {
            el.replaceWith(imgMiss(_file));
          }
        });
      } else {
        images.each((idx, el) => {
          let _file = $(el).attr('src');
          $(el).replaceWith(imgMiss(_file));
        });
      }
    }

    if (params.showHtmlMargin) {
      $(this.element).addClass('show-margin');
    } else {
      $(this.element).removeClass('show-margin');
    }

    vNode.find('p, .hyphenate').each((idx, el) => {
      $(el).hyphenate('ru');
      $(el).addClass('native-key-bindings');
    });

    // mathjax process
    {
      // const formulas = vNode.find(`.${CLASSES.formula}`);

      // formulas.each((idx, el) => {
      //   el.innerHTML = `$$${el.innerHTML}$$`;
      // });

      vNode[0].style.visibility = 'hidden';
      vNode[0].style.position = 'absolute';
      vNode[0].style.zIndex = '-1';

      vNode.appendTo(document.body);
      Prism.highlightAllUnder(vNode[0]);

      loadAndTypeset(document, vNode[0], () => {
        vNode[0].style.visibility = null;
        vNode[0].style.position = null;
        vNode[0].style.zIndex = null;

        $(that.node).remove();
        that.node = vNode;

        vNode.appendTo(that.element);
      });
    }
  }

  setSourceLine(ln) {
    if (typeof ln !== 'number') return;

    const line = ln - 1;
    const sourceFilePath = path.parse(this.file.path);
    const searchFileUri = getOutputUri(sourceFilePath, 'prelum');
    const searchFileEditor = checkOpenedFile(searchFileUri);

    if (searchFileEditor) {
      searchFileEditor.setCursorBufferPosition([line, 0], {
        autoscroll: false,
      });
      searchFileEditor.selectToEndOfLine();
      searchFileEditor.scrollToCursorPosition();
    } else if (fs.existsSync(searchFileUri)) {
      atom.workspace.open(searchFileUri, {
        split: 'left',
        initialLine: line,
      });
    } else {
      log('warning', {
        title: 'Файл с исходным текстом отсутствует',
        detail: searchFileUri,
      });
    }
  }

  scrollFromInLink(_el) {
    let _link = _el.attr('href');

    if (_link[0] !== '#') return;

    let targetId = _link.slice(1, _link.length),
      linkTarget = document.getElementById(targetId);

    if (linkTarget) {
      let offsetTop = linkTarget.offsetTop;
      this.getElement().scrollTop = offsetTop;
    }
  }

  clearTimers() {
    this.timers.forEach(i => {
      clearTimeout(i);
    });
    this.timers.length = 0;
  }

  scrollToDataLine(line) {
    this.clearTimers();
    checkViewReady(this).then(() => {
      let _node = this.getElement(),
        lineNode = $(_node).find("[data-line='" + line + "']");

      lineNode.removeClass('pre-highlight--out');

      if (!lineNode.length) return;

      let offsetTop = lineNode[0].offsetTop;
      lineNode.addClass('pre-highlight');

      this.timers.push(
        setTimeout(() => {
          lineNode.addClass('pre-highlight--out');

          this.timers.push(
            setTimeout(() => {
              lineNode.removeClass('pre-highlight pre-highlight--out');
            }, 1000)
          );
        }, 1000)
      );

      this.getElement().scrollTop = offsetTop - 20;
    });
  }

  destroy() {
    $(this.element).off('click');
    $(this.element).remove();
  }

  serialize() {}
  getDefaultLocation() {
    return 'center';
  }
  getAllowedLocations() {
    return ['center'];
  }
  getPane() {
    return atom.workspace.paneForURI(this.getURI());
  }
  getURI() {
    return this.uri;
  }
  getTitle() {
    return this.file.getBaseName();
  }
  getElement() {
    return this.element;
  }
  getContentContainer() {
    return $(this.getElement()).children();
  }
}

export default PrelumHtmlView;
