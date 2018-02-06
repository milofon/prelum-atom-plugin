'use babel';

const grammars = {
    prelum: 'source.prelum',
    keyword: 'entity.name.function.prelum',
    block: 'block.prelum',
    blockKeyword: 'entity.name.block.function.prelum'
};

const vars = {
    htmlUriPrefix: 'prehtml://',
    maxFileSize: 20971520
}

const regex = {
    keyword: /^([а-яА-Яa-zA-Z-_]+)(\()([^\)\n]*)(\))(\s|$)+/,
}

export default {
    grammars,
    vars   
}