'use babel';

export const grammars = {
  prelum: 'source.prelum',
  keyword: 'entity.name.function.prelum',
  block: 'block.prelum',
  blockKeyword: 'entity.name.block.function.prelum',
};

export const vars = {
  htmlUriPrefix: 'prehtml://',
  maxFileSize: 20971520,
};

export const regex = {
  keyword: /^([а-яА-Яa-zA-Z-_]+)(\()([^\)\n]*)(\))(\s|$)+/,
  url: /(https?:\/\/)?(([\da-zа-я0-9\.-]+)\.([a-zа-я\.]{2,10})(:[0-9]+)?)([\/\w\.~-]*)*\//,
};
