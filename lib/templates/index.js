'use babel';

import gost_19__201_78 from './19__201_78.json';
import gost_19__202_78 from './19__202_78.json';
import gost_19__301_79 from './19__301_79.json';
import gost_19__402_78 from './19__402_78.json';
import gost_19__403_79 from './19__403_79.json';
import gost_19__404_79 from './19__404_79.json';
import gost_19__502_78 from './19__502_78.json';
import gost_19__503_79 from './19__503_79.json';
import gost_19__504_79 from './19__504_79.json';
import gost_19__505_79 from './19__505_79.json';
import gost_19__506_79 from './19__506_79.json';
import gost_19__507_79 from './19__507_79.json';
import gost_7__32_2001 from './7__32_2001.json';

const specs = {
    gost_19__201_78,
    gost_19__202_78,
    gost_19__301_79,
    gost_19__402_78,
    gost_19__403_79,
    gost_19__404_79,
    gost_19__502_78,
    gost_19__503_79,
    gost_19__504_79,
    gost_19__505_79,
    gost_19__506_79,
    gost_19__507_79,
    gost_7__32_2001
}

let _specs = (function() {
    return Object.keys(specs).map(key => {
        return {
            key,
            code: specs[key].code,
            text: specs[key].text,
            snippet: specs[key].snippet
        }
    });
})();

export default _specs;
