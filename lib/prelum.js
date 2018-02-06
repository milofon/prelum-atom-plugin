'use babel';

import fs from 'fs';
import { CompositeDisposable } from 'atom';
import apd from 'atom-package-dependencies';
import config from './config.json';
import { getSourceInfo } from './modules/core/editor';
import log from './modules/core/log';
import hooks from './modules/core/hooks/index';
import provider from './modules/core/provider';
import PrelumBarView from './view/bar';

export default {
    subscriptions: new CompositeDisposable(),
    bar: new PrelumBarView(),
    processing: false,
	config,

	activate(state) {
        if (!atom.packages.isPackageLoaded('pdf-view')) {
            apd.install();
        }

        hooks();
        provider.init();
        this.updateStatus();
	},

    deactivate() {
        this.subscriptions.dispose();
        this.bar.destroy();
    },

    getParams(_src, paramName) {
        const src = _src || getSourceInfo();
       
        if (!src) return;

        const { fullPath, dir, name } = src;

        const read = filePath => {
            if (!fs.existsSync(filePath)) return;
            const fileData = fs.readFileSync(filePath);
            return JSON.parse(fileData);
        };

        const panelParams = this.bar.getParams(fullPath);
        const fileParams = read(`${dir}/${name}.json`);
        const dirParams = read(`${dir}/prelum.json`);
        const atomParams = atom.config.get('prelum');
        const params = Object.assign(atomParams, dirParams, fileParams, panelParams);
        
        return paramName ? params[paramName] : params;
    },

    updateStatus() {
        this.bar.update();
    },

    serialize() {

    },

    getProvider() { 
        return provider;
    }
};
