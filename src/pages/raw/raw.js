import "./raw.css"
import { jbody, load } from "../../index.js";
import page from "../../site.js";
const raw = {
    raw(json){
        let formattedJson = JSON.stringify(json, null, 2);
        document.title = document.location.pathname
        return `<textarea id="raw">${formattedJson}</textarea>`;
    },
    page(){
        for (let i = 0; i < page.pages.length; i++) {
            jbody.child["a-"+i] = {
                "href":page.pages[i],
                "child":{
                    "h3":{
                        "id":"a-"+i,
                        "child":page.pages[i]
                    }
                }
            };
            jbody.child["a-"+i+"11"] = {
                "href":page.pages[i]+"#raw",
                "child":{
                    "h3":{
                        "id":"a-"+i,
                        "child":page.pages[i]+" (raw)"
                    }
                }
            };
            
        }
        load.after = ()=>{
            for (let i = 0; i < page.pages.length; i++) {
                //document.getElementById("a-"+i).onclick = ()=>{page.load.dynamic(page.pages[i])};
                //document.getElementById("a-"+i).removeAttribute("id")
            }
        }
    }
}

export default raw;