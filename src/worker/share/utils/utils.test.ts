import {parseCmd} from "./stringParse";

it('should parseCmd', function () {
  const t = parseCmd("1/setting 1 setting /setting",["setting"]);
  console.log(t)
});
