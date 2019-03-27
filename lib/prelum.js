'use babel';

import axios from 'axios';
import fs from 'fs';
import { CompositeDisposable } from 'atom';
import apd from 'atom-package-dependencies';
import config from './config.json';
import { getSourceInfo } from './modules/core/editor';
import hooks from './modules/core/hooks/index';
import provider from './modules/core/provider';

export default {
  subscriptions: new CompositeDisposable(),
  processing: false,
  config,

  activate() {
    if (!atom.packages.isPackageLoaded('pdf-view')) {
      apd.install();
    }

    hooks();
    provider.init();
    this.getStyles();
  },

  deactivate() {
    this.subscriptions.dispose();

    if (this.bar) {
      this.bar.destroy();
    }
  },

  getParams(_src, paramName) {
    const src = _src || getSourceInfo();

    if (!src) return;

    const { dir, name } = src;

    const read = filePath => {
      if (!fs.existsSync(filePath)) return;
      const fileData = fs.readFileSync(filePath);
      return JSON.parse(fileData);
    };

    const fileParams = read(`${dir}/${name}.json`);
    const dirParams = read(`${dir}/prelum.json`);
    const atomParams = atom.config.get('prelum');
    const params = Object.assign(atomParams, dirParams, fileParams);

    return paramName ? params[paramName] : params;
  },

  serialize() {},

  getProvider() {
    return provider;
  },

  async getStyles() {
    const existsStyleElement = document.getElementById('prelum-styles');

    if (existsStyleElement) {
      existsStyleElement.remove();
    }

    const styleElement = document.createElement('style');
    const stylesUrl = atom.config.get('prelum.stylesUrl');

    styleElement.id = 'prelum-styles';

    if (!stylesUrl) return;

    const { data } = await axios.get(`${stylesUrl}/all.css`, {
      headers: {
        'Cache-Control': 'no-cache',
      },
    });

    styleElement.innerHTML = data;
    styleElement.setAttribute('type', 'text/css');
    document.head.appendChild(styleElement);
  },
};
