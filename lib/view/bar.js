'use babel';

import $ from 'jquery';
import { CompositeDisposable } from 'atom';
import * as utils from '../modules/utils';

const prefix = 'prelum-bar';
const CLASSES = {
  left: prefix + '__left',
  right: prefix + '__right',
  translate: prefix + '__translate',
  auto: prefix + '__auto',
  formats: prefix + '__formats',
  newSpec: prefix + '__new-spec',
  specList: prefix + '__spec-list',
  overlay: prefix + '__overlay',
  logo: prefix + '__logo',
  loader: prefix + '__loader',
  settings: prefix + '__settings',
  publish: prefix + '__publish',
  status: prefix + '__status'
};

class PrelumBarView {
  constructor(src) {
    const element = $(`
      <div class="${prefix}">
        <div class="${CLASSES.left}">
          <div class="${CLASSES.logo}">prelum</div>
          <div class="prelum-translate">
            <button class="btn prelum-html-button">HTML</button>
            <button class="btn prelum-pdf-button">PDF</button>
          </div>
          <label class="input-label">
            <input type="checkbox" class="input-toggle ${CLASSES.auto}">
          </label>
          <button class="btn prelum-public-button">Публикация</button>
        </div>
        <div class="${CLASSES.right} ${CLASSES.settings}">
          <div class="loading loading-spinner-tiny ${CLASSES.loader}"></div>
          <button class="btn icon icon-gear" />
        </div>
      </div>
    `);

    const links = {
      auto: element.find(`.${CLASSES.auto}`),
      loader: element.find(`.${CLASSES.loader}`),
      settings: element.find(`.${CLASSES.settings}`),
      statusTitle: element.find(`.${CLASSES.status}-title`),
      statusLoader: element.find(`.${CLASSES.status}-loader`)
    };

    element.find('.prelum-html-button').click(function() {
      atom.commands.dispatch(this, 'prelum:HTML');
    });

    element.find('.prelum-pdf-button').click(function() {
      atom.commands.dispatch(this, 'prelum:PDF');
    });

    element.find('.prelum-public-button').click(function() {
      atom.commands.dispatch(this, 'prelum:publish');
    });

    // create event listeners
    {
      links.auto.click(() => {
        this.autoTranslate = !this.autoTranslate;
      });

      links.settings.click(function() {
        atom.workspace.open('atom://config/packages/prelum');
      });
    }

    // create tooltips
    {
      atom.tooltips.add(links.auto[0], {
        title: 'Автоматическая трансляция при сохранении',
        delay: 1000
      });

      atom.tooltips.add(links.settings[0], {
        title: 'Открыть настройки плагина',
        delay: 1000
      });
    }

    links.loader.hide();

    this.element = element[0];
    this.src = src;
    this.autoTranslate = atom.config.get('prelum.autoTranslate');
    this.links = links;
    this.timers = [];
    this.dispossables = new CompositeDisposable();

    if (this.autoTranslate) {
      links.auto.prop('checked', true);
    }

    element.appendTo(src.editor.element);
    src.editor.element.style.flexDirection = 'column';

    this.dispossables.add(
      atom.notifications.onDidAddNotification(notification => {
        if (notification.type === 'error') {
          this.enable();
        }
      }),
      src.editor.onDidSave(() => {
        if (this.autoTranslate) {
          const format = utils.getOpenedFormat(src).toUpperCase();
          atom.commands.dispatch(
            this.element,
            `prelum:${format || 'translate'}`
          );
        }
      })
    );
  }

  serialize() {}

  destroy() {
    $(this.element).remove();
    this.dispossables.dispose();
  }

  getPanel() {
    return atom.workspace.panelForItem(this);
  }

  setColor(type, format) {
    if (!type) return;

    this.timers.forEach(i => {
      clearTimeout(i);
    });

    const classes = 'btn-info btn-success btn-error btn-warning';

    const buttons = [
      '.prelum-html-button',
      '.prelum-pdf-button',
      '.prelum-public-button'
    ]

    buttons.forEach(btnClass => {
      const btn = $(btnClass)

      if (btn) btn.removeClass(classes)
    })

    const target = $(`.prelum-${format}-button`);

    if (target) {
      target.addClass('btn-' + type);
    }

    this.timers.push(
      setTimeout(() => {
        target.removeClass(classes);
      }, 2400)
    );
  }

  disable() {
    $(this.element)
      .find('input, button')
      .each((i, el) => {
        el.disabled = true;
      });

    this.links.loader.show();
  }

  enable() {
    $(this.element)
      .find('input, button')
      .each((i, el) => {
        el.disabled = false;
      });

    this.links.loader.hide();
  }
}

export default PrelumBarView;
