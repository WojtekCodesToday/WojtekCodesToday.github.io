import { github, Repo } from "./github.js";
import { jbody, load } from "../../index.js";

import javascript from '../../assets/javascript.svg';
import react from '../../assets/react.svg';
import scratch from '../../assets/scratch.svg';
import python from '../../assets/python.svg';
import roost from "../../roost2.js";

function lang(url, src, name, alt){
  return {
      "href": url,
      "target": "_blank",
      "child": {
        "img": {
          "src": src,
          "class": `logo ${name}`,
          "alt": `${alt}`
        }
      }
  }
  /*<a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript" target="_blank">
          <img src={javascript} className="logo javascript" alt="js" />
        </a>*/
}
function main(){
    jbody.child = {
      "div-0": {
        "child": {
          "h1-0": {
            "child":"woj's site"
          },
          "div-0": {
            "class": "pf box2d"
          },
          "p-0": {
            "child":"uhh hi im wojtek"
          },
          "p-1": {
            "child":"i use vscode and windows<br>i also draw stuff because why not"
          },
          "p-2": {
            "child":"soo i learnt these languages listed below:"
          },
          "div-1":{
            "child":{}
          }
        }
      },
      "h2-1": {
        "child":"my github projects:"
      },
        "div-1": {
          "id": "gh",
          "child":{}
      }
    }
  jbody.child["div-0"].child["div-1"].child["a-0"] = lang("https://developer.mozilla.org/en-US/docs/Web/JavaScript", javascript, "javascript", "js")
  jbody.child["div-0"].child["div-1"].child["a-1"] = lang("https://react.dev", react, "react", "react")
  jbody.child["div-0"].child["div-1"].child["a-2"] = lang("https://scratch.mit.edu", scratch, "scratch", "scratch")
  jbody.child["div-0"].child["div-1"].child["a-3"] = lang("https://python.org", python, "python", "python")
  //async ()=> {
  //  jbody.child["div-1"] = await github();
  //}
  load.after = async()=>{
    let json = await github();
    document.getElementById("gh").innerHTML = roost.convert(json);
  }
  /*    document.querySelector('#app').innerHTML = `
  <div>
  <a href="https://vite.dev" target="_blank">
  <img src="${viteLogo}" class="logo" alt="Vite logo" />
  </a>
  <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript" target="_blank">
  <img src="${javascriptLogo}" class="logo vanilla" alt="JavaScript logo" />
  </a>
  <h1>Hello Vite!</h1>
  <div class="card">
  <button id="counter" type="button"></button>
  </div>
  <p class="read-the-docs">
  Click on the Vite logo to learn more
  </p>
  </div>`*/

}

export default main;