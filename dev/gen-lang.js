const path = require("path");
const fs = require("fs");
var convert = require('xml-js');
const rootDir = "/Users/jack/projects/client/android_client/app/src/main/res";
const destDir = "/Users/jack/projects/client/telegram-tt/src/util";

function doGen(orgPath,dstPath){
  const langStr = fs.readFileSync(path.join(rootDir,orgPath))
  const result1 = JSON.parse(convert.xml2json(langStr.toString()), {compact: true, spaces: 4});
  const {elements} = result1.elements[0];
  const jsonLang = {}
  for (let i = 0; i < elements.length; i++) {
    const {attributes,name} = elements[i];
    if(name === "string"){
      const k = attributes.name;
      const v = elements[i].elements[0].text;
      jsonLang[k] = {
        key:k,
        value:v
      }
    }
  }

  fs.writeFileSync(path.join(destDir,dstPath),Buffer.from(`/* eslint-disable max-len */

import type { ApiLangPack } from '../api/types';

export default ${JSON.stringify(jsonLang,null,2)} as ApiLangPack;
`))
}
//
// doGen("values/strings.xml","fallbackLangPack_en.ts");
// doGen("values-zh-rCN/strings.xml","fallbackLangPack_zh-rCN.ts");
