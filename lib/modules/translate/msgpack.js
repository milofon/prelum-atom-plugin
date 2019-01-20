'use babel';

import fs from 'fs';
import msgpack from 'msgpack-lite';
import provider from '../core/provider';
import { vars } from '../core/types';
import plugin from '../../prelum';
import { log } from '../utils';

export class PrelumMsgpackBuilder {
  constructor(source, format = 0) {
    this.source = source;
    this.format = format;
  }

  get params() {
    return plugin.getParams();
  }

  get meta() {
    const meta = this.params.meta || {};

    return Object.keys(meta).map(key => {
      return [0, key, meta[key]];
    });
  }

  get imagesPath() {
    const _path = this.params.imagePath;
    return _path[0] === '/' ? _path : this.source.dir + '/' + _path;
  }

  getImages() {
    provider.setLinks();

    const { source, imagesPath } = this;
    const provData = provider.data[source.fullPath];
    const links = provData ? provData.links : null;

    if (!links) return;

    const images = links.filter(i => i.keyword === 'рисунок');

    if (!images.length) return;

    if (!fs.existsSync(imagesPath)) {
      log('warning', {
        title: 'Отсутствует директория',
        detail: `Документ содержит ссылки на изображения, но директория с изображениями ${imagesPath} отсутствует`,
      });

      return [];
    }

    const metaImages = images.map(image => {
      const imgFile = image.name + '.' + image.second;
      const imgPath = imagesPath + '/' + imgFile;
      const { maxFileSize } = vars;

      if (fs.existsSync(imgPath)) {
        const imgStat = fs.statSync(imgPath);

        if (imgStat.size <= maxFileSize) {
          const imgData = fs.readFileSync(imgPath);
          return [1, imgFile, imgData];
        } else {
          const mb = 1024 * 1024;
          const maxSize = Math.round((maxFileSize / mb) * 100) / 100;
          const factSize = Math.round((imgStat.size / mb) * 100) / 100;

          log('warning', {
            title: 'Превышение размера файла',
            detail: `Размер файла ${imgFile} ${factSize} МБ превышает допустимый (${maxSize} МБ)`,
          });
        }
      } else {
        log('warning', {
          title: 'Отсутствует файл',
          detail: `Документ содержит ссылку на файл ${imgFile}, но в директории ${imagesPath} он не найден`,
        });
      }
    });

    const titlePath = `${imagesPath}/титульный-лист-логотип.png`;
    const haveTitle = fs.existsSync(titlePath);

    if (haveTitle) {
      const titleImageContent = fs.readFileSync(titlePath);
      metaImages.push([1, 'титульный-лист-логотип.png', titleImageContent]);
    }

    return metaImages;
  }

  prepare() {
    const text = this.source.editor.getText();

    let imgMeta = [];

    if (this.format === 2 || this.format === -1) {
      imgMeta = this.getImages();
    }

    const meta = this.meta.concat(imgMeta);
    return msgpack.encode([this.format, text, meta]);
  }
}
