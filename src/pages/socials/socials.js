import { jbody } from "../.."
import socialsData from "./socials.json"
function socials(){
    const containerStyle = "display: flex; gap: 2rem; font-family: monospace;";
    const columnStyle = "flex: 1 1 0%; display: flex; flex-direction: column; gap: 1rem;";
    jbody.child = {
        "h1-0": {
            "child": "list of socials i have"
        },
        "div-1":{
            "style":containerStyle,
            "child": {
                "div-0": {
                    "style":columnStyle,
                    "child":{}
                },
                "div-1": {
                    "style":columnStyle,
                    "child":{}
                }
            }
        }
    }
    let i = 0;
    Object.keys(socialsData).slice(0, Math.ceil(Object.keys(socialsData).length / 2)).map((domain) => {
        jbody.child["div-1"].child["div-0"].child["div-"+i] = {
            "child": {
                "h2-0": {
                    "child": domain
                }
            }
        }
        if (Array.isArray(socialsData[domain])) {
            let ai =0;
            socialsData[domain].map((account, index) => {
                jbody.child["div-1"].child["div-0"].child["div-"+i].child["a-"+ai] = {
                    "class": "sociall",
                    "href": `https://${domain}${account}`,
                    "target": "_blank",
                    "child": `${account}<br>`
                }
                ai++;
            });
        } else {
            jbody.child["div-1"].child["div-0"].child["div-"+i].child["a-1"] = {
                "class": "sociall",
                "href": `https://${domain}${socialsData[domain]}`,
                "target": "_blank",
                "child": socialsData[domain]
            }
        }
        i++;
    });
    Object.keys(socialsData).slice(Math.ceil(Object.keys(socialsData).length / 2)).map((domain) => {
        jbody.child["div-1"].child["div-1"].child["div-"+i] = {
            "child": {
                "h2-0": {
                    "child": domain
                }
            }
        }
        if (Array.isArray(socialsData[domain])) {
            let ai =0;
            socialsData[domain].map((account, index) => {
                jbody.child["div-1"].child["div-1"].child["div-"+i].child["a-"+ai] = {
                    "class": "sociall",
                    "href": `https://${domain}${account}`,
                    "target": "_blank",
                    "child": `${account}<br>`
                }
                ai++;
            });
        } else {
            jbody.child["div-1"].child["div-1"].child["div-"+i].child["a-1"] = {
                "class": "sociall",
                "href": `https://${domain}${socialsData[domain]}`,
                "target": "_blank",
                "child": socialsData[domain]
            }
        }
        i++;
    });
}
export default socials